// BiaoSUB 应用入口
import {
    resources, groups, isLoggedIn, loginPassword, loginLoading, currentTab, submitting,
    toast, batchMode, selectedResources, resourceModal, groupModal, templateModal,
    previewModal, settingsModal, resourceForm, groupForm, groupNameError, nodeSelector,
    clashNodeSelector, clashSelectedList, resourceListEl, previewListEl,
    groupResourceListEl, groupListEl, userTemplates, stats, theme
} from './store.js'

// 导入工具函数
import { showToast, copyText, getProgressClass, isExpired } from './utils.js'

// 导入API
import { loadResources, loadGroups, loadTemplates } from './api.js'

// 导入功能模块
import { handleLogin, logout, checkAuth } from './modules/auth.js'
import {
    openResourceModal, editResource, saveResource, deleteResource, refreshResource,
    selectAllResources, executeBatchDelete, previewNodes, handleUrlInput
} from './modules/resourcePool.js'
import {
    openGroupModal, selectTemplate, editGroup, saveGroup, deleteGroup,
    refreshToken, copyGroupLink, getGroupResourceCount, getResourceName,
    toggleResourceSelection, isResourceSelected, selectAllGroupResources, deselectAllGroupResources,
    getDialerProxy, setDialerProxy,
    openNodeSelector, confirmNodeSelection,
    addClashGroup, openClashNodeSelector, clashSelectAll, removeFromClashSelected, confirmClashNodeSelection,
    handleYamlImport, handleRawYamlUpload
} from './modules/groupManager.js'
import {
    enterSortMode, cancelSortMode, saveNodeOrder, closePreviewModal, copyAllPreviewNodes,
    enterEditMode, cancelEditMode, deleteNodeFromGroup, saveNodeEdits
} from './modules/nodePreview.js'
import {
    selectUserTemplate, deleteTemplate, saveAsTemplate
} from './modules/templateManager.js'
import {
    initResourceSortable, initGroupSortable, setupSortableWatchers
} from './modules/sortable.js'
import {
    openSettings, exportBackup, importBackup
} from './modules/settings.js'
import { initTheme, toggleTheme } from './modules/theme.js'

// 创建 Vue 应用
const { createApp, onMounted, nextTick } = Vue

createApp({
    setup() {
        // 初始化
        onMounted(() => {
            initTheme() // 使用独立模块初始化主题
            checkAuth()
            loadResources()
            loadGroups()
            loadTemplates()
            nextTick(() => {
                initResourceSortable()
                initGroupSortable()
            })
            setupSortableWatchers()
        })

        // 返回所有模板需要的变量和函数
        return {
            // 状态
            isLoggedIn, loginPassword, loginLoading,
            currentTab, resources, groups, submitting, toast,
            batchMode, selectedResources,
            resourceModal, resourceForm,
            groupModal, groupForm, groupNameError,
            templateModal, userTemplates,
            previewModal, settingsModal,
            nodeSelector, clashNodeSelector, stats, theme,
            clashSelectedList, resourceListEl, previewListEl, groupResourceListEl, groupListEl,

            // 工具函数
            showToast, copyText, getProgressClass, isExpired,
            toggleTheme, // 使用独立模块的主题切换

            // 认证
            handleLogin, logout,

            // 资源池
            openResourceModal, editResource, saveResource, deleteResource, refreshResource,
            selectAllResources, executeBatchDelete, previewNodes, handleUrlInput,

            // 聚合组
            openGroupModal, selectTemplate, editGroup, saveGroup, deleteGroup,
            refreshToken, copyGroupLink, getGroupResourceCount, getResourceName,
            toggleResourceSelection, isResourceSelected, selectAllGroupResources, deselectAllGroupResources,
            getDialerProxy, setDialerProxy,
            openNodeSelector, confirmNodeSelection,
            addClashGroup, openClashNodeSelector, clashSelectAll, removeFromClashSelected, confirmClashNodeSelection,
            handleYamlImport, handleRawYamlUpload,

            // 节点预览
            enterSortMode, cancelSortMode, saveNodeOrder, closePreviewModal, copyAllPreviewNodes,
            enterEditMode, cancelEditMode, deleteNodeFromGroup, saveNodeEdits,

            // 模板
            selectUserTemplate, deleteTemplate, saveAsTemplate, loadTemplates,

            // 设置
            openSettings, exportBackup, importBackup
        }
    }
}).mount('#app')
