<template>
  <div class="story-detail-page">
    <!-- 顶部导航栏 -->
    <div class="header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>故事详情</h2>
      <button 
        v-if="canDelete" 
        class="delete-btn-header" 
        @click="handleDelete"
        :disabled="isDeleting"
      >
        {{ isDeleting ? '删除中...' : '删除' }}
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-container">
      <div class="loading-text">加载中...</div>
    </div>

    <!-- 内容区域 -->
    <div v-else-if="storyInfo" class="content">
      <div class="story-card">
        <!-- 作者信息 -->
        <div class="author-header">
          <img 
            :src="formatImageUrl(storyInfo.authorAvatar)" 
            class="author-avatar" 
            alt="作者头像"
          />
          <div class="author-info">
            <div class="author-name">{{ storyInfo.authorName }}</div>
            <div class="publish-time">{{ storyInfo.createTimeFormatted }}</div>
          </div>
        </div>

        <!-- 故事标题 -->
        <h1 class="story-title">{{ storyInfo.title }}</h1>

        <!-- 故事内容 -->
        <div class="story-content">{{ storyInfo.content }}</div>

        <!-- 图片网格 -->
        <div v-if="storyInfo.images.length > 0" class="image-grid">
          <div 
            v-for="(img, index) in storyInfo.images" 
            :key="index"
            class="image-item"
            @click="previewImage(index)"
          >
            <img 
              :src="formatImageUrl(img)" 
              class="story-image" 
              alt="故事图片"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 图片预览遮罩 -->
    <div v-if="showPreview" class="preview-mask" @click="closePreview">
      <img 
        :src="formatImageUrl(storyInfo.images[currentPreviewIndex])" 
        class="preview-image" 
        alt="预览图片"
        @click.stop
      />
      <div class="preview-counter">{{ currentPreviewIndex + 1 }}/{{ storyInfo.images.length }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

// 注入全局变量和方法（与其他页面保持一致）
const backendBase = inject('backendBase');
const showAlert = inject('showAlert');
const showConfirm = inject('showConfirm');

// 响应式数据
const storyId = ref(route.query.storyId || '');
const classId = ref(route.query.classId || '');
const classOwnerId = ref(route.query.classOwnerId || '');
const currentUserId = ref(localStorage.getItem('userId') || ''); // 与登录时存储的userId一致
const canDelete = ref(false);
const storyInfo = ref(null);
const isLoading = ref(true);
const isDeleting = ref(false);
const showPreview = ref(false);
const currentPreviewIndex = ref(0);

// 统一获取请求头
const getAuthHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  };
};

// 格式化图片URL（拼接后端地址）
const formatImageUrl = (url) => {
  if (!url) return '/default-avatar.jpg';
  if (url.startsWith('http')) return url;
  return backendBase + url;
};

// 加载故事详情
const loadStoryDetail = async () => {
  if (!storyId.value) {
    showAlert('错误', '缺少故事ID');
    router.back();
    return;
  }

  isLoading.value = true;
  try {
    const res = await fetch(`${backendBase}/api/get_story_detail`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ storyId: storyId.value })
    });

    const data = await res.json();
    if (data.success) {
      storyInfo.value = data.data;
      // 计算是否有权限删除
      canDelete.value = data.data.canDelete;
    } else {
      showAlert('错误', data.message || '加载失败');
      router.back();
    }
  } catch (err) {
    showAlert('错误', '网络异常，加载失败');
    router.back();
  } finally {
    isLoading.value = false;
  }
};

// 返回上一页
const goBack = () => {
  if (isDeleting.value) return;
  router.back();
};

// 删除故事
const handleDelete = async () => {
  const confirm = await showConfirm('确认删除', '确定要删除这个故事吗？删除后无法恢复');
  if (!confirm) return;

  isDeleting.value = true;
  try {
    const res = await fetch(`${backendBase}/api/delete_story`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ 
        storyId: storyId.value,
        classId: classId.value 
      })
    });

    const data = await res.json();
    if (data.success) {
      showAlert('成功', '故事已删除');
      // 返回上一页并自动刷新列表
      router.go(-1);
    } else {
      showAlert('错误', data.message || '删除失败');
    }
  } catch (err) {
    showAlert('错误', '网络异常，删除失败');
  } finally {
    isDeleting.value = false;
  }
};

// 预览图片
const previewImage = (index) => {
  currentPreviewIndex.value = index;
  showPreview.value = true;
  // 禁止页面滚动
  document.body.style.overflow = 'hidden';
};

// 关闭预览
const closePreview = () => {
  showPreview.value = false;
  // 恢复页面滚动
  document.body.style.overflow = '';
};

// 页面初始化
onMounted(() => {
  // 从localStorage获取当前用户ID（确保登录时已存储）
  currentUserId.value = localStorage.getItem('userId') || '';
  loadStoryDetail();
});
</script>

<style scoped>
.story-detail-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #f5f5f5;
}

/* 顶部导航栏 */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.back-btn {
  padding: 4px 10px;
  background: #f0f0f0;
  color: #333;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.delete-btn-header {
  padding: 4px 16px;
  background: #ff4d4f;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.delete-btn-header:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 加载状态 */
.loading-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-text {
  font-size: 1rem;
  color: #999;
}

/* 内容区域 */
.content {
  flex: 1;
  padding: 15px;
}

.story-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

/* 作者信息 */
.author-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #f5f5f5;
}

.author-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
}

.author-info {
  flex: 1;
}

.author-name {
  font-size: 1.1rem;
  font-weight: bold;
  color: #333;
}

.publish-time {
  font-size: 0.85rem;
  color: #999;
  margin-top: 4px;
}

/* 故事标题 */
.story-title {
  font-size: 1.4rem;
  font-weight: bold;
  color: #333;
  line-height: 1.4;
  margin: 0 0 15px 0;
}

/* 故事内容 */
.story-content {
  font-size: 1rem;
  line-height: 1.8;
  color: #333;
  white-space: pre-wrap;
  word-break: break-all;
  margin-bottom: 20px;
}

/* 图片网格 */
.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.image-item {
  aspect-ratio: 1;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
}

.story-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s;
}

.story-image:hover {
  transform: scale(1.05);
}

/* 图片预览遮罩 */
.preview-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.preview-image {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
}

.preview-counter {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  color: white;
  font-size: 1rem;
  background: rgba(0, 0, 0, 0.5);
  padding: 8px 16px;
  border-radius: 20px;
}
</style>