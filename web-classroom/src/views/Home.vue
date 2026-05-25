<!-- src/views/Home.vue -->
<template>
  <div class="home">
    <h1>欢迎来到同学录，{{ nickname }}！</h1>
    <button @click="logout">退出登录</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      nickname: ''
    }
  },
  mounted() {
    // 从本地存储获取用户昵称
    this.nickname = localStorage.getItem('nickname') || '同学'
  },
  methods: {
    logout() {
      // 清空本地存储
      localStorage.clear()
      // 跳转到登录页
      this.$router.push('/login')
    }
  }
}
</script>

<style scoped>
.home {
  text-align: center;
  margin-top: 100px;
}

button {
  padding: 8px 16px;
  background-color: #f56c6c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 20px;
}

button:hover {
  background-color: #e64340;
}
</style>