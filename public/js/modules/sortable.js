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
    clashSelectedList,
    clashNodeSelector
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

// Clash 节点排序初始化 - 增强数据与 DOM 同步
export const initClashSortable = () => {
    // 确保 DOM 元素存在
    const el = clashSelectedList.value
    if (!el) return

    if (clashSortable) {
        clashSortable.destroy()
        clashSortable = null
    }

    clashSortable = new Sortable(el, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onStart: () => {
            clashSortable._snapshot = [...clashNodeSelector.tempSelected]
        },
        onEnd: (evt) => {
            if (evt.oldIndex === evt.newIndex) return

            // 1. 获取最新快照
            const snapshot = clashSortable._snapshot || [...clashNodeSelector.tempSelected]

            // 2. 取消 Sortable 的 DOM 变动（关键：让 Vue 重新按照数据渲染 DOM）
            const parent = evt.from
            const itemEl = evt.item
            const children = Array.from(parent.children)
            // 将拖动的元素移回原位
            if (evt.oldIndex < children.length) {
                parent.insertBefore(itemEl, parent.children[evt.oldIndex])
            } else {
                parent.appendChild(itemEl)
            }

            // 3. 更新 Vue 响应式数据
            const arr = [...snapshot]
            const [moved] = arr.splice(evt.oldIndex, 1)
            arr.splice(evt.newIndex, 0, moved)

            // 触发 Vue 更新
            clashNodeSelector.tempSelected = arr

            // 4. 更新快照以备下次拖拽
            clashSortable._snapshot = [...arr]
        }
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

    // 预览模式变化时处理
    Vue.watch(() => previewModal.sortMode, (sortMode) => {
        if (sortMode) {
            Vue.nextTick(() => setTimeout(initPreviewSortable, 100))
        } else if (previewSortable) {
            previewSortable.destroy()
            previewSortable = null
        }
    })

    // 聚合组资源变化时
    Vue.watch(() => groupForm.value.config.length, () => {
        Vue.nextTick(initGroupResourceSortable)
    })

    // Clash 节点选择器：同时监听“显示状态”和“已选数量”
    // 因为已选列表有 v-if，数量从 0 变 1 时 DOM 才会出现
    Vue.watch(
        [() => clashNodeSelector.show, () => clashNodeSelector.tempSelected.length],
        ([show, len]) => {
            if (show && len > 0) {
                Vue.nextTick(() => setTimeout(initClashSortable, 200))
            } else if (!show && clashSortable) {
                clashSortable.destroy()
                clashSortable = null
            }
        }
    )
}
