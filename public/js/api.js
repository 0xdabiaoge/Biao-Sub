// BiaoSUB API 调用模块
import { API } from './config.js'
import { isLoggedIn, resources, groups, userTemplates } from './store.js'

// 获取认证 Token
const getToken = () => localStorage.getItem('biaosub_token')

// 带认证的 fetch 封装
export const authFetch = async (url, opts = {}) => {
    opts.headers = {
        'Authorization': getToken(),
        'Content-Type': 'application/json',
        ...opts.headers
    }
    const res = await fetch(url, opts)
    if (res.status === 401) {
        isLoggedIn.value = false
        return null
    }
    return res
}

// ============ 数据加载 ============
export const loadData = async () => {
    const [rRes, gRes] = await Promise.all([
        authFetch(`${API}/subs`),
        authFetch(`${API}/groups`)
    ])
    const rData = await rRes.json()
    const gData = await gRes.json()
    resources.value = rData.data
    groups.value = gData.data
}

export const loadResources = async () => {
    const res = await authFetch(API + '/subs')
    if (res) resources.value = (await res.json()).data
}

export const loadGroups = async () => {
    const res = await authFetch(API + '/groups')
    if (res) groups.value = (await res.json()).data
}

export const loadTemplates = async () => {
    try {
        const res = await authFetch(API + '/templates')
        const d = await res.json()
        if (d.success) userTemplates.value = d.data || []
    } catch (e) {
        console.error('加载模板失败', e)
    }
}

// ============ 资源操作 ============
export const checkResource = async (url, type) => {
    const res = await authFetch(API + '/check', {
        method: 'POST',
        body: JSON.stringify({ url, type })
    })
    return await res.json()
}

export const createResource = async (data) => {
    return await authFetch(`${API}/subs`, {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export const updateResource = async (id, data) => {
    return await authFetch(`${API}/subs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export const deleteResourceApi = async (id) => {
    return await authFetch(`${API}/subs/${id}`, { method: 'DELETE' })
}

export const batchDeleteResources = async (ids) => {
    return await authFetch(API + '/subs/delete', {
        method: 'POST',
        body: JSON.stringify({ ids })
    })
}

export const reorderResources = async (order) => {
    return await authFetch(API + '/subs/reorder', {
        method: 'POST',
        body: JSON.stringify({ order })
    })
}

// ============ 聚合组操作 ============
export const createGroup = async (data) => {
    return await authFetch(`${API}/groups`, {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export const updateGroup = async (id, data) => {
    return await authFetch(`${API}/groups/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export const deleteGroupApi = async (id) => {
    return await authFetch(`${API}/groups/${id}`, { method: 'DELETE' })
}

export const reorderGroups = async (order) => {
    return await authFetch(API + '/groups/reorder', {
        method: 'POST',
        body: JSON.stringify({ order })
    })
}

// ============ 模板操作 ============
export const saveTemplate = async (data) => {
    return await authFetch(API + '/templates', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export const deleteTemplateApi = async (id) => {
    return await authFetch(`${API}/templates/${id}`, { method: 'DELETE' })
}

// ============ 备份操作 ============
export const getBackup = async () => {
    const res = await authFetch(API + '/backup')
    return await res.json()
}

export const restoreBackup = async (data) => {
    return await authFetch(API + '/restore', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}
