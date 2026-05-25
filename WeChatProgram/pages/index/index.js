const app = getApp();
Page({
  data: {
    keyword: '',
    list: [],
    wxUserInfo: {
      avatarUrl: "/images/default-avatar.png",
      avatarUrlLocal: "",
      nickName: "",
      birthday: "",
      desc: ""
    }
  },
  onLoad() {
    // 检查后端是否在线
    this.checkLogin();
    this.loadMyClasses();
    this.loadUserInfo();
  },
  loadUserInfo() {
    let info = wx.getStorageSync("wxUserInfo") || this.data.wxUserInfo;
    if (info.avatarUrl && info.avatarUrl.startsWith('/')) {
      info.avatarUrl = app.globalData.baseUrl + info.avatarUrl;
    }
    this.setData({
      wxUserInfo: info
    });
  },
  checkLogin() {
    let user = wx.getStorageSync('wxUserInfo')
    if (!user || !user.openid) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/login/login'
        })
      }, 1500)
      return;
    }
    
    // Convert relative path to absolute
    if (user.avatarUrl && user.avatarUrl.startsWith('/')) {
      user.avatarUrl = app.globalData.baseUrl + user.avatarUrl;
    }
    
    this.setData({
      wxUserInfo: user
    });
  },

  onInput(e) {
    this.setData({
      keyword: e.detail.value
    })
  },

  // 搜索班级
  searchClass() {
    wx.request({
      url: app.globalData.baseUrl + '/api/search_class',
      method: 'GET',
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('token')
      },
      data: {
        keyword: this.data.keyword
      },
      success: res => {
        this.setData({
          list: res.data.data
        })
      }
    })
  },

  // 加载我的班级
  loadMyClasses() {
    wx.request({
      url: app.globalData.baseUrl + '/api/my_classes',
      method: 'POST',
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('token')
      },
      success: res => {
        this.setData({
          list: res.data.data
        })
      }
    })
  },

  // 进入班级
  enterClass(e) {
    const classId = e.currentTarget.dataset.id;
    // 从列表找到当前班级
    const cls = this.data.list.find(item => item.classId === classId);
    if (!cls) {
      wx.showToast({
        title: '班级不存在',
        icon: 'none'
      });
      return;
    }
    // 若在班级里，直接进
    if (cls.isInClass) {
      wx.navigateTo({
        url: '/pages/classroom/classroom?classId=' + classId
      });
      return;
    }

    // 若班级本身没暗号 → 直接进
    if (!cls.classCode || cls.classCode.trim() === '') {
      wx.navigateTo({
        url: '/pages/classroom/classroom?classId=' + classId
      });
      return;
    }

    // 弹窗输入
    wx.showModal({
      title: '请输入班级暗号',
      editable: true,
      placeholder: '请输入暗号',
      success: (res) => {
        if (!res.confirm) return;
        const inputCode = res.content.trim();
        if (inputCode === cls.classCode) {
          wx.showToast({
            title: '暗号正确'
          });
          wx.request({
            url: app.globalData.baseUrl + '/api/init_class_member',
            method: 'POST',
            header: {
              'Authorization': 'Bearer ' + wx.getStorageSync('token')
            },
            data: {
              classId: classId
            },
            success: (res) => {
              if (res.data.code == 200) {
                wx.navigateTo({
                  url: '/pages/classroom/classroom?classId=' + classId
                });
                this.loadMyClasses();
              } else
                wx.showToast({
                  title: res.data.data.msg,
                  icon: "error"
                });
            },
            fail: () => {
              wx.showToast({
                title: "网络错误",
                icon: "error"
              });
            }
          })
        } else {
          wx.showToast({
            title: '暗号不正确',
            icon: 'none'
          });
        }
      }
    })
  },

  dissolveClass(e) {
    const classId = e.currentTarget.dataset.id

    wx.showModal({
      title: '确认解散',
      content: '解散后班级将永久删除，所有成员将退出，确定吗？',
      success: res => {
        if (!res.confirm) return

        wx.request({
          url: app.globalData.baseUrl + '/api/dissolve_class',
          method: 'POST',
          header: {
            'Authorization': 'Bearer ' + wx.getStorageSync('token')
          },
          data: {
            classId
          },
          success: res => {
            if (res.data.code === 200) {
              wx.showToast({
                title: '解散成功'
              })
              // 强制刷新班级列表
              this.loadMyClasses()
            } else {
              wx.showToast({
                title: res.data.msg,
                icon: 'none'
              })
            }
          }
        })
      }
    })
  },
  goCreate() {
    wx.navigateTo({
      url: '/pages/create-class/create-class'
    });
  },

  goMy() {
    this.loadMyClasses()
  },

  goEditUser() {
    wx.navigateTo({
      url: '/pages/edit/edit'
    })
  }
})