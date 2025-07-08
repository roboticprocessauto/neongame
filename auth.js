// ===== ИСПРАВЛЕННЫЙ auth.js С КОРРЕКТНЫМИ ИМПОРТАМИ =====

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let currentUser = null;
let database = null;
let dbRef = null;
let dbSet = null;
let dbGet = null;
let dbUpdate = null;

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Загрузка auth.js...');
    
    try {
        // Инициализация Firebase
        await initializeFirebase();
        
        // Ждем инициализации DataSyncManager
        await waitForSyncManager();
        
        // Проверка существующей авторизации
        await checkExistingAuth();
        
        // Настройка обработчиков событий
        setupEventHandlers();
        
        console.log('✅ auth.js загружен успешно');
    } catch (error) {
        console.error('❌ Ошибка инициализации auth.js:', error);
        showNotification('Ошибка инициализации системы: ' + error.message, 'error');
    }
});

// ===== ОЖИДАНИЕ SYNC MANAGER =====
async function waitForSyncManager() {
    let attempts = 0;
    const maxAttempts = 50; // 5 секунд
    
    while (!window.dataSyncManager && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (!window.dataSyncManager) {
        console.warn('⚠️ DataSyncManager не найден, будет работать без синхронизации');
        return false;
    }
    
    console.log('✅ DataSyncManager готов для auth.js');
    return true;
}

// ===== ИНИЦИАЛИЗАЦИЯ FIREBASE =====
async function initializeFirebase() {
    try {
        if (!window.firebaseConfig) {
            throw new Error('Firebase конфигурация не найдена');
        }

        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const { 
            getDatabase, 
            ref, 
            set, 
            get, 
            update
        } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');

        const app = initializeApp(window.firebaseConfig);
        database = getDatabase(app);
        
        // Присваиваем функции к глобальным переменным для использования
        dbRef = ref;
        dbSet = set;
        dbGet = get;
        dbUpdate = update;
        
        console.log('🔥 Firebase инициализирован для auth.js');
    } catch (error) {
        console.error('🔥 Ошибка инициализации Firebase:', error);
        throw error;
    }
}

// ===== ПРОВЕРКА СУЩЕСТВУЮЩЕЙ АВТОРИЗАЦИИ =====
async function checkExistingAuth() {
    try {
        console.log('🔐 Проверка существующей авторизации...');
        
        let savedUser = null;
        
        // Сначала проверяем DataSyncManager
        if (window.dataSyncManager) {
            savedUser = window.dataSyncManager.getLocalUser();
            console.log('📱 Данные из DataSyncManager:', !!savedUser);
        }
        
        // Если не найдено, проверяем localStorage
        if (!savedUser) {
            const localData = localStorage.getItem('currentUser');
            if (localData) {
                try {
                    savedUser = JSON.parse(localData);
                    console.log('💾 Данные из localStorage:', !!savedUser);
                } catch (e) {
                    console.error('❌ Ошибка парсинга localStorage:', e);
                }
            }
        }
        
        if (!savedUser) {
            console.log('❌ Нет сохраненных данных пользователя');
            return;
        }
        
        console.log(`👤 Найден сохраненный пользователь: ${savedUser.username}`);
        
        // Проверить актуальность данных в Firebase
        const userRef = dbRef(database, `users/${savedUser.username}`);
        const snapshot = await dbGet(userRef);
        
        if (!snapshot.exists()) {
            console.log('❌ Пользователь не найден в базе данных');
            clearUserData();
            return;
        }
        
        const firebaseData = snapshot.val();
        
        // Проверить, что данные актуальны и аккаунт активен
        if (firebaseData.status === 'active') {
            console.log('✅ Данные пользователя актуальны');
            
            // Показать индикатор загрузки
            showLoadingState();
            
            // Инициализировать синхронизацию если доступна
            if (window.dataSyncManager) {
                try {
                    await window.dataSyncManager.initializeUser(savedUser.username);
                    console.log('🔄 Синхронизация инициализирована');
                } catch (syncError) {
                    console.error('❌ Ошибка инициализации синхронизации:', syncError);
                    // Продолжаем без синхронизации
                }
            }
            
            // Небольшая задержка для завершения инициализации
            setTimeout(() => {
                console.log('➡️ Перенаправление на main.html');
                window.location.href = 'main.html';
            }, 1500);
            
        } else {
            console.log('⚠️ Аккаунт заблокирован или неактивен');
            clearUserData();
            showNotification('Ваш аккаунт заблокирован', 'error');
        }
            
    } catch (error) {
        console.error('❌ Ошибка проверки авторизации:', error);
        clearUserData();
        showNotification('Ошибка проверки авторизации: ' + error.message, 'error');
    }
}

// ===== ИНДИКАТОР ЗАГРУЗКИ =====
function showLoadingState() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.classList.remove('active');
    
    // Создать индикатор загрузки
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-state';
    loadingDiv.style.cssText = `
        text-align: center;
        padding: 40px 20px;
        color: #4fc3f7;
    `;
    loadingDiv.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 20px;">🔄</div>
        <h3 style="color: #4fc3f7; margin-bottom: 10px;">Инициализация...</h3>
        <p style="color: #b0bec5; margin-bottom: 20px;">Синхронизация данных и подготовка интерфейса</p>
        <div style="display: flex; justify-content: center; gap: 5px;">
            <div style="width: 8px; height: 8px; background: #4fc3f7; border-radius: 50%; animation: pulse 1.4s infinite ease-in-out;"></div>
            <div style="width: 8px; height: 8px; background: #4fc3f7; border-radius: 50%; animation: pulse 1.4s infinite ease-in-out 0.2s;"></div>
            <div style="width: 8px; height: 8px; background: #4fc3f7; border-radius: 50%; animation: pulse 1.4s infinite ease-in-out 0.4s;"></div>
        </div>
    `;
    
    const container = document.querySelector('.login-container');
    if (container) {
        container.appendChild(loadingDiv);
    }
}

// ===== ОЧИСТКА ДАННЫХ ПОЛЬЗОВАТЕЛЯ =====
function clearUserData() {
    try {
        // Очистить localStorage
        localStorage.removeItem('currentUser');
        localStorage.removeItem('lastSyncTime');
        localStorage.removeItem('pendingUpdates');
        
        // Очистить DataSyncManager если доступен
        if (window.dataSyncManager) {
            window.dataSyncManager.cleanup();
            window.dataSyncManager.clearLocalData();
        }
        
        currentUser = null;
        console.log('🗑️ Данные пользователя очищены');
    } catch (error) {
        console.error('❌ Ошибка очистки данных пользователя:', error);
    }
}

// ===== НАСТРОЙКА ОБРАБОТЧИКОВ СОБЫТИЙ =====
function setupEventHandlers() {
    // Обработчик Enter для полей ввода
    document.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            const activeElement = document.activeElement;
            
            if (activeElement && activeElement.id === 'loginPassword') {
                attemptLogin();
            } else if (activeElement && activeElement.id === 'registerConfirmPassword') {
                attemptRegister();
            }
        }
    });
    
    // Обработчик потери соединения
    window.addEventListener('offline', () => {
        showNotification('Соединение потеряно. Некоторые функции могут быть недоступны.', 'warning');
    });
    
    window.addEventListener('online', () => {
        showNotification('Соединение восстановлено!', 'success');
    });
    
    console.log('⌨️ Обработчики событий настроены');
}

// ===== УПРАВЛЕНИЕ ФОРМАМИ =====
function showRegisterForm() {
    console.log('📝 Показ формы регистрации');
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').classList.add('active');
}

function showLoginForm() {
    console.log('🔑 Показ формы входа');
    document.getElementById('register-form').classList.remove('active');
    document.getElementById('login-form').style.display = 'block';
}

// ===== АУТЕНТИФИКАЦИЯ =====
async function attemptLogin() {
    console.log('🔑 Попытка входа...');
    
    const username = document.getElementById('loginUsername')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value?.trim();
    
    if (!username || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    // Показать загрузку
    const loginBtn = document.querySelector('#login-form .btn');
    const originalText = loginBtn.textContent;
    loginBtn.textContent = 'Вход...';
    loginBtn.disabled = true;
    
    try {
        console.log(`👤 Попытка входа для пользователя: ${username}`);
        
        // Убедимся что Firebase инициализирован
        if (!database || !dbRef || !dbGet) {
            throw new Error('Firebase не инициализирован');
        }
        
        const userRef = dbRef(database, `users/${username}`);
        const snapshot = await dbGet(userRef);
        
        if (!snapshot.exists()) {
            console.log(`❌ Пользователь ${username} не найден`);
            showNotification('Пользователь не найден', 'error');
            return;
        }
        
        const userData = snapshot.val();
        console.log(`📋 Данные пользователя ${username}:`, { role: userData.role, status: userData.status });
        
        if (userData.password !== password) {
            console.log(`❌ Неверный пароль для пользователя ${username}`);
            showNotification('Неверный пароль', 'error');
            return;
        }
        
        if (userData.status === 'inactive') {
            console.log(`🚫 Аккаунт ${username} заблокирован`);
            showNotification('Ваш аккаунт заблокирован', 'error');
            return;
        }
        
        // Успешная авторизация
        currentUser = {
            username: username,
            ...userData
        };
        
        console.log(`✅ Успешный вход пользователя ${username}`);
        showNotification('Вход выполнен успешно!', 'success');
        
        // Сохранить в localStorage для быстрого доступа
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Показать состояние загрузки
        showLoadingState();
        
        // Инициализировать синхронизацию данных если доступна
        if (window.dataSyncManager) {
            try {
                await window.dataSyncManager.initializeUser(username);
                console.log('🔄 Синхронизация инициализирована при входе');
            } catch (syncError) {
                console.error('❌ Ошибка инициализации синхронизации при входе:', syncError);
                // Продолжаем без синхронизации
            }
        }
        
        // Перенаправление с задержкой для завершения синхронизации
        setTimeout(() => {
            window.location.href = 'main.html';
        }, 2000);
        
    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        showNotification('Ошибка подключения к серверу: ' + error.message, 'error');
    } finally {
        // Восстановить кнопку
        loginBtn.textContent = originalText;
        loginBtn.disabled = false;
    }
}

async function attemptRegister() {
    console.log('📝 Попытка регистрации...');
    
    const username = document.getElementById('registerUsername')?.value?.trim();
    const password = document.getElementById('registerPassword')?.value?.trim();
    const confirmPassword = document.getElementById('registerConfirmPassword')?.value?.trim();
    
    if (!username || !password || !confirmPassword) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (username.length < 3) {
        showNotification('Логин должен содержать минимум 3 символа', 'error');
        return;
    }
    
    if (password.length < 4) {
        showNotification('Пароль должен содержать минимум 4 символа', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }
    
    // Показать загрузку
    const registerBtn = document.querySelector('#register-form .btn');
    const originalText = registerBtn.textContent;
    registerBtn.textContent = 'Регистрация...';
    registerBtn.disabled = true;
    
    try {
        console.log(`📝 Попытка регистрации пользователя: ${username}`);
        
        // Убедимся что Firebase инициализирован
        if (!database || !dbRef || !dbGet || !dbSet) {
            throw new Error('Firebase не инициализирован');
        }
        
        const userRef = dbRef(database, `users/${username}`);
        const snapshot = await dbGet(userRef);
        
        if (snapshot.exists()) {
            console.log(`❌ Пользователь ${username} уже существует`);
            showNotification('Пользователь с таким логином уже существует', 'error');
            return;
        }
        
        const newUser = {
            password: password,
            role: 'user',
            balance: 5000,
            betLimit: 1000,
            registeredAt: Date.now(),
            status: 'active',
            lastUpdated: Date.now()
        };
        
        await dbSet(userRef, newUser);
        console.log(`✅ Пользователь ${username} зарегистрирован`);
        
        showNotification('Регистрация прошла успешно! Теперь войдите в систему.', 'success');
        
        // Очистить форму
        document.getElementById('registerUsername').value = '';
        document.getElementById('registerPassword').value = '';
        document.getElementById('registerConfirmPassword').value = '';
        
        setTimeout(() => {
            showLoginForm();
        }, 2000);
        
    } catch (error) {
        console.error('❌ Ошибка регистрации:', error);
        showNotification('Ошибка подключения к серверу: ' + error.message, 'error');
    } finally {
        // Восстановить кнопку
        registerBtn.textContent = originalText;
        registerBtn.disabled = false;
    }
}

// ===== УВЕДОМЛЕНИЯ =====
function showNotification(message, type = 'error') {
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
        font-size: 14px;
        line-height: 1.4;
    `;
    
    // Цвета по типам
    const colors = {
        success: '#4caf50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196f3'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    
    // Добавляем кнопку закрытия
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
        position: absolute;
        top: 5px;
        right: 10px;
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
        transition: opacity 0.2s;
    `;
    closeButton.onmouseenter = () => closeButton.style.opacity = '1';
    closeButton.onmouseleave = () => closeButton.style.opacity = '0.7';
    closeButton.onclick = () => notification.remove();
    
    notification.style.paddingRight = '40px';
    notification.appendChild(closeButton);
    
    document.body.appendChild(notification);
    
    // Автоудаление через 5 секунд
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// ===== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ОТЛАДКИ =====
async function testFirebaseConnection() {
    try {
        console.log('🧪 Тестирование подключения к Firebase...');
        
        if (!database || !dbRef || !dbSet) {
            throw new Error('Firebase не инициализирован');
        }
        
        const testRef = dbRef(database, 'test');
        await dbSet(testRef, { timestamp: Date.now(), test: true });
        console.log('✅ Firebase подключение работает');
        showNotification('Firebase подключение работает!', 'success');
    } catch (error) {
        console.error('❌ Ошибка подключения к Firebase:', error);
        showNotification('Ошибка подключения к Firebase: ' + error.message, 'error');
    }
}

function showDemoAccounts() {
    const demoAccounts = [
        { username: 'admin', password: 'admin123', role: 'Администратор' },
        { username: 'user1', password: 'user123', role: 'Пользователь' },
        { username: 'moderator1', password: 'mod123', role: 'Модератор' }
    ];
    
    console.log('👥 Демо аккаунты:');
    demoAccounts.forEach(account => {
        console.log(`   ${account.role}: ${account.username} / ${account.password}`);
    });
    
    // Показать в интерфейсе если нужно
    showNotification('Демо аккаунты выведены в консоль (F12)', 'info');
}

// ===== ОБРАБОТКА КРИТИЧЕСКИХ ОШИБОК =====
window.addEventListener('error', function(event) {
    console.error('🚨 Критическая ошибка JavaScript:', event.error);
    
    // Очистить данные при критической ошибке связанной с Firebase или сетью
    if (event.error.message.includes('Firebase') || 
        event.error.message.includes('network') ||
        event.error.message.includes('fetch')) {
        clearUserData();
        showNotification('Произошла критическая ошибка. Данные очищены.', 'error');
    }
});

// ===== ЭКСПОРТ ФУНКЦИЙ В ГЛОБАЛЬНУЮ ОБЛАСТЬ =====
window.showRegisterForm = showRegisterForm;
window.showLoginForm = showLoginForm;
window.attemptLogin = attemptLogin;
window.attemptRegister = attemptRegister;
window.testFirebaseConnection = testFirebaseConnection;
window.showDemoAccounts = showDemoAccounts;

// ===== АВТОМАТИЧЕСКИЙ ПОКАЗ ДЕМО АККАУНТОВ =====
setTimeout(() => {
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' || 
        window.location.search.includes('demo')) {
        showDemoAccounts();
    }
}, 2000);
