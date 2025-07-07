const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const USERS_FILE = 'users_data.json';
const ADMIN = { username: 'admin', password: 'admin123' };

app.use(express.json());
app.use(express.static('public'));

// Đăng nhập
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN.username && password === ADMIN.password) {
    return res.json({ success: true });
  }
  res.json({ success: false, message: 'Sai tài khoản hoặc mật khẩu' });
});

// Lấy danh sách user
app.get('/users', (req, res) => {
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  res.json(users);
});

// Duyệt
app.post('/users/:id/approve', (req, res) => {
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  const user = users.find(u => u.id === req.params.id);
  if (user) {
    user.status = 'approved';
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return res.json({ success: true });
  }
  res.status(404).json({ success: false, message: 'Không tìm thấy user' });
});

// Từ chối
app.post('/users/:id/reject', (req, res) => {
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  const user = users.find(u => u.id === req.params.id);
  if (user) {
    user.status = 'rejected';
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return res.json({ success: true });
  }
  res.status(404).json({ success: false, message: 'Không tìm thấy user' });
});

// Route gốc
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
