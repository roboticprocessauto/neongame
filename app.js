// ===== ИНИЦИАЛИЗАЦИЯ FIREBASE =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getDatabase, 
    ref as dbRef, 
    set as dbSet, 
    get as dbGet, 
    update as dbUpdate, 
    push as dbPush,
    onValue,
    off
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Инициализация Firebase
const app = initializeApp(window.firebaseConfig);
const database = getDatabase(app);

// Экспорт функций Firebase для глобального использования
window.database = database;
window.dbRef = dbRef;
window.dbSet = dbSet;
window.dbGet = dbGet;
window.dbUpdate = dbUpdate;
window.dbPush = dbPush;
window.onValue = onValue;
window.off = off;

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let currentUser = null;
let currentAdminTab = 'events';
let allUsers = {};
let allBets = {};
let allEvents = {};
let systemStats = {};

// Настройки системы
let settings = {
    maxBetAmount: 1000,
    defaultBalance: 5000,
    minBetAmount: 1,
    maxCoefficient: 50,
    winCommission: 5,
    minWithdraw: 100,
    maxWithdrawPerDay: 50000,
    maintenanceMode: false,
    maintenanceMessage: ''
};

// События для основного приложения
let events = {};

// ===== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ =====
window.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadSettings();
    checkAuthState();
});

async function initializeApp() {
    try {
        // Загрузка настроек
        await loadSettings();
        
        // Загрузка событий
        await loadEvents();
        
        // Проверка режима обслуживания
        if (settings.maintenanceMode) {
            showMaintenanceMessage();
        }
    } catch (error) {
        console.error('Ошибка инициализации:', error);
    }
}

function checkAuthState() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showUserInterface();
    } else {
        showLoginInterface();
    }
}

// ===== АУТЕНТИФИКАЦИЯ =====
window.login = async function(username, password) {
    try {
        const userRef = dbRef(database, `users/${username}`);
        const snapshot = await dbGet(userRef);
        
        if (!snapshot.exists()) {
            throw new Error('Пользователь не найден');
        }
        
        const userData = snapshot.val();
        
        if (userData.password !== password) {
            throw new Error('Неверный пароль');
        }
        
        if (userData.status === 'inactive') {
            throw new Error('Ваш аккаунт заблокирован');
        }
        
        currentUser = {
            username: username,
            ...userData
        };
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showUserInterface();
        updateUserInfo();
        
        // Загрузить историю ставок пользователя
        loadUserBetsHistory();
        
    } catch (error) {
        alert('Ошибка входа: ' + error.message);
    }
};

window.register = async function(username, password, confirmPassword) {
    try {
        if (password !== confirmPassword) {
            throw new Error('Пароли не совпадают');
        }
        
        if (username.length < 3) {
            throw new Error('Логин должен содержать минимум 3 символа');
        }
        
        if (password.length < 4) {
            throw new Error('Пароль должен содержать минимум 4 символа');
        }
        
        const userRef = dbRef(database, `users/${username}`);
        const snapshot = await dbGet(userRef);
        
        if (snapshot.exists()) {
            throw new Error('Пользователь с таким логином уже существует');
        }
        
        const newUser = {
            password: password,
            role: 'user',
            balance: settings.defaultBalance,
            betLimit: settings.maxBetAmount,
            registeredAt: Date.now(),
            status: 'active'
        };
        
        await dbSet(userRef, newUser);
        
        alert('Регистрация прошла успешно! Теперь вы можете войти в систему.');
        
    } catch (error) {
        alert('Ошибка регистрации: ' + error.message);
    }
};

window.logout = function() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    showLoginInterface();
};

// ===== УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ =====
function showLoginInterface() {
    // Скрыть основной интерфейс
    const mainApp = document.getElementById('main-app');
    const adminPanel = document.querySelector('.admin-panel');
    
    if (mainApp) mainApp.style.display = 'none';
    if (adminPanel) adminPanel.style.display = 'none';
    
    // Показать форму входа
    showLoginForm();
}

function showUserInterface() {
    // Показать основной интерфейс
    const mainApp = document.getElementById('main-app');
    if (mainApp) mainApp.style.display = 'block';
    
    // Показать админ панель если пользователь админ или модератор
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator')) {
        const adminPanel = document.querySelector('.admin-panel');
        if (adminPanel) adminPanel.style.display = 'block';
    }
    
    // Скрыть форму входа
    hideLoginForm();
}

function showLoginForm() {
    // Создать форму входа если её нет
    let loginForm = document.getElementById('login-form');
    if (!loginForm) {
        loginForm = document.createElement('div');
        loginForm.id = 'login-form';
        loginForm.innerHTML = `
            <div style="max-width: 400px; margin: 50px auto; padding: 30px; background: rgba(255,255,255,0.1); border-radius: 15px;">
                <h2 style="text-align: center; color: #4fc3f7; margin-bottom: 30px;">MaxBet - Вход в систему</h2>
                
                <div class="form-group">
                    <label>Логин:</label>
                    <input type="text" id="loginUsername" placeholder="Введите логин">
                </div>
                
                <div class="form-group">
                    <label>Пароль:</label>
                    <input type="password" id="loginPassword" placeholder="Введите пароль">
                </div>
                
                <button class="btn" onclick="attemptLogin()" style="width: 100%; margin-bottom: 10px;">Войти</button>
                <button class="btn btn-secondary" onclick="showRegisterForm()" style="width: 100%;">Регистрация</button>
                
                <div id="register-section" style="display: none; margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2);">
                    <h3 style="color: #4fc3f7; margin-bottom: 15px;">Регистрация</h3>
                    
                    <div class="form-group">
                        <label>Логин:</label>
                        <input type="text" id="registerUsername" placeholder="Выберите логин">
                    </div>
                    
                    <div class="form-group">
                        <label>Пароль:</label>
                        <input type="password" id="registerPassword" placeholder="Введите пароль">
                    </div>
                    
                    <div class="form-group">
                        <label>Подтвердите пароль:</label>
                        <input type="password" id="registerConfirmPassword" placeholder="Повторите пароль">
                    </div>
                    
                    <button class="btn" onclick="attemptRegister()" style="width: 100%; margin-bottom: 10px;">Зарегистрироваться</button>
                    <button class="btn btn-secondary" onclick="hideRegisterForm()" style="width: 100%;">Назад к входу</button>
                </div>
            </div>
        `;
        document.body.appendChild(loginForm);
    }
    
    loginForm.style.display = 'block';
}

function hideLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.style.display = 'none';
}

window.attemptLogin = function() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    
    if (!username || !password) {
        alert('Заполните все поля');
        return;
    }
    
    login(username, password);
};

window.attemptRegister = function() {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();
    
    if (!username || !password || !confirmPassword) {
        alert('Заполните все поля');
        return;
    }
    
    register(username, password, confirmPassword);
};

window.showRegisterForm = function() {
    document.getElementById('register-section').style.display = 'block';
};

window.hideRegisterForm = function() {
    document.getElementById('register-section').style.display = 'none';
};

// ===== ОБНОВЛЕНИЕ ИНФОРМАЦИИ О ПОЛЬЗОВАТЕЛЕ =====
function updateUserInfo() {
    if (!currentUser) return;
    
    // Обновить отображение баланса
    const balanceElements = document.querySelectorAll('.user-balance');
    balanceElements.forEach(el => {
        el.textContent = `${currentUser.balance.toLocaleString()} монет`;
    });
    
    // Обновить отображение имени пользователя
    const usernameElements = document.querySelectorAll('.username');
    usernameElements.forEach(el => {
        el.textContent = currentUser.username;
    });
    
    // Обновить роль
    const roleElements = document.querySelectorAll('.user-role');
    roleElements.forEach(el => {
        el.textContent = getRoleName(currentUser.role);
    });
}

// ===== ЗАГРУЗКА НАСТРОЕК =====
async function loadSettings() {
    try {
        const settingsRef = dbRef(database, 'settings');
        const snapshot = await dbGet(settingsRef);
        
        if (snapshot.exists()) {
            const loadedSettings = snapshot.val();
            Object.assign(settings, loadedSettings);
        } else {
            // Создать настройки по умолчанию
            await dbSet(settingsRef, settings);
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
    }
}

// ===== ЗАГРУЗКА СОБЫТИЙ =====
async function loadEvents() {
    try {
        const eventsRef = dbRef(database, 'events');
        const snapshot = await dbGet(eventsRef);
        
        if (snapshot.exists()) {
            events = snapshot.val();
        }
        
        displayEvents();
    } catch (error) {
        console.error('Ошибка загрузки событий:', error);
    }
}

function displayEvents() {
    const eventsContainer = document.getElementById('events-container');
    if (!eventsContainer) return;
    
    eventsContainer.innerHTML = '';
    
    Object.entries(events).forEach(([eventId, event]) => {
        if (event.status !== 'active') return;
        
        const eventElement = document.createElement('div');
        eventElement.className = 'event-card';
        eventElement.innerHTML = `
            <div class="event-header">
                <h3>${event.title}</h3>
                <span class="event-category">${getCategoryName(event.category)}</span>
            </div>
            <p class="event-description">${event.description}</p>
            <div class="event-options">
                ${event.options.map((option, index) => `
                    <button class="option-btn" onclick="selectOption('${eventId}', '${option}', ${event.coefficients[index]})">
                        ${option} (${event.coefficients[index]})
                    </button>
                `).join('')}
            </div>
        `;
        
        eventsContainer.appendChild(eventElement);
    });
}

// ===== ИСТОРИЯ СТАВОК ПОЛЬЗОВАТЕЛЯ =====
async function loadUserBetsHistory() {
    if (!currentUser) return;
    
    try {
        const betsRef = dbRef(database, 'bets');
        const snapshot = await dbGet(betsRef);
        
        if (snapshot.exists()) {
            const allBets = snapshot.val();
            const userBets = Object.entries(allBets)
                .filter(([betId, bet]) => bet.user === currentUser.username)
                .sort(([, a], [, b]) => b.timestamp - a.timestamp);
            
            displayUserBetsHistory(userBets);
            
            // Показать статистику пользователя
            displayUserStats(userBets);
        } else {
            displayUserBetsHistory([]);
        }
    } catch (error) {
        console.error('Ошибка загрузки истории ставок:', error);
        const historyContainer = document.getElementById('user-bets-history');
        if (historyContainer) {
            historyContainer.innerHTML = '<p style="text-align: center; color: #f44336;">Ошибка загрузки истории ставок</p>';
        }
    }
}

function displayUserStats(userBets) {
    let statsContainer = document.getElementById('user-stats');
    if (!statsContainer) {
        statsContainer = document.createElement('div');
        statsContainer.id = 'user-stats';
        statsContainer.style.marginBottom = '20px';
        
        const historyContainer = document.getElementById('user-bets-history');
        if (historyContainer && historyContainer.parentNode) {
            historyContainer.parentNode.insertBefore(statsContainer, historyContainer);
        }
    }
    
    const totalBets = userBets.length;
    const wonBets = userBets.filter(([, bet]) => bet.status === 'won').length;
    const lostBets = userBets.filter(([, bet]) => bet.status === 'lost').length;
    const pendingBets = userBets.filter(([, bet]) => bet.status === 'pending').length;
    
    const totalStaked = userBets.reduce((sum, [, bet]) => sum + bet.amount, 0);
    const totalWon = userBets
        .filter(([, bet]) => bet.status === 'won')
        .reduce((sum, [, bet]) => sum + (bet.winAmount || 0), 0);
    
    const winRate = totalBets > 0 ? ((wonBets / (wonBets + lostBets)) * 100).toFixed(1) : 0;
    const profit = totalWon - totalStaked;
    
    statsContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #4fc3f7;">${totalBets}</div>
                <div style="color: #b0bec5; font-size: 14px;">Всего ставок</div>
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #4caf50;">${wonBets}</div>
                <div style="color: #b0bec5; font-size: 14px;">Выиграно</div>
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #f44336;">${lostBets}</div>
                <div style="color: #b0bec5; font-size: 14px;">Проиграно</div>
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #ff9800;">${pendingBets}</div>
                <div style="color: #b0bec5; font-size: 14px;">В ожидании</div>
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 20px; font-weight: bold; color: ${winRate >= 50 ? '#4caf50' : '#f44336'};">${winRate}%</div>
                <div style="color: #b0bec5; font-size: 14px;">Процент побед</div>
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 20px; font-weight: bold; color: ${profit >= 0 ? '#4caf50' : '#f44336'};">${profit >= 0 ? '+' : ''}${profit}</div>
                <div style="color: #b0bec5; font-size: 14px;">Прибыль</div>
            </div>
        </div>
    `;
}

function displayUserBetsHistory(userBets) {
    const historyContainer = document.getElementById('user-bets-history');
    if (!historyContainer) {
        console.error('Контейнер истории ставок не найден');
        return;
    }
    
    historyContainer.innerHTML = '';
    
    if (userBets.length === 0) {
        historyContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #b0bec5;">
                <h3>У вас пока нет ставок</h3>
                <p>Перейдите на вкладку "События", чтобы сделать первую ставку!</p>
            </div>
        `;
        return;
    }
    
    userBets.forEach(([betId, bet]) => {
        const betElement = document.createElement('div');
        betElement.className = 'bet-history-item';
        
        const statusClass = `status-${bet.status}`;
        const potentialWin = (bet.amount * bet.coefficient).toFixed(2);
        let actualWin = 0;
        
        // Рассчитать фактический выигрыш
        if (bet.status === 'won' && bet.winAmount) {
            actualWin = bet.winAmount;
        }
        
        betElement.innerHTML = `
            <div class="bet-header">
                <span class="bet-id">Ставка #${betId.substring(0, 8)}</span>
                <span class="${statusClass}">${getStatusName(bet.status)}</span>
            </div>
            <div class="bet-details">
                <div class="bet-info">
                    <span>Тип: ${bet.type === 'single' ? 'Одиночная' : 'Экспресс'}</span>
                    <span>Сумма: ${bet.amount} монет</span>
                    <span>Коэффициент: ${bet.coefficient}</span>
                    <span>Возможный выигрыш: ${potentialWin} монет</span>
                    ${bet.status === 'won' ? `<span style="color: #4caf50;">Фактический выигрыш: ${actualWin} монет</span>` : ''}
                    ${bet.status === 'lost' ? `<span style="color: #f44336;">Проигрыш: ${bet.amount} монет</span>` : ''}
                </div>
                <div class="bet-date">${new Date(bet.timestamp).toLocaleString()}</div>
            </div>
            <div class="bet-events">
                ${bet.events.map(event => `
                    <div class="bet-event">
                        <strong>${event.eventTitle || events[event.eventId]?.title || 'Неизвестное событие'}</strong><br>
                        Выбор: ${event.option} (${event.coefficient})
                        ${bet.status === 'won' && event.result ? `<br><span style="color: #4caf50;">✓ Угадано</span>` : ''}
                        ${bet.status === 'lost' && event.result === false ? `<br><span style="color: #f44336;">✗ Не угадано</span>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        
        historyContainer.appendChild(betElement);
    });
}

function createUserBetsHistoryContainer() {
    // Создать секцию истории ставок в пользовательском интерфейсе
    let mainApp = document.getElementById('main-app');
    if (!mainApp) {
        mainApp = document.createElement('div');
        mainApp.id = 'main-app';
        document.body.appendChild(mainApp);
    }
    
    const historySection = document.createElement('div');
    historySection.innerHTML = `
        <div class="user-section">
            <h2>История ваших ставок</h2>
            <div id="user-bets-history" class="bets-history-container"></div>
        </div>
    `;
    
    mainApp.appendChild(historySection);
}

// ===== СОЗДАНИЕ СТАВОК =====
window.selectOption = function(eventId, option, coefficient) {
    if (!currentUser) {
        alert('Войдите в систему, чтобы делать ставки');
        return;
    }
    
    // Добавить выбранную опцию в корзину ставок
    addToBetSlip(eventId, option, coefficient);
};

let betSlip = [];

function addToBetSlip(eventId, option, coefficient) {
    const event = events[eventId];
    if (!event) return;
    
    // Проверить, не добавлена ли уже ставка на это событие
    const existingIndex = betSlip.findIndex(item => item.eventId === eventId);
    
    if (existingIndex !== -1) {
        // Заменить существующую ставку
        betSlip[existingIndex] = {
            eventId: eventId,
            eventTitle: event.title,
            option: option,
            coefficient: coefficient
        };
    } else {
        // Добавить новую ставку
        betSlip.push({
            eventId: eventId,
            eventTitle: event.title,
            option: option,
            coefficient: coefficient
        });
    }
    
    updateBetSlipDisplay();
}

function updateBetSlipDisplay() {
    let betSlipContainer = document.getElementById('bet-slip');
    if (!betSlipContainer) {
        createBetSlipContainer();
        betSlipContainer = document.getElementById('bet-slip');
    }
    
    if (betSlip.length === 0) {
        betSlipContainer.innerHTML = '<p>Корзина ставок пуста</p>';
        return;
    }
    
    const totalCoefficient = betSlip.reduce((total, bet) => total * bet.coefficient, 1);
    
    betSlipContainer.innerHTML = `
        <h3>Корзина ставок</h3>
        <div class="bet-slip-items">
            ${betSlip.map((bet, index) => `
                <div class="bet-slip-item">
                    <div class="bet-slip-event">${bet.eventTitle}</div>
                    <div class="bet-slip-option">${bet.option} (${bet.coefficient})</div>
                    <button class="btn-remove" onclick="removeFromBetSlip(${index})">×</button>
                </div>
            `).join('')}
        </div>
        <div class="bet-slip-total">
            <div>Общий коэффициент: ${totalCoefficient.toFixed(2)}</div>
        </div>
        <div class="bet-slip-controls">
            <input type="number" id="bet-amount" placeholder="Сумма ставки" min="1" max="${Math.min(currentUser.balance, currentUser.betLimit)}">
            <button class="btn" onclick="placeBet('single')">Одиночная ставка</button>
            ${betSlip.length > 1 ? '<button class="btn" onclick="placeBet(\'express\')">Экспресс</button>' : ''}
        </div>
    `;
}

function createBetSlipContainer() {
    let mainApp = document.getElementById('main-app');
    if (!mainApp) {
        mainApp = document.createElement('div');
        mainApp.id = 'main-app';
        document.body.appendChild(mainApp);
    }
    
    const betSlipContainer = document.createElement('div');
    betSlipContainer.id = 'bet-slip';
    betSlipContainer.className = 'bet-slip-container';
    mainApp.appendChild(betSlipContainer);
}

window.removeFromBetSlip = function(index) {
    betSlip.splice(index, 1);
    updateBetSlipDisplay();
};

window.placeBet = async function(type) {
    if (!currentUser) {
        alert('Войдите в систему');
        return;
    }
    
    if (betSlip.length === 0) {
        alert('Корзина ставок пуста');
        return;
    }
    
    const amount = parseInt(document.getElementById('bet-amount').value);
    
    if (!amount || amount < settings.minBetAmount) {
        alert(`Минимальная ставка: ${settings.minBetAmount} монет`);
        return;
    }
    
    if (amount > currentUser.balance) {
        alert('Недостаточно средств');
        return;
    }
    
    if (amount > currentUser.betLimit) {
        alert(`Превышен лимит ставки: ${currentUser.betLimit} монет`);
        return;
    }
    
    try {
        let coefficient;
        let events;
        
        if (type === 'single' && betSlip.length === 1) {
            coefficient = betSlip[0].coefficient;
            events = betSlip;
        } else if (type === 'express' && betSlip.length > 1) {
            coefficient = betSlip.reduce((total, bet) => total * bet.coefficient, 1);
            events = betSlip;
        } else {
            alert('Неверный тип ставки');
            return;
        }
        
        // Создать ставку в базе данных
        const betsRef = dbRef(database, 'bets');
        const newBetRef = dbPush(betsRef);
        
        const bet = {
            user: currentUser.username,
            type: type,
            amount: amount,
            coefficient: parseFloat(coefficient.toFixed(2)),
            status: 'pending',
            timestamp: Date.now(),
            events: events
        };
        
        await dbSet(newBetRef, bet);
        
        // Обновить баланс пользователя
        const userRef = dbRef(database, `users/${currentUser.username}`);
        await dbUpdate(userRef, { 
            balance: currentUser.balance - amount 
        });
        
        currentUser.balance -= amount;
        updateUserInfo();
        
        // Очистить корзину ставок
        betSlip = [];
        updateBetSlipDisplay();
        
        // Обновить историю ставок
        loadUserBetsHistory();
        
        alert('Ставка размещена успешно!');
        
    } catch (error) {
        console.error('Ошибка размещения ставки:', error);
        alert('Ошибка размещения ставки');
    }
};

// ===== АДМИН ПАНЕЛЬ (из предыдущего кода) =====

// Управление вкладками админ панели
window.switchTab = function(tabName) {
    // Скрыть все вкладки
    document.querySelectorAll('.admin-tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Убрать активность с всех кнопок
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Показать выбранную вкладку
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    event.target.classList.add('active');
    
    currentAdminTab = tabName;
    
    // Загрузить данные для вкладки
    switch(tabName) {
        case 'users':
            loadUsers();
            break;
        case 'bets':
            loadBets();
            break;
        case 'settings':
            loadAdminSettings();
            break;
        case 'stats':
            loadStatistics();
            break;
        case 'events':
            loadAdminEvents();
            break;
    }
};

// ===== УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (АДМИН) =====
async function loadUsers() {
    try {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="7" class="loading">Загрузка пользователей...</td></tr>';
        
        const usersRef = dbRef(database, 'users');
        const snapshot = await dbGet(usersRef);
        
        if (snapshot.exists()) {
            allUsers = snapshot.val();
            displayUsers();
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #b0bec5;">Пользователи не найдены</td></tr>';
        }
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        const tbody = document.getElementById('usersTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #f44336;">Ошибка загрузки</td></tr>';
        }
    }
}

function displayUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    Object.entries(allUsers).forEach(([username, user]) => {
        const row = document.createElement('tr');
        
        const roleClass = `role-${user.role}`;
        const statusClass = user.status === 'active' ? 'status-active' : 'status-inactive';
        const registeredDate = user.registeredAt ? new Date(user.registeredAt).toLocaleDateString() : 'Неизвестно';
        const betLimit = user.betLimit || settings.maxBetAmount;
        
        row.innerHTML = `
            <td>${username}</td>
            <td><span class="${roleClass}">${getRoleName(user.role)}</span></td>
            <td>${user.balance ? user.balance.toLocaleString() : 0} монет</td>
            <td>${betLimit.toLocaleString()} монет</td>
            <td>${registeredDate}</td>
            <td><span class="${statusClass}">${user.status === 'active' ? 'Активен' : 'Заблокирован'}</span></td>
            <td>
                <button class="btn" onclick="editUser('${username}')">Редактировать</button>
                <button class="btn ${user.status === 'active' ? 'btn-warning' : 'btn-success'}" 
                        onclick="toggleUserStatus('${username}')">
                    ${user.status === 'active' ? 'Заблокировать' : 'Разблокировать'}
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function getRoleName(role) {
    const roles = {
        'admin': 'Администратор',
        'moderator': 'Модератор',
        'user': 'Пользователь'
    };
    return roles[role] || 'Пользователь';
}

window.filterUsers = function() {
    const roleFilter = document.getElementById('userRoleFilter')?.value || 'all';
    const searchFilter = document.getElementById('userSearchFilter')?.value.toLowerCase() || '';
    
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        if (row.cells.length < 7) return;
        
        const username = row.cells[0]?.textContent.toLowerCase() || '';
        const roleText = row.cells[1]?.textContent.toLowerCase() || '';
        
        const matchesRole = roleFilter === 'all' || roleText.includes(getRoleName(roleFilter).toLowerCase());
        const matchesSearch = searchFilter === '' || username.includes(searchFilter);
        
        row.style.display = matchesRole && matchesSearch ? '' : 'none';
    });
};

window.showAddUserModal = function() {
    const modal = document.getElementById('addUserModal');
    if (modal) modal.style.display = 'block';
};

window.editUser = function(username) {
    const user = allUsers[username];
    if (!user) return;
    
    document.getElementById('editUserLogin').value = username;
    document.getElementById('editUserLoginDisplay').value = username;
    document.getElementById('editUserRole').value = user.role || 'user';
    document.getElementById('editUserBalance').value = user.balance || 0;
    document.getElementById('editUserBetLimit').value = user.betLimit || settings.maxBetAmount;
    document.getElementById('editUserPassword').value = '';
    
    const modal = document.getElementById('editUserModal');
    if (modal) modal.style.display = 'block';
};

window.addUser = async function() {
    const login = document.getElementById('newUserLogin')?.value.trim();
    const password = document.getElementById('newUserPassword')?.value.trim();
    const role = document.getElementById('newUserRole')?.value || 'user';
    const balance = parseInt(document.getElementById('newUserBalance')?.value) || settings.defaultBalance;
    
    if (!login || !password) {
        alert('Заполните все обязательные поля');
        return;
    }
    
    if (login.length < 3) {
        alert('Логин должен содержать минимум 3 символа');
        return;
    }
    
    if (password.length < 4) {
        alert('Пароль должен содержать минимум 4 символа');
        return;
    }
    
    try {
        const userRef = dbRef(database, `users/${login}`);
        const snapshot = await dbGet(userRef);
        
        if (snapshot.exists()) {
            alert('Пользователь с таким логином уже существует');
            return;
        }
        
        const newUser = {
            password: password,
            role: role,
            balance: balance,
            betLimit: settings.maxBetAmount,
            registeredAt: Date.now(),
            status: 'active'
        };
        
        await dbSet(userRef, newUser);
        
        // Очистить форму
        document.getElementById('newUserLogin').value = '';
        document.getElementById('newUserPassword').value = '';
        document.getElementById('newUserRole').value = 'user';
        document.getElementById('newUserBalance').value = settings.defaultBalance;
        
        closeModal('addUserModal');
        loadUsers();
        alert('Пользователь добавлен успешно!');
    } catch (error) {
        console.error('Ошибка добавления пользователя:', error);
        alert('Ошибка добавления пользователя');
    }
};

window.updateUser = async function() {
    const username = document.getElementById('editUserLogin')?.value;
    const role = document.getElementById('editUserRole')?.value;
    const balance = parseInt(document.getElementById('editUserBalance')?.value);
    const betLimit = parseInt(document.getElementById('editUserBetLimit')?.value);
    const newPassword = document.getElementById('editUserPassword')?.value.trim();
    
    if (!username) return;
    
    try {
        const userRef = dbRef(database, `users/${username}`);
        const updates = {
            role: role,
            balance: balance,
            betLimit: betLimit
        };
        
        if (newPassword) {
            updates.password = newPassword;
        }
        
        await dbUpdate(userRef, updates);
        
        closeModal('editUserModal');
        loadUsers();
        alert('Пользователь обновлен успешно!');
        
        // Обновить текущего пользователя если это он
        if (currentUser && currentUser.username === username) {
            currentUser.balance = balance;
            currentUser.role = role;
            updateUserInfo();
        }
    } catch (error) {
        console.error('Ошибка обновления пользователя:', error);
        alert('Ошибка обновления пользователя');
    }
};

window.toggleUserStatus = async function(username) {
    const user = allUsers[username];
    if (!user) return;
    
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'разблокировать' : 'заблокировать';
    
    if (!confirm(`Вы уверены, что хотите ${action} пользователя ${username}?`)) {
        return;
    }
    
    try {
        const userRef = dbRef(database, `users/${username}`);
        await dbUpdate(userRef, { status: newStatus });
        
        user.status = newStatus;
        displayUsers();
        
        const actionDone = newStatus === 'active' ? 'разблокирован' : 'заблокирован';
        alert(`Пользователь ${username} ${actionDone}`);
    } catch (error) {
        console.error('Ошибка изменения статуса пользователя:', error);
        alert('Ошибка изменения статуса пользователя');
    }
};

// ===== УПРАВЛЕНИЕ СТАВКАМИ (АДМИН) =====
async function loadBets() {
    try {
        const tbody = document.getElementById('betsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="9" class="loading">Загрузка ставок...</td></tr>';
        
        const betsRef = dbRef(database, 'bets');
        const snapshot = await dbGet(betsRef);
        
        if (snapshot.exists()) {
            allBets = snapshot.val();
            displayBets();
        } else {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #b0bec5;">Ставки не найдены</td></tr>';
        }
    } catch (error) {
        console.error('Ошибка загрузки ставок:', error);
        const tbody = document.getElementById('betsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #f44336;">Ошибка загрузки</td></tr>';
        }
    }
}

function displayBets() {
    const tbody = document.getElementById('betsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    Object.entries(allBets).forEach(([betId, bet]) => {
        const row = document.createElement('tr');
        
        const statusClass = `status-${bet.status}`;
        const potentialWin = (bet.amount * bet.coefficient).toFixed(2);
        const betDate = new Date(bet.timestamp).toLocaleString();
        
        row.innerHTML = `
            <td>${betId.substring(0, 8)}...</td>
            <td>${bet.user}</td>
            <td>${bet.type === 'single' ? 'Одиночная' : 'Экспресс'}</td>
            <td>${bet.amount} монет</td>
            <td>${bet.coefficient}</td>
            <td>${potentialWin} монет</td>
            <td><span class="${statusClass}">${getStatusName(bet.status)}</span></td>
            <td>${betDate}</td>
            <td>
                <button class="btn" onclick="viewBet('${betId}')">Просмотр</button>
                ${bet.status === 'pending' ? `<button class="btn btn-danger" onclick="cancelBet('${betId}')">Отменить</button>` : ''}
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function getStatusName(status) {
    const statuses = {
        'pending': 'Ожидает',
        'won': 'Выиграла',
        'lost': 'Проиграла',
        'cancelled': 'Отменена'
    };
    return statuses[status] || status;
}

window.filterBets = function() {
    const statusFilter = document.getElementById('betStatusFilter')?.value || 'all';
    const typeFilter = document.getElementById('betTypeFilter')?.value || 'all';
    const userFilter = document.getElementById('betUserFilter')?.value.toLowerCase() || '';
    
    const tbody = document.getElementById('betsTableBody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        if (row.cells.length < 9) return;
        
        const status = row.cells[6]?.textContent.toLowerCase() || '';
        const type = row.cells[2]?.textContent.toLowerCase() || '';
        const user = row.cells[1]?.textContent.toLowerCase() || '';
        
        const matchesStatus = statusFilter === 'all' || status.includes(getStatusName(statusFilter).toLowerCase());
        const matchesType = typeFilter === 'all' || type.includes(typeFilter === 'single' ? 'одиночная' : 'экспресс');
        const matchesUser = userFilter === '' || user.includes(userFilter);
        
        row.style.display = matchesStatus && matchesType && matchesUser ? '' : 'none';
    });
};

window.viewBet = function(betId) {
    const bet = allBets[betId];
    if (!bet) return;
    
    const details = document.getElementById('betDetails');
    if (!details) return;
    
    details.innerHTML = `
        <div class="admin-card">
            <p><strong>ID ставки:</strong> ${betId}</p>
            <p><strong>Пользователь:</strong> ${bet.user}</p>
            <p><strong>Тип:</strong> ${bet.type === 'single' ? 'Одиночная' : 'Экспресс'}</p>
            <p><strong>Сумма:</strong> ${bet.amount} монет</p>
            <p><strong>Коэффициент:</strong> ${bet.coefficient}</p>
            <p><strong>Возможный выигрыш:</strong> ${(bet.amount * bet.coefficient).toFixed(2)} монет</p>
            <p><strong>Статус:</strong> ${getStatusName(bet.status)}</p>
            <p><strong>Дата:</strong> ${new Date(bet.timestamp).toLocaleString()}</p>
            
            <h4 style="margin-top: 20px; margin-bottom: 10px;">События:</h4>
            ${bet.events.map(event => `
                <div style="background: rgba(255,255,255,0.1); padding: 10px; margin: 5px 0; border-radius: 8px;">
                    <strong>Событие:</strong> ${event.eventTitle || events[event.eventId]?.title || 'Неизвестное событие'}<br>
                    <strong>Выбор:</strong> ${event.option}<br>
                    <strong>Коэффициент:</strong> ${event.coefficient}
                </div>
            `).join('')}
        </div>
    `;
    
    const modal = document.getElementById('viewBetModal');
    if (modal) modal.style.display = 'block';
};

window.cancelBet = async function(betId) {
    if (!confirm('Вы уверены, что хотите отменить эту ставку?')) {
        return;
    }
    
    const bet = allBets[betId];
    if (!bet || bet.status !== 'pending') return;
    
    try {
        // Обновить статус ставки
        const betRef = dbRef(database, `bets/${betId}`);
        await dbUpdate(betRef, { 
            status: 'cancelled',
            cancelledAt: Date.now(),
            cancelledBy: currentUser.username
        });
        
        // Вернуть средства пользователю
        const userRef = dbRef(database, `users/${bet.user}`);
        const userSnapshot = await dbGet(userRef);
        
        if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            await dbUpdate(userRef, { 
                balance: userData.balance + bet.amount 
            });
        }
        
        bet.status = 'cancelled';
        displayBets();
        alert('Ставка отменена, средства возвращены пользователю');
    } catch (error) {
        console.error('Ошибка отмены ставки:', error);
        alert('Ошибка отмены ставки');
    }
};

// ===== НАСТРОЙКИ (АДМИН) =====
function loadAdminSettings() {
    document.getElementById('maxBetAmount').value = settings.maxBetAmount;
    document.getElementById('defaultBalance').value = settings.defaultBalance;
    document.getElementById('minBetAmount').value = settings.minBetAmount;
    document.getElementById('maxCoefficient').value = settings.maxCoefficient;
    document.getElementById('winCommission').value = settings.winCommission;
    document.getElementById('minWithdraw').value = settings.minWithdraw;
    document.getElementById('maxWithdrawPerDay').value = settings.maxWithdrawPerDay;
    document.getElementById('maintenanceMode').checked = settings.maintenanceMode;
    document.getElementById('maintenanceMessage').value = settings.maintenanceMessage;
}

window.saveSettings = async function() {
    try {
        const newSettings = {
            maxBetAmount: parseInt(document.getElementById('maxBetAmount')?.value) || 1000,
            defaultBalance: parseInt(document.getElementById('defaultBalance')?.value) || 5000,
            minBetAmount: parseInt(document.getElementById('minBetAmount')?.value) || 1,
            maxCoefficient: parseFloat(document.getElementById('maxCoefficient')?.value) || 50
        };
        
        Object.assign(settings, newSettings);
        
        const settingsRef = dbRef(database, 'settings');
        await dbUpdate(settingsRef, newSettings);
        
        alert('Основные настройки сохранены!');
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
        alert('Ошибка сохранения настроек');
    }
};

window.saveCommissionSettings = async function() {
    try {
        const commissionSettings = {
            winCommission: parseFloat(document.getElementById('winCommission')?.value) || 5,
            minWithdraw: parseInt(document.getElementById('minWithdraw')?.value) || 100,
            maxWithdrawPerDay: parseInt(document.getElementById('maxWithdrawPerDay')?.value) || 50000
        };
        
        Object.assign(settings, commissionSettings);
        
        const settingsRef = dbRef(database, 'settings');
        await dbUpdate(settingsRef, commissionSettings);
        
        alert('Настройки комиссий сохранены!');
    } catch (error) {
        console.error('Ошибка сохранения настроек комиссий:', error);
        alert('Ошибка сохранения настроек комиссий');
    }
};

window.toggleMaintenance = async function() {
    try {
        const maintenanceSettings = {
            maintenanceMode: document.getElementById('maintenanceMode')?.checked || false,
            maintenanceMessage: document.getElementById('maintenanceMessage')?.value || ''
        };
        
        Object.assign(settings, maintenanceSettings);
        
        const settingsRef = dbRef(database, 'settings');
        await dbUpdate(settingsRef, maintenanceSettings);
        
        const status = maintenanceSettings.maintenanceMode ? 'включен' : 'выключен';
        alert(`Режим технического обслуживания ${status}!`);
    } catch (error) {
        console.error('Ошибка изменения режима обслуживания:', error);
        alert('Ошибка изменения режима обслуживания');
    }
};

// ===== СТАТИСТИКА (АДМИН) =====
function loadStatistics() {
    // Подсчет общей статистики
    const totalUsers = Object.keys(allUsers).length;
    const totalBets = Object.keys(allBets).length;
    const totalVolume = Object.values(allBets).reduce((sum, bet) => sum + bet.amount, 0);
    const activeEvents = Object.values(events).filter(event => event.status === 'active').length;
    const totalBalance = Object.values(allUsers).reduce((sum, user) => sum + (user.balance || 0), 0);
    const pendingBets = Object.values(allBets).filter(bet => bet.status === 'pending').length;
    
    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('totalBets').textContent = totalBets;
    document.getElementById('totalVolume').textContent = totalVolume.toLocaleString();
    document.getElementById('activeEvents').textContent = activeEvents;
    document.getElementById('totalBalance').textContent = totalBalance.toLocaleString();
    document.getElementById('pendingBets').textContent = pendingBets;
    
    // Статистика по категориям
    const categoryStats = {};
    Object.values(events).forEach(event => {
        const category = event.category || 'unknown';
        if (!categoryStats[category]) {
            categoryStats[category] = { count: 0, bets: 0 };
        }
        categoryStats[category].count++;
    });
    
    // Подсчет ставок по категориям
    Object.values(allBets).forEach(bet => {
        bet.events.forEach(eventBet => {
            const event = events[eventBet.eventId];
            if (event) {
                const category = event.category || 'unknown';
                if (categoryStats[category]) {
                    categoryStats[category].bets++;
                }
            }
        });
    });
    
    const categoryStatsDiv = document.getElementById('categoryStats');
    if (categoryStatsDiv) {
        categoryStatsDiv.innerHTML = Object.entries(categoryStats).map(([category, stats]) => `
            <div style="margin-bottom: 10px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                <strong>${getCategoryName(category)}</strong><br>
                События: ${stats.count} | Ставки: ${stats.bets}
            </div>
        `).join('');
    }
    
    // Топ игроки по обороту
    const topPlayers = Object.entries(allUsers)
        .map(([username, user]) => ({
            username,
            volume: Object.values(allBets)
                .filter(bet => bet.user === username)
                .reduce((sum, bet) => sum + bet.amount, 0),
            balance: user.balance || 0
        }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5);
    
    const topPlayersDiv = document.getElementById('topPlayers');
    if (topPlayersDiv) {
        topPlayersDiv.innerHTML = topPlayers.map((player, index) => `
            <div style="margin-bottom: 10px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                <strong>${index + 1}. ${player.username}</strong><br>
                Оборот: ${player.volume.toLocaleString()} монет<br>
                Баланс: ${player.balance.toLocaleString()} монет
            </div>
        `).join('');
    }
}

function getCategoryName(category) {
    const categories = {
        'politics': '🏛️ Политика',
        'entertainment': '🎭 Развлечения',
        'technology': '💻 Технологии',
        'economics': '💰 Экономика',
        'weather': '🌤️ Погода',
        'society': '👥 Общество'
    };
    return categories[category] || '❓ Неизвестно';
}

// ===== УПРАВЛЕНИЕ СОБЫТИЯМИ (АДМИН) =====
window.addEvent = async function() {
    const category = document.getElementById('eventCategory')?.value;
    const title = document.getElementById('eventTitle')?.value.trim();
    const description = document.getElementById('eventDescription')?.value.trim();
    const optionsStr = document.getElementById('eventOptions')?.value.trim();
    const coefficientsStr = document.getElementById('eventCoefficients')?.value.trim();
    
    if (!title || !description || !optionsStr || !coefficientsStr) {
        alert('Заполните все поля');
        return;
    }
    
    const options = optionsStr.split(',').map(opt => opt.trim());
    const coefficients = coefficientsStr.split(',').map(coef => parseFloat(coef.trim()));
    
    if (options.length !== coefficients.length) {
        alert('Количество вариантов должно совпадать с количеством коэффициентов');
        return;
    }
    
    if (coefficients.some(coef => isNaN(coef) || coef < 1)) {
        alert('Все коэффициенты должны быть числами больше 1');
        return;
    }
    
    try {
        const eventsRef = dbRef(database, 'events');
        const newEventRef = dbPush(eventsRef);
        
        const event = {
            title: title,
            description: description,
            category: category,
            options: options,
            coefficients: coefficients,
            status: 'active',
            createdBy: currentUser.username,
            createdAt: Date.now()
        };
        
        await dbSet(newEventRef, event);
        
        // Очистить форму
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventDescription').value = '';
        document.getElementById('eventOptions').value = '';
        document.getElementById('eventCoefficients').value = '';
        
        loadAdminEvents();
        loadEvents(); // Обновить события для пользователей
        
        alert('Событие добавлено успешно!');
    } catch (error) {
        console.error('Ошибка добавления события:', error);
        alert('Ошибка добавления события');
    }
};

window.loadAdminEvents = async function() {
    try {
        const eventsRef = dbRef(database, 'events');
        const snapshot = await dbGet(eventsRef);
        
        if (snapshot.exists()) {
            const eventsData = snapshot.val();
            
            const container = document.getElementById('adminEventsList');
            if (container) {
                container.innerHTML = Object.entries(eventsData).map(([eventId, event]) => `
                    <div style="background: rgba(255,255,255,0.1); padding: 15px; margin: 10px 0; border-radius: 8px;">
                        <strong>${event.title}</strong><br>
                        <small>Категория: ${getCategoryName(event.category)} | Статус: ${event.status}</small><br>
                        <small>Варианты: ${event.options.join(', ')}</small><br>
                        <small>Коэффициенты: ${event.coefficients.join(', ')}</small><br>
                        <button class="btn" style="padding: 6px 12px; font-size: 12px; margin-top: 10px;" onclick="editEvent('${eventId}')">Редактировать</button>
                        <button class="btn btn-warning" style="padding: 6px 12px; font-size: 12px;" onclick="finishEvent('${eventId}')">Завершить</button>
                        <button class="btn btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="deleteEvent('${eventId}')">Удалить</button>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки событий:', error);
    }
};

window.finishEvent = async function(eventId) {
    const winningOption = prompt('Введите выигрышный вариант:');
    if (!winningOption) return;
    
    try {
        // Завершить событие
        const eventRef = dbRef(database, `events/${eventId}`);
        await dbUpdate(eventRef, { 
            status: 'finished',
            winningOption: winningOption,
            finishedAt: Date.now(),
            finishedBy: currentUser.username
        });
        
        // Обработать все ставки на это событие
        await processEventBets(eventId, winningOption);
        
        loadAdminEvents();
        loadEvents();
        
        alert('Событие завершено, ставки обработаны');
    } catch (error) {
        console.error('Ошибка завершения события:', error);
        alert('Ошибка завершения события');
    }
};

async function processEventBets(eventId, winningOption) {
    try {
        const betsRef = dbRef(database, 'bets');
        const snapshot = await dbGet(betsRef);
        
        if (!snapshot.exists()) return;
        
        const allBets = snapshot.val();
        const updates = {};
        
        for (const [betId, bet] of Object.entries(allBets)) {
            if (bet.status !== 'pending') continue;
            
            // Проверить, содержит ли ставка это событие
            const eventBet = bet.events.find(e => e.eventId === eventId);
            if (!eventBet) continue;
            
            if (bet.type === 'single' && bet.events.length === 1) {
                // Одиночная ставка
                if (eventBet.option === winningOption) {
                    // Выигрыш
                    const winAmount = bet.amount * bet.coefficient;
                    updates[`bets/${betId}/status`] = 'won';
                    updates[`bets/${betId}/winAmount`] = winAmount;
                    
                    // Начислить выигрыш пользователю
                    const userRef = dbRef(database, `users/${bet.user}`);
                    const userSnapshot = await dbGet(userRef);
                    if (userSnapshot.exists()) {
                        const userData = userSnapshot.val();
                        updates[`users/${bet.user}/balance`] = userData.balance + winAmount;
                    }
                } else {
                    // Проигрыш
                    updates[`bets/${betId}/status`] = 'lost';
                }
            } else if (bet.type === 'express') {
                // Экспресс ставка - нужно проверить остальные события
                // Пока что просто помечаем как требующую дальнейшей обработки
                updates[`bets/${betId}/needsProcessing`] = true;
            }
        }
        
        if (Object.keys(updates).length > 0) {
            await dbUpdate(dbRef(database), updates);
        }
    } catch (error) {
        console.error('Ошибка обработки ставок:', error);
    }
}

window.deleteEvent = async function(eventId) {
    if (!confirm('Вы уверены, что хотите удалить это событие? Это действие необратимо!')) {
        return;
    }
    
    try {
        const eventRef = dbRef(database, `events/${eventId}`);
        await dbSet(eventRef, null);
        
        loadAdminEvents();
        loadEvents();
        
        alert('Событие удалено');
    } catch (error) {
        console.error('Ошибка удаления события:', error);
        alert('Ошибка удаления события');
    }
};

window.loadUnfinishedEvents = function() {
    alert('Функция поиска незавершенных событий - в разработке');
};

window.fixEventsCategories = function() {
    alert('Функция исправления категорий событий - в разработке');
};

// ===== МОДАЛЬНЫЕ ОКНА =====
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
};

// ===== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ =====
window.exportData = function() {
    const data = {
        users: allUsers,
        bets: allBets,
        events: events,
        settings: settings,
        exportDate: new Date().toISOString(),
        exportedBy: currentUser.username
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maxbet_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert('Данные экспортированы успешно!');
};

window.cleanOldBets = async function() {
    if (!confirm('Удалить ставки старше 30 дней? Это действие необратимо!')) return;
    
    try {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        let deletedCount = 0;
        const updates = {};
        
        Object.entries(allBets).forEach(([betId, bet]) => {
            if (bet.timestamp < thirtyDaysAgo && bet.status !== 'pending') {
                updates[`bets/${betId}`] = null;
                delete allBets[betId];
                deletedCount++;
            }
        });
        
        if (deletedCount > 0) {
            await dbUpdate(dbRef(database), updates);
        }
        
        alert(`Удалено ${deletedCount} старых ставок`);
        if (currentAdminTab === 'bets') displayBets();
    } catch (error) {
        console.error('Ошибка очистки старых ставок:', error);
        alert('Ошибка очистки старых ставок');
    }
};

window.resetAllBalances = async function() {
    if (!confirm('Сбросить балансы всех пользователей до стартового значения? Это действие необратимо!')) {
        return;
    }
    
    try {
        const updates = {};
        Object.keys(allUsers).forEach(username => {
            updates[`users/${username}/balance`] = settings.defaultBalance;
            allUsers[username].balance = settings.defaultBalance;
        });
        
        await dbUpdate(dbRef(database), updates);
        
        alert('Балансы всех пользователей сброшены!');
        if (currentAdminTab === 'users') displayUsers();
        
        // Обновить текущего пользователя
        if (currentUser && allUsers[currentUser.username]) {
            currentUser.balance = settings.defaultBalance;
            updateUserInfo();
        }
    } catch (error) {
        console.error('Ошибка сброса балансов:', error);
        alert('Ошибка сброса балансов');
    }
};

function showMaintenanceMessage() {
    if (settings.maintenanceMode && settings.maintenanceMessage) {
        alert('Техническое обслуживание: ' + settings.maintenanceMessage);
    }
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ =====
window.addEventListener('click', function(event) {
    // Закрытие модальных окон по клику вне их
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

// Добавляем обработчики для Enter в формах
document.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        if (event.target.id === 'loginPassword') {
            attemptLogin();
        } else if (event.target.id === 'registerConfirmPassword') {
            attemptRegister();
        } else if (event.target.id === 'bet-amount') {
            // Автоматически сделать ставку при нажатии Enter в поле суммы
            if (betSlip.length === 1) {
                placeBet('single');
            } else if (betSlip.length > 1) {
                placeBet('express');
            }
        }
    }
});

// ===== ДОПОЛНИТЕЛЬНЫЕ ОБРАБОТЧИКИ ДЛЯ АВТООБНОВЛЕНИЯ =====

// Автообновление баланса пользователя каждые 30 секунд
setInterval(async function() {
    if (currentUser) {
        try {
            const userRef = dbRef(database, `users/${currentUser.username}`);
            const snapshot = await dbGet(userRef);
            
            if (snapshot.exists()) {
                const userData = snapshot.val();
                if (userData.balance !== currentUser.balance) {
                    currentUser.balance = userData.balance;
                    updateUserInfo();
                }
            }
        } catch (error) {
            console.error('Ошибка автообновления баланса:', error);
        }
    }
}, 30000);

// Автообновление истории ставок каждые 60 секунд
setInterval(function() {
    if (currentUser && document.getElementById('user-tab-history').classList.contains('active')) {
        loadUserBetsHistory();
    }
}, 60000);

// ===== УТИЛИТЫ ДЛЯ РАБОТЫ С LOCALSTORAGE =====

// Сохранение настроек интерфейса
function saveUISettings() {
    const uiSettings = {
        lastActiveTab: document.querySelector('.nav-tab.active')?.textContent || 'События',
        betSlipCollapsed: false // Для будущих функций
    };
    localStorage.setItem('maxbet_ui_settings', JSON.stringify(uiSettings));
}

function loadUISettings() {
    try {
        const saved = localStorage.getItem('maxbet_ui_settings');
        if (saved) {
            const uiSettings = JSON.parse(saved);
            // Восстановление настроек интерфейса
            return uiSettings;
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек интерфейса:', error);
    }
    return null;
}

// ===== ВАЛИДАЦИЯ ДАННЫХ =====

function validateBetAmount(amount) {
    if (!amount || isNaN(amount)) {
        return { valid: false, message: 'Введите корректную сумму' };
    }
    
    if (amount < settings.minBetAmount) {
        return { valid: false, message: `Минимальная ставка: ${settings.minBetAmount} монет` };
    }
    
    if (amount > currentUser.balance) {
        return { valid: false, message: 'Недостаточно средств на балансе' };
    }
    
    if (amount > currentUser.betLimit) {
        return { valid: false, message: `Превышен лимит ставки: ${currentUser.betLimit} монет` };
    }
    
    return { valid: true };
}

function validateEventData(title, description, options, coefficients) {
    if (!title || title.trim().length < 3) {
        return { valid: false, message: 'Название события должно содержать минимум 3 символа' };
    }
    
    if (!description || description.trim().length < 10) {
        return { valid: false, message: 'Описание должно содержать минимум 10 символов' };
    }
    
    if (options.length < 2) {
        return { valid: false, message: 'Должно быть минимум 2 варианта ответа' };
    }
    
    if (options.length !== coefficients.length) {
        return { valid: false, message: 'Количество вариантов должно совпадать с количеством коэффициентов' };
    }
    
    if (coefficients.some(coef => isNaN(coef) || coef < 1 || coef > settings.maxCoefficient)) {
        return { valid: false, message: `Коэффициенты должны быть от 1 до ${settings.maxCoefficient}` };
    }
    
    return { valid: true };
}

// ===== УВЕДОМЛЕНИЯ =====

function showNotification(message, type = 'info') {
    // Создать контейнер для уведомлений если его нет
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 300px;
        `;
        document.body.appendChild(notificationContainer);
    }
    
    // Создать уведомление
    const notification = document.createElement('div');
    notification.style.cssText = `
        background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#4fc3f7'};
        color: white;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
        position: relative;
        padding-right: 40px;
    `;
    
    notification.innerHTML = `
        ${message}
        <button onclick="this.parentNode.remove()" 
                style="position: absolute; top: 5px; right: 10px; background: none; border: none; color: white; font-size: 20px; cursor: pointer;">×</button>
    `;
    
    // Добавить анимацию
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    if (!document.querySelector('style[data-notifications]')) {
        style.setAttribute('data-notifications', 'true');
        document.head.appendChild(style);
    }
    
    notificationContainer.appendChild(notification);
    
    // Автоудаление через 5 секунд
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// ===== ФУНКЦИИ ДЛЯ ОТЛАДКИ И МОНИТОРИНГА =====

// Логирование действий пользователей
function logUserAction(action, details = {}) {
    if (!currentUser) return;
    
    const logEntry = {
        user: currentUser.username,
        action: action,
        details: details,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
    };
    
    // В реальном приложении здесь бы отправлялись данные на сервер
    console.log('User Action:', logEntry);
    
    // Сохранение в localStorage для отладки
    try {
        const logs = JSON.parse(localStorage.getItem('maxbet_logs') || '[]');
        logs.push(logEntry);
        
        // Ограничить количество логов до 100
        if (logs.length > 100) {
            logs.splice(0, logs.length - 100);
        }
        
        localStorage.setItem('maxbet_logs', JSON.stringify(logs));
    } catch (error) {
        console.error('Ошибка сохранения лога:', error);
    }
}

// Мониторинг производительности
function measurePerformance(operationName, operation) {
    const startTime = performance.now();
    
    Promise.resolve(operation()).then(() => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`Performance: ${operationName} took ${duration.toFixed(2)}ms`);
        
        // Логировать медленные операции
        if (duration > 1000) {
            logUserAction('slow_operation', { 
                operation: operationName, 
                duration: duration 
            });
        }
    }).catch(error => {
        console.error(`Error in ${operationName}:`, error);
        logUserAction('operation_error', { 
            operation: operationName, 
            error: error.message 
        });
    });
}

// ===== ОБРАБОТКА ОШИБОК =====

window.addEventListener('error', function(event) {
    console.error('JavaScript Error:', event.error);
    logUserAction('javascript_error', {
        message: event.error?.message,
        filename: event.filename,
        lineno: event.lineno,
        stack: event.error?.stack
    });
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled Promise Rejection:', event.reason);
    logUserAction('promise_rejection', {
        reason: event.reason?.toString(),
        stack: event.reason?.stack
    });
});

// ===== ОБРАБОТЧИКИ ИЗМЕНЕНИЯ ВИДИМОСТИ СТРАНИЦЫ =====

document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Страница скрыта
        logUserAction('page_hidden');
    } else {
        // Страница снова видима
        logUserAction('page_visible');
        
        // Обновить данные при возвращении на страницу
        if (currentUser) {
            updateUserInfo();
            
            // Обновить текущую вкладку
            const activeTab = document.querySelector('.nav-tab.active');
            if (activeTab) {
                const tabName = activeTab.textContent.toLowerCase();
                if (tabName.includes('события')) {
                    loadEvents();
                } else if (tabName.includes('история')) {
                    loadUserBetsHistory();
                }
            }
        }
    }
});

// ===== ОБРАБОТЧИКИ ИЗМЕНЕНИЯ РАЗМЕРА ОКНА =====

window.addEventListener('resize', function() {
    // Сохранить размер окна для аналитики
    logUserAction('window_resize', {
        width: window.innerWidth,
        height: window.innerHeight
    });
});

// ===== ЗАВЕРШЕНИЕ ИНИЦИАЛИЗАЦИИ =====

// Обновленный обработчик загрузки страницы
window.addEventListener('load', function() {
    logUserAction('page_loaded');
    
    // Загрузить настройки интерфейса
    const uiSettings = loadUISettings();
    if (uiSettings) {
        console.log('UI settings loaded:', uiSettings);
    }
    
    // Показать приветственное сообщение в консоли
    console.log('%c🎯 MaxBet System Loaded', 'color: #4fc3f7; font-size: 20px; font-weight: bold;');
    console.log('%cВерсия: 1.0.0', 'color: #b0bec5;');
    console.log('%cРазработано для E2E тестирования', 'color: #b0bec5;');
});

// Обработчик выгрузки страницы
window.addEventListener('beforeunload', function(event) {
    if (currentUser) {
        logUserAction('page_unload');
        saveUISettings();
    }
    
    // Предупреждение если есть несохраненные ставки
    if (betSlip && betSlip.length > 0) {
        event.preventDefault();
        event.returnValue = 'У вас есть несохраненные ставки. Вы уверены, что хотите покинуть страницу?';
        return event.returnValue;
    }
});

// ===== ЭКСПОРТ ФУНКЦИЙ ДЛЯ ТЕСТИРОВАНИЯ =====

// Функции для E2E тестирования
window.MaxBetTestUtils = {
    // Получить текущего пользователя
    getCurrentUser: () => currentUser,
    
    // Получить корзину ставок
    getBetSlip: () => betSlip,
    
    // Получить все события
    getEvents: () => events,
    
    // Получить настройки
    getSettings: () => settings,
    
    // Очистить все данные (для тестов)
    clearAllData: () => {
        localStorage.clear();
        currentUser = null;
        betSlip = [];
        events = {};
        allUsers = {};
        allBets = {};
    },
    
    // Установить тестового пользователя
    setTestUser: (userData) => {
        currentUser = userData;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserInfo();
    },
    
    // Добавить тестовое событие
    addTestEvent: (eventData) => {
        const eventId = 'test_' + Date.now();
        events[eventId] = eventData;
        displayEvents();
        return eventId;
    },
    
    // Получить логи для анализа
    getLogs: () => {
        try {
            return JSON.parse(localStorage.getItem('maxbet_logs') || '[]');
        } catch {
            return [];
        }
    },
    
    // Симулировать клик по элементу
    simulateClick: (selector) => {
        const element = document.querySelector(selector);
        if (element) {
            element.click();
            return true;
        }
        return false;
    },
    
    // Ждать появления элемента
    waitForElement: (selector, timeout = 5000) => {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }
            
            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }
};

console.log('MaxBet приложение полностью загружено и готово к использованию!');
console.log('Для E2E тестирования доступен объект: window.MaxBetTestUtils');
// ===== ДОПОЛНЕНИЯ К app.js =====
// Добавьте эти функции в конец вашего app.js файла

// Переопределение функций интерфейса
window.showUserInterface = function() {
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    // Показать админ панель если пользователь админ или модератор
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator')) {
        document.getElementById('admin-nav-tab').style.display = 'block';
    }
    
    updateUserInfo();
    loadEvents();
};

window.showLoginInterface = function() {
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('admin-nav-tab').style.display = 'none';
};

// Обновление отображения событий для нового интерфейса
window.displayEvents = function() {
    const eventsContainer = document.getElementById('events-container');
    if (!eventsContainer || !events) return;
    
    eventsContainer.innerHTML = '';
    
    const eventEntries = Object.entries(events);
    if (eventEntries.length === 0) {
        eventsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #b0bec5;"><h3>Пока нет активных событий</h3><p>Следите за обновлениями!</p></div>';
        return;
    }
    
    eventEntries.forEach(([eventId, event]) => {
        if (event.status !== 'active') return;
        
        const eventElement = document.createElement('div');
        eventElement.className = 'event-card';
        eventElement.setAttribute('data-event-id', eventId);
        eventElement.innerHTML = `
            <div class="event-header">
                <div>
                    <h3 class="event-title">${event.title}</h3>
                </div>
                <span class="event-category">${getCategoryName(event.category)}</span>
            </div>
            <p class="event-description">${event.description}</p>
            <div class="event-options">
                ${event.options.map((option, index) => `
                    <button class="option-btn" onclick="selectOption('${eventId}', '${option}', ${event.coefficients[index]})">
                        <span>${option}</span>
                        <span>${event.coefficients[index]}</span>
                    </button>
                `).join('')}
            </div>
        `;
        
        eventsContainer.appendChild(eventElement);
    });
};

// Интеграция с корзиной ставок
window.selectOption = function(eventId, option, coefficient) {
    if (!currentUser) {
        alert('Войдите в систему, чтобы делать ставки');
        return;
    }
    
    // Убрать выделение с других кнопок этого события
    document.querySelectorAll(`[data-event-id="${eventId}"] .option-btn`).forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Выделить выбранную кнопку
    event.target.classList.add('selected');
    
    // Добавить в корзину ставок
    addToBetSlip(eventId, option, coefficient);
};

// Функция добавления в корзину ставок
function addToBetSlip(eventId, option, coefficient) {
    const event = events ? events[eventId] : null;
    if (!event) return;
    
    // Проверить, не добавлена ли уже ставка на это событие
    const existingIndex = betSlip.findIndex(item => item.eventId === eventId);
    
    if (existingIndex !== -1) {
        // Заменить существующую ставку
        betSlip[existingIndex] = {
            eventId: eventId,
            eventTitle: event.title,
            option: option,
            coefficient: coefficient
        };
    } else {
        // Добавить новую ставку
        betSlip.push({
            eventId: eventId,
            eventTitle: event.title,
            option: option,
            coefficient: coefficient
        });
    }
    
    updateBetSlipDisplay();
}

// Обновление отображения корзины ставок
function updateBetSlipDisplay() {
    const container = document.getElementById('bet-slip-content');
    if (!container) return;
    
    if (betSlip.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #b0bec5; padding: 20px;">Выберите варианты из событий</p>';
        return;
    }
    
    const totalCoefficient = betSlip.reduce((total, bet) => total * bet.coefficient, 1);
    const maxBet = currentUser ? Math.min(currentUser.balance, currentUser.betLimit || 1000) : 1000;
    
    container.innerHTML = `
        <div class="bet-slip-items">
            ${betSlip.map((bet, index) => `
                <div class="bet-slip-item">
                    <div class="bet-slip-event">${bet.eventTitle}</div>
                    <div class="bet-slip-option">${bet.option} (${bet.coefficient})</div>
                    <button class="btn-remove" onclick="removeFromBetSlip(${index})">×</button>
                </div>
            `).join('')}
        </div>
        <div class="bet-slip-total">
            <div>Общий коэффициент: ${totalCoefficient.toFixed(2)}</div>
        </div>
        <div class="bet-slip-controls">
            <input type="number" id="bet-amount" placeholder="Сумма ставки" min="1" max="${maxBet}">
            <button class="btn" onclick="placeBet('single')" style="width: 100%; margin-bottom: 10px;">Одиночная ставка</button>
            ${betSlip.length > 1 ? '<button class="btn" onclick="placeBet(\'express\')" style="width: 100%;">Экспресс</button>' : ''}
        </div>
    `;
}

// Удаление из корзины ставок
window.removeFromBetSlip = function(index) {
    // Убрать выделение с кнопки
    const removedBet = betSlip[index];
    if (removedBet) {
        document.querySelectorAll(`[data-event-id="${removedBet.eventId}"] .option-btn`).forEach(btn => {
            btn.classList.remove('selected');
        });
    }
    
    betSlip.splice(index, 1);
    updateBetSlipDisplay();
};

// Обновленная функция размещения ставки
window.placeBet = async function(type) {
    if (!currentUser) {
        alert('Войдите в систему');
        return;
    }
    
    if (betSlip.length === 0) {
        alert('Корзина ставок пуста');
        return;
    }
    
    const amount = parseInt(document.getElementById('bet-amount').value);
    
    if (!amount || amount < settings.minBetAmount) {
        alert(`Минимальная ставка: ${settings.minBetAmount} монет`);
        return;
    }
    
    if (amount > currentUser.balance) {
        alert('Недостаточно средств');
        return;
    }
    
    if (amount > (currentUser.betLimit || settings.maxBetAmount)) {
        alert(`Превышен лимит ставки: ${currentUser.betLimit || settings.maxBetAmount} монет`);
        return;
    }
    
    try {
        let coefficient;
        let eventsList;
        
        if (type === 'single' && betSlip.length === 1) {
            coefficient = betSlip[0].coefficient;
            eventsList = betSlip;
        } else if (type === 'express' && betSlip.length > 1) {
            coefficient = betSlip.reduce((total, bet) => total * bet.coefficient, 1);
            eventsList = betSlip;
        } else {
            alert('Неверный тип ставки');
            return;
        }
        
        // Создать ставку в базе данных
        const betsRef = dbRef(database, 'bets');
        const newBetRef = dbPush(betsRef);
        
        const bet = {
            user: currentUser.username,
            type: type,
            amount: amount,
            coefficient: parseFloat(coefficient.toFixed(2)),
            status: 'pending',
            timestamp: Date.now(),
            events: eventsList
        };
        
        await dbSet(newBetRef, bet);
        
        // Обновить баланс пользователя
        const userRef = dbRef(database, `users/${currentUser.username}`);
        await dbUpdate(userRef, { 
            balance: currentUser.balance - amount 
        });
        
        currentUser.balance -= amount;
        updateUserInfo();
        
        // Очистить корзину ставок
        betSlip = [];
        
        // Убрать выделение с всех кнопок
        document.querySelectorAll('.option-btn.selected').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        updateBetSlipDisplay();
        
        // Обновить историю ставок если она открыта
        const historyTab = document.getElementById('main-tab-history');
        if (historyTab && !historyTab.classList.contains('hidden')) {
            loadUserBetsHistory();
        }
        
        alert('Ставка размещена успешно!');
        
    } catch (error) {
        console.error('Ошибка размещения ставки:', error);
        alert('Ошибка размещения ставки');
    }
};

// Обновление информации о пользователе
window.updateUserInfo = function() {
    if (!currentUser) return;
    
    // Обновить отображение баланса
    const balanceElements = document.querySelectorAll('.user-balance');
    balanceElements.forEach(el => {
        el.textContent = `${currentUser.balance.toLocaleString()} монет`;
    });
    
    // Обновить отображение имени пользователя
    const usernameElements = document.querySelectorAll('.username');
    usernameElements.forEach(el => {
        el.textContent = currentUser.username;
    });
    
    // Обновить роль
    const roleElements = document.querySelectorAll('.user-role');
    roleElements.forEach(el => {
        el.textContent = getRoleName(currentUser.role);
    });
    
    // Обновить максимальную ставку в поле
    const betAmountInput = document.getElementById('bet-amount');
    if (betAmountInput) {
        const maxBet = Math.min(currentUser.balance, currentUser.betLimit || settings.maxBetAmount);
        betAmountInput.setAttribute('max', maxBet);
    }
};

// Функция загрузки истории ставок пользователя
window.loadUserBetsHistory = async function() {
    if (!currentUser) return;
    
    try {
        const betsRef = dbRef(database, 'bets');
        const snapshot = await dbGet(betsRef);
        
        if (snapshot.exists()) {
            const allBets = snapshot.val();
            const userBets = Object.entries(allBets)
                .filter(([betId, bet]) => bet.user === currentUser.username)
                .sort(([, a], [, b]) => b.timestamp - a.timestamp);
            
            displayUserBetsHistory(userBets);
            displayUserStats(userBets);
        } else {
            displayUserBetsHistory([]);
        }
    } catch (error) {
        console.error('Ошибка загрузки истории ставок:', error);
        const historyContainer = document.getElementById('user-bets-history');
        if (historyContainer) {
            historyContainer.innerHTML = '<p style="text-align: center; color: #f44336;">Ошибка загрузки истории ставок</p>';
        }
    }
};

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Переинициализация корзины ставок
    if (typeof betSlip === 'undefined') {
        window.betSlip = [];
    }
    
    console.log('MaxBet интерфейс полностью загружен');
});
