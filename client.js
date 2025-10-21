// === ГЛОБАЛЬНІ ЗМІННІ ===
let currentUser = null;
let currentProjectID = null;
/** @type {object | null} Зберігає ВСІ дані поточного проєкту */
let currentProjectData = null; 

// === ЕЛЕМЕНТИ DOM ===
// (Ми будемо знаходити їх всі в 'DOMContentLoaded')
let loginContainer, appContainer, loginInput, loginButton, logoutButton, usernameDisplay,
    projectsContainer, projectsList, createProjectButton,
    spinnerOverlay, toastContainer,
    createEditModal, createEditModalTitle, createEditInput, createEditConfirmBtn, createEditCancelBtn,
    confirmModal, confirmModalMessage, confirmOkBtn, confirmCancelBtn;

// НОВІ ЕЛЕМЕНТИ РОБОЧОГО ПРОСТОРУ
let workspaceContainer, workspaceTitle, backToProjectsButton, workspaceNav,
    chatWindow, userInput, sendButton,
    corePremiseInput, coreThemeInput, coreArcInput,
    notesGeneralInput, notesResearchInput;


// === ГОЛОВНИЙ ЗАПУСК ===
document.addEventListener('DOMContentLoaded', () => {
    // Знаходимо всі елементи
    bindUIElements();
    // Прив'язуємо всі обробники подій
    bindEventListeners();
    // Перевіряємо, чи користувач вже увійшов
    checkLoginOnLoad();
});

/** Знаходить всі елементи DOM і зберігає їх у глобальні змінні */
function bindUIElements() {
    // Екрани
    loginContainer = document.getElementById('login-container');
    appContainer = document.getElementById('app-container');
    projectsContainer = document.getElementById('projects-container'); 
    workspaceContainer = document.getElementById('workspace-container');
    
    // Елементи UI
    spinnerOverlay = document.getElementById('spinner-overlay');
    toastContainer = document.getElementById('toast-container');
    
    // Елементи логіну / виходу
    loginInput = document.getElementById('login-input');
    loginButton = document.getElementById('login-button');
    logoutButton = document.getElementById('logout-button');
    usernameDisplay = document.getElementById('username-display');
    
    // Список проєктів
    projectsList = document.getElementById('projects-list');
    createProjectButton = document.getElementById('create-project-button');
    
    // Модалки (Створення/Редагування)
    createEditModal = document.getElementById('create-edit-modal');
    createEditModalTitle = document.getElementById('create-edit-modal-title');
    createEditInput = document.getElementById('create-edit-input');
    createEditConfirmBtn = document.getElementById('create-edit-confirm-btn');
    createEditCancelBtn = document.getElementById('create-edit-cancel-btn');
    
    // Модалки (Підтвердження)
    confirmModal = document.getElementById('confirm-modal');
    confirmModalMessage = document.getElementById('confirm-modal-message');
    confirmOkBtn = document.getElementById('confirm-ok-btn');
    confirmCancelBtn = document.getElementById('confirm-cancel-btn');

    // Елементи робочого простору
    workspaceTitle = document.getElementById('workspace-title');
    backToProjectsButton = document.getElementById('back-to-projects');
    workspaceNav = document.getElementById('workspace-nav');
    
    // Вкладка "Чат"
    chatWindow = document.getElementById('chat-window');
    userInput = document.getElementById('userInput');
    sendButton = document.getElementById('sendButton');
    
    // Вкладка "Ядро"
    corePremiseInput = document.getElementById('core-premise-input');
    coreThemeInput = document.getElementById('core-theme-input');
    coreArcInput = document.getElementById('core-arc-input');

    // Вкладка "Нотатки"
    notesGeneralInput = document.getElementById('notes-general-input');
    notesResearchInput = document.getElementById('notes-research-input');
}

/** Прив'язує всі обробники подій до елементів */
function bindEventListeners() {
    // Логін / Вихід
    loginButton.addEventListener('click', handleLogin);
    logoutButton.addEventListener('click', handleLogout);
    loginInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });

    // Створення проєкту
    createProjectButton.addEventListener('click', () => showCreateEditModal('create')); 
    
    // Повернення до списку проєктів
    backToProjectsButton.addEventListener('click', showProjectsList); 
    
    // Чат
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

    // Навігація по вкладках
    workspaceNav.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-btn')) {
            showTab(e.target.dataset.tab);
        }
    });

    // Автозбереження (через 'blur' - коли користувач "вийшов" з поля)
    corePremiseInput.addEventListener('blur', (e) => handleAutoSave(e.target.dataset.field, e.target.value));
    coreThemeInput.addEventListener('blur', (e) => handleAutoSave(e.target.dataset.field, e.target.value));
    coreArcInput.addEventListener('blur', (e) => handleAutoSave(e.target.dataset.field, e.target.value));
    notesGeneralInput.addEventListener('blur', (e) => handleAutoSave(e.target.dataset.field, e.target.value));
    notesResearchInput.addEventListener('blur', (e) => handleAutoSave(e.target.dataset.field, e.target.value));
}

// === ЛОГІКА НАВІГАЦІЇ ===

function checkLoginOnLoad() {
    const savedUser = localStorage.getItem('bookBotUser');
    if (savedUser) { 
        currentUser = savedUser; 
        showAppScreen(); 
    } else { 
        showLoginScreen(); 
    }
}
function handleLogin() {
    const user = loginInput.value.trim();
    if (user === "") {
        showToast("Логін не може бути порожнім!", 'error');
        return;
    }
    currentUser = user;
    localStorage.setItem('bookBotUser', user);
    showAppScreen();
}
function handleLogout() {
    currentUser = null; 
    currentProjectID = null;
    currentProjectData = null;
    localStorage.removeItem('bookBotUser');
    chatWindow.innerHTML = ''; 
    showLoginScreen();
}
function showLoginScreen() {
    loginContainer.classList.remove('hidden'); 
    appContainer.classList.add('hidden'); 
    workspaceContainer.classList.add('hidden');
}
function showAppScreen() {
    loginContainer.classList.add('hidden'); 
    appContainer.classList.remove('hidden'); 
    workspaceContainer.classList.add('hidden');
    usernameDisplay.textContent = currentUser;
    loadProjects(currentUser); 
}
function showProjectsList() {
    workspaceContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    currentProjectID = null; 
    currentProjectData = null;
    loadProjects(currentUser); // Оновити список про всяк випадок
}

/**
 * НОВА ФУНКЦІЯ: Відкриває робочий простір проєкту
 */
async function openProjectWorkspace(projectID) {
    showSpinner();
    try {
        const response = await fetch(`/get-project-content?projectID=${projectID}`);
        if (!response.ok) throw new Error('Не вдалося завантажити проєкт');
        
        currentProjectData = await response.json();
        currentProjectID = projectID; // Встановити ID

        // Показати/Сховати екрани
        appContainer.classList.add('hidden');
        workspaceContainer.classList.remove('hidden');

        // Заповнити даними
        renderWorkspace();

        // Відкрити першу вкладку за замовчуванням
        showTab('core-tab');

    } catch (error) {
        console.error("Помилка при відкритті проєкту:", error);
        showToast(error.message, 'error');
    } finally {
        hideSpinner();
    }
}

/**
 * НОВА ФУНКЦІЯ: Заповнює робочий простір даними з `currentProjectData`
 */
function renderWorkspace() {
    if (!currentProjectData) return;

    // 1. Встановити заголовок
    workspaceTitle.textContent = currentProjectData.title;

    // 2. Заповнити вкладку "Ядро"
    const content = currentProjectData.content;
    corePremiseInput.value = content.premise || '';
    coreThemeInput.value = content.theme || '';
    coreArcInput.value = content.mainArc || '';

    // 3. Заповнити вкладку "Нотатки"
    notesGeneralInput.value = content.notes || '';
    notesResearchInput.value = content.research || '';

    // 4. Заповнити вкладку "Чат"
    chatWindow.innerHTML = ''; // Очистити старий чат
    const chatHistory = currentProjectData.chatHistory;
    // Пропустити перший системний промпт
    chatHistory.slice(1).forEach(message => {
        const sender = message.role === 'model' ? 'bot' : 'user';
        // Вирізати RAG-контекст з повідомлень користувача, якщо він там є
        const text = message.parts[0].text.split("--- КОНТЕКСТ ПРОЄКТУ")[0]; 
        addMessageToChat(text, sender);
    });
}

/**
 * НОВА ФУНКЦІЯ: Логіка перемикання вкладок
 */
function showTab(tabId) {
    // 1. Сховати весь контент і деактивувати всі кнопки
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    // 2. Показати потрібний контент і активувати кнопку
    document.getElementById(tabId).classList.add('active');
    workspaceNav.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
}


// === ЛОГІКА API (КАРТОТЕКА) ===

async function loadProjects(user) {
    projectsList.innerHTML = '<li>Завантаження...</li>'; 
    try {
        const response = await fetch(`/get-projects?user=${user}`);
        if (!response.ok) throw new Error('Помилка мережі');
        const projects = await response.json();
        
        projectsList.innerHTML = ''; 
        if (projects.length === 0) {
            projectsList.innerHTML = '<li>У вас ще немає проєктів.</li>';
        } else {
            projects.forEach(project => {
                const li = document.createElement('li');
                
                const titleSpan = document.createElement('span');
                titleSpan.textContent = project.title;
                // ОНОВЛЕНО: Викликаємо нову функцію
                titleSpan.onclick = () => { openProjectWorkspace(project.id); };

                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'project-buttons';

                // Кнопка "Змінити"
                const editBtn = document.createElement('button');
                editBtn.textContent = 'Змінити';
                editBtn.className = 'btn-icon edit-btn';
                editBtn.onclick = (e) => { e.stopPropagation(); showCreateEditModal('edit', project.id, project.title); };
                
                // Кнопка "Експорт"
                const exportBtn = document.createElement('button');
                exportBtn.textContent = 'Експорт';
                exportBtn.className = 'btn-icon export-btn';
                exportBtn.onclick = (e) => { e.stopPropagation(); window.open(`/export-project?projectID=${project.id}`, '_blank'); };
                
                // Кнопка "Видалити"
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Видалити';
                deleteBtn.className = 'btn-icon delete-btn';
                deleteBtn.onclick = (e) => { e.stopPropagation(); showConfirmModal(`Ви впевнені, що хочете видалити проєкт "${project.title}"?`, () => handleDeleteProject(project.id)); };
                
                buttonsDiv.appendChild(editBtn);
                buttonsDiv.appendChild(exportBtn);
                buttonsDiv.appendChild(deleteBtn);
                li.appendChild(titleSpan);
                li.appendChild(buttonsDiv);
                projectsList.appendChild(li);
            });
        }
    } catch (error) {
        console.error('Не вдалося завантажити проєкти:', error);
        projectsList.innerHTML = '<li>Не вдалося завантажити проєкти.</li>';
        showToast('Не вдалося завантажити проєкти.', 'error');
    }
}

async function handleCreateProject(title) {
    if (!title || title.trim() === "") {
        showToast("Назва не може бути порожньою!", 'error');
        return;
    }
    showSpinner(); 
    try {
        const response = await fetch('/create-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: currentUser, title: title.trim() }) });
        if (!response.ok) throw new Error('Сервер не зміг створити проєкт.');
        
        // ОНОВЛЕНО: Сервер тепер повертає всі дані, відкриваємо воркспейс
        const newProject = await response.json(); 
        currentProjectData = newProject.data;
        currentProjectID = newProject.id;
        
        appContainer.classList.add('hidden');
        workspaceContainer.classList.remove('hidden');
        renderWorkspace();
        showTab('core-tab'); // Відкрити "Ядро" для нового проєкту

        showToast('Проєкт створено!', 'success'); 
    } catch (error) { 
        console.error('Помилка при створенні проєкту:', error);
        showToast('Не вдалося створити проєкт.', 'error');
    } finally {
        hideSpinner(); 
    }
}

async function handleDeleteProject(projectID) {
    showSpinner(); 
    try {
        const response = await fetch('/delete-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectID: projectID }) });
        if (!response.ok) throw new Error('Сервер не зміг видалити проєкт.');
        loadProjects(currentUser);
        showToast('Проєкт видалено.', 'success'); 
    } catch (error) { 
        console.error('Помилка при видаленні:', error); 
        showToast('Не вдалося видалити проєкт.', 'error');
    } finally {
        hideSpinner(); 
    }
}

async function handleEditTitle(projectID, newTitle) {
    if (!newTitle || newTitle.trim() === "") {
        showToast("Назва не може бути порожньою!", 'error');
        return;
    }
    showSpinner(); 
    try {
        const response = await fetch('/update-title', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectID: projectID, newTitle: newTitle.trim() }) });
        if (!response.ok) throw new Error('Сервер не зміг оновити назву.');
        
        // ОНОВЛЕНО: Оновити дані, якщо ми в воркспейсі
        if (currentProjectID === projectID) {
            currentProjectData.title = newTitle;
            workspaceTitle.textContent = newTitle;
        }
        
        loadProjects(currentUser); // Оновити список проєктів у фоні
        showToast('Назву оновлено.', 'success'); 
    } catch (error) {
        console.error('Помилка при оновленні назви:', error);
        showToast('Не вдалося оновити назву.', 'error');
    } finally {
        hideSpinner(); 
    }
}

/**
 * НОВА ФУНКЦІЯ: Автозбереження
 */
async function handleAutoSave(field, value) {
    if (!currentProjectID || !currentProjectData) return; // Перевірка, що дані завантажені
    
    // Визначити, де знаходяться дані (напр. 'notes' з 'content.notes')
    const fieldName = field.split('.')[1]; 
    if (currentProjectData.content[fieldName] === value) {
        // Не зберігати, якщо нічого не змінилося
        return;
    }

    console.log(`Збереження... ${field} = ${value.substring(0, 20)}...`);
    showToast(`Збереження...`, 'info'); // Показати тимчасовий тост
    
    try {
        const response = await fetch('/save-project-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                projectID: currentProjectID, 
                field: field, 
                value: value 
            })
        });
        if (!response.ok) throw new Error('Помилка збереження');

        // Оновити наші локальні дані
        currentProjectData.content[fieldName] = value;
        
        showToast('Збережено!', 'success');

    } catch (error) {
        console.error('Помилка автозбереження:', error);
        showToast('Помилка збереження.', 'error');
    }
}

// === ЛОГІКА API (ЧАТ) ===
        
async function sendMessage() {
    const messageText = userInput.value.trim();
    if (messageText === "" || !currentProjectID) return;
    
    addMessageToChat(messageText, 'user');
    userInput.value = '';
    sendButton.disabled = true; 
    
    try {
        const response = await fetch('/chat', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            // Серверу потрібен лише ID та повідомлення
            body: JSON.stringify({ 
                projectID: currentProjectID, 
                message: messageText 
            }) 
        });
        if (!response.ok) throw new Error('Сервер повернув помилку');
        
        const data = await response.json();
        const botMessage = data.message;
        
        addMessageToChat(botMessage, 'bot');

        // ОНОВЛЕНО: Додати повідомлення в локальну історію
        currentProjectData.chatHistory.push({ role: "user", parts: [{ text: messageText }] });
        currentProjectData.chatHistory.push({ role: "model", parts: [{ text: botMessage }] });

    } catch (error) { 
        console.error("Помилка відправки повідомлення:", error);
        showToast("Ой, сталася помилка. Спробуйте ще раз.", 'error');
    } finally { 
        sendButton.disabled = false; 
    }
}

function addMessageToChat(text, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);
    // Проста заміна \n на <br> для переносів рядків
    messageElement.innerHTML = text.replace(/\n/g, '<br>'); 
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}


// === ДОПОМІЖНІ ФУНКЦІЇ (UI) ===
// (Всі функції звідси і до кінця - повні, без змін)

function showSpinner() {
    spinnerOverlay.classList.remove('hidden');
}

function hideSpinner() {
    spinnerOverlay.classList.add('hidden');
}

/**
 * Показує спливаюче повідомлення
 * @param {string} message - Текст повідомлення
 * @param {string} type - 'info' (синій), 'success' (зелений), або 'error' (червоний)
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * Показує модальне вікно для створення або редагування назви.
 * @param {string} mode - 'create' або 'edit'
 * @param {string} [projectID=null] - ID проєкту, якщо режим 'edit'
 * @param {string} [oldTitle=''] - Поточна назва, якщо режим 'edit'
 */
function showCreateEditModal(mode, projectID = null, oldTitle = '') {
    createEditModal.classList.remove('hidden'); // Показати модалку

    if (mode === 'create') {
        createEditModalTitle.textContent = "Введіть назву для нової книги:";
        createEditInput.value = "Нова книга " + new Date().toLocaleDateString();
    } else if (mode === 'edit') {
        createEditModalTitle.textContent = `Змінити назву "${oldTitle}":`;
        createEditInput.value = oldTitle;
    }
    createEditInput.focus(); // Фокус на полі введення

    // Очистити попередні обробники, щоб уникнути багаторазових викликів
    createEditConfirmBtn.onclick = null;
    createEditCancelBtn.onclick = null;
    createEditInput.onkeypress = null;

    // Обробник для кнопки "OK"
    createEditConfirmBtn.onclick = () => {
        const newValue = createEditInput.value.trim();
        hideCreateEditModal();
        if (mode === 'create') {
            handleCreateProject(newValue); // Викликати з новою назвою
        } else if (mode === 'edit') {
            if (newValue !== oldTitle && newValue !== "") {
                handleEditTitle(projectID, newValue);
            }
        }
    };

    // Обробник для кнопки "Відміна"
    createEditCancelBtn.onclick = () => {
        hideCreateEditModal();
    };

    // Обробник для натискання Enter у полі введення
    createEditInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            createEditConfirmBtn.click(); // Імітувати натискання OK
        }
    };
}

function hideCreateEditModal() {
    createEditModal.classList.add('hidden');
}

/**
 * Показує модальне вікно для підтвердження дії.
 * @param {string} message - Повідомлення для відображення
 * @param {function} onConfirm - Функція, яка буде викликана при натисканні "Так"
 */
function showConfirmModal(message, onConfirm) {
    confirmModal.classList.remove('hidden'); // Показати модалку
    confirmModalMessage.textContent = message;

    // Очистити попередні обробники
    confirmOkBtn.onclick = null;
    confirmCancelBtn.onclick = null;

    // Обробник для кнопки "Так"
    confirmOkBtn.onclick = () => {
        hideConfirmModal();
        onConfirm(); // Викликати функцію підтвердження
    };

    // Обробник для кнопки "Ні"
    confirmCancelBtn.onclick = () => {
        hideConfirmModal();
    };
}

function hideConfirmModal() {
    confirmModal.classList.add('hidden');
}