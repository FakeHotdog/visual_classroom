<!-- src/views/Home.vue -->
<template>
  <div class="home-container">
    <!-- 顶部个人信息栏 -->
    <div class="user-header">
      <img 
        :src="userInfo.avatarUrl ? backendBase + userInfo.avatarUrl : defaultAvatar" 
        class="header-avatar" 
      />
      <div class="user-info">
        <span class="nickname">{{ userInfo.nickname || '未设置昵称' }}</span>
        <span class="signature">{{ userInfo.signature || '这家伙很懒，什么都没留下~' }}</span>
      </div>
      <div class="header-actions">
        <button class="edit-btn" @click="goEdit">编辑</button>
        <button class="logout-btn" @click="logout">退出</button>
      </div>
    </div>

    <div class="page-container">
      <!--搜索栏-->
      <div class="search-box">
        <input class="search-input" v-model="keyword" placeholder="搜索班级名称" @keyup.enter="searchClass" />
        <button class="search-btn" @click="searchClass">搜索</button>
      </div>

      <!--快捷功能区-->
      <div class="quick-menu">
        <div class="menu-item" @click="goCreate">
          <div class="icon">🏫</div>
          <span class="text">创建班级</span>
        </div>
        <div class="menu-item" @click="goMy">
          <div class="icon">📚</div>
          <span class="text">我的班级</span>
        </div>
      </div>

      <!--班级列表区-->
      <div class="class-section">
        <div class="section-title">班级列表</div>
        <div class="class-list">
          <div class="class-card" v-for="item in list" :key="item.classId">
            <div class="card-header">
              <div class="class-left">
                <span class="class-name">{{ item.className }}</span>
                <span class="owner-name"> 管理员：{{ item.ownerName }}</span>
              </div>
              <span class="class-count">{{ item.memberCount }}/100人</span>
            </div>
            <div class="card-footer">
              <!-- 已在班级 -->
              <button v-if="item.isInClass" class="enter-btn" @click="enterClass(item)">进入教室</button>
              <!-- 未在班级 -->
              <button v-else class="enter-btn" @click="enterClass(item)">加入班级</button>
              <!-- 管理员才能解散 -->
              <button v-if="item.ownerId === userInfo.id" class="dissolve-btn" @click="dissolveClass(item.classId)">解散班级</button>
              <!-- 管理员才能修改暗号 -->
              <button v-if="item.ownerId === userInfo.id && item.classCode" class="change-code-btn" @click="changeClassCode(item.classId)">修改暗号</button>
              <button v-if="item.ownerId === userInfo.id && !item.classCode" class="change-code-btn" @click="changeClassCode(item.classId)">设置暗号</button>
            </div>
          </div>

          <!-- 暂无班级的占位 -->
          <div class="empty-card" v-if="list.length === 0">
            <span class="empty-icon">📭</span>
            <span class="empty-text">还没有找到班级</span>
            <span class="empty-tip">试试搜索班级名称，或者创建一个新班级吧~</span>
          </div>
        </div>
      </div>

      <!--底部标语-->
      <div class="footer">
        <span class="footer-text">时光不老 · 我们不散</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

// 后端地址及全局弹窗，从 App.vue 注入
const backendBase = inject('backendBase');
const showAlert = inject('showAlert');
const showConfirm = inject('showConfirm');
const showPrompt = inject('showPrompt');
// 默认头像
const defaultAvatar = '/default-avatar.jpg';

const userInfo = ref({
  id: '',
  username: '',
  nickname: '',
  signature: '',
  avatarUrl: ''
});

const keyword = ref('');
const list = ref([]);

const checkLogin = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    await showAlert('提示', '请先登录');
    router.push('/login');
    return;
  }
  
  try {
    const res = await fetch(`${backendBase}/user/info`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      userInfo.value = data.data;
      if (!userInfo.value.identity || !userInfo.value.gender) {
        await showAlert('提示', '请先完善个人信息');
        router.push('/edit');
      }
    } else {
      await showAlert('提示', data.message);
      localStorage.clear();
      router.push('/login');
    }
  } catch (err) {
    console.error(err);
  }
};

const changeClassCode = async (classId) => {
  const newCode = await showPrompt('请输入新的班级口令（留空则删除口令）', '新口令');
  if (newCode === null) return; // 用户取消

  try {
    const res = await fetch(`${backendBase}/api/update_class_code`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        classId,
        classCode: newCode || '' // 空字符串 = 无口令
      })
    });
    const data = await res.json();
    if (data.success) {
      await showAlert('成功', '班级口令已修改');
      loadMyClasses(); // 刷新列表
    } else {
      await showAlert('失败', data.message);
    }
  } catch (err) {
    console.error(err);
  }
};

const loadMyClasses = async () => {
  try {
    const res = await fetch(`${backendBase}/api/my_classes`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await res.json();
    if (data.success) {
      list.value = data.data;
    }
  } catch (err) {
    console.error(err);
  }
};

const searchClass = async () => {
  try {
    const res = await fetch(`${backendBase}/api/search_class?keyword=${encodeURIComponent(keyword.value)}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    if (data.success) {
      list.value = data.data;
    }
  } catch (err) {
    console.error(err);
  }
};

const goCreate = async () => {
  const className = await showPrompt('请输入你要创建的班级名称：', '班级名称');
  if (!className) return;
  const classCode = await showPrompt('给新班级设置一个暗号（可选）：', '暗号') || '';

  const doCreate = async (force = false) => {
    try {
      const res = await fetch(`${backendBase}/api/create_class`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ className, classCode, force })
      });
      const data = await res.json();
      
      if (data.success) {
        await showAlert('创建成功！');
        loadMyClasses();
      } else {
        if (data.data && data.data.needConfirm) {
          const confirmed = await showConfirm('重名提示', data.message);
          if (confirmed) {
            doCreate(true);
          }
        } else {
          await showAlert('提示', data.message);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  doCreate();
};

const goEdit = () => {
  router.push('/edit');
};

const goMy = () => {
  keyword.value = '';
  loadMyClasses();
};

const enterClass = async (cls) => {
  if (cls.isInClass) {
    // 已经加入
    router.push(`/classroom?classId=${cls.classId}`);
    return;
  }

  if (cls.classCode) {
    const inputCode = await showPrompt('进入该班级需要暗号，请输入：', '暗号');
    if (inputCode === null) return; // 用户点击了取消
    if (inputCode !== cls.classCode) {
      await showAlert('提示', '暗号不正确！');
      return;
    }
  }

  try {
    const res = await fetch(`${backendBase}/api/init_class_member`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ classId: cls.classId })
    });
    const data = await res.json();
    if (data.success) {
      await showAlert('加入成功');
      loadMyClasses();
      router.push(`/classroom?classId=${cls.classId}`);
    } else {
      await showAlert('提示', data.message);
    }
  } catch (err) {
    console.error(err);
  }
};

const dissolveClass = async (classId) => {
  const confirmed = await showConfirm('确认解散', '解散后班级将永久删除，所有成员将退出，确定吗？');
  if (!confirmed) return;
  try {
    const res = await fetch(`${backendBase}/api/dissolve_class`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ classId })
    });
    const data = await res.json();
    if (data.success) {
      await showAlert('解散成功');
      loadMyClasses();
    } else {
      await showAlert('提示', data.message);
    }
  } catch (err) {
    console.error(err);
  }
};

const logout = () => {
  localStorage.clear();
  router.push('/login');
};

onMounted(() => {
  checkLogin();
  loadMyClasses();
});
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  background-color: #f7f8fa;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  padding-bottom: 20px;
}

.user-header {
  display: flex;
  align-items: center;
  padding: 20px;
  background-color: #fff;
  border-bottom: 1px solid #ebedf0;
}

.header-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  margin-right: 15px;
  object-fit: cover;
  border: 2px solid #f0f0f0;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.nickname {
  font-size: 18px;
  font-weight: bold;
  color: #323233;
}

.signature {
  font-size: 13px;
  color: #969799;
  margin-top: 5px;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.edit-btn {
  font-size: 14px;
  color: #fff;
  background-color: #1989fa;
  border: none;
  padding: 6px 12px;
  border-radius: 15px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.edit-btn:hover {
  background-color: #0779e4;
}

.logout-btn {
  font-size: 14px;
  color: #fff;
  background-color: #ee0a24;
  border: none;
  padding: 6px 12px;
  border-radius: 15px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.logout-btn:hover {
  background-color: #c9001b;
}

.page-container {
  padding: 15px;
}

.search-box {
  display: flex;
  background-color: #fff;
  border-radius: 20px;
  padding: 5px 15px;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  margin-bottom: 20px;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  padding: 8px 0;
}

.search-btn {
  background-color: #1989fa;
  color: #fff;
  border: none;
  padding: 6px 15px;
  border-radius: 15px;
  font-size: 14px;
  cursor: pointer;
}

.search-btn:hover {
  background-color: #0779e4;
}

.quick-menu {
  display: flex;
  justify-content: space-around;
  margin-bottom: 20px;
}

.menu-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: #fff;
  padding: 30px 55px;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: transform 0.1s;
}
.menu-item:active {
  transform: scale(0.95);
}

.menu-item .icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.menu-item .text {
  font-size: 14px;
  color: #323233;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #323233;
  margin-bottom: 10px;
  padding-left: 5px;
}

/* 关键：响应式班级列表布局 */
.class-list {
  display: grid;
  gap: 15px;
  /* 手机端一行1个，平板/电脑端自动适配最多3个 */
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.class-card {
  background-color: #fff;
  border-radius: 12px;
  padding: 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.class-left {
  display: flex;
  flex-direction: column;
}

.class-name {
  font-size: 16px;
  font-weight: bold;
  color: #323233;
}

.owner-name {
  font-size: 12px;
  color: #969799;
  margin-top: 4px;
}

.class-count {
  font-size: 13px;
  color: #969799;
}

.card-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.change-code-btn {
  padding: 6px 15px;
  border: none;
  border-radius: 15px;
  font-size: 13px;
  cursor: pointer;
  background-color: #ff976a;
  color: white;
}
.change-code-btn:hover {
  background-color: #ff7b42;
}

.enter-btn, .dissolve-btn {
  padding: 6px 15px;
  border: none;
  border-radius: 15px;
  font-size: 13px;
  cursor: pointer;
}

.enter-btn {
  background-color: #07c160;
  color: white;
}

.enter-btn:hover {
  background-color: #06a14c;
}

.dissolve-btn {
  background-color: #ee0a24;
  color: white;
}

.dissolve-btn:hover {
  background-color: #c9001b;
}

.empty-card {
  /* 空状态单独占满一行 */
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  background-color: #fff;
  border-radius: 12px;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 10px;
}

.empty-text {
  font-size: 16px;
  color: #323233;
  margin-bottom: 5px;
}

.empty-tip {
  font-size: 13px;
  color: #969799;
}

.footer {
  text-align: center;
  margin-top: 40px;
}

.footer-text {
  font-size: 12px;
  color: #c8c9cc;
}
</style>