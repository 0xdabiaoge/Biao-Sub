// BiaoSUB 节点预览模块
import { API } from '../config.js'
import { previewModal, resources } from '../store.js'
import { authFetch, loadResources } from '../api.js'
import { showToast, copyText } from '../utils.js'

// 进入排序模式
export const enterSortMode = () => {
    previewModal.editMode = false
    previewModal.sortMode = true
    previewModal.originalNodes = [...previewModal.nodes]
}

// 取消排序模式
export const cancelSortMode = () => {
    previewModal.sortMode = false
    previewModal.nodes = [...previewModal.originalNodes]
}

// 保存节点排序
export const saveNodeOrder = async () => {
    if (!previewModal.resourceId) return
    try {
        const nodeOrder = previewModal.nodes.map(n => n.link)
        const res = resources.value.find(r => r.id === previewModal.resourceId)
        if (res) {
            const newInfo = { ...(res.info || {}), nodeOrder }
            await authFetch(`${API}/subs/${previewModal.resourceId}`, {
                method: 'PUT',
                body: JSON.stringify({ info: newInfo })
            })
            res.info = newInfo
            showToast('节点排序已保存')
        }
        previewModal.sortMode = false
    } catch (e) {
        showToast('保存失败: ' + e.message, 'error')
    }
}

// 进入编辑模式（用于删除节点）
export const enterEditMode = () => {
    previewModal.sortMode = false
    previewModal.editMode = true
    previewModal.originalNodes = [...previewModal.nodes]
}

// 取消编辑模式
export const cancelEditMode = () => {
    previewModal.editMode = false
    previewModal.nodes = [...previewModal.originalNodes]
}

// 删除单个节点（从节点组中移除）
export const deleteNodeFromGroup = (idx) => {
    if (previewModal.nodes.length <= 1) {
        showToast('至少保留一个节点', 'error')
        return
    }
    previewModal.nodes.splice(idx, 1)
}

// 保存节点编辑（删除后的结果）
export const saveNodeEdits = async () => {
    if (!previewModal.resourceId || !previewModal.resourceItem) return

    try {
        const res = previewModal.resourceItem

        // 重新生成 url（多行节点链接）
        const newUrl = previewModal.nodes.map(n => n.link).join('\n')

        // 更新 info 中的节点信息
        const newInfo = {
            ...(res.info || {}),
            nodeCount: previewModal.nodes.length,
            nodeOrder: previewModal.nodes.map(n => n.link)
        }

        // 调用 API 更新资源
        await authFetch(`${API}/subs/${previewModal.resourceId}`, {
            method: 'PUT',
            body: JSON.stringify({
                url: newUrl,
                info: newInfo
            })
        })

        // 更新本地数据
        res.url = newUrl
        res.info = newInfo

        showToast('节点已更新')
        previewModal.editMode = false
        previewModal.originalNodes = [...previewModal.nodes]

        // 刷新资源列表
        loadResources()
    } catch (e) {
        showToast('保存失败: ' + e.message, 'error')
    }
}

// 关闭预览弹窗
export const closePreviewModal = () => {
    if (previewModal.sortMode) {
        if (!confirm('排序尚未保存，确定关闭？')) return
    }
    if (previewModal.editMode) {
        if (!confirm('编辑尚未保存，确定关闭？')) return
    }
    previewModal.show = false
    previewModal.sortMode = false
    previewModal.editMode = false
}

// 复制全部节点链接
export const copyAllPreviewNodes = () => {
    const links = previewModal.nodes.map(n => n.link).join('\n')
    navigator.clipboard.writeText(links).then(() => showToast('已复制全部链接'))
}
