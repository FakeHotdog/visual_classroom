from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import jwt
from datetime import datetime, timedelta, timezone
from sqlalchemy import func
from werkzeug.security import generate_password_hash, check_password_hash
import uuid
import time
import random
import base64
from functools import wraps
import os
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
from captcha.image import ImageCaptcha
from waitress import serve
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import mimetypes
import sys

app = Flask(__name__)
# 配置 JSON 响应在非 ASCII 字符时不进行 unicode 编码，保持正常中文显示
app.config['JSON_AS_ASCII'] = False
CORS(app)

# ===================== 限流配置（防恶意刷接口） =====================
limiter = Limiter(
    get_remote_address,
    app=app,
    storage_uri="memory://"
)

# 自定义限流触发时的返回格式
@app.errorhandler(429)
def ratelimit_handler(e):
    return error_response(f"系统检测到请求过于频繁，请稍后再试", 429)

# 数据库配置（使用SQLite，不需要额外安装数据库）
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///classmate.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'connect_args': {'check_same_thread': False},
    'pool_pre_ping': True
} # SQLite特有配置，允许多线程访问，并自动检测断开连接
mimetypes.add_type('image/jpeg', '.jpg')
mimetypes.add_type('image/jpeg', '.jpeg')
mimetypes.add_type('image/png', '.png')
mimetypes.add_type('image/gif', '.gif')
mimetypes.add_type('image/webp', '.webp')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

db = SQLAlchemy(app)

# JWT密钥（用于生成登录令牌）
load_dotenv()  # 从 .env 文件加载环境变量
JWT_SECRET = os.getenv('JWT_SECRET')  # 使用环境变量存储，切勿硬编码在代码中
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM')

# ===================== 数据库模型 =====================
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    nickname = db.Column(db.String(50), default='同学')
    signature = db.Column(db.String(255), default='这家伙很懒，什么都没留下~')
    avatarUrl = db.Column(db.String(255), default='')
    gender = db.Column(db.String(10), default='')
    birthday = db.Column(db.String(20), default='')
    desc = db.Column(db.String(255), default='')
    phone = db.Column(db.String(20), default='')
    identity = db.Column(db.String(50), default='')

class ClassObj(db.Model):
    __tablename__ = 'classes'
    classId = db.Column(db.String(100), primary_key=True)
    className = db.Column(db.String(100), nullable=False)
    classCode = db.Column(db.String(50))
    ownerId = db.Column(db.Integer, nullable=False)
    members = db.Column(db.Text, nullable=False) # 逗号分隔的 user_id
    memberCount = db.Column(db.Integer, default=1)
    maxMembers = db.Column(db.Integer, default=100)

class ClassStory(db.Model):
    __tablename__ = 'class_stories'
    storyId = db.Column(db.String(100), primary_key=True)
    classId = db.Column(db.String(100), nullable=False)
    authorId = db.Column(db.Integer, nullable=False)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    images = db.Column(db.Text, default='')  # 用逗号分隔的图片URL列表，最多9张
    createTime = db.Column(db.DateTime, default=datetime.now)

class ClassSeat(db.Model):
    __tablename__ = 'class_seats'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    classId = db.Column(db.String(100), nullable=False)
    seatIndex = db.Column(db.Integer, nullable=False)
    userId = db.Column(db.Integer, nullable=False)

class ChatMessage(db.Model):
    __tablename__ = 'chat_messages'
    id = db.Column(db.Integer, primary_key=True)
    classId = db.Column(db.String(100), nullable=False)  # 消息所属的班级ID
    senderId = db.Column(db.Integer, nullable=False)  # 发送者ID
    receiverId = db.Column(db.Integer, nullable=False)  # 新增：接收者ID
    content = db.Column(db.Text, nullable=False)
    createTime = db.Column(db.Integer, nullable=False)  # 时间戳
    type = db.Column(db.String(20), default='text')
    isRead = db.Column(db.Boolean, default=False)  # 新增：是否已读

# 验证码存储 (内存中简单存储)
CAPTCHA_STORE = {}

# 创建数据库表（第一次运行时自动创建）
with app.app_context():
    db.create_all()

# ===================== 统一响应格式 =====================
def success_response(message, data=None):
    return jsonify({"success": True, "message": message, "data": data})

def error_response(message, status_code=200, data=None):
    res = {"success": False, "message": message}
    if data is not None:
        res["data"] = data
    return jsonify(res), status_code

# ===================== 身份鉴权装饰器 =====================
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # 约定前端在 Header 中传入: Authorization: Bearer <token>
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return error_response('未登录或缺少身份令牌', 401)
        
        token = auth_header.split(' ')[1]
        try:
            # 解析和校验 JWT Token
            data = jwt.decode(token, JWT_SECRET, algorithms=JWT_ALGORITHM)
            current_user = db.session.get(User, data['user_id'])
            if not current_user:
                return error_response('用户不存在', 401)
        except jwt.ExpiredSignatureError:
            return error_response('登录已过期，请重新登录', 401)
        except jwt.InvalidTokenError:
            return error_response('无效的身份令牌', 401)
            
        return f(current_user, *args, **kwargs)
    return decorated

# ===================== 验证码接口 =====================
@app.route('/captcha', methods=['GET'])
@limiter.limit("10 per minute") # 限制每个IP每分钟最多获取10次验证码
def get_captcha():
    # 清理过期的验证码
    current_time = time.time()
    expired_keys = [k for k, v in CAPTCHA_STORE.items() if current_time > v['expire']]
    for k in expired_keys:
        del CAPTCHA_STORE[k]

    # 生成4位随机验证码
    chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
    captcha_text = ''.join(random.choices(chars, k=4))
    
    # 将验证码存入字典，有效期 5 分钟
    captcha_id = str(uuid.uuid4())
    CAPTCHA_STORE[captcha_id] = {
        'text': captcha_text.lower(),
        'expire': time.time() + 300
    }
    
    # 生成图片
    image = ImageCaptcha(width=120, height=40)
    data = image.generate(captcha_text)
    
    # 转换为base64
    base64_img = base64.b64encode(data.getvalue()).decode('utf-8')
    image_url = f"data:image/png;base64,{base64_img}"
    
    return success_response('获取验证码成功', {
        'captchaId': captcha_id,
        'captchaImage': image_url
    })

def verify_captcha(captcha_id, captcha_code):
    if not captcha_id or not captcha_code:
        return False
    
    record = CAPTCHA_STORE.get(captcha_id)
    if not record:
        return False
        
    if time.time() > record['expire']:
        del CAPTCHA_STORE[captcha_id]
        return False
        
    if record['text'] != captcha_code.lower():
        return False
        
    # 验证成功后删除，防止重复使用
    del CAPTCHA_STORE[captcha_id]
    return True

# ===================== 登录接口（和你前端完全匹配） =====================
@app.route('/login', methods=['POST'])
@limiter.limit("5 per minute")  # 限制每个IP每分钟最多进行5次登录尝试
def login():
    # 1. 获取前端发送的账号密码
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    captcha_id = data.get('captchaId', '').strip()
    captcha_code = data.get('captchaCode', '').strip()

    # 2. 参数校验
    if not username or not password:
        return error_response('请输入账号和密码')
    if not captcha_code:
        return error_response('请输入验证码')
        
    # 3. 校验验证码
    if not verify_captcha(captcha_id, captcha_code):
        return error_response('验证码错误或已过期')

    # 4. 查询数据库，验证账号密码
    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password, password):
        return error_response('账号或密码错误')

    # 5. 生成JWT令牌（有效期7天，以后做其他接口鉴权用）
    token = jwt.encode({
        'user_id': user.id,
        'username': user.username,
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)

    # 6. 返回登录成功结果和用户信息（前端会存Token和展示昵称）
    return success_response(
        f'欢迎你，{user.nickname}',
        {
            'token': token,
            'username': user.username,
            'nickname': user.nickname
        }
    )

# ===================== 注册接口 =====================
@app.route('/register', methods=['POST'])
@limiter.limit("3 per minute")  # 限制每个IP每分钟最多进行3次注册操作
def register():
    # 1. 获取前端发送的注册信息
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    nickname = data.get('nickname', '').strip()
    captcha_id = data.get('captchaId', '').strip()
    captcha_code = data.get('captchaCode', '').strip()

    # 2. 参数校验
    if not username or not password or not nickname:
        return error_response('请填写所有信息')
    if not captcha_code:
        return error_response('请输入验证码')
        
    # 3. 校验验证码
    if not verify_captcha(captcha_id, captcha_code):
        return error_response('验证码错误或已过期')
    
    if len(username) < 3 or len(username) > 20:
        return error_response('账号长度必须在3-20个字符之间')
    
    if len(password) != 64:
        return error_response('密码格式不正确（请勿篡改请求）')
    
    if len(nickname) < 1 or len(nickname) > 20:
        return error_response('昵称长度必须在1-20个字符之间')

    # 4. 检查用户名是否已经存在
    if User.query.filter_by(username=username).first():
        return error_response('该账号已经被注册')

    # 5. 创建新用户，加密密码
    hashed_password = generate_password_hash(password)
    new_user = User(
        username=username,
        password=hashed_password,
        nickname=nickname
    )
    db.session.add(new_user)
    db.session.commit()

    # 6. 返回注册成功结果
    return success_response('注册成功，请登录')

# ===================== Token正确性检查接口 =====================
@app.route('/user/info', methods=['GET'])
@token_required
def get_user_info(current_user):
    """前端一进页面就调用这个接口，检查Token是否依然有效"""
    return success_response('令牌有效', {
        'id': current_user.id,
        'username': current_user.username,
        'nickname': current_user.nickname,
        'signature': current_user.signature,
        'avatarUrl': current_user.avatarUrl,
        'gender': current_user.gender,
        'birthday': current_user.birthday,
        'desc': current_user.desc,
        'phone': current_user.phone,
        'identity': current_user.identity
    })

# ===================== 用户资料编辑接口 =====================
@app.route('/api/upload_avatar', methods=['POST'])
@token_required
def upload_avatar(current_user):
    if 'file' not in request.files:
        return error_response('没有选择文件')
    file = request.files['file']
    if file.filename == '':
        return error_response('没有选择文件')
    if not allowed_file(file.filename):
        return error_response('不支持的文件类型')
    
    # 查找并删除该用户以前的旧头像文件，防止服务器存储堆积
    prefix = f"avatar_{current_user.id}_"
    for filename in os.listdir(app.config['UPLOAD_FOLDER']):
        if filename.startswith(prefix):
            try:
                os.remove(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            except Exception:
                pass

    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'png'
    new_filename = f"avatar_{current_user.id}_{int(time.time())}.{ext}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], new_filename)
    file.save(filepath)
    
    # 返回可访问的 URL（由于前端后端同域处理，这里可以返回绝对路径）
    url = f"/static/uploads/{new_filename}"
    return success_response('上传成功', {"url": url})

@app.route('/api/update_user', methods=['POST'])
@token_required
def update_user(current_user):
    data = request.get_json()
    if 'nickname' in data:
        current_user.nickname = data.get('nickname', '').strip()
    if 'avatarUrl' in data:
        current_user.avatarUrl = data.get('avatarUrl', '')
    if 'gender' in data:
        current_user.gender = data.get('gender', '')
    if 'birthday' in data:
        current_user.birthday = data.get('birthday', '')
    if 'desc' in data:
        current_user.desc = data.get('desc', '').strip()
    if 'signature' in data:
        current_user.signature = str(data.get('signature', '')).strip()
    if 'phone' in data:
        current_user.phone = str(data.get('phone', '')).strip()
    if 'identity' in data:
        current_user.identity = str(data.get('identity', '')).strip()
        
    db.session.commit()
    return success_response('资料已更新')

# ===================== 搜索班级 =====================
@app.route('/api/search_class', methods=['GET'])
@token_required
def search_class(current_user):
    keyword = request.args.get('keyword', '').strip()
    if not keyword:
        rows = db.session.query(ClassObj, User.nickname).outerjoin(
            User, ClassObj.ownerId == User.id
        ).all()
    else:
        keyword_like = f"%{keyword}%"
        rows = db.session.query(ClassObj, User.nickname).outerjoin(
            User, ClassObj.ownerId == User.id
        ).filter(
            (ClassObj.className.like(keyword_like)) | 
            (User.nickname.like(keyword_like)) |
            (ClassObj.classId.like(keyword_like))
        ).all()
        
    res_list = []
    for c, owner_name in rows:
        owner_name = owner_name if owner_name else "未知"
        members_list = c.members.split(',') if c.members else []
        is_in_class = str(current_user.id) in members_list
        res_list.append({
            "classId": c.classId,
            "className": c.className,
            "ownerName": owner_name,
            "ownerId": c.ownerId,
            "memberCount": c.memberCount,
            "classCode": c.classCode,
            "isInClass": is_in_class
        })
    return success_response('搜索成功', res_list)

@app.route('/api/my_classes', methods=['POST', 'GET'])
@token_required
def my_classes(current_user):
    classes = ClassObj.query.all()
    res_list = []
    for c in classes:
        members_list = c.members.split(',') if c.members else []
        if str(current_user.id) in members_list:
            owner = db.session.get(User, c.ownerId)
            owner_name = owner.nickname if owner else "未知"
            res_list.append({
                "classId": c.classId,
                "className": c.className,
                "ownerName": owner_name,
                "ownerId": c.ownerId,
                "memberCount": c.memberCount,
                "classCode": c.classCode,
                "isInClass": True
            })
    return success_response('获取成功', res_list)

@app.route('/api/create_class', methods=['POST'])
@token_required
def create_class(current_user):
    data = request.get_json()
    className = data.get('className', '').strip()
    classCode = data.get('classCode', '').strip()
    force = data.get('force', False)
    
    if not className:
        return error_response('班级名称不能为空')
        
    create_count = ClassObj.query.filter_by(ownerId=current_user.id).count()
    if create_count >= 5:
        return error_response('每人最多只能创建5个班级')

    my_same_name = ClassObj.query.filter_by(className=className, ownerId=current_user.id).first()
    if my_same_name:
        return error_response('您已创建过同名的班级，不予重复创建')
        
    same_name_count = ClassObj.query.filter_by(className=className).count()
    if same_name_count > 0 and not force:
        return error_response('已有重名的班级存在，确认要继续创建吗？', data={"needConfirm": True})
        
    classId = str(uuid.uuid4())
    new_class = ClassObj(
        classId=classId,
        className=className,
        classCode=classCode,
        ownerId=current_user.id,
        members=str(current_user.id),
        memberCount=1
    )
    db.session.add(new_class)
    db.session.commit()
    return success_response('班级创建成功', {"classId": classId})

@app.route('/api/init_class_member', methods=['POST'])
@token_required
def init_class_member(current_user):
    data = request.get_json()
    classId = data.get('classId', '').strip()
    if not classId:
        return error_response('缺少班级ID')
        
    cls = ClassObj.query.get(classId)
    if not cls:
        return error_response('班级不存在')
        
    members_list = cls.members.split(',') if cls.members else []
    if str(current_user.id) in members_list:
        return success_response('已经在班级中')
        
    if cls.memberCount >= cls.maxMembers:
        return error_response('班级人数已满')
        
    members_list.append(str(current_user.id))
    cls.members = ','.join(members_list)
    cls.memberCount += 1
    db.session.commit()
    return success_response('加入成功')

@app.route('/api/dissolve_class', methods=['POST'])
@token_required
def dissolve_class(current_user):
    data = request.get_json()
    classId = data.get('classId', '').strip()
    cls = ClassObj.query.get(classId)
    if not cls:
        return error_response('班级不存在')
        
    if cls.ownerId != current_user.id:
        return error_response('只有班级创建者可以解散班级')
        
    db.session.delete(cls)
    db.session.commit()
    return success_response('班级已解散')

# ===================== 班级管理：获取班级所有成员信息 =====================
@app.route('/api/get_class_members', methods=['POST'])
@token_required
def get_class_members(current_user):
    data = request.get_json()
    classId = data.get('classId')

    if not classId:
        return error_response('缺少班级ID')

    cls = ClassObj.query.filter_by(classId=classId).first()
    if not cls:
        return error_response('班级不存在')

    members = cls.members.split(",") if cls.members else []
    if str(current_user.id) not in members:
        return error_response('你不在该班级内')

    member_users = User.query.filter(User.id.in_(members)).all()
    
    member_list = []
    for user in member_users:
        member_list.append({
            "id": user.id,
            "nickname": user.nickname,
            "avatarUrl": user.avatarUrl,
            "signature": user.signature,
            "identity": user.identity,
            "isOwner": user.id == cls.ownerId
        })

    return success_response("获取成功", {
        "className": cls.className,
        "ownerId": cls.ownerId,
        "memberCount": cls.memberCount,
        "members": member_list
    })

# ===================== 班级管理：退出与踢出 =====================
@app.route('/api/quit_class', methods=['POST'])
@token_required
def quit_class(current_user):
    data = request.get_json()
    classId = data.get('classId')

    cls = ClassObj.query.filter_by(classId=classId).first()
    if not cls:
        return error_response('班级不存在')

    members = cls.members.split(",") if cls.members else []
    if str(current_user.id) not in members:
        return error_response('你不在该班级内')

    if current_user.id == cls.ownerId:
        return error_response('班级群主无法直接退出，请使用解散班级功能')

    members.remove(str(current_user.id))
    cls.members = ",".join(members)
    cls.memberCount -= 1
    
    # 清理座位
    ClassSeat.query.filter_by(classId=classId, userId=current_user.id).delete()

    db.session.commit()
    return success_response("退出班级成功")

@app.route('/api/kick_member', methods=['POST'])
@token_required
def kick_member(current_user):
    data = request.get_json()
    classId = data.get('classId')
    targetId = str(data.get('targetId'))

    cls = ClassObj.query.filter_by(classId=classId).first()
    if not cls:
        return error_response('班级不存在')

    if current_user.id != cls.ownerId:
        return error_response('没有权限')

    if targetId == str(current_user.id):
        return error_response('不能踢出自己')

    members = cls.members.split(",") if cls.members else []
    if targetId not in members:
        return error_response('该用户不在班级内')

    members.remove(targetId)
    cls.members = ",".join(members)
    cls.memberCount -= 1
    
    ClassSeat.query.filter_by(classId=classId, userId=targetId).delete()

    db.session.commit()
    return success_response("踢出成功")

# ===================== 获取用户公开详情（用于成员查看） =====================
@app.route('/api/get_user_public', methods=['POST'])
@token_required
def get_user_public(current_user):
    data = request.get_json()
    target_id = data.get('userId')
    if not target_id:
        return error_response('缺少用户ID')
        
    user = db.session.get(User, target_id)
    if not user:
        return error_response('用户不存在')
        
    return success_response('获取成功', {
        'id': user.id,
        'nickname': user.nickname,
        'avatarUrl': user.avatarUrl,
        'signature': user.signature,
        'gender': user.gender,
        'phone': user.phone,
        'birthday': user.birthday,
        'desc': user.desc,
        'identity': user.identity
    })

# ===================== 座位管理 =====================
@app.route('/api/get_seat_status', methods=['POST'])
@token_required
def get_seat_status(current_user):
    data = request.get_json()
    classId = data.get('classId')

    seats_db = ClassSeat.query.filter_by(classId=classId).all()
    seat_dict = {seat.seatIndex: seat.userId for seat in seats_db}

    # 查人
    userIds = list(seat_dict.values())
    users = User.query.filter(User.id.in_(userIds)).all()
    user_dict = {u.id: u for u in users}

    seat_list = []
    for i in range(100):
        if i in seat_dict:
            uid = seat_dict[i]
            u = user_dict.get(uid)
            seat_list.append({
                "isOccupied": True,
                "userId": uid,
                "nickname": u.nickname if u else "未知",
                "gender": u.gender if u else "保密"
            })
        else:
            seat_list.append({
                "isOccupied": False,
                "userId": "",
                "nickname": "",
                "gender": ""
            })

    return success_response("获取成功", seat_list)

@app.route('/api/take_seat', methods=['POST'])
@token_required
def take_seat(current_user):
    data = request.get_json()
    classId = data.get('classId')
    seatIndex = int(data.get('seatIndex', -1))

    if not classId or seatIndex < 0 or seatIndex >= 100:
        return error_response("参数错误")

    exist_seat = ClassSeat.query.filter_by(classId=classId, seatIndex=seatIndex).first()
    if exist_seat:
        return error_response("该座位已被占")

    # 去掉老座位
    ClassSeat.query.filter_by(classId=classId, userId=current_user.id).delete()

    new_seat = ClassSeat(classId=classId, seatIndex=seatIndex, userId=current_user.id)
    db.session.add(new_seat)
    db.session.commit()

    return success_response("坐下成功")

@app.route('/api/leave_seat', methods=['POST'])
@token_required
def leave_seat(current_user):
    data = request.get_json()
    classId = data.get('classId')

    ClassSeat.query.filter_by(classId=classId, userId=current_user.id).delete()
    db.session.commit()

    return success_response("离座成功")

# ===================== 班级故事 =====================
@app.route('/api/add_story', methods=['POST'])
@token_required
def add_story(current_user):
    data = request.get_json()
    classId = data.get('classId')
    title = data.get('title', '')
    content = data.get('content', '')
    images = data.get('images', []) # 前端传直接传数组[url1, url2...]
    userId = current_user.id
    
    if not classId or not title or not content:
        return error_response("班级ID、标题和内容不能为空")

    if len(images) > 9:
        return error_response("最多只能上传9张图片")

    cls = ClassObj.query.filter_by(classId=classId).first()
    if not cls:
        return error_response("班级不存在")
        
    members = cls.members.split(",") if cls.members else []
    if str(userId) not in members:
        return error_response("不在该班级中，无权发布故事")

    story_id = str(uuid.uuid4())
    images_str = ",".join(images) if images else ""

    new_story = ClassStory(
        storyId=story_id,
        classId=classId,
        title=title,
        content=content,
        images=images_str,
        authorId=userId
    )
    db.session.add(new_story)
    db.session.commit()

    return success_response("故事发布成功", {"storyId": story_id})

# ===================== 新增：故事图片上传接口 =====================
@app.route('/api/upload_story_image', methods=['POST'])
@token_required
def upload_story_image(current_user):
    if 'file' not in request.files:
        return error_response('没有选择文件')
    file = request.files['file']
    if file.filename == '':
        return error_response('没有选择文件')
    if not allowed_file(file.filename):
        return error_response('不支持的文件类型')
    
    # 使用不同的文件名前缀，和头像区分开
    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'png'
    new_filename = f"story_{current_user.id}_{uuid.uuid4().hex[:8]}_{int(time.time())}.{ext}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], new_filename)
    file.save(filepath)
    
    url = f"/static/uploads/{new_filename}"
    return success_response('上传成功', {"url": url})

@app.route('/api/get_class_stories', methods=['POST'])
@token_required
def get_class_stories(current_user):
    data = request.get_json()
    classId = data.get('classId')
    userId = current_user.id
    
    # 获取分页参数（前端page从0开始，默认第0页）
    page = int(data.get('page', 0))
    page_size = 10  # 每页10条，和前端保持一致
    skip = page * page_size  # 计算需要跳过的条数

    if not classId:
        return error_response("参数错误")

    cls = ClassObj.query.filter_by(classId=classId).first()
    if not cls:
        return error_response("班级不存在")
        
    members = cls.members.split(",") if cls.members else []
    if str(userId) not in members:
        return error_response("不在该班级中，无权查看故事")

    # 添加分页查询（先排序，再offset，最后limit）
    stories = ClassStory.query.filter_by(classId=classId)\
                              .order_by(ClassStory.createTime.desc())\
                              .offset(skip)\
                              .limit(page_size)\
                              .all()
    
    author_ids = list(set([s.authorId for s in stories]))
    authors = User.query.filter(User.id.in_(author_ids)).all()
    author_dict = {a.id: a for a in authors}
    
    result = []
    for s in stories:
        author = author_dict.get(s.authorId)
        image_count = len(s.images.split(",")) if s.images else 0
        if image_count == 1 and s.images == "":
            image_count = 0
            
        result.append({
            "id": s.storyId,
            "authorId": s.authorId,
            "authorAvatar": author.avatarUrl if author else "/static/default_avatar.png",
            "authorName": author.nickname if author else "未知",
            "title": s.title,
            "content": s.content if len(s.content) <= 50 else s.content[:48] + "...",
            "createTimeFormatted": s.createTime.strftime("%Y-%m-%d %H:%M"),
            "images": s.images.split(",")[:1] if s.images else [],
            "imageCount": image_count
        })

    return success_response("获取成功", result)

@app.route('/api/delete_story', methods=['POST'])
@token_required
def delete_story(current_user):
    data = request.get_json()
    storyId = data.get('storyId')
    userId = current_user.id

    if not storyId:
        return error_response("缺少故事ID")

    story = ClassStory.query.filter_by(storyId=storyId).first()
    if not story:
        return error_response("故事不存在")

    # 权限校验：只有作者本人或班级管理员能删除
    cls = ClassObj.query.filter_by(classId=story.classId).first()
    if userId != story.authorId and userId != cls.ownerId:
        return error_response("无权限删除该故事")

    # 自动删除故事关联的所有图片
    if story.images and story.images.strip():
        # 先过滤掉空字符串和空白字符
        image_urls = [img.strip() for img in story.images.split(",") if img.strip()]
    
        for img_url in image_urls:
            if "/static/uploads/" in img_url:
                # 从URL中提取文件名
                filename = img_url.split("/static/uploads/", 1)[1]
                # 拼接成服务器本地完整路径
                local_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
                try:
                    if os.path.exists(local_path) and os.path.isfile(local_path):
                        os.remove(local_path)
                except OSError as e:
                    pass
                
    db.session.delete(story)
    db.session.commit()
    return success_response("删除成功")

@app.route('/api/get_story_detail', methods=['POST'])
@token_required
def get_story_detail(current_user):
    data = request.get_json()
    storyId = data.get('storyId')
    userId = current_user.id
    
    if not storyId:
        return error_response("缺少故事ID")

    story = ClassStory.query.filter_by(storyId=storyId).first()
    if not story:
        return error_response("故事不存在")

    cls = ClassObj.query.filter_by(classId=story.classId).first()
    if not cls:
        return error_response("班级不存在")

    members = cls.members.split(",") if cls.members else []
    if str(userId) not in members:
        return error_response("无权查看该故事")
    
    author = User.query.filter_by(id=story.authorId).first()
    
    info = {
        "storyId": story.storyId,
        "classId": story.classId,
        "authorId": story.authorId,
        "authorName": author.nickname if author else "未知用户",
        "authorAvatar": author.avatarUrl if author else "",
        "title": story.title,
        "content": story.content,
        "images": story.images.split(",") if story.images else [],
        "createTimeFormatted": story.createTime.strftime("%Y-%m-%d %H:%M:%S"),
        "canDelete": story.authorId == current_user.id or cls.ownerId == current_user.id
    }
    
    return success_response("获取成功", info)

# 1. 获取班级内的所有会话列表（每个成员一条，包含最后消息和未读数量）
@app.route('/api/get_conversations', methods=['POST'])
@token_required
def get_conversations(current_user):
    data = request.get_json()
    classId = data.get('classId')
    userId = current_user.id

    if not classId:
        return error_response("缺少班级ID")

    # 查询班级信息，获取所有成员ID
    cls = ClassObj.query.get(classId)
    if not cls:
        return error_response("班级不存在")
    
    # 解析成员ID列表
    all_member_ids = [int(id_str) for id_str in cls.members.split(',') if id_str.strip()]
    
    # 查询所有聊天记录
    all_messages = ChatMessage.query.filter(
        ChatMessage.classId == classId,
        (ChatMessage.senderId == userId) | (ChatMessage.receiverId == userId)
    ).order_by(ChatMessage.createTime.desc()).all()

    # 每个用户只保留最新一条消息
    conversation_map = {}
    for msg in all_messages:
        other_id = msg.receiverId if msg.senderId == userId else msg.senderId
        if other_id not in conversation_map:
            conversation_map[other_id] = msg

    # 统计未读数量
    unread_data = db.session.query(
        ChatMessage.senderId,
        func.count(ChatMessage.id)
    ).filter(
        ChatMessage.classId == classId,
        ChatMessage.receiverId == userId,
        ChatMessage.isRead == False
    ).group_by(ChatMessage.senderId).all()
    unread_dict = {uid: cnt for uid, cnt in unread_data}

    # ========== 第四步：批量获取所有成员的用户信息 ==========
    users = User.query.filter(User.id.in_(all_member_ids)).all()
    user_dict = {u.id: u for u in users}

    # ========== 第五步：遍历所有成员生成结果（核心改动） ==========
    result = []
    for id in all_member_ids:
        u = user_dict.get(id)
        latest_msg = conversation_map.get(id)
        
        result.append({
            "userId": id,
            "nickname": u.nickname if u else "未知",
            "avatarUrl": u.avatarUrl if u else "",
            # 有聊天记录显示最后一条消息，没有显示"暂无消息"
            "lastMessage": latest_msg.content if latest_msg else "暂无消息",
            # 有聊天记录显示时间，没有显示0
            "lastTime": latest_msg.createTime if latest_msg else 0,
            # 未读数量
            "unreadCount": unread_dict.get(id, 0)
        })

    # 有消息的排在前面，没消息的排在后面
    result.sort(key=lambda x: x["lastTime"], reverse=True)

    return success_response("获取成功", result)

# 2. 获取与指定用户的聊天历史
@app.route('/api/get_chat_history', methods=['POST'])
@token_required
def get_chat_history(current_user):
    data = request.get_json()
    targetUserId = data.get('targetUserId')
    classId = data.get('classId')  # 必须传班级ID
    page = data.get('page', 0)
    page_size = 20
    
    if not targetUserId:
        return error_response("缺少用户ID")
    
    if not classId:
        return error_response("缺少班级ID")
    
    # 查询我和对方的所有消息
    msgs = ChatMessage.query.filter(
        ChatMessage.classId == classId,
        ((ChatMessage.senderId == current_user.id) & (ChatMessage.receiverId == targetUserId)) |
        ((ChatMessage.senderId == targetUserId) & (ChatMessage.receiverId == current_user.id))
    ).order_by(ChatMessage.createTime.desc()).offset(page * page_size).limit(page_size).all()
    
    # 标记对方发来的消息为已读
    ChatMessage.query.filter(
        ChatMessage.classId == classId,
        ChatMessage.senderId == targetUserId,
        ChatMessage.receiverId == current_user.id,
        ChatMessage.isRead == False
    ).update({"isRead": True})
    db.session.commit()
    
    # 组装结果
    result = []
    for m in msgs:
        result.append({
            "id": m.id,
            "senderId": m.senderId,
            "content": m.content,
            "createTime": m.createTime,
            "isOwner": m.senderId == current_user.id
        })
    
    result.reverse()  # 旧消息在前
    return success_response("获取成功", result)

# 3. 发送消息（前端直接调用这个接口，替代原来WebSocket的发送逻辑）
@app.route('/api/send_message', methods=['POST'])
@token_required
def send_message(current_user):
    data = request.get_json()
    receiver_id = data.get('receiverId')
    content = data.get('content', '').strip()
    classId = data.get('classId')
    
    if not receiver_id or not content or not classId:
        return error_response("缺少必要参数")
    
    # 保存消息到数据库（和原来WebSocket的逻辑完全一样）
    new_msg = ChatMessage(
        senderId=current_user.id,
        receiverId=receiver_id,
        classId=classId,
        content=content,
        createTime=int(time.time()),
        type='text',
        isRead=False
    )
    db.session.add(new_msg)
    db.session.commit()
    
    # 返回消息信息，前端直接显示
    return success_response("发送成功", {
        "id": new_msg.id,
        "senderId": current_user.id,
        "content": content,
        "createTime": new_msg.createTime,
        "isOwner": True
    })

# 4. 拉取新消息（轮询专用接口）
@app.route('/api/pull_new_messages', methods=['POST'])
@token_required
def pull_new_messages(current_user):
    data = request.get_json()
    targetUserId = data.get('targetUserId')
    classId = data.get('classId')
    lastMessageId = data.get('lastMessageId', 0)  # 前端传最后一条已收到的消息ID
    
    if not targetUserId or not classId:
        return error_response("缺少必要参数")
    
    # 查询比lastMessageId大的所有新消息
    new_messages = ChatMessage.query.filter(
        ChatMessage.classId == classId,
        ChatMessage.senderId == targetUserId,
        ChatMessage.receiverId == current_user.id,
        ChatMessage.id > lastMessageId
    ).order_by(ChatMessage.createTime.asc()).all()
    
    # 标记这些消息为已读
    if new_messages:
        ChatMessage.query.filter(
            ChatMessage.id.in_([msg.id for msg in new_messages])
        ).update({"isRead": True}, synchronize_session=False)
        db.session.commit()
    
    # 组装结果
    result = []
    for m in new_messages:
        result.append({
            "id": m.id,
            "senderId": m.senderId,
            "content": m.content,
            "createTime": m.createTime,
            "isOwner": False
        })
    
    return success_response("获取成功", result)

# ===================== 数据库维护核心函数 =====================
def database_maintenance():
    """每周执行一次数据库维护"""
    with app.app_context():
        try:
            # 1. 删除14天以上的私聊消息
            fourteen_days_ago = datetime.now() - timedelta(days=14)
            fourteen_days_ago_ts = int(fourteen_days_ago.timestamp())
            old_chat_count = ChatMessage.query.filter(ChatMessage.createTime < fourteen_days_ago_ts).delete()
            
            # 2. 删除三个月以上的班级故事（同时删除关联图片）
            three_months_ago = datetime.now() - timedelta(days=90)
            old_stories = ClassStory.query.filter(ClassStory.createTime < three_months_ago).all()
            old_story_count = len(old_stories)
            # 先删除故事关联的图片文件
            for story in old_stories:
                if story.images and story.images.strip():
                    image_urls = [img.strip() for img in story.images.split(",") if img.strip()]
                    for img_url in image_urls:
                        if "/static/uploads/" in img_url:
                            filename = img_url.split("/static/uploads/", 1)[1]
                            local_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                            try:
                                if os.path.exists(local_path) and os.path.isfile(local_path):
                                    os.remove(local_path)
                            except Exception as e:
                                pass
            # 删除故事数据
            ClassStory.query.filter(ClassStory.createTime < three_months_ago).delete()

            # 清理1年以上未登录的账户牵扯太多，暂且不做。
            db.session.commit()
            
            # 打印维护日志
            log_msg = (
                f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 数据库维护完成：\n"
                f"  - 删除14天以上私聊消息: {old_chat_count} 条\n"
                f"  - 删除3个月以上班级故事: {old_story_count} 条\n"
            )
            print(log_msg, file=sys.stdout)
            
        except Exception as e:
            db.session.rollback()
            error_msg = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 数据库维护失败: {str(e)}"
            print(error_msg, file=sys.stderr)

# ===================== 配置定时任务 =====================
def init_scheduler():
    """初始化定时任务"""
    # 创建后台调度器
    scheduler = BackgroundScheduler(timezone='Asia/Shanghai')
    
    # 添加每周日凌晨2点执行的维护任务
    scheduler.add_job(
        database_maintenance,
        trigger=CronTrigger(day_of_week=0, hour=2, minute=0),  # 每周日 02:00
        id='database_maintenance',
        replace_existing=True
    )
    
    # 启动调度器
    try:
        scheduler.start()
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 定时任务已启动，每周日凌晨2点执行数据库维护", file=sys.stdout)
    except Exception as e:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 定时任务启动失败: {e}", file=sys.stderr)
        # 非阻塞启动失败时，降级为应用启动时执行一次
        database_maintenance()

# ========== 初始化定时任务 ==========
init_scheduler()

# ===================== 前端资源路由（将dist目录作为静态文件根目录） =====================
@app.route('/')
def index():
    return send_from_directory('dist', 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory('dist', path)

# ===================== 启动服务器 =====================
if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'prod':
        serve(app, host='0.0.0.0', port=5000, threads=8)
    else:
        app.run(host='0.0.0.0', port=5000, debug=True)
