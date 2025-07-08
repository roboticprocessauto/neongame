// ===== ИНИЦИАЛИЗАЦИЯ FIREBASE =====
// Используем Firebase compat API вместо ES6 импортов

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let currentUser = null;
let events = {};
let bets = {};

// ===== ВЫХОД =====
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
    console.log('🚀 Инициализация moderator.js');
    
    try {
        // Ждем инициализации Firebase
        await waitForFirebase();
        
        // Проверяем авторизацию
        await checkAuth();
        
        // Загружаем данные
        await loadData();
        
        console.log('✅ moderator.js полностью инициализирован');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации moderator.js:', error);
        showNotification('Ошибка загрузки панели модератора', 'error');
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
    
    console.log('🔥 Firebase готов для moderator.js');
}

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

    if (currentUser.role !== 'moderator' && currentUser.role !== 'admin') {
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
        loadBets()
    ]);
}

// ===== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК =====
function switchTab(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    event.target.classList.add('active');
}

// ===== СОБЫТИЯ =====
async function loadEvents() {
    try {
        const eventsRef = window.firebase.database().ref('events');
        const snapshot = await eventsRef.once('value');
        if (snapshot.exists()) {
            events = snapshot.val();
            displayEvents();
        }
    } catch (error) {
        console.error('Ошибка загрузки событий:', error);
    }
}

function displayEvents() {
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
                    <strong>${event.title}</strong><br>
                    <small>${event.category} | ${event.status}</small>
                </div>
                <div>
                    <button class="btn" onclick="editEvent('${id}')" style="margin-right:5px;">Редактировать</button>
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
        const newEvent = { title, description, category, options, coefficients, status: 'active', createdAt: Date.now() };
        const eventsRef = window.firebase.database().ref('events');
        const newEventRef = eventsRef.push();
        await newEventRef.set(newEvent);

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
    document.getElementById('eventCategory').value = event.category;
    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventDescription').value = event.description;
    document.getElementById('eventOptions').value = event.options.join(', ');
    document.getElementById('eventCoefficients').value = event.coefficients.join(', ');
    showNotification('Форма заполнена данными события. Измените нужные поля и нажмите "Добавить событие"', 'info');
}

async function deleteEvent(eventId) {
    if (!confirm('Вы уверены, что хотите удалить это событие?')) return;
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

function openFinishEventModal(eventId) {
    const event = events[eventId];
    if (!event) return;
    document.getElementById('finishEventTitle').textContent = event.title;
    const select = document.getElementById('finishEventOption');
    select.innerHTML = event.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
    select.dataset.eventId = eventId;
    document.getElementById('finishEventModal').style.display = 'block';
}

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

// ===== СТАВКИ =====
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

// ===== ЭКСПОРТ ВСЕХ ФУНКЦИЙ В ГЛОБАЛЬНУЮ ОБЛАСТЬ ВИДИМОСТИ =====
window.switchTab = switchTab;
window.addEvent = addEvent;
window.editEvent = editEvent;
window.deleteEvent = deleteEvent;
window.loadEvents = loadEvents;
window.loadBets = loadBets;
window.filterBets = filterBets;
window.viewBet = viewBet;
window.closeModal = closeModal;
window.logout = logout;
window.openFinishEventModal = openFinishEventModal;
window.finishEventConfirm = finishEventConfirm;
