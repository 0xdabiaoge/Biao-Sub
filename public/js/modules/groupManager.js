// BiaoSUB 聚合组管理模块
import { API, defaultHeader, defaultRules } from '../config.js'
import {
    resources,
    groups,
    groupModal,
    groupForm,
    groupNameError,
    templateModal,
    submitting,
    nodeSelector,
    clashNodeSelector
} from '../store.js'
import { authFetch, loadGroups, checkResource } from '../api.js'
import { showToast, copyText } from '../utils.js'

// 打开新建聚合组弹窗
export const openGroupModal = () => {
    templateModal.show = true
}

// 选择模板类型
export const selectTemplate = (type) => {
    templateModal.show = false
    groupNameError.value = false
    groupModal.isEdit = false
    groupModal.tab = 'base'

    const base = {
        name: '',
        config: [],
        clash_config: {
            mode: 'generate',
            resources: [],
            header: '',
            groups: [],
            rules: '',
            raw_yaml: ''
        }
    }

    if (type === 'default') {
        base.clash_config.header = defaultHeader
        base.clash_config.rules = defaultRules
        base.clash_config.groups = [{ name: 'Proxy', type: 'select', proxies: [] }]
    } else if (type === 'raw') {
        base.clash_config.mode = 'raw'
        base.clash_config.groups = []
        groupModal.tab = 'raw'
    } else {
        base.clash_config.groups = [{ name: 'Proxy', type: 'select', proxies: [] }]
    }

    groupForm.value = base
    groupModal.show = true
    templateModal.showMyTemplates = false
}

// 编辑聚合组
export const editGroup = (g) => {
    groupNameError.value = false
    groupModal.isEdit = true
    groupModal.tab = 'base'
    groupForm.value = JSON.parse(JSON.stringify(g))
    groupModal.show = true
}

// 保存聚合组
export const saveGroup = async () => {
    if (!groupForm.value.name) {
        groupNameError.value = true
        return
    }
    submitting.value = true
    if (groupForm.value.clash_config) {
        groupForm.value.clash_config.resources = []
    }

    const method = groupModal.isEdit ? 'PUT' : 'POST'
    const url = groupModal.isEdit
        ? `${API}/groups/${groupForm.value.id}`
        : `${API}/groups`

    await authFetch(url, { method, body: JSON.stringify(groupForm.value) })
    groupModal.show = false
    loadGroups()
    submitting.value = false
}

// 删除聚合组
export const deleteGroup = async (id) => {
    if (confirm('确定删除?')) {
        await authFetch(`${API}/groups/${id}`, { method: 'DELETE' })
        loadGroups()
    }
}

// 刷新 Token
export const refreshToken = async (g) => {
    if (confirm('重置链接?')) {
        await authFetch(`${API}/groups/${g.id}`, {
            method: 'PUT',
            body: JSON.stringify({ refresh_token: true })
        })
        loadGroups()
    }
}

// 复制聚合组链接
export const copyGroupLink = (g, type) => {
    const host = window.location.origin
    const url = `${host}/api/g/${g.token}?format=${type}`
    navigator.clipboard.writeText(url).then(() => showToast('链接已复制', 'success'))
}

// 获取资源数量
export const getGroupResourceCount = (g) => {
    return g.config ? g.config.length : 0
}

// 获取资源名称
export const getResourceName = (id) => {
    return resources.value.find(r => r.id === id)?.name || '未知资源'
}

// 资源选择相关
export const toggleResourceSelection = (resId, checked) => {
    if (checked) {
        const exists = groupForm.value.config.find(c => c.subId === resId)
        if (!exists) {
            groupForm.value.config.push({ subId: resId, include: [] })
        }
    } else {
        groupForm.value.config = groupForm.value.config.filter(c => c.subId !== resId)
    }
}

export const isResourceSelected = (resId) => {
    return !!groupForm.value.config.find(c => c.subId === resId)
}

export const selectAllGroupResources = () => {
    groupForm.value.config = resources.value.map(r => ({
        subId: r.id,
        include: [],
        dialerProxy: { enabled: false, group: '' }
    }))
}

export const deselectAllGroupResources = () => {
    groupForm.value.config = []
}

// 链式代理
export const getDialerProxy = (resId) => {
    const conf = groupForm.value.config.find(c => c.subId === resId)
    return conf?.dialerProxy || { enabled: false, group: '' }
}

export const setDialerProxy = (resId, enabled, group = '') => {
    const conf = groupForm.value.config.find(c => c.subId === resId)
    if (conf) {
        if (!conf.dialerProxy) conf.dialerProxy = {}
        conf.dialerProxy.enabled = enabled
        conf.dialerProxy.group = group
    }
}

// 节点选择器
export const openNodeSelector = async (res) => {
    nodeSelector.resourceId = res.id
    nodeSelector.resourceName = res.name
    nodeSelector.show = true
    nodeSelector.loading = true

    const currentConf = groupForm.value.config.find(c => c.subId === res.id)

    try {
        const d = await checkResource(res.url, res.type)
        if (d.success && d.data.nodes) {
            nodeSelector.nodes = d.data.nodes
            if (currentConf && Array.isArray(currentConf.include) && currentConf.include.length > 0) {
                nodeSelector.selected = 'select'
                nodeSelector.tempSelected = [...currentConf.include]
            } else {
                nodeSelector.selected = 'all'
                nodeSelector.tempSelected = d.data.nodes.map(n => n.name)
            }
        }
    } catch (e) {
        showToast('加载节点失败', 'error')
    }
    nodeSelector.loading = false
}

export const confirmNodeSelection = () => {
    const conf = groupForm.value.config.find(c => c.subId === nodeSelector.resourceId)
    if (conf) {
        if (nodeSelector.selected === 'all') {
            conf.include = []
        } else {
            conf.include = [...nodeSelector.tempSelected]
        }
    }
    nodeSelector.show = false
}

// Clash 节点选择器
export const addClashGroup = () => {
    groupForm.value.clash_config.groups.push({
        name: '',
        type: 'select',
        proxies: []
    })
}

export const openClashNodeSelector = async (group) => {
    clashNodeSelector.currentGroup = group
    clashNodeSelector.allNodeNames = []
    clashNodeSelector.tempSelected = [...(group.proxies || [])]
    clashNodeSelector.loading = true
    clashNodeSelector.show = true

    const selectedConfigs = groupForm.value.config
    const promises = selectedConfigs.map(async (conf) => {
        const res = resources.value.find(r => r.id === conf.subId)
        if (!res) return []
        try {
            const d = await checkResource(res.url, res.type)
            if (d.success && d.data.nodes) {
                let nodes = d.data.nodes
                if (conf.include && conf.include.length > 0) {
                    nodes = nodes.filter(n => conf.include.includes(n.name))
                }
                return nodes.map(n => n.name)
            }
        } catch (e) { }
        return []
    })

    const results = await Promise.all(promises)
    const allNames = results.flat()
    clashNodeSelector.allNodeNames = [...new Set(allNames)]
    clashNodeSelector.loading = false
}

export const clashSelectAll = () => {
    clashNodeSelector.tempSelected = [...clashNodeSelector.allNodeNames]
}

export const removeFromClashSelected = (name) => {
    clashNodeSelector.tempSelected = clashNodeSelector.tempSelected.filter(n => n !== name)
}

export const confirmClashNodeSelection = () => {
    if (clashNodeSelector.currentGroup) {
        clashNodeSelector.currentGroup.proxies = [...clashNodeSelector.tempSelected]
    }
    clashNodeSelector.show = false
}

// YAML 导入
export const handleYamlImport = (event) => {
    const file = event.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
        alert('文件过大')
        return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
        groupForm.value.clash_config.raw_yaml = e.target.result
        showToast('导入成功')
    }
    reader.readAsText(file)
    event.target.value = ''
}

export const handleRawYamlUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return
    const fileName = file.name
    const reader = new FileReader()
    reader.onload = (e) => {
        groupForm.value.clash_config.raw_yaml = e.target.result
        showToast(`已导入: ${fileName}`)
    }
    reader.readAsText(file)
    event.target.value = ''
}
