require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const USERS_FILE = path.join(__dirname, 'users_data.json');

// Khởi tạo file users nếu chưa tồn tại
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Đăng ký user mới
app.post('/api/register', (req, res) => {
  const { name, email, password, deviceId } = req.body;
  
  if (!name || !email || !password || !deviceId) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đủ thông tin' });
  }
  
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const userExists = users.some(user => user.email === email);
    
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email đã được sử dụng' });
    }
    
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      password, // Lưu ý: Trong thực tế nên hash password
      deviceId,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    
    res.json({ 
      success: true, 
      message: 'Đăng ký thành công! Vui lòng chờ admin duyệt tài khoản'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// Đăng nhập
app.post('/api/login', (req, res) => {
  const { email, password, deviceId } = req.body;
  
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email không tồn tại' });
    }
    
    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'Mật khẩu không đúng' });
    }
    
    if (user.status !== 'approved') {
      return res.status(403).json({ 
        success: false, 
        message: user.status === 'pending' 
          ? 'Tài khoản chưa được duyệt' 
          : 'Tài khoản đã bị từ chối' 
      });
    }
    
    if (user.deviceId !== deviceId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Thiết bị không được phép' 
      });
    }
    
    res.json({ 
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// Lấy danh sách users (cho admin)
app.get('/api/users', (req, res) => {
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const sanitizedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      deviceId: user.deviceId
    }));
    
    res.json(sanitizedUsers);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// Duyệt user (cho admin)
app.put('/api/users/:id/approve', (req, res) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
