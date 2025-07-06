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

// Проверяем, что конфигурация загружена
console.log('🔥 Firebase config загружен:', !!window.firebaseConfig);

// Добавляем глобальную проверку доступности Firebase
window.checkFirebaseConfig = function() {
    if (!window.firebaseConfig) {
        console.error('❌ Firebase конфигурация не найдена!');
        return false;
    }
    
    const requiredFields = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
    const missingFields = requiredFields.filter(field => !window.firebaseConfig[field]);
    
    if (missingFields.length > 0) {
        console.error('❌ Отсутствуют поля Firebase конфигурации:', missingFields);
        return false;
    }
    
    console.log('✅ Firebase конфигурация корректна');
    return true;
};
