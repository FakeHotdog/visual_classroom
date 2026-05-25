const app = getApp();
Page({
  data: {
    avatarUrl: '',    // 本地临时头像
    nickName: '',     // 用户姓名
    openid: '',       // 用户ID
    showModal: false,
    modalTitle: '',
    modalContent: ''
  },

  onLoad() {
    this.setData({ avatarUrl: '', nickName: '', openid: '' })
    this.getOpenID();
  },
  getUser(userId) {
    if(!userId) {
      wx.showToast({title: 'ID错误！', icon: 'error'})
    } else { 
      wx.request({
        url: app.globalData.baseUrl + '/api/get_user',
        method: "POST",
        header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
        success: (res) => {
          if(res.data.code == 400) { // 空openid，不会遇到
            wx.showToast({title: '无个人信息！', icon: 'error'})
          } else if(res.data.code == 404) { // 未注册过
            wx.showToast({ title: '请完善注册信息', icon: 'none' })
          } else if(res.data.code == 200) { // 已注册
            const userData = res.data.data;
            userData.openid = userId;
            wx.setStorageSync('wxUserInfo', userData);
            wx.showToast({ title: '登录成功' })
            setTimeout(() => this.switchToIndex(), 1000)
          }
        }
      })
    }
  },

  // 获取微信头像
  onChooseAvatar(e) {
    const tempFilePath = e.detail.avatarUrl;
    this.setData({
      avatarUrl: tempFilePath
    });
  },

  // 输入姓名
  onNicknameInput(e) {
    this.setData({
      nickName: e.detail.value
    });
  },

  // ========== 登录按钮：请求你的后端 ==========
  getOpenID() {
    wx.showLoading({ title: '登录中...' })
    const that = this;
    wx.login({
      success: (res) => {
        wx.request({
          url: app.globalData.baseUrl + '/api/get_openid',
          method: 'POST',
          data: { code: res.code },
          success: (result) => {
            wx.hideLoading();
            // 保存第一步获取到的 Token
            wx.setStorageSync('token', result.data.data.token);
            that.setData({
              openid: result.data.data.openid
            })
            this.getUser(result.data.data.openid);
          },
          fail: () => { // 事实上也不太会发生
            wx.hideLoading();
            wx.showToast({ title: '网络错误', icon: 'none' });
          }
        })
      }
    })
  },

  handleLogin() {
    const { openid, avatarUrl, nickName } = this.data;

    if (!avatarUrl) {
      wx.showToast({ title: '请选择头像', icon: 'none' });
      return;
    }
    if (!nickName.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    // 执行注册 + 登录逻辑
    this.doLogin(openid);
  },

  doLogin(openid) {
    const { nickName, avatarUrl } = this.data;

    wx.showLoading({ title: '保存中...' });

    this.uploadAvatarToServer(avatarUrl, (serverAvatarUrl) => {
      let finalUser = {
        openid: openid,
        nickName: nickName,
        avatarUrl: serverAvatarUrl,
        gender: "",
        birthday: "",
        phone: "",
        signature: "",
        desc: "",
        identity: ""
      };

      wx.request({
        url: app.globalData.baseUrl + '/api/login',
        method: 'POST',
        data: finalUser,
        success: (res) => {
          if (res.data.code === 200) {
            // 登录/注册成功后也要更新最新的 Token
            wx.setStorageSync('token', res.data.data.token);
            wx.setStorageSync('wxUserInfo', finalUser);
            wx.showToast({ title: '登录成功' });
            setTimeout(() => this.switchToIndex(), 1000);
          }
        },
        complete: () => {
          wx.hideLoading();
        }
      });
    });
  },
  
  // 上传头像到服务器（工具方法）
  uploadAvatarToServer(wechatAvatarUrl, callback) {
    wx.uploadFile({
      url: app.globalData.baseUrl + '/api/upload_avatar',
      filePath: wechatAvatarUrl,
      name: 'file',  // 必须和后端一致
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      success: (uploadRes) => {
        let data = JSON.parse(uploadRes.data);
        if (data.code === 200) {
          // 拿到服务器头像地址
          callback(data.data.url);
        } else {
          wx.showToast({ title: '头像上传失败', icon: 'none' });
          callback(''); // 上传失败用空地址
        }
      },
      fail: () => {
        wx.showToast({ title: '上传接口错误', icon: 'none' });
        callback('');
      }
    });
  },

  // 跳转到欢迎首页
  switchToIndex() {
    wx.redirectTo({
      url: '/pages/index/index',
    });
  },

  // 显示用户协议弹窗
  goAgreement() {
    this.setData({
      showModal: true,
      modalTitle: '用户协议',
      modalContent: `欢迎使用同学录小程序！
1. 本小程序仅供班级同学内部使用。
2. 上传的头像、姓名仅用于同学展示。
3. 禁止发布违规、违法、不文明内容。
4. 使用即代表同意本协议。`
    })
  },

  // 显示隐私政策弹窗
  goPrivacy() {
    this.setData({
      showModal: true,
      modalTitle: '隐私政策',
      modalContent: `我们严格保护您的隐私：
1. 仅收集您主动填写的姓名、头像。
2. 数据仅用于班级同学录功能。
3. 绝不会向第三方泄露任何信息。
4. 您可随时修改、删除自己的资料。`
    })
  },
  closeModal() {
    this.setData({ showModal: false })
  }
});