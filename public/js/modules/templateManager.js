// BiaoSUB 模板管理模块
import { API, defaultHeader, defaultRules } from '../config.js'
import {
    userTemplates,
    templateModal,
    groupModal,
    groupForm,
    groupNameError
} from '../store.js'
import { authFetch, loadTemplates } from '../api.js'
import { showToast } from '../utils.js'

// 选择用户模板
export const selectUserTemplate = (tpl) => {
    templateModal.show = false
    templateModal.showMyTemplates = false
    groupNameError.value = false
    groupModal.isEdit = false
    groupModal.tab = 'base'

    const base = {
        name: '',
        config: [],
        clash_config: {
            mode: 'generate',
            resources: [],
            header: tpl.header || '',
            groups: tpl.groups || [],
            rules: tpl.rules || '',
            raw_yaml: ''
        }
    }
    groupForm.value = base
    groupModal.show = true
    showToast(`已应用模板: ${tpl.name}`)
}

// 删除模板
export const deleteTemplate = async (id) => {
    if (confirm('确定删除模板?')) {
        await authFetch(`${API}/templates/${id}`, { method: 'DELETE' })
        loadTemplates()
    }
}

// 保存为模板
export const saveAsTemplate = async () => {
    const name = prompt('输入模板名称:')
    if (!name) return

    const tpl = {
        name,
        header: groupForm.value.clash_config.header,
        rules: groupForm.value.clash_config.rules,
        groups: groupForm.value.clash_config.groups
    }

    await authFetch(API + '/templates', {
        method: 'POST',
        body: JSON.stringify(tpl)
    })
    showToast('模板保存成功')
    loadTemplates()
}

export { loadTemplates }
