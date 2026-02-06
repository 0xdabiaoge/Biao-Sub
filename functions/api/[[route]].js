import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { handle } from 'hono/cloudflare-pages'
import { generateToken, safeBase64Encode } from '../_lib/utils.js';
import { generateNodeLink, toClashProxy, assembleGroupConfig } from '../_lib/generator.js';
import { parseNodesCommon } from '../_lib/parser.js';

const app = new Hono().basePath('/api')

// --- 表结构迁移优化 ---
app.use('/*', async (c, next) => {
    // 确保 groups 表有 cached_yaml 字段
    try {
        await c.env.DB.prepare(`ALTER TABLE groups ADD COLUMN cached_yaml TEXT`).run();
    } catch (e) {
        // 如果字段已存在，会报错，忽略即可
    }
    await next();
})

app.use('/*', cors())

// --- 鉴权中间件 ---
app.use('/*', async (c, next) => {
    const path = c.req.path
    if (path.endsWith('/login') || path.includes('/g/')) return await next()
    const authHeader = c.req.header('Authorization')
    if (authHeader !== c.env.ADMIN_PASSWORD) return c.json({ success: false, error: 'Unauthorized' }, 401)
    await next()
})
app.onError((err, c) => c.json({ error: err.message }, 500))

// --- 核心路由 ---
app.get('/g/:token', async (c) => {
    const token = c.req.param('token');
    const format = c.req.query('format') || 'base64';

    try {
        // 1. 优先尝试从缓存读取
        const group = await c.env.DB.prepare("SELECT name, cached_yaml, clash_config FROM groups WHERE token = ? AND status = 1").bind(token).first();
        if (!group) return c.text('Invalid Group Token', 404);

        // 设置文件名
        const filename = encodeURIComponent(group.name || 'GroupConfig');
        c.header('Content-Disposition', `attachment; filename*=UTF-8''${filename}.yaml; filename="${filename}.yaml"`);
        c.header('Subscription-Userinfo', 'upload=0; download=0; total=1073741824000000; expire=0');

        let yamlContent = "";

        // 如果是 Clash 请求且已有缓存，直接吐出 (极速)
        if (format === 'clash' && group.cached_yaml) {
            return c.text(group.cached_yaml, 200, { 'Content-Type': 'text/yaml; charset=utf-8' });
        }

        // 2. 如果无缓存或非 Clash 格式，现场生成
        yamlContent = await assembleGroupConfig(c.env.DB, token, parseNodesCommon);
        if (yamlContent === null) return c.text('Generate Failed', 500);

        // 如果是 Clash 格式且刚才生成了，存入缓存备用
        if (format === 'clash') {
            await c.env.DB.prepare("UPDATE groups SET cached_yaml = ? WHERE token = ?").bind(yamlContent, token).run();
            return c.text(yamlContent, 200, { 'Content-Type': 'text/yaml; charset=utf-8' });
        }

        // Base64 逻辑（通用订阅格式）
        // 从 YAML 中提取 proxies 部分转为 base64 链接列表比较复杂，
        // 我们依然采用轻量级的动态提取方式处理 base64 订阅
        // (由于主要是自建节点，这一步压力不大)
        const clashConfig = group.clash_config ? JSON.parse(group.clash_config) : { mode: 'generate' };
        let targetConfig = JSON.parse(group.config || '[]');
        if (clashConfig.resources && clashConfig.resources.length > 0) targetConfig = clashConfig.resources;

        let allLinks = [];
        for (const item of targetConfig) {
            const sub = await c.env.DB.prepare("SELECT url FROM subscriptions WHERE id = ?").bind(item.subId).first();
            if (sub && sub.url) {
                const nodes = parseNodesCommon(sub.url);
                nodes.forEach(n => allLinks.push(generateNodeLink(n)));
            }
        }
        return c.text(safeBase64Encode(allLinks.join('\n')), 200, { 'Content-Type': 'text/plain; charset=utf-8' });

    } catch (e) { return c.text(e.message, 500); }
})

// --- API Endpoints ---
app.get('/subs', async (c) => {
    const { results } = await c.env.DB.prepare("SELECT * FROM subscriptions ORDER BY sort_order ASC, id DESC").all();
    return c.json({ success: true, data: results.map(i => { try { i.info = JSON.parse(i.info); } catch (e) { i.info = {}; } return i; }) })
})
app.post('/subs', async (c) => {
    const b = await c.req.json();
    const type = b.type || 'sub';
    const content = b.url || "";
    // 强制服务端解析以获取准确数量
    const nodes = parseNodesCommon(content);

    // 逻辑：如果是 'node' 类型且包含多个节点，则拆分
    if (type === 'node' && nodes.length > 1) {
        const stmt = c.env.DB.prepare("INSERT INTO subscriptions (name,url,type,params,info,sort_order,status) VALUES (?,?,?,?,?,0,1)");
        const batch = nodes.map((n, i) => {
            // 命名逻辑：如果用户未填写 name，则使用节点原名；否则使用 "用户填写的名" + 序号 (因为是同一批)
            let name = b.name ? ((i === 0 && nodes.length === 1) ? b.name : `${b.name} ${i + 1}`) : n.name;
            // 使用生成的标准链接
            let url = n.link;
            let info = JSON.stringify({ nodeCount: 1 });
            return stmt.bind(name, url, 'node', JSON.stringify({}), info);
        });
        await c.env.DB.batch(batch);
        return c.json({ success: true, count: nodes.length });
    }

    // 正常单条插入 (Group 或 单个 Node)
    let info = b.info || {};
    // 强制更新 nodeCount
    info.nodeCount = nodes.length;

    await c.env.DB.prepare("INSERT INTO subscriptions (name,url,type,params,info,sort_order,status) VALUES (?,?,?,?,?,0,1)")
        .bind(b.name || (nodes.length > 0 ? nodes[0].name : 'New Resource'), b.url, type, JSON.stringify({}), JSON.stringify(info)).run();
    return c.json({ success: true });
})
app.put('/subs/:id', async (c) => {
    const b = await c.req.json(); const id = c.req.param('id');

    // 如果更新了 URL，重新计算节点数量
    if (b.url !== undefined) {
        const nodes = parseNodesCommon(b.url);
        if (!b.info) b.info = {};
        b.info.nodeCount = nodes.length;
    }

    let parts = ["updated_at=CURRENT_TIMESTAMP"]; let args = [];
    if (b.name !== undefined) { parts.push("name=?"); args.push(b.name) } if (b.url !== undefined) { parts.push("url=?"); args.push(b.url) }
    if (b.type !== undefined) { parts.push("type=?"); args.push(b.type) } if (b.status !== undefined) { parts.push("status=?"); args.push(parseInt(b.status)) }
    if (b.info) { parts.push("info=?"); args.push(JSON.stringify(b.info)) }
    const query = `UPDATE subscriptions SET ${parts.join(', ')} WHERE id=?`; args.push(id);
    await c.env.DB.prepare(query).bind(...args).run();

    // 自建节点场景优化：如果修改了单节点资源，自动刷新所有包含该资源的聚合组缓存
    try {
        const affectedGroups = await c.env.DB.prepare("SELECT id, token FROM groups").all();
        const batchUpdates = [];
        for (const g of affectedGroups.results) {
            // 这里简单检查，因为 config 是 JSON 字符串
            const fullGroup = await c.env.DB.prepare("SELECT config, clash_config FROM groups WHERE id = ?").bind(g.id).first();
            const config = JSON.parse(fullGroup.config || '[]');
            const clashConfig = fullGroup.clash_config ? JSON.parse(fullGroup.clash_config) : {};
            const resources = clashConfig.resources || [];

            const isUsed = config.some(c => c.subId == id) || resources.some(r => r.subId == id);
            if (isUsed) {
                const newYaml = await assembleGroupConfig(c.env.DB, g.token, parseNodesCommon);
                if (newYaml) {
                    batchUpdates.push(c.env.DB.prepare("UPDATE groups SET cached_yaml = ? WHERE id = ?").bind(newYaml, g.id));
                }
            }
        }
        if (batchUpdates.length > 0) await c.env.DB.batch(batchUpdates);
    } catch (e) { console.error('Refresh related groups failed:', e.message); }

    return c.json({ success: true })
})
app.delete('/subs/:id', async (c) => { await c.env.DB.prepare("DELETE FROM subscriptions WHERE id=?").bind(c.req.param('id')).run(); return c.json({ success: true }) })
app.post('/subs/delete', async (c) => {
    const { ids } = await c.req.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) return c.json({ success: true });
    // 改用 Batch 删除，更稳定
    const stmt = c.env.DB.prepare("DELETE FROM subscriptions WHERE id = ?");
    await c.env.DB.batch(ids.map(id => stmt.bind(id)));
    return c.json({ success: true })
})
app.post('/sort', async (c) => { const { ids } = await c.req.json(); const s = c.env.DB.prepare("UPDATE subscriptions SET sort_order=? WHERE id=?"); await c.env.DB.batch(ids.map((id, i) => s.bind(i, id))); return c.json({ success: true }) })
app.post('/subs/reorder', async (c) => { const { order } = await c.req.json(); const s = c.env.DB.prepare("UPDATE subscriptions SET sort_order=? WHERE id=?"); await c.env.DB.batch(order.map((id, i) => s.bind(i, id))); return c.json({ success: true }) })

// --- 聚合组管理 ---
app.get('/groups', async (c) => {
    const { results } = await c.env.DB.prepare("SELECT * FROM groups ORDER BY sort_order ASC, id DESC").all();
    return c.json({
        success: true, data: results.map(g => ({
            ...g,
            config: JSON.parse(g.config || '[]'),
            clash_config: g.clash_config ? JSON.parse(g.clash_config) : { mode: 'generate', header: "", groups: [], rules: "", resources: [], raw_yaml: "" }
        }))
    })
})
app.post('/groups', async (c) => {
    const b = await c.req.json();
    const token = generateToken();
    const clashConfig = b.clash_config || { mode: 'generate', header: "", groups: [], rules: "", resources: [], raw_yaml: "" };

    // 1. 先插入基础数据
    await c.env.DB.prepare("INSERT INTO groups (name, token, config, clash_config, status, sort_order) VALUES (?, ?, ?, ?, 1, 0)")
        .bind(b.name, token, JSON.stringify(b.config || []), JSON.stringify(clashConfig)).run();

    // 2. 立即生成一次静态缓存并更新
    const yaml = await assembleGroupConfig(c.env.DB, token, parseNodesCommon);
    if (yaml) {
        await c.env.DB.prepare("UPDATE groups SET cached_yaml = ? WHERE token = ?").bind(yaml, token).run();
    }

    return c.json({ success: true })
})
app.put('/groups/:id', async (c) => {
    const b = await c.req.json(); const id = c.req.param('id');
    let parts = ["updated_at=CURRENT_TIMESTAMP"]; let args = [];

    if (b.name !== undefined) { parts.push("name=?"); args.push(b.name) }
    if (b.config !== undefined) { parts.push("config=?"); args.push(JSON.stringify(b.config)) }
    if (b.clash_config !== undefined) { parts.push("clash_config=?"); args.push(JSON.stringify(b.clash_config)) }
    if (b.status !== undefined) { parts.push("status=?"); args.push(parseInt(b.status)) }

    let newToken = null;
    if (b.refresh_token) {
        newToken = generateToken();
        parts.push("token=?"); args.push(newToken);
    }

    // 如果修改了配置，标记需要重新生成缓存
    const shouldRefreshCache = b.config !== undefined || b.clash_config !== undefined || b.refresh_token;

    const query = `UPDATE groups SET ${parts.join(', ')} WHERE id=?`; args.push(id);
    await c.env.DB.prepare(query).bind(...args).run();

    // 如果需要刷新缓存
    if (shouldRefreshCache) {
        const group = await c.env.DB.prepare("SELECT token FROM groups WHERE id = ?").bind(id).first();
        if (group) {
            const yaml = await assembleGroupConfig(c.env.DB, group.token, parseNodesCommon);
            if (yaml) {
                await c.env.DB.prepare("UPDATE groups SET cached_yaml = ? WHERE id = ?").bind(yaml, id).run();
            }
        }
    }

    return c.json({ success: true })
})
app.delete('/groups/:id', async (c) => { await c.env.DB.prepare("DELETE FROM groups WHERE id=?").bind(c.req.param('id')).run(); return c.json({ success: true }) })
app.post('/groups/reorder', async (c) => {
    const { order } = await c.req.json();
    if (!order || !Array.isArray(order)) return c.json({ success: false, error: 'Invalid order' });
    const stmt = c.env.DB.prepare("UPDATE groups SET sort_order=? WHERE id=?");
    await c.env.DB.batch(order.map((id, idx) => stmt.bind(idx, id)));
    return c.json({ success: true });
})

// --- 模板管理 ---
app.get('/templates', async (c) => {
    try {
        // 自动创建表（如果不存在）
        await c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            header TEXT,
            groups TEXT,
            rules TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`).run();
        const { results } = await c.env.DB.prepare("SELECT * FROM templates ORDER BY id DESC").all();
        return c.json({
            success: true, data: results.map(t => ({
                ...t,
                groups: t.groups ? JSON.parse(t.groups) : []
            }))
        });
    } catch (e) { return c.json({ success: false, error: e.message }) }
})
app.post('/templates', async (c) => {
    const b = await c.req.json();
    await c.env.DB.prepare("INSERT INTO templates (name, header, groups, rules) VALUES (?, ?, ?, ?)")
        .bind(b.name, b.header || '', JSON.stringify(b.groups || []), b.rules || '').run();
    return c.json({ success: true });
})
app.put('/templates/:id', async (c) => {
    const b = await c.req.json(); const id = c.req.param('id');
    await c.env.DB.prepare("UPDATE templates SET name=?, header=?, groups=?, rules=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(b.name, b.header || '', JSON.stringify(b.groups || []), b.rules || '', id).run();
    return c.json({ success: true });
})
app.delete('/templates/:id', async (c) => {
    await c.env.DB.prepare("DELETE FROM templates WHERE id=?").bind(c.req.param('id')).run();
    return c.json({ success: true })
})

// --- Check / Login ---
app.post('/check', async (c) => {
    const { url, type } = await c.req.json();
    try {
        let content = url || "";
        const nodes = parseNodesCommon(content);
        return c.json({ success: true, data: { valid: true, nodeCount: nodes.length, nodes } });
    } catch (e) { return c.json({ success: false, error: e.message }) }
})
app.post('/login', async (c) => { const { password } = await c.req.json(); return c.json({ success: password === c.env.ADMIN_PASSWORD }) })
app.get('/backup', async (c) => {
    try {
        const subs = (await c.env.DB.prepare("SELECT * FROM subscriptions").all()).results;
        const groups = (await c.env.DB.prepare("SELECT * FROM groups").all()).results;
        const templates = (await c.env.DB.prepare("SELECT * FROM templates").all()).results;

        return c.json({
            success: true,
            data: {
                // 统一格式，确保解析 JSON 字段
                items: subs.map(s => { try { s.info = JSON.parse(s.info); } catch (e) { s.info = {}; } return s; }),
                groups: groups.map(g => {
                    try {
                        g.config = JSON.parse(g.config || '[]');
                        g.clash_config = JSON.parse(g.clash_config || '{}');
                    } catch (e) {
                        g.config = []; g.clash_config = {};
                    }
                    return g;
                }),
                templates: templates.map(t => {
                    try {
                        t.groups = JSON.parse(t.groups || '[]');
                    } catch (e) {
                        t.groups = [];
                    }
                    return t;
                })
            }
        });
    } catch (e) { return c.json({ success: false, error: e.message }) }
})

app.post('/restore', async (c) => {
    const { items, groups, templates } = await c.req.json();
    try {
        const batch = [];
        if (items && Array.isArray(items)) {
            const s = c.env.DB.prepare("INSERT INTO subscriptions (name, url, type, info, params, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)");
            items.forEach(i => batch.push(s.bind(i.name, i.url, i.type || 'subscription', JSON.stringify(i.info || {}), JSON.stringify(i.params || {}), i.status ?? 1, i.sort_order ?? 0)));
        }
        if (groups && Array.isArray(groups)) {
            const s = c.env.DB.prepare("INSERT INTO groups (name, token, config, clash_config, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
            groups.forEach(g => batch.push(s.bind(g.name, g.token, JSON.stringify(g.config || []), JSON.stringify(g.clash_config || {}), g.status ?? 1, g.sort_order ?? 0)));
        }
        if (templates && Array.isArray(templates)) {
            const s = c.env.DB.prepare("INSERT INTO templates (name, header, groups, rules) VALUES (?, ?, ?, ?)");
            templates.forEach(t => batch.push(s.bind(t.name, t.header || '', JSON.stringify(t.groups || []), t.rules || '')));
        }

        if (batch.length > 0) await c.env.DB.batch(batch);
        return c.json({ success: true });
    } catch (e) { return c.json({ success: false, error: e.message }) }
})

export const onRequest = handle(app)
