// BiaoSUB 设置模块
import { settingsModal, resources, groups } from '../store.js'
import { getBackup, restoreBackup, loadResources, loadGroups, loadTemplates } from '../api.js'
import { showToast, downloadFile } from '../utils.js'

// 打开设置
export const openSettings = () => {
    settingsModal.newPassword = ''
    settingsModal.confirmPassword = ''
    settingsModal.show = true
}

// 导出备份
export const exportBackup = async () => {
    try {
        const data = await getBackup()
        if (data.success) {
            const json = JSON.stringify(data.data, null, 2)
            const date = new Date().toISOString().slice(0, 10)
            downloadFile(json, `biaosub-backup-${date}.json`)
            showToast('备份导出成功')
        } else {
            showToast('导出失败', 'error')
        }
    } catch (e) {
        showToast('导出失败: ' + e.message, 'error')
    }
}

// 导入备份
export const importBackup = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    try {
        const text = await file.text()
        const data = JSON.parse(text)

        const res = await restoreBackup(data)
        const d = await res.json()

        if (d.success) {
            loadResources()
            loadGroups()
            loadTemplates()
            showToast('备份导入成功')
        } else {
            showToast('导入失败: ' + d.error, 'error')
        }
    } catch (e) {
        showToast('导入失败: ' + e.message, 'error')
    }
    event.target.value = ''
}
