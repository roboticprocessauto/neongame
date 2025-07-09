// ===== MAIN.JS С ИСПРАВЛЕННОЙ ИНИЦИАЛИЗАЦИЕЙ =====

// Используем совместимую версию Firebase
let database = null;

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function getCategoryName(category) {
    const categories = {
        'politics': '🏛️ Политика',
        'entertainment': '🎭 Развлечения',
        'technology': '💻 Технологии',
        'economics': '💰 Экономика',
        'weather': '🌤️ Погода',
        'society': '👥 Общество'
    };
    return categories[category] || category;
}

// Инициализация Firebase
function initializeFirebase() {
    if (!window.firebase) {
        throw new Error('Firebase не загружен');
    }
    if (!window.firebase.apps.length) {
        window.firebase.initializeApp(window.firebaseConfig);
    }
    database = window.firebase.database();
    console.log('🔥 Firebase инициализирован в main.js');
}

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
window.currentUser = null;
window.events = {};
let betSlip = [];
let settings = {
    maxBetAmount: 1000,
    defaultBalance: 5000,
    minBetAmount: 1,
    maxCoefficient: 50
};

// Награды за ежедневный бонус
const dailyRewards = [250, 500, 1000, 2000, 3000, 5000, 7000];

// ===== ИСПРАВЛЕННАЯ ИНИЦИАЛИЗАЦИЯ =====
window.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Инициализация main.js');
    
    try {
        console.log('1️⃣ Инициализация Firebase...');
        initializeFirebase();
        
        console.log('2️⃣ Ожидание DataSyncManager...');
        await waitForSyncManager();
        
        console.log('3️⃣ Проверка авторизации и синхронизация пользователя...');
        await checkAuth();
        
        console.log('4️⃣ Загрузка настроек...');
        await loadSettings();
        
        console.log('5️⃣ Загрузка событий...');
        await loadEvents();
        
        console.log('6️⃣ Настройка слушателей...');
        setupSyncEventListeners();
        
        console.log('7️⃣ Принудительная синхронизация пользователя...');
        // ИСПРАВЛЕНИЕ: Принудительно синхронизируем пользователя
        forceSyncUser();
        
        console.log('8️⃣ Обновление интерфейса...');
        updateUserInfo();
        updateDailyBonusButton();
        
        console.log('✅ main.js полностью инициализирован');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации main.js:', error);
        showNotification('Ошибка инициализации приложения: ' + error.message, 'error');
        
        // Fallback: попробовать работать без sync manager
        console.log('🔄 Запуск fallback инициализации...');
        await fallbackInitialization();
    }
});

// ===== ОЖИДАНИЕ SYNC MANAGER =====
async function waitForSyncManager() {
    let attempts = 0;
    const maxAttempts = 50; // 5 секунд
    
    while (!window.dataSyncManager && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (!window.dataSyncManager) {
        console.warn('⚠️ DataSyncManager не найден, переход в fallback режим');
        throw new Error('DataSyncManager недоступен');
    }
    
    console.log('✅ DataSyncManager готов к работе');
}

// ===== ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ =====
function forceSyncUser() {
    if (window.dataSyncManager && window.dataSyncManager.getCurrentUser()) {
        console.log('🔄 Принудительная синхронизация пользователя...');
        window.currentUser = window.dataSyncManager.getCurrentUser();
        
        updateUserInfo();
        showRoleSpecificLinks();
        updateDailyBonusButton();
        
        console.log('✅ Пользователь синхронизирован:', window.currentUser.username);
        return true;
    } else {
        console.log('❌ Нет данных пользователя в DataSyncManager');
        return false;
    }
}

// ===== FALLBACK ИНИЦИАЛИЗАЦИЯ =====
async function fallbackInitialization() {
    console.log('🔄 Запуск fallback инициализации без sync manager');
    
    try {
        await checkAuthFallback();
        await loadSettings();
        await loadEvents();
        updateUserInfo();
        updateDailyBonusButton();
        
        console.log('✅ Fallback инициализация завершена');
    } catch (error) {
        console.error('❌ Критическая ошибка fallback инициализации:', error);
        showNotification('Критическая ошибка загрузки. Перезагрузите страницу.', 'error');
    }
}

// ===== АВТОРИЗАЦИЯ С СИНХРОНИЗАЦИЕЙ =====
async function checkAuth() {
    console.log('🔐 Проверка авторизации с синхронизацией');
    
    try {
        // Сначала попробуем загрузить из sync manager
        let savedUser = window.dataSyncManager.getLocalUser();
        
        if (!savedUser) {
            savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                savedUser = JSON.parse(savedUser);
            }
        }
        
        if (!savedUser) {
            console.log('❌ Пользователь не найден, перенаправление на login');
            window.location.href = 'login.html';
            return;
        }
        
        console.log('👤 Найден пользователь, инициализация синхронизации:', savedUser.username);
        
        // Инициализировать пользователя в sync manager
        window.currentUser = await window.dataSyncManager.initializeUser(savedUser.username);
        
        console.log('✅ Авторизация и синхронизация завершены');
        
    } catch (error) {
        console.error('❌ Ошибка проверки авторизации:', error);
        throw error;
    }
}

// ===== FALLBACK АВТОРИЗАЦИЯ =====
async function checkAuthFallback() {
    console.log('🔐 Fallback проверка авторизации');
    
    try {
        const savedUser = localStorage.getItem('currentUser');
        
        if (!savedUser) {
            console.log('❌ Пользователь не найден, перенаправление на login');
            window.location.href = 'login.html';
            return;
        }
        
        window.currentUser = JSON.parse(savedUser);
        console.log('👤 Найден пользователь:', window.currentUser.username);
        
        // Проверяем актуальность данных в Firebase
        const userRef = database.ref(`users/${window.currentUser.username}`);
        const snapshot = await userRef.once('value');
        
        if (!snapshot.exists()) {
            console.log('❌ Пользователь не найден в базе данных');
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
            return;
        }
        
        const firebaseData = snapshot.val();
        
        if (firebaseData.status !== 'active') {
            console.log('⚠️ Аккаунт заблокирован');
            localStorage.removeItem('currentUser');
            showNotification('Ваш аккаунт заблокирован', 'error');
            setTimeout(() => window.location.href = 'login.html', 2000);
            return;
        }
        
        // Обновить локальные данные
        window.currentUser = {
            username: window.currentUser.username,
            ...firebaseData
        };
        localStorage.setItem('currentUser', JSON.stringify(window.currentUser));
        
        console.log('✅ Fallback авторизация завершена');
        
    } catch (error) {
        console.error('❌ Ошибка fallback авторизации:', error);
        throw error;
    }
}

// ===== НАСТРОЙКА СЛУШАТЕЛЕЙ СИНХРОНИЗАЦИИ =====
function setupSyncEventListeners() {
    if (!window.dataSyncManager) return;
    
    console.log('🎧 Настройка слушателей событий синхронизации');
    
    window.addEventListener('dataSync', (event) => {
        const { type, data } = event.detail;
        console.log(`📡 Получено событие синхронизации: ${type}`);
        
        switch (type) {
            case 'user_updated':
            case 'user_refreshed':
                handleUserDataUpdate(data);
                break;
                
            case 'user_updated_offline':
                handleOfflineUserUpdate(data);
                break;
                
            case 'events_updated':
                handleEventsUpdate(data);
                break;
                
            case 'settings_updated':
                handleSettingsUpdate(data);
                break;
                
            case 'connection_restored':
                handleConnectionRestored();
                break;
                
            case 'connection_lost':
                handleConnectionLost();
                break;
        }
    });
    
    // Добавить индикатор синхронизации в интерфейс
    addSyncStatusIndicator();
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ СИНХРОНИЗАЦИИ =====
function handleUserDataUpdate(data) {
    if (data.user) {
        window.currentUser = data.user;
        
        // Обновить интерфейс
        updateUserInfo();
        updateDailyBonusButton();
        
        // Показать уведомления о важных изменениях
        if (data.changes && data.changes.length > 0) {
            data.changes.forEach(change => {
                if (change.field === 'balance' && change.oldValue !== undefined) {
                    const diff = change.newValue - change.oldValue;
                    if (Math.abs(diff) > 0) {
                        showBalanceChangeNotification(diff);
                    }
                }
            });
        }
        
        console.log('🔄 Интерфейс обновлен с новыми данными пользователя');
    }
}

function handleOfflineUserUpdate(data) {
    if (data.user) {
        window.currentUser = data.user;
        updateUserInfo();
        showNotification('Данные обновлены локально (офлайн режим)', 'warning');
    }
}

function handleEventsUpdate(data) {
    window.events = data;
    displayEvents();
    console.log('📅 События обновлены в реальном времени');
}

function handleSettingsUpdate(data) {
    Object.assign(settings, data);
    console.log('⚙️ Настройки обновлены');
}

function handleConnectionRestored() {
    showNotification('Соединение восстановлено! Синхронизация данных...', 'success');
    updateSyncStatus(true);
}

function handleConnectionLost() {
    showNotification('Соединение потеряно. Переход в офлайн режим.', 'warning');
    updateSyncStatus(false);
}

// ===== ОБНОВЛЕНИЕ ИНТЕРФЕЙСА =====
function updateUserInfo() {
    // ИСПРАВЛЕНИЕ: Принудительно синхронизируем пользователя если нужно
    if (!window.currentUser && window.dataSyncManager && window.dataSyncManager.getCurrentUser()) {
        window.currentUser = window.dataSyncManager.getCurrentUser();
        console.log('🔄 Пользователь автоматически синхронизирован в updateUserInfo');
    }
    
    if (!window.currentUser) {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            window.currentUser = JSON.parse(savedUser);
            console.log('📱 window.currentUser восстановлен из localStorage');
        } else {
            console.warn('⚠️ window.currentUser не найден');
            return;
        }
    }
    
    const balanceElement = document.getElementById('user-balance');
    const usernameElement = document.getElementById('username');
    
    if (balanceElement && window.currentUser.balance !== undefined) {
        balanceElement.textContent = `${window.currentUser.balance.toLocaleString()} лупанчиков`;
    }
    
    if (usernameElement && window.currentUser.username) {
        usernameElement.textContent = window.currentUser.username;
    }
    
    // Обновить индикатор синхронизации
    updateSyncStatusIndicator();
}

function showRoleSpecificLinks() {
    if (!window.currentUser) return;
    
    const adminLink = document.getElementById("admin-link");
    const moderatorLink = document.getElementById("moderator-link");
    
    if (adminLink && window.currentUser.role === "admin") {
        adminLink.style.display = "block";
    }
    
    if (moderatorLink && (window.currentUser.role === "moderator" || window.currentUser.role === "admin")) {
        moderatorLink.style.display = "block";
    }
}

function updateSyncStatus(isOnline) {
    const statusIndicator = document.getElementById('sync-status');
    if (statusIndicator) {
        if (isOnline) {
            statusIndicator.innerHTML = '🟢 Синхронизировано';
            statusIndicator.style.color = '#4caf50';
        } else {
            statusIndicator.innerHTML = '🔴 Офлайн';
            statusIndicator.style.color = '#f44336';
        }
    }
}

function updateSyncStatusIndicator() {
    const statusIndicator = document.getElementById('sync-status');
    if (statusIndicator && window.dataSyncManager) {
        const syncStatus = window.dataSyncManager.getSyncStatus();
        const pendingCount = syncStatus.pendingUpdates;
        
        if (!syncStatus.online) {
            statusIndicator.innerHTML = `🔴 Офлайн${pendingCount > 0 ? ` (${pendingCount})` : ''}`;
            statusIndicator.style.color = '#f44336';
        } else if (syncStatus.syncInProgress) {
            statusIndicator.innerHTML = '🟡 Синхронизация...';
            statusIndicator.style.color = '#ff9800';
        } else {
            statusIndicator.innerHTML = '🟢 Синхронизировано';
            statusIndicator.style.color = '#4caf50';
        }
    }
}

// ===== ДОБАВЛЕНИЕ ИНДИКАТОРА СИНХРОНИЗАЦИИ =====
function addSyncStatusIndicator() {
    const header = document.querySelector('.header .user-info');
    if (header && !document.getElementById('sync-status')) {
        const syncStatus = document.createElement('div');
        syncStatus.id = 'sync-status';
        syncStatus.style.cssText = `
            display: flex;
            align-items: center;
            font-size: 12px;
            color: #4caf50;
            margin-left: 10px;
            padding: 2px 6px;
            border-radius: 12px;
            background: rgba(76, 175, 80, 0.1);
            border: 1px solid rgba(76, 175, 80, 0.3);
        `;
        syncStatus.innerHTML = '🟢 Синхронизировано';
        header.appendChild(syncStatus);
        
        console.log('📊 Индикатор синхронизации добавлен');
    }
}

// ===== ЗАГРУЗКА НАСТРОЕК =====
async function loadSettings() {
    try {
        const settingsRef = database.ref('settings');
        const snapshot = await settingsRef.once('value');
        
        if (snapshot.exists()) {
            Object.assign(settings, snapshot.val());
        }
        
        console.log('⚙️ Настройки загружены:', settings);
    } catch (error) {
        console.error('❌ Ошибка загрузки настроек:', error);
    }
}

// ===== ЗАГРУЗКА СОБЫТИЙ =====
async function loadEvents() {
    try {
        console.log('📅 Загрузка событий...');
        const eventsRef = database.ref('events');
        const snapshot = await eventsRef.once('value');
        
        if (snapshot.exists()) {
            window.events = snapshot.val();
            console.log('📅 События загружены из Firebase:', Object.keys(window.events).length);
        } else {
            window.events = {};
            console.log('📅 События не найдены');
        }
        
        displayEvents();
    } catch (error) {
        console.error('❌ Ошибка загрузки событий:', error);
        showNotification('Ошибка загрузки событий: ' + error.message, 'error');
        
        // Показать заглушку
        const container = document.getElementById('events-container');
        if (container) {
            container.innerHTML = `
                <div class="bet-slip-empty">
                    <p>Ошибка загрузки событий</p>
                    <button class="btn" onclick="loadEvents()">Попробовать снова</button>
                </div>
            `;
        }
    }
}

// ===== ОТОБРАЖЕНИЕ СОБЫТИЙ =====
function displayEvents(filter = 'all') {
    const events = window.events;
    const container = document.getElementById('events-container');
    if (!container) {
        console.warn('❌ Контейнер #events-container не найден');
        return;
    }
    
    container.innerHTML = '';
    
    if (!events || typeof events !== 'object') {
        container.innerHTML = '<div class="bet-slip-empty"><p>Нет доступных событий</p></div>';
        console.warn('⚠️ events не объект:', events);
        return;
    }
    
    const filteredEvents = Object.entries(events).filter(([id, event]) => {
        const isActive = event.status === 'active';
        const categoryMatch = filter === 'all' || event.category === filter;
        return isActive && categoryMatch;
    });
    
    if (filteredEvents.length === 0) {
        container.innerHTML = '<div class="bet-slip-empty"><p>Нет доступных событий</p></div>';
        return;
    }
    
    filteredEvents.forEach(([eventId, event]) => {
        const eventElement = document.createElement('div');
        eventElement.className = 'event-card';
        eventElement.innerHTML = `
            <div class="event-header">
                <div>
                    <div class="event-title">${event.title}</div>
                </div>
                <div class="event-category">${getCategoryName(event.category)}</div>
            </div>
            <div class="event-description">${event.description}</div>
            <div class="event-options">
                ${(event.options && event.coefficients && event.options.length === event.coefficients.length) ?
                    event.options.map((option, index) => `
                        <button class="option-btn" onclick="selectOption('${eventId}', '${option}', ${event.coefficients[index]})">
                            <span class="option-text">${option}</span>
                            <span class="option-coefficient">${event.coefficients[index]}</span>
                        </button>
                    `).join('') : '<span style="color:red">Некорректные опции/коэффициенты</span>'}
            </div>
        `;
        container.appendChild(eventElement);
    });
    
    console.log(`📊 Отображено ${filteredEvents.length} событий`);
}

// ===== ФИЛЬТРАЦИЯ СОБЫТИЙ =====
function filterEvents(category) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    displayEvents(category);
}

// ===== КОРЗИНА СТАВОК =====
function selectOption(eventId, option, coefficient) {
    if (!window.currentUser) {
        showNotification('Войдите в систему для размещения ставок', 'error');
        return;
    }

    const event = window.events[eventId];
    if (!event) return;

    const existingIndex = betSlip.findIndex(item => item.eventId === eventId);
    
    if (existingIndex !== -1) {
        betSlip[existingIndex] = {
            eventId: eventId,
            eventTitle: event.title,
            option: option,
            coefficient: coefficient
        };
    } else {
        betSlip.push({
            eventId: eventId,
            eventTitle: event.title,
            option: option,
            coefficient: coefficient
        });
    }

    updateBetSlipDisplay();
    showNotification('Добавлено в корзину ставок', 'success');
}

function updateBetSlipDisplay() {
    const container = document.getElementById('bet-slip-content');
    if (!container) return;
    
    if (betSlip.length === 0) {
        container.innerHTML = `
            <div class="bet-slip-empty">
                <p>Корзина ставок пуста</p>
                <small>Выберите события для ставки</small>
            </div>
        `;
        return;
    }

    const totalCoefficient = betSlip.reduce((total, bet) => total * bet.coefficient, 1);

    container.innerHTML = `
        <div class="bet-slip-items">
            ${betSlip.map((bet, index) => `
                <div class="bet-slip-item">
                    <button class="btn-remove" onclick="removeFromBetSlip(${index})">×</button>
                    <div class="bet-slip-event">${bet.eventTitle}</div>
                    <div class="bet-slip-option">${bet.option} (${bet.coefficient})</div>
                </div>
            `).join('')}
        </div>
        
        <div class="bet-slip-total">
            <div>Общий коэффициент:</div>
            <div class="total-coefficient">${totalCoefficient.toFixed(2)}</div>
        </div>
        
        <div class="bet-slip-controls">
            <input type="number" 
                   class="bet-amount-input" 
                   id="bet-amount" 
                   placeholder="Сумма ставки" 
                   min="${settings.minBetAmount}" 
                   max="${Math.min(window.currentUser.balance, window.currentUser.betLimit || settings.maxBetAmount)}"
                   oninput="updatePotentialWin()">
            
            <div id="potential-win" class="potential-win" style="display: none;"></div>
            
            ${betSlip.length === 1 ? 
                `<button class="btn" onclick="placeBet('single')">Сделать одиночную ставку</button>` : 
                `<button class="btn" onclick="placeBet('express')">Сделать экспресс ставку</button>`
            }
            
            <button class="btn btn-secondary" onclick="clearBetSlip()">Очистить корзину</button>
        </div>
    `;
}

function removeFromBetSlip(index) {
    betSlip.splice(index, 1);
    updateBetSlipDisplay();
    showNotification('Удалено из корзины', 'warning');
}

function clearBetSlip() {
    betSlip = [];
    updateBetSlipDisplay();
    showNotification('Корзина очищена', 'warning');
}

function updatePotentialWin() {
    const amount = parseFloat(document.getElementById('bet-amount').value) || 0;
    const totalCoefficient = betSlip.reduce((total, bet) => total * bet.coefficient, 1);
    const potentialWin = amount * totalCoefficient;
    
    const potentialWinDiv = document.getElementById('potential-win');
    if (amount > 0) {
        potentialWinDiv.style.display = 'block';
        potentialWinDiv.textContent = `Возможный выигрыш: ${potentialWin.toFixed(2)} лупанчиков`;
    } else {
        potentialWinDiv.style.display = 'none';
    }
}

// ===== РАЗМЕЩЕНИЕ СТАВОК С СИНХРОНИЗАЦИЕЙ =====
async function placeBet(type) {
    if (!window.currentUser) {
        showNotification('Войдите в систему', 'error');
        return;
    }

    if (betSlip.length === 0) {
        showNotification('Корзина ставок пуста', 'error');
        return;
    }

    const amount = parseInt(document.getElementById('bet-amount').value);

    if (!amount || amount < settings.minBetAmount) {
        showNotification(`Минимальная ставка: ${settings.minBetAmount} лупанчиков`, 'error');
        return;
    }

    if (amount > window.currentUser.balance) {
        showNotification('Недостаточно средств', 'error');
        return;
    }

    if (amount > (window.currentUser.betLimit || settings.maxBetAmount)) {
        showNotification(`Превышен лимит ставки: ${window.currentUser.betLimit || settings.maxBetAmount} лупанчиков`, 'error');
        return;
    }

    try {
        let coefficient;
        let eventList;

        if (type === 'single' && betSlip.length === 1) {
            coefficient = betSlip[0].coefficient;
            eventList = betSlip;
        } else if (type === 'express' && betSlip.length > 1) {
            coefficient = betSlip.reduce((total, bet) => total * bet.coefficient, 1);
            eventList = betSlip;
        } else {
            showNotification('Неверный тип ставки', 'error');
            return;
        }

        // Создать ставку в базе данных
        const betsRef = database.ref('bets');
        const newBetRef = betsRef.push();

        const bet = {
            user: window.currentUser.username,
            type: type,
            amount: amount,
            coefficient: parseFloat(coefficient.toFixed(2)),
            status: 'pending',
            timestamp: Date.now(),
            events: eventList
        };

        await newBetRef.set(bet);

        // Обновить баланс пользователя через sync manager или напрямую
        const newBalance = window.currentUser.balance - amount;
        
        if (window.dataSyncManager) {
            await window.dataSyncManager.updateUserData({ balance: newBalance });
        } else {
            // Fallback: обновить напрямую
            const userRef = database.ref(`users/${window.currentUser.username}`);
            await userRef.update({ balance: newBalance });
            
            window.currentUser.balance = newBalance;
            localStorage.setItem('currentUser', JSON.stringify(window.currentUser));
            updateUserInfo();
        }

        // Очистить корзину ставок
        betSlip = [];
        updateBetSlipDisplay();

        showNotification('Ставка размещена успешно!', 'success');

    } catch (error) {
        console.error('❌ Ошибка размещения ставки:', error);
        showNotification('Ошибка размещения ставки: ' + error.message, 'error');
    }
}

// ===== ЕЖЕДНЕВНЫЙ БОНУС =====
function updateDailyBonusButton() {
    const btn = document.getElementById('daily-bonus-btn');
    if (!btn || !window.currentUser) return;
    
    const today = new Date().toISOString().split('T')[0];
    if (window.currentUser.lastBonusDate === today) {
        btn.disabled = true;
        btn.textContent = 'Бонус получен';
    } else {
        const reward = dailyRewards[getNextBonusIndex()];
        btn.disabled = false;
        btn.textContent = `Получить ${reward} лупанчиков`;
    }
}

function getNextBonusIndex() {
    if (!window.currentUser) return 0;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yestStr = yesterday.toISOString().split('T')[0];

    if (window.currentUser.lastBonusDate === todayStr) {
        return ((window.currentUser.bonusDay || 1) - 1) % 7;
    }

    if (window.currentUser.lastBonusDate === yestStr) {
        return (window.currentUser.bonusDay || 0) % 7;
    }

    return 0;
}

function openDailyBonusModal() {
    generateBonusCalendar();
    const modal = document.getElementById('dailyBonusModal');
    if (modal) modal.style.display = 'block';
}

function closeDailyBonusModal() {
    const modal = document.getElementById('dailyBonusModal');
    if (modal) modal.style.display = 'none';
}

function generateBonusCalendar() {
    const calendar = document.getElementById('bonus-calendar');
    if (!calendar) return;
    calendar.innerHTML = '';

    const nextIndex = getNextBonusIndex();
    const claimed = hasClaimedToday();

    for (let i = 0; i < dailyRewards.length; i++) {
        const dayButton = document.createElement('button');
        dayButton.className = 'calendar-day';
        const reward = dailyRewards[i];
        dayButton.textContent = `${i + 1}\n${reward} лупанчиков`;

        if (i === nextIndex && !claimed) {
            dayButton.classList.add('today');
            dayButton.onclick = claimDailyBonus;
        } else {
            dayButton.disabled = true;
        }

        calendar.appendChild(dayButton);
    }
}

function hasClaimedToday() {
    if (!window.currentUser) return false;
    const today = new Date().toISOString().split('T')[0];
    return window.currentUser.lastBonusDate === today;
}

async function claimDailyBonus() {
    if (!window.currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    if (window.currentUser.lastBonusDate === today) {
        showNotification('Бонус уже получен сегодня', 'error');
        return;
    }

    const yesterday = new Date();
    yesterday.setDate(new Date().getDate() - 1);
    const yestStr = yesterday.toISOString().split('T')[0];

    let nextIndex;
    if (window.currentUser.lastBonusDate === yestStr) {
        nextIndex = (window.currentUser.bonusDay || 0) % 7;
    } else {
        nextIndex = 0;
    }

    const reward = dailyRewards[nextIndex];

    try {
        // Обновить данные пользователя через sync manager или напрямую
        const updateData = {
            balance: window.currentUser.balance + reward,
            bonusDay: nextIndex + 1,
            lastBonusDate: today
        };
        
        if (window.dataSyncManager) {
            await window.dataSyncManager.updateUserData(updateData);
        } else {
            // Fallback: обновить напрямую
            const userRef = database.ref(`users/${window.currentUser.username}`);
            await userRef.update(updateData);
            
            Object.assign(window.currentUser, updateData);
            localStorage.setItem('currentUser', JSON.stringify(window.currentUser));
            updateUserInfo();
        }

        updateDailyBonusButton();
        closeDailyBonusModal();
        showNotification(`Вы получили ${reward} лупанчиков!`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка начисления бонуса:', error);
        showNotification('Не удалось получить бонус: ' + error.message, 'error');
    }
}

// ===== УВЕДОМЛЕНИЯ =====
function showBalanceChangeNotification(diff) {
    const message = diff > 0 
        ? `💰 Баланс увеличен на ${diff} лупанчиков!`
        : `📉 Баланс уменьшен на ${Math.abs(diff)} лупанчиков`;
        
    showNotification(message, diff > 0 ? 'success' : 'warning');
}

function showNotification(message, type = 'info') {
    console.log(`📢 Уведомление (${type}): ${message}`);
    
    // Удаляем предыдущие уведомления
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
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
    
    // Автоудаление через 4 секунды
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
}

// ===== ВЫХОД ИЗ СИСТЕМЫ =====
function logout() {
    try {
        // Очистить sync manager
        if (window.dataSyncManager) {
            window.dataSyncManager.cleanup();
            window.dataSyncManager.clearLocalData();
        }
        
        // Очистить localStorage
        localStorage.removeItem('currentUser');
        
        // Перенаправить на страницу входа
        window.location.href = 'login.html';
    } catch (error) {
        console.error('❌ Ошибка выхода из системы:', error);
        // В любом случае перенаправить
        window.location.href = 'login.html';
    }
}

// ===== ЭКСПОРТ ФУНКЦИЙ =====
window.filterEvents = filterEvents;
window.selectOption = selectOption;
window.removeFromBetSlip = removeFromBetSlip;
window.clearBetSlip = clearBetSlip;
window.updatePotentialWin = updatePotentialWin;
window.placeBet = placeBet;
window.logout = logout;
window.openDailyBonusModal = openDailyBonusModal;
window.closeDailyBonusModal = closeDailyBonusModal;
window.loadEvents = loadEvents;
window.getCategoryName = getCategoryName;
window.displayEvents = displayEvents;

// ИСПРАВЛЕНИЕ: Убедимся что syncUser экспортируется
window.syncUser = forceSyncUser;
window.forceSyncUser = forceSyncUser;

// Глобальная функция для тестирования синхронизации
window.testSync = function() {
    if (window.dataSyncManager) {
        console.log('🧪 Статус синхронизации:', window.dataSyncManager.getSyncStatus());
        console.log('👤 Текущий пользователь:', window.dataSyncManager.getCurrentUser());
    } else {
        console.log('⚠️ DataSyncManager недоступен');
    }
};

// ===== АВТОМАТИЧЕСКИЕ ПРОВЕРКИ =====
// Дополнительная проверка после полной загрузки страницы
window.addEventListener('load', function() {
    console.log('🌐 Страница полностью загружена');
    
    // ИСПРАВЛЕНИЕ: Принудительная синхронизация после загрузки
    setTimeout(() => {
        // Проверяем и синхронизируем пользователя
        if (!window.currentUser) {
            console.warn('⚠️ Пользователь не синхронизирован, принудительная синхронизация...');
            forceSyncUser();
        }
        
        // Проверяем события
        if (!window.events || Object.keys(window.events).length === 0) {
            console.warn('⚠️ События не загружены, принудительная загрузка...');
            loadEvents().catch(error => {
                console.error('❌ Ошибка принудительной загрузки событий:', error);
            });
        } else {
            // Принудительно отобразить события
            displayEvents();
        }
        
        console.log('✅ Автоматические проверки завершены');
    }, 1000);
});

// ===== ОБРАБОТКА ОШИБОК =====
window.addEventListener('error', function(event) {
    console.error('🚨 JavaScript ошибка в main.js:', event.error);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('🚨 Необработанная Promise ошибка:', event.reason);
    event.preventDefault();
});
