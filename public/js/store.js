// BiaoSUB 状态管理
const { ref, reactive } = Vue

// ============ 核心数据 ============
export const resources = ref([])
export const groups = ref([])
export const userTemplates = ref([])

// ============ 认证状态 ============
export const isLoggedIn = ref(false)
export const loginPassword = ref('')
export const loginLoading = ref(false)

// ============ UI 状态 ============
export const currentTab = ref('resources')
export const submitting = ref(false)
export const toast = reactive({ show: false, message: '', type: 'success' })

// ============ 批量操作 ============
export const batchMode = ref(false)
export const selectedResources = ref([])

// ============ 模态框状态 ============
export const resourceModal = reactive({ show: false, isEdit: false })
export const groupModal = reactive({ show: false, isEdit: false, tab: 'base' })
export const templateModal = reactive({ show: false, showMyTemplates: false })
export const previewModal = reactive({
    show: false,
    nodes: [],
    sortMode: false,
    editMode: false,
    resourceId: null,
    resourceItem: null,
    originalNodes: []
})
export const settingsModal = reactive({ show: false, newPassword: '', confirmPassword: '' })

// ============ 表单数据 ============
export const resourceForm = ref({ name: '', url: '', type: 'node' })
export const groupForm = ref({
    id: null,
    name: '',
    config: [],
    clash_config: {
        mode: 'generate',
        header: '',
        groups: [],
        rules: '',
        resources: [],
        raw_yaml: ''
    }
})
export const groupNameError = ref(false)

// ============ 节点选择器 ============
export const nodeSelector = reactive({
    show: false,
    loading: false,
    resourceId: null,
    resourceName: '',
    nodes: [],
    selected: 'all',
    tempSelected: []
})

export const clashNodeSelector = reactive({
    show: false,
    loading: false,
    currentGroup: null,
    allNodeNames: [],
    tempSelected: []
})

// ============ DOM 引用 ============
export const clashSelectedList = ref(null)
export const resourceListEl = ref(null)
export const previewListEl = ref(null)
export const groupResourceListEl = ref(null)
export const groupListEl = ref(null)
