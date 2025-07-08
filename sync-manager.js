// ===== УЛУЧШЕННАЯ СИСТЕМА СИНХРОНИЗАЦИИ ДАННЫХ =====

// sync-manager.js - Менеджер синхронизации данных
// Используем глобальный объект Firebase вместо ES6 импортов

class DataSyncManager {
    constructor() {
        this.app = null;
        this.database = null;
        this.currentUser = null;
        this.userRef = null;
        this.listeners = new Map();
        this.syncInterval = null;
        this.isOnline = navigator.onLine;
        this.pendingUpdates = new Map();
        this.lastSyncTime = 0;
        this.syncInProgress = false;
        
        this.init();
    }

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    async init() {
        try {
            // Ждем загрузки Firebase
            await this.waitForFirebase();
            
            this.app = window.firebase.initializeApp(window.firebaseConfig);
            this.database = window.firebase.database();
            this.setupEventListeners();
            this.loadPendingUpdates();
            console.log('🔄 DataSyncManager инициализирован');
        } catch (error) {
            console.error('❌ Ошибка инициализации DataSyncManager:', error);
        }
    }
    
    // ===== ОЖИДАНИЕ FIREBASE =====
    async waitForFirebase() {
        let attempts = 0;
        const maxAttempts = 50; // 5 секунд
        
        while (!window.firebase && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.firebase) {
            throw new Error('Firebase не загружен');
        }
        
        console.log('🔥 Firebase готов для DataSyncManager');
    }
    
    // ===== ИНИЦИАЛИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ =====
    async initializeUser(username) {
        try {
            console.log(`🔄 Инициализация пользователя: ${username}`);
            
            // Очистить предыдущие данные
            this.cleanup();
            
            // Установить ссылку на пользователя
            this.userRef = this.database.ref(`users/${username}`);
            
            // Получить актуальные данные из Firebase
            const snapshot = await this.userRef.once('value');
            
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
            
            // Настроить обработку отключения
            this.setupDisconnectHandlers();
            
            // Запустить периодическую синхронизацию
            this.startPeriodicSync();
            
            // Синхронизировать отложенные обновления
            await this.syncPendingUpdates();
            
            console.log('✅ Пользователь инициализирован и синхронизирован:', this.currentUser);
            return this.currentUser;
            
        } catch (error) {
            console.error('❌ Ошибка инициализации пользователя:', error);
            throw error;
        }
    }
    
    // ===== REAL-TIME СЛУШАТЕЛИ =====
    setupRealtimeListeners() {
        if (!this.userRef || !this.currentUser) return;
        
        console.log('🎧 Настройка real-time слушателей');
        
        // Слушатель изменений пользователя
        const userUnsubscribe = this.userRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                const firebaseData = snapshot.val();
                const oldUser = { ...this.currentUser };
                
                // Обновить данные пользователя
                this.currentUser = {
                    username: this.currentUser.username,
                    ...firebaseData,
                    lastSync: Date.now()
                };
                
                // Сохранить в localStorage
                this.updateLocalStorage();
                
                // Определить изменения
                const changes = this.detectUserChanges(oldUser, this.currentUser);
                
                // Уведомить компоненты об изменениях
                this.notifyDataChange('user_updated', {
                    user: this.currentUser,
                    changes: changes
                });
                
                // Показать уведомления о важных изменениях
                this.handleUserChangeNotifications(changes);
                
                console.log('🔄 Данные пользователя обновлены в реальном времени:', changes);
            }
        }, (error) => {
            console.error('❌ Ошибка слушателя пользователя:', error);
        });
        
        this.listeners.set('user', userUnsubscribe);
        
        // Слушатель настроек системы
        const settingsRef = this.database.ref('settings');
        const settingsUnsubscribe = settingsRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                const settings = snapshot.val();
                this.notifyDataChange('settings_updated', settings);
                console.log('⚙️ Настройки системы обновлены:', settings);
            }
        });
        
        this.listeners.set('settings', settingsUnsubscribe);
        
        // Слушатель событий (для real-time обновлений)
        const eventsRef = this.database.ref('events');
        const eventsUnsubscribe = eventsRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                const events = snapshot.val();
                this.notifyDataChange('events_updated', events);
                console.log('📅 События обновлены в реальном времени');
            }
        });
        
        this.listeners.set('events', eventsUnsubscribe);
    }
    
    // ===== ОБРАБОТКА ОТКЛЮЧЕНИЯ =====
    setupDisconnectHandlers() {
        if (!this.userRef) return;
        
        try {
            // Установить статус "offline" при отключении
            const presenceRef = this.database.ref(`presence/${this.currentUser.username}`);
            presenceRef.onDisconnect().set({
                online: false,
                lastSeen: window.firebase.database.ServerValue.TIMESTAMP
            });
            
            // Установить статус "online" сейчас
            presenceRef.update({
                online: true,
                lastConnected: window.firebase.database.ServerValue.TIMESTAMP
            });
            
            console.log('🔌 Обработчики отключения настроены');
        } catch (error) {
            console.error('❌ Ошибка настройки обработчиков отключения:', error);
        }
    }
    
    // ===== УПРАВЛЕНИЕ ЛОКАЛЬНЫМ ХРАНИЛИЩЕМ =====
    updateLocalStorage() {
        try {
            if (this.currentUser) {
                const userData = {
                    ...this.currentUser,
                    lastSync: Date.now()
                };
                
                localStorage.setItem('currentUser', JSON.stringify(userData));
                localStorage.setItem('lastSyncTime', Date.now().toString());
                
                console.log('💾 Данные сохранены в localStorage');
            }
        } catch (error) {
            console.error('❌ Ошибка сохранения в localStorage:', error);
        }
    }
    
    getLocalUser() {
        try {
            const userData = localStorage.getItem('currentUser');
            const lastSync = localStorage.getItem('lastSyncTime');
            
            if (userData && lastSync) {
                const user = JSON.parse(userData);
                const syncTime = parseInt(lastSync);
                
                // Проверить, не устарели ли данные (2 минуты)
                if (Date.now() - syncTime < 120000) {
                    console.log('📱 Загружены актуальные данные из localStorage');
                    return user;
                }
            }
        } catch (error) {
            console.error('❌ Ошибка чтения localStorage:', error);
        }
        
        return null;
    }
    
    clearLocalData() {
        try {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('lastSyncTime');
            localStorage.removeItem('pendingUpdates');
            this.currentUser = null;
            console.log('🗑️ Локальные данные очищены');
        } catch (error) {
            console.error('❌ Ошибка очистки localStorage:', error);
        }
    }
    
    // ===== ПЕРИОДИЧЕСКАЯ СИНХРОНИЗАЦИЯ =====
    startPeriodicSync() {
        // Синхронизация каждые 15 секунд
        this.syncInterval = setInterval(() => {
            this.performPeriodicSync();
        }, 15000);
        
        console.log('⏰ Периодическая синхронизация запущена (каждые 15 сек)');
    }
    
    async performPeriodicSync() {
        if (!this.isOnline || this.syncInProgress) return;
        
        this.syncInProgress = true;
        
        try {
            // Синхронизировать отложенные обновления
            await this.syncPendingUpdates();
            
            // Проверить актуальность данных пользователя
            if (this.shouldRefreshUserData()) {
                await this.refreshUserData();
            }
            
            console.log('🔄 Периодическая синхронизация выполнена');
            
        } catch (error) {
            console.error('❌ Ошибка периодической синхронизации:', error);
        } finally {
            this.syncInProgress = false;
        }
    }
    
    shouldRefreshUserData() {
        if (!this.currentUser || !this.currentUser.lastSync) return true;
        
        // Обновлять данные если они старше 1 минуты
        return Date.now() - this.currentUser.lastSync > 60000;
    }
    
    async refreshUserData() {
        if (!this.userRef) return;
        
        try {
            const snapshot = await this.userRef.once('value');
            
            if (snapshot.exists()) {
                const firebaseData = snapshot.val();
                const oldUser = { ...this.currentUser };
                
                this.currentUser = {
                    username: this.currentUser.username,
                    ...firebaseData,
                    lastSync: Date.now()
                };
                
                this.updateLocalStorage();
                
                const changes = this.detectUserChanges(oldUser, this.currentUser);
                if (changes.length > 0) {
                    this.notifyDataChange('user_refreshed', {
                        user: this.currentUser,
                        changes: changes
                    });
                    
                    console.log('🔄 Данные пользователя обновлены при проверке:', changes);
                }
            }
        } catch (error) {
            console.error('❌ Ошибка обновления данных пользователя:', error);
        }
    }
    
    // ===== ОБНОВЛЕНИЕ ДАННЫХ =====
    async updateUserData(updates, skipLocalUpdate = false) {
        if (!this.userRef || !this.currentUser) {
            throw new Error('Пользователь не инициализирован');
        }
        
        try {
            console.log('📝 Обновление данных пользователя:', updates);
            
            const updateData = {
                ...updates,
                lastUpdated: window.firebase.database.ServerValue.TIMESTAMP
            };
            
            if (this.isOnline) {
                // Обновить в Firebase
                await this.userRef.update(updateData);
                console.log('✅ Данные обновлены в Firebase');
                
                // Обновить локальные данные только если это не пришло от слушателя
                if (!skipLocalUpdate) {
                    Object.assign(this.currentUser, updates);
                    this.updateLocalStorage();
                }
            } else {
                // Сохранить для отложенного обновления
                this.addPendingUpdate(updateData);
                console.log('📤 Обновление сохранено для отложенной отправки');
                
                // Обновить локальные данные немедленно для UI
                Object.assign(this.currentUser, updates);
                this.updateLocalStorage();
                
                this.notifyDataChange('user_updated_offline', {
                    user: this.currentUser,
                    updates: updates
                });
            }
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка обновления данных пользователя:', error);
            throw error;
        }
    }
    
    // ===== РАБОТА ОФЛАЙН =====
    addPendingUpdate(updateData) {
        const updateId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
        this.pendingUpdates.set(updateId, {
            data: updateData,
            timestamp: Date.now(),
            retries: 0,
            maxRetries: 3
        });
        
        this.savePendingUpdates();
        console.log(`📤 Добавлено отложенное обновление: ${updateId}`);
    }
    
    savePendingUpdates() {
        try {
            const updatesArray = Array.from(this.pendingUpdates.entries());
            localStorage.setItem('pendingUpdates', JSON.stringify(updatesArray));
        } catch (error) {
            console.error('❌ Ошибка сохранения отложенных обновлений:', error);
        }
    }
    
    loadPendingUpdates() {
        try {
            const saved = localStorage.getItem('pendingUpdates');
            if (saved) {
                const updatesArray = JSON.parse(saved);
                this.pendingUpdates = new Map(updatesArray);
                console.log(`📥 Загружено ${this.pendingUpdates.size} отложенных обновлений`);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки отложенных обновлений:', error);
            this.pendingUpdates = new Map();
        }
    }
    
    async syncPendingUpdates() {
        if (!this.isOnline || this.pendingUpdates.size === 0 || !this.userRef) return;
        
        console.log(`🔄 Синхронизация ${this.pendingUpdates.size} отложенных обновлений`);
        
        const updates = Array.from(this.pendingUpdates.entries());
        
        for (const [updateId, updateInfo] of updates) {
            try {
                await this.userRef.update(updateInfo.data);
                this.pendingUpdates.delete(updateId);
                console.log(`✅ Отложенное обновление ${updateId} синхронизировано`);
            } catch (error) {
                updateInfo.retries++;
                if (updateInfo.retries >= updateInfo.maxRetries) {
                    this.pendingUpdates.delete(updateId);
                    console.error(`❌ Отложенное обновление ${updateId} отклонено после ${updateInfo.maxRetries} попыток`);
                } else {
                    console.warn(`⚠️ Ошибка синхронизации ${updateId}, попытка ${updateInfo.retries}/${updateInfo.maxRetries}`);
                }
            }
        }
        
        this.savePendingUpdates();
        
        if (this.pendingUpdates.size === 0) {
            console.log('✅ Все отложенные обновления синхронизированы');
        }
    }
    
    // ===== ОБРАБОТКА СОБЫТИЙ =====
    setupEventListeners() {
        // Слушатель изменения сетевого статуса
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🌐 Соединение восстановлено');
            this.notifyDataChange('connection_restored', { online: true });
            
            // Синхронизировать отложенные обновления
            setTimeout(() => {
                this.syncPendingUpdates();
                this.refreshUserData();
            }, 1000);
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('📡 Соединение потеряно - переход в офлайн режим');
            this.notifyDataChange('connection_lost', { online: false });
        });
        
        // Слушатель закрытия страницы
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        // Слушатель изменения видимости страницы
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.currentUser && this.isOnline) {
                // Страница стала видимой - принудительная синхронизация
                setTimeout(() => {
                    this.refreshUserData();
                }, 500);
            }
        });
        
        // Слушатель изменения фокуса окна
        window.addEventListener('focus', () => {
            if (this.currentUser && this.isOnline) {
                setTimeout(() => {
                    this.refreshUserData();
                }, 500);
            }
        });
    }
    
    // ===== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ =====
    detectUserChanges(oldData, newData) {
        const changes = [];
        const importantFields = ['balance', 'betLimit', 'role', 'status'];
        
        importantFields.forEach(field => {
            if (oldData[field] !== newData[field]) {
                changes.push({
                    field: field,
                    oldValue: oldData[field],
                    newValue: newData[field],
                    timestamp: Date.now()
                });
            }
        });
        
        return changes;
    }
    
    handleUserChangeNotifications(changes) {
        changes.forEach(change => {
            switch (change.field) {
                case 'balance':
                    const diff = change.newValue - change.oldValue;
                    if (diff !== 0) {
                        this.showBalanceNotification(diff);
                    }
                    break;
                    
                case 'role':
                    this.showNotification(`Ваша роль изменена на: ${this.getRoleName(change.newValue)}`, 'info');
                    break;
                    
                case 'status':
                    if (change.newValue === 'inactive') {
                        this.showNotification('Ваш аккаунт был заблокирован', 'error');
                    } else if (change.newValue === 'active') {
                        this.showNotification('Ваш аккаунт разблокирован', 'success');
                    }
                    break;
                    
                case 'betLimit':
                    this.showNotification(`Лимит ставки изменен на: ${change.newValue} лупанчиков`, 'info');
                    break;
            }
        });
    }
    
    showBalanceNotification(diff) {
        const message = diff > 0 
            ? `💰 Ваш баланс увеличился на ${diff} лупанчиков!`
            : `📉 Ваш баланс уменьшился на ${Math.abs(diff)} лупанчиков`;
            
        this.showNotification(message, diff > 0 ? 'success' : 'warning');
    }
    
    showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`📢 Уведомление (${type}): ${message}`);
        }
    }
    
    getRoleName(role) {
        const roles = {
            'admin': 'Администратор',
            'moderator': 'Модератор',
            'user': 'Пользователь'
        };
        return roles[role] || role;
    }
    
    notifyDataChange(type, data) {
        try {
            const event = new CustomEvent('dataSync', {
                detail: { type, data, timestamp: Date.now() }
            });
            window.dispatchEvent(event);
            console.log(`📡 Событие отправлено: ${type}`);
        } catch (error) {
            console.error('❌ Ошибка отправки события:', error);
        }
    }
    
    // ===== ОЧИСТКА =====
    cleanup() {
        console.log('🧹 Начало очистки DataSyncManager...');
        
        // Остановить все слушатели
        this.listeners.forEach((unsubscribe, key) => {
            try {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            } catch (error) {
                console.error(`❌ Ошибка отключения слушателя ${key}:`, error);
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
            try {
                this.userRef.off();
            } catch (error) {
                console.error('❌ Ошибка отключения userRef:', error);
            }
            this.userRef = null;
        }
        
        // Сохранить отложенные обновления перед очисткой
        this.savePendingUpdates();
        
        console.log('✅ Очистка DataSyncManager завершена');
    }
    
    // ===== ПУБЛИЧНЫЕ МЕТОДЫ =====
    getCurrentUser() {
        return this.currentUser;
    }
    
    async forceRefresh() {
        return await this.refreshUserData();
    }
    
    isUserOnline() {
        return this.isOnline;
    }
    
    getPendingUpdatesCount() {
        return this.pendingUpdates.size;
    }
    
    getSyncStatus() {
        return {
            online: this.isOnline,
            lastSync: this.currentUser?.lastSync || 0,
            pendingUpdates: this.pendingUpdates.size,
            syncInProgress: this.syncInProgress
        };
    }
}

// ===== ГЛОБАЛЬНЫЙ ЭКЗЕМПЛЯР =====
let dataSyncManager = null;

// Инициализировать при загрузке
window.addEventListener('DOMContentLoaded', () => {
    if (!dataSyncManager) {
        dataSyncManager = new DataSyncManager();
        window.dataSyncManager = dataSyncManager;
        console.log('🚀 DataSyncManager создан и готов к работе');
    }
});


