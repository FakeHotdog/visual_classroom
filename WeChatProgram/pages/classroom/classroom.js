const app = getApp();
Page({
  data: {
    classId: "",
    currentTab: 0,
    storyList: [],
    conversationList: [],
    memberList: [],
    socket: null,
    isSocketConnected: false,
    seatList: Array(100).fill({
      isOccupied: false,
      openid: "",
      nickName: "",
      gender: "男"
    }),
    selectedIndex: -1, // 用户选中的座位
    mySeatIndex: -1 // 用户当前座位
  },

  onLoad(options) {
    this.setData({
      classId: options.classId,
      myOpenid: wx.getStorageSync("wxUserInfo").openid,
      myInfo: wx.getStorageSync("wxUserInfo")
    });
    this.loadClassMembers();

    // 监听全局 WebSocket 消息更新会话列表
    app.onClassroomMessageCallback = (payload) => {
      if (payload.type === 'receive_message') {
        if (payload.classId === this.data.classId) {
          this.updateConversationWithNewMessage(payload);
        }
      }
    };
    this.loadAllSeats();
  },
  formatAvatarUrl(url) {
    if (!url) return '/images/default-avatar.png';
    if (url.startsWith('/')) return app.globalData.baseUrl + url;
    return url;
  },

  // 加载班级成员列表
  loadClassMembers() {
    wx.showLoading({
      title: '加载中...'
    });

    wx.request({
      url: app.globalData.baseUrl + '/api/get_class_members',
      method: 'POST',
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('token')
      },
      data: {
        classId: this.data.classId
      },
      success: (res) => {
        if (res.data.code === 200) {
          const classData = res.data.data;
          let memberList = classData.members;

          // 格式化头像路径
          memberList = memberList.map(item => ({
            ...item,
            avatarUrl: this.formatAvatarUrl(item.avatarUrl)
          }));

          this.setData({
            classInfo: classData,
            memberList: memberList,
            isOwner: classData.ownerOpenId === this.data.myOpenid
          });
          
          this.refreshConversationList();
        } else {
          wx.showToast({
            title: res.data.msg,
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },
  // 退出班级
  quitClass() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出这个班级吗？退出后将无法查看班级内容',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '退出中...'
          });

          wx.request({
            url: app.globalData.baseUrl + '/api/quit_class',
            method: 'POST',
            header: {
              'Authorization': 'Bearer ' + wx.getStorageSync('token')
            },
            data: {
              classId: this.data.classId
            },
            success: (res) => {
              if (res.data.code === 200) {
                wx.showToast({
                  title: '退出成功'
                });
                // 返回上一页并刷新我的班级列表
                setTimeout(() => {
                  wx.navigateBack({
                    delta: 1
                  });
                  const pages = getCurrentPages();
                  if (pages.length >= 2) {
                    const prevPage = pages[pages.length - 2];
                    prevPage.loadMyClasses && prevPage.loadMyClasses();
                  }
                }, 1000);
              } else {
                wx.showToast({
                  title: res.data.msg,
                  icon: 'none'
                });
              }
            },
            fail: () => {
              wx.showToast({
                title: '网络错误',
                icon: 'none'
              });
            },
            complete: () => {
              wx.hideLoading();
            }
          });
        }
      }
    });
  },

  // 管理员踢出成员
  kickMember(e) {
    const targetOpenid = e.currentTarget.dataset.openid;
    const targetName = e.currentTarget.dataset.name;

    wx.showModal({
      title: '确认踢出',
      content: `确定要将「${targetName}」踢出班级吗？`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '处理中...'
          });

          wx.request({
            url: app.globalData.baseUrl + '/api/kick_member',
            method: 'POST',
            header: {
              'Authorization': 'Bearer ' + wx.getStorageSync('token')
            },
            data: {
              classId: this.data.classId,
              targetOpenid: targetOpenid
            },
            success: (res) => {
              if (res.data.code === 200) {
                wx.showToast({
                  title: '踢出成功'
                });
                // 刷新成员列表（自动重新下载头像）
                this.loadClassMembers();
              } else {
                wx.showToast({
                  title: res.data.msg,
                  icon: 'none'
                });
              }
            },
            fail: () => {
              wx.showToast({
                title: '网络错误',
                icon: 'none'
              });
            },
            complete: () => {
              wx.hideLoading();
            }
          });
        }
      }
    });
  },

  // 查看成员详情
  viewMemberDetail(e) {
    const openid = e.currentTarget.dataset.openid;
    wx.navigateTo({
      url: `/pages/member-detail/member-detail?openid=${openid}`
    });
  },

  // 加载班级故事列表（自动批量下载作者头像）
  loadClassStories() {
    wx.showLoading({
      title: '加载中...'
    });

    wx.request({
      url: app.globalData.baseUrl + '/api/get_class_stories',
      method: 'POST',
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('token')
      },
      data: {
        classId: this.data.classId
      },
      success: (res) => {
        if (res.data.code === 200) {
          const storyList = res.data.data;
          // 批量获取所有作者信息和头像
          this.batchGetAuthorInfo(storyList, (storyListWithAuthor) => {
            this.setData({
              storyList: storyListWithAuthor
            });
          });
        } else {
          wx.showToast({
            title: res.data.msg,
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },
  // 删除故事
  deleteStory(e) {
    const storyId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个故事吗？删除后无法恢复',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中...'
          });
          wx.request({
            url: app.globalData.baseUrl + '/api/delete_story',
            method: 'POST',
            header: {
              'Authorization': 'Bearer ' + wx.getStorageSync('token')
            },
            data: {
              storyId: storyId
            },
            success: (res) => {
              if (res.data.code === 200) {
                wx.showToast({
                  title: '删除成功'
                });
                this.loadClassStories(); // 自动刷新列表
              } else {
                wx.showToast({
                  title: res.data.msg || '删除失败',
                  icon: 'none'
                });
              }
            },
            fail: () => {
              wx.showToast({
                title: '网络错误',
                icon: 'none'
              });
            },
            complete: () => {
              wx.hideLoading();
            }
          });
        }
      }
    });
  },

  // 批量获取作者信息
  batchGetAuthorInfo(storyList, callback) {
    // 提取所有作者ID并去重
    const authorIds = [...new Set(storyList.map(item => item.authorOpenId))];

    // 并行获取所有作者信息
    const authorPromises = authorIds.map(openid =>
      new Promise((resolve) => {
        wx.request({
          url: app.globalData.baseUrl + '/api/get_user',
          method: 'POST',
          header: {
            'Authorization': 'Bearer ' + wx.getStorageSync('token')
          },
          data: {
            openid: openid
          },
          success: (res) => {
            if (res.data.code === 200) {
              resolve({
                openid: openid,
                nickName: res.data.data.nickName,
                avatarUrl: this.formatAvatarUrl(res.data.data.avatarUrl)
              });
            } else {
              resolve({
                openid: openid,
                nickName: '未知用户',
                avatarUrl: '/images/default-avatar.png'
              });
            }
          },
          fail: () => {
            resolve({
              openid: openid,
              nickName: '未知用户',
              avatarUrl: '/images/default-avatar.png'
            });
          }
        });
      })
    );

    // 等待所有请求完成
    Promise.all(authorPromises).then((authorResults) => {
      const authorMap = {};
      authorResults.forEach(item => {
        authorMap[item.openid] = item;
      });

      const storyListWithAuthor = storyList.map(item => {
        const author = authorMap[item.authorOpenId] || {};
        // 格式化故事图片
        const formattedImages = (item.images || []).map(img => this.formatAvatarUrl(img));
        return {
          ...item,
          images: formattedImages,
          authorName: author.nickName || '未知用户',
          authorAvatar: author.avatarUrl || '/images/default-avatar.png',
          imageCount: item.images ? item.images.length : 0
        }
      });

      callback(storyListWithAuthor);
    });
  },
  
  // 跳转到发布故事页面
  goToPublish() {
    wx.navigateTo({
      url: `/pages/add-story/add-story?classId=${this.data.classId}`
    });
  },

  // 跳转到故事详情页面
  goToStoryDetail(e) {
    const storyId = e.currentTarget.dataset.id;
    wx.navigateTo({
      // 传递班级管理员ID给详情页
      url: `/pages/story-detail/story-detail?storyId=${storyId}&classOwnerOpenId=${this.data.classInfo.ownerOpenId}`
    });
  },

  // 收到新消息时更新会话列表
  updateConversationWithNewMessage(message) {
    const conversationList = [...this.data.conversationList];
    const senderOpenid = message.senderOpenId;

    // 找到对应的会话
    let index = conversationList.findIndex(item => item.openid === senderOpenid);

    if (index !== -1) {
      // 更新现有会话
      conversationList[index].lastMessage = message.content;
      conversationList[index].lastTime = this.formatTime(message.createTime);
      conversationList[index].unreadCount += 1;
      // 移到最前面
      const item = conversationList.splice(index, 1)[0];
      conversationList.unshift(item);
    } else {
      // 新建会话
      const user = this.data.memberList.find(m => m.openid === senderOpenid);
      if (user) {
        conversationList.unshift({
          openid: senderOpenid,
          nickName: user.nickName,
          avatarUrl: user.avatarUrl,
          lastMessage: message.content,
          lastTime: this.formatTime(message.createTime),
          unreadCount: 1
        });
      }
    }

    this.setData({
      conversationList
    });
  },

  // 刷新会话列表
  refreshConversationList() {
    // 从班级成员列表生成初始会话列表
    const memberList = this.data.memberList.filter(m => m.openid !== this.data.myOpenid);
    const conversationList = memberList.map(member => ({
      openid: member.openid,
      nickName: member.nickName,
      avatarUrl: member.avatarUrl,
      lastMessage: '暂无消息',
      lastTime: '',
      unreadCount: 0
    }));

    this.setData({
      conversationList
    });
  },

  // 跳转到聊天详情页
  goToChat(e) {
    const openid = e.currentTarget.dataset.openid;
    const nickName = e.currentTarget.dataset.name;

    // 进入聊天页时清除该会话的未读计数
    const conversationList = [...this.data.conversationList];
    const index = conversationList.findIndex(item => item.openid === openid);
    if (index !== -1) {
      conversationList[index].unreadCount = 0;
      this.setData({
        conversationList
      });
    }

    wx.navigateTo({
      url: `/pages/chat-detail/chat-detail?targetOpenid=${openid}&targetName=${nickName}&classId=${this.data.classId}`
    });
  },

  // 时间格式化工具函数
  formatTime(timeStr) {
    if (!timeStr) return '';
    const date = new Date(timeStr.replace(/-/g, '/'));
    const now = new Date();
    const diff = now - date;

    // 今天
    if (diff < 86400000 && date.getDate() === now.getDate()) {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    // 昨天
    else if (diff < 172800000) {
      return '昨天';
    }
    // 今年
    else if (date.getFullYear() === now.getFullYear()) {
      return `${date.getMonth() + 1}-${date.getDate()}`;
    }
    // 往年
    else {
      return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }
  },

  // 加载所有座位
  loadAllSeats() {
    wx.showLoading({
      title: '加载座位...'
    });
    wx.request({
      url: app.globalData.baseUrl + '/api/get_seat_status',
      method: 'POST',
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('token')
      },
      data: {
        classId: this.data.classId
      },
      success: (res) => {
        if (res.data.code === 200) {
          // 核心：永远初始化100个空座位
          let fullSeatList = Array(100).fill({
            isOccupied: false,
            openid: "",
            nickName: "",
            gender: "男"
          });

          // 把后端返回的有人座位，覆盖到100个空位里
          res.data.data.forEach((item, idx) => {
            if (item.isOccupied) {
              // 性别为空/保密 → 默认男
              item.gender = item.gender || "男";
              fullSeatList[idx] = item;
            }
          });

          this.setData({
            seatList: fullSeatList
          });
          // 找到自己的座位
          const myIdx = fullSeatList.findIndex(s => s.openid === this.data.myOpenid);
          this.setData({
            mySeatIndex: myIdx
          });
        }
      },
      complete: () => wx.hideLoading()
    });
  },

  // 选中座位（仅能选空座）
  selectSeat(e) {
    const idx = e.currentTarget.dataset.index;
    const seat = this.data.seatList[idx];
    if (seat.isOccupied) {
      wx.showToast({
        title: '该座位已有人',
        icon: 'none'
      });
      return;
    }
    this.setData({
      selectedIndex: idx
    });
  },

  // 上座位 / 换座位
  takeSeat() {
    const idx = this.data.selectedIndex;
    if (idx === -1) return;

    wx.showLoading({
      title: '处理中...'
    });
    wx.request({
      url: app.globalData.baseUrl + '/api/take_seat',
      method: 'POST',
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('token')
      },
      data: {
        classId: this.data.classId,
        seatIndex: idx
      },
      success: (res) => {
        if (res.data.code === 200) {
          wx.showToast({
            title: this.data.mySeatIndex === -1 ? '入座成功' : '换座成功'
          });
          this.setData({
            mySeatIndex: idx,
            selectedIndex: -1
          });
          this.loadAllSeats(); // 刷新
        } else {
          wx.showToast({
            title: res.data.msg,
            icon: 'none'
          });
          this.loadAllSeats(); // 被抢占，强制刷新
        }
      },
      complete: () => wx.hideLoading()
    })
  },

  // 下座位
  leaveSeat() {
    const myIdx = this.data.mySeatIndex;
    if (myIdx === -1) return;

    wx.showModal({
      title: '确认下座位',
      content: '确定离开当前座位吗？',
      success: res => {
        if (res.confirm) {
          wx.showLoading({
            title: '处理中...'
          });
          wx.request({
            url: app.globalData.baseUrl + '/api/leave_seat',
            method: 'POST',
            header: {
              'Authorization': 'Bearer ' + wx.getStorageSync('token')
            },
            data: {
              classId: this.data.classId
            },
            success: res => {
              if (res.data.code === 200) {
                wx.showToast({
                  title: '已下座位'
                });
                this.setData({
                  mySeatIndex: -1
                });
                this.loadAllSeats();
              }
            },
            complete: () => wx.hideLoading()
          })
        }
      }
    })
  },

  // 切换Tab
  switchTab(e) {
    this.setData({
      currentTab: parseInt(e.currentTarget.dataset.index)
    });

    if (parseInt(e.currentTarget.dataset.index) === 3) {
      this.loadClassMembers();
    } else if (parseInt(e.currentTarget.dataset.index) === 2) {
      this.loadClassStories();
    } else if (parseInt(e.currentTarget.dataset.index) === 1) {
      this.refreshConversationList();
    } else if (parseInt(e.currentTarget.dataset.index) === 0) {
      this.loadAllSeats();
    }
  },

  onUnload() {
    // 页面销毁时注销回调
    app.onClassroomMessageCallback = null;
  }
});