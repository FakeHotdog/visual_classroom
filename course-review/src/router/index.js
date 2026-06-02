// src/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'

// 导入页面
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Home from '../views/Home.vue'

// 路由配置
const routes = [
  { path: '/', redirect: '/login' }, // 默认跳转到登录页
  { path: '/login', component: Login },
  { path: '/register', component: Register },
  { 
    path: '/home', 
    component: Home,
    meta: { requiresAuth: true } // 只有授权用户可以访问
  }
]

// 创建路由实例
const router = createRouter({
  history: createWebHashHistory(), // 使用Hash模式
  routes
})

// 后端验证地址（与 App.vue 保持同步，当前运行在 5001 端口）
import { backendBase } from '../config';

// 导航守卫，检查用户是否已登录
router.beforeEach(async (to, from, next) => {
  // 检查目标页面是否需要登录
  const requiresAuth = to.meta.requiresAuth
  // 获取本地保存的 token
  const token = localStorage.getItem('token')

  if (requiresAuth) {
    if (!token) {
      // 1. 本地连 token 都没有，直接去登录
      next('/login')
    } else {
      // 2. 本地有 token，咱们向后端验证一下这个 token 是否真的有效、是否被篡改或过期
      try {
        const response = await fetch(`${backendBase}/user/info`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        const data = await response.json()

        if (response.ok && data.success) {
          // Token 是真的，完全有效！放行
        } else {
          // Token 过期或者瞎编的伪造 Token，清空它并打回登录页
          localStorage.removeItem('token')
          localStorage.removeItem('username')
          localStorage.removeItem('nickname')
          next('/login')
        }
      } catch (error) {
        console.error('验证 Token 失败:', error)
        next('/login')
      }
    }
  } else if (!requiresAuth && token && to.path === '/login') {
    // 已登录用户还在访问登录页，直接跳转到首页
    next('/home')
  } else {
    // 其他情况（不用登录的页面）正常跳转
  }
})

export default router
