// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let currentUser = null;
let events = {};
let settings = { maxBetAmount: 1000, defaultBalance: 5000 };
let selectedBets = [];
let currentCategory = 'politics';

// ===== ФУНКЦИИ АВТОРИЗАЦИИ =====
window.login = async function() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (!username || !password) {
        alert('Введите логин и пароль');
        return;
    }

    try {
        const userRef = window.dbRef(window.database, `users/${username}`);
        const snapshot = await window.dbGet(userRef);
        
        if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.password === password) {
                currentUser = { username, ...userData };
                showApp();
            } else {
                alert('Неверный пароль');
            }
        } else {
            alert('Пользователь не найден');
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        alert('Ошибка подключения к базе данных');
    }
};

window.register = async function() {
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value.trim();
    
    if (!username || !password) {
        alert('Заполните все поля');
        return;
    }

    if (username.length < 3) {
        alert('Логин должен содержать минимум 3 символа');
        return;
    }

    if (password.length < 4) {
        alert('Пароль должен содержать минимум 4 символа');
        return;
    }

    try {
        const userRef = window.dbRef(window.database, `users/${username}`);
        const snapshot = await window.dbGet(userRef);
        
        if (snapshot.exists()) {
            alert('Пользователь уже существует');
            return;
        }

        const newUser = {
            password: password,
            balance: settings.defaultBalance,
            role: 'user',
            registeredAt: Date.now()
        };

        await window.dbSet(userRef, newUser);
        alert('Регистрация успешна!');
        
        document.getElementById('username').value = username;
        document.getElementById('password').value = password;
        showLogin();
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        alert('Ошибка создания аккаунта');
    }
};

window.logout = function() {
    currentUser = null;
    selectedBets = [];
    localStorage.removeItem('currentUser');
    document.getElementById('authForm').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
    
    // Очистка полей
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
};

window.showRegister = function() {
    document.getElementById('registerForm').classList.toggle('hidden');
};

window.showLogin = function() {
    document.getElementById('registerForm').classList.add('hidden');
};

// ===== ОСНОВНЫЕ ФУНКЦИИ ПРИЛОЖЕНИЯ =====
async function showApp() {
    document.getElementById('authForm').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    
    localStorage.setItem('currentUser', JSON.stringify({
        username: currentUser.username,
        role: currentUser.role
    }));
    
    updateUserInfo();
    await loadSettings();
    await loadEvents();
    
    if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
        document.getElementById('adminPanel').classList.remove('hidden');
        loadAdminEvents();
    }
}

function updateUserInfo() {
    document.getElementById('userBalance').textContent = currentUser.balance;
    const roleText = currentUser.role === 'admin' ? 'Администратор' :
                    currentUser.role === 'moderator' ? 'Модератор' : 'Пользователь';
    document.getElementById('userRole').textContent = roleText;
}

// ===== КАТЕГОРИИ И СОБЫТИЯ =====
window.selectCategory = function(category) {
    currentCategory = category;
    
    // Обновить активную категорию
    document.querySelectorAll('.category').forEach(cat => cat.classList.remove('active'));
    document.querySelector(`[data-category="${category}"]`).classList.add('active');
    
    displayEvents();
};

async function loadEvents() {
    try {
        const eventsRef = window.dbRef(window.database, 'events');
        const snapshot = await window.dbGet(eventsRef);
        
        if (snapshot.exists()) {
            events = snapshot.val();
            displayEvents();
        } else {
            events = {};
            displayEvents();
        }
    } catch (error) {
        console.error('Ошибка загрузки событий:', error);
    }
}

function displayEvents() {
    const container = document.getElementById('eventsContainer');
    container.innerHTML = '';

    const categoryEvents = Object.entries(events).filter(([_, event]) => 
        event.category === currentCategory && event.status === 'active'
    );

    if (categoryEvents.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #b0bec5;">
                <h3>Нет доступных событий в этой категории</h3>
                <p>Скоро здесь появятся новые события</p>
            </div>
        `;
        return;
    }

    categoryEvents.forEach(([eventId, event]) => {
        const eventCard = createEventCard(eventId, event);
        container.appendChild(eventCard);
    });
}

function createEventCard(eventId, event) {
    const div = document.createElement('div');
    div.className = 'event-card';
    
    div.innerHTML = `
        <div class="event-title">${event.title}</div>
        <div class="event-description">${event.description}</div>
        <div class="event-options">
            ${event.options.map((option, index) => `
                <div class="option-button" onclick="toggleBetSelection('${eventId}', ${index})">
                    <div class="option-text">${option}</div>
                    <div class="option-coefficient">${event.coefficients[index]}</div>
                </div>
            `).join('')}
        </div>
    `;
    
    return div;
}

// ===== КОРЗИНА СТАВОК =====
window.toggleBetSelection = function(eventId, optionIndex) {
    const event = events[eventId];
    
    // Проверяем, есть ли уже ставка из этого события
    const existingBetIndex = selectedBets.findIndex(bet => bet.eventId === eventId);
    
    if (existingBetIndex !== -1) {
        // Если это та же опция, убираем
        if (selectedBets[existingBetIndex].optionIndex === optionIndex) {
            selectedBets.splice(existingBetIndex, 1);
        } else {
            // Заменяем на новую опцию
            selectedBets[existingBetIndex] = {
                eventId,
                optionIndex,
                eventTitle: event.title,
                option: event.options[optionIndex],
                coefficient: event.coefficients[optionIndex]
            };
        }
    } else {
        // Добавляем новую ставку
        selectedBets.push({
            eventId,
            optionIndex,
            eventTitle: event.title,
            option: event.options[optionIndex],
            coefficient: event.coefficients[optionIndex]
        });
    }
    
    updateBetSlip();
    updateEventButtons();
};

function updateBetSlip() {
    const container = document.getElementById('betSlipContent');
    
    if (selectedBets.length === 0) {
        container.innerHTML = `
            <div class="empty-betslip">
                <p>Выберите события для ставки</p>
            </div>
        `;
        return;
    }

    const totalCoefficient = selectedBets.reduce((acc, bet) => acc * bet.coefficient, 1);
    
    container.innerHTML = `
        <button class="clear-all" onclick="clearAllBets()">Очистить всё</button>
        
        <div style="margin-bottom: 20px;">
            ${selectedBets.map((bet, index) => `
                <div class="bet-item">
                    <button class="remove-bet" onclick="removeBet(${index})">&times;</button>
                    <div class="bet-event-title">${bet.eventTitle}</div>
                    <div class="bet-option">${bet.option}</div>
                    <div class="bet-coefficient">${bet.coefficient}</div>
                </div>
            `).join('')}
        </div>

        <div class="bet-summary">
            <div class="bet-type-selector">
                <button class="bet-type-button ${selectedBets.length === 1 ? 'active' : ''}" 
                        ${selectedBets.length > 1 ? 'disabled' : ''}>
                    Одиночная
                </button>
                <button class="bet-type-button ${selectedBets.length > 1 ? 'active' : ''}" 
                        ${selectedBets.length === 1 ? 'disabled' : ''}>
                    Экспресс
                </button>
            </div>
            
            <input type="number" class="stake-input" id="stakeAmount" 
                   placeholder="Сумма ставки" min="1" max="${settings.maxBetAmount}"
                   oninput="updatePotentialPayout()">
            
            <div class="potential-payout">
                <strong>Общий коэффициент: ${totalCoefficient.toFixed(2)}</strong><br>
                <span id="potentialPayout">Возможный выигрыш: 0 монет</span>
            </div>
            
            <button class="place-bet-button" onclick="showBetModal()" 
                    ${selectedBets.length === 0 ? 'disabled' : ''}>
                Сделать ставку
            </button>
        </div>
    `;
}

function updateEventButtons() {
    // Сброс всех выделений
    document.querySelectorAll('.option-button').forEach(btn => {
        btn.classList.remove('selected');
    });

    // Выделение выбранных опций
    selectedBets.forEach(bet => {
        const eventCards = document.querySelectorAll('.event-card');
        eventCards.forEach(card => {
            const options = card.querySelectorAll('.option-button');
            options.forEach((option, index) => {
                const onclick = option.getAttribute('onclick');
                if (onclick && onclick.includes(`'${bet.eventId}', ${bet.optionIndex}`)) {
                    option.classList.add('selected');
                }
            });
        });
    });
}

window.removeBet = function(index) {
    selectedBets.splice(index, 1);
    updateBetSlip();
    updateEventButtons();
};

window.clearAllBets = function() {
    selectedBets = [];
    updateBetSlip();
    updateEventButtons();
};

window.updatePotentialPayout = function() {
    const stake = parseFloat(document.getElementById('stakeAmount')?.value) || 0;
    const totalCoefficient = selectedBets.reduce((acc, bet) => acc * bet.coefficient, 1);
    const payout = (stake * totalCoefficient).toFixed(2);
    
    const payoutElement = document.getElementById('potentialPayout');
    if (payoutElement) {
        payoutElement.textContent = `Возможный выигрыш: ${payout} монет`;
    }
};

// ===== МОДАЛЬНОЕ ОКНО СТАВКИ =====
window.showBetModal = function() {
    const stakeInput = document.getElementById('stakeAmount');
    if (!stakeInput) return;
    
    const stake = parseFloat(stakeInput.value);
    
    if (!stake || stake <= 0) {
        alert('Введите сумму ставки');
        return;
    }

    if (stake > currentUser.balance) {
        alert('Недостаточно средств');
        return;
    }

    if (stake > settings.maxBetAmount) {
        alert(`Максимальная ставка: ${settings.maxBetAmount} монет`);
        return;
    }

    const totalCoefficient = selectedBets.reduce((acc, bet) => acc * bet.coefficient, 1);
    const potentialPayout = (stake * totalCoefficient).toFixed(2);
    const betType = selectedBets.length === 1 ? 'single' : 'express';

    document.getElementById('betModalContent').innerHTML = `
        <div style="margin-bottom: 20px;">
            <h4>Тип ставки: ${betType === 'single' ? 'Одиночная' : 'Экспресс'}</h4>
            <p><strong>Сумма ставки:</strong> ${stake} монет</p>
            <p><strong>Общий коэффициент:</strong> ${totalCoefficient.toFixed(2)}</p>
            <p><strong>Возможный выигрыш:</strong> ${potentialPayout} монет</p>
        </div>
        
        <div style="margin-bottom: 20px;">
            <h4>Выбранные события:</h4>
            ${selectedBets.map(bet => `
                <div style="background: rgba(255,255,255,0.1); padding: 10px; margin: 5px 0; border-radius: 8px;">
                    <strong>${bet.eventTitle}</strong><br>
                    ${bet.option} (${bet.coefficient})
                </div>
            `).join('')}
        </div>
        
        <div style="display: flex; gap: 10px;">
            <button class="btn" onclick="placeBet()" style="flex: 1;">Подтвердить</button>
            <button class="btn" onclick="closeBetModal()" style="flex: 1; background: #666;">Отмена</button>
        </div>
    `;

    document.getElementById('betModal').style.display = 'block';
};

window.closeBetModal = function() {
    document.getElementById('betModal').style.display = 'none';
};

window.placeBet = async function() {
    const stakeInput = document.getElementById('stakeAmount');
    if (!stakeInput) return;
    
    const stake = parseFloat(stakeInput.value);
    const totalCoefficient = selectedBets.reduce((acc, bet) => acc * bet.coefficient, 1);
    const betType = selectedBets.length === 1 ? 'single' : 'express';

    try {
        const bet = {
            user: currentUser.username,
            type: betType,
            events: selectedBets,
            amount: stake,
            coefficient: totalCoefficient,
            status: 'pending',
            timestamp: Date.now()
        };

        // Добавить ставку
        const betsRef = window.dbRef(window.database, 'bets');
        await window.dbPush(betsRef, bet);

        // Обновить баланс
        const newBalance = currentUser.balance - stake;
        await window.dbUpdate(window.dbRef(window.database, `users/${currentUser.username}`), { balance: newBalance });
        currentUser.balance = newBalance;

        updateUserInfo();
        clearAllBets();
        closeBetModal();
        
        alert('Ставка принята!');
    } catch (error) {
        console.error('Ошибка размещения ставки:', error);
        alert('Ошибка размещения ставки');
    }
};

// ===== АДМИН ФУНКЦИИ =====
window.addEvent = async function() {
    const category = document.getElementById('eventCategory').value;
    const title = document.getElementById('eventTitle').value.trim();
    const description = document.getElementById('eventDescription').value.trim();
    const optionsText = document.getElementById('eventOptions').value.trim();
    const coefficientsText = document.getElementById('eventCoefficients').value.trim();

    if (!title || !description || !optionsText || !coefficientsText) {
        alert('Заполните все поля');
        return;
    }

    const options = optionsText.split(',').map(s => s.trim()).filter(s => s);
    const coefficients = coefficientsText.split(',').map(s => {
        const coef = parseFloat(s.trim());
        return isNaN(coef) ? null : coef;
    }).filter(c => c !== null);

    if (options.length === 0 || coefficients.length === 0) {
        alert('Введите корректные варианты и коэффициенты');
        return;
    }

    if (options.length !== coefficients.length) {
        alert('Количество вариантов должно совпадать с количеством коэффициентов');
        return;
    }

    try {
        const newEvent = {
            category,
            title,
            description,
            options,
            coefficients,
            status: 'active',
            createdBy: currentUser.username,
            timestamp: Date.now()
        };

        const eventsRef = window.dbRef(window.database, 'events');
        await window.dbPush(eventsRef, newEvent);

        // Очистить форму
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventDescription').value = '';
        document.getElementById('eventOptions').value = '';
        document.getElementById('eventCoefficients').value = '';

        await loadEvents();
        loadAdminEvents();
        alert('Событие добавлено успешно!');
    } catch (error) {
        console.error('Ошибка добавления события:', error);
        alert('Ошибка добавления события');
    }
};

async function loadAdminEvents() {
    try {
        const eventsRef = window.dbRef(window.database, 'events');
        const snapshot = await window.dbGet(eventsRef);
        
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
    
    container.innerHTML = '';

    const eventEntries = Object.entries(events);
    if (eventEntries.length === 0) {
        container.innerHTML = '<p style="color: #b0bec5;">Нет событий</p>';
        return;
    }

    eventEntries.forEach(([eventId, event]) => {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'admin-event-item';
        
        const categoryName = getCategoryName(event.category);
        const statusText = event.status === 'active' ? 'Активно' : 'Завершено';
        
        eventDiv.innerHTML = `
            <div class="admin-event-title">${event.title}</div>
            <div class="admin-event-info">
                ${categoryName} | Статус: ${statusText}
                ${event.createdBy ? ` | Создал: ${event.createdBy}` : ''}
            </div>
            ${event.status === 'active' ? `
                <select class="admin-event-select" onchange="finishEvent('${eventId}', this.value)">
                    <option value="">Завершить событие</option>
                    ${event.options.map((option, index) => `
                        <option value="${index}">${option}</option>
                    `).join('')}
                </select>
            ` : `<span style="color: #4fc3f7;">Завершено</span>`}
        `;
        container.appendChild(eventDiv);
    });
}

function getCategoryName(category) {
    const categories = {
        'politics': 'Политика',
        'entertainment': 'Развлечения',
        'technology': 'Технологии',
        'economics': 'Экономика',
        'weather': 'Погода',
        'society': 'Общество'
    };
    return categories[category] || category;
}

// ===== ФУНКЦИИ ДЛЯ РАБОТЫ С НЕЗАВЕРШЕННЫМИ СОБЫТИЯМИ =====
window.loadUnfinishedEvents = async function() {
    try {
        const eventsRef = window.dbRef(window.database, 'events');
        const snapshot = await window.dbGet(eventsRef);
        
        if (snapshot.exists()) {
            const allEvents = snapshot.val();
            const unfinishedEvents = Object.entries(allEvents).filter(([_, event]) => 
                !event.category || event.category === 'undefined'
            );
            
            if (unfinishedEvents.length === 0) {
                alert('Нет незавершенных событий');
                return;
            }
            
            let message = 'Найдены незавершенные события:\n\n';
            unfinishedEvents.forEach(([id, event], index) => {
                message += `${index + 1}. ${event.title}\n`;
            });
            message += '\nИспользуйте кнопку "Исправить категории" для их восстановления.';
            
            alert(message);
        }
    } catch (error) {
        console.error('Ошибка загрузки незавершенных событий:', error);
        alert('Ошибка загрузки событий');
    }
};

window.fixEventsCategories = async function() {
    try {
        const eventsRef = window.dbRef(window.database, 'events');
        const snapshot = await window.dbGet(eventsRef);
        
        if (snapshot.exists()) {
            const allEvents = snapshot.val();
            const updates = {};
            let fixedCount = 0;
            
            for (const [eventId, event] of Object.entries(allEvents)) {
                if (!event.category || event.category === 'undefined') {
                    // Присваиваем категорию "Общество" по умолчанию
                    updates[`events/${eventId}/category`] = 'society';
                    
                    // Убеждаемся что статус активный
                    if (!event.status) {
                        updates[`events/${eventId}/status`] = 'active';
                    }
                    
                    fixedCount++;
                }
            }
            
            if (fixedCount > 0) {
                await window.dbUpdate(window.dbRef(window.database), updates);
                await loadEvents();
                loadAdminEvents();
                alert(`Исправлено ${fixedCount} событий. Им присвоена категория "Общество".`);
            } else {
                alert('Нет событий для исправления');
            }
        }
    } catch (error) {
        console.error('Ошибка исправления событий:', error);
        alert('Ошибка исправления событий');
    }
};

window.finishEvent = async function(eventId, winningOptionIndex) {
    if (winningOptionIndex === '') return;

    if (!confirm('Вы уверены, что хотите завершить это событие?')) {
        return;
    }

    try {
        // Обновить статус события
        await window.dbUpdate(window.dbRef(window.database, `events/${eventId}`), { 
            status: 'finished',
            result: parseInt(winningOptionIndex),
            finishedAt: Date.now()
        });

        // Обработать ставки
        const betsRef = window.dbRef(window.database, 'bets');
        const betsSnapshot = await window.dbGet(betsRef);
        
        if (betsSnapshot.exists()) {
            const allBets = betsSnapshot.val();
            const updates = {};
            const balanceUpdates = {};
            
            for (const [betId, bet] of Object.entries(allBets)) {
                if (bet.status === 'pending') {
                    let shouldProcess = false;
                    let won = false;
                    
                    if (bet.type === 'single') {
                        // Для одиночной ставки
                        const eventBet = bet.events.find(e => e.eventId === eventId);
                        if (eventBet) {
                            shouldProcess = true;
                            won = eventBet.optionIndex === parseInt(winningOptionIndex);
                        }
                    } else if (bet.type === 'express') {
                        // Для экспресса
                        const eventBet = bet.events.find(e => e.eventId === eventId);
                        if (eventBet) {
                            const eventWon = eventBet.optionIndex === parseInt(winningOptionIndex);
                            if (!eventWon) {
                                // Экспресс проигран
                                shouldProcess = true;
                                won = false;
                            } else {
                                // Проверяем, все ли события завершены
                                const allEventsFinished = bet.events.every(e => {
                                    const event = events[e.eventId];
                                    return event && event.status === 'finished';
                                });
                                
                                if (allEventsFinished) {
                                    // Проверяем, выиграны ли все события
                                    const allEventsWon = bet.events.every(e => {
                                        const event = events[e.eventId];
                                        return event && event.result === e.optionIndex;
                                    });
                                    
                                    shouldProcess = true;
                                    won = allEventsWon;
                                }
                            }
                        }
                    }
                    
                    if (shouldProcess) {
                        updates[`bets/${betId}/status`] = won ? 'won' : 'lost';
                        updates[`bets/${betId}/settledAt`] = Date.now();
                        
                        // Начислить выигрыш
                        if (won) {
                            const winAmount = Math.round(bet.amount * bet.coefficient);
                            if (!balanceUpdates[bet.user]) {
                                balanceUpdates[bet.user] = 0;
                            }
                            balanceUpdates[bet.user] += winAmount;
                        }
                    }
                }
            }
            
            // Применить обновления ставок
            if (Object.keys(updates).length > 0) {
                await window.dbUpdate(window.dbRef(window.database), updates);
            }
            
            // Обновить балансы
            for (const [username, winAmount] of Object.entries(balanceUpdates)) {
                const userRef = window.dbRef(window.database, `users/${username}`);
                const userSnapshot = await window.dbGet(userRef);
                if (userSnapshot.exists()) {
                    const userData = userSnapshot.val();
                    await window.dbUpdate(userRef, { 
                        balance: userData.balance + winAmount 
                    });
                    
                    // Обновить текущего пользователя если это он
                    if (username === currentUser.username) {
                        currentUser.balance = userData.balance + winAmount;
                        updateUserInfo();
                    }
                }
            }
        }

        await loadEvents();
        loadAdminEvents();
        alert('Событие завершено! Выигрыши начислены.');
    } catch (error) {
        console.error('Ошибка завершения события:', error);
        alert('Ошибка завершения события');
    }
};

// ===== НАСТРОЙКИ =====
async function loadSettings() {
    try {
        const settingsRef = window.dbRef(window.database, 'settings');
        const snapshot = await window.dbGet(settingsRef);
        
        if (snapshot.exists()) {
            settings = snapshot.val();
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.addEventListener('load', async function() {
    // Ждем инициализации Firebase
    let attempts = 0;
    const maxAttempts = 50;
    
    const waitForFirebase = () => {
        if (window.database && window.dbRef && window.dbGet && window.dbSet) {
            initializeApp();
        } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(waitForFirebase, 100);
        } else {
            console.error('Firebase не инициализирован');
            alert('Ошибка подключения к базе данных');
        }
    };
    
    waitForFirebase();
});

async function initializeApp() {
    try {
        // Инициализация настроек
        const settingsRef = window.dbRef(window.database, 'settings');
        const snapshot = await window.dbGet(settingsRef);
        
        if (!snapshot.exists()) {
            await window.dbSet(settingsRef, settings);
        } else {
            settings = snapshot.val();
        }

        // Восстановление сессии
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                const userData = JSON.parse(savedUser);
                const userRef = window.dbRef(window.database, `users/${userData.username}`);
                const userSnapshot = await window.dbGet(userRef);
                
                if (userSnapshot.exists()) {
                    currentUser = { username: userData.username, ...userSnapshot.val() };
                    showApp();
                } else {
                    localStorage.removeItem('currentUser');
                }
            } catch (error) {
                console.error('Ошибка восстановления сессии:', error);
                localStorage.removeItem('currentUser');
            }
        }
        
        // Добавляем обработчики событий
        setupEventHandlers();
    } catch (error) {
        console.error('Ошибка инициализации:', error);
    }
}

function setupEventHandlers() {
    // Закрытие модального окна по клику вне его
    window.onclick = function(event) {
        const modal = document.getElementById('betModal');
        if (event.target === modal) {
            closeBetModal();
        }
    };

    // Обработка Enter в полях авторизации
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');
    
    if (usernameField && passwordField) {
        [usernameField, passwordField].forEach(field => {
            field.addEventListener('keypress', function(event) {
                if (event.key === 'Enter') {
                    login();
                }
            });
        });
    }
}
