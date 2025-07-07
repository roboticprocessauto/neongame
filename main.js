// ===== ИНИЦИАЛИЗАЦИЯ FIREBASE =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getDatabase, 
    ref as dbRef, 
    set as dbSet, 
    get as dbGet, 
    update as dbUpdate, 
    push as dbPush
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Инициализация Firebase
const app = initializeApp(window.firebaseConfig);
const database = getDatabase(app);

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let currentUser = null;
let events = {};
let betSlip = [];
let settings = {
    maxBetAmount: 1000,
    defaultBalance: 5000,
    minBetAmount: 1,
    maxCoefficient: 50
};

// Награды за ежедневный бонус по дням стрика
// День 1: 250, День 2: 500, День 3: 1000, День 4: 2000,
// День 5: 3000, День 6: 5000, День 7: 7000
const dailyRewards = [250, 500, 1000, 2000, 3000, 5000, 7000];

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadSettings();
    loadEvents();
    updateDailyBonusButton();
});

function checkAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (!savedUser) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = JSON.parse(savedUser);
    updateUserInfo();
    updateDailyBonusButton();
    
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

// ===== ЗАГРУЗКА НАСТРОЕК =====
async function loadSettings() {
    try {
        const settingsRef = dbRef(database, 'settings');
        const snapshot = await dbGet(settingsRef);
        
        if (snapshot.exists()) {
            Object.assign(settings, snapshot.val());
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
        } else {
            // Создать демо события если их нет
            await createDemoEvents();
        }
        
        displayEvents();
    } catch (error) {
        console.error('Ошибка загрузки событий:', error);
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
    } catch (error) {
        console.error('Ошибка создания демо событий:', error);
    }
}

function displayEvents(filter = 'all') {
    const container = document.getElementById('events-container');
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
    // Обновить активный фильтр
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    displayEvents(category);
};

// ===== КОРЗИНА СТАВОК =====
function selectOption(eventId, option, coefficient) {
    if (!currentUser) {
        showNotification('Войдите в систему для размещения ставок', 'error');
        return;
    }

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
    showNotification('Добавлено в корзину ставок', 'success');
};

function updateBetSlipDisplay() {
    const container = document.getElementById('bet-slip-content');
    
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
};

function clearBetSlip() {
    betSlip = [];
    updateBetSlipDisplay();
    showNotification('Корзина очищена', 'warning');
};

function updatePotentialWin() {
    const amount = parseFloat(document.getElementById('bet-amount').value) || 0;
    const totalCoefficient = betSlip.reduce((total, bet) => total * bet.coefficient, 1);
    const potentialWin = amount * totalCoefficient;
    
    const potentialWinDiv = document.getElementById('potential-win');
    if (amount > 0) {
        potentialWinDiv.style.display = 'block';
        potentialWinDiv.textContent = `Возможный выигрыш: ${potentialWin.toFixed(2)} монет`;
    } else {
        potentialWinDiv.style.display = 'none';
    }
};

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
        showNotification(`Минимальная ставка: ${settings.minBetAmount} монет`, 'error');
        return;
    }

    if (amount > currentUser.balance) {
        showNotification('Недостаточно средств', 'error');
        return;
    }

    if (amount > (currentUser.betLimit || settings.maxBetAmount)) {
        showNotification(`Превышен лимит ставки: ${currentUser.betLimit || settings.maxBetAmount} монет`, 'error');
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
        const userRef = dbRef(database, `users/${currentUser.username}`);
        const newBalance = currentUser.balance - amount;
        await dbUpdate(userRef, { balance: newBalance });

        currentUser.balance = newBalance;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserInfo();

        // Очистить корзину ставок
        betSlip = [];
        updateBetSlipDisplay();

        showNotification('Ставка размещена успешно!', 'success');

    } catch (error) {
        console.error('Ошибка размещения ставки:', error);
        showNotification('Ошибка размещения ставки', 'error');
    }
};

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
        btn.textContent = `Получить ${reward} монет`;
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
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    calendar.innerHTML = '';

    for (let day = 1; day <= daysInMonth; day++) {
        const dayButton = document.createElement('button');
        dayButton.className = 'calendar-day';
        const rewardIndex = (day - 1) % dailyRewards.length;
        const reward = dailyRewards[rewardIndex];
        dayButton.textContent = `${day}\n${reward} монет`;
        if (day === now.getDate()) {
            dayButton.classList.add('today');
            dayButton.onclick = claimDailyBonus;
        } else {
            dayButton.disabled = true;
        }
        calendar.appendChild(dayButton);
    }
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
    currentUser.balance += reward;
    currentUser.bonusDay = nextIndex + 1;
    currentUser.lastBonusDate = today;

    try {
        const userRef = dbRef(database, `users/${currentUser.username}`);
        await dbUpdate(userRef, {
            balance: currentUser.balance,
            bonusDay: currentUser.bonusDay,
            lastBonusDate: currentUser.lastBonusDate
        });
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserInfo();
        updateDailyBonusButton();
        closeDailyBonusModal();
        showNotification(`Вы получили ${reward} монет!`, 'success');
    } catch (error) {
        console.error('Ошибка начисления бонуса:', error);
        showNotification('Не удалось получить бонус', 'error');
    }
}

// ===== ВЫХОД ИЗ СИСТЕМЫ =====
function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

// Экспортируем функции в глобальную область видимости
window.filterEvents = filterEvents;
window.selectOption = selectOption;
window.removeFromBetSlip = removeFromBetSlip;
window.clearBetSlip = clearBetSlip;
window.updatePotentialWin = updatePotentialWin;
window.placeBet = placeBet;
window.logout = logout;
window.openDailyBonusModal = openDailyBonusModal;
window.closeDailyBonusModal = closeDailyBonusModal;
