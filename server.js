require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve all HTML files from root

// ============================================
// MONGODB CONNECTION
// ============================================
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Error:', err));

// ============================================
// MODELS
// ============================================

// User Model
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher', 'student', 'parent'], required: true },
  phone: { type: String },
  telegramChatId: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// Student Model
const StudentSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  grade: { type: String, required: true },
  dob: { type: String },
  parentName: { type: String },
  parentPhone: { type: String },
  parentTelegramId: { type: String },
  attendance: [{
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['present', 'absent', 'late', 'excused'] },
    teacherNotes: String
  }],
  grades: [{
    subject: String,
    score: Number,
    term: String
  }]
});
const Student = mongoose.model('Student', StudentSchema);

// Message Model
const MessageSchema = new mongoose.Schema({
  sender: { type: String },
  senderName: { type: String },
  recipient: { type: String },
  recipientRole: { type: String },
  content: { type: String, required: true },
  type: { type: String, enum: ['telegram', 'sms'], default: 'telegram' },
  status: { type: String, enum: ['sent', 'delivered', 'failed'], default: 'sent' },
  sentAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// ============================================
// TELEGRAM BOT SERVICE
// ============================================

const sendTelegramMessage = async (chatId, message) => {
  try {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    return response.data;
  } catch (error) {
    console.error('Telegram Error:', error.response?.data || error.message);
    throw error;
  }
};

// ============================================
// API ROUTES
// ============================================

// 📨 SEND MESSAGE
app.post('/api/messages/send', async (req, res) => {
  try {
    const { recipientRole, content, senderName } = req.body;

    let recipients = [];
    if (recipientRole === 'all') {
      recipients = await User.find({ telegramChatId: { $exists: true, $ne: null } });
    } else if (recipientRole) {
      recipients = await User.find({ role: recipientRole, telegramChatId: { $exists: true, $ne: null } });
    }

    if (recipients.length === 0) {
      return res.status(404).json({ error: 'No recipients found with Telegram IDs' });
    }

    const results = [];
    for (const user of recipients) {
      if (user.telegramChatId) {
        const fullMessage = `🏫 <b>ICS Addis</b>\n\n${content}\n\n— ${senderName || 'ICS System'}`;
        await sendTelegramMessage(user.telegramChatId, fullMessage);
        
        await Message.create({
          sender: user._id,
          senderName: senderName || 'System',
          recipient: user.telegramChatId,
          recipientRole: user.role,
          content: fullMessage,
          status: 'delivered'
        });
        results.push({ user: user.name, status: 'sent' });
      }
    }

    res.json({ 
      success: true, 
      message: `Sent to ${results.length} recipients`,
      results 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📊 GET ALL STUDENTS
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📊 GET SINGLE STUDENT
app.get('/api/student/:studentId', async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.params.studentId });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ MARK ATTENDANCE
app.post('/api/attendance', async (req, res) => {
  try {
    const { studentId, status, teacherNotes } = req.body;
    
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    student.attendance.push({
      date: new Date(),
      status,
      teacherNotes
    });
    await student.save();

    // Auto-send SMS if absent
    if (status === 'absent' && student.parentTelegramId) {
      const message = `
❌ <b>Attendance Alert</b>

Student: ${student.name}
Grade: ${student.grade}
Date: ${new Date().toLocaleDateString()}
Status: ABSENT

Please contact the school office if this is an error.
      `;
      
      await sendTelegramMessage(student.parentTelegramId, message);
      
      await Message.create({
        recipient: student.parentTelegramId,
        recipientRole: 'parent',
        content: message,
        status: 'delivered'
      });
    }

    res.json({ 
      success: true, 
      message: `Attendance marked for ${student.name}`,
      student 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📨 GET MESSAGE HISTORY
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ sentAt: -1 }).limit(50);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 👥 GET ALL USERS
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📊 DASHBOARD STATS
app.get('/api/stats', async (req, res) => {
  try {
    const students = await Student.countDocuments();
    const users = await User.countDocuments();
    const messages = await Message.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMessages = await Message.countDocuments({ sentAt: { $gte: today } });
    
    res.json({
      students,
      users,
      messages,
      todayMessages
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SEED DEMO DATA
// ============================================

app.post('/api/seed', async (req, res) => {
  try {
    await User.deleteMany({});
    await Student.deleteMany({});
    await Message.deleteMany({});

    const chatId = process.env.TELEGRAM_CHAT_ID;

    // Create users
    const admin = await User.create({
      name: 'Admin ICS',
      email: 'admin@icsaddis.org',
      password: 'admin123',
      role: 'admin',
      telegramChatId: chatId
    });

    const teacher = await User.create({
      name: 'Mr. Smith',
      email: 'smith@icsaddis.org',
      password: 'teacher123',
      role: 'teacher',
      telegramChatId: chatId
    });

    const parent = await User.create({
      name: 'Parent Doe',
      email: 'parent@example.com',
      password: 'parent123',
      role: 'parent',
      telegramChatId: chatId
    });

    // Create students
    await Student.create({
      studentId: 'ICS-2024-001',
      name: 'James Doe',
      grade: '11A',
      dob: '15 May 2008',
      parentName: 'Parent Doe',
      parentPhone: '+251911111111',
      parentTelegramId: chatId,
      attendance: [
        { date: new Date('2026-06-24'), status: 'present' },
        { date: new Date('2026-06-25'), status: 'absent' },
        { date: new Date('2026-06-26'), status: 'present' }
      ],
      grades: [
        { subject: 'Mathematics', score: 92, term: 'Term 1' },
        { subject: 'English', score: 88, term: 'Term 1' },
        { subject: 'Science', score: 95, term: 'Term 1' }
      ]
    });

    await Student.create({
      studentId: 'ICS-2024-002',
      name: 'Sarah Johnson',
      grade: '5B',
      dob: '20 Mar 2015',
      parentName: 'Mrs. Johnson',
      parentPhone: '+251912222222',
      parentTelegramId: chatId,
      attendance: [
        { date: new Date('2026-06-24'), status: 'present' },
        { date: new Date('2026-06-25'), status: 'present' },
        { date: new Date('2026-06-26'), status: 'late' }
      ],
      grades: [
        { subject: 'Mathematics', score: 78, term: 'Term 1' },
        { subject: 'English', score: 85, term: 'Term 1' }
      ]
    });

    // Sample messages
    await Message.create({
      sender: 'System',
      senderName: 'ICS Admin',
      recipient: chatId,
      recipientRole: 'parent',
      content: '🏫 Welcome to ICS Addis! You will receive important updates here.',
      status: 'delivered'
    });

    res.json({ success: true, message: '✅ Demo data seeded successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 Telegram Bot ready!`);
  console.log(`📊 Visit: http://localhost:${PORT}/index.html`);
});
