<!-- src/components/UserProfileModal.vue -->
<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleCancel">
    <div class="modal-card">
      <!-- 顶部关闭按钮 -->
      <div class="close-btn" @click="handleCancel">×</div>

      <!-- 个人信息头部 -->
      <div class="profile-header">
        <img 
          :src="userInfo.avatarUrl ? backendBase + userInfo.avatarUrl : defaultAvatar" 
          class="avatar" 
          alt="头像"
        />
        <div class="profile-info">
          <div class="nickname">{{ userInfo.nickname || '未知用户' }}</div>
          <div class="identity">{{ userInfo.identity || '未设置身份' }}</div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading">
        加载中...
      </div>

      <!-- 信息列表 -->
      <div v-else class="info-list">
        <div class="info-item" v-if="userInfo.gender">
          <span class="label">性别</span>
          <span class="value">{{ userInfo.gender }}</span>
        </div>

        <div class="info-item" v-if="userInfo.birthday">
          <span class="label">生日</span>
          <span class="value">{{ userInfo.birthday }}</span>
        </div>

        <div class="info-item" v-if="userInfo.phone">
          <span class="label">联系电话</span>
          <span class="value">{{ userInfo.phone }}</span>
        </div>

        <div class="info-item" v-if="userInfo.signature">
          <span class="label">个性签名</span>
          <span class="value">{{ userInfo.signature }}</span>
        </div>

        <div class="info-item" v-if="userInfo.desc">
          <span class="label">个人简介</span>
          <span class="value">{{ userInfo.desc }}</span>
        </div>

        <!-- 空状态 -->
        <div class="empty-info" v-if="!hasInfo">
          这个人很懒，什么都没留下~
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, computed, watch } from 'vue';

const backendBase = inject('backendBase');
const defaultAvatar = '/default-avatar.jpg';

// ✅ 和 CustomModal 完全一样的 props 定义
const props = defineProps({
  visible: Boolean,
  userId: [String, Number] // 新增：要显示的用户ID
});

const emit = defineEmits(['update:visible', 'cancel']);

const loading = ref(false);
const userInfo = ref({});

// 计算是否有可显示的信息
const hasInfo = computed(() => {
  return userInfo.value.gender 
    || userInfo.value.birthday 
    || userInfo.value.phone 
    || userInfo.value.signature 
    || userInfo.value.desc;
});

// ✅ 关键：监听 visible 和 userId 的变化，自动加载数据
watch(
  [() => props.visible, () => props.userId],
  ([newVisible, newUserId]) => {
    if (newVisible && newUserId) {
      loadUserInfo(newUserId);
    } else {
      // 关闭时清空数据
      userInfo.value = {};
      loading.value = false;
    }
  },
  { immediate: true }
);

// 内部加载用户数据的方法
const loadUserInfo = async (userId) => {
  loading.value = true;
  userInfo.value = {};

  try {
    const res = await fetch(`${backendBase}/api/get_user_public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ userId: userId })
    });

    const data = await res.json();
    if (data.success) {
      userInfo.value = data.data;
    } else {
      userInfo.value = { nickname: '加载失败' };
    }
  } catch (err) {
    console.error('加载用户资料失败', err);
    userInfo.value = { nickname: '网络错误' };
  } finally {
    loading.value = false;
  }
};

// ✅ 和 CustomModal 完全一样的事件处理
const handleCancel = () => {
  emit('cancel');
  emit('update:visible', false);
};
</script>

<style scoped>
/* 样式完全不变 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99999;
  padding: 20px;
}

.modal-card {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  position: relative;
}

.close-btn {
  position: absolute;
  top: 15px;
  right: 20px;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  line-height: 1;
}

.close-btn:hover {
  color: #333;
}

.loading {
  text-align: center;
  padding: 40px 0;
  color: #999;
}

/* 顶部个人信息 */
.profile-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f5f5f5;
  margin-bottom: 20px;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #f0f0f0;
}

.profile-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.nickname {
  font-size: 22px;
  font-weight: bold;
  color: #333;
}

.identity {
  font-size: 14px;
  color: #d95374;
}

/* 信息列表 */
.info-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.label {
  font-size: 14px;
  color: #999;
  width: 80px;
  flex-shrink: 0;
}

.value {
  font-size: 14px;
  color: #333;
  flex: 1;
  text-align: right;
  line-height: 1.5;
  word-break: break-all;
}

.empty-info {
  text-align: center;
  padding: 40px 0;
  color: #999;
  font-size: 14px;
}

/* 响应式适配 */
@media (max-width: 480px) {
  .modal-card {
    padding: 30px 20px;
  }
  
  .avatar {
    width: 60px;
    height: 60px;
  }
  
  .nickname {
    font-size: 18px;
  }
}
</style>