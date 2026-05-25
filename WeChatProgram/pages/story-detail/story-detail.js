const app = getApp();
Page({
  data: {
    storyId: "",
    classOwnerOpenId: "", // 新增：班级管理员ID
    myOpenid: "", // 新增：当前用户ID
    storyInfo: {}
  },

  onLoad(options) {
    this.setData({ 
      storyId: options.storyId,
      classOwnerOpenId: options.classOwnerOpenId, // 接收从classroom传过来的管理员ID
      myOpenid: wx.getStorageSync('wxUserInfo').openid
    });
    this.loadStoryDetail();
  },

  formatAvatarUrl(url) {
    if (!url) return '/images/default-avatar.png';
    if (url.startsWith('/')) return app.globalData.baseUrl + url;
    return url;
  },

  // 加载故事详情
  loadStoryDetail() {
    wx.showLoading({ title: '加载中...' });
    
    wx.request({
      url: app.globalData.baseUrl + '/api/get_story_detail',
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      data: { storyId: this.data.storyId },
      success: (res) => {
        if (res.data.code === 200) {
          const storyInfo = res.data.data;
          storyInfo.authorAvatar = this.formatAvatarUrl(storyInfo.authorAvatar);
          storyInfo.images = (storyInfo.images || []).map(img => this.formatAvatarUrl(img));
          this.setData({ storyInfo });
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

  // 新增：删除故事
  deleteStory() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个故事吗？删除后无法恢复',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          
          wx.request({
            url: app.globalData.baseUrl + '/api/delete_story',
            method: 'POST',
            header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
            data: { storyId: this.data.storyId },
            success: (res) => {
              if (res.data.code === 200) {
                wx.showToast({ title: '删除成功' });
                // 返回上一页并自动刷新列表
                setTimeout(() => {
                  wx.navigateBack({ delta: 1 });
                  const pages = getCurrentPages();
                  if (pages.length >= 2) {
                    const prevPage = pages[pages.length - 2];
                    prevPage.loadClassStories();
                  }
                }, 1000);
              } else {
                wx.showToast({ title: res.data.msg || '删除失败', icon: 'none' });
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
      }
    });
  },

  // 预览图片
  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.storyInfo.images;
    
    wx.previewImage({
      current: images[index],
      urls: images
    });
  }
});