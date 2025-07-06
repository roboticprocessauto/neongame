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
let userTransactions = [];
let userSettings = {
    notifyBets: true,
    notifyEvents: true,
    notifyPromos: false,
    emailNotify: false
};

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadProfileData();
    loadUserBetsHistory();
    loadTransactions();
    loadUserSettings();
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
    
    // Показать админ ссылку если пользователь админ/модератор
    if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
        document.getElementById('admin-link').style.display = 'block';
    }
}

function updateUserInfo() {
    if (!currentUser) return;
    
    document.getElementById('user-balance').textContent = `${currentUser.balance.toLocaleString()} монет`;
    document.getElementById('username').textContent = currentUser.username;
}

// ===== ОТОБРАЖЕНИЕ ИНФОРМАЦИИ О ПРОФИЛЕ =====
function displayProfileInfo() {
    if (!currentUser) return;
    
    document.getElementById('profile-username').textContent = currentUser.username;
    document.getElementById('profile-role').textContent = getRoleName(currentUser.role);
    document.getElementById('profile-balance').textContent = `${currentUser.balance.toLocaleString()} монет`;
    document.getElementById('profile-bet-limit').textContent = `${(currentUser.betLimit || 1000).toLocaleString()} монет`;
    
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

// ===== ЗАГРУЗКА ТРАНЗАКЦИЙ =====
async function loadTransactions() {
    try {
        const transactionsRef = dbRef(database, `transactions/${currentUser.username}`);
        const snapshot = await dbGet(transactionsRef);
        
        if (snapshot.exists()) {
            userTransactions = Object.entries(snapshot.val())
                .map(([id, transaction]) => ({ id, ...transaction }))
                .sort((a, b) => b.timestamp - a.timestamp);
        } else {
            userTransactions = [];
        }
        
        displayTransactions();
    } catch (error) {
        console.error('Ошибка загрузки транзакций:', error);
        userTransactions = [];
        displayTransactions();
    }
}

function displayTransactions() {
    const container = document.getElementById('transactions-list');
    
    if (userTransactions.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #b0bec5;">
                <p>История транзакций пуста</p>
                <div style="margin-top: 15px;">
                    <button class="btn" onclick="showTopupModal()" style="margin-right: 10px;">Пополнить баланс</button>
                    <button class="btn btn-secondary" onclick="showWithdrawModal()">Вывести средства</button>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = userTransactions.map(transaction => {
        const isPositive = transaction.type === 'deposit' || transaction.type === 'win';
        const typeNames = {
            'deposit': 'Пополнение',
            'withdraw': 'Вывод средств',
            'bet': 'Ставка',
            'win': 'Выигрыш',
            'refund': 'Возврат'
        };
        
        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-type">${typeNames[transaction.type] || transaction.type}</div>
                    <div class="transaction-date">${new Date(transaction.timestamp).toLocaleString()}</div>
                    ${transaction.description ? `<div class="transaction-description" style="color: #b0bec5; font-size: 12px;">${transaction.description}</div>` : ''}
                </div>
                <div class="transaction-amount ${isPositive ? 'positive' : 'negative'}">
                    ${isPositive ? '+' : '-'}${Math.abs(transaction.amount)} монет
                </div>
            </div>
        `;
    }).join('');
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
        
        // Добавить транзакцию
        await addTransaction('security', 0, 'Изменение пароля');
        
    } catch (error) {
        console.error('Ошибка изменения пароля:', error);
        showNotification('Ошибка изменения пароля', 'error');
    }
};

// ===== НАСТРОЙКИ УВЕДОМЛЕНИЙ =====
async function loadUserSettings() {
    try {
        const settingsRef = dbRef(database, `userSettings/${currentUser.username}`);
        const snapshot = await dbGet(settingsRef);
        
        if (snapshot.exists()) {
            userSettings = { ...userSettings, ...snapshot.val() };
        }
        
        // Применить настройки к UI
        document.getElementById('notifyBets').checked = userSettings.notifyBets;
        document.getElementById('notifyEvents').checked = userSettings.notifyEvents;
        document.getElementById('notifyPromos').checked = userSettings.notifyPromos;
        document.getElementById('emailNotify').checked = userSettings.emailNotify;
        
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
    }
}

async function saveNotificationSettings() {
    try {
        userSettings = {
            notifyBets: document.getElementById('notifyBets').checked,
            notifyEvents: document.getElementById('notifyEvents').checked,
            notifyPromos: document.getElementById('notifyPromos').checked,
            emailNotify: document.getElementById('emailNotify').checked
        };
        
        const settingsRef = dbRef(database, `userSettings/${currentUser.username}`);
        await dbSet(settingsRef, userSettings);
        
        showNotification('Настройки уведомлений сохранены!', 'success');
        
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
        showNotification('Ошибка сохранения настроек', 'error');
    }
};

// ===== ПОПОЛНЕНИЕ БАЛАНСА =====
function showTopupModal() {
    const modal = document.getElementById('topupModal');
    if (modal) modal.style.display = 'block';
};

async function processTopup() {
    const amount = parseInt(document.getElementById('topupAmount').value);
    const method = document.getElementById('paymentMethod').value;
    
    if (!amount || amount < 100) {
        showNotification('Минимальная сумма пополнения: 100 монет', 'error');
        return;
    }
    
    if (amount > 50000) {
        showNotification('Максимальная сумма пополнения: 50,000 монет', 'error');
        return;
    }
    
    try {
        // Имитация обработки платежа
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Обновить баланс пользователя
        const userRef = dbRef(database, `users/${currentUser.username}`);
        const newBalance = currentUser.balance + amount;
        await dbUpdate(userRef, { balance: newBalance });
        
        currentUser.balance = newBalance;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserInfo();
        displayProfileInfo();
        
        // Добавить транзакцию
        await addTransaction('deposit', amount, `Пополнение через ${getPaymentMethodName(method)}`);
        
        closeModal('topupModal');
        loadTransactions();
        
        showNotification(`Баланс пополнен на ${amount} монет!`, 'success');
        
    } catch (error) {
        console.error('Ошибка пополнения:', error);
        showNotification('Ошибка пополнения баланса', 'error');
    }
};

// ===== ВЫВОД СРЕДСТВ =====
function showWithdrawModal() {
    const modal = document.getElementById('withdrawModal');
    if (modal) modal.style.display = 'block';
};

async function processWithdraw() {
    const amount = parseInt(document.getElementById('withdrawAmount').value);
    const method = document.getElementById('withdrawMethod').value;
    const details = document.getElementById('withdrawDetails').value.trim();
    
    if (!amount || amount < 100) {
        showNotification('Минимальная сумма вывода: 100 монет', 'error');
        return;
    }
    
    if (amount > currentUser.balance) {
        showNotification('Недостаточно средств на балансе', 'error');
        return;
    }
    
    if (!details) {
        showNotification('Укажите реквизиты для вывода', 'error');
        return;
    }
    
    try {
        // Обновить баланс пользователя
        const userRef = dbRef(database, `users/${currentUser.username}`);
        const newBalance = currentUser.balance - amount;
        await dbUpdate(userRef, { balance: newBalance });
        
        currentUser.balance = newBalance;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserInfo();
        displayProfileInfo();
        
        // Добавить транзакцию
        await addTransaction('withdraw', -amount, `Вывод через ${getPaymentMethodName(method)} на ${details}`);
        
        closeModal('withdrawModal');
        loadTransactions();
        
        showNotification(`Запрос на вывод ${amount} монет отправлен!`, 'success');
        
    } catch (error) {
        console.error('Ошибка вывода:', error);
        showNotification('Ошибка вывода средств', 'error');
    }
};

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
async function addTransaction(type, amount, description) {
    try {
        const transactionsRef = dbRef(database, `transactions/${currentUser.username}`);
        const newTransactionRef = dbPush(transactionsRef);
        
        const transaction = {
            type: type,
            amount: amount,
            description: description,
            timestamp: Date.now()
        };
        
        await dbSet(newTransactionRef, transaction);
    } catch (error) {
        console.error('Ошибка добавления транзакции:', error);
    }
}

function getPaymentMethodName(method) {
    const methods = {
        'card': 'банковскую карту',
        'wallet': 'электронный кошелек',
        'crypto': 'криптовалюту'
    };
    return methods[method] || method;
}

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
window.saveNotificationSettings = saveNotificationSettings;
window.showTopupModal = showTopupModal;
window.processTopup = processTopup;
window.showWithdrawModal = showWithdrawModal;
window.processWithdraw = processWithdraw;
window.closeModal = closeModal;
window.logout = logout;
