// ===== FIREBASE CONFIGURATION =====

// Firebase Configuration
// Это клиентская конфигурация - эти данные не секретные и предназначены для публичного использования
window.firebaseConfig = {
    apiKey: "AIzaSyA7a22ZA0sjtPKof0GmwcAnNmHZ4s7d7U4",
    authDomain: "checker-7f7b7.firebaseapp.com",
    databaseURL: "https://checker-7f7b7-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "checker-7f7b7",
    storageBucket: "checker-7f7b7.firebasestorage.app",
    messagingSenderId: "55724792345",
    appId: "1:55724792345:web:5df424f16e495d8f38a888",
    measurementId: "G-2F94LPCYYM"
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
