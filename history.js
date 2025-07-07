// ===== ИНИЦИАЛИЗАЦИЯ FIREBASE =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getDatabase, 
    ref as dbRef, 
    get as dbGet
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const app = initializeApp(window.firebaseConfig);
const database = getDatabase(app);

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let currentUser = null;
let allUserBets = [];
let filteredBets = [];
let events = {};

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadEvents();
    loadUserBetsHistory();
});

function checkAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (!savedUser) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = JSON.parse(savedUser);
    updateUserInfo();
    
    // Показать админ ссылку если пользователь админ/модератор
    if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
        document.getElementById('admin-link').style.display = 'block';
    }
}

function updateUserInfo() {
    if (!currentUser) return;
    
    document.getElementById('user-balance').textContent = `${currentUser.balance.toLocaleString()} лупанчиков`;
    document.getElementById('username').textContent = currentUser.username;
}

// ===== ЗАГРУЗКА СОБЫТИЙ =====
async function loadEvents() {
    try {
        const eventsRef = dbRef(database, 'events');
        const snapshot = await dbGet(eventsRef);
        
        if (snapshot.exists()) {
            events = snapshot.val();
        }
    } catch (error) {
        console.error('Ошибка загрузки событий:', error);
    }
}

// ===== ЗАГРУЗКА ИСТОРИИ СТАВОК =====
async function loadUserBetsHistory() {
    if (!currentUser) return;

    try {
        const container = document.getElementById('bets-history-container');
        container.innerHTML = '<div class="loading">Загрузка истории ставок...</div>';

        const betsRef = dbRef(database, 'bets');
        const snapshot = await dbGet(betsRef);

        if (snapshot.exists()) {
            const allBets = snapshot.val();
            allUserBets = Object.entries(allBets)
                .filter(([betId, bet]) => bet.user === currentUser.username)
                .map(([betId, bet]) => ({ id: betId, ...bet }))
                .sort((a, b) => b.timestamp - a.timestamp);

            filteredBets = [...allUserBets];
            displayUserStats();
            displayBets();
        } else {
            allUserBets = [];
            filteredBets = [];
            displayUserStats();
            displayEmptyState();
        }
    } catch (error) {
        console.error('Ошибка загрузки истории ставок:', error);
        const container = document.getElementById('bets-history-container');
        container.innerHTML = '<div class="empty-state"><h3>Ошибка загрузки</h3><p>Не удалось загрузить историю ставок</p></div>';
    }
};

// ===== ОТОБРАЖЕНИЕ СТАТИСТИКИ =====
function displayUserStats() {
    const statsContainer = document.getElementById('user-stats');
    
    const totalBets = allUserBets.length;
    const wonBets = allUserBets.filter(bet => bet.status === 'won').length;
    const lostBets = allUserBets.filter(bet => bet.status === 'lost').length;
    const pendingBets = allUserBets.filter(bet => bet.status === 'pending').length;
    
    const totalStaked = allUserBets.reduce((sum, bet) => sum + bet.amount, 0);
    const totalWon = allUserBets
        .filter(bet => bet.status === 'won')
        .reduce((sum, bet) => sum + (bet.winAmount || bet.amount * bet.coefficient), 0);
    
    const winRate = (wonBets + lostBets) > 0 ? ((wonBets / (wonBets + lostBets)) * 100).toFixed(1) : 0;
    const profit = totalWon - totalStaked;
    
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${totalBets}</div>
            <div class="stat-label">Всего ставок</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${wonBets}</div>
            <div class="stat-label">Выиграно</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${lostBets}</div>
            <div class="stat-label">Проиграно</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${pendingBets}</div>
            <div class="stat-label">В ожидании</div>
        </div>
        <div class="stat-card">
            <div class="stat-number ${winRate >= 50 ? 'positive' : 'negative'}">${winRate}%</div>
            <div class="stat-label">Процент побед</div>
        </div>
        <div class="stat-card">
            <div class="stat-number ${profit >= 0 ? 'positive' : 'negative'}">${profit >= 0 ? '+' : ''}${profit}</div>
            <div class="stat-label">Прибыль (лупанчики)</div>
        </div>
    `;
}

// ===== ОТОБРАЖЕНИЕ СТАВОК =====
function displayBets() {
    const container = document.getElementById('bets-history-container');
    
    if (filteredBets.length === 0) {
        displayEmptyState();
        return;
    }

    container.innerHTML = filteredBets.map(bet => {
        const potentialWin = (bet.amount * bet.coefficient).toFixed(2);
        const actualWin = bet.status === 'won' ? 
            (bet.winAmount || bet.amount * bet.coefficient).toFixed(2) : 0;

        return `
            <div class="bet-history-item">
                <div class="bet-header">
                    <div class="bet-id">Ставка #${bet.id.substring(0, 8)}</div>
                    <div class="bet-status status-${bet.status}">${getStatusName(bet.status)}</div>
                </div>
                
                <div class="bet-details">
                    <div class="bet-info-item">
                        <div class="bet-info-label">Тип</div>
                        <div class="bet-info-value">${bet.type === 'single' ? 'Одиночная' : 'Экспресс'}</div>
                    </div>
                    <div class="bet-info-item">
                        <div class="bet-info-label">Сумма</div>
                        <div class="bet-info-value">${bet.amount} лупанчиков</div>
                    </div>
                    <div class="bet-info-item">
                        <div class="bet-info-label">Коэффициент</div>
                        <div class="bet-info-value">${bet.coefficient}</div>
                    </div>
                    <div class="bet-info-item">
                        <div class="bet-info-label">Возможный выигрыш</div>
                        <div class="bet-info-value">${potentialWin} лупанчиков</div>
                    </div>
                    ${bet.status === 'won' ? `
                        <div class="bet-info-item">
                            <div class="bet-info-label">Фактический выигрыш</div>
                            <div class="bet-info-value positive">${actualWin} лупанчиков</div>
                        </div>
                    ` : ''}
                    ${bet.status === 'lost' ? `
                        <div class="bet-info-item">
                            <div class="bet-info-label">Проигрыш</div>
                            <div class="bet-info-value negative">-${bet.amount} лупанчиков</div>
                        </div>
                    ` : ''}
                    <div class="bet-info-item">
                        <div class="bet-info-label">Дата</div>
                        <div class="bet-info-value">${new Date(bet.timestamp).toLocaleDateString()}</div>
                    </div>
                </div>

                <div class="bet-events">
                    <div class="bet-events-title">События:</div>
                    ${bet.events.map(event => {
                        const eventData = events[event.eventId];
                        return `
                            <div class="bet-event">
                                <div class="event-title">${event.eventTitle || eventData?.title || 'Неизвестное событие'}</div>
                                <div class="event-choice">Выбор: ${event.option} (${event.coefficient})</div>
                                ${bet.status !== 'pending' && eventData?.winningOption ? `
                                    <div class="event-result ${event.option === eventData.winningOption ? 'correct' : 'incorrect'}">
                                        ${event.option === eventData.winningOption ? '✓ Угадано' : '✗ Не угадано'}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function displayEmptyState() {
    const container = document.getElementById('bets-history-container');
    container.innerHTML = `
        <div class="empty-state">
            <h3>У вас пока нет ставок</h3>
            <p>Перейдите на страницу событий, чтобы сделать первую ставку!</p>
            <a href="main.html" class="btn">Перейти к событиям</a>
        </div>
    `;
}

// ===== ФИЛЬТРАЦИЯ =====
function applyFilters() {
    const statusFilter = document.getElementById('statusFilter').value;
    const typeFilter = document.getElementById('typeFilter').value;
    const periodFilter = document.getElementById('periodFilter').value;

    filteredBets = allUserBets.filter(bet => {
        // Фильтр по статусу
        if (statusFilter !== 'all' && bet.status !== statusFilter) {
            return false;
        }

        // Фильтр по типу
        if (typeFilter !== 'all' && bet.type !== typeFilter) {
            return false;
        }

        // Фильтр по периоду
        if (periodFilter !== 'all') {
            const betDate = new Date(bet.timestamp);
            const now = new Date();
            
            switch (periodFilter) {
                case 'today':
                    if (betDate.toDateString() !== now.toDateString()) {
                        return false;
                    }
                    break;
                case 'week':
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    if (betDate < weekAgo) {
                        return false;
                    }
                    break;
                case 'month':
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    if (betDate < monthAgo) {
                        return false;
                    }
                    break;
            }
        }

        return true;
    });

    displayBets();
};

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function getStatusName(status) {
    const statuses = {
        'pending': 'Ожидает результата',
        'won': 'Выиграла',
        'lost': 'Проиграла',
        'cancelled': 'Отменена'
    };
    return statuses[status] || status;
}

// ===== ВЫХОД ИЗ СИСТЕМЫ =====
function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

// Экспортируем функции в глобальную область видимости
window.loadUserBetsHistory = loadUserBetsHistory;
window.applyFilters = applyFilters;
window.logout = logout;

// Автообновление каждые 60 секунд
setInterval(() => {
    loadUserBetsHistory();
}, 60000);
