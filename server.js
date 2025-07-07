require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const USERS_FILE = path.join(__dirname, 'users_data.json');
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your_very_strong_secret_here';
const TOKEN_EXPIRY = '24h';

// Default admin credentials
const ADMIN = {
  username: 'mrtinhios',
  password: '$2a$10$N9qo8uLOickgx2ZMRZoMy.MQRqQz6W7WnD6Yw.Yz7Oj6dQ8b0lB1O' // hashed 'vantinh597'
};

// Initialize users file if not exists
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Middleware to verify JWT
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

// Admin login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (username !== ADMIN.username) {
    return res.status(401).json({ success: false, message: 'Sai tài khoản hoặc mật khẩu' });
  }
  
  try {
    const passwordMatch = await bcrypt.compare(password, ADMIN.password);
    
    if (passwordMatch) {
      const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
      return res.json({ success: true, token });
    }
    
    res.status(401).json({ success: false, message: 'Sai tài khoản hoặc mật khẩu' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// User registration
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đủ thông tin' });
  }
  
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const userExists = users.some(user => user.email === email);
    
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email đã được sử dụng' });
    }
    
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      password: hashedPassword,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    
    res.json({ 
      success: true, 
      message: 'Đăng ký thành công! Vui lòng chờ admin duyệt tài khoản',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        status: newUser.status
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// User login
app.post('/api/user-login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email không tồn tại' });
    }
    
    if (user.status !== 'approved') {
      return res.status(403).json({ 
        success: false, 
        message: user.status === 'pending' 
          ? 'Tài khoản chưa được duyệt' 
          : 'Tài khoản đã bị từ chối' 
      });
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (passwordMatch) {
      const token = jwt.sign({ 
        userId: user.id, 
        email: user.email, 
        role: 'user' 
      }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
      
      return res.json({ 
        success: true, 
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    }
    
    res.status(401).json({ success: false, message: 'Mật khẩu không đúng' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// Get all users (admin only)
app.get('/api/users', authenticateJWT, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.sendStatus(403);
  }
  
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const sanitizedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt
    }));
    
    res.json(sanitizedUsers);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// Approve user (admin only)
app.put('/api/users/:id/approve', authenticateJWT, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.sendStatus(403);
  }
  
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const userIndex = users.findIndex(u => u.id === req.params.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    }
    
    users[userIndex].status = 'approved';
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    
    res.json({ 
      success: true,
      user: {
        id: users[userIndex].id,
        name: users[userIndex].name,
        email: users[userIndex].email,
        status: users[userIndex].status
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// Reject user (admin only)
app.put('/api/users/:id/reject', authenticateJWT, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.sendStatus(403);
  }
  
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const userIndex = users.findIndex(u => u.id === req.params.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    }
    
    users[userIndex].status = 'rejected';
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    
    res.json({ 
      success: true,
      user: {
        id: users[userIndex].id,
        name: users[userIndex].name,
        email: users[userIndex].email,
        status: users[userIndex].status
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
