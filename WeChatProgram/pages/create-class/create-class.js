const app = getApp();
Page({
  data: {
    className: '',
    classCode: '',
    loading: false
  },

  // 输入班级名
  inputName(e) {
    this.setData({ className: e.detail.value })
  },

  // 输入班级暗号
  inputCode(e) {
    this.setData({ classCode: e.detail.value })
  },

  // 创建班级
  createClass() {
    const { className, classCode } = this.data
    if (!className) {
      wx.showToast({ title: '请输入班级名称', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    this.submitCreateClass(className, classCode, false)
  },
  submitCreateClass(className, classCode, force) {
    wx.request({
      url: app.globalData.baseUrl + '/api/create_class',
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') },
      data: {
        className: className,
        classCode: classCode,
        force: force
      },
      success: (res) => {
        if (res.data.code === 200) {
          wx.showToast({ title: '创建成功' })
          wx.navigateBack({ delta: 1 })
          const pages = getCurrentPages()
          if (pages.length >= 2) {
            const prevPage = pages[pages.length - 2]
            prevPage.loadMyClasses()
          }
        } else if (res.data.code === 409) {
          // 同名班级提示，弹出确认框
          wx.showModal({
            title: '提示',
            content: res.data.msg,
            success: (modal) => {
              if (modal.confirm) {
                // 用户确认，强制创建
                this.submitCreateClass(className, classCode, true)
              }
            }
          })
        } else {
          wx.showToast({ title: res.data.msg, icon: 'none' })
        }
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  }
})