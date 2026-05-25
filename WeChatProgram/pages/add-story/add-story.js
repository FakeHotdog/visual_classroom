const app = getApp();
Page({
  data: {
    classId: "",
    title: "",
    content: "",
    imageList: []
  },

  onLoad(options) {
    this.setData({ classId: options.classId });
  },

  inputTitle(e) {
    this.setData({ title: e.detail.value.trim() });
  },

  inputContent(e) {
    this.setData({ content: e.detail.value.trim() });
  },

  // 选择图片
  chooseImages() {
    const remaining = 9 - this.data.imageList.length;
    if (remaining <= 0) {
      wx.showToast({ title: '最多只能上传9张图片', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFiles = res.tempFiles.map(item => item.tempFilePath);
        this.setData({
          imageList: [...this.data.imageList, ...tempFiles]
        });
      }
    });
  },

  // 删除图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const imageList = this.data.imageList;
    imageList.splice(index, 1);
    this.setData({ imageList });
  },

  // 发布故事
  publishStory() {
    const { title, content, classId, imageList } = this.data;

    if (!title) {
      wx.showToast({ title: '请输入故事标题', icon: 'none' });
      return;
    }
    if (!content) {
      wx.showToast({ title: '请输入故事内容', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '发布中...' });

    // 第一步：上传所有图片到服务器
    if (imageList.length > 0) {
      this.uploadImages(imageList, (imageUrls) => {
        this.submitStory(imageUrls);
      });
    } else {
      this.submitStory([]);
    }
  },

  // 批量上传图片
  uploadImages(imageList, callback) {
    const uploadPromises = imageList.map(tempPath => 
      new Promise((resolve) => {
        wx.uploadFile({
          url: app.globalData.baseUrl + '/api/upload_avatar', // 复用头像上传接口
          filePath: tempPath,
          name: 'file',
          header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
          success: (uploadRes) => {
            const data = JSON.parse(uploadRes.data);
            if (data.code === 200) {
              resolve(data.data.url);
            } else {
              resolve('');
            }
          },
          fail: () => {
            resolve('');
          }
        });
      })
    );

    Promise.all(uploadPromises).then((imageUrls) => {
      // 过滤掉上传失败的图片
      const validUrls = imageUrls.filter(url => url);
      callback(validUrls);
    });
  },

  // 提交故事到后端
  submitStory(imageUrls) {
    wx.request({
      url: app.globalData.baseUrl + '/api/add_story',
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      data: {
        classId: this.data.classId,
        title: this.data.title,
        content: this.data.content,
        images: imageUrls
      },
      success: (res) => {
        if (res.data.code === 200) {
          wx.showToast({ title: '发布成功' });
          setTimeout(() => {
            wx.navigateBack({ delta: 1 });
            const pages = getCurrentPages();
            if (pages.length >= 2) {
              const prevPage = pages[pages.length - 2];
              prevPage.loadClassStories();
            }
          }, 500);
        } else {
          wx.showToast({ title: res.data.msg || '发布失败', icon: 'none' });
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