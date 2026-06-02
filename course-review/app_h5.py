import os
import sys
import time
import random
import jwt
import uuid
from functools import wraps
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_mail import Mail, Message
from flask_sqlalchemy import SQLAlchemy
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from waitress import serve
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta, timezone
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False
CORS(app)

# ===================== 数据库配置 =====================
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///coursereview.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'connect_args': {'check_same_thread': False},
    'pool_pre_ping': True
}
db = SQLAlchemy(app)

load_dotenv()
# JWT密钥（用于生成登录令牌）
JWT_SECRET = os.getenv('JWT_SECRET') or 'default_jwt_secret_key'
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM') or 'HS256'

# ===================== 数据库模型 =====================
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    nickname = db.Column(db.String(50), default='同学')

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

# ===================== Token正确性检查接口 =====================
@app.route('/user/info', methods=['GET'])
@token_required
def get_user_info(current_user):
    """前端一进页面就调用这个接口，检查Token是否依然有效"""
    return success_response('令牌有效', {
        'id': current_user.id,
        'email': current_user.email,
        'nickname': current_user.nickname
    })

# ===================== 限流配置（防恶意刷接口） =====================
limiter = Limiter(
    get_remote_address,
    app=app,
    storage_uri="memory://"
)

# ===================== 邮箱配置 (QQ邮箱) =====================
app.config['MAIL_SERVER'] = 'smtp.qq.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USE_SSL'] = True
app.config['MAIL_USERNAME'] = os.getenv('QQ_EMAIL')  # 从环境变量获取邮箱账号
app.config['MAIL_PASSWORD'] = os.getenv('AUTH_CODE')  # 从环境变量获取邮箱密码
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('QQ_EMAIL')  # 从环境变量获取默认发件人
mail = Mail(app)
verification_codes = {}
def clean_expired_codes():
    """自动清理所有过期的验证码"""
    current_time = time.time()
    # 先转成列表再遍历，避免遍历过程中字典被修改
    expired_emails = [
        email for email, record in verification_codes.items()
        if current_time > record['expires_at']
    ]
    
    for email in expired_emails:
        del verification_codes[email]
    
    if expired_emails:
        print(f"自动清理了 {len(expired_emails)} 个过期验证码")

# 初始化定时任务调度器
scheduler = BackgroundScheduler(daemon=True)
scheduler.add_job(clean_expired_codes, 'interval', minutes=5)  # 每五分钟执行一次

# ===================== 发送验证码 =====================
@app.route('/send_code', methods=['POST'])
@limiter.limit("5/minute")  # 限制每个IP每分钟最多发送5次验证码
def send_code():
    data = request.json or {}
    email = data.get('email')
    if not email:
        return error_response("邮箱不能为空", 400)
    
    # 验证是否为清华邮箱
    valid_suffixes = {'mails.tsinghua.edu.cn', 'tsinghua.edu.cn', 'mail.tsinghua.edu.cn'}
    if '@' not in email or email.split('@')[1].lower() not in valid_suffixes:
        return error_response("请使用清华大学官方邮箱", 400)
    
    # 防重复发送（1分钟冷却）
    current_time = time.time()
    if email in verification_codes:
        remaining_time = verification_codes[email]['expires_at'] - current_time - 240  # 剩余冷却时间
        if remaining_time > 0:
            return error_response(f"验证码发送过于频繁，请 {int(remaining_time)} 秒后再试", 429)

    # 生成 6 位随机数字验证码
    verify_code = str(random.randint(100000, 999999))
    
    # 存入字典，设置过期时间为 5 分钟 (300秒)
    verification_codes[email] = {
        'code': verify_code,
        'expires_at': time.time() + 300
    }
    
    try: # 发送邮件
        msg = Message(subject="【安全验证】您的验证码",
                      recipients=[email],
                      body=f"您的验证码是：{verify_code}。该验证码在5分钟内有效，请勿泄露给他人。\
                        本网站为清华大学学生自发创建，与学校官方无关。\
所有用户数据严格加密存储，仅用于身份验证，不会向任何第三方泄露。如非本人操作，请忽略此邮件。请尊重本人劳动成果，不要恶意攻击或开盒，感谢您的理解与支持！")
        mail.send(msg)
        return success_response("验证码发送成功")
    except Exception as e:
        print("邮件发送失败:", e)
        return error_response(f"邮件发送失败: {str(e)}", 500)

# ===================== 账号注册 =====================
@app.route('/register', methods=['POST'])
@limiter.limit("5/minute")  # 限制每个IP每分钟最多验证5次
def register():
    data = request.json
    email = data.get('email')
    code = data.get('code')
    username = data.get('username')
    password = data.get('password')
    
    if not email or not code:
        return error_response("邮箱和验证码不能为空", 400)
    
    if not username:
        username = "同学" + uuid.uuid4().hex[:8]  # 生成一个随机昵称，格式为 "同学" + 8位随机字符串

    if not password:
        return error_response("密码不能为空", 400)

    record = verification_codes.get(email)
    
    # 验证码不存在或已过期
    if not record or time.time() > record['expires_at']:
        if email in verification_codes:
            del verification_codes[email]
        return error_response("验证码已过期或不存在，请重新发送", 400)
    
    # 验证输入是否正确
    if record['code'] == str(code):
        del verification_codes[email] # 验证成功后，删除记录防止重复使用
        if db.session.query(User).filter_by(email=email).first():
            return error_response("该邮箱已注册", 400)
        hashed_password = generate_password_hash(password)
        new_user = User(
            email=email, 
            password=hashed_password,
            nickname=username
        )
        db.session.add(new_user)
        db.session.commit()
        return success_response("注册成功")
    else:
        return error_response("验证码错误", 400)

# ===================== 账号登录 =====================
@app.route('/login', methods=['POST'])
@limiter.limit("5/minute")  # 限制每个IP每分钟5次登录尝试
def login():
    data = request.json
    use_password = data.get('use_password', True)  # 是否使用密码登录
    email = data.get('email')
    password = data.get('password', '')
    code = data.get('code', '')
    if not email:
        return error_response("邮箱不能为空", 400)
    user = db.session.query(User).filter_by(email=email).first()
    if not user:
        return error_response("用户不存在", 404)
    if use_password:
        if not password:
            return error_response("密码不能为空", 400)
        if check_password_hash(user.password, password):
            token = jwt.encode({'user_id': user.id, 'exp': datetime.now(timezone.utc) + timedelta(days=7)}, JWT_SECRET, algorithm=JWT_ALGORITHM)
            return success_response("登录成功", {"token": token})
        else:
            return error_response("密码错误", 401)
    else:
        record = verification_codes.get(email)
        if not record or time.time() > record['expires_at']:
            if email in verification_codes:
                del verification_codes[email]
            return error_response("验证码已过期或不存在，请重新发送", 400)
        if record['code'] == str(code):
            del verification_codes[email] # 验证成功后，删除记录防止重复使用
            token = jwt.encode({'user_id': user.id, 'exp': datetime.now(timezone.utc) + timedelta(days=7)}, JWT_SECRET, algorithm=JWT_ALGORITHM)
            return success_response("登录成功", {"token": token})
        else:
            return error_response("验证码错误", 400)

# ===================== 启动服务器 =====================
if __name__ == '__main__':
    scheduler.start()
    print("验证码自动清理任务已启动")

    if len(sys.argv) > 1 and sys.argv[1] == 'debug':
        app.run(host='127.0.0.1', port=5001, debug=True)
    else:
        serve(app, host='0.0.0.0', port=5001, threads=8)
