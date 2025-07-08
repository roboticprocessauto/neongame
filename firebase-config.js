// ===== FIREBASE CONFIGURATION =====

// Firebase конфигурация
window.firebaseConfig = {
    apiKey: "AIzaSyDH8ZOW4fU5KfUGv-QeR8A1HGl-VJRlZJE",
    authDomain: "maxbet-demo.firebaseapp.com",
    databaseURL: "https://maxbet-demo-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "maxbet-demo",
    storageBucket: "maxbet-demo.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456789012345678"
};

// Проверка конфигурации
if (window.firebaseConfig) {
    console.log('🔧 Firebase конфигурация загружена');
} else {
    console.error('❌ Ошибка загрузки Firebase конфигурации');
}

// Дополнительные настройки для разработки
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    console.log('🛠️ Режим разработки активен');
    
    // Можно добавить дополнительные настройки для локальной разработки
    window.isDevelopment = true;
}

// Экспорт для ES6 модулей (если нужен)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.firebaseConfig;
}
