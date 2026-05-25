<!-- src/views/Login.vue -->
<template>
  <div class="login-box">
    <h2>同学录登录</h2>
    
    <div>
      <label>账号：</label>
      <input v-model="username" placeholder="请输入账号">
    </div>

    <div>
      <label>密码：</label>
      <input v-model="password" type="password" placeholder="请输入密码">
    </div>

    <div class="captcha-container">
      <label>验证码：</label>
      <input v-model="captchaCode" placeholder="请输入验证码" class="captcha-input" @keyup.enter="login">
      <img v-if="captchaImage" :src="captchaImage" @click="fetchCaptcha" class="captcha-img" title="点击刷新" alt="验证码">
    </div>

    <button @click="login">登录</button>

    <p :class="message.includes('成功') ? 'success' : 'error'">
      {{ message }}
    </p>

    <p>
      还没有账号？<router-link to="/register">去注册</router-link>
    </p>
  </div>
</template>

<script>
import { inject } from 'vue';

async function hashPassword(pwd) {
  const msgBuffer = new TextEncoder().encode(pwd);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  data() {
    return {
      username: '',
      password: '',
      captchaCode: '',
      captchaId: '',
      captchaImage: '',
      message: '',
      backendBase: ''
    }
  },
  mounted() {
    // 兼容 Options API 的全局注入拿取
    this.backendBase = import.meta.env.DEV ? 'http://127.0.0.1:5000' : '';
    this.fetchCaptcha()
  },
  methods: {
    async fetchCaptcha() {
      try {
        const res = await fetch(`${this.backendBase}/captcha`)
        const data = await res.json()
        if (res.ok && data.success) {
          this.captchaId = data.data.captchaId
          this.captchaImage = data.data.captchaImage
        } else {
          this.message = data.message || '获取验证码失败'
        }
      } catch (error) {
        console.error('获取验证码失败', error)
        this.message = '网络错误，无法获取验证码'
      }
    },
    async login() {
      if (!this.username || !this.password) {
        this.message = '请输入账号和密码'
        return
      }
      if (!this.captchaCode) {
        this.message = '请输入验证码'
        return
      }

      this.message = '正在登录...'

      try {
        const hashedPassword = await hashPassword(this.password)
        const response = await fetch(`${this.backendBase}/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: this.username,
            password: hashedPassword,
            captchaId: this.captchaId,
            captchaCode: this.captchaCode
          })
        })

        const data = await response.json()

        if (data.success) {
          this.message = ''
          // 保存用户信息
          localStorage.setItem('token', data.data.token)
          localStorage.setItem('username', data.data.username)
          localStorage.setItem('nickname', data.data.nickname)
          // 登录成功跳转到首页
          this.$router.push('/home')
        } else {
          this.message = data.message
          // 登录失败刷新验证码
          this.fetchCaptcha()
          this.captchaCode = ''
        }
      } catch (error) {
        this.message = '连接失败，请检查后端是否运行'
        console.error(error)
      }
    }
  }
}
</script>

<style scoped>
.login-box {
  width: 360px;
  margin: 100px auto;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

div {
  margin-bottom: 15px;
}

label {
  display: inline-block;
  width: 70px;
}

input {
  width: 200px;
  padding: 5px;
}

button {
  width: 100%;
  padding: 8px;
  background-color: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #337ecc;
}

p {
  text-align: center;
  margin-top: 15px;
  font-size: 14px;
}

.error {
  color: #f56c6c;
}

.success {
  color: #67c23a;
}

.captcha-container {
  display: flex;
  align-items: center;
}

.captcha-input {
  width: 100px;
  margin-right: 10px;
}

.captcha-img {
  width: 120px;
  height: 40px;
  cursor: pointer;
  border: 1px solid #ccc;
  border-radius: 4px;
}

a {
  color: #409eff;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
</style>