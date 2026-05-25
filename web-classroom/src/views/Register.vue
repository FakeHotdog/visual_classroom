<!-- src/views/Register.vue -->
<template>
  <div class="register-box">
    <h2>同学录注册</h2>
    
    <div>
      <label>账号：</label>
      <input v-model="username" placeholder="请输入账号">
    </div>

    <div>
      <label>密码：</label>
      <input v-model="password" type="password" placeholder="请输入密码">
    </div>

    <div>
      <label>昵称：</label>
      <input v-model="nickname" placeholder="请输入昵称">
    </div>

    <div class="captcha-container">
      <label>验证码：</label>
      <input v-model="captchaCode" placeholder="请输入验证码" class="captcha-input">
      <img v-if="captchaImage" :src="captchaImage" @click="fetchCaptcha" class="captcha-img" title="点击刷新" alt="验证码">
    </div>

    <button @click="register" :disabled="loading">
      {{ loading ? '注册中...' : '注册' }}
    </button>

    <p :class="message.includes('成功') ? 'success' : 'error'">
      {{ message }}
    </p>

    <p>
      已有账号？<router-link to="/login">去登录</router-link>
    </p>
  </div>
</template>

<script>
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
      nickname: '',
      captchaCode: '',
      captchaId: '',
      captchaImage: '',
      message: '',
      loading: false // 添加加载状态，防止重复点击
    }
  },
  mounted() {
    this.fetchCaptcha()
  },
  methods: {
    async fetchCaptcha() {
      try {
        const res = await fetch('http://localhost:5000/captcha')
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
    async register() {
      if (!this.username || !this.password || !this.nickname || !this.captchaCode) {
        this.message = '请填写所有信息和验证码'
        return
      }
      if (this.password.length < 6 || this.password.length > 20) {
        this.message = '密码长度必须在6-20个字符之间'
        return
      }

      this.loading = true
      this.message = '正在注册...'

      try {
        const hashedPassword = await hashPassword(this.password)
        const response = await fetch('http://localhost:5000/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: this.username,
            password: hashedPassword,
            nickname: this.nickname,
            captchaId: this.captchaId,
            captchaCode: this.captchaCode
          })
        })

        const data = await response.json()

        if (data.success) {
          this.message = '注册成功！正在跳转到登录页...'
          setTimeout(() => {
            this.$router.push('/login')
          }, 1500)
        } else {
          this.message = data.message
          // 注册失败刷新验证码
          this.fetchCaptcha()
          this.captchaCode = ''
        }
      } catch (error) {
        this.message = '连接失败，请检查后端是否运行'
        console.error(error)
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.register-box {
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
  background-color: #67c23a;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #529b2e;
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