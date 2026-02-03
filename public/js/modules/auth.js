// BiaoSUB 认证模块
import { API } from '../config.js'
import { isLoggedIn, loginPassword, loginLoading } from '../store.js'
import { showToast } from '../utils.js'
import { loadData } from '../api.js'

// 登录
export const handleLogin = async () => {
    loginLoading.value = true
    try {
        const res = await fetch(API + '/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: loginPassword.value })
        })
        const data = await res.json()
        if (data.success) {
            localStorage.setItem('biaosub_token', loginPassword.value)
            isLoggedIn.value = true
            loadData()
        } else {
            showToast('密码错误', 'error')
        }
    } catch (e) {
        showToast('登录失败: ' + e.message, 'error')
    }
    loginLoading.value = false
}

// 登出
export const logout = () => {
    localStorage.removeItem('biaosub_token')
    isLoggedIn.value = false
}

// 检查登录状态
export const checkAuth = () => {
    if (localStorage.getItem('biaosub_token')) {
        isLoggedIn.value = true
        loadData()
    }
}
