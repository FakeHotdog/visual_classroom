const app = getApp();
Page({
  data: {
    openid: "",
    userInfo: {}
  },

  onLoad(options) {
    this.setData({ openid: options.openid });
    this.loadUserDetail();
  },

  formatAvatarUrl(url) {
    if (!url) return '/images/default-avatar.png';
    if (url.startsWith('/')) return app.globalData.baseUrl + url;
    return url;
  },

  // 加载用户详情
  loadUserDetail() {
    wx.showLoading({ title: '加载中...' });
    
    wx.request({
      url: app.globalData.baseUrl + '/api/get_user_public',
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      data: { openid: this.data.openid },
      success: (res) => {
        if (res.data.code === 200) {
          const userInfo = res.data.data;
          userInfo.avatarUrl = this.formatAvatarUrl(userInfo.avatarUrl);
          this.setData({ userInfo });
        } else {
          wx.showToast({ title: res.data.msg || '加载失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  }
});