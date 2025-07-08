// ===== ИСПРАВЛЕННЫЙ MAIN.JS БЕЗ ЗАВИСИМОСТИ ОТ SYNC MANAGER =====

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getDatabase, 
    ref as dbRef, 
    set as dbSet, 
    get as dbGet, 
    update as dbUpdate, 
    push as dbPush
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let app = null;
let database = null;
let currentUser = null;
let events = {};
let betSlip = [];
let settings = {
    maxBetAmount: 1000,
    defaultBalance: 5000,
    minBetAmount: 1,
    maxCoefficient: 50
};

// Награды за ежедневный бонус
const dailyRewards = [250, 500, 1000, 2000, 3000, 5000, 7000];

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Инициализация main.js');
    
    try {
        // Инициализация Firebase
        await initializeFirebase();
        
        // Проверяем авторизацию
        await checkAuth();
        
        // Загружаем данные
        await loadSettings();
        await loadEvents();
        
        // Обновляем интерфейс
        updateDailyBonusButton();
        
        console.log('✅ main.js полностью инициализирован');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации main.js:', error);
        showNotification('Ошибка инициализации приложения: ' + error.message, 'error');
    }
});

// ===== ИНИЦИАЛИЗАЦИЯ FIREBASE =====
async function initializeFirebase() {
    try {
        if (!window.firebaseConfig) {
            throw new Error('Firebase конфигурация не найдена');
        }
        
        app = initializeApp(window.firebaseConfig);
        database = getDatabase(app);
        
        console.log('🔥 Firebase инициализирован');
    } catch (error) {
        console.error('❌ Ошибка инициализации Firebase:', error);
        throw error;
    }
}

// ===== АВТОРИЗАЦИЯ =====
async function checkAuth() {
    console.log('🔐 Проверка авторизации');
    
    try {
        const savedUser = localStorage.getItem('currentUser');
        
        if (!savedUser) {
            console.log('❌ Пользователь не найден, перенаправление на login');
            window.location.href = 'login.html';
            return;
        }
        
        currentUser = JSON.parse(savedUser);
        console.log('👤 Найден пользователь:', currentUser.username);
        
        // Проверяем актуальность данных в Firebase
        const userRef = dbRef(database, `users/${currentUser.username}`);
        const snapshot = await dbGet(userRef);
        
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
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }
        
        // Обновить локальные данные
        currentUser = {
            username: currentUser.username,
            ...firebaseData
        };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Обновить интерфейс
        updateUserInfo();
        showRoleSpecificLinks();
        
        console.log('✅ Авторизация завершена');
        
    } catch (error) {
        console.error('❌ Ошибка проверки авторизации:', error);
        showNotification('Ошибка проверки авторизации: ' + error.message, 'error');
        
        // Очистить и перенаправить
        localStorage.removeItem('currentUser');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);
    }
}

// ===== ОБНОВЛЕНИЕ ИНТЕРФЕЙСА =====
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
    
    console.log('🔄 Интерфейс обновлен');
}

function showRoleSpecificLinks() {
    if (!currentUser) return;
    
    const adminLink = document.getElementById("admin-link");
    const moderatorLink = document.getElementById("moderator-link");
    
    if (adminLink && currentUser.role === "admin") {
        adminLink.style.display = "block";
    }
    
    if (moderatorLink && (currentUser.role === "moderator" || currentUser.role === "admin")) {
        moderatorLink.style.display = "block";
    }
}

// ===== ЗАГРУЗКА НАСТРОЕК =====
async function loadSettings() {
    try {
        const settingsRef = dbRef(database, 'settings');
        const snapshot = await dbGet(settingsRef);
        
        if (snapshot.exists()) {
            Object.assign(settings, snapshot.val());
        }
        
        console.log('⚙️ Настройки загружены:', settings);
    } catch (error) {
        console.error('❌ Ошибка загрузки настроек:', error);
        showNotification('Ошибка загрузки настроек, используются значения по умолчанию', 'warning');
    }
}

// ===== ЗАГРУЗКА СОБЫТИЙ =====
async function loadEvents() {
    try {
        console.log('📅 Загрузка событий...');
        
        const eventsRef = dbRef(database, 'events');
        const snapshot = await dbGet(eventsRef);
        
        if (snapshot.exists()) {
            events = snapshot.val();
            console.log('📅 События загружены:', Object.keys(events).length);
        } else {
            console.log('📅 События не найдены, создаем демо события');
            await createDemoEvents();
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

async function createDemoEvents() {
    const demoEvents = {
        'demo1': {
            title: 'Выборы президента США 2028',
            description: 'Кто станет следующим президентом Соединенных Штатов Америки?',
            category: 'politics',
            options: ['Демократы', 'Республиканцы', 'Третья партия'],
            coefficients: [1.8, 2.1, 8.5],
            status: 'active',
            createdAt: Date.now()
        },
        'demo2': {
            title: 'Bitcoin достигнет $100,000',
            description: 'Достигнет ли курс Bitcoin отметки в $100,000 до конца 2025 года?',
            category: 'economics',
            options: ['Да', 'Нет'],
            coefficients: [2.5, 1.4],
            status: 'active',
            createdAt: Date.now()
        },
        'demo3': {
            title: 'Новый iPhone в 2025',
            description: 'Какая будет главная особенность нового iPhone в 2025 году?',
            category: 'technology',
            options: ['Складной экран', 'Holographic дисплей', 'Встроенный AI чип'],
            coefficients: [3.2, 7.5, 2.8],
            status: 'active',
            createdAt: Date.now()
        }
    };

    try {
        const eventsRef = dbRef(database, 'events');
        await dbSet(eventsRef, demoEvents);
        events = demoEvents;
        console.log('✅ Демо события созданы');
    } catch (error) {
        console.error('❌ Ошибка создания демо событий:', error);
        // Используем локальные демо события
        events = demoEvents;
    }
}

function displayEvents(filter = 'all') {
    const container = document.getElementById('events-container');
    if (!container) return;
    
    container.innerHTML = '';

    const filteredEvents = Object.entries(events).filter(([id, event]) => {
        return event.status === 'active' && (filter === 'all' || event.category === filter);
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
                ${event.options.map((option, index) => `
                    <button class="option-btn" onclick="selectOption('${eventId}', '${option}', ${event.coefficients[index]})">
                        <span class="option-text">${option}</span>
                        <span class="option-coefficient">${event.coefficients[index]}</span>
                    </button>
                `).join('')}
            </div>
        `;
        container.appendChild(eventElement);
    });
    
    console.log(`📊 Отображено ${filteredEvents.length} событий`);
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
    return categories[category] || category;
}

// ===== ФИЛЬТРАЦИЯ СОБЫТИЙ =====
function filterEvents(category) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    displayEvents(category);
}

// ===== КОРЗИНА СТАВОК =====
function selectOption(eventId, option, coefficient) {
    if (!currentUser) {
        showNotification('Войдите в систему для размещения ставок', 'error');
        return;
    }

    const event = events[eventId];
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
                   max="${Math.min(currentUser.balance, currentUser.betLimit || settings.maxBetAmount)}"
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

// ===== РАЗМЕЩЕНИЕ СТАВОК =====
async function placeBet(type) {
    if (!currentUser) {
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

    if (amount > currentUser.balance) {
        showNotification('Недостаточно средств', 'error');
        return;
    }

    if (amount > (currentUser.betLimit || settings.maxBetAmount)) {
        showNotification(`Превышен лимит ставки: ${currentUser.betLimit || settings.maxBetAmount} лупанчиков`, 'error');
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
        const betsRef = dbRef(database, 'bets');
        const newBetRef = dbPush(betsRef);

        const bet = {
            user: currentUser.username,
            type: type,
            amount: amount,
            coefficient: parseFloat(coefficient.toFixed(2)),
            status: 'pending',
            timestamp: Date.now(),
            events: eventList
        };

        await dbSet(newBetRef, bet);

        // Обновить баланс пользователя
        const newBalance = currentUser.balance - amount;
        const userRef = dbRef(database, `users/${currentUser.username}`);
        await dbUpdate(userRef, { balance: newBalance });

        // Обновить локальные данные
        currentUser.balance = newBalance;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserInfo();

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
    if (!btn || !currentUser) return;
    
    const today = new Date().toISOString().split('T')[0];
    if (currentUser.lastBonusDate === today) {
        btn.disabled = true;
        btn.textContent = 'Бонус получен';
    } else {
        const reward = dailyRewards[getNextBonusIndex()];
        btn.disabled = false;
        btn.textContent = `Получить ${reward} лупанчиков`;
    }
}

function getNextBonusIndex() {
    if (!currentUser) return 0;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yestStr = yesterday.toISOString().split('T')[0];

    if (currentUser.lastBonusDate === todayStr) {
        return ((currentUser.bonusDay || 1) - 1) % 7;
    }

    if (currentUser.lastBonusDate === yestStr) {
        return (currentUser.bonusDay || 0) % 7;
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
    if (!currentUser) return false;
    const today = new Date().toISOString().split('T')[0];
    return currentUser.lastBonusDate === today;
}

async function claimDailyBonus() {
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    if (currentUser.lastBonusDate === today) {
        showNotification('Бонус уже получен сегодня', 'error');
        return;
    }

    const yesterday = new Date();
    yesterday.setDate(new Date().getDate() - 1);
    const yestStr = yesterday.toISOString().split('T')[0];

    let nextIndex;
    if (currentUser.lastBonusDate === yestStr) {
        nextIndex = (currentUser.bonusDay || 0) % 7;
    } else {
        nextIndex = 0;
    }

    const reward = dailyRewards[nextIndex];

    try {
        // Обновить данные пользователя
        const userRef = dbRef(database, `users/${currentUser.username}`);
        await dbUpdate(userRef, {
            balance: currentUser.balance + reward,
            bonusDay: nextIndex + 1,
            lastBonusDate: today
        });

        // Обновить локальные данные
        currentUser.balance += reward;
        currentUser.bonusDay = nextIndex + 1;
        currentUser.lastBonusDate = today;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        updateUserInfo();
        updateDailyBonusButton();
        closeDailyBonusModal();
        showNotification(`Вы получили ${reward} лупанчиков!`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка начисления бонуса:', error);
        showNotification('Не удалось получить бонус: ' + error.message, 'error');
    }
}

// ===== УВЕДОМЛЕНИЯ =====
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
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('❌ Ошибка выхода из системы:', error);
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

// ===== ОБРАБОТКА ОШИБОК =====
window.addEventListener('error', function(event) {
    console.error('🚨 JavaScript ошибка в main.js:', event.error);
    console.error('📍 Файл:', event.filename, 'Строка:', event.lineno);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('🚨 Необработанная Promise ошибка:', event.reason);
    event.preventDefault();
});
