// ===== HISTORY.JS С ИНТЕГРАЦИЕЙ СИНХРОНИЗАЦИИ =====

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
window.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Инициализация history.js');
    
    try {
        // Ждем инициализации sync manager
        await waitForSyncManager();
        
        // Проверяем авторизацию
        await checkAuth();
        
        // Загружаем данные
        await loadEvents();
        await loadUserBetsHistory();
        
        // Настраиваем слушатели синхронизации
        setupSyncEventListeners();
        
        console.log('✅ history.js полностью инициализирован');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации history.js:', error);
        showNotification('Ошибка загрузки истории ставок', 'error');
    }
});

// ===== ОЖИДАНИЕ SYNC MANAGER =====
async function waitForSyncManager() {
    let attempts = 0;
    const maxAttempts = 50;
    
    while (!window.dataSyncManager && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (!window.dataSyncManager) {
        console.warn('⚠️ DataSyncManager не найден, работаем без синхронизации');
        return false;
    }
    
    console.log('✅ DataSyncManager готов для history.js');
    return true;
}

// ===== ПРОВЕРКА АВТОРИЗАЦИИ =====
async function checkAuth() {
    try {
        // Получаем пользователя из sync manager или localStorage
        if (window.dataSyncManager) {
            currentUser = window.dataSyncManager.getCurrentUser();
        }
        
        if (!currentUser) {
            const savedUser = localStorage.getItem('currentUser');
            if (!savedUser) {
                window.location.href = 'login.html';
                return;
            }
            currentUser = JSON.parse(savedUser);
        }
        
        updateUserInfo();
        showRoleSpecificLinks();
        
        console.log('✅ Авторизация проверена:', currentUser.username);
        
    } catch (error) {
        console.error('❌ Ошибка проверки авторизации:', error);
        window.location.href = 'login.html';
    }
}

// ===== НАСТРОЙКА СЛУШАТЕЛЕЙ СИНХРОНИЗАЦИИ =====
function setupSyncEventListeners() {
    if (!window.dataSyncManager) return;
    
    console.log('🎧 Настройка слушателей синхронизации для history.js');
    
    window.addEventListener('dataSync', (event) => {
        const { type, data } = event.detail;
        console.log(`📡 History.js получил событие: ${type}`);
        
        switch (type) {
            case 'user_updated':
            case 'user_refreshed':
                handleUserDataUpdate(data);
                break;
                
            case 'connection_restored':
                handleConnectionRestored();
                break;
                
            case 'connection_lost':
                handleConnectionLost();
                break;
        }
    });
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ СИНХРОНИЗАЦИИ =====
function handleUserDataUpdate(data) {
    if (data.user) {
        currentUser = data.user;
        updateUserInfo();
        
        // Перезагрузить ставки если изменились данные пользователя
        loadUserBetsHistory();
        
        console.log('🔄 Данные пользователя обновлены в history.js');
    }
}

function handleConnectionRestored() {
    showNotification('Соединение восстановлено! Обновление данных...', 'success');
    loadUserBetsHistory();
}

function handleConnectionLost() {
    showNotification('Соединение потеряно. Отображаются локальные данные.', 'warning');
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
}

function showRoleSpecificLinks() {
    if (!currentUser) return;
    
    const adminLink = document.getElementById("admin-link");
    const moderatorLink = document.getElementById("moderator-link");
    
    if (adminLink && currentUser.role === "admin") {
        adminLink.style.display = "block";
    }
    
    if (moderatorLink && currentUser.role === "moderator") {
        moderatorLink.style.display = "block";
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
        
        console.log('📅 События загружены для истории');
    } catch (error) {
        console.error('❌ Ошибка загрузки событий:', error);
    }
}

// ===== ЗАГРУЗКА ИСТОРИИ СТАВОК =====
async function loadUserBetsHistory() {
    if (!currentUser) return;

    try {
        const container = document.getElementById('bets-history-container');
        if (container) {
            container.innerHTML = '<div class="loading">🔄 Загрузка истории ставок...</div>';
        }

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
            
            console.log(`✅ Загружено ${allUserBets.length} ставок для пользователя ${currentUser.username}`);
        } else {
            allUserBets = [];
            filteredBets = [];
            displayUserStats();
            displayEmptyState();
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки истории ставок:', error);
        const container = document.getElementById('bets-history-container');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>⚠️ Ошибка загрузки</h3>
                    <p>Не удалось загрузить историю ставок</p>
                    <button class="btn" onclick="loadUserBetsHistory()">Попробовать снова</button>
                </div>
            `;
        }
    }
}

// ===== ОТОБРАЖЕНИЕ СТАТИСТИКИ =====
function displayUserStats() {
    const statsContainer = document.getElementById('user-stats');
    if (!statsContainer) return;
    
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
    
    // Добавляем анимацию появления статистики
    statsContainer.style.opacity = '0';
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
    
    // Анимация появления
    setTimeout(() => {
        statsContainer.style.transition = 'opacity 0.5s ease';
        statsContainer.style.opacity = '1';
    }, 100);
}

// ===== ОТОБРАЖЕНИЕ СТАВОК =====
function displayBets() {
    const container = document.getElementById('bets-history-container');
    if (!container) return;
    
    if (filteredBets.length === 0) {
        displayEmptyState();
        return;
    }

    container.innerHTML = filteredBets.map(bet => {
        const potentialWin = (bet.amount * bet.coefficient).toFixed(2);
        const actualWin = bet.status === 'won' ? 
            (bet.winAmount || bet.amount * bet.coefficient).toFixed(2) : 0;

        return `
            <div class="bet-history-item" data-bet-id="${bet.id}">
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
                        <div class="bet-info-value">${new Date(bet.timestamp).toLocaleString()}</div>
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
    
    // Добавляем анимацию появления элементов
    const betItems = container.querySelectorAll('.bet-history-item');
    betItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        setTimeout(() => {
            item.style.transition = 'all 0.3s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

function displayEmptyState() {
    const container = document.getElementById('bets-history-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <div style="font-size: 64px; margin-bottom: 20px;">🎯</div>
            <h3>У вас пока нет ставок</h3>
            <p>Перейдите на страницу событий, чтобы сделать первую ставку!</p>
            <a href="main.html" class="btn">Перейти к событиям</a>
        </div>
    `;
}

// ===== ФИЛЬТРАЦИЯ =====
function applyFilters() {
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const typeFilter = document.getElementById('typeFilter')?.value || 'all';
    const periodFilter = document.getElementById('periodFilter')?.value || 'all';

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
    
    // Показать количество отфильтрованных результатов
    const totalText = filteredBets.length === allUserBets.length 
        ? `Показано ${filteredBets.length} ставок`
        : `Показано ${filteredBets.length} из ${allUserBets.length} ставок`;
        
    showNotification(totalText, 'info');
    
    console.log(`🔍 Применены фильтры: показано ${filteredBets.length} из ${allUserBets.length} ставок`);
}

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
    
    // Автоудаление через 3 секунды
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 3000);
}

// ===== ВЫХОД ИЗ СИСТЕМЫ =====
function logout() {
    try {
        // Очистить sync manager если доступен
        if (window.dataSyncManager) {
            window.dataSyncManager.cleanup();
            window.dataSyncManager.clearLocalData();
        }
        
        // Очистить localStorage
        localStorage.removeItem('currentUser');
        
        // Перенаправить
        window.location.href = 'login.html';
    } catch (error) {
        console.error('❌ Ошибка выхода из системы:', error);
        window.location.href = 'login.html';
    }
}

// ===== ЭКСПОРТ ФУНКЦИЙ =====
window.loadUserBetsHistory = loadUserBetsHistory;
window.applyFilters = applyFilters;
window.logout = logout;

// ===== АВТООБНОВЛЕНИЕ =====
// Автообновление каждые 60 секунд только если есть соединение
setInterval(() => {
    if (window.dataSyncManager && window.dataSyncManager.isUserOnline()) {
        loadUserBetsHistory();
    }
}, 60000);
