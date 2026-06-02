<template>
  <div class="login-container">
    <div class="login-card">
      <h2 class="title">清华大学选课评价系统</h2>
      <p class="subtitle">注册账号</p>
      
      <form class="login-form" @submit.prevent="handleRegister">
        <div class="form-item">
          <label>邮箱</label>
          <input
            v-model="registerForm.email"
            type="email"
            placeholder="请输入清华大学官方邮箱"
            @blur="checkEmailSuffix"
            required
          />
          <div v-if="emailError" class="error-text">{{ emailError }}</div>
        </div>
        
        <div class="form-item">
          <label>昵称</label>
          <input
            v-model="registerForm.nickname"
            placeholder="请输入您的昵称"
            maxlength="20"
            required
          />
        </div>
        
        <div class="form-item">
          <label>密码</label>
          <input
            v-model="registerForm.password"
            type="password"
            placeholder="请输入密码（至少6位）"
            required
          />
        </div>
        
        <div class="form-item">
          <label>确认密码</label>
          <input
            v-model="registerForm.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            required
          />
          <div v-if="passwordError" class="error-text">{{ passwordError }}</div>
        </div>
        
        <div class="form-item">
          <label>验证码</label>
          <div class="code-input-group">
            <input
              v-model="registerForm.code"
              placeholder="请输入6位验证码"
              maxlength="6"
              required
            />
            <button
              type="button"
              :disabled="isSendingCode || !registerForm.email || !emailValid"
              @click="sendCode"
              class="send-code-btn"
            >
              {{ codeButtonText }}
            </button>
          </div>
        </div>
        
        <button
          type="submit"
          class="submit-btn"
          :disabled="isRegistering"
        >
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
import { sha256 } from 'js-sha256';
async function hashPassword(pwd) {
  return sha256(pwd);
}

export default {
  data() {
    return {
      registerForm: {
        email: '',
        nickname: '',
        password: '',
        confirmPassword: '',
        code: ''
      },
      emailError: '',
      passwordError: '',
      isSendingCode: false,
      codeButtonText: '发送验证码',
      isRegistering: false,
      backendBase: ''
    }
  },
  mounted() {

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