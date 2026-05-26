<!-- src/views/Edit.vue -->
<template>
  <div class="edit-page">
    <!-- 头像 -->
    <div class="avatar-wrap">
      <img :src="fullAvatarUrl" class="avatar" />
      <div class="tip" @click="triggerFileSelect">点击更换头像</div>
      <input type="file" ref="fileInput" accept="image/*" style="display: none" @change="onFileChange" />
    </div>

    <!-- 昵称 -->
    <div class="item required">
      <span class="label">昵称 <span class="required-tag">*</span></span>
      <input 
        class="input" 
        v-model="userInfo.nickname" 
        placeholder="请输入昵称" 
        maxlength="20"
      />
    </div>

    <!-- 身份选择 -->
    <div class="item">
      <span class="label">身份</span>
      <select class="input select-input" v-model="userInfo.identity">
        <option disabled value="">请选择身份</option>
        <option v-for="item in identityList" :key="item" :value="item">{{ item }}</option>
      </select>
    </div>

    <!-- 性别 -->
    <div class="item">
      <span class="label">性别</span>
      <select class="input select-input" v-model="userInfo.gender">
        <option disabled value="">请选择性别</option>
        <option v-for="item in genderList" :key="item" :value="item">{{ item }}</option>
      </select>
    </div>

    <!-- 生日 -->
    <div class="item">
      <span class="label">生日</span>
      <input 
        type="date"
        class="input" 
        v-model="userInfo.birthday" 
      />
    </div>

    <!-- 联系电话 -->
    <div class="item">
      <span class="label">联系电话</span>
      <input 
        class="input" 
        v-model="userInfo.phone" 
        placeholder="可选，方便班级内联系" 
        type="number"
        maxlength="11"
      />
    </div>

    <!-- 个性签名 -->
    <div class="item textarea-item">
      <span class="label">个性签名</span>
      <textarea 
        class="textarea"
        placeholder="显示在首页" 
        v-model="userInfo.signature" 
        maxlength="30"
      ></textarea>
    </div>

    <!-- 自我介绍 -->
    <div class="item textarea-item">
      <span class="label">自我介绍</span>
      <textarea 
        class="textarea desc-textarea"
        placeholder="详细介绍自己" 
        v-model="userInfo.desc" 
        maxlength="100"
      ></textarea>
    </div>

    <!-- 保存按钮 -->
    <button class="save-btn" @click="saveUserInfo">保存个人资料</button>

    <div class="footer">
      <span class="footer-text">时光不老 · 我们不散</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, inject } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const fileInput = ref(null);

const backendBase = inject('backendBase');
const showAlert = inject('showAlert');
const defaultAvatar = '/default-avatar.jpg';

const identityList = ['学生', '教师', '其他'];
const genderList = ['男', '女', '保密'];

const userInfo = ref({
  nickname: '',
  identity: '',
  gender: '',
  birthday: '',
  phone: '',
  signature: '',
  desc: '',
  avatarUrl: ''
});

const isAvatarChanged = ref(false);
const newAvatarFile = ref(null);

const fullAvatarUrl = computed(() => {
  if (isAvatarChanged.value && newAvatarFile.value) {
    return URL.createObjectURL(newAvatarFile.value);
  }
  if (userInfo.value.avatarUrl) {
    return backendBase + userInfo.value.avatarUrl;
  }
  return defaultAvatar;
});

const loadUserInfo = async () => {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${backendBase}/user/info`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      const u = data.data;
      userInfo.value = {
        nickname: u.nickname || '',
        identity: u.identity || '',
        gender: u.gender || '',
        birthday: u.birthday || '',
        phone: u.phone || '',
        signature: u.signature || '',
        desc: u.desc || '',
        avatarUrl: u.avatarUrl || ''
      };
    }
  } catch (err) {
    console.error(err);
  }
};

const triggerFileSelect = () => {
  if (fileInput.value) {
    fileInput.value.click();
  }
};

const onFileChange = (e) => {
  const files = e.target.files;
  if (files && files.length > 0) {
    newAvatarFile.value = files[0];
    isAvatarChanged.value = true;
  }
};

const uploadAvatarToServer = async () => {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', newAvatarFile.value);

  try {
    const res = await fetch(`${backendBase}/api/upload_avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      return data.data.url;
    } else {
      await showAlert('提示', data.message || '头像上传失败');
      return '';
    }
  } catch (err) {
    console.error(err);
    await showAlert('提示', '上传接口错误');
    return '';
  }
};

const submitToBackend = async (info) => {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${backendBase}/api/update_user`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(info)
    });
    const data = await res.json();
    if (data.success) {
      await showAlert('提示', '保存成功');
      router.push('/home');
    } else {
      await showAlert('提示', data.message || '保存失败');
    }
  } catch (err) {
    console.error(err);
    await showAlert('提示', '网络错误');
  }
};

const saveUserInfo = async () => {
  if (!userInfo.value.nickname.trim()) {
    await showAlert('提示', '请输入昵称');
    return;
  }

  let finalInfo = { ...userInfo.value };

  if (isAvatarChanged.value && newAvatarFile.value) {
    const serverAvatarUrl = await uploadAvatarToServer();
    if (!serverAvatarUrl) {
      return; 
    }
    finalInfo.avatarUrl = serverAvatarUrl;
  }

  await submitToBackend(finalInfo);
};

onMounted(() => {
  loadUserInfo();
});
</script>

<style scoped>
.edit-page {
  min-height: 100vh;
  background-color: #f7f8fa;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.avatar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 30px;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background-color: #fff;
}

.avatar.placeholder {
  background-color: #ccc;
}

.tip {
  margin-top: 10px;
  font-size: 13px;
  color: #1989fa;
  cursor: pointer;
}

.item {
  display: flex;
  align-items: center;
  background-color: #fff;
  padding: 15px 20px;
  border-bottom: 1px solid #f5f6f7;
}

.item:first-of-type {
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.item.textarea-item {
  align-items: flex-start;
  flex-direction: column;
}

.label {
  width: 80px;
  font-size: 15px;
  color: #323233;
}

.required-tag {
  color: #ee0a24;
}

.input {
  flex: 1;
  border: none;
  font-size: 15px;
  outline: none;
  color: #323233;
  background: transparent;
  padding: 0;
}

.select-input {
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.textarea {
  width: 100%;
  border: none;
  font-size: 14px;
  color: #323233;
  margin-top: 10px;
  resize: none;
  outline: none;
}

.desc-textarea {
  height: 80px;
}

.save-btn {
  width: 100%;
  background-color: #07c160;
  color: #fff;
  border: none;
  border-radius: 25px;
  padding: 12px 0;
  font-size: 16px;
  margin-top: 40px;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(7, 193, 96, 0.3);
}

.footer {
  text-align: center;
  margin-top: 30px;
}

.footer-text {
  font-size: 12px;
  color: #c8c9cc;
}
</style>