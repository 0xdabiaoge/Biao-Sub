import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { handle } from 'hono/cloudflare-pages'
import { generateToken, safeBase64Encode } from '../_lib/utils.js';
import { generateNodeLink, toClashProxy } from '../_lib/generator.js';
import { parseNodesCommon } from '../_lib/parser.js';

const app = new Hono().basePath('/api')
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
        const group = await c.env.DB.prepare("SELECT * FROM groups WHERE token = ? AND status = 1").bind(token).first();
        if (!group) return c.text('Invalid Group Token', 404);

        const baseConfig = JSON.parse(group.config || '[]');
        const clashConfig = group.clash_config ? JSON.parse(group.clash_config) : { mode: 'generate' };

        // 设置文件名
        const filename = encodeURIComponent(group.name || 'GroupConfig');
        c.header('Content-Disposition', `attachment; filename*=UTF-8''${filename}.yaml; filename="${filename}.yaml"`);
        c.header('Subscription-Userinfo', 'upload=0; download=0; total=1073741824000000; expire=0');

        // 1. Raw YAML Mode
        if (format === 'clash' && clashConfig.mode === 'raw') {
            return c.text(clashConfig.raw_yaml || "", 200, { 'Content-Type': 'text/yaml; charset=utf-8' });
        }

        // 2. Generate Mode
        let targetConfig = baseConfig;
        if (format === 'clash' && clashConfig.resources && clashConfig.resources.length > 0) {
            targetConfig = clashConfig.resources;
        }

        let allNodes = [];
        const allNodeNamesSet = new Set();

        for (const item of targetConfig) {
            const sub = await c.env.DB.prepare("SELECT * FROM subscriptions WHERE id = ?").bind(item.subId).first();
            if (!sub) continue;

            let content = sub.url || "";
            if (!content) continue;

            const nodes = parseNodesCommon(content);
            let allowed = 'all';
            if (item.include && Array.isArray(item.include) && item.include.length > 0) allowed = new Set(item.include);

            // 获取链式代理配置
            const dialerProxyConfig = item.dialerProxy || { enabled: false, group: '' };

            for (const node of nodes) {
                if (allowed !== 'all' && !allowed.has(node.name)) continue;

                // Deterministic Deduplication
                let name = node.name.trim();
                let i = 1;
                let originalName = name;
                while (allNodeNamesSet.has(name)) {
                    name = `${originalName} ${i++}`;
                }
                node.name = name;
                allNodeNamesSet.add(name);

                node.link = generateNodeLink(node);

                // 标记链式代理信息
                if (dialerProxyConfig.enabled && dialerProxyConfig.group) {
                    node._dialerProxy = dialerProxyConfig.group;
                }

                allNodes.push(node);
            }
        }

        if (format === 'clash') {
            if (!clashConfig) return c.text("Clash config not found.", 404);

            let yaml = (clashConfig.header || "") + "\n\nproxies:\n";
            const generatedNodeNames = new Set();

            // 分离普通节点和链式代理节点，链式代理节点排在末尾
            const normalNodes = allNodes.filter(n => !n._dialerProxy);
            const dialerNodes = allNodes.filter(n => n._dialerProxy);
            const sortedNodes = [...normalNodes, ...dialerNodes];

            // Generate Proxies
            for (const node of sortedNodes) {
                const proxyYaml = toClashProxy(node);
                if (proxyYaml) {
                    // 添加 dialer-proxy 字段
                    if (node._dialerProxy) {
                        yaml += proxyYaml + `\n    dialer-proxy: ${node._dialerProxy}\n`;
                    } else {
                        yaml += proxyYaml + "\n";
                    }
                    generatedNodeNames.add(node.name);
                }
            }

            // Generate Groups (支持资源名称展开为节点名)
            yaml += "\nproxy-groups:\n";

            // 建立资源名到节点名的映射
            const resourceToNodes = {};
            for (const item of targetConfig) {
                const sub = await c.env.DB.prepare("SELECT name FROM subscriptions WHERE id = ?").bind(item.subId).first();
                if (sub && sub.name) {
                    resourceToNodes[sub.name] = [];
                }
            }
            // 填充映射（使用已生成的节点名）
            for (const item of targetConfig) {
                const sub = await c.env.DB.prepare("SELECT * FROM subscriptions WHERE id = ?").bind(item.subId).first();
                if (!sub) continue;
                const resName = sub.name;
                const nodes = parseNodesCommon(sub.url || "");
                let allowed = 'all';
                if (item.include && Array.isArray(item.include) && item.include.length > 0) allowed = new Set(item.include);
                for (const node of nodes) {
                    if (allowed !== 'all' && !allowed.has(node.name)) continue;
                    // 使用去重后的节点名
                    if (generatedNodeNames.has(node.name) && resourceToNodes[resName]) {
                        resourceToNodes[resName].push(node.name);
                    } else {
                        // 查找可能重名的节点
                        for (const gName of generatedNodeNames) {
                            if (gName === node.name || gName.startsWith(node.name + ' ')) {
                                if (resourceToNodes[resName] && !resourceToNodes[resName].includes(gName)) {
                                    resourceToNodes[resName].push(gName);
                                }
                            }
                        }
                    }
                }
            }

            if (clashConfig.groups && Array.isArray(clashConfig.groups)) {
                for (const g of clashConfig.groups) {
                    yaml += `  - name: ${g.name}\n    type: ${g.type}\n    proxies:\n`;
                    if (g.proxies && Array.isArray(g.proxies)) {
                        g.proxies.forEach(p => {
                            // 检查是否是资源名称，如果是则展开
                            if (resourceToNodes[p] && resourceToNodes[p].length > 0) {
                                resourceToNodes[p].forEach(nodeName => {
                                    yaml += `      - ${nodeName}\n`;
                                });
                            } else if (generatedNodeNames.has(p) || ['DIRECT', 'REJECT', 'NO-RESOLVE'].includes(p)) {
                                yaml += `      - ${p}\n`;
                            }
                        });
                    }
                }
            }
            yaml += "\n" + (clashConfig.rules || "");
            return c.text(yaml, 200, { 'Content-Type': 'text/yaml; charset=utf-8' });
        }

        const links = allNodes.map(n => n.link).join('\n');
        return c.text(safeBase64Encode(links), 200, { 'Content-Type': 'text/plain; charset=utf-8' });
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
    await c.env.DB.prepare(query).bind(...args).run(); return c.json({ success: true })
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
    await c.env.DB.prepare("INSERT INTO groups (name, token, config, clash_config, status, sort_order) VALUES (?, ?, ?, ?, 1, 0)")
        .bind(b.name, token, JSON.stringify(b.config || []), JSON.stringify(clashConfig)).run();
    return c.json({ success: true })
})
app.put('/groups/:id', async (c) => {
    const b = await c.req.json(); const id = c.req.param('id');
    let parts = ["updated_at=CURRENT_TIMESTAMP"]; let args = [];
    if (b.name !== undefined) { parts.push("name=?"); args.push(b.name) }
    if (b.config !== undefined) { parts.push("config=?"); args.push(JSON.stringify(b.config)) }
    if (b.clash_config !== undefined) { parts.push("clash_config=?"); args.push(JSON.stringify(b.clash_config)) }
    if (b.status !== undefined) { parts.push("status=?"); args.push(parseInt(b.status)) }
    if (b.refresh_token) { parts.push("token=?"); args.push(generateToken()) }
    const query = `UPDATE groups SET ${parts.join(', ')} WHERE id=?`; args.push(id);
    await c.env.DB.prepare(query).bind(...args).run(); return c.json({ success: true })
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
app.get('/settings', async (c) => { return c.json({ success: true, data: {} }) }); app.post('/settings', async (c) => { return c.json({ success: true }) })
app.post('/backup/import', async (c) => {
    const { items, groups } = await c.req.json();
    if (items) { const s = c.env.DB.prepare("INSERT INTO subscriptions (name, url, type, info, params, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"); await c.env.DB.batch(items.map(i => s.bind(i.name, i.url, i.type || 'subscription', JSON.stringify(i.info), JSON.stringify({}), i.status ?? 1, i.sort_order ?? 0))); }
    if (groups) { const s = c.env.DB.prepare("INSERT INTO groups (name, token, config, status, sort_order) VALUES (?, ?, ?, ?, ?)"); await c.env.DB.batch(groups.map(g => s.bind(g.name, g.token, JSON.stringify(g.config), g.status ?? 1, g.sort_order ?? 0))); }
    return c.json({ success: true })
})

export const onRequest = handle(app)
