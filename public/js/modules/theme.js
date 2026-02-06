/* BiaoSUB 主题切换逻辑 */
import { theme } from '../store.js'

export const initTheme = () => {
    const savedTheme = localStorage.getItem('theme') || 'dark'
    theme.value = savedTheme
    document.documentElement.setAttribute('data-theme', savedTheme)
}

export const toggleTheme = () => {
    const newTheme = theme.value === 'dark' ? 'light' : 'dark'
    theme.value = newTheme
    localStorage.setItem('theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
}
