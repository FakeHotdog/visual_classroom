<template>
  <div class="chat-detail-page">
    <div class="header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ targetUserInfo?.nickname || '聊天' }}</h2>
    </div>

    <div ref="chatScrollContainer" class="chat-list">
      <div v-for="msg in chatMessages" :key="msg.id"
        :class="['chat-item', { 'my-msg': msg.isOwner, 'other-msg': !msg.isOwner }]">
        <img
          :src="msg.isOwner ? myAvatar : targetUserInfo?.avatarUrl ? backendBase + targetUserInfo.avatarUrl : defaultAvatar"
          class="chat-avatar" />
        <div class="chat-bubble">{{ msg.content }}</div>
      </div>
    </div>

    <div class="chat-input-area">
      <input v-model="newChatMessage" type="text" placeholder="说点什么吧..." @keyup.enter="sendChatMessage" />
      <button @click="sendChatMessage" :disabled="!newChatMessage.trim()">发送</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const backendBase = inject('backendBase');
const defaultAvatar = '/default-avatar.jpg';
const showAlert = inject('showAlert');

const targetUserId = ref(route.query.targetUserId);
const classId = ref(route.query.classId);
const currentUserId = ref(localStorage.getItem('userId'));
const targetUserInfo = ref(null);
const myAvatar = ref('');

const chatMessages = ref([]);
const newChatMessage = ref('');
const chatScrollContainer = ref(null);
const lastMessageId = ref(0);
let pollTimer = null;

const getAuthHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  };
};

// 加载对方用户信息
const loadTargetUserInfo = async () => {
  try {
    // 先从班级成员列表中找
    const res = await fetch(`${backendBase}/api/get_class_members`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ classId: classId.value })
    });
    const data = await res.json();
    if (data.success) {
      const member = data.data.members.find(m => m.id == targetUserId.value);
      if (member) {
        targetUserInfo.value = member;
      }
    }

    // 加载自己的头像
    const userRes = await fetch(`${backendBase}/user/info`, {
      headers: getAuthHeaders()
    });
    const userData = await userRes.json();
    if (userData.success) {
      myAvatar.value = userData.data.avatarUrl ? backendBase + userData.data.avatarUrl : defaultAvatar;
    }
  } catch (err) {
    console.error("加载用户信息失败", err);
  }
};

// 加载聊天历史
const loadChatHistory = async () => {
  try {
    const res = await fetch(`${backendBase}/api/get_chat_history`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ targetUserId: targetUserId.value, classId: classId.value })
    });
    const data = await res.json();
    if (data.success) {
      chatMessages.value = data.data;
      if (chatMessages.value.length > 0) {
        lastMessageId.value = chatMessages.value[chatMessages.value.length - 1].id;
      }
      scrollToBottom();
    }
  } catch (err) {
    console.error("加载聊天历史失败", err);
  }
};

const pullNewMessages = async () => {
  try {
    const res = await fetch(`${backendBase}/api/pull_new_messages`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        targetUserId: targetUserId.value,
        classId: classId.value,
        lastMessageId: lastMessageId.value
      })
    });
    const data = await res.json();
    if (data.success && data.data.length > 0) {
      // 把新消息添加到聊天列表
      chatMessages.value.push(...data.data);
      // 更新最后一条消息ID
      lastMessageId.value = data.data[data.data.length - 1].id;
      scrollToBottom();
    }
  } catch (err) {
    // 轮询失败静默处理，下一次自动重试
    console.log("轮询新消息失败，下一次重试", err);
  }
};

// 发送消息
const sendChatMessage = async () => {
  const content = newChatMessage.value.trim();
  if (!content) return;

  // 清空输入框（防止重复发送）
  const tempContent = content;
  newChatMessage.value = '';

  try {
    const res = await fetch(`${backendBase}/api/send_message`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        receiverId: targetUserId.value,
        content: tempContent,
        classId: classId.value
      })
    });
    const data = await res.json();
    if (data.success) {
      chatMessages.value.push(data.data);
      scrollToBottom();
      // 发送成功后立即拉取一次（减少延迟），还要把轮询重置一下，避免过快的连续发送导致消息丢失
      setTimeout(pullNewMessages, 500);
      if (pollTimer) {
        clearInterval(pollTimer);
      }
      pollTimer = setInterval(pullNewMessages, 10000);
    } else {
      showAlert(`发送失败：${data.message}`);
      newChatMessage.value = tempContent;
    }
  } catch (err) {
    console.error("发送消息失败", err);
    showAlert('网络异常，消息发送失败');
    // 发送失败恢复输入框内容
    newChatMessage.value = tempContent;
  }
};

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (chatScrollContainer.value) {
      chatScrollContainer.value.scrollTop = chatScrollContainer.value.scrollHeight;
    }
  });
};

// 返回上一页
const goBack = () => {
  router.back();
};

onMounted(() => {
  if (!targetUserId.value || !classId.value) {
    showAlert('聊天参数异常，请返回重试');
    router.back();
    return;
  }
  loadTargetUserInfo();
  loadChatHistory();
  if (pollTimer) {
    clearInterval(pollTimer);
  }
  pollTimer = setInterval(pullNewMessages, 10000);
});

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>

<style scoped>
.chat-detail-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
}

.header {
  display: flex;
  align-items: center;
  padding: 15px;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.header h2 {
  margin: 0;
  font-size: 1.2rem;
  margin-left: 15px;
}

.back-btn {
  padding: 4px 10px;
  background: #f0f0f0;
  color: #333;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}

.chat-item {
  display: flex;
  margin-bottom: 15px;
  align-items: flex-end;
}

.chat-item.my-msg {
  flex-direction: row-reverse;
}

.chat-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.chat-bubble {
  max-width: 70%;
  margin: 0 10px;
  padding: 10px 15px;
  border-radius: 10px;
  word-break: break-all;
  background: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.my-msg .chat-bubble {
  background: #9eea6a;
}

.chat-input-area {
  display: flex;
  padding: 10px;
  background: white;
  border-top: 1px solid #eee;
}

.chat-input-area input {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px 10px;
  outline: none;
}

.chat-input-area button {
  margin-left: 10px;
  padding: 0 20px;
  background: #1989fa;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.chat-input-area button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>