// BiaoSUB 工具函数模块
import { toast } from './store.js'

// 显示提示消息
export const showToast = (msg, type = 'success') => {
    toast.message = msg
    toast.type = type
    toast.show = true
    setTimeout(() => toast.show = false, 3000)
}

// 复制文本
export const copyText = (txt) => {
    navigator.clipboard.writeText(txt).then(() => showToast('已复制'))
}

// 获取进度条样式类
export const getProgressClass = (p) => {
    return p > 90 ? 'progress-error' : (p > 75 ? 'progress-warning' : 'progress-primary')
}

// 判断是否过期
export const isExpired = (ts) => {
    return ts ? Date.now() > ts * 1000 : false
}

// 格式化文件大小
export const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB'
}

// 下载文件
export const downloadFile = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

// 安全的 Base64 编码（支持 Unicode）
export const safeBase64Encode = (str) => {
    try {
        return btoa(unescape(encodeURIComponent(str)))
    } catch (e) {
        return btoa(str)
    }
}

// 安全的 Base64 解码
export const safeBase64Decode = (str) => {
    try {
        // 处理 URL-safe base64
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
        // 补齐 padding
        while (base64.length % 4) base64 += '='
        return decodeURIComponent(escape(atob(base64)))
    } catch (e) {
        try {
            return atob(str)
        } catch (e2) {
            return str
        }
    }
}

// 更新节点链接中的名称（支持特殊字符和中文）
export const updateLinkName = (link, newName) => {
    if (!link || !newName) return link

    try {
        // VMess 协议: Base64 编码的 JSON
        if (link.startsWith('vmess://')) {
            const b64 = link.substring(8)
            const json = JSON.parse(safeBase64Decode(b64))
            json.ps = newName
            return 'vmess://' + safeBase64Encode(JSON.stringify(json))
        }

        // 其他协议: URL hash 部分存储名称
        // vless/trojan/ss/ssr/hysteria2/hy2/tuic 等
        const hashIdx = link.indexOf('#')
        if (hashIdx !== -1) {
            // 使用 encodeURIComponent 确保特殊字符正确编码
            return link.substring(0, hashIdx) + '#' + encodeURIComponent(newName)
        } else {
            // 没有 hash，添加一个
            return link + '#' + encodeURIComponent(newName)
        }
    } catch (e) {
        console.error('updateLinkName error:', e)
        return link
    }
}

// 从链接中提取节点名称
export const getNameFromLink = (link) => {
    if (!link) return ''

    try {
        // VMess 协议
        if (link.startsWith('vmess://')) {
            const b64 = link.substring(8)
            const json = JSON.parse(safeBase64Decode(b64))
            return json.ps || ''
        }

        // 其他协议: 从 hash 提取
        const hashIdx = link.indexOf('#')
        if (hashIdx !== -1) {
            return decodeURIComponent(link.substring(hashIdx + 1))
        }
    } catch (e) {
        console.error('getNameFromLink error:', e)
    }
    return ''
}
