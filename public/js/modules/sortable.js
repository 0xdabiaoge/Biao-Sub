// BiaoSUB 拖拽排序模块
import {
    resources,
    groups,
    previewModal,
    groupForm,
    resourceListEl,
    groupListEl,
    previewListEl,
    groupResourceListEl,
    clashSelectedList
} from '../store.js'
import { reorderResources, reorderGroups } from '../api.js'
import { showToast } from '../utils.js'

// Sortable 实例存储
let resourceSortable = null
let groupSortable = null
let previewSortable = null
let groupResourceSortable = null
let clashSortable = null

// 资源池排序初始化
export const initResourceSortable = () => {
    if (!resourceListEl.value) return
    if (resourceSortable) resourceSortable.destroy()

    resourceSortable = new Sortable(resourceListEl.value, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onStart: () => {
            resourceSortable._snapshot = [...resources.value]
        },
        onEnd: async (evt) => {
            const arr = resourceSortable._snapshot || [...resources.value]
            const [moved] = arr.splice(evt.oldIndex, 1)
            arr.splice(evt.newIndex, 0, moved)
            resourceSortable.destroy()
            resourceSortable = null
            resources.value = arr
            await reorderResources(arr.map(r => r.id))
            showToast('排序已保存')
            Vue.nextTick(initResourceSortable)
        }
    })
}

// 聚合组排序初始化
export const initGroupSortable = () => {
    if (!groupListEl.value) return
    if (groupSortable) groupSortable.destroy()

    groupSortable = new Sortable(groupListEl.value, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onStart: () => {
            groupSortable._snapshot = [...groups.value]
        },
        onEnd: async (evt) => {
            const arr = groupSortable._snapshot || [...groups.value]
            const [moved] = arr.splice(evt.oldIndex, 1)
            arr.splice(evt.newIndex, 0, moved)
            groupSortable.destroy()
            groupSortable = null
            groups.value = arr
            await reorderGroups(arr.map(g => g.id))
            showToast('排序已保存')
            Vue.nextTick(initGroupSortable)
        }
    })
}

// 节点预览排序初始化
export const initPreviewSortable = () => {
    if (previewSortable) {
        previewSortable.destroy()
        previewSortable = null
    }
    if (!previewListEl.value || !previewModal.show || !previewModal.sortMode) return

    setTimeout(() => {
        if (!previewListEl.value || !previewModal.show || !previewModal.sortMode) return
        previewSortable = new Sortable(previewListEl.value, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onStart: () => {
                previewSortable._snapshot = [...previewModal.nodes]
            },
            onEnd: (evt) => {
                const snapshot = previewSortable._snapshot
                if (!snapshot) return
                const arr = [...snapshot]
                const [moved] = arr.splice(evt.oldIndex, 1)
                arr.splice(evt.newIndex, 0, moved)
                if (previewSortable) {
                    previewSortable.destroy()
                    previewSortable = null
                }
                previewModal.nodes = arr
                setTimeout(initPreviewSortable, 100)
            }
        })
    }, 50)
}

// 聚合组资源排序初始化
export const initGroupResourceSortable = () => {
    if (!groupResourceListEl.value || groupForm.value.config.length === 0) return
    if (groupResourceSortable) groupResourceSortable.destroy()

    groupResourceSortable = new Sortable(groupResourceListEl.value, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onEnd: (evt) => {
            const arr = [...groupForm.value.config]
            const [moved] = arr.splice(evt.oldIndex, 1)
            arr.splice(evt.newIndex, 0, moved)
            groupForm.value.config = arr
        }
    })
}

// Clash 节点排序初始化
export const initClashSortable = () => {
    if (!clashSelectedList.value) return
    if (clashSortable) clashSortable.destroy()

    clashSortable = new Sortable(clashSelectedList.value, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag'
    })
}

// 设置排序监听
export const setupSortableWatchers = () => {
    // 资源数量变化时重新初始化
    Vue.watch(() => resources.value.length, () => {
        Vue.nextTick(() => setTimeout(initResourceSortable, 100))
    })

    // 聚合组数量变化时重新初始化
    Vue.watch(() => groups.value.length, () => {
        Vue.nextTick(() => setTimeout(initGroupSortable, 100))
    })

    // 排序模式变化时初始化预览排序
    Vue.watch(() => previewModal.sortMode, (sortMode) => {
        if (sortMode) {
            Vue.nextTick(() => setTimeout(initPreviewSortable, 100))
        } else {
            if (previewSortable) {
                previewSortable.destroy()
                previewSortable = null
            }
        }
    })

    // 聚合组资源数量变化时重新初始化
    Vue.watch(() => groupForm.value.config.length, () => {
        Vue.nextTick(initGroupResourceSortable)
    })
}
