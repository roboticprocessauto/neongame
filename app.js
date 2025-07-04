// ===== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ВКЛАДОЧНОЙ АДМИН ПАНЕЛИ =====

// Глобальные переменные для админ панели
let currentAdminTab = 'events';
let allUsers = {};
let allBets = {};
let systemStats = {};

// ===== УПРАВЛЕНИЕ ВКЛАДКАМИ =====
window.switchAdminTab = function(tabName) {
    // Скрыть все вкладки
    document.querySelectorAll('.admin-tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Убрать активность с всех кнопок
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Показать выбранную вкладку
    const targetTab = document.getElementById(`admin-tab-${tabName}`);
    const targetButton = document.querySelector(`[onclick="switchAdminTab('${tabName}')"]`);
    
    if (targetTab) targetTab.classList.remove('hidden');
    if (targetButton) targetButton.classList.add('active');
    
    currentAdminTab = tabName;
    
    // Загрузить данные для вкладки
    switch(tabName) {
        case 'users':
            loadAdminUsers();
            break;
        case 'bets':
            loadAdminBets();
            break;
        case 'settings':
            loadAdminSettings();
            break;
        case 'stats':
            loadAdminStatistics();
            break;
        case 'events':
            loadAdminEvents();
            break;
    }
};

// ===== УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ =====
window.loadAdminUsers = async function() {
    try {
        const tbody = document.getElementById('adminUsersTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="7" class="loading">Загрузка пользователей...</td></tr>';
        
        const usersRef = window.dbRef(window.database, 'users');
        const snapshot = await window.dbGet(usersRef);
        
        if (snapshot.exists()) {
            allUsers = snapshot.val();
            displayAdminUsers();
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #b0bec5;">Пользователи не найдены</td></tr>';
        }
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        const tbody = document.getElementById('adminUsersTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #f44336;">Ошибка загрузки</td></tr>';
        }
    }
};

function displayAdminUsers() {
    const tbody = document.getElementById('adminUsersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    Object.entries(allUsers).forEach(([username, user]) => {
        const row = document.createElement('tr');
        
        const roleClass = `role-${user.role}`;
        const statusClass = user.status === 'active' ? 'status-active' : 'status-inactive';
        const registeredDate = user.registeredAt ? new Date(user.registeredAt).toLocaleDateString() : 'Неизвестно';
        const betLimit = user.betLimit || settings.maxBetAmount;
        
        row.innerHTML = `
            <td>${username}</td>
            <td><span class="${roleClass}">${getRoleName(user.role)}</span></td>
            <td>${user.balance ? user.balance.toLocaleString() : 0} монет</td>
            <td>${betLimit.toLocaleString()} монет</td>
            <td>${registeredDate}</td>
            <td><span class="${statusClass}">${user.status === 'active' ? 'Активен' : 'Заблокирован'}</span></td>
            <td>
                <button class="btn" onclick="editAdminUser('${username}')">Редактировать</button>
                <button class="btn ${user.status === 'active' ? 'btn-warning' : 'btn-success'}" 
                        onclick="toggleAdminUserStatus('${username}')">
                    ${user.status === 'active' ? 'Заблокировать' : 'Разблокировать'}
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function getRoleName(role) {
    const roles = {
        'admin': 'Администратор',
        'moderator': 'Модератор',
        'user': 'Пользователь'
    };
    return roles[role] || 'Пользователь';
}

window.filterAdminUsers = function() {
    const roleFilter = document.getElementById('adminUserRoleFilter')?.value || 'all';
    const searchFilter = document.getElementById('adminUserSearchFilter')?.value.toLowerCase() || '';
    
    const tbody = document.getElementById('adminUsersTableBody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        if (row.cells.length < 7) return; // Пропускаем строки загрузки
        
        const username = row.cells[0]?.textContent.toLowerCase() || '';
        const roleText = row.cells[1]?.textContent.toLowerCase() || '';
        
        const matchesRole = roleFilter === 'all' || roleText.includes(getRoleName(roleFilter).toLowerCase());
        const matchesSearch = searchFilter === '' || username.includes(searchFilter);
        
        row.style.display = matchesRole && matchesSearch ? '' : 'none';
    });
};

window.showAddAdminUserModal = function() {
    const modal = document.getElementById('addAdminUserModal');
    if (modal) modal.style.display = 'block';
};

window.editAdminUser = function(username) {
    const user = allUsers[username];
    if (!user) return;
    
    document.getElementById('editAdminUserLogin').value = username;
    document.getElementById('editAdminUserLoginDisplay').value = username;
    document.getElementById('editAdminUserRole').value = user.role || 'user';
    document.getElementById('editAdminUserBalance').value = user.balance || 0;
    document.getElementById('editAdminUserBetLimit').value = user.betLimit || settings.maxBetAmount;
    document.getElementById('editAdminUserPassword').value = '';
    
    const modal = document.getElementById('editAdminUserModal');
    if (modal) modal.style.display = 'block';
};

window.addAdminUser = async function() {
    const login = document.getElementById('newAdminUserLogin')?.value.trim();
    const password = document.getElementById('newAdminUserPassword')?.value.trim();
    const role = document.getElementById('newAdminUserRole')?.value || 'user';
    const balance = parseInt(document.getElementById('newAdminUserBalance')?.value) || settings.defaultBalance;
    
    if (!login || !password) {
        alert('Заполните все обязательные поля');
        return;
    }
    
    if (login.length < 3) {
        alert('Логин должен содержать минимум 3 символа');
        return;
    }
    
    if (password.length < 4) {
        alert('Пароль должен содержать минимум 4 символа');
        return;
    }
    
    try {
        const userRef = window.dbRef(window.database, `users/${login}`);
        const snapshot = await window.dbGet(userRef);
        
        if (snapshot.exists()) {
            alert('Пользователь с таким логином уже существует');
            return;
        }
        
        const newUser = {
            password: password,
            role: role,
            balance: balance,
            betLimit: settings.maxBetAmount,
            registeredAt: Date.now(),
            status: 'active'
        };
        
        await window.dbSet(userRef, newUser);
        
        // Очистить форму
        document.getElementById('newAdminUserLogin').value = '';
        document.getElementById('newAdminUserPassword').value = '';
        document.getElementById('newAdminUserRole').value = 'user';
        document.getElementById('newAdminUserBalance').value = settings.defaultBalance;
        
        closeAdminModal('addAdminUserModal');
        loadAdminUsers();
        alert('Пользователь добавлен успешно!');
    } catch (error) {
        console.error('Ошибка добавления пользователя:', error);
        alert('Ошибка добавления пользователя');
    }
};

window.updateAdminUser = async function() {
    const username = document.getElementById('editAdminUserLogin')?.value;
    const role = document.getElementById('editAdminUserRole')?.value;
    const balance = parseInt(document.getElementById('editAdminUserBalance')?.value);
    const betLimit = parseInt(document.getElementById('editAdminUserBetLimit')?.value);
    const newPassword = document.getElementById('editAdminUserPassword')?.value.trim();
    
    if (!username) return;
    
    try {
        const userRef = window.dbRef(window.database, `users/${username}`);
        const updates = {
            role: role,
            balance: balance,
            betLimit: betLimit
        };
        
        if (newPassword) {
            updates.password = newPassword;
        }
        
        await window.dbUpdate(userRef, updates);
        
        closeAdminModal('editAdminUserModal');
        loadAdminUsers();
        alert('Пользователь обновлен успешно!');
        
        // Обновить текущего пользователя если это он
        if (currentUser && currentUser.username === username) {
            currentUser.balance = balance;
            currentUser.role = role;
            updateUserInfo();
        }
    } catch (error) {
        console.error('Ошибка обновления пользователя:', error);
        alert('Ошибка обновления пользователя');
    }
};

window.toggleAdminUserStatus = async function(username) {
    const user = allUsers[username];
    if (!user) return;
    
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'разблокировать' : 'заблокировать';
    
    if (!confirm(`Вы уверены, что хотите ${action} пользователя ${username}?`)) {
        return;
    }
    
    try {
        const userRef = window.dbRef(window.database, `users/${username}`);
        await window.dbUpdate(userRef, { status: newStatus });
        
        user.status = newStatus;
        displayAdminUsers();
        
        const actionDone = newStatus === 'active' ? 'разблокирован' : 'заблокирован';
        alert(`Пользователь ${username} ${actionDone}`);
    } catch (error) {
        console.error('Ошибка изменения статуса пользователя:', error);
        alert('Ошибка изменения статуса пользователя');
    }
};

// ===== УПРАВЛЕНИЕ СТАВКАМИ =====
window.loadAdminBets = async function() {
    try {
        const tbody = document.getElementById('adminBetsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="9" class="loading">Загрузка ставок...</td></tr>';
        
        const betsRef = window.dbRef(window.database, 'bets');
        const snapshot = await window.dbGet(betsRef);
        
        if (snapshot.exists()) {
            allBets = snapshot.val();
            displayAdminBets();
        } else {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #b0bec5;">Ставки не найдены</td></tr>';
        }
    } catch (error) {
        console.error('Ошибка загрузки ставок:', error);
        const tbody = document.getElementById('adminBetsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #f44336;">Ошибка загрузки</td></tr>';
        }
    }
};

function displayAdminBets() {
    const tbody = document.getElementById('adminBetsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    Object.entries(allBets).forEach(([betId, bet]) => {
        const row = document.createElement('tr');
        
        const statusClass = `status-${bet.status}`;
        const potentialWin = (bet.amount * bet.coefficient).toFixed(2);
        const betDate = new Date(bet.timestamp).toLocaleString();
        
        row.innerHTML = `
            <td>${betId.substring(0, 8)}...</td>
            <td>${bet.user}</td>
            <td>${bet.type === 'single' ? 'Одиночная' : 'Экспресс'}</td>
            <td>${bet.amount} монет</td>
            <td>${bet.coefficient}</td>
            <td>${potentialWin} монет</td>
            <td><span class="${statusClass}">${getStatusName(bet.status)}</span></td>
            <td>${betDate}</td>
            <td>
                <button class="btn" onclick="viewAdminBet('${betId}')">Просмотр</button>
                ${bet.status === 'pending' ? `<button class="btn btn-danger" onclick="cancelAdminBet('${betId}')">Отменить</button>` : ''}
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function getStatusName(status) {
    const statuses = {
        'pending': 'Ожидает',
        'won': 'Выиграла',
        'lost': 'Проиграла',
        'cancelled': 'Отменена'
    };
    return statuses[status] || status;
}

window.filterAdminBets = function() {
    const statusFilter = document.getElementById('adminBetStatusFilter')?.value || 'all';
    const typeFilter = document.getElementById('adminBetTypeFilter')?.value || 'all';
    const userFilter = document.getElementById('adminBetUserFilter')?.value.toLowerCase() || '';
    
    const tbody = document.getElementById('adminBetsTableBody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        if (row.cells.length < 9) return;
        
        const status = row.cells[6]?.textContent.toLowerCase() || '';
        const type = row.cells[2]?.textContent.toLowerCase() || '';
        const user = row.cells[1]?.textContent.toLowerCase() || '';
        
        const matchesStatus = statusFilter === 'all' || status.includes(getStatusName(statusFilter).toLowerCase());
        const matchesType = typeFilter === 'all' || type.includes(typeFilter === 'single' ? 'одиночная' : 'экспресс');
        const matchesUser = userFilter === '' || user.includes(userFilter);
        
        row.style.display = matchesStatus && matchesType && matchesUser ? '' : 'none';
    });
};

window.viewAdminBet = function(betId) {
    const bet = allBets[betId];
    if (!bet) return;
    
    const details = document.getElementById('adminBetDetails');
    if (!details) return;
    
    details.innerHTML = `
        <div class="admin-card">
            <p><strong>ID ставки:</strong> ${betId}</p>
            <p><strong>Пользователь:</strong> ${bet.user}</p>
            <p><strong>Тип:</strong> ${bet.type === 'single' ? 'Одиночная' : 'Экспресс'}</p>
            <p><strong>Сумма:</strong> ${bet.amount} монет</p>
            <p><strong>Коэффициент:</strong> ${bet.coefficient}</p>
            <p><strong>Возможный выигрыш:</strong> ${(bet.amount * bet.coefficient).toFixed(2)} монет</p>
            <p><strong>Статус:</strong> ${getStatusName(bet.status)}</p>
            <p><strong>Дата:</strong> ${new Date(bet.timestamp).toLocaleString()}</p>
            
            <h4 style="margin-top: 20px; margin-bottom: 10px;">События:</h4>
            ${bet.events.map(event => `
                <div style="background: rgba(255,255,255,0.1); padding: 10px; margin: 5px 0; border-radius: 8px;">
                    <strong>Событие:</strong> ${event.eventTitle || event.eventId}<br>
                    <strong>Выбор:</strong> ${event.option}<br>
                    <strong>Коэффициент:</strong> ${event.coefficient}
                </div>
            `).join('')}
        </div>
    `;
    
    const modal = document.getElementById('viewAdminBetModal');
    if (modal) modal.style.display = 'block';
};

window.cancelAdminBet = async function(betId) {
    if (!confirm('Вы уверены, что хотите отменить эту ставку?')) {
        return;
    }
    
    const bet = allBets[betId];
    if (!bet || bet.status !== 'pending') return;
    
    try {
        // Обновить статус ставки
        const betRef = window.dbRef(window.database, `bets/${betId}`);
        await window.dbUpdate(betRef, { 
            status: 'cancelled',
            cancelledAt: Date.now(),
            cancelledBy: currentUser.username
        });
        
        // Вернуть средства пользователю
        const userRef = window.dbRef(window.database, `users/${bet.user}`);
        const userSnapshot = await window.dbGet(userRef);
        
        if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            await window.dbUpdate(userRef, { 
                balance: userData.balance + bet.amount 
            });
        }
        
        bet.status = 'cancelled';
        displayAdminBets();
        alert('Ставка отменена, средства возвращены пользователю');
    } catch (error) {
        console.error('Ошибка отмены ставки:', error);
        alert('Ошибка отмены ставки');
    }
};

// ===== НАСТРОЙКИ =====
window.loadAdminSettings = async function() {
    try {
        const settingsRef = window.dbRef(window.database, 'settings');
        const snapshot = await window.dbGet(settingsRef);
        
        if (snapshot.exists()) {
            const loadedSettings = snapshot.val();
            Object.assign(settings, loadedSettings);
        }
        
        // Заполнить поля настроек
        document.getElementById('adminMaxBetAmount').value = settings.maxBetAmount;
        document.getElementById('adminDefaultBalance').value = settings.defaultBalance;
        document.getElementById('adminMinBetAmount').value = settings.minBetAmount || 1;
        document.getElementById('adminMaxCoefficient').value = settings.maxCoefficient || 50;
        document.getElementById('adminWinCommission').value = settings.winCommission || 5;
        document.getElementById('adminMinWithdraw').value = settings.minWithdraw || 100;
        document.getElementById('adminMaxWithdrawPerDay').value = settings.maxWithdrawPerDay || 50000;
        document.getElementById('adminMaintenanceMode').checked = settings.maintenanceMode || false;
        document.getElementById('adminMaintenanceMessage').value = settings.maintenanceMessage || '';
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
    }
};

window.saveAdminSettings = async function() {
    try {
        const newSettings = {
            maxBetAmount: parseInt(document.getElementById('adminMaxBetAmount')?.value) || 1000,
            defaultBalance: parseInt(document.getElementById('adminDefaultBalance')?.value) || 5000,
            minBetAmount: parseInt(document.getElementById('adminMinBetAmount')?.value) || 1,
            maxCoefficient: parseFloat(document.getElementById('adminMaxCoefficient')?.value) || 50
        };
        
        Object.assign(settings, newSettings);
        
        const settingsRef = window.dbRef(window.database, 'settings');
        await window.dbUpdate(settingsRef, newSettings);
        
        alert('Основные настройки сохранены!');
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
        alert('Ошибка сохранения настроек');
    }
};

window.saveAdminCommissionSettings = async function() {
    try {
        const commissionSettings = {
            winCommission: parseFloat(document.getElementById('adminWinCommission')?.value) || 5,
            minWithdraw: parseInt(document.getElementById('adminMinWithdraw')?.value) || 100,
            maxWithdrawPerDay: parseInt(document.getElementById('adminMaxWithdrawPerDay')?.value) || 50000
        };
        
        Object.assign(settings, commissionSettings);
        
        const settingsRef = window.dbRef(window.database, 'settings');
        await window.dbUpdate(settingsRef, commissionSettings);
        
        alert('Настройки комиссий сохранены!');
    } catch (error) {
        console.error('Ошибка сохранения настроек комиссий:', error);
        alert('Ошибка сохранения настроек комиссий');
    }
};

window.toggleAdminMaintenance = async function() {
    try {
        const maintenanceSettings = {
            maintenanceMode: document.getElementById('adminMaintenanceMode')?.checked || false,
            maintenanceMessage: document.getElementById('adminMaintenanceMessage')?.value || ''
        };
        
        Object.assign(settings, maintenanceSettings);
        
        const settingsRef = window.dbRef(window.database, 'settings');
        await window.dbUpdate(settingsRef, maintenanceSettings);
        
        const status = maintenanceSettings.maintenanceMode ? 'включен' : 'выключен';
        alert(`Режим технического обслуживания ${status}!`);
    } catch (error) {
        console.error('Ошибка изменения режима обслуживания:', error);
        alert('Ошибка изменения режима обслуживания');
    }
};

// ===== СТАТИСТИКА =====
window.loadAdminStatistics = async function() {
    try {
        // Загрузить все данные если еще не загружены
        if (Object.keys(allUsers).length === 0) await loadAdminUsers();
        if (Object.keys(allBets).length === 0) await loadAdminBets();
        
        // Подсчет общей статистики
        const totalUsers = Object.keys(allUsers).length;
        const totalBets = Object.keys(allBets).length;
        const totalVolume = Object.values(allBets).reduce((sum, bet) => sum + bet.amount, 0);
        const activeEvents = Object.values(events).filter(event => event.status === 'active').length;
        const totalBalance = Object.values(allUsers).reduce((sum, user) => sum + (user.balance || 0), 0);
        const pendingBets = Object.values(allBets).filter(bet => bet.status === 'pending').length;
        
        // Обновить отображение
        document.getElementById('adminTotalUsers').textContent = totalUsers;
        document.getElementById('adminTotalBets').textContent = totalBets;
        document.getElementById('adminTotalVolume').textContent = totalVolume.toLocaleString();
        document.getElementById('adminActiveEvents').textContent = activeEvents;
        document.getElementById('adminTotalBalance').textContent = totalBalance.toLocaleString();
        document.getElementById('adminPendingBets').textContent = pendingBets;
        
        // Статистика по категориям
        const categoryStats = {};
        Object.values(events).forEach(event => {
            const category = event.category || 'unknown';
            if (!categoryStats[category]) {
                categoryStats[category] = { count: 0, bets: 0 };
            }
            categoryStats[category].count++;
        });
        
        // Подсчет ставок по категориям
        Object.values(allBets).forEach(bet => {
            bet.events.forEach(eventBet => {
                const event = events[eventBet.eventId];
                if (event) {
                    const category = event.category || 'unknown';
                    if (categoryStats[category]) {
                        categoryStats[category].bets++;
                    }
                }
            });
        });
        
        const categoryStatsDiv = document.getElementById('adminCategoryStats');
        if (categoryStatsDiv) {
            categoryStatsDiv.innerHTML = Object.entries(categoryStats).map(([category, stats]) => `
                <div style="margin-bottom: 10px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                    <strong>${getCategoryName(category)}</strong><br>
                    События: ${stats.count} | Ставки: ${stats.bets}
                </div>
            `).join('');
        }
        
        // Топ игроки по обороту
        const topPlayers = Object.entries(allUsers)
            .map(([username, user]) => ({
                username,
                volume: Object.values(allBets)
                    .filter(bet => bet.user === username)
                    .reduce((sum, bet) => sum + bet.amount, 0),
                balance: user.balance || 0
            }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 5);
        
        const topPlayersDiv = document.getElementById('adminTopPlayers');
        if (topPlayersDiv) {
            topPlayersDiv.innerHTML = topPlayers.map((player, index) => `
                <div style="margin-bottom: 10px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                    <strong>${index + 1}. ${player.username}</strong><br>
                    Оборот: ${player.volume.toLocaleString()} монет<br>
                    Баланс: ${player.balance.toLocaleString()} монет
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
};

// ===== МОДАЛЬНЫЕ ОКНА =====
window.closeAdminModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
};

// ===== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ =====
window.exportAdminData = function() {
    const data = {
        users: allUsers,
        bets: allBets,
        events: events,
        settings: settings,
        exportDate: new Date().toISOString(),
        exportedBy: currentUser.username
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maxbet_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert('Данные экспортированы успешно!');
};

window.cleanAdminOldBets = async function() {
    if (!confirm('Удалить ставки старше 30 дней? Это действие необратимо!')) return;
    
    try {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        let deletedCount = 0;
        const updates = {};
        
        Object.entries(allBets).forEach(([betId, bet]) => {
            if (bet.timestamp < thirtyDaysAgo && bet.status !== 'pending') {
                updates[`bets/${betId}`] = null; // Удаление в Firebase
                delete allBets[betId];
                deletedCount++;
            }
        });
        
        if (deletedCount > 0) {
            await window.dbUpdate(window.dbRef(window.database), updates);
        }
        
        alert(`Удалено ${deletedCount} старых ставок`);
        if (currentAdminTab === 'bets') displayAdminBets();
    } catch (error) {
        console.error('Ошибка очистки старых ставок:', error);
        alert('Ошибка очистки старых ставок');
    }
};

window.resetAdminAllBalances = async function() {
    if (!confirm('Сбросить балансы всех пользователей до стартового значения? Это действие необратимо!')) {
        return;
    }
    
    try {
        const updates = {};
        Object.keys(allUsers).forEach(username => {
            updates[`users/${username}/balance`] = settings.defaultBalance;
            allUsers[username].balance = settings.defaultBalance;
        });
        
        await window.dbUpdate(window.dbRef(window.database), updates);
        
        alert('Балансы всех пользователей сброшены!');
        if (currentAdminTab === 'users') displayAdminUsers();
        
        // Обновить текущего пользователя
        if (currentUser && allUsers[currentUser.username]) {
            currentUser.balance = settings.defaultBalance;
            updateUserInfo();
        }
    } catch (error) {
        console.error('Ошибка сброса балансов:', error);
        alert('Ошибка сброса балансов');
    }
};

function getCategoryName(category) {
    const categories = {
        'politics': '🏛️ Политика',
        'entertainment': '🎭 Развлечения',
        'technology': '💻 Технологии',
        'economics': '💰 Экономика',
        'weather': '🌤️ Погода',
        'society': '👥 Общество'
    };
    return categories[category] || '❓ Неизвестно';
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ ДЛЯ МОДАЛЬНЫХ ОКОН =====
window.addEventListener('click', function(event) {
    // Закрытие модальных окон админ панели по клику вне их
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

// Добавляем обработчики для фильтров (debounce для производительности)
let filterTimeout;
function debounceFilter(filterFunction) {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(filterFunction, 300);
}

// Переопределяем функции фильтрации с debounce
const originalFilterAdminUsers = window.filterAdminUsers;
const originalFilterAdminBets = window.filterAdminBets;

window.filterAdminUsers = function() {
    debounceFilter(originalFilterAdminUsers);
};

window.filterAdminBets = function() {
    debounceFilter(originalFilterAdminBets);
};
