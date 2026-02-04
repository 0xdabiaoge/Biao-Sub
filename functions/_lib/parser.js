import { deepBase64Decode, safeBase64Decode } from './utils.js';
import { generateNodeLink } from './generator.js';

// --- 核心：万能解析器 ---
export const parseNodesCommon = (text) => {
    const nodes = [];
    const rawSet = new Set();
    const addNode = (n) => {
        if (!n.name) n.name = 'Node';
        // 确保关键字段存在，否则 Clash 转换器会丢弃
        if (!n.link) n.link = generateNodeLink(n);
        if (n.link && n.link.length > 15 && !rawSet.has(n.link)) {
            rawSet.add(n.link); nodes.push(n);
        }
    }
    let decoded = deepBase64Decode(text);
    if (!decoded || decoded.length < 5 || /[\x00-\x08]/.test(decoded)) decoded = text;

    // 1. 处理以换行分隔的 URI Scheme (支持 hy2/hy 短协议名)
    const linkRegex = /(vmess|vless|ss|ssr|trojan|hysteria2|hysteria|hy2|hy|tuic|juicity|naive|anytls):\/\/[^\s\n"']+/gi;
    const matches = decoded.match(linkRegex);
    if (matches) {
        for (const match of matches) {
            const trimLine = match.trim();
            try {
                let node = { origLink: trimLine, type: 'raw' };

                // === VMess 特殊处理 (Base64 JSON) ===
                if (trimLine.startsWith('vmess://')) {
                    const b64 = trimLine.substring(8);
                    const c = JSON.parse(safeBase64Decode(b64));
                    node.name = c.ps; node.type = 'vmess';
                    node.server = c.add; node.port = parseInt(c.port) || c.port; node.uuid = c.id;
                    node.cipher = c.scy || "auto"; node.alterId = parseInt(c.aid) || 0;
                    node.tls = c.tls === "tls" || c.tls === true;
                    node.network = c.net || 'tcp';
                    node.sni = c.sni || '';
                    node['skip-cert-verify'] = c.insecure === '1' || c.insecure === 1 || c.insecure === true;
                    if (c.net === 'ws' || node.network === 'ws') {
                        node['ws-opts'] = {
                            path: c.path || '/',
                            headers: { Host: c.host || c.sni || '' }
                        };
                    }
                    if (c.net === 'grpc') {
                        node['grpc-opts'] = { 'grpc-service-name': c.path || '' };
                    }
                    addNode(node);
                    continue;
                }

                // === 其他协议使用 URL 解析 ===
                const url = new URL(trimLine);
                node.name = decodeURIComponent(url.hash.substring(1) || 'Node');
                node.type = url.protocol.replace(':', '');
                // 规范化协议名：hy2/hy -> hysteria2
                if (node.type === 'hy2' || node.type === 'hy') node.type = 'hysteria2';
                node.server = url.hostname;
                node.port = parseInt(url.port) || 443;
                const params = url.searchParams;

                // 通用参数解析
                if (params.has('sni')) node.sni = params.get('sni');
                if (params.has('peer')) node.sni = params.get('peer');
                if (params.has('security')) {
                    const sec = params.get('security');
                    node.tls = sec === 'tls' || sec === 'reality';
                    if (sec === 'reality') node.realityEnabled = true;
                }
                if (params.has('type')) node.network = params.get('type');
                if (params.has('flow')) node.flow = params.get('flow');
                if (params.has('fp')) node['client-fingerprint'] = params.get('fp');
                if (params.has('alpn')) node.alpn = params.get('alpn');
                if (params.has('insecure') || params.has('allowInsecure')) {
                    node['skip-cert-verify'] = params.get('insecure') === '1' || params.get('allowInsecure') === '1';
                }

                // Reality 参数
                if (params.has('pbk')) {
                    node.reality = { publicKey: params.get('pbk') };
                    if (params.has('sid')) node.reality.shortId = params.get('sid');
                    node.tls = true;
                }

                // WS 参数
                if (params.has('path')) {
                    if (!node['ws-opts']) node['ws-opts'] = { headers: {} };
                    node['ws-opts'].path = params.get('path');
                }
                if (params.has('host')) {
                    if (!node['ws-opts']) node['ws-opts'] = { headers: {} };
                    if (!node['ws-opts'].headers) node['ws-opts'].headers = {};
                    node['ws-opts'].headers.Host = params.get('host');
                }

                // === VLESS ===
                if (node.type === 'vless') {
                    node.uuid = url.username;
                    if (!node.network) node.network = 'tcp';
                    // gRPC 支持
                    if (node.network === 'grpc' || params.has('serviceName')) {
                        node.network = 'grpc';
                        node['grpc-opts'] = {
                            'grpc-service-name': params.get('serviceName') || params.get('path') || '',
                            'mode': params.get('mode') || 'gun'
                        };
                    }
                }

                // === Trojan ===
                else if (node.type === 'trojan') {
                    node.password = decodeURIComponent(url.username);
                    if (!node.tls) node.tls = true; // Trojan 默认 TLS
                    // gRPC 支持 (Trojan 也可以跑在 gRPC 上)
                    if (node.network === 'grpc' || params.has('serviceName')) {
                        node.network = 'grpc';
                        node['grpc-opts'] = {
                            'grpc-service-name': params.get('serviceName') || params.get('path') || '',
                            'mode': params.get('mode') || 'gun'
                        };
                    }
                }

                // === Shadowsocks ===
                else if (node.type === 'ss') {
                    // ss://base64(cipher:password)@server:port#name
                    // 或 ss://cipher:password@server:port#name (非标准)
                    const userPart = url.username;
                    if (userPart.includes(':')) {
                        // 非编码格式
                        const parts = userPart.split(':');
                        node.cipher = parts[0];
                        node.password = parts.slice(1).join(':');
                    } else {
                        // Base64 编码格式
                        try {
                            const decoded = safeBase64Decode(userPart);
                            if (decoded.includes(':')) {
                                const parts = decoded.split(':');
                                node.cipher = parts[0];
                                node.password = parts.slice(1).join(':');
                            } else {
                                node.password = decoded;
                            }
                        } catch (e) {
                            node.password = userPart;
                        }
                    }
                }

                // === Hysteria2 ===
                else if (node.type === 'hysteria2' || node.type === 'hysteria') {
                    node.type = 'hysteria2'; // 统一为 hysteria2
                    node.password = decodeURIComponent(url.username);
                    if (params.has('obfs')) node.obfs = params.get('obfs');
                    if (params.has('obfs-password')) node['obfs-password'] = params.get('obfs-password');
                    if (params.has('mport')) node.ports = params.get('mport');
                }

                // === TUIC ===
                else if (node.type === 'tuic') {
                    // tuic://uuid:password@server:port 或 tuic://uuid%3Apassword@server:port
                    const userPart = decodeURIComponent(url.username);
                    if (userPart.includes(':')) {
                        const parts = userPart.split(':');
                        node.uuid = parts[0];
                        node.password = parts.slice(1).join(':');
                    } else {
                        node.uuid = userPart;
                        node.password = url.password || '';
                    }
                    if (params.has('congestion_control')) {
                        node['congestion-controller'] = params.get('congestion_control');
                    }
                    if (params.has('udp_relay_mode')) {
                        node['udp-relay-mode'] = params.get('udp_relay_mode');
                    } else {
                        node['udp-relay-mode'] = 'native';
                    }
                }

                // === AnyTLS ===
                else if (node.type === 'anytls') {
                    node.password = decodeURIComponent(url.username);
                    node.udp = true;
                    if (!node['client-fingerprint']) node['client-fingerprint'] = 'chrome';
                }

                addNode(node);
            } catch (e) {
                console.error('Parse error:', e.message, trimLine);
            }
        }
    }

    // 2. 处理 Clash YAML 格式 (仅在 URI 解析失败时)
    if (nodes.length < 1 && (decoded.includes('proxies:') || decoded.includes('name:'))) {
        try {
            const lines = decoded.split(/\r?\n/);
            let inProxyBlock = false; let currentBlock = [];
            const processYamlBlock = (block) => {
                const getVal = (k) => {
                    const reg = new RegExp(`${k}:\\s*(?:['"](.+?)['"]|([^\\s#,}]+))`, 'i');
                    const line = block.find(l => reg.test(l));
                    if (!line) return undefined;
                    const m = line.match(reg);
                    return (m[1] || m[2] || '').trim();
                };
                let type = getVal('type');
                if (!type || ['url-test', 'selector', 'fallback', 'direct', 'reject', 'load-balance'].includes(type)) return;
                const node = {
                    name: getVal('name'), type, server: getVal('server'), port: getVal('port'),
                    uuid: getVal('uuid'), cipher: getVal('cipher'), password: getVal('password'),
                    udp: getVal('udp') === 'true', tls: getVal('tls') === 'true',
                    "skip-cert-verify": getVal('skip-cert-verify') === 'true',
                    servername: getVal('servername') || getVal('sni'), sni: getVal('sni'),
                    network: getVal('network'), flow: getVal('flow'),
                    "client-fingerprint": getVal('client-fingerprint')
                };
                const findInBlock = (key) => {
                    const line = block.find(l => l.includes(key)); if (!line) return undefined;
                    const m = line.match(new RegExp(`${key}:\\s*(?:['"](.+?)['"]|([^\\s{]+))`));
                    return m ? (m[1] || m[2]).trim() : undefined;
                }
                if (node.network === 'ws' || block.some(l => l.includes('ws-opts'))) {
                    node.network = 'ws';
                    node['ws-opts'] = { path: findInBlock('path') || '/', headers: { Host: findInBlock('Host') || '' } };
                }
                if (block.some(l => l.includes('public-key'))) {
                    node.tls = true;
                    node.reality = { publicKey: findInBlock('public-key'), shortId: findInBlock('short-id') };
                }
                if (node.server && node.port) addNode(node);
            }
            for (const line of lines) {
                if (!line.trim() || line.trim().startsWith('#')) continue;
                if (line.includes('proxies:')) { inProxyBlock = true; continue; }
                if (inProxyBlock) {
                    if (line.trim().startsWith('-') && line.includes('name:')) {
                        if (currentBlock.length > 0) processYamlBlock(currentBlock);
                        currentBlock = [line];
                    } else if (currentBlock.length > 0) currentBlock.push(line);
                    if (!line.startsWith(' ') && !line.startsWith('-') && !line.includes('proxies:')) {
                        inProxyBlock = false;
                        if (currentBlock.length > 0) processYamlBlock(currentBlock);
                        currentBlock = [];
                    }
                }
            }
            if (currentBlock.length > 0) processYamlBlock(currentBlock);
        } catch (e) { }
    }
    return nodes;
}
