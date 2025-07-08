// ===== PROFILE.JS С ИНТЕГРАЦИЕЙ СИНХРОНИЗАЦИИ =====

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getDatabase, 
    ref as dbRef, 
    get as dbGet, 
    update as dbUpdate
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const app = initializeApp(window.firebaseConfig);
const database = getDatabase(app);

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let currentUser = null;
let userBets = [];

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Инициализация profile.js');
    
    try {
        // Ждем инициализации sync manager
        await waitForSyncManager();
        
        // Проверяем авторизацию
        await checkAuth();
        
        // Загружаем данные профиля
        await loadProfileData();
        await loadUserBetsHistory();
        
        // Настраиваем слушатели синхронизации
        setupSyncEventListeners();
        
        console.log('✅ profile.js полностью инициализирован');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации profile.js:', error);
        showNotification('Ошибка загрузки профиля', 'error');
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
    
    console.log('✅ DataSyncManager готов для profile.js');
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
        displayProfileInfo();
        showRoleSpecificLinks();
        
        console.log('✅ Авторизация проверена в profile.js:', currentUser.username);
        
    } catch (error) {
        console.error('❌ Ошибка проверки авторизации:', error);
        window.location.href = 'login.html';
    }
}

// ===== НАСТРОЙКА СЛУШАТЕЛЕЙ СИНХРОНИЗАЦИИ =====
function setupSyncEventListeners() {
    if (!window.dataSyncManager) return;
    
    console.log('🎧 Настройка слушателей синхронизации для profile.js');
    
    window.addEventListener('dataSync', (event) => {
        const { type, data } = event.detail;
        console.log(`📡 Profile.js получил событие: ${type}`);
        
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
        const oldUser = { ...currentUser };
        currentUser = data.user;
        
        updateUserInfo();
        displayProfileInfo();
        
        // Показать уведомления о важных изменениях профиля
        if (data.changes && data.changes.length > 0) {
            data.changes.forEach(change => {
                handleProfileChangeNotification(change, oldUser);
            });
        }
        
        // Перезагрузить статистику ставок
        loadUserBetsHistory();
        
        console.log('🔄 Данные профиля обновлены');
    }
}

function handleProfileChangeNotification(change, oldUser) {
    switch (change.field) {
        case 'role':
            showNotification(`Ваша роль изменена на: ${getRoleName(change.newValue)}`, 'info');
            showRoleSpecificLinks(); // Обновить ссылки в меню
            break;
            
        case 'betLimit':
            showNotification(`Лимит ставки изменен на: ${change.newValue.toLocaleString()} лупанчиков`, 'info');
            break;
            
        case 'status':
            if (change.newValue === 'inactive') {
                showNotification('Ваш аккаунт был заблокирован', 'error');
            } else if (change.newValue === 'active' && change.oldValue === 'inactive') {
                showNotification('Ваш аккаунт разблокирован', 'success');
            }
            break;
    }
}

function handleConnectionRestored() {
    showNotification('Соединение восстановлено! Обновление профиля...', 'success');
    loadProfileData();
}

function handleConnectionLost() {
    showNotification('Соединение потеряно. Отображается локальная информация.', 'warning');
}

// ===== ОБНОВЛЕНИЕ ИНТЕРФЕЙСА =====
function updateUserInfo() {
    if (!currentUser) return;
    
    const balanceElement = document.getElementById('user-balance');
    const usernameElement = document.getElementById('username');
    
    if (balanceElement) {
        balanceElement.textContent = `${currentUser.balance.toLocaleString()} лупанчиков`;
        
        // Добавить анимацию при обновлении баланса
        balanceElement.style.transform = 'scale(1.1)';
        balanceElement.style.transition = 'transform 0.2s ease';
        setTimeout(() => {
            balanceElement.style.transform = 'scale(1)';
        }, 200);
    }
    
    if (usernameElement) {
        usernameElement.textContent = currentUser.username;
    }
}

function showRoleSpecificLinks() {
    if (!currentUser) return;
    
    const adminLink = document.getElementById("admin-link");
    const moderatorLink = document.getElementById("moderator-link");
    
    if (adminLink) {
        adminLink.style.display = currentUser.role === "admin" ? "block" : "none";
    }
    
    if (moderatorLink) {
        moderatorLink.style.display = currentUser.role === "moderator" ? "block" : "none";
    }
}

// ===== ОТОБРАЖЕНИЕ ИНФОРМАЦИИ О ПРОФИЛЕ =====
function displayProfileInfo() {
    if (!currentUser) return;
    
    const elements = {
        'profile-username': currentUser.username,
        'profile-role': getRoleName(currentUser.role),
        'profile-balance': `${currentUser.balance.toLocaleString()} лупанчиков`,
        'profile-bet-limit': `${(currentUser.betLimit || 1000).toLocaleString()} лупанчиков`,
        'profile-status': currentUser.status === 'active' ? 'Активен' : 'Заблокирован'
    };
    
    // Обновить элементы с анимацией
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            // Анимация обновления
            element.style.opacity = '0.5';
            element.style.transition = 'opacity 0.3s ease';
            
            setTimeout(() => {
                element.textContent = value;
                element.style.opacity = '1';
            }, 150);
        }
    });
    
    // Отображение даты регистрации
    const regElement = document.getElementById('profile-registered');
    if (regElement) {
        if (currentUser.registeredAt) {
            const regDate = new Date(currentUser.registeredAt).toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            regElement.textContent = regDate;
        } else {
            regElement.textContent = 'Неизвестно';
        }
    }
    
    // Обновить цвет статуса
    const statusElement = document.getElementById('profile-status');
    if (statusElement) {
        statusElement.className = currentUser.status === 'active' ? 'status-active' : 'status-inactive';
    }
}

function getRoleName(role) {
    const roles = {
        'admin': 'Администратор',
        'moderator': 'Модератор',
        'user': 'Пользователь'
    };
    return roles[role] || 'Пользователь';
}

// ===== ЗАГРУЗКА ДАННЫХ ПРОФИЛЯ =====
async function loadProfileData() {
    try {
        if (window.dataSyncManager) {
            // Принудительно обновить данные из Firebase
            await window.dataSyncManager.forceRefresh();
            currentUser = window.dataSyncManager.getCurrentUser();
        } else {
            // Обновить данные из Firebase напрямую
            const userRef = dbRef(database, `users/${currentUser.username}`);
            const snapshot = await dbGet(userRef);
            
            if (snapshot.exists()) {
                const userData = snapshot.val();
                currentUser = {
                    username: currentUser.username,
                    ...userData
                };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            }
        }
        
        updateUserInfo();
        displayProfileInfo();
        
        console.log('✅ Данные профиля обновлены');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных профиля:', error);
        showNotification('Ошибка обновления данных профиля', 'error');
    }
}

// ===== ЗАГРУЗКА ИСТОРИИ СТАВОК =====
async function loadUserBetsHistory() {
    try {
        const betsRef = dbRef(database, 'bets');
        const snapshot = await dbGet(betsRef);
        
        if (snapshot.exists()) {
            const allBets = snapshot.val();
            userBets = Object.entries(allBets)
                .filter(([betId, bet]) => bet.user === currentUser.username)
                .map(([betId, bet]) => ({ id: betId, ...bet }))
                .sort((a, b) => b.timestamp - a.timestamp);
            
            displayProfileStats();
            
            console.log(`✅ Загружено ${userBets.length} ставок для статистики профиля`);
        } else {
            userBets = [];
            displayProfileStats();
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки истории ставок:', error);
    }
}

// ===== ОТОБРАЖЕНИЕ СТАТИСТИКИ =====
function displayProfileStats() {
    const statsContainer = document.getElementById('profile-stats');
    if (!statsContainer) return;
    
    const totalBets = userBets.length;
    const wonBets = userBets.filter(bet => bet.status === 'won').length;
    const lostBets = userBets.filter(bet => bet.status === 'lost').length;
    const pendingBets = userBets.filter(bet => bet.status === 'pending').length;
    
    const totalStaked = userBets.reduce((sum, bet) => sum + bet.amount, 0);
    const totalWon = userBets
        .filter(bet => bet.status === 'won')
        .reduce((sum, bet) => sum + (bet.winAmount || bet.amount * bet.coefficient), 0);
    
    const winRate = (wonBets + lostBets) > 0 ? ((wonBets / (wonBets + lostBets)) * 100).toFixed(1) : 0;
    const profit = totalWon - totalStaked;
    const avgBet = totalBets > 0 ? (totalStaked / totalBets).toFixed(0) : 0;
    
    // Рассчитать дополнительную статистику
    const bestWin = userBets
        .filter(bet => bet.status === 'won')
        .reduce((max, bet) => Math.max(max, bet.winAmount || bet.amount * bet.coefficient), 0);
    
    const totalCoefficient = userBets
        .reduce((sum, bet) => sum + bet.coefficient, 0);
    const avgCoefficient = totalBets > 0 ? (totalCoefficient / totalBets).toFixed(2) : 0;
    
    // Анимация обновления статистики
    statsContainer.style.opacity = '0';
    statsContainer.innerHTML = `
        <div class="profile-stat-card">
            <div class="stat-number" data-target="${totalBets}">0</div>
            <div class="stat-label">Всего ставок</div>
        </div>
        <div class="profile-stat-card">
            <div class="stat-number" data-target="${wonBets}">0</div>
            <div class="stat-label">Выиграно</div>
        </div>
        <div class="profile-stat-card">
            <div class="stat-number" data-target="${lostBets}">0</div>
            <div class="stat-label">Проиграно</div>
        </div>
        <div class="profile-stat-card">
            <div class="stat-number" data-target="${pendingBets}">0</div>
            <div class="stat-label">В ожидании</div>
        </div>
        <div class="profile-stat-card">
            <div class="stat-number ${winRate >= 50 ? 'positive' : 'negative'}" data-target="${winRate}">${winRate}%</div>
            <div class="stat-label">Процент побед</div>
        </div>
        <div class="profile-stat-card">
            <div class="stat-number ${profit >= 0 ? 'positive' : 'negative'}" data-target="${profit}">${profit >= 0 ? '+' : ''}${profit}</div>
            <div class="stat-label">Прибыль</div>
        </div>
        <div class="profile-stat-card">
            <div class="stat-number" data-target="${totalStaked}">${totalStaked.toLocaleString()}</div>
            <div class="stat-label">Всего поставлено</div>
        </div>
        <div class="profile-stat-card">
            <div class="stat-number" data-target="${avgBet}">${avgBet}</div>
            <div class="stat-label">Средняя ставка</div>
        </div>
        <div class="profile-stat-card">
            <div class="stat-number" data-target="${bestWin}">${bestWin.toLocaleString()}</div>
            <div class="stat-label">Лучший выигрыш</div>
        </div>
        <div class="profile-stat-card">
            <div class="stat-number" data-target="${avgCoefficient}">${avgCoefficient}</div>
            <div class="stat-label">Средний коэффициент</div>
        </div>
    `;
    
    // Анимация появления с подсчетом чисел
    setTimeout(() => {
        statsContainer.style.transition = 'opacity 0.5s ease';
        statsContainer.style.opacity = '1';
        
        // Анимация подсчета чисел
        animateCounters();
    }, 100);
}

function animateCounters() {
    const counters = document.querySelectorAll('.stat-number[data-target]');
    
    counters.forEach(counter => {
        const target = parseFloat(counter.getAttribute('data-target'));
        const isPercent = counter.textContent.includes('%');
        const isNegative = target < 0;
        
        let current = 0;
        const increment = target / 50; // 50 кадров анимации
        
        const animate = () => {
            if ((increment > 0 && current < target) || (increment < 0 && current > target)) {
                current += increment;
                
                if (isPercent) {
                    counter.textContent = current.toFixed(1) + '%';
                } else if (target >= 1000) {
                    counter.textContent = (isNegative && current < 0 ? '' : (current > 0 ? '+' : '')) + Math.round(current).toLocaleString();
                } else {
                    counter.textContent = (isNegative && current < 0 ? '' : (current > 0 && !isPercent ? '+' : '')) + current.toFixed(target % 1 === 0 ? 0 : 2);
                }
                
                requestAnimationFrame(animate);
            } else {
                // Финальное значение
                if (isPercent) {
                    counter.textContent = target.toFixed(1) + '%';
                } else {
                    counter.textContent = (isNegative && target < 0 ? '' : (target > 0 && !isPercent ? '+' : '')) + 
                                        (target >= 1000 ? target.toLocaleString() : target.toFixed(target % 1 === 0 ? 0 : 2));
                }
            }
        };
        
        // Запуск анимации с задержкой для каждого счетчика
        setTimeout(animate, Math.random() * 200);
    });
}

// ===== ИЗМЕНЕНИЕ ПАРОЛЯ =====
async function changePassword() {
    const currentPassword = document.getElementById('currentPassword')?.value?.trim();
    const newPassword = document.getElementById('newPassword')?.value?.trim();
    const confirmPassword = document.getElementById('confirmPassword')?.value?.trim();
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (newPassword.length < 4) {
        showNotification('Новый пароль должен содержать минимум 4 символа', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('Новые пароли не совпадают', 'error');
        return;
    }
    
    if (currentPassword !== currentUser.password) {
        showNotification('Неверный текущий пароль', 'error');
        return;
    }
    
    try {
        // Показать состояние загрузки
        const changeBtn = document.querySelector('button[onclick="changePassword()"]');
        const originalText = changeBtn.textContent;
        changeBtn.textContent = 'Изменение...';
        changeBtn.disabled = true;
        
        if (window.dataSyncManager) {
            // Обновить через sync manager
            await window.dataSyncManager.updateUserData({ password: newPassword });
        } else {
            // Обновить напрямую в Firebase
            const userRef = dbRef(database, `users/${currentUser.username}`);
            await dbUpdate(userRef, { password: newPassword });
            
            // Обновить локальные данные
            currentUser.password = newPassword;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }
        
        // Очистить форму
        ['currentPassword', 'newPassword', 'confirmPassword'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });
        
        showNotification('Пароль успешно изменен!', 'success');
        
        // Восстановить кнопку
        changeBtn.textContent = originalText;
        changeBtn.disabled = false;
        
        console.log('✅ Пароль успешно изменен');
        
    } catch (error) {
        console.error('❌ Ошибка изменения пароля:', error);
        showNotification('Ошибка изменения пароля: ' + error.message, 'error');
        
        // Восстановить кнопку в случае ошибки
        const changeBtn = document.querySelector('button[onclick="changePassword()"]');
        if (changeBtn) {
            changeBtn.textContent = 'Изменить пароль';
            changeBtn.disabled = false;
        }
    }
}

// ===== МОДАЛЬНЫЕ ОКНА =====
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// Закрытие модальных окон по клику вне их
window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

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
window.changePassword = changePassword;
window.closeModal = closeModal;
window.logout = logout;
