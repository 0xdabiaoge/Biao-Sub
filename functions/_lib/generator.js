import { safeBase64Encode, safeBase64Decode } from './utils.js';

// --- 核心：生成链接 ---
export const generateNodeLink = (node) => {
    const safeName = encodeURIComponent(node.name || 'Node');
    if (node.origLink) {
        try {
            if (node.origLink.startsWith('vmess://')) {
                const base64Part = node.origLink.substring(8);
                const jsonStr = safeBase64Decode(base64Part);
                const vmessObj = JSON.parse(jsonStr);
                vmessObj.ps = node.name;
                return 'vmess://' + safeBase64Encode(JSON.stringify(vmessObj));
            }
            const hashIndex = node.origLink.lastIndexOf('#');
            if (hashIndex !== -1) return node.origLink.substring(0, hashIndex) + '#' + safeName;
            return node.origLink + '#' + safeName;
        } catch (e) { return node.origLink; }
    }
    try {
        if (node.type === 'vmess') {
            const vmessObj = {
                v: "2", ps: node.name, add: node.server, port: node.port, id: node.uuid,
                aid: node.alterId || 0, scy: node.cipher || "auto", net: node.network || "tcp", type: "none",
                tls: node.tls ? "tls" : ""
            };
            if (node.sni) vmessObj.sni = node.sni;
            if (node['ws-opts']) {
                vmessObj.net = "ws"; vmessObj.path = node['ws-opts'].path;
                if (node['ws-opts'].headers && node['ws-opts'].headers.Host) vmessObj.host = node['ws-opts'].headers.Host;
            }
            return 'vmess://' + safeBase64Encode(JSON.stringify(vmessObj));
        }
        if (node.type === 'vless' || node.type === 'trojan') {
            const params = new URLSearchParams();
            if (node.reality && node.reality.publicKey) {
                params.set('security', 'reality');
                params.set('pbk', node.reality.publicKey);
                if (node.reality.shortId) params.set('sid', node.reality.shortId);
            } else {
                params.set('security', node.tls ? 'tls' : 'none');
            }
            if (node.network) params.set('type', node.network);
            if (node.flow) params.set('flow', node.flow);
            if (node.sni || node.servername) params.set('sni', node.sni || node.servername);
            if (node['client-fingerprint']) params.set('fp', node['client-fingerprint']);
            if (node.network === 'ws' && node['ws-opts']) {
                if (node['ws-opts'].path) params.set('path', node['ws-opts'].path);
                if (node['ws-opts'].headers && node['ws-opts'].headers.Host) params.set('host', node['ws-opts'].headers.Host);
            }
            const userInfo = (node.type === 'vless') ? node.uuid : (node.password || node.uuid);
            return `${node.type}://${userInfo}@${node.server}:${node.port}?${params.toString()}#${safeName}`;
        }
        if (node.type === 'hysteria2') {
            const params = new URLSearchParams();
            if (node.sni) params.set('sni', node.sni);
            if (node['skip-cert-verify']) params.set('insecure', '1');
            if (node.obfs) { params.set('obfs', node.obfs); if (node['obfs-password']) params.set('obfs-password', node['obfs-password']); }
            if (node.ports) params.set('mport', node.ports);
            return `hysteria2://${node.password}@${node.server}:${node.port}?${params.toString()}#${safeName}`;
        }
        if (node.type === 'tuic') {
            const params = new URLSearchParams();
            if (node.sni) params.set('sni', node.sni);
            if (node.alpn) params.set('alpn', node.alpn);
            if (node['skip-cert-verify']) params.set('insecure', '1');
            if (node['congestion-controller']) params.set('congestion_control', node['congestion-controller']);
            return `tuic://${encodeURIComponent(node.uuid + ':' + node.password)}@${node.server}:${node.port}?${params.toString()}#${safeName}`;
        }
        if (node.type === 'anytls') {
            const params = new URLSearchParams();
            if (node.sni) params.set('sni', node.sni);
            if (node['skip-cert-verify']) params.set('insecure', '1');
            return `anytls://${node.password}@${node.server}:${node.port}?${params.toString()}#${safeName}`;
        }
        if (node.type === 'ss') {
            const userPart = safeBase64Encode(`${node.cipher}:${node.password}`);
            return `ss://${userPart}@${node.server}:${node.port}#${safeName}`;
        }
    } catch (e) { }
    return '';
}

// --- 辅助：YAML 安全字符串 ---
const yamlStr = (val) => {
    if (val === undefined || val === null || val === '') return '""';
    const str = String(val);
    // 如果包含特殊字符，使用引号包裹
    if (/[:\[\]{}&*?|<>=!%@`#,]/.test(str) || str.includes(' ') || str.includes("'") || str.includes('"')) {
        return `"${str.replace(/"/g, '\\"')}"`;
    }
    return str;
};

// --- 辅助：YAML 服务器地址（处理 IPv6）---
const yamlServer = (server) => {
    if (!server) return '""';
    // 去掉方括号（如果有）
    let clean = server.replace(/^\[/, '').replace(/\]$/, '');
    // 如果是 IPv6 地址（包含冒号且不是域名格式），用双引号包裹
    if (clean.includes(':')) {
        return `"${clean}"`;
    }
    return clean;
};

// --- 核心：Clash Meta 转换器 ---
export const toClashProxy = (node) => {
    try {
        if (!node.name || !node.server || !node.port) return null;
        const port = parseInt(node.port) || node.port;
        const skipCert = node['skip-cert-verify'] === true || node['skip-cert-verify'] === 'true';
        const server = yamlServer(node.server);

        // === Shadowsocks ===
        if (node.type === 'ss') {
            if (!node.cipher || !node.password) return null;
            return `  - name: ${yamlStr(node.name)}
    type: ss
    server: ${server}
    port: ${port}
    cipher: ${node.cipher}
    password: ${yamlStr(node.password)}`;
        }

        // === Trojan ===
        if (node.type === 'trojan') {
            if (!node.password) return null;
            let res = `  - name: ${yamlStr(node.name)}
    type: trojan
    server: ${server}
    port: ${port}
    password: ${yamlStr(node.password)}
    udp: true
    skip-cert-verify: ${skipCert}`;
            if (node.sni || node.servername) res += `\n    sni: ${node.sni || node.servername}`;
            if (node.network === 'ws') {
                res += `\n    network: ws\n    ws-opts:\n      path: ${node['ws-opts']?.path || '/'}`;
                if (node['ws-opts']?.headers?.Host) res += `\n      headers:\n        Host: ${node['ws-opts'].headers.Host}`;
            } else if (node.network === 'grpc' && node['grpc-opts']) {
                res += `\n    network: grpc\n    grpc-opts:\n      grpc-service-name: ${node['grpc-opts']['grpc-service-name'] || ''}`;
            }
            return res;
        }

        // === VMess ===
        if (node.type === 'vmess') {
            if (!node.uuid) return null;
            let res = `  - name: ${yamlStr(node.name)}
    type: vmess
    server: ${server}
    port: ${port}
    uuid: ${node.uuid}
    alterId: ${node.alterId || 0}
    cipher: ${node.cipher || 'auto'}
    udp: true
    tls: ${node.tls === true}
    skip-cert-verify: ${skipCert}`;
            if (node.sni || node.servername) res += `\n    servername: ${node.sni || node.servername}`;
            if (node.network === 'ws') {
                res += `\n    network: ws\n    ws-opts:\n      path: ${node['ws-opts']?.path || '/'}`;
                res += `\n      headers:\n        Host: ${node['ws-opts']?.headers?.Host || ''}`;
            } else if (node.network === 'grpc' && node['grpc-opts']) {
                res += `\n    network: grpc\n    grpc-opts:\n      grpc-service-name: ${node['grpc-opts']['grpc-service-name'] || ''}`;
            }
            return res;
        }

        // === VLESS ===
        if (node.type === 'vless') {
            if (!node.uuid) return null;
            let res = `  - name: ${yamlStr(node.name)}
    type: vless
    server: ${server}
    port: ${port}
    uuid: ${node.uuid}
    udp: true
    tls: ${node.tls === true}
    skip-cert-verify: ${skipCert}`;
            if (node.flow) res += `\n    flow: ${node.flow}`;
            if (node.sni || node.servername) res += `\n    servername: ${node.sni || node.servername}`;
            if (node['client-fingerprint']) res += `\n    client-fingerprint: ${node['client-fingerprint']}`;
            // Reality
            if (node.reality && node.reality.publicKey) {
                res += `\n    reality-opts:\n      public-key: ${node.reality.publicKey}`;
                if (node.reality.shortId) res += `\n      short-id: ${node.reality.shortId}`;
            }
            // Transport
            if (node.network === 'ws' && node['ws-opts']) {
                res += `\n    network: ws\n    ws-opts:\n      path: ${node['ws-opts']?.path || '/'}`;
                if (node['ws-opts']?.headers?.Host) res += `\n      headers:\n        Host: ${node['ws-opts'].headers.Host}`;
            } else if (node.network === 'grpc' && node['grpc-opts']) {
                res += `\n    network: grpc\n    grpc-opts:\n      grpc-service-name: ${node['grpc-opts']['grpc-service-name'] || ''}`;
            } else {
                res += `\n    network: ${node.network || 'tcp'}`;
            }
            return res;
        }

        // === Hysteria2 ===
        if (node.type === 'hysteria2') {
            if (!node.password) return null;
            let res = `  - name: ${yamlStr(node.name)}
    type: hysteria2
    server: ${server}
    port: ${port}
    password: ${yamlStr(node.password)}
    skip-cert-verify: ${skipCert}`;
            if (node.sni) res += `\n    sni: ${node.sni}`;
            res += `\n    alpn:\n      - h3`;
            // obfs
            if (node.obfs) {
                res += `\n    obfs: ${node.obfs}`;
                if (node['obfs-password']) res += `\n    obfs-password: ${yamlStr(node['obfs-password'])}`;
            }
            // mport (ports)
            if (node.ports) res += `\n    ports: ${node.ports}`;
            return res;
        }

        // === TUIC ===
        if (node.type === 'tuic') {
            if (!node.uuid) return null;
            let res = `  - name: ${yamlStr(node.name)}
    type: tuic
    server: ${server}
    port: ${port}
    uuid: ${node.uuid}
    password: ${yamlStr(node.password || '')}
    skip-cert-verify: ${skipCert}`;
            if (node.sni) res += `\n    sni: ${node.sni}`;
            res += `\n    alpn:\n      - h3`;
            res += `\n    udp-relay-mode: ${node['udp-relay-mode'] || 'native'}`;
            if (node['congestion-controller']) res += `\n    congestion-controller: ${node['congestion-controller']}`;
            return res;
        }

        // === AnyTLS ===
        if (node.type === 'anytls') {
            if (!node.password) return null;
            let res = `  - name: ${yamlStr(node.name)}
    type: anytls
    server: ${server}
    port: ${port}
    password: ${yamlStr(node.password)}
    client-fingerprint: ${node['client-fingerprint'] || 'chrome'}
    udp: true
    skip-cert-verify: ${skipCert}`;
            if (node.sni) res += `\n    sni: ${node.sni}`;
            res += `\n    alpn:\n      - h2\n      - http/1.1`;
            return res;
        }

        return null;
    } catch (e) {
        console.error('toClashProxy error:', e.message);
        return null;
    }
}
