<template>
  <div class="login-container">
    <div class="login-card">
      <h2 class="title">清华大学选课评价系统</h2>
      <p class="subtitle">注册账号</p>

      <form class="login-form" @submit.prevent="handleRegister">
        <div class="form-item">
          <label>邮箱</label>
          <input v-model="registerForm.email" type="email" placeholder="请输入清华大学官方邮箱" @blur="checkEmailSuffix"
            required />
          <div v-if="emailError" class="error-text">{{ emailError }}</div>
        </div>

        <div class="form-item">
          <label>昵称</label>
          <input v-model="registerForm.nickname" placeholder="请输入您的昵称" maxlength="20" required />
        </div>

        <div class="form-item">
          <label>密码</label>
          <input v-model="registerForm.password" type="password" placeholder="请输入密码（至少6位）" required />
        </div>

        <div class="form-item">
          <label>确认密码</label>
          <input v-model="registerForm.confirmPassword" type="password" placeholder="请再次输入密码" required />
          <div v-if="passwordError" class="error-text">{{ passwordError }}</div>
        </div>

        <div class="form-item">
          <label>验证码</label>
          <div class="code-input-group">
            <input v-model="registerForm.code" placeholder="请输入6位验证码" maxlength="6" required />
            <button type="button" :disabled="isSendingCode || !registerForm.email || !emailValid" @click="sendCode"
              class="send-code-btn">
              {{ codeButtonText }}
            </button>
          </div>
        </div>

        <button type="submit" class="submit-btn" :disabled="isRegistering">
          {{ isRegistering ? '注册中...' : '注册' }}
        </button>
      </form>

      <div class="link">
        已有账号？<a @click="$router.push('/login')">立即登录</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { sha256 } from 'js-sha256'
import { showAlert } from '../App.vue'

// 全局配置
const router = useRouter()
const backendBase = import.meta.env.DEV ? 'http://127.0.0.1:5000' : ''

// 表单数据（用 reactive 管理对象）
const registerForm = reactive({
  email: '',
  nickname: '',
  password: '',
  confirmPassword: '',
  code: ''
})

// 状态变量（用 ref 管理基本类型）
const emailError = ref('')
const passwordError = ref('')
const isSendingCode = ref(false)
const codeButtonText = ref('发送验证码')
const isRegistering = ref(false)
const emailValid = ref(true)

// ===================== 工具方法 =====================
const checkPasswordMatch = () => {
  if (registerForm.confirmPassword && 
      registerForm.password !== registerForm.confirmPassword) {
    passwordError.value = '两次输入的密码不一致'
  }
}

const checkEmailSuffix = () => {
  const email = registerForm.email.trim()
  
  // 空邮箱不报错，只标记为无效
  if (!email) {
    emailValid.value = false
    return
  }
  
  const validSuffixes = ['mails.tsinghua.edu.cn', 'tsinghua.edu.cn', 'mail.tsinghua.edu.cn']
  const domain = email.split('@')[1]?.toLowerCase()

  if (!validSuffixes.includes(domain)) {
    emailError.value = '请使用清华大学官方邮箱'
    emailValid.value = false
  } else {
    emailError.value = ''
    emailValid.value = true
  }
}

// ===================== 实时监听验证 =====================
watch(
  () => registerForm.password,
  () => {
    passwordError.value = ''
    checkPasswordMatch()
  }
)

watch(
  () => registerForm.confirmPassword,
  () => {
    passwordError.value = ''
    checkPasswordMatch()
  }
)

watch(
  () => registerForm.email,
  () => {
    emailError.value = ''
    checkEmailSuffix()
  }
)

// ===================== 发送验证码 =====================
const sendCode = async () => {
  // 发送前再验证一次邮箱
  checkEmailSuffix()
  
  if (!emailValid.value) {
    showAlert('错误', '请输入正确的清华大学邮箱')
    return
  }
  
  isSendingCode.value = true
  codeButtonText.value = '发送中...'
  
  try {
    const res = await fetch(`${backendBase}/send_code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: registerForm.email })
    })
    
    const data = await res.json()
    
    if (res.ok && data.success) {
      showAlert('成功', '验证码已发送，请检查您的邮箱')
      
      let countdown = 60
      codeButtonText.value = `重新发送(${countdown}s)`
      
      const timer = setInterval(() => {
        countdown--
        if (countdown > 0) {
          codeButtonText.value = `重新发送(${countdown}s)`
        } else {
          clearInterval(timer)
          codeButtonText.value = '发送验证码'
          isSendingCode.value = false
        }
      }, 1000)
    } else {
      showAlert('错误', data.message || '验证码发送失败')
      isSendingCode.value = false
      codeButtonText.value = '发送验证码'
    }
  } catch (error) {
    console.error('验证码发送失败', error)
    showAlert('错误', '网络错误，无法发送验证码')
    isSendingCode.value = false
    codeButtonText.value = '发送验证码'
  }
}

// ===================== 提交注册 =====================
const handleRegister = async () => {
  // 注册开始前先清空所有错误信息
  emailError.value = ''
  passwordError.value = ''
  
  // 表单验证
  if (!registerForm.email) {
    emailError.value = '请输入邮箱'
    return
  }
  
  if (!emailValid.value) {
    emailError.value = '请使用清华大学官方邮箱'
    return
  }
  
  if (!registerForm.nickname) {
    showAlert('错误', '昵称不能为空')
    return
  }
  
  if (registerForm.password.length < 6) {
    showAlert('错误', '密码长度必须至少6位')
    return
  }
  
  if (registerForm.password !== registerForm.confirmPassword) {
    passwordError.value = '两次输入的密码不一致'
    return
  }
  
  if (!registerForm.code) {
    showAlert('错误', '请输入验证码')
    return
  }
  
  isRegistering.value = true
  
  try {
    // 前端先做SHA256加密，确保网络传输中没有明文密码
    const hashedPassword = sha256(registerForm.password)

    const response = await fetch(`${backendBase}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: registerForm.email,
        username: registerForm.nickname,
        password: hashedPassword,
        code: registerForm.code
      })
    })

    const data = await response.json()

    if (data.success) {
      showAlert('成功', '注册成功！请登录')
      // 清空表单
      registerForm.email = ''
      registerForm.nickname = ''
      registerForm.password = ''
      registerForm.confirmPassword = ''
      registerForm.code = ''
      // 跳转到登录页
      router.push('/login')
    } else {
      showAlert('错误', data.message)
    }
  } catch (error) {
    console.error('注册失败:', error)
    showAlert('错误', '网络错误，请稍后重试')
  } finally {
    isRegistering.value = false
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  margin: 0;
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.title {
  text-align: center;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.subtitle {
  text-align: center;
  color: #909399;
  margin-bottom: 30px;
}

.login-form {
  margin-bottom: 20px;
}

.form-item {
  margin-bottom: 20px;
}

.form-item label {
  display: block;
  margin-bottom: 8px;
  color: #606266;
  font-size: 14px;
}

.form-item input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-item input:focus {
  outline: none;
  border-color: #409eff;
}

.error-text {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 4px;
}

.code-input-group {
  display: flex;
  gap: 10px;
}

.code-input-group input {
  flex: 1;
}

.send-code-btn {
  width: 140px;
  height: 40px;
  border: none;
  border-radius: 4px;
  background: #409eff;
  color: white;
  font-size: 14px;
  cursor: pointer;
}

.send-code-btn:disabled {
  background: #909399;
  cursor: not-allowed;
}

.submit-btn {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 4px;
  background: #409eff;
  color: white;
  font-size: 16px;
  cursor: pointer;
}

.submit-btn:disabled {
  background: #909399;
  cursor: not-allowed;
}

.link {
  text-align: center;
  color: #909399;
  font-size: 14px;
}

.link a {
  color: #409eff;
  text-decoration: none;
  cursor: pointer;
}
</style>