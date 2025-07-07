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
        
        // Проверка существующей авторизации
        checkExistingAuth();
        
        
        // Настройка обработчиков событий
        setupEventHandlers();
        
        console.log('✅ auth.js загружен успешно');
    } catch (error) {
        console.error('❌ Ошибка инициализации auth.js:', error);
        showNotification('Ошибка инициализации системы', 'error');
    }
});

// ===== ИНИЦИАЛИЗАЦИЯ FIREBASE =====
async function initializeFirebase() {
    try {
        // Проверяем, что firebaseConfig доступен
        if (!window.firebaseConfig) {
            throw new Error('Firebase конфигурация не найдена');
        }

        // Импортируем Firebase модули
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const { 
            getDatabase, 
            ref, 
            set, 
            get, 
            update
        } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');

        // Инициализируем Firebase
        const app = initializeApp(window.firebaseConfig);
        database = getDatabase(app);
        
        // Сохраняем функции для использования
        dbRef = ref;
        dbSet = set;
        dbGet = get;
        dbUpdate = update;
        
        console.log('🔥 Firebase инициализирован');
    } catch (error) {
        console.error('🔥 Ошибка инициализации Firebase:', error);
        throw error;
    }
}

function checkExistingAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        console.log('👤 Найден сохраненный пользователь, перенаправление...');
        window.location.href = 'main.html';
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
    
    try {
        console.log(`👤 Попытка входа для пользователя: ${username}`);
        
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
        
        const currentUser = {
            username: username,
            ...userData
        };
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        console.log(`✅ Успешный вход пользователя ${username}`);
        
        showNotification('Вход выполнен успешно!', 'success');
        
        setTimeout(() => {
            window.location.href = 'main.html';
        }, 1000);
        
    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        showNotification('Ошибка подключения к серверу: ' + error.message, 'error');
    }
};

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
    
    try {
        console.log(`📝 Попытка регистрации пользователя: ${username}`);
        
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
            status: 'active'
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
    }
};

// ===== УВЕДОМЛЕНИЯ =====
function showNotification(message, type = 'error') {
    console.log(`📢 Уведомление (${type}): ${message}`);
    
    // Удаляем предыдущие уведомления
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
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
    `;
    closeButton.onclick = () => notification.remove();
    
    notification.style.position = 'relative';
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
        const testRef = dbRef(database, 'test');
        await dbSet(testRef, { timestamp: Date.now(), test: true });
        console.log('✅ Firebase подключение работает');
        showNotification('Firebase подключение работает!', 'success');
    } catch (error) {
        console.error('❌ Ошибка подключения к Firebase:', error);
        showNotification('Ошибка подключения к Firebase: ' + error.message, 'error');
    }
};

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
};

// Экспортируем функции в глобальную область видимости
window.showRegisterForm = showRegisterForm;
window.showLoginForm = showLoginForm;
window.attemptLogin = attemptLogin;
window.attemptRegister = attemptRegister;
window.testFirebaseConnection = testFirebaseConnection;
window.showDemoAccounts = showDemoAccounts;

// Вызываем показ демо аккаунтов при загрузке для удобства
setTimeout(() => {
    showDemoAccounts();
}, 1000);
