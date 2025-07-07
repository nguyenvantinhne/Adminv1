const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình
const SECRET_KEY = 'your-secret-key-here'; // Thay bằng key mạnh trong production
const ADMIN_CREDENTIALS_FILE = path.join(__dirname, 'admin_credentials.json');
const USERS_DATA_FILE = path.join(__dirname, 'users_data.json');
const LOGS_FILE = path.join(__dirname, 'admin_actions.log');

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Khởi tạo file nếu chưa tồn tại
function initFiles() {
  if (!fs.existsSync(ADMIN_CREDENTIALS_FILE)) {
    const defaultAdmin = {
      username: 'admin',
      password: bcrypt.hashSync('admin123', 10) // Mật khẩu mặc định, thay đổi sau khi deploy
    };
    fs.writeFileSync(ADMIN_CREDENTIALS_FILE, JSON.stringify(defaultAdmin));
  }

  if (!fs.existsSync(USERS_DATA_FILE)) {
    fs.writeFileSync(USERS_DATA_FILE, JSON.stringify([]));
  }

  if (!fs.existsSync(LOGS_FILE)) {
    fs.writeFileSync(LOGS_FILE, '');
  }
}

initFiles();

// Helper functions
function readAdminCredentials() {
  return JSON.parse(fs.readFileSync(ADMIN_CREDENTIALS_FILE));
}

function readUsers() {
  return JSON.parse(fs.readFileSync(USERS_DATA_FILE));
}

function writeUsers(users) {
  fs.writeFileSync(USERS_DATA_FILE, JSON.stringify(users));
}

function logAction(action, userId, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    userId,
    ...details
  };
  fs.appendFileSync(LOGS_FILE, JSON.stringify(logEntry) + '\n');
}

// Middleware xác thực
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// API Routes
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = readAdminCredentials();

  if (username !== admin.username) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '8h' });
  res.json({ success: true, token, user: { username } });
});

app.post('/admin/verify', authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.get('/admin/users', authenticate, (req, res) => {
  const { status, from, to } = req.query;
  let users = readUsers();

  // Lọc theo trạng thái
  if (status && status !== 'all') {
    users = users.filter(user => user.status === status);
  }

  // Lọc theo ngày
  if (from) {
    const fromDate = new Date(from);
    users = users.filter(user => new Date(user.registerDate) >= fromDate);
  }

  if (to) {
    const toDate = new Date(to);
    users = users.filter(user => new Date(user.registerDate) <= toDate);
  }

  res.json({ success: true, users });
});

app.post('/admin/users/:id/approve', authenticate, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.id == req.params.id);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  user.status = 'approved';
  writeUsers(users);
  logAction('approve', req.params.id, { admin: req.user.username });

  res.json({ success: true });
});

app.post('/admin/users/:id/reject', authenticate, (req, res) => {
  const { reason } = req.body;
  const users = readUsers();
  const user = users.find(u => u.id == req.params.id);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  user.status = 'rejected';
  writeUsers(users);
  logAction('reject', req.params.id, { admin: req.user.username, reason });

  res.json({ success: true });
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin credentials file: ${ADMIN_CREDENTIALS_FILE}`);
  console.log('Initial admin credentials: username=admin, password=admin123');
});
