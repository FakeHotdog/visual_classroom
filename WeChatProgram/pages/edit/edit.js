const app = getApp();

Page({
  data: {
    is_change_avatar: 0,
    userInfo: {
      avatarUrl: "/images/default-avatar.png",
      nickName: "",
      identity: "",
      gender: "",
      birthday: "",
      phone: "",
      currentClass: "",
      signature: "",
      desc: "",
      openid: ""
    },

    // 身份选择
    identityList: ['学生', '教师', '其他'],
    identityIndex: 0,

    // 性别选择
    genderList: ['男', '女', '保密'],
    genderIndex: 2
  },

  onLoad() {
    this.initUserInfo();
  },

  // 初始化：从 wxUserInfo 读取所有信息（统一存储）
  initUserInfo() {
    // 读取唯一的用户信息存储
    const user = wx.getStorageSync('wxUserInfo');

    // 自动匹配身份、性别索引
    let identityIndex = this.data.identityList.indexOf(user.identity);
    if (identityIndex === -1) identityIndex = 0;

    let genderIndex = this.data.genderList.indexOf(user.gender);
    if (genderIndex === -1) genderIndex = 2;

    let displayAvatarUrl = user.avatarUrl || "/images/default-avatar.png";
    if (displayAvatarUrl.startsWith('/')) {
      displayAvatarUrl = app.globalData.baseUrl + displayAvatarUrl;
    }

    // 统一赋值
    this.setData({
      userInfo: {
        avatarUrl: displayAvatarUrl,
        nickName: user.nickName || "",
        identity: user.identity || "",
        gender: user.gender || "",
        birthday: user.birthday || "",
        phone: user.phone || "",
        signature: user.signature || "",
        desc: user.desc || "",
        openid: user.openid
      },
      identityIndex,
      genderIndex
    });
  },

  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const path = res.tempFiles[0].tempFilePath;
        this.setData({ "userInfo.avatarUrl": path,
          is_change_avatar: 1});
      }
    });
  },

  inputNickname(e) {
    this.setData({ "userInfo.nickName": e.detail.value.trim() });
  },

  pickIdentity(e) {
    const idx = e.detail.value;
    this.setData({
      identityIndex: idx,
      "userInfo.identity": this.data.identityList[idx]
    });
  },

  pickGender(e) {
    const idx = e.detail.value;
    this.setData({
      genderIndex: idx,
      "userInfo.gender": this.data.genderList[idx]
    });
  },

  onBirthdayChange(e) {
    this.setData({
      "userInfo.birthday": e.detail.value
    });
  },

  inputPhone(e) {
    const phone = e.detail.value.trim();
    this.setData({ "userInfo.phone": phone });
  },

  inputSignature(e) {
    this.setData({ "userInfo.signature": e.detail.value.trim() });
  },

  inputDesc(e) {
    this.setData({ "userInfo.desc": e.detail.value.trim() });
  },

  saveUserInfo() {
    const { nickName } = this.data.userInfo;
    if (!nickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
  
    wx.showLoading({ title: '保存中...' });
  
    if (this.data.is_change_avatar) {
      // 有新头像：先上传，上传成功后再提交后端
      this.uploadAvatarToServer(this.data.userInfo.avatarUrl, (serverAvatarUrl) => {
        if (!serverAvatarUrl) {
          wx.hideLoading();
          return;
        }
        const newUserInfo = {
          ...this.data.userInfo,
          avatarUrl: serverAvatarUrl
        };
        wx.setStorageSync('wxUserInfo', newUserInfo);
        this.submitToBackend(newUserInfo);
      });
    } else {
      // 没有新头像：直接提交
      wx.setStorageSync('wxUserInfo', this.data.userInfo);
      this.submitToBackend(this.data.userInfo);
    }
  },
  
  uploadAvatarToServer(localFilePath, callback) {
    wx.uploadFile({
      url: app.globalData.baseUrl + '/api/upload_avatar',
      filePath: localFilePath, // 直接传本地临时路径
      name: 'file',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (uploadRes) => {
        const data = JSON.parse(uploadRes.data);
        if (data.code === 200) {
          callback(data.data.url);
        } else {
          wx.showToast({ title: '头像上传失败', icon: 'none' });
          callback('');
        }
      },
      fail: () => {
        wx.showToast({ title: '上传接口错误', icon: 'none' });
        callback('');
      }
    });
  },
  // 抽离提交后端的公共方法
  submitToBackend(userInfo) {
    wx.request({
      url: app.globalData.baseUrl + "/api/update_user",
      method: "POST",
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      data: userInfo,
      success: (res) => {
        if (res.data.code === 200) {
          wx.showToast({ title: "保存成功", icon: "success" });
          
          setTimeout(() => {
            wx.navigateBack({ delta: 1 });
            const pages = getCurrentPages();
            if (pages.length >= 2) {
              const prevPage = pages[pages.length - 2];
              prevPage.loadUserInfo && prevPage.loadUserInfo();
            }
          }, 500);
        } else {
          wx.showToast({ title: res.data.msg || "保存失败", icon: "none" });
        }
      },
      fail: () => {
        wx.showToast({ title: "网络错误", icon: "none" });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  }
});