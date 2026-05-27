<template>
  <div class="publish-story-page">
    <div class="header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>发布班级故事</h2>
      <button 
        class="publish-btn-header" 
        @click="publishStory" 
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? '发布中...' : '发布' }}
      </button>
    </div>

    <div class="content">
      <!-- 标题输入 -->
      <div class="form-item">
        <input
          v-model.trim="title"
          type="text"
          class="title-input"
          placeholder="请输入故事标题（最多50字）"
          maxlength="50"
        />
      </div>

      <!-- 内容输入 -->
      <div class="form-item">
        <textarea
          v-model.trim="content"
          class="content-textarea"
          placeholder="分享你的班级故事..."
          maxlength="5000"
          rows="8"
        ></textarea>
        <div class="word-count">{{ content.length }}/5000</div>
      </div>

      <!-- 图片上传区域 -->
      <div class="form-item">
        <div class="image-grid">
          <!-- 已上传图片 -->
          <div 
            v-for="(img, index) in imageList" 
            :key="index"
            class="image-item"
          >
            <img 
              :src="img.previewUrl" 
              class="uploaded-image" 
              alt="已上传图片"
            />
            <div 
              class="delete-btn" 
              @click="deleteImage(index)"
            >
              ×
            </div>
          </div>

          <!-- 添加图片按钮 -->
          <div 
            class="add-image-btn" 
            v-if="imageList.length < 9"
            @click="chooseImages"
          >
            <span class="add-icon">+</span>
            <span class="add-text">添加图片</span>
            <input
              ref="fileInput"
              type="file"
              class="file-input"
              accept="image/png,image/jpg,image/jpeg,image/gif,image/bmp"
              multiple
              @change="handleFileChange"
            />
          </div>
        </div>
        <div class="image-tip">最多上传9张图片，支持png/jpg/jpeg/gif/bmp格式</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

// 注入全局变量和方法（和Classroom.vue保持一致）
const backendBase = inject('backendBase');
const showAlert = inject('showAlert');

// 响应式数据
const classId = ref(route.query.classId || '');
const title = ref('');
const content = ref('');
const imageList = ref([]); // 格式：[{ file: File, previewUrl: string }, ...]
const isSubmitting = ref(false);
const fileInput = ref(null);

// 统一获取请求头（和Classroom.vue保持一致）
const getAuthHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  };
};

// 页面初始化校验
if (!classId.value) {
  showAlert('错误', '缺少班级ID');
  router.back();
}

// 选择图片
const chooseImages = () => {
  fileInput.value.click();
};

// 处理文件选择
const handleFileChange = (e) => {
  const files = e.target.files;
  if (!files.length) return;

  // 计算剩余可上传数量
  const remaining = 9 - imageList.value.length;
  if (remaining <= 0) {
    showAlert('提示', '最多只能上传9张图片');
    return;
  }

  // 过滤合法文件类型
  const validFiles = Array.from(files).filter((file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    const allowExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp'];
    if (!allowExts.includes(ext)) {
      showAlert('提示', `文件${file.name}格式不支持`);
      return false;
    }
    // 限制单张图片大小不超过5MB
    if (file.size > 5 * 1024 * 1024) {
      showAlert('提示', `文件${file.name}超过5MB限制`);
      return false;
    }
    return true;
  });

  // 截取可上传数量
  const finalFiles = validFiles.slice(0, remaining);

  // 生成预览URL并添加到列表
  finalFiles.forEach((file) => {
    imageList.value.push({
      file,
      previewUrl: URL.createObjectURL(file)
    });
  });

  // 清空input值，允许重复选择同一张图片
  e.target.value = '';
};

// 删除图片
const deleteImage = (index) => {
  // 释放预览URL，防止内存泄漏
  URL.revokeObjectURL(imageList.value[index].previewUrl);
  imageList.value.splice(index, 1);
};

// 批量上传图片到服务器
const uploadImages = async () => {
  const uploadPromises = imageList.value.map(async (img) => {
    try {
      const formData = new FormData();
      formData.append('file', img.file);

      const res = await fetch(`${backendBase}/api/upload_story_image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        return data.data.url;
      } else {
        showAlert('提示', `图片${img.file.name}上传失败`);
        return '';
      }
    } catch (err) {
      showAlert('错误', '网络异常，图片上传失败');
      return '';
    }
  });

  // 等待所有图片上传完成，过滤失败的
  const imageUrls = await Promise.all(uploadPromises);
  return imageUrls.filter((url) => url);
};

// 发布故事
const publishStory = async () => {
  // 表单验证
  if (!title.value) {
    showAlert('提示', '请输入故事标题');
    return;
  }
  if (!content.value) {
    showAlert('提示', '请输入故事内容');
    return;
  }

  isSubmitting.value = true;

  try {
    // 第一步：上传所有图片
    const imageUrls = imageList.value.length > 0 ? await uploadImages() : [];

    // 第二步：提交故事数据
    const res = await fetch(`${backendBase}/api/add_story`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        classId: classId.value,
        title: title.value,
        content: content.value,
        images: imageUrls
      })
    });

    const data = await res.json();
    if (data.success) {
      showAlert('成功', '故事发布成功');
      // 返回上一页并自动刷新故事列表
      router.go(-1);
    } else {
      showAlert('失败', data.message || '发布失败');
    }
  } catch (err) {
    showAlert('错误', '网络异常，发布失败');
  } finally {
    isSubmitting.value = false;
  }
};

// 返回上一页
const goBack = () => {
  if (isSubmitting.value) {
    showAlert('提示', '正在发布中，请稍候');
    return;
  }
  router.back();
};

// 组件卸载时释放所有预览URL
onUnmounted(() => {
  imageList.value.forEach((img) => {
    URL.revokeObjectURL(img.previewUrl);
  });
});
</script>

<style scoped>
.publish-story-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
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

.publish-btn-header {
  padding: 4px 16px;
  background: #1989fa;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.publish-btn-header:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 内容区域 */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}

.form-item {
  background: white;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
}

/* 标题输入 */
.title-input {
  width: 100%;
  border: none;
  outline: none;
  font-size: 1.2rem;
  font-weight: bold;
}

/* 内容输入 */
.content-textarea {
  width: 100%;
  border: none;
  outline: none;
  font-size: 1rem;
  line-height: 1.5;
  resize: none;
}

.word-count {
  text-align: right;
  font-size: 0.8rem;
  color: #999;
  margin-top: 5px;
}

/* 图片上传网格 */
.image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.image-item {
  width: calc(33.33% - 7px);
  aspect-ratio: 1;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

.uploaded-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.delete-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 24px;
  height: 24px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border-radius: 50%;
  text-align: center;
  line-height: 24px;
  font-size: 16px;
  cursor: pointer;
}

.add-image-btn {
  width: calc(33.33% - 7px);
  aspect-ratio: 1;
  border: 1px dashed #ddd;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  cursor: pointer;
}

.add-icon {
  font-size: 32px;
  margin-bottom: 4px;
}

.add-text {
  font-size: 0.8rem;
}

.file-input {
  display: none;
}

.image-tip {
  font-size: 0.8rem;
  color: #999;
  margin-top: 10px;
}
</style>