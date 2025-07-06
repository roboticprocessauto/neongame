// ===== ИНИЦИАЛИЗАЦИЯ FIREBASE =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getDatabase, 
    ref as dbRef, 
    set as dbSet, 
    get as dbGet, 
    update as dbUpdate
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const app = initializeApp(window.firebaseConfig);
const database = getDatabase(app);

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let currentUser = null;

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.addEventListener('DOMContentLoaded', function() {
    checkExistingAuth();
    createDemoUsers();
    
    // Обработчики Enter
    document.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            if (document.getElementById('login-form').style.display !== 'none') {
                attemptLogin();
            } else {
                attemptRegister();
            }
        }
    });
});

function checkExistingAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        // Пользователь уже авторизован
        window.location.href = 'main.html';
    }
}

// ===== СОЗДАНИЕ ДЕМО ПОЛЬЗОВАТЕЛЕЙ =====
async function createDemoUsers() {
    try {
        const usersRef = dbRef(database, 'users');
        const snapshot = await dbGet(usersRef);
        
        if (!snapshot.exists()) {
            // Создать демо пользователей
            const demoUsers = {
                'admin': {
                    password: 'admin123',
                    role: 'admin',
                    balance: 50000,
                    betLimit: 10000,
                    registeredAt: Date.now(),
                    status: 'active'
                },
                'user1': {
                    password: 'user123',
                    role: 'user',
                    balance: 5000,
                    betLimit: 1000,
                    registeredAt: Date.now(),
                    status: 'active'
                },
                'moderator1': {
                    password: 'mod123',
                    role: 'moderator',
                    balance: 15000,
                    betLimit: 5000,
                    registeredAt: Date.now(),
                    status: 'active'
                }
            };
            
            await dbSet(usersRef, demoUsers);
            console.log('Демо пользователи созданы');
        }
    } catch (error) {
        console.error('Ошибка создания демо пользователей:', error);
    }
}

// ===== УПРАВЛЕНИЕ ФОРМАМИ =====
window.showRegisterForm = function() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').classList.add('active');
};

window.showLoginForm = function() {
    document.getElementById('register-form').classList.remove('active');
    document.getElementById('login-form').style.display = 'block';
};

// ===== АУТЕНТИФИКАЦИЯ =====
window.attemptLogin = async function() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    
    if (!username || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    try {
        const userRef = dbRef(database, `users/${username}`);
        const snapshot = await dbGet(userRef);
        
        if (!snapshot.exists()) {
            showNotification('Пользователь не найден', 'error');
            return;
        }
        
        const userData = snapshot.val();
        
        if (userData.password !== password) {
            showNotification('Неверный пароль', 'error');
            return;
        }
        
        if (userData.status === 'inactive') {
            showNotification('Ваш аккаунт заблокирован', 'error');
            return;
        }
        
        const currentUser = {
            username: username,
            ...userData
        };
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        showNotification('Вход выполнен успешно!', 'success');
        
        setTimeout(() => {
            window.location.href = 'main.html';
        }, 1000);
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        showNotification('Ошибка подключения к серверу', 'error');
    }
};

window.attemptRegister = async function() {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();
    
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
        const userRef = dbRef(database, `users/${username}`);
        const snapshot = await dbGet(userRef);
        
        if (snapshot.exists()) {
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
        
        showNotification('Регистрация прошла успешно! Теперь войдите в систему.', 'success');
        
        // Очистить форму
        document.getElementById('registerUsername').value = '';
        document.getElementById('registerPassword').value = '';
        document.getElementById('registerConfirmPassword').value = '';
        
        setTimeout(() => {
            showLoginForm();
        }, 2000);
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        showNotification('Ошибка подключения к серверу', 'error');
    }
};

// ===== УВЕДОМЛЕНИЯ =====
function showNotification(message, type = 'error') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
