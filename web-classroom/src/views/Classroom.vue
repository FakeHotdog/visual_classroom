<template>
  <div class="classroom-container">
    <div class="header">
      <h2>{{ classInfo?.className || '加载中...' }}</h2>
      <div v-if="classInfo?.className" class="class-id">ID: {{ classId }}
        <button @click="copyClassId" class="copy-btn">复制</button>
      </div>
      <button class="back-btn" @click="goBack">返回主页</button>
    </div>

    <!-- 顶部分类页签 -->
    <div class="tab-bar">
      <div v-for="tab in tabs" :key="tab.id" :class="['tab-item', { active: currentTab === tab.id }]"
        @click="currentTab = tab.id">
        <div class="tab-icon-wrapper">
          <img :src="tab.icon" class="tab-icon" />
          <div 
            v-if="tab.id === 'chat' && unreadTotal > 0" class="red-dot"
          ></div>
        </div>
        <span>{{ tab.name }}</span>
      </div>
    </div>

    <!-- 时空教室 (座位区) -->
    <div v-if="currentTab === 'seats'" class="tab-content seats-tab">
      <div class="classroom-wrap">
        <!-- 教室背景 -->
        <img class="bg-img" src="https://cdn.jsdelivr.net/gh/FakeHotdog/classroom-img/bg.jpg" mode="widthFix" />

        <!-- 座位网格 -->
        <div class="seat-grid">
          <div v-for="(seat, index) in seats" :key="index" class="seat-item" @click="selectSeat(index)"
            :class="{ selected: selectedIndex === index }">
            <img v-if="!seat.isOccupied" class="desk"
              src="https://cdn.jsdelivr.net/gh/FakeHotdog/classroom-img/desk.png" mode="widthFix" />
            <img v-else class="student"
              :src="seat.gender === '女' ? 'https://cdn.jsdelivr.net/gh/FakeHotdog/classroom-img/girl.png' : 'https://cdn.jsdelivr.net/gh/FakeHotdog/classroom-img/boy.png'"
              mode="widthFix" />
            <div class="name-wrap">
              <span v-if="seat.isOccupied" class="seat-name">{{ seat.nickname }}</span>
            </div>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="seat-btn-bar">
          <button class="btn leave-btn" @click="leaveSeat" :disabled="mySeatIndex === null">
            下座位
          </button>
          <button class="btn sit-btn" @click="takeSeat" :disabled="selectedIndex === null">
            {{ mySeatIndex === null ? '上座位' : '换座位' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 班级私信 -->
    <div v-if="currentTab === 'chat'" class="tab-content chat-tab">
      <div class="conversation-list">
        <div v-for="conv in conversations" :key="conv.userId" class="conversation-item"
          @click="goToChatDetail(conv.userId)">
          <img :src="conv.avatarUrl ? backendBase + conv.avatarUrl : defaultAvatar" class="conversation-avatar" />
          <div class="conversation-info">
            <div class="conversation-top">
              <span class="conversation-name">{{ conv.nickname }}</span>
              <span class="conversation-time">{{ formatTime(conv.lastTime) }}</span>
            </div>
            <div class="conversation-bottom">
              <span class="last-message">{{ conv.lastMessage }}</span>
              <span v-if="conv.unreadCount > 0" class="unread-badge">{{ conv.unreadCount }}</span>
            </div>
          </div>
        </div>

        <div v-if="conversations.length === 0" class="empty-state">
          暂无私信，点击成员头像开始聊天吧！
        </div>
      </div>
    </div>

    <!-- 班级故事 -->
    <div v-if="currentTab === 'story'" class="tab-content story-tab">
      <button class="post-story-btn" @click="goToPublishStory">发布新故事</button>

      <div class="story-list">
        <div v-for="story in stories" :key="story.id" class="story-card" @click="goToStoryDetail(story)">
          <div class="story-header">
            <img :src="story.authorAvatar ? backendBase + story.authorAvatar : defaultAvatar" class="author-avatar" />
            <div class="author-info">
              <div class="author-name">{{ story.authorName }}</div>
              <div class="story-time">{{ story.createTimeFormatted }}</div>
            </div>
            <!-- 如果是自己发的，或者是班主，可以删除 -->
            <button v-if="story.authorId === currentUserId || isClassOwner" class="delete-story-btn"
              @click.stop="deleteStory(story.id)">
              删除
            </button>
          </div>

          <div class="story-body">
            <div class="story-text-wrap">
              <div class="story-title">{{ story.title }}</div>
              <div class="story-content">{{ story.content }}</div>
            </div>
            <div class="story-preview" v-if="story.images && story.images.length > 0">
              <img :src="backendBase + story.images[0]" class="preview-img" alt="图片预览" />
              <span class="image-count" v-if="story.imageCount > 0">共 {{ story.imageCount }} 张</span>
            </div>
          </div>

        </div>
        <div v-if="stories.length === 0" class="empty-state">
          暂无故事，快来发布第一条吧！
        </div>
        <div v-else-if="hasMoreStories" style="text-align:center; padding: 10px; color:#999;" @click="loadStories">
          点击加载更多 (当前加载: {{ stories.length }}条)
        </div>
        <div v-else style="text-align:center; padding: 10px; color:#999;">
          没有更多故事了 (共 {{ stories.length }}条)
        </div>
      </div>
    </div>

    <!-- 班级管理 -->
    <div v-if="currentTab === 'manage'" class="tab-content manage-tab">
      <div class="manage-info">
        <h3>成员列表 ({{ members.length }}人)</h3>
      </div>
      <div class="member-list">
        <div v-for="member in members" :key="member.id" class="member-item">
          <img :src="member.avatarUrl ? backendBase + member.avatarUrl : defaultAvatar" class="member-avatar" />
          <div class="member-info">
            <div class="member-name">
              {{ member.nickname }}
              <span v-if="member.isOwner" class="owner-tag">班长</span>
            </div>
            <div class="member-id">ID: {{ member.id }}</div>
            <div class="member-sig">{{ member.signature || '暂无签名' }}</div>
          </div>
          <div class="member-actions">
            <button class="info-btn" @click="viewMemberInfo(member.id)">资料</button>
            <button class="chat-btn" @click="goToChatDetail(member.id)">发消息</button>
            <!-- 群主踢人 (不能踢自己) -->
            <button v-if="isClassOwner && !member.isOwner" @click="kickMember(member.id, member.nickname)"
              class="kick-btn">
              踢出
            </button>
          </div>
        </div>
      </div>

      <div class="danger-zone">
        <button v-if="!isClassOwner" @click="quitClass" class="quit-btn">退出班级</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, inject, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const backendBase = inject('backendBase');
const defaultAvatar = 'https://cdn.jsdelivr.net/gh/FakeHotdog/classroom-img/default-avatar.jpg';

const getAuthHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  };
};

const showAlert = inject('showAlert');
const showConfirm = inject('showConfirm');
const showPrompt = inject('showPrompt');
const showUserProfile = inject('showUserProfile');

const classId = ref(route.query.classId);
const classInfo = ref(null);
const currentUserId = ref(null);
const isClassOwner = ref(false);
const selectedIndex = ref(null);

const tabs = [
  { id: 'seats', name: '时空教室', icon: 'https://cdn.jsdelivr.net/gh/FakeHotdog/classroom-img/icon1.png' },
  { id: 'chat', name: '班级私信', icon: 'https://cdn.jsdelivr.net/gh/FakeHotdog/classroom-img/icon2.png' },
  { id: 'story', name: '班级故事', icon: 'https://cdn.jsdelivr.net/gh/FakeHotdog/classroom-img/icon3.png' },
  { id: 'manage', name: '班级管理', icon: 'https://cdn.jsdelivr.net/gh/FakeHotdog/classroom-img/icon4.png' }
];
const currentTab = ref('seats');

// -------- 时空教室数据 --------
const seats = ref(Array.from({ length: 100 }, () => ({
  isOccupied: false,
  userId: "",
  nickname: "",
  gender: ""
})));
const mySeatIndex = ref(null);

// -------- 班级私信数据 --------
const conversations = ref([]);
const unreadTotal = ref(0);

// -------- 班级故事数据 --------
const stories = ref([]);
const storyPage = ref(0);
const hasMoreStories = ref(true);

// -------- 班级成员数据 --------
const members = ref([]);


onMounted(async () => {
  if (!classId.value) {
    await showAlert('参数错误', '缺少班级ID');
    router.back();
    return;
  }

  // 获取当前用户信息
  await loadUserProfile();

  await loadClassMembers(); // 顺带加载了 classInfo 和 ownerId

  // 初始加载所有Tab数据，或者等到切换时再加载
  await loadSeatStatus();
  await loadConversations();
  await loadStories();
  initWebSocket();
});

const loadUserProfile = async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await fetch(`${backendBase}/user/info`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      currentUserId.value = data.data.id;
    }
  } catch (err) {
    console.error('获取个人信息失败', err);
  }
};

const goBack = () => {
  router.push('/home');
};

const copyClassId = () => {
  navigator.clipboard.writeText(classId.value).then(() => {
    showAlert('成功', '班级号已复制(可用来搜索到这个班级)');
  });
};

const getGenderIcon = (gender) => {
  if (gender === '女') return 'https://cdn.jsdelivr.net/gh/FakeHotdog/classroom-img/girl.png';
  return 'https://cdn.jsdelivr.net/gh/FakeHotdog/classroom-img/boy.png';
}

// -------- 时空教室 --------
const loadSeatStatus = async () => {
  try {
    const res = await fetch(`${backendBase}/api/get_seat_status`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ classId: classId.value })
    });
    const data = await res.json();
    if (data.success) {
      seats.value = data.data;
      mySeatIndex.value = null;
      seats.value.forEach((seat, index) => {
        if (seat.isOccupied && String(seat.userId) === String(currentUserId.value)) {
          mySeatIndex.value = index;
        }
      });
    }
  } catch (err) {
    console.error("加载座位失败", err);
  }
};

// 选择座位
const selectSeat = (index) => {
  const seat = seats.value[index];

  // 如果是已占用的座位，查看对方信息
  if (seat.isOccupied) {
    showUserProfile(seat.userId);
    return;
  }

  // 空座位，选中它
  selectedIndex.value = index;
};

// 入座/换座位
const takeSeat = async () => {
  if (selectedIndex.value === null) return;

  const confirm = await showConfirm(
    '入座',
    mySeatIndex.value === null
      ? `确认要坐在这个座位吗？`
      : `确认要换到这个座位吗？之前的座位会自动离开。`
  );

  if (confirm) {
    try {
      const res = await fetch(`${backendBase}/api/take_seat`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          classId: classId.value,
          seatIndex: selectedIndex.value
        })
      });
      const data = await res.json();
      if (data.success) {
        await loadSeatStatus();
        showAlert('成功', '入座成功');
      } else {
        await showAlert('失败', data.message);
      }
    } catch (err) {
      await showAlert('错误', '请求失败');
    }
  }
  await loadSeatStatus();
  selectedIndex.value = null;
};

const leaveSeat = async () => {
  const confirm = await showConfirm('离开', `确定要离开座位吗？`);
  if (confirm) {
    try {
      const res = await fetch(`${backendBase}/api/leave_seat`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ classId: classId.value })
      });
      const data = await res.json();
      if (data.success) {
        mySeatIndex.value = null;
        await loadSeatStatus();
      }
    } catch (err) { }
  }
}

// -------- 班级私信 --------
const loadConversations = async () => {
  try {
    const res = await fetch(`${backendBase}/api/get_conversations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        classId: classId.value
      })
    });
    const data = await res.json();
    if (data.success) {
      conversations.value = data.data;
      unreadTotal.value = conversations.value.reduce((total, conv) => total + conv.unreadCount, 0);
    }
  } catch (err) {
    console.error("加载会话列表失败", err);
  }
};

const goToChatDetail = (targetUserId) => {
  router.push({
    path: '/ChatDetail',
    query: {
      targetUserId: targetUserId,
      classId: classId.value
    }
  });
};

const formatTime = (timestamp) => {
  const date = new Date(timestamp * 1000);
  return `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// -------- 班级故事 --------
const loadStories = async () => {
  try {
    const res = await fetch(`${backendBase}/api/get_class_stories`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ classId: classId.value, page: storyPage.value })
    });
    const data = await res.json();
    if (data.success) {
      hasMoreStories.value = data.data.length === 10;
      if (storyPage.value === 0) {
        stories.value = data.data;
      } else {
        stories.value.push(...data.data);
      }
      if (data.data.length > 0) {
        storyPage.value++;
      }
    }
  } catch (err) { }
}

const goToPublishStory = () => {
  router.push({
    path: '/PublishStory',
    query: { classId: classId.value }
  })
}

const goToStoryDetail = (story) => {
  router.push({
    path: '/StoryDetail',
    query: {
      storyId: story.id,
      classId: classId.value,
      classOwnerId: classInfo.value.ownerId
    }
  })
}

const deleteStory = async (storyId) => {
  const confirm = await showConfirm('删除', '确认删除这条故事吗？');
  if (confirm) {
    try {
      const res = await fetch(`${backendBase}/api/delete_story`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ classId: classId.value, storyId: storyId })
      });
      const data = await res.json();
      if (data.success) {
        stories.value = stories.value.filter(s => s.id !== storyId);
      } else {
        await showAlert('删除失败', data.message);
      }
    } catch (err) { }
  }
  await loadStories();
}

// -------- 班级管理 --------
const loadClassMembers = async () => {
  try {
    const res = await fetch(`${backendBase}/api/get_class_members`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ classId: classId.value })
    });
    const data = await res.json();
    if (data.success) {
      classInfo.value = data.data;
      members.value = data.data.members;

      // 判断当前用户是不是群主
      isClassOwner.value = String(currentUserId.value) === String(data.data.ownerId);

    } else {
      await showAlert('提示', data.message);
      router.push('/home'); // 没权限查，退出去
    }
  } catch (err) {
    console.error('获取成员失败', err);
  }
}

const kickMember = async (targetId, name) => {
  const confirm = await showConfirm('警告', `确定将 ${name} 请出班级吗？`);
  if (confirm) {
    try {
      const res = await fetch(`${backendBase}/api/kick_member`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ classId: classId.value, targetId: targetId })
      });
      const data = await res.json();
      if (data.success) {
        await loadClassMembers();
      } else {
        await showAlert('失败', data.message);
      }
    } catch (err) { }
  }
}

const quitClass = async () => {
  const confirm = await showConfirm('退出班级', `确定要退出 ${classInfo.value.className} 吗？退出后班级故事等数据将被清除。`);
  if (confirm) {
    try {
      const res = await fetch(`${backendBase}/api/quit_class`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ classId: classId.value })
      });
      const data = await res.json();
      if (data.success) {
        await showAlert('提示', '你已成功退出班级');
        router.push('/home');
      } else {
        await showAlert('失败', data.message);
      }
    } catch (err) { }
  }
}

const viewMemberInfo = async (userId) => {
  await showUserProfile(userId);
};

watch(currentTab, async (newTab) => {
  if (newTab === 'seats') {
    await loadSeatStatus();
  } else if (newTab === 'chat') {
    await loadConversations();
  } else if (newTab === 'story') {
    storyPage.value = 0;
    hasMoreStories.value = true;
    await loadStories();
  } else if (newTab === 'manage') {
    await loadClassMembers();
  }
});

</script>

<style scoped>
.classroom-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
}

.header {
  padding: 15px;
  background: white;
  text-align: center;
  position: relative;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.header h2 {
  margin: 0 0 5px 0;
  font-size: 1.2rem;
}

.class-id {
  font-size: 0.9rem;
  color: #666;
}

.copy-btn {
  margin-left: 10px;
  padding: 2px 8px;
  font-size: 0.8rem;
  border-radius: 4px;
}

.back-btn {
  position: absolute;
  left: 15px;
  top: 15px;
  padding: 4px 10px;
  background: #f0f0f0;
  color: #333;
}

.tab-bar {
  display: flex;
  background: white;
  margin-bottom: 2px;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  font-size: 0.85rem;
  color: #666;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}

.tab-item.active {
  color: #1989fa;
  border-bottom-color: #1989fa;
  font-weight: bold;
}
.tab-icon-wrapper {
  position: relative;
  display: inline-block;
}

.red-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  background-color: #ff4d4f;
  border-radius: 50%;
  border: 2px solid #fff;
}
.tab-icon {
  width: 24px;
  height: 24px;
  margin-bottom: 4px;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

/* 时空教室专属样式 - 100% 还原小程序版本 */
.seats-tab {
  padding: 0 !important;
  background: #fff;
}

.classroom-wrap {
  position: relative;
  width: 100%;
  max-width: 768px;
  /* 可选：电脑端最大宽度，防止超大屏太夸张 */
  margin: 0 auto;
  /* 电脑端居中显示 */
  overflow: hidden;
}

.bg-img {
  width: 100%;
  display: block;
}

.seat-grid {
  position: absolute;
  top: 7%;
  left: 2%;
  right: 2%;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 2vw 1.333vw;
  /* 原7.5px 5px → 375px屏幕下 2vw=7.5px */
}

/* 中间过道效果 - 完全还原 */
.seat-grid .seat-item:nth-child(4n+2) {
  margin-right: 8vw;
  /* 原30px → 375px屏幕下 8vw=30px */
}

.seat-grid .seat-item:nth-child(4n+3) {
  margin-left: 8vw;
}

.seat-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 2;
  height: 37.333vw;
  /* 原140px → 375px屏幕下 37.333vw=140px */
  cursor: pointer;
}

/* 选中状态高亮 */
.seat-item.selected .desk {
  box-shadow: 0 0 2.666vw #d95374;
  /* 原10px → 2.666vw */
  border-radius: 2.133vw;
  /* 原8px → 2.133vw */
}

/* 空课桌：大小居中 */
.desk {
  position: absolute;
  top: 0px;
  width: 20vw;
  /* 原75px → 375px屏幕下 20vw=75px */
  z-index: 1;
}

/* 有人：人物图自带课桌，整体居中，顶部对齐 */
.student {
  position: absolute;
  top: 0px;
  width: 20vw;
  z-index: 1;
}

/* 名字固定占位，永远居中 */
.name-wrap {
  height: 5.333vw;
  /* 原20px → 5.333vw */
  line-height: 5.333vw;
  text-align: center;
  margin-top: 11.333vw;
  /* 原42.5px → 11.333vw */
  z-index: 3;
  width: 20vw;
  max-width: 150px;
  margin-left: auto;
  margin-right: auto;
}

.seat-name {
  font-size: 3.6vw;
  /* 原13.5px → 3.6vw */
  color: #fff;
  background-color: #ff922b;
  padding: 0.533vw 1.6vw;
  /* 原2px 6px → 0.533vw 1.6vw */
  border-radius: 2.666vw;
  /* 原10px → 2.666vw */
  white-space: nowrap;
  overflow: hidden;           /* 隐藏超出部分 */
  text-overflow: ellipsis;   /* 超出显示 ... */
  display: block;            /* 让省略号生效 */
  max-width: 100%;           /* 不超过父容器 */
}

/* 底部按钮：完美居中 */
.seat-btn-bar {
  position: fixed;
  bottom: 8vw;
  /* 原30px → 8vw */
  left: 5%;
  right: 5%;
  max-width: 691px;
  /* 和classroom-wrap的max-width对应：768px * 0.9 */
  margin: 0 auto;
  display: flex;
  justify-content: center;
  gap: 5.333vw;
  /* 原20px → 5.333vw */
  z-index: 99;
}

.btn {
  width: 42%;
  height: 10.666vw;
  /* 原40px → 10.666vw */
  max-height: 48px;
  /* 可选：电脑端按钮最大高度 */
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6.666vw;
  /* 原25px → 6.666vw */
  font-size: 3.733vw;
  /* 原14px → 3.733vw */
  border: 0;
  cursor: pointer;
}

.leave-btn {
  background: #eee;
  color: #333;
}

.sit-btn {
  background: #d95374;
  color: #fff;
}

.btn:disabled {
  background: #ccc !important;
  cursor: not-allowed;
}

/* 电脑端优化：超过768px后停止放大 */
@media (min-width: 768px) {
  .seat-grid {
    gap: 15px 10px;
  }

  .seat-grid .seat-item:nth-child(4n+2) {
    margin-right: 60px;
  }

  .seat-grid .seat-item:nth-child(4n+3) {
    margin-left: 60px;
  }

  .seat-item {
    height: 280px;
  }

  .seat-item.selected .desk {
    box-shadow: 0 0 20px #d95374;
    border-radius: 16px;
  }

  .desk,
  .student {
    width: 150px;
  }

  .name-wrap {
    height: 40px;
    line-height: 40px;
    margin-top: 85px;
  }

  .seat-name {
    font-size: 27px;
    padding: 4px 12px;
    border-radius: 20px;
  }

  .seat-btn-bar {
    bottom: 60px;
    gap: 40px;
  }

  .btn {
    height: 80px;
    border-radius: 50px;
    font-size: 28px;
  }
}

/* --- 故事 --- */
.story-tab {
  padding: 15px;
}

.post-story-btn {
  width: 100%;
  padding: 12px;
  background: #1989fa;
  color: white;
  border-radius: 4px;
  margin-bottom: 15px;
  font-size: 1rem;
}

.story-card {
  background: white;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.story-card.clickable {
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.story-card.clickable:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.story-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  position: relative;
}

.author-avatar {
  width: 40px;
  height: 40px;
  border-radius: 5px;
  margin-right: 10px;
}

.author-name {
  font-weight: bold;
  font-size: 0.95rem;
}

.story-time {
  font-size: 0.8rem;
  color: #999;
}

.delete-story-btn {
  position: absolute;
  right: 0;
  top: 0;
  background: transparent;
  color: #ff4d4f;
  font-size: 0.9rem;
  padding: 5px;
}

.story-title {
  font-size: 1rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 6px;
  line-height: 1.4;
}

.story-body {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.story-text-wrap {
  flex: 1;
}

.story-content {
  font-size: 0.95rem;
  line-height: 1.5;
  color: #333;
  word-break: break-all;
  white-space: pre-wrap;
}

.story-preview {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  position: relative;
}

.preview-img {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  object-fit: cover;
}

.image-count {
  position: absolute;
  bottom: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
}

/* --- 管理 --- */
.manage-tab {
  padding: 15px;
}

.manage-info {
  margin-bottom: 15px;
}

.member-list {
  background: white;
  border-radius: 8px;
  padding: 0 10px;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid #eee;
}

.member-item:last-child {
  border-bottom: none;
}

.member-avatar {
  width: 45px;
  height: 45px;
  border-radius: 5px;
  margin-right: 12px;
}

.member-info {
  flex: 1;
}

.member-name {
  font-size: 1rem;
  font-weight: bold;
  display: flex;
  align-items: center;
}

.owner-tag {
  font-size: 0.7rem;
  background: #ffcc00;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
  font-weight: normal;
}

.member-id {
  font-size: 0.8rem;
  color: #999;
  margin-top: 2px;
}

.member-sig {
  font-size: 0.85rem;
  color: #666;
  margin-top: 4px;
}

.member-actions {
  display: flex;
  gap: 8px;
  /* Add spacing between buttons */
  align-items: center;
}

.info-btn {
  background: white;
  color: #1989fa;
  border: 1px solid #1989fa;
  border-radius: 4px;
  padding: 5px 12px;
  font-size: 0.85rem;
  cursor: pointer;
}

.kick-btn {
  background: white;
  color: #ff4d4f;
  border: 1px solid #ff4d4f;
  border-radius: 4px;
  padding: 5px 12px;
  font-size: 0.85rem;
  cursor: pointer;
}

.chat-btn {
  background: white;
  color: #1989fa;
  border: 1px solid #1989fa;
  border-radius: 4px;
  padding: 5px 12px;
  font-size: 0.85rem;
  cursor: pointer;
}

.danger-zone {
  margin-top: 30px;
  text-align: center;
}

.quit-btn {
  width: 80%;
  background: #ff4d4f;
  color: white;
  padding: 12px;
  border-radius: 20px;
  font-size: 1rem;
}

/* 会话列表样式 */
.conversation-list {
  padding: 0;
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px;
  background: white;
  border-bottom: 1px solid #eee;
  cursor: pointer;
}

.conversation-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
}

.conversation-info {
  flex: 1;
}

.conversation-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.conversation-name {
  font-size: 1rem;
  font-weight: bold;
}

.conversation-time {
  font-size: 0.8rem;
  color: #999;
}

.conversation-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.last-message {
  font-size: 0.9rem;
  color: #666;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-badge {
  min-width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  background: #ff4d4f;
  color: white;
  border-radius: 10px;
  font-size: 0.7rem;
  padding: 0 6px;
}
</style>