// BiaoSUB 资源池管理模块
import { API } from '../config.js'
import {
    resources,
    resourceModal,
    resourceForm,
    submitting,
    batchMode,
    selectedResources,
    previewModal
} from '../store.js'
import { authFetch, loadResources, checkResource } from '../api.js'
import { showToast, copyText, updateLinkName, getNameFromLink } from '../utils.js'

// 打开新建资源弹窗
export const openResourceModal = () => {
    resourceForm.value = { name: '', url: '', type: 'group' }
    resourceModal.isEdit = false
    resourceModal.show = true
}

// 编辑资源
export const editResource = (item) => {
    resourceForm.value = { ...item }
    resourceModal.isEdit = true
    resourceModal.show = true
}

// 保存资源
export const saveResource = async () => {
    if (resourceForm.value.type === 'group' && (!resourceForm.value.name || !resourceForm.value.name.trim())) {
        showToast('节点组必须填写名称', 'error')
        return
    }

    submitting.value = true
    const method = resourceModal.isEdit ? 'PUT' : 'POST'
    const url = resourceModal.isEdit
        ? `${API}/subs/${resourceForm.value.id}`
        : `${API}/subs`

    // 如果是单节点且修改了名称，同步到链接
    let finalUrl = resourceForm.value.url
    if (resourceForm.value.type === 'node' && resourceForm.value.name && resourceForm.value.name.trim()) {
        // 获取链接中的原始名称
        const originalName = getNameFromLink(resourceForm.value.url)
        // 如果名称有变化，更新链接
        if (originalName !== resourceForm.value.name.trim()) {
            finalUrl = updateLinkName(resourceForm.value.url, resourceForm.value.name.trim())
        }
    }

    let info = null
    if (finalUrl) {
        try {
            const d = await checkResource(finalUrl, resourceForm.value.type)
            if (d.success) info = d.data
        } catch (e) { }
    }

    const payload = { ...resourceForm.value, url: finalUrl, info }
    await authFetch(url, { method, body: JSON.stringify(payload) })
    resourceModal.show = false
    submitting.value = false
    loadResources()
}

// 删除资源
export const deleteResource = async (id) => {
    if (confirm('删除资源?')) {
        await authFetch(`${API}/subs/${id}`, { method: 'DELETE' })
        loadResources()
    }
}

// 刷新资源
export const refreshResource = async (item) => {
    item.refreshing = true
    try {
        const d = await checkResource(item.url, item.type)
        if (d.success) {
            await authFetch(`${API}/subs/${item.id}`, {
                method: 'PUT',
                body: JSON.stringify({ info: d.data })
            })
            showToast('刷新成功')
        } else {
            showToast('刷新失败', 'error')
        }
    } catch (e) {
        showToast('刷新失败: ' + e.message, 'error')
    }
    item.refreshing = false
    loadResources()
}

// 全选资源
export const selectAllResources = () => {
    selectedResources.value = resources.value.map(r => r.id)
}

// 批量删除
export const executeBatchDelete = async () => {
    if (!confirm(`确定删除选中的 ${selectedResources.value.length} 个资源吗?`)) return
    await authFetch(API + '/subs/delete', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedResources.value })
    })
    selectedResources.value = []
    batchMode.value = false
    loadResources()
    showToast('批量删除成功')
}

// 预览节点
export const previewNodes = async (item) => {
    previewModal.show = true
    previewModal.sortMode = false
    previewModal.editMode = false
    previewModal.resourceId = item.id
    previewModal.resourceItem = item
    previewModal.nodes = []
    previewModal.originalNodes = []

    try {
        const d = await checkResource(item.url, item.type)
        if (d.success && d.data.nodes) {
            let nodes = d.data.nodes
            // 如果资源有保存的节点排序，应用它
            if (item.info && item.info.nodeOrder && Array.isArray(item.info.nodeOrder)) {
                const orderMap = new Map(item.info.nodeOrder.map((link, idx) => [link, idx]))
                nodes = [...nodes].sort((a, b) => {
                    const aIdx = orderMap.has(a.link) ? orderMap.get(a.link) : 9999
                    const bIdx = orderMap.has(b.link) ? orderMap.get(b.link) : 9999
                    return aIdx - bIdx
                })
            }
            previewModal.nodes = nodes
            previewModal.originalNodes = [...nodes]
        } else {
            showToast('获取节点失败', 'error')
        }
    } catch (e) {
        showToast('获取节点失败: ' + e.message, 'error')
    }
}

