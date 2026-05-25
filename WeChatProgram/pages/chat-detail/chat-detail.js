const app = getApp();
Page({
  data: {
    targetOpenid: "",
    targetName: "",
    classId: "",
    myOpenid: "",
    messageList: [],
    inputContent: "",
    scrollToId: "",
    targetAvatar: ""
  },

  onLoad(options) {
    this.setData({
      targetOpenid: options.targetOpenid,
      targetName: options.targetName,
      classId: options.classId,
      myOpenid: wx.getStorageSync("wxUserInfo").openid
    });

    // 设置页面标题
    wx.setNavigationBarTitle({
      title: this.data.targetName
    });

    // 加载历史聊天记录
    this.loadChatHistory();

    // 监听全局WebSocket消息
    app.onChatMessageCallback = (payload) => {
      if (payload.type === 'receive_message' && payload.senderOpenId === this.data.targetOpenid) {
        this.addMessageToList(payload);
      } else if (payload.type === 'message_ack') {
        console.log("消息发送成功", payload.msgId);
      }
    };
  },

  onUnload() {
    // 移除全局消息监听
    app.onChatMessageCallback = null;
  },

  // 加载历史聊天记录
  loadChatHistory() {
    wx.showLoading({ title: '加载中...' });
    
    wx.request({
      url: app.globalData.baseUrl + '/api/get_chat_history',
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      data: { targetOpenid: this.data.targetOpenid },
      success: (res) => {
        if (res.data.code === 200) {
          const messageList = res.data.data;
          // 补充对方头像信息
          this.addAvatarToMessages(messageList, () => {
            this.setData({ messageList }, () => {
              // 自动滚动到底部
              this.scrollToBottom();
            });
          });
        } else {
          wx.showToast({ title: res.data.msg, icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  formatAvatarUrl(url) {
    if (!url) return '/images/default-avatar.png';
    if (url.startsWith('/')) return app.globalData.baseUrl + url;
    return url;
  },

  // 为消息添加头像信息
  addAvatarToMessages(messageList, callback) {
    // 获取对方头像
    wx.request({
      url: app.globalData.baseUrl + '/api/get_user_public',
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      data: { openid: this.data.targetOpenid },
      success: (res) => {
        if (res.data.code === 200) {
          const targetAvatar = this.formatAvatarUrl(res.data.data.avatarUrl);
          const myAvatar = wx.getStorageSync('wxUserInfo').avatarUrl;

          const messageListWithAvatar = messageList.map(msg => ({
            ...msg,
            avatarUrl: msg.senderOpenId === this.data.myOpenid ? myAvatar : targetAvatar
          }));

          this.setData({
            targetAvatar: targetAvatar
          });

          callback(messageListWithAvatar);
        } else {
          callback(messageList);
        }
      },
      fail: () => {
        callback(messageList);
      }
    });
  },

  // 发送消息
  sendMessage() {
    const content = this.data.inputContent.trim();
    if (!content) return;

    // 乐观更新：立即显示在页面上
    const tempMsg = {
      msgId: 'temp_' + Date.now(),
      senderOpenId: this.data.myOpenid,
      receiverOpenId: this.data.targetOpenid,
      content: content,
      createTime: new Date().toISOString(),
      avatarUrl: wx.getStorageSync('wxUserInfo').avatarUrl
    };

    this.addMessageToList(tempMsg);
    this.setData({ inputContent: '' });

    // 通过全局WebSocket发送消息
    if (app.sendSocketMessage) {
      app.sendSocketMessage({
        action: 'send_message',
        token: wx.getStorageSync('token'),
        receiverOpenId: this.data.targetOpenid,
        content: content,
        classId: this.data.classId
      });
    } else {
      console.warn("全局 WebSocket 未就绪");
    }
  },

  // 添加消息到列表并滚动到底部
  addMessageToList(message) {
    // 补充头像信息
    if (message.senderOpenId === this.data.targetOpenid) {
      message.avatarUrl = this.data.targetAvatar;
    } else {
      message.avatarUrl = wx.getStorageSync('wxUserInfo').avatarUrl;
    }

    const messageList = [...this.data.messageList, message];
    this.setData({ messageList }, () => {
      this.scrollToBottom();
    });
  },

  // 滚动到底部
  scrollToBottom() {
    const lastIndex = this.data.messageList.length - 1;
    if (lastIndex >= 0) {
      this.setData({ scrollToId: `msg-${lastIndex}` });
    }
  },

  // 时间格式化工具函数（复用）
  formatTime(timeStr) {
    if (!timeStr) return '';
    const date = new Date(timeStr.replace(/-/g, '/'));
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
});