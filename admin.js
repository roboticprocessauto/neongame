// ===== ИНИЦИАЛИЗАЦИЯ FIREBASE =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getDatabase, 
    ref as dbRef, 
    set as dbSet, 
    get as dbGet, 
    update as dbUpdate, 
    push as dbPush,
    remove as dbRemove
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const app = initializeApp(window.firebaseConfig);
const database = getDatabase(app);

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let currentUser = null;
let events = {};
let users = {};
let bets = {};

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadData();
});

function checkAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (!savedUser) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = JSON.parse(savedUser);
    
    // Проверяем права доступа
    if (currentUser.role !== 'admin' && currentUser.role !== 'moderator') {
        window.location.href = 'main.html';
        return;
    }
    
    updateUserInfo();
}

function updateUserInfo() {
    if (!currentUser) return;
    
    document.getElementById('user-balance').textContent = `${currentUser.balance.toLocaleString()} монет`;
    document.getElementById('username').textContent = currentUser.username;
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadData() {
    await Promise.all([
        loadEvents(),
        loadUsers(),
        loadBets(),
        loadStats()
    ]);
}

// ===== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК =====
function switchTab(tabName) {
    // Скрыть все вкладки
    document.querySelectorAll('.admin-tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Убрать активный класс со всех кнопок
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Показать нужную вкладку
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    
    // Добавить активный класс к кнопке
    event.target.classList.add('active');
}

// ===== УПРАВЛЕНИЕ СОБЫТИЯМИ =====
async function loadEvents() {
    try {
        const eventsRef = dbRef(database, 'events');
        const snapshot = await dbGet(eventsRef);
        
        if (snapshot.exists()) {
            events = snapshot.val();
            displayAdminEvents();
        }
    } catch (error) {
        console.error('Ошибка загрузки событий:', error);
    }
}

function displayAdminEvents() {
    const container = document.getElementById('adminEventsList');
    if (!container) return;
    
    if (Object.keys(events).length === 0) {
        container.innerHTML = '<p>Нет событий</p>';
        return;
    }
    
    container.innerHTML = Object.entries(events).map(([id, event]) => `
        <div style="background: rgba(255,255,255,0.1); padding: 15px; margin: 10px 0; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${event.title}</strong>
                    <br>
                    <small>${event.category} | ${event.status}</small>
                </div>
                <div>
                    <button class="btn" onclick="editEvent('${id}')" style="margin-right: 5px;">Редактировать</button>
                    <button class="btn btn-danger" onclick="deleteEvent('${id}')">Удалить</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function addEvent() {
    const category = document.getElementById('eventCategory').value;
    const title = document.getElementById('eventTitle').value.trim();
    const description = document.getElementById('eventDescription').value.trim();
    const options = document.getElementById('eventOptions').value.split(',').map(o => o.trim());
    const coefficients = document.getElementById('eventCoefficients').value.split(',').map(c => parseFloat(c.trim()));
    
    if (!title || !description || options.length === 0 || coefficients.length === 0) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (options.length !== coefficients.length) {
        showNotification('Количество вариантов должно совпадать с количеством коэффициентов', 'error');
        return;
    }
    
    try {
        const newEvent = {
            title: title,
            description: description,
            category: category,
            options: options,
            coefficients: coefficients,
            status: 'active',
            createdAt: Date.now()
        };
        
        const eventsRef = dbRef(database, 'events');
        const newEventRef = dbPush(eventsRef);
        await dbSet(newEventRef, newEvent);
        
        // Очистить форму
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventDescription').value = '';
        document.getElementById('eventOptions').value = '';
        document.getElementById('eventCoefficients').value = '';
        
        showNotification('Событие добавлено!', 'success');
        loadEvents();
        
    } catch (error) {
        console.error('Ошибка добавления события:', error);
        showNotification('Ошибка добавления события', 'error');
    }
}

// ===== УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ =====
async function loadUsers() {
    try {
        const usersRef = dbRef(database, 'users');
        const snapshot = await dbGet(usersRef);
        
        if (snapshot.exists()) {
            users = snapshot.val();
            displayUsers();
        }
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
    }
}

function displayUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    const filteredUsers = filterUsers();
    
    tbody.innerHTML = filteredUsers.map(([username, user]) => `
        <tr>
            <td>${username}</td>
            <td><span class="role-${user.role}">${getRoleName(user.role)}</span></td>
            <td>${user.balance.toLocaleString()}</td>
            <td>${(user.betLimit || 1000).toLocaleString()}</td>
            <td>${new Date(user.registeredAt).toLocaleDateString()}</td>
            <td><span class="status-${user.status}">${user.status === 'active' ? 'Активен' : 'Заблокирован'}</span></td>
            <td>
                <button class="btn" onclick="editUser('${username}')">Редактировать</button>
                <button class="btn btn-warning" onclick="toggleUserStatus('${username}')">
                    ${user.status === 'active' ? 'Заблокировать' : 'Разблокировать'}
                </button>
            </td>
        </tr>
    `).join('');
}

function filterUsers() {
    const roleFilter = document.getElementById('userRoleFilter')?.value || 'all';
    const searchFilter = document.getElementById('userSearchFilter')?.value || '';
    
    return Object.entries(users).filter(([username, user]) => {
        if (roleFilter !== 'all' && user.role !== roleFilter) return false;
        if (searchFilter && !username.toLowerCase().includes(searchFilter.toLowerCase())) return false;
        return true;
    });
}

// ===== УПРАВЛЕНИЕ СТАВКАМИ =====
async function loadBets() {
    try {
        const betsRef = dbRef(database, 'bets');
        const snapshot = await dbGet(betsRef);
        
        if (snapshot.exists()) {
            bets = snapshot.val();
            displayBets();
        }
    } catch (error) {
        console.error('Ошибка загрузки ставок:', error);
    }
}

function displayBets() {
    const tbody = document.getElementById('betsTableBody');
    if (!tbody) return;
    
    const filteredBets = filterBets();
    
    tbody.innerHTML = filteredBets.map(([betId, bet]) => `
        <tr>
            <td>${betId.substring(0, 8)}</td>
            <td>${bet.user}</td>
            <td>${bet.type === 'single' ? 'Одиночная' : 'Экспресс'}</td>
            <td>${bet.amount}</td>
            <td>${bet.coefficient}</td>
            <td>${(bet.amount * bet.coefficient).toFixed(2)}</td>
            <td><span class="status-${bet.status}">${getBetStatusName(bet.status)}</span></td>
            <td>${new Date(bet.timestamp).toLocaleDateString()}</td>
            <td>
                <button class="btn" onclick="viewBet('${betId}')">Просмотр</button>
                ${bet.status === 'pending' ? `
                    <button class="btn btn-success" onclick="resolveBet('${betId}', 'won')">Выиграла</button>
                    <button class="btn btn-danger" onclick="resolveBet('${betId}', 'lost')">Проиграла</button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

function filterBets() {
    const statusFilter = document.getElementById('betStatusFilter')?.value || 'all';
    const typeFilter = document.getElementById('betTypeFilter')?.value || 'all';
    const userFilter = document.getElementById('betUserFilter')?.value || '';
    
    return Object.entries(bets).filter(([betId, bet]) => {
        if (statusFilter !== 'all' && bet.status !== statusFilter) return false;
        if (typeFilter !== 'all' && bet.type !== typeFilter) return false;
        if (userFilter && !bet.user.toLowerCase().includes(userFilter.toLowerCase())) return false;
        return true;
    });
}

// ===== СТАТИСТИКА =====
async function loadStats() {
    try {
        const totalUsers = Object.keys(users).length;
        const totalBets = Object.keys(bets).length;
        const totalVolume = Object.values(bets).reduce((sum, bet) => sum + bet.amount, 0);
        const activeEvents = Object.values(events).filter(e => e.status === 'active').length;
        const totalBalance = Object.values(users).reduce((sum, user) => sum + user.balance, 0);
        const pendingBets = Object.values(bets).filter(bet => bet.status === 'pending').length;
        
        document.getElementById('totalUsers').textContent = totalUsers;
        document.getElementById('totalBets').textContent = totalBets;
        document.getElementById('totalVolume').textContent = totalVolume.toLocaleString();
        document.getElementById('activeEvents').textContent = activeEvents;
        document.getElementById('totalBalance').textContent = totalBalance.toLocaleString();
        document.getElementById('pendingBets').textContent = pendingBets;
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function getRoleName(role) {
    const roles = {
        'admin': 'Администратор',
        'moderator': 'Модератор',
        'user': 'Пользователь'
    };
    return roles[role] || role;
}

function getBetStatusName(status) {
    const statuses = {
        'pending': 'Ожидает',
        'won': 'Выиграла',
        'lost': 'Проиграла',
        'cancelled': 'Отменена'
    };
    return statuses[status] || status;
}

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
window.switchTab = switchTab;
window.addEvent = addEvent;
window.loadEvents = loadEvents;
window.loadUsers = loadUsers;
window.loadBets = loadBets;
window.filterUsers = filterUsers;
window.filterBets = filterBets;
window.editEvent = function(id) { showNotification('Функция в разработке', 'info'); };
window.deleteEvent = function(id) { showNotification('Функция в разработке', 'info'); };
window.editUser = function(username) { showNotification('Функция в разработке', 'info'); };
window.toggleUserStatus = function(username) { showNotification('Функция в разработке', 'info'); };
window.viewBet = function(betId) { showNotification('Функция в разработке', 'info'); };
window.resolveBet = function(betId, result) { showNotification('Функция в разработке', 'info'); };
window.logout = logout; 
