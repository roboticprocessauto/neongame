// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let currentUser = null;
let dataSyncManager = null;
let currentGame = 'blackjack';
let blackjackGame = null;
let rouletteBetType = null;
let rouletteBetNumber = null;

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🎮 Инициализация страницы мини-игр...');
    
    // Проверяем авторизацию
    const user = localStorage.getItem('currentUser');
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(user);
        console.log('👤 Пользователь загружен:', currentUser.username);
        
        // Инициализируем Firebase и DataSyncManager
        await initializeFirebase();
        await initializeDataSyncManager();
        
        // Обновляем UI
        updateUserInfo();
        
        // Показываем первую игру
        showGame('blackjack');
        
        console.log('✅ Страница мини-игр инициализирована');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
});

// ===== ИНИЦИАЛИЗАЦИЯ FIREBASE =====
async function initializeFirebase() {
    if (typeof firebase === 'undefined') {
        throw new Error('Firebase не загружен');
    }
    
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    console.log('🔥 Firebase инициализирован');
}

// ===== ИНИЦИАЛИЗАЦИЯ DATA SYNC MANAGER =====
async function initializeDataSyncManager() {
    if (typeof DataSyncManager === 'undefined') {
        throw new Error('DataSyncManager не загружен');
    }
    
    dataSyncManager = new DataSyncManager();
    await dataSyncManager.initialize();
    
    // Слушаем обновления пользователя
    dataSyncManager.on('user_updated', (user) => {
        currentUser = user;
        updateUserInfo();
    });
    
    console.log('🔄 DataSyncManager инициализирован');
}

// ===== ОБНОВЛЕНИЕ UI =====
function updateUserInfo() {
    if (!currentUser) return;
    
    document.getElementById('username').textContent = currentUser.username;
    document.getElementById('user-balance').textContent = `${currentUser.balance || 0} лупанчиков`;
    
    // Показываем админ/модератор ссылки
    if (currentUser.role === 'admin') {
        document.getElementById('admin-link').style.display = 'inline-block';
    }
    if (currentUser.role === 'moderator' || currentUser.role === 'admin') {
        document.getElementById('moderator-link').style.display = 'inline-block';
    }
}

// ===== ПЕРЕКЛЮЧЕНИЕ ИГР =====
function showGame(gameType) {
    // Скрываем все игры
    document.querySelectorAll('.game-container').forEach(container => {
        container.classList.remove('active');
    });
    
    // Убираем активность со всех вкладок
    document.querySelectorAll('.game-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Показываем выбранную игру
    document.getElementById(`${gameType}-game`).classList.add('active');
    
    // Активируем соответствующую вкладку
    event.target.classList.add('active');
    
    currentGame = gameType;
    
    // Сбрасываем состояние игры
    resetGameState();
}

// ===== СБРОС СОСТОЯНИЯ ИГРЫ =====
function resetGameState() {
    // Сброс 21 очка
    if (blackjackGame) {
        blackjackGame = null;
        document.getElementById('player-cards').innerHTML = '';
        document.getElementById('dealer-cards').innerHTML = '';
        document.getElementById('player-score').textContent = 'Очки: 0';
        document.getElementById('dealer-score').textContent = 'Очки: 0';
        document.getElementById('blackjack-actions').style.display = 'none';
        document.getElementById('blackjack-result').innerHTML = '';
    }
    
    // Сброс костей
    document.getElementById('dice-result').textContent = '?';
    document.getElementById('dice-result-text').innerHTML = '';
    
    // Сброс рулетки
    document.getElementById('roulette-result').textContent = '?';
    document.getElementById('roulette-result-text').innerHTML = '';
    rouletteBetType = null;
    rouletteBetNumber = null;
    document.getElementById('selected-bet').textContent = 'Выберите тип ставки';
    document.getElementById('spin-btn').disabled = true;
    
    // Сброс выбранных ставок в рулетке
    document.querySelectorAll('.bet-type-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
}

// ===== ИГРА 21 ОЧКО =====
class BlackjackGame {
    constructor(bet) {
        this.bet = bet;
        this.deck = this.createDeck();
        this.playerCards = [];
        this.dealerCards = [];
        this.gameOver = false;
    }
    
    createDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const deck = [];
        
        for (let suit of suits) {
            for (let value of values) {
                deck.push({ suit, value });
            }
        }
        
        // Перемешиваем колоду
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        
        return deck;
    }
    
    dealCard() {
        return this.deck.pop();
    }
    
    calculateScore(cards) {
        let score = 0;
        let aces = 0;
        
        for (let card of cards) {
            if (card.value === 'A') {
                aces++;
                score += 11;
            } else if (['K', 'Q', 'J'].includes(card.value)) {
                score += 10;
            } else {
                score += parseInt(card.value);
            }
        }
        
        // Корректируем тузы
        while (score > 21 && aces > 0) {
            score -= 10;
            aces--;
        }
        
        return score;
    }
    
    start() {
        // Раздаем начальные карты
        this.playerCards.push(this.dealCard());
        this.dealerCards.push(this.dealCard());
        this.playerCards.push(this.dealCard());
        this.dealerCards.push(this.dealCard());
        
        this.updateDisplay();
    }
    
    hit() {
        if (this.gameOver) return;
        
        this.playerCards.push(this.dealCard());
        const playerScore = this.calculateScore(this.playerCards);
        
        if (playerScore > 21) {
            this.endGame('bust');
        }
        
        this.updateDisplay();
    }
    
    stand() {
        if (this.gameOver) return;
        
        this.gameOver = true;
        
        // Дилер берет карты
        while (this.calculateScore(this.dealerCards) < 17) {
            this.dealerCards.push(this.dealCard());
        }
        
        this.determineWinner();
    }
    
    determineWinner() {
        const playerScore = this.calculateScore(this.playerCards);
        const dealerScore = this.calculateScore(this.dealerCards);
        
        let result;
        if (playerScore > 21) {
            result = 'bust';
        } else if (dealerScore > 21) {
            result = 'win';
        } else if (playerScore > dealerScore) {
            result = 'win';
        } else if (playerScore < dealerScore) {
            result = 'lose';
        } else {
            result = 'draw';
        }
        
        this.endGame(result);
    }
    
    endGame(result) {
        this.gameOver = true;
        
        // Показываем все карты дилера
        this.updateDisplay(true);
        
        // Определяем результат
        let message, isWin;
        switch (result) {
            case 'win':
                message = `Победа! Вы выиграли ${this.bet * 2} лупанчиков!`;
                isWin = true;
                this.updateBalance(this.bet * 2);
                break;
            case 'lose':
                message = `Поражение! Вы проиграли ${this.bet} лупанчиков.`;
                isWin = false;
                this.updateBalance(-this.bet);
                break;
            case 'bust':
                message = `Перебор! Вы проиграли ${this.bet} лупанчиков.`;
                isWin = false;
                this.updateBalance(-this.bet);
                break;
            case 'draw':
                message = `Ничья! Ваша ставка возвращена.`;
                isWin = false;
                break;
        }
        
        // Показываем результат
        const resultElement = document.getElementById('blackjack-result');
        resultElement.textContent = message;
        resultElement.className = `game-result ${isWin ? 'win' : 'lose'}`;
        
        // Скрываем кнопки действий
        document.getElementById('blackjack-actions').style.display = 'none';
        
        // Добавляем кнопку новой игры
        setTimeout(() => {
            const newGameBtn = document.createElement('button');
            newGameBtn.className = 'btn';
            newGameBtn.textContent = 'Новая игра';
            newGameBtn.onclick = () => {
                resetGameState();
                document.getElementById('blackjack-actions').style.display = 'none';
            };
            resultElement.appendChild(document.createElement('br'));
            resultElement.appendChild(newGameBtn);
        }, 1000);
    }
    
    updateDisplay(showAllDealerCards = false) {
        // Показываем карты игрока
        const playerCardsContainer = document.getElementById('player-cards');
        playerCardsContainer.innerHTML = '';
        
        for (let card of this.playerCards) {
            const cardElement = document.createElement('div');
            cardElement.className = `card ${['♥', '♦'].includes(card.suit) ? 'red' : ''}`;
            cardElement.textContent = `${card.value}${card.suit}`;
            playerCardsContainer.appendChild(cardElement);
        }
        
        // Показываем карты дилера
        const dealerCardsContainer = document.getElementById('dealer-cards');
        dealerCardsContainer.innerHTML = '';
        
        for (let i = 0; i < this.dealerCards.length; i++) {
            const card = this.dealerCards[i];
            const cardElement = document.createElement('div');
            cardElement.className = `card ${['♥', '♦'].includes(card.suit) ? 'red' : ''}`;
            
            if (i === 1 && !showAllDealerCards && !this.gameOver) {
                cardElement.textContent = '?';
                cardElement.style.background = '#333';
                cardElement.style.color = '#fff';
            } else {
                cardElement.textContent = `${card.value}${card.suit}`;
            }
            
            dealerCardsContainer.appendChild(cardElement);
        }
        
        // Обновляем счет
        document.getElementById('player-score').textContent = `Очки: ${this.calculateScore(this.playerCards)}`;
        
        if (showAllDealerCards || this.gameOver) {
            document.getElementById('dealer-score').textContent = `Очки: ${this.calculateScore(this.dealerCards)}`;
        } else {
            document.getElementById('dealer-score').textContent = `Очки: ${this.calculateScore([this.dealerCards[0]])}`;
        }
    }
    
    updateBalance(amount) {
        if (!currentUser || !dataSyncManager) return;
        
        const newBalance = (currentUser.balance || 0) + amount;
        currentUser.balance = newBalance;
        
        // Обновляем в Firebase
        dataSyncManager.updateUserBalance(newBalance);
        
        // Обновляем UI
        updateUserInfo();
        
        // Показываем уведомление
        const message = amount > 0 ? 
            `Выигрыш: +${amount} лупанчиков!` : 
            `Проигрыш: ${amount} лупанчиков`;
        showNotification(message, amount > 0 ? 'success' : 'error');
    }
}

function startBlackjack() {
    const betInput = document.getElementById('blackjack-bet');
    const bet = parseInt(betInput.value);
    
    if (!bet || bet < 1) {
        showNotification('Введите корректную ставку', 'error');
        return;
    }
    
    if (!currentUser || (currentUser.balance || 0) < bet) {
        showNotification('Недостаточно лупанчиков для ставки', 'error');
        return;
    }
    
    // Создаем новую игру
    blackjackGame = new BlackjackGame(bet);
    blackjackGame.start();
    
    // Показываем кнопки действий
    document.getElementById('blackjack-actions').style.display = 'flex';
    
    // Очищаем предыдущий результат
    document.getElementById('blackjack-result').innerHTML = '';
}

function hitCard() {
    if (blackjackGame) {
        blackjackGame.hit();
    }
}

function standGame() {
    if (blackjackGame) {
        blackjackGame.stand();
    }
}

// ===== ИГРА КОСТИ =====
function playDice() {
    const betInput = document.getElementById('dice-bet');
    const guessInput = document.getElementById('dice-guess');
    const bet = parseInt(betInput.value);
    const guess = parseInt(guessInput.value);
    
    if (!bet || bet < 1) {
        showNotification('Введите корректную ставку', 'error');
        return;
    }
    
    if (!guess || guess < 1 || guess > 6) {
        showNotification('Введите число от 1 до 6', 'error');
        return;
    }
    
    if (!currentUser || (currentUser.balance || 0) < bet) {
        showNotification('Недостаточно лупанчиков для ставки', 'error');
        return;
    }
    
    // Бросаем кости
    const diceResult = Math.floor(Math.random() * 6) + 1;
    
    // Показываем результат
    const diceElement = document.getElementById('dice-result');
    diceElement.textContent = diceResult;
    
    // Определяем результат
    const isWin = diceResult === guess;
    const winAmount = isWin ? bet * 5 : 0;
    const loseAmount = isWin ? 0 : bet;
    
    // Обновляем баланс
    if (currentUser && dataSyncManager) {
        const newBalance = (currentUser.balance || 0) + winAmount - loseAmount;
        currentUser.balance = newBalance;
        dataSyncManager.updateUserBalance(newBalance);
        updateUserInfo();
    }
    
    // Показываем результат
    const resultElement = document.getElementById('dice-result-text');
    let message;
    if (isWin) {
        message = `Победа! Вы угадали число ${diceResult}! Выигрыш: ${winAmount} лупанчиков!`;
        resultElement.className = 'game-result win';
        showNotification(`Выигрыш: +${winAmount} лупанчиков!`, 'success');
    } else {
        message = `Не угадали! Выпало ${diceResult}, а вы загадали ${guess}. Проигрыш: ${loseAmount} лупанчиков.`;
        resultElement.className = 'game-result lose';
        showNotification(`Проигрыш: ${loseAmount} лупанчиков`, 'error');
    }
    resultElement.textContent = message;
}

// ===== ИГРА РУЛЕТКА =====
function selectRouletteBet(type) {
    rouletteBetType = type;
    
    // Убираем выделение со всех кнопок
    document.querySelectorAll('.bet-type-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Выделяем выбранную кнопку
    event.target.classList.add('selected');
    
    // Обновляем отображение выбранной ставки
    const selectedBetElement = document.getElementById('selected-bet');
    let betText = '';
    
    switch (type) {
        case 'red':
            betText = '🔴 Красное (коэффициент: 2x)';
            break;
        case 'black':
            betText = '⚫ Черное (коэффициент: 2x)';
            break;
        case 'even':
            betText = '⚪ Четное (коэффициент: 2x)';
            break;
        case 'odd':
            betText = '⚪ Нечетное (коэффициент: 2x)';
            break;
        case '1-18':
            betText = '1-18 (коэффициент: 2x)';
            break;
        case '19-36':
            betText = '19-36 (коэффициент: 2x)';
            break;
        case 'number':
            const numberInput = document.getElementById('roulette-number');
            const number = parseInt(numberInput.value);
            if (number >= 0 && number <= 36) {
                rouletteBetNumber = number;
                betText = `Число ${number} (коэффициент: 35x)`;
            } else {
                showNotification('Введите число от 0 до 36', 'error');
                return;
            }
            break;
    }
    
    selectedBetElement.textContent = betText;
    document.getElementById('spin-btn').disabled = false;
}

function spinRoulette() {
    if (!rouletteBetType) {
        showNotification('Выберите тип ставки', 'error');
        return;
    }
    
    const betInput = document.getElementById('roulette-bet');
    const bet = parseInt(betInput.value);
    
    if (!bet || bet < 1) {
        showNotification('Введите корректную ставку', 'error');
        return;
    }
    
    if (!currentUser || (currentUser.balance || 0) < bet) {
        showNotification('Недостаточно лупанчиков для ставки', 'error');
        return;
    }
    
    // Генерируем результат рулетки (0-36)
    const rouletteResult = Math.floor(Math.random() * 37);
    
    // Показываем результат
    const resultElement = document.getElementById('roulette-result');
    resultElement.textContent = rouletteResult;
    
    // Определяем цвет результата
    if (rouletteResult === 0) {
        resultElement.className = 'roulette-number green';
    } else if ([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(rouletteResult)) {
        resultElement.className = 'roulette-number red';
    } else {
        resultElement.className = 'roulette-number black';
    }
    
    // Определяем результат ставки
    let isWin = false;
    let multiplier = 0;
    
    switch (rouletteBetType) {
        case 'red':
            isWin = rouletteResult !== 0 && [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(rouletteResult);
            multiplier = 2;
            break;
        case 'black':
            isWin = rouletteResult !== 0 && ![1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(rouletteResult);
            multiplier = 2;
            break;
        case 'even':
            isWin = rouletteResult !== 0 && rouletteResult % 2 === 0;
            multiplier = 2;
            break;
        case 'odd':
            isWin = rouletteResult !== 0 && rouletteResult % 2 === 1;
            multiplier = 2;
            break;
        case '1-18':
            isWin = rouletteResult >= 1 && rouletteResult <= 18;
            multiplier = 2;
            break;
        case '19-36':
            isWin = rouletteResult >= 19 && rouletteResult <= 36;
            multiplier = 2;
            break;
        case 'number':
            isWin = rouletteResult === rouletteBetNumber;
            multiplier = 35;
            break;
    }
    
    // Обновляем баланс
    const winAmount = isWin ? bet * multiplier : 0;
    const loseAmount = isWin ? 0 : bet;
    
    if (currentUser && dataSyncManager) {
        const newBalance = (currentUser.balance || 0) + winAmount - loseAmount;
        currentUser.balance = newBalance;
        dataSyncManager.updateUserBalance(newBalance);
        updateUserInfo();
    }
    
    // Показываем результат
    const resultTextElement = document.getElementById('roulette-result-text');
    let message;
    if (isWin) {
        message = `Победа! Выигрыш: ${winAmount} лупанчиков!`;
        resultTextElement.className = 'game-result win';
        showNotification(`Выигрыш: +${winAmount} лупанчиков!`, 'success');
    } else {
        message = `Поражение! Проигрыш: ${loseAmount} лупанчиков.`;
        resultTextElement.className = 'game-result lose';
        showNotification(`Проигрыш: ${loseAmount} лупанчиков`, 'error');
    }
    resultTextElement.textContent = message;
    
    // Сбрасываем выбор ставки
    setTimeout(() => {
        resetGameState();
    }, 3000);
}

// ===== УТИЛИТЫ =====
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

// ===== ЭКСПОРТ ФУНКЦИЙ ДЛЯ ГЛОБАЛЬНОГО ДОСТУПА =====
window.showGame = showGame;
window.startBlackjack = startBlackjack;
window.hitCard = hitCard;
window.standGame = standGame;
window.playDice = playDice;
window.selectRouletteBet = selectRouletteBet;
window.spinRoulette = spinRoulette;
window.logout = logout; 
