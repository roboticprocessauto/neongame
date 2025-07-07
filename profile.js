// ===== ИНИЦИАЛИЗАЦИЯ FIREBASE =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getDatabase, 
    ref as dbRef, 
    get as dbGet, 
    update as dbUpdate,
    push as dbPush,
    set as dbSet
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const app = initializeApp(window.firebaseConfig);
const database = getDatabase(app);

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let currentUser = null;
let userBets = [];

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadProfileData();
    loadUserBetsHistory();
});

function checkAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (!savedUser) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = JSON.parse(savedUser);
    updateUserInfo();
    displayProfileInfo();
    
    // Показать админ/модератор ссылки в меню
    if (currentUser.role === "admin") {
        document.getElementById("admin-link").style.display = "block";
    } else if (currentUser.role === "moderator") {
        document.getElementById("moderator-link").style.display = "block";
    }
    }
}

function updateUserInfo() {
    if (!currentUser) return;
    
    document.getElementById('user-balance').textContent = `${currentUser.balance.toLocaleString()} лупанчиков`;
    document.getElementById('username').textContent = currentUser.username;
}

// ===== ОТОБРАЖЕНИЕ ИНФОРМАЦИИ О ПРОФИЛЕ =====
function displayProfileInfo() {
    if (!currentUser) return;
    
    document.getElementById('profile-username').textContent = currentUser.username;
    document.getElementById('profile-role').textContent = getRoleName(currentUser.role);
    document.getElementById('profile-balance').textContent = `${currentUser.balance.toLocaleString()} лупанчиков`;
    document.getElementById('profile-bet-limit').textContent = `${(currentUser.betLimit || 1000).toLocaleString()} лупанчиков`;
    
    if (currentUser.registeredAt) {
        const regDate = new Date(currentUser.registeredAt).toLocaleDateString();
        document.getElementById('profile-registered').textContent = regDate;
    } else {
        document.getElementById('profile-registered').textContent = 'Неизвестно';
    }
    
    document.getElementById('profile-status').textContent = currentUser.status === 'active' ? 'Активен' : 'Заблокирован';
}

function getRoleName(role) {
    const roles = {
        'admin': 'Администратор',
        'moderator': 'Модератор',
        'user': 'Пользователь'
    };
    return roles[role] || 'Пользователь';
}

// ===== ЗАГРУЗКА ДАННЫХ ПРОФИЛЯ =====
async function loadProfileData() {
    try {
        // Обновить данные пользователя из базы
        const userRef = dbRef(database, `users/${currentUser.username}`);
        const snapshot = await dbGet(userRef);
        
        if (snapshot.exists()) {
            const userData = snapshot.val();
            currentUser = {
                username: currentUser.username,
                ...userData
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateUserInfo();
            displayProfileInfo();
        }
    } catch (error) {
        console.error('Ошибка загрузки данных профиля:', error);
    }
}

// ===== ЗАГРУЗКА ИСТОРИИ СТАВОК =====
async function loadUserBetsHistory() {
    try {
        const betsRef = dbRef(database, 'bets');
        const snapshot = await dbGet(betsRef);
        
        if (snapshot.exists()) {
            const allBets = snapshot.val();
            userBets = Object.entries(allBets)
                .filter(([betId, bet]) => bet.user === currentUser.username)
                .map(([betId, bet]) => ({ id: betId, ...bet }))
                .sort((a, b) => b.timestamp - a.timestamp);
            
            displayProfileStats();
        } else {
            userBets = [];
            displayProfileStats();
        }
    } catch (error) {
        console.error('Ошибка загрузки истории ставок:', error);
    }
}

// ===== ОТОБРАЖЕНИЕ СТАТИСТИКИ =====
function displayProfileStats() {
    const statsContainer = document.getElementById('profile-stats');
    
    const totalBets = userBets.length;
    const wonBets = userBets.filter(bet => bet.status === 'won').length;
    const lostBets = userBets.filter(bet => bet.status === 'lost').length;
    const pendingBets = userBets.filter(bet => bet.status === 'pending').length;
    
    const totalStaked = userBets.reduce((sum, bet) => sum + bet.amount, 0);
    const totalWon = userBets
        .filter(bet => bet.status === 'won')
        .reduce((sum, bet) => sum + (bet.winAmount || bet.amount * bet.coefficient), 0);
    
    const winRate = (wonBets + lostBets) > 0 ? ((wonBets / (wonBets + lostBets)) * 100).toFixed(1) : 0;
    const profit = totalWon - totalStaked;
    const avgBet = totalBets > 0 ? (totalStaked / totalBets).toFixed(0) : 0;
    
    statsContainer.innerHTML = `
        <div class="profile-stat-card">
            <div class="stat-number">${totalBets}</div>
            <div class="stat-label">Всего ставок</div>
        </div>
        <div class="profile-stat-card">
            <div class="stat-number">${wonBets}</div>
            <div class="stat-label">Выиграно</div>
        </div>
        <div class="profile-stat-card">
            <div class="stat-number">${lostBets}</div>
            <div class="stat-label">Проиграно</div>
        </div>
        <div class="profile-stat-card">
            <div class="stat-number">${pendingBets}</div>
            <div class="stat-label">В ожидании</div>
        </div>
        <div class="profile-stat-card">
            <div class="stat-number ${winRate >= 50 ? 'positive' : 'negative'}">${winRate}%</div>
            <div class="stat-label">Процент побед</div>
        </div>
        <div class="profile-stat-card">
            <div class="stat-number ${profit >= 0 ? 'positive' : 'negative'}">${profit >= 0 ? '+' : ''}${profit}</div>
            <div class="stat-label">Прибыль</div>
        </div>
        <div class="profile-stat-card">
            <div class="stat-number">${totalStaked.toLocaleString()}</div>
            <div class="stat-label">Всего поставлено</div>
        </div>
        <div class="profile-stat-card">
            <div class="stat-number">${avgBet}</div>
            <div class="stat-label">Средняя ставка</div>
        </div>
    `;
}



// ===== ИЗМЕНЕНИЕ ПАРОЛЯ =====
async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (newPassword.length < 4) {
        showNotification('Новый пароль должен содержать минимум 4 символа', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('Новые пароли не совпадают', 'error');
        return;
    }
    
    if (currentPassword !== currentUser.password) {
        showNotification('Неверный текущий пароль', 'error');
        return;
    }
    
    try {
        const userRef = dbRef(database, `users/${currentUser.username}`);
        await dbUpdate(userRef, { password: newPassword });
        
        currentUser.password = newPassword;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Очистить форму
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        showNotification('Пароль успешно изменен!', 'success');
        
    } catch (error) {
        console.error('Ошибка изменения пароля:', error);
        showNotification('Ошибка изменения пароля', 'error');
    }
};







// ===== МОДАЛЬНЫЕ ОКНА =====
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
};

// Закрытие модальных окон по клику вне их
window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

// ===== УВЕДОМЛЕНИЯ =====
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===== ВЫХОД ИЗ СИСТЕМЫ =====
function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

// Экспортируем функции в глобальную область видимости
window.changePassword = changePassword;
window.closeModal = closeModal;
window.logout = logout;
