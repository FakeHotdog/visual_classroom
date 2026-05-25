// ================= 配置中心 =================
// 【1】环境切换：本地测试填 'local'，内网穿透填 'remote'
const ENV = 'remote'; 

// 【2】本地测试地址 (通常不用改)
const LOCAL_URL = 'http://127.0.0.1:8000';

// 【3】内网穿透地址 (每次重新启动 cloudflared，把新域名粘贴到这里)
// ⚠️ 注意：必须是 https 开头，且末尾不要带斜杠 '/'
const REMOTE_URL = 'https://clicking-invited-asbestos-sally.trycloudflare.com';

// === 自动计算地址（你以后不需要管这里） ===
const BASE_URL = ENV === 'local' ? LOCAL_URL : REMOTE_URL;
// 转换：如果是 http:// 则变为 ws:// ，如果是 https:// 则变为 wss://
const WS_URL = BASE_URL.replace('http', 'ws') + '/ws';
// ============================================

App({
  globalData: {
    baseUrl: BASE_URL,
    userInfo: null,
    token: null,
    socketTask: null,
    socketConnected: false,
    reconnectTimer: null
  },
  onLaunch() {
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
      this.connectSocket();
    }
    wx.showLoading({ title: '加载中，请稍候'});
    wx.request({
      url: this.globalData.baseUrl + '/api/test',
      method: 'POST',
      fail: () => {
        wx.hideLoading();
        wx.showModal({
          title: '提示',
          content: `服务器未启动，程序暂时无法使用
如有问题可联系管理员，wx号：
Hotdog19979649760`,
          showCancel: false,
          success: () => {
            wx.exitMiniProgram();
          }
        })
      },
      success: () => {
        wx.hideLoading();
      }
    });
  },

  connectSocket() {
    if (this.globalData.socketConnected || this.globalData.socketTask) return;

    const token = this.globalData.token;
    if (!token) return;

    // 直接使用自动生成的 WS_URL
    const socketTask = wx.connectSocket({
      url: WS_URL,
      success(res) {
        console.log('🌍 [Socket] 请求连接成功:', res);
      }
    });

    this.globalData.socketTask = socketTask;

    // 1. 监听连接打开
    socketTask.onOpen(() => {
      console.log('🟢 [Socket] 底层通道已开启，开始握手鉴权...');
      this.globalData.socketConnected = true;
      this.clearReconnectTimer(); // 清理重连定时器
      
      // 我们在后端要求：第一条消息必须是 action: 'auth'
      this.sendSocketMessage({
        action: 'auth',
        token: token
      });
    });

    // 2. 监听消息接收（重点：总线分发）
    socketTask.onMessage((res) => {
      if (!res.data) return;
      try {
        const payload = JSON.parse(res.data);
        console.log('📩 [Socket] 收到服务器消息:', payload);
        
        // 当收到服务端消息后，可以在这里直接派发到各页面
        // 比如鉴权成功、收到了信件等等
        if (payload.type === 'auth_success') {
           console.log("鉴权成功，随时准备接受私聊消息");
        } else if (payload.type === 'receive_message' || payload.type === 'message_ack') {
           // 利用微信内置的消息订阅机制/或回调
           // 你如果在具体的聊天界面 chat-detail.js 想收到，用如下总线分发：
           // (如果没有 EventEmitter，你也可以写一个简单的 callback 挂在这)
           if (this.onChatMessageCallback) {
              this.onChatMessageCallback(payload);
           }
        }
      } catch (e) {
        console.error('解析推送消息失败', e);
      }
    });

    // 3. 监听断开或失败（自动重连）
    socketTask.onClose((res) => {
      console.log('🔴 [Socket] 意外断开:', res);
      this.globalData.socketConnected = false;
      this.globalData.socketTask = null;
      this.startReconnect(); // 触发重连
    });

    socketTask.onError((err) => {
      console.error('❌ [Socket] 错误触发:', err);
      this.globalData.socketConnected = false;
      this.globalData.socketTask = null;
      // error 后一般也会触发 close，谨慎重复启动重连
    });
  },

  // 提供给页面统一发送消息的方法
  sendSocketMessage(msgObj) {
    if (this.globalData.socketConnected && this.globalData.socketTask) {
      // 带上 token 或者不需要，取决于 action 定义
      // 这里确保数据被转成了 JSON 字符串，原生 wx.socket 只能发字符串/buffer
      this.globalData.socketTask.send({
        data: JSON.stringify(msgObj),
        success() {
          console.log('🚀 [Socket] 消息已投递向服务器:', msgObj);
        }
      });
    } else {
      console.warn('⚠️ [Socket] 当前未连接，不能发送该消息:', msgObj);
      // 可选：存入一个离线队列
    }
  },

  // 简单的断线重连逻辑
  startReconnect() {
    if (this.globalData.reconnectTimer) return; // 已经在重连中
    console.log('🔧 [Socket] 计划于 3 秒后尝试重连...');
    this.globalData.reconnectTimer = setTimeout(() => {
      this.globalData.reconnectTimer = null;
      this.connectSocket();
    }, 3000);
  },

  clearReconnectTimer() {
    if (this.globalData.reconnectTimer) {
      clearTimeout(this.globalData.reconnectTimer);
      this.globalData.reconnectTimer = null;
    }
  }
})