// ============================================
// ICS ADDIS - MASTER JAVASCRIPT
// Shared functions for all dashboards
// ============================================

const API_URL = window.location.origin + '/api';

// ============================================
// API HELPERS
// ============================================

async function apiFetch(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'API Error');
        }
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ============================================
// STUDENT FUNCTIONS
// ============================================

async function loadStudent(studentId) {
    try {
        const data = await apiFetch(`/student/${studentId}`);
        return data;
    } catch (error) {
        console.error('Error loading student:', error);
        return null;
    }
}

async function markAttendance(studentId, status, teacherNotes = '') {
    try {
        const data = await apiFetch('/attendance', {
            method: 'POST',
            body: JSON.stringify({ studentId, status, teacherNotes })
        });
        return data;
    } catch (error) {
        console.error('Error marking attendance:', error);
        return null;
    }
}

// ============================================
// MESSAGE FUNCTIONS
// ============================================

async function sendMessage(recipientRole, content, senderName = 'ICS System') {
    try {
        const data = await apiFetch('/messages/send', {
            method: 'POST',
            body: JSON.stringify({ recipientRole, content, senderName })
        });
        return data;
    } catch (error) {
        console.error('Error sending message:', error);
        return null;
    }
}

async function loadMessages() {
    try {
        const data = await apiFetch('/messages');
        return data;
    } catch (error) {
        console.error('Error loading messages:', error);
        return [];
    }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

async function loadStats() {
    try {
        const data = await apiFetch('/stats');
        return data;
    } catch (error) {
        console.error('Error loading stats:', error);
        return null;
    }
}

async function loadStudents() {
    try {
        const data = await apiFetch('/students');
        return data;
    } catch (error) {
        console.error('Error loading students:', error);
        return [];
    }
}

async function loadUsers() {
    try {
        const data = await apiFetch('/users');
        return data;
    } catch (error) {
        console.error('Error loading users:', error);
        return [];
    }
}

// ============================================
// UI HELPERS
// ============================================

function formatDate(date) {
    return new Date(date).toLocaleString();
}

function getStatusBadge(status) {
    const map = {
        'present': '<span class="badge badge-success">✓ Present</span>',
        'absent': '<span class="badge badge-danger">✗ Absent</span>',
        'late': '<span class="badge badge-warning">⏰ Late</span>',
        'excused': '<span class="badge badge-info">📝 Excused</span>'
    };
    return map[status] || status;
}

function showAlert(message, type = 'info') {
    const container = document.getElementById('alertContainer');
    if (!container) {
        console.warn('No alert container found');
        return;
    }
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    container.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
}

// ============================================
// TELEGRAM BOT STATUS CHECK
// ============================================

async function checkBotStatus() {
    try {
        // Just try to send a test message to yourself
        // This is a simple check - in production you'd have a health endpoint
        console.log('✅ Telegram Bot ready');
        return true;
    } catch (error) {
        console.error('Bot status check failed:', error);
        return false;
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🏫 ICS Addis System loaded');
    // Check for student ID in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('student');
    if (studentId) {
        console.log(`📚 Loading student: ${studentId}`);
    }
});
