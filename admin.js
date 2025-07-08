// ===== ИНИЦИАЛИЗАЦИЯ FIREBASE =====
// Используем Firebase compat API вместо ES6 импортов

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let currentUser = null;
let events = {};
let users = {};
let bets = {};
let settings = {};

// ===== ВЫХОД ИЗ СИСТЕМЫ =====
function logout() {
    try {
        // Очистить sync manager если доступен
        if (window.dataSyncManager) {
            window.dataSyncManager.cleanup();
            window.dataSyncManager.clearLocalData();
        }
        
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('❌ Ошибка выхода из системы:', error);
        window.location.href = 'login.html';
    }
}

// ===== МОДАЛЬНЫЕ ОКНА =====
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Инициализация admin.js');
    
    try {
        // Ждем инициализации Firebase
        await waitForFirebase();
        
        // Проверяем авторизацию
        await checkAuth();
        
        // Загружаем данные
        await loadData();
        
        console.log('✅ admin.js полностью инициализирован');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации admin.js:', error);
        showNotification('Ошибка загрузки админ панели', 'error');
    }
});

// ===== ОЖИДАНИЕ FIREBASE =====
async function waitForFirebase() {
    let attempts = 0;
    const maxAttempts = 50;
    
    while (!window.firebase && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (!window.firebase) {
        throw new Error('Firebase не загружен');
    }
    
    console.log('🔥 Firebase готов для admin.js');
}

// Закрытие модальных окон по клику вне их
window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

async function checkAuth() {
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
    
    const balanceElement = document.getElementById('user-balance');
    const usernameElement = document.getElementById('username');
    
    if (balanceElement) {
        balanceElement.textContent = `${currentUser.balance.toLocaleString()} лупанчиков`;
    }
    
    if (usernameElement) {
        usernameElement.textContent = currentUser.username;
    }
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadData() {
    await Promise.all([
        loadEvents(),
        loadUsers(),
        loadBets(),
        loadStats(),
        loadSettings()
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

// ===== ЗАГРУЗКА НАСТРОЕК =====
async function loadSettings() {
    try {
        const settingsRef = window.firebase.database().ref('settings');
        const snapshot = await settingsRef.once('value');
        
        if (snapshot.exists()) {
            settings = snapshot.val();
        } else {
            // Создать настройки по умолчанию
            settings = {
                maxBetAmount: 1000,
                defaultBalance: 5000,
                minBetAmount: 1,
                maxCoefficient: 50,
                winCommission: 5,
                minWithdraw: 100,
                maxWithdrawPerDay: 10000,
                maintenanceMode: false,
                maintenanceMessage: ''
            };
            await settingsRef.set(settings);
        }
        
        // Заполнить поля формы
        fillSettingsForm();
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
    }
}

function fillSettingsForm() {
    document.getElementById('maxBetAmount').value = settings.maxBetAmount || 1000;
    document.getElementById('defaultBalance').value = settings.defaultBalance || 5000;
    document.getElementById('minBetAmount').value = settings.minBetAmount || 1;
    document.getElementById('maxCoefficient').value = settings.maxCoefficient || 50;
    document.getElementById('winCommission').value = settings.winCommission || 5;
    document.getElementById('minWithdraw').value = settings.minWithdraw || 100;
    document.getElementById('maxWithdrawPerDay').value = settings.maxWithdrawPerDay || 10000;
    document.getElementById('maintenanceMode').checked = settings.maintenanceMode || false;
    document.getElementById('maintenanceMessage').value = settings.maintenanceMessage || '';
}

// ===== УПРАВЛЕНИЕ СОБЫТИЯМИ =====
async function loadEvents() {
    try {
        const eventsRef = window.firebase.database().ref('events');
        const snapshot = await eventsRef.once('value');
        
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
                    ${event.status === 'active' ? `<button class='btn btn-success' onclick="openFinishEventModal('${id}')">Завершить</button>` : ''}
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
        
        const eventsRef = window.firebase.database().ref('events');
        const newEventRef = eventsRef.push();
        await newEventRef.set(newEvent);
        
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

async function editEvent(eventId) {
    const event = events[eventId];
    if (!event) {
        showNotification('Событие не найдено', 'error');
        return;
    }
    
    // Заполнить форму редактирования
    document.getElementById('eventCategory').value = event.category;
    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventDescription').value = event.description;
    document.getElementById('eventOptions').value = event.options.join(', ');
    document.getElementById('eventCoefficients').value = event.coefficients.join(', ');
    
    // Показать уведомление о том, что форма заполнена
    showNotification('Форма заполнена данными события. Измените нужные поля и нажмите "Добавить событие"', 'info');
}

async function deleteEvent(eventId) {
    if (!confirm('Вы уверены, что хотите удалить это событие?')) {
        return;
    }
    
    try {
        const eventRef = window.firebase.database().ref(`events/${eventId}`);
        await eventRef.remove();
        
        showNotification('Событие удалено!', 'success');
        loadEvents();
    } catch (error) {
        console.error('Ошибка удаления события:', error);
        showNotification('Ошибка удаления события', 'error');
    }
}

// ===== УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ =====
async function loadUsers() {
    try {
        const usersRef = window.firebase.database().ref('users');
        const snapshot = await usersRef.once('value');
        
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

async function addUser() {
    const username = document.getElementById('newUserLogin').value.trim();
    const password = document.getElementById('newUserPassword').value.trim();
    const role = document.getElementById('newUserRole').value;
    const balance = parseInt(document.getElementById('newUserBalance').value) || 5000;
    
    if (!username || !password) {
        showNotification('Заполните логин и пароль', 'error');
        return;
    }
    
    if (username.length < 3) {
        showNotification('Логин должен содержать минимум 3 символа', 'error');
        return;
    }
    
    if (password.length < 4) {
        showNotification('Пароль должен содержать минимум 4 символа', 'error');
        return;
    }
    
    if (users[username]) {
        showNotification('Пользователь с таким логином уже существует', 'error');
        return;
    }
    
    try {
        const newUser = {
            password: password,
            role: role,
            balance: balance,
            betLimit: settings.maxBetAmount || 1000,
            registeredAt: Date.now(),
            status: 'active'
        };
        
        const userRef = window.firebase.database().ref(`users/${username}`);
        await userRef.set(newUser);
        
        // Очистить форму
        document.getElementById('newUserLogin').value = '';
        document.getElementById('newUserPassword').value = '';
        document.getElementById('newUserBalance').value = '5000';
        
        closeModal('addUserModal');
        showNotification('Пользователь добавлен!', 'success');
        loadUsers();
        
    } catch (error) {
        console.error('Ошибка добавления пользователя:', error);
        showNotification('Ошибка добавления пользователя', 'error');
    }
}

async function editUser(username) {
    const user = users[username];
    if (!user) {
        showNotification('Пользователь не найден', 'error');
        return;
    }
    
    // Заполнить форму редактирования
    document.getElementById('editUserLogin').value = username;
    document.getElementById('editUserLoginDisplay').value = username;
    document.getElementById('editUserRole').value = user.role;
    document.getElementById('editUserBalance').value = user.balance;
    document.getElementById('editUserBetLimit').value = user.betLimit || 1000;
    document.getElementById('editUserPassword').value = '';
    
    // Показать модальное окно
    const modal = document.getElementById('editUserModal');
    if (modal) modal.style.display = 'block';
}

async function updateUser() {
    const username = document.getElementById('editUserLogin').value;
    const role = document.getElementById('editUserRole').value;
    const balance = parseInt(document.getElementById('editUserBalance').value);
    const betLimit = parseInt(document.getElementById('editUserBetLimit').value);
    const newPassword = document.getElementById('editUserPassword').value.trim();
    
    if (!username || balance < 0 || betLimit < 1) {
        showNotification('Заполните все поля корректно', 'error');
        return;
    }
    
    try {
        const updateData = {
            role: role,
            balance: balance,
            betLimit: betLimit
        };
        
        if (newPassword) {
            if (newPassword.length < 4) {
                showNotification('Новый пароль должен содержать минимум 4 символа', 'error');
                return;
            }
            updateData.password = newPassword;
        }
        
        const userRef = window.firebase.database().ref(`users/${username}`);
        await userRef.update(updateData);
        
        closeModal('editUserModal');
        showNotification('Пользователь обновлен!', 'success');
        loadUsers();
        
    } catch (error) {
        console.error('Ошибка обновления пользователя:', error);
        showNotification('Ошибка обновления пользователя', 'error');
    }
}

async function toggleUserStatus(username) {
    const user = users[username];
    if (!user) {
        showNotification('Пользователь не найден', 'error');
        return;
    }
    
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'разблокирован' : 'заблокирован';
    
    try {
        const userRef = window.firebase.database().ref(`users/${username}`);
        await userRef.update({ status: newStatus });
        
        showNotification(`Пользователь ${action}!`, 'success');
        loadUsers();
        
    } catch (error) {
        console.error('Ошибка изменения статуса пользователя:', error);
        showNotification('Ошибка изменения статуса', 'error');
    }
}

function showAddUserModal() {
    const modal = document.getElementById('addUserModal');
    if (modal) modal.style.display = 'block';
}

// ===== УПРАВЛЕНИЕ СТАВКАМИ =====
async function loadBets() {
    try {
        const betsRef = window.firebase.database().ref('bets');
        const snapshot = await betsRef.once('value');
        
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

async function viewBet(betId) {
    const bet = bets[betId];
    if (!bet) {
        showNotification('Ставка не найдена', 'error');
        return;
    }
    
    const potentialWin = (bet.amount * bet.coefficient).toFixed(2);
    const actualWin = bet.status === 'won' ? 
        (bet.winAmount || bet.amount * bet.coefficient).toFixed(2) : 0;
    
    const betDetails = document.getElementById('betDetails');
    betDetails.innerHTML = `
        <div style="margin-bottom: 15px;">
            <strong>ID ставки:</strong> ${betId}<br>
            <strong>Пользователь:</strong> ${bet.user}<br>
            <strong>Тип:</strong> ${bet.type === 'single' ? 'Одиночная' : 'Экспресс'}<br>
            <strong>Сумма:</strong> ${bet.amount} лупанчиков<br>
            <strong>Коэффициент:</strong> ${bet.coefficient}<br>
            <strong>Возможный выигрыш:</strong> ${potentialWin} лупанчиков<br>
            <strong>Статус:</strong> ${getBetStatusName(bet.status)}<br>
            <strong>Дата:</strong> ${new Date(bet.timestamp).toLocaleString()}
        </div>
        
        <div style="margin-bottom: 15px;">
            <strong>События:</strong><br>
            ${bet.events.map(event => `
                <div style="margin: 5px 0; padding: 5px; background: rgba(255,255,255,0.1); border-radius: 4px;">
                    ${event.eventTitle} - ${event.option} (${event.coefficient})
                </div>
            `).join('')}
        </div>
        
        ${bet.status === 'won' ? `<div style="color: #4caf50;"><strong>Фактический выигрыш:</strong> ${actualWin} лупанчиков</div>` : ''}
        ${bet.status === 'lost' ? `<div style="color: #f44336;"><strong>Проигрыш:</strong> ${bet.amount} лупанчиков</div>` : ''}
    `;
    
    const modal = document.getElementById('viewBetModal');
    if (modal) modal.style.display = 'block';
}

async function resolveBet(betId, result) {
    const bet = bets[betId];
    if (!bet) {
        showNotification('Ставка не найдена', 'error');
        return;
    }
    
    if (bet.status !== 'pending') {
        showNotification('Ставка уже обработана', 'error');
        return;
    }
    
    try {
        const betRef = window.firebase.database().ref(`bets/${betId}`);
        const userRef = window.firebase.database().ref(`users/${bet.user}`);
        
        let updateData = { status: result };
        
        if (result === 'won') {
            const winAmount = bet.amount * bet.coefficient;
            updateData.winAmount = winAmount;
            
            // Обновить баланс пользователя
            const userSnapshot = await userRef.once('value');
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                const newBalance = userData.balance + winAmount;
                await userRef.update({ balance: newBalance });
            }
        }
        
        await betRef.update(updateData);

        // Деактивировать все события из этой ставки
        if (Array.isArray(bet.events)) {
            for (const event of bet.events) {
                if (event.eventId) {
                    const eventRef = window.firebase.database().ref(`events/${event.eventId}`);
                    await eventRef.update({ status: 'inactive' });
                }
            }
        }
        
        showNotification(`Ставка отмечена как ${result === 'won' ? 'выигрышная' : 'проигрышная'}!`, 'success');
        loadBets();
        loadEvents(); // обновить список событий
        
    } catch (error) {
        console.error('Ошибка обработки ставки:', error);
        showNotification('Ошибка обработки ставки', 'error');
    }
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
    
    // Стили для уведомления
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
        max-width: 400px;
        word-wrap: break-word;
    `;
    
    // Цвета по типам
    const colors = {
        success: '#4caf50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196f3'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===== НАСТРОЙКИ =====
async function saveSettings() {
    try {
        const newSettings = {
            maxBetAmount: parseInt(document.getElementById('maxBetAmount').value),
            defaultBalance: parseInt(document.getElementById('defaultBalance').value),
            minBetAmount: parseInt(document.getElementById('minBetAmount').value),
            maxCoefficient: parseFloat(document.getElementById('maxCoefficient').value)
        };
        
        // Валидация
        if (newSettings.maxBetAmount < 1 || newSettings.defaultBalance < 0 || 
            newSettings.minBetAmount < 1 || newSettings.maxCoefficient < 1) {
            showNotification('Проверьте корректность значений', 'error');
            return;
        }
        
        const settingsRef = window.firebase.database().ref('settings');
        await settingsRef.update(newSettings);
        
        Object.assign(settings, newSettings);
        showNotification('Настройки сохранены!', 'success');
        
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
        showNotification('Ошибка сохранения настроек', 'error');
    }
}

async function saveCommissionSettings() {
    try {
        const newSettings = {
            winCommission: parseFloat(document.getElementById('winCommission').value),
            minWithdraw: parseInt(document.getElementById('minWithdraw').value),
            maxWithdrawPerDay: parseInt(document.getElementById('maxWithdrawPerDay').value)
        };
        
        // Валидация
        if (newSettings.winCommission < 0 || newSettings.winCommission > 50 ||
            newSettings.minWithdraw < 1 || newSettings.maxWithdrawPerDay < 100) {
            showNotification('Проверьте корректность значений', 'error');
            return;
        }
        
        const settingsRef = window.firebase.database().ref('settings');
        await settingsRef.update(newSettings);
        
        Object.assign(settings, newSettings);
        showNotification('Настройки комиссий сохранены!', 'success');
        
    } catch (error) {
        console.error('Ошибка сохранения настроек комиссий:', error);
        showNotification('Ошибка сохранения настроек', 'error');
    }
}

async function toggleMaintenance() {
    try {
        const maintenanceMode = document.getElementById('maintenanceMode').checked;
        const maintenanceMessage = document.getElementById('maintenanceMessage').value.trim();
        
        const settingsRef = window.firebase.database().ref('settings');
        await settingsRef.update({
            maintenanceMode: maintenanceMode,
            maintenanceMessage: maintenanceMessage
        });
        
        Object.assign(settings, { maintenanceMode, maintenanceMessage });
        
        const status = maintenanceMode ? 'включен' : 'выключен';
        showNotification(`Режим технического обслуживания ${status}!`, 'success');
        
    } catch (error) {
        console.error('Ошибка переключения режима обслуживания:', error);
        showNotification('Ошибка переключения режима', 'error');
    }
}

// ===== УПРАВЛЕНИЕ ДАННЫМИ =====
async function cleanOldBets() {
    if (!confirm('Удалить все ставки старше 30 дней? Это действие нельзя отменить.')) {
        return;
    }
    
    try {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const betsToDelete = Object.entries(bets).filter(([betId, bet]) => 
            bet.timestamp < thirtyDaysAgo && bet.status !== 'pending'
        );
        
        if (betsToDelete.length === 0) {
            showNotification('Нет старых ставок для удаления', 'info');
            return;
        }
        
        for (const [betId, bet] of betsToDelete) {
            const betRef = window.firebase.database().ref(`bets/${betId}`);
            await betRef.remove();
        }
        
        showNotification(`Удалено ${betsToDelete.length} старых ставок!`, 'success');
        loadBets();
        
    } catch (error) {
        console.error('Ошибка очистки старых ставок:', error);
        showNotification('Ошибка очистки ставок', 'error');
    }
}

async function resetAllBalances() {
    if (!confirm('Сбросить все балансы пользователей на стартовое значение? Это действие нельзя отменить.')) {
        return;
    }
    
    try {
        const defaultBalance = settings.defaultBalance || 5000;
        
        for (const [username, user] of Object.entries(users)) {
            const userRef = window.firebase.database().ref(`users/${username}`);
            await userRef.update({ balance: defaultBalance });
        }
        
        showNotification(`Все балансы сброшены на ${defaultBalance} лупанчиков!`, 'success');
        loadUsers();
        
    } catch (error) {
        console.error('Ошибка сброса балансов:', error);
        showNotification('Ошибка сброса балансов', 'error');
    }
}

// Открытие модалки завершения события
function openFinishEventModal(eventId) {
    const event = events[eventId];
    if (!event) return;
    document.getElementById('finishEventTitle').textContent = event.title;
    const select = document.getElementById('finishEventOption');
    select.innerHTML = event.options.map((opt, idx) => `<option value="${opt}">${opt}</option>`).join('');
    select.dataset.eventId = eventId;
    document.getElementById('finishEventModal').style.display = 'block';
}

// Подтверждение завершения события и расчет ставок
async function finishEventConfirm() {
    const select = document.getElementById('finishEventOption');
    const eventId = select.dataset.eventId;
    const winningOption = select.value;
    if (!eventId || !winningOption) return;
    try {
        // 1. Обновить событие: статус и winningOption
        const eventRef = window.firebase.database().ref(`events/${eventId}`);
        await eventRef.update({ status: 'finished', winningOption });
        // 2. Рассчитать все ставки по этому событию
        let updated = 0;
        for (const [betId, bet] of Object.entries(bets)) {
            if (bet.status !== 'pending') continue;
            // Есть ли это событие в ставке?
            const betEvent = (bet.events || []).find(e => e.eventId === eventId);
            if (!betEvent) continue;
            let isWin = betEvent.option === winningOption;
            let updateData = { status: isWin ? 'won' : 'lost' };
            if (isWin) {
                updateData.winAmount = bet.amount * bet.coefficient;
                // Обновить баланс пользователя
                const userRef = window.firebase.database().ref(`users/${bet.user}`);
                const userSnapshot = await userRef.once('value');
                if (userSnapshot.exists()) {
                    const userData = userSnapshot.val();
                    const newBalance = userData.balance + updateData.winAmount;
                    await userRef.update({ balance: newBalance });
                }
            }
            const betRef = window.firebase.database().ref(`bets/${betId}`);
            await betRef.update(updateData);
            updated++;
        }
        closeModal('finishEventModal');
        showNotification(`Событие завершено. Рассчитано ставок: ${updated}`, 'success');
        loadEvents();
        loadBets();
    } catch (error) {
        console.error('Ошибка завершения события:', error);
        showNotification('Ошибка завершения события', 'error');
    }
}

// ===== ЭКСПОРТ ВСЕХ ФУНКЦИЙ В ГЛОБАЛЬНУЮ ОБЛАСТЬ ВИДИМОСТИ =====
window.switchTab = switchTab;
window.addEvent = addEvent;
window.editEvent = editEvent;
window.deleteEvent = deleteEvent;
window.loadEvents = loadEvents;
window.loadUsers = loadUsers;
window.loadBets = loadBets;
window.filterUsers = filterUsers;
window.filterBets = filterBets;
window.addUser = addUser;
window.editUser = editUser;
window.updateUser = updateUser;
window.toggleUserStatus = toggleUserStatus;
window.showAddUserModal = showAddUserModal;
window.viewBet = viewBet;
window.resolveBet = resolveBet;
window.saveSettings = saveSettings;
window.saveCommissionSettings = saveCommissionSettings;
window.toggleMaintenance = toggleMaintenance;
window.cleanOldBets = cleanOldBets;
window.resetAllBalances = resetAllBalances;
window.closeModal = closeModal;
window.logout = logout;
window.openFinishEventModal = openFinishEventModal;
window.finishEventConfirm = finishEventConfirm; 
