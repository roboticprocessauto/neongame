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

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadSettings();
    loadEvents();
});

function checkAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (!savedUser) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = JSON.parse(savedUser);
    updateUserInfo();
    ensureDailyBonus();

    // Показать админ ссылку если пользователь админ/модератор
    if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
        document.getElementById('admin-link').style.display = 'block';
    }
}

function updateUserInfo() {
    if (!currentUser) return;

    document.getElementById('user-balance').textContent = `${currentUser.balance.toLocaleString()} монет`;
    document.getElementById('username').textContent = currentUser.username;

    const btn = document.getElementById('dailyBonusBtn');
    if (btn) {
        btn.disabled = hasClaimedToday();
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

// ===== ВЫХОД ИЗ СИСТЕМЫ =====
function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

// ===== ЕЖЕДНЕВНЫЙ БОНУС =====
function ensureDailyBonus() {
    if (!currentUser.dailyBonus) {
        currentUser.dailyBonus = { lastClaim: 0, streak: 0 };
    }
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
}

function hasClaimedToday() {
    if (!currentUser.dailyBonus) return false;
    const last = new Date(currentUser.dailyBonus.lastClaim);
    const now = new Date();
    return last.getFullYear() === now.getFullYear() &&
           last.getMonth() === now.getMonth() &&
           last.getDate() === now.getDate();
}

function openDailyBonusModal() {
    renderDailyBonusCalendar();
    const modal = document.getElementById('dailyBonusModal');
    if (modal) modal.style.display = 'block';
}

function closeDailyBonusModal() {
    const modal = document.getElementById('dailyBonusModal');
    if (modal) modal.style.display = 'none';
}

function renderDailyBonusCalendar() {
    const calendar = document.getElementById('dailyBonusCalendar');
    if (!calendar) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const days = new Date(year, month + 1, 0).getDate();

    calendar.innerHTML = '';
    for (let d = 1; d <= days; d++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = d;

        if (d === now.getDate()) {
            dayEl.classList.add('current-day');
            if (hasClaimedToday()) {
                dayEl.classList.add('claimed');
            } else {
                dayEl.classList.add('claimable');
                dayEl.addEventListener('click', claimDailyBonus);
            }
        } else if (d < now.getDate()) {
            dayEl.classList.add('claimed');
        } else {
            dayEl.classList.add('disabled');
        }

        calendar.appendChild(dayEl);
    }
}

async function claimDailyBonus() {
    if (hasClaimedToday()) {
        showNotification('Бонус уже получен сегодня', 'warning');
        return;
    }

    const bonus = 250;
    const userRef = dbRef(database, `users/${currentUser.username}`);

    try {
        const newBalance = (currentUser.balance || 0) + bonus;
        let streak = (currentUser.dailyBonus?.streak || 0) + 1;
        if (streak > 7) streak = 1;

        await dbUpdate(userRef, {
            balance: newBalance,
            dailyBonus: { lastClaim: Date.now(), streak: streak }
        });

        currentUser.balance = newBalance;
        currentUser.dailyBonus = { lastClaim: Date.now(), streak: streak };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserInfo();
        showNotification(`Вы получили ${bonus} монет!`, 'success');
        renderDailyBonusCalendar();
    } catch (error) {
        console.error('Ошибка получения бонуса:', error);
        showNotification('Не удалось получить бонус', 'error');
    }
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
