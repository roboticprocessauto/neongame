// ===== СИСТЕМА СИНХРОНИЗАЦИИ ДАННЫХ =====

// sync-manager.js - Менеджер синхронизации данных
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getDatabase, 
    ref as dbRef, 
    get as dbGet, 
    onValue, 
    off,
    serverTimestamp,
    update as dbUpdate
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

class DataSyncManager {
    constructor() {
        this.app = initializeApp(window.firebaseConfig);
        this.database = getDatabase(this.app);
        this.currentUser = null;
        this.userRef = null;
        this.listeners = new Map();
        this.syncInterval = null;
        this.isOnline = navigator.onLine;
        this.pendingUpdates = new Map();
        
        this.setupEventListeners();
    }

    // ===== ИНИЦИАЛИЗАЦИЯ И ОЧИСТКА =====
    
    async initializeUser(username) {
        try {
            // Очистить предыдущие слушатели
            this.cleanup();
            
            // Установить ссылку на пользователя
            this.userRef = dbRef(this.database, `users/${username}`);
            
            // Получить актуальные данные из Firebase
            const snapshot = await dbGet(this.userRef);
            
            if (!snapshot.exists()) {
                throw new Error('Пользователь не найден в базе данных');
            }
            
            const userData = snapshot.val();
            this.currentUser = {
                username: username,
                ...userData,
                lastSync: Date.now()
            };
            
            // Сохранить в localStorage
            this.updateLocalStorage();
            
            // Настроить real-time слушатели
            this.setupRealtimeListeners();
            
            // Запустить периодическую синхронизацию
            this.startPeriodicSync();
            
            console.log('✅ Пользователь инициализирован и синхронизирован');
            return this.currentUser;
            
        } catch (error) {
            console.error('❌ Ошибка инициализации пользователя:', error);
            throw error;
        }
    }
    
    cleanup() {
        // Остановить все слушатели
        this.listeners.forEach((unsubscribe, key) => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.listeners.clear();
        
        // Остановить периодическую синхронизацию
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        // Очистить ссылку на пользователя
        if (this.userRef) {
            off(this.userRef);
            this.userRef = null;
        }
        
        console.log('🧹 Очистка синхронизации завершена');
    }

    // ===== REAL-TIME СЛУШАТЕЛИ =====
    
    setupRealtimeListeners() {
        if (!this.userRef || !this.currentUser) return;
        
        // Слушатель изменений пользователя
        const userUnsubscribe = onValue(this.userRef, (snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                const oldBalance = this.currentUser.balance;
                
                this.currentUser = {
                    username: this.currentUser.username,
                    ...userData,
                    lastSync: Date.now()
                };
                
                this.updateLocalStorage();
                this.notifyDataChange('user', this.currentUser);
                
                // Показать уведомление об изменении баланса
                if (oldBalance !== userData.balance) {
                    const diff = userData.balance - oldBalance;
                    this.showBalanceNotification(diff);
                }
                
                console.log('🔄 Данные пользователя обновлены в реальном времени');
            }
        }, (error) => {
            console.error('❌ Ошибка слушателя пользователя:', error);
        });
        
        this.listeners.set('user', userUnsubscribe);
        
        // Слушатель настроек системы
        const settingsRef = dbRef(this.database, 'settings');
        const settingsUnsubscribe = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                const settings = snapshot.val();
                this.notifyDataChange('settings', settings);
                console.log('⚙️ Настройки системы обновлены');
            }
        });
        
        this.listeners.set('settings', settingsUnsubscribe);
    }

    // ===== УПРАВЛЕНИЕ ЛОКАЛЬНЫМ ХРАНИЛИЩЕМ =====
    
    updateLocalStorage() {
        if (this.currentUser) {
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            localStorage.setItem('lastSyncTime', Date.now().toString());
        }
    }
    
    getLocalUser() {
        try {
            const userData = localStorage.getItem('currentUser');
            const lastSync = localStorage.getItem('lastSyncTime');
            
            if (userData && lastSync) {
                const user = JSON.parse(userData);
                const syncTime = parseInt(lastSync);
                
                // Проверить, не устарели ли данные (5 минут)
                if (Date.now() - syncTime < 300000) {
                    return user;
                }
            }
        } catch (error) {
            console.error('❌ Ошибка чтения localStorage:', error);
        }
        
        return null;
    }
    
    clearLocalData() {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('lastSyncTime');
        this.currentUser = null;
        console.log('🗑️ Локальные данные очищены');
    }

    // ===== ПЕРИОДИЧЕСКАЯ СИНХРОНИЗАЦИЯ =====
    
    startPeriodicSync() {
        // Синхронизация каждые 30 секунд
        this.syncInterval = setInterval(() => {
            this.forceSyncFromFirebase();
        }, 30000);
        
        console.log('⏰ Периодическая синхронизация запущена');
    }
    
    async forceSyncFromFirebase() {
        if (!this.userRef || !this.isOnline) return;
        
        try {
            const snapshot = await dbGet(this.userRef);
            
            if (snapshot.exists()) {
                const userData = snapshot.val();
                const oldUser = { ...this.currentUser };
                
                this.currentUser = {
                    username: this.currentUser.username,
                    ...userData,
                    lastSync: Date.now()
                };
                
                this.updateLocalStorage();
                
                // Проверить изменения
                const changes = this.detectChanges(oldUser, this.currentUser);
                if (changes.length > 0) {
                    changes.forEach(change => {
                        this.notifyDataChange('user_change', change);
                    });
                    console.log('🔄 Принудительная синхронизация: данные обновлены');
                }
                
                // Синхронизировать отложенные обновления
                await this.syncPendingUpdates();
            }
        } catch (error) {
            console.error('❌ Ошибка принудительной синхронизации:', error);
        }
    }

    // ===== ОБНОВЛЕНИЕ ДАННЫХ =====
    
    async updateUserData(updates) {
        if (!this.userRef || !this.currentUser) {
            throw new Error('Пользователь не инициализирован');
        }
        
        try {
            // Добавить временную метку
            const updateData = {
                ...updates,
                lastUpdated: serverTimestamp()
            };
            
            if (this.isOnline) {
                // Обновить в Firebase
                await dbUpdate(this.userRef, updateData);
                console.log('✅ Данные обновлены в Firebase');
            } else {
                // Сохранить для отложенного обновления
                this.addPendingUpdate(updateData);
                console.log('📤 Обновление сохранено для отложенной отправки');
            }
            
            // Обновить локальные данные
            Object.assign(this.currentUser, updates);
            this.updateLocalStorage();
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка обновления данных пользователя:', error);
            throw error;
        }
    }

    // ===== РАБОТА ОФЛАЙН =====
    
    addPendingUpdate(updateData) {
        const updateId = Date.now().toString();
        this.pendingUpdates.set(updateId, {
            data: updateData,
            timestamp: Date.now(),
            retries: 0
        });
        
        // Сохранить в localStorage
        localStorage.setItem('pendingUpdates', JSON.stringify(Array.from(this.pendingUpdates.entries())));
    }
    
    async syncPendingUpdates() {
        if (!this.isOnline || this.pendingUpdates.size === 0) return;
        
        const updates = Array.from(this.pendingUpdates.entries());
        
        for (const [updateId, updateInfo] of updates) {
            try {
                await dbUpdate(this.userRef, updateInfo.data);
                this.pendingUpdates.delete(updateId);
                console.log(`✅ Отложенное обновление ${updateId} синхронизировано`);
            } catch (error) {
                updateInfo.retries++;
                if (updateInfo.retries >= 3) {
                    this.pendingUpdates.delete(updateId);
                    console.error(`❌ Отложенное обновление ${updateId} отклонено после 3 попыток`);
                } else {
                    console.warn(`⚠️ Ошибка синхронизации ${updateId}, попытка ${updateInfo.retries}`);
                }
            }
        }
        
        // Обновить localStorage
        localStorage.setItem('pendingUpdates', JSON.stringify(Array.from(this.pendingUpdates.entries())));
    }

    // ===== ОБРАБОТКА СОБЫТИЙ =====
    
    setupEventListeners() {
        // Слушатель изменения сетевого статуса
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🌐 Соединение восстановлено');
            this.syncPendingUpdates();
            this.forceSyncFromFirebase();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('📡 Соединение потеряно - переход в офлайн режим');
        });
        
        // Слушатель закрытия страницы
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        // Слушатель изменения видимости страницы
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.currentUser) {
                // Страница стала видимой - принудительная синхронизация
                this.forceSyncFromFirebase();
            }
        });
    }

    // ===== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ =====
    
    detectChanges(oldData, newData) {
        const changes = [];
        const keys = ['balance', 'betLimit', 'role', 'status'];
        
        keys.forEach(key => {
            if (oldData[key] !== newData[key]) {
                changes.push({
                    field: key,
                    oldValue: oldData[key],
                    newValue: newData[key]
                });
            }
        });
        
        return changes;
    }
    
    showBalanceNotification(diff) {
        const message = diff > 0 
            ? `💰 Ваш баланс увеличился на ${diff} лупанчиков!`
            : `📉 Ваш баланс уменьшился на ${Math.abs(diff)} лупанчиков`;
            
        if (window.showNotification) {
            window.showNotification(message, diff > 0 ? 'success' : 'warning');
        }
    }
    
    notifyDataChange(type, data) {
        // Отправить custom event для уведомления компонентов
        const event = new CustomEvent('dataSync', {
            detail: { type, data }
        });
        window.dispatchEvent(event);
    }

    // ===== ПУБЛИЧНЫЕ МЕТОДЫ =====
    
    getCurrentUser() {
        return this.currentUser;
    }
    
    async refreshUserData() {
        return await this.forceSyncFromFirebase();
    }
    
    isUserOnline() {
        return this.isOnline;
    }
    
    getPendingUpdatesCount() {
        return this.pendingUpdates.size;
    }
}

// ===== ГЛОБАЛЬНЫЙ ЭКЗЕМПЛЯР =====
window.dataSyncManager = new DataSyncManager();

// ===== ОБНОВЛЕННЫЙ main.js С ИНТЕГРАЦИЕЙ СИНХРОНИЗАЦИИ =====

// Обновить функцию checkAuth в main.js
async function checkAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (!savedUser) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const userData = JSON.parse(savedUser);
        
        // Инициализировать синхронизацию
        currentUser = await window.dataSyncManager.initializeUser(userData.username);
        
        updateUserInfo();
        updateDailyBonusButton();
        
        // Показать админ/модератор ссылки в меню
        if (currentUser.role === "admin") {
            document.getElementById("admin-link").style.display = "block";
        } else if (currentUser.role === "moderator") {
            document.getElementById("moderator-link").style.display = "block";
        }
        
        // Настроить слушатель изменений данных
        window.addEventListener('dataSync', (event) => {
            if (event.detail.type === 'user' || event.detail.type === 'user_change') {
                currentUser = window.dataSyncManager.getCurrentUser();
                updateUserInfo();
                updateDailyBonusButton();
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка проверки авторизации:', error);
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }
}

// Обновить функцию обновления баланса
async function updateUserBalance(newBalance) {
    try {
        await window.dataSyncManager.updateUserData({ balance: newBalance });
        console.log('✅ Баланс обновлен через синхронизацию');
    } catch (error) {
        console.error('❌ Ошибка обновления баланса:', error);
        showNotification('Ошибка синхронизации данных', 'error');
    }
}

// Обновить функцию logout
function logout() {
    window.dataSyncManager.cleanup();
    window.dataSyncManager.clearLocalData();
    window.location.href = 'login.html';
}

// Добавить индикатор статуса синхронизации в интерфейс
function addSyncStatusIndicator() {
    const header = document.querySelector('.header .user-info');
    if (header) {
        const syncStatus = document.createElement('div');
        syncStatus.id = 'sync-status';
        syncStatus.style.cssText = `
            display: flex;
            align-items: center;
            font-size: 12px;
            color: #4caf50;
            margin-left: 10px;
        `;
        syncStatus.innerHTML = '🟢 Синхронизировано';
        header.appendChild(syncStatus);
        
        // Обновлять статус на основе событий синхронизации
        window.addEventListener('dataSync', () => {
            syncStatus.innerHTML = '🟢 Синхронизировано';
            syncStatus.style.color = '#4caf50';
        });
        
        window.addEventListener('offline', () => {
            syncStatus.innerHTML = '🔴 Офлайн';
            syncStatus.style.color = '#f44336';
        });
        
        window.addEventListener('online', () => {
            syncStatus.innerHTML = '🟡 Синхронизация...';
            syncStatus.style.color = '#ff9800';
        });
    }
}

// Вызвать после загрузки DOM
window.addEventListener('DOMContentLoaded', () => {
    addSyncStatusIndicator();
});

export { DataSyncManager };
