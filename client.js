// Глобальні змінні
let currentUser = null;
let currentProjectID = null;

// --- Елементи DOM ---
let loginContainer, appContainer, loginInput, loginButton, logoutButton, usernameDisplay,
    projectsContainer, projectsList, createProjectButton, chatContainer, backToProjectsButton,
    currentProjectTitle, sendButton, userInput, chatWindow,
    spinnerOverlay, toastContainer;

// НОВІ ЕЛЕМЕНТИ ДЛЯ МОДАЛЬНИХ ВІКОН
let createEditModal, createEditModalTitle, createEditInput, createEditConfirmBtn, createEditCancelBtn,
    confirmModal, confirmModalMessage, confirmOkBtn, confirmCancelBtn;


// --- Головна функція, яка запускається при завантаженні ---
document.addEventListener('DOMContentLoaded', () => {
    // Знаходимо всі елементи один раз
    loginContainer = document.getElementById('login-container');
    appContainer = document.getElementById('app-container');
    loginInput = document.getElementById('login-input');
    loginButton = document.getElementById('login-button');
    logoutButton = document.getElementById('logout-button');
    usernameDisplay = document.getElementById('username-display');
    projectsContainer = document.getElementById('projects-container'); 
    projectsList = document.getElementById('projects-list');
    createProjectButton = document.getElementById('create-project-button');
    chatContainer = document.getElementById('chat-container');
    backToProjectsButton = document.getElementById('back-to-projects'); 
    currentProjectTitle = document.getElementById('current-project-title');
    sendButton = document.getElementById('sendButton');
    userInput = document.getElementById('userInput');
    chatWindow = document.getElementById('chat-window');
    spinnerOverlay = document.getElementById('spinner-overlay');
    toastContainer = document.getElementById('toast-container');
    
    // ЗНАХОДИМО НОВІ ЕЛЕМЕНТИ МОДАЛОК
    createEditModal = document.getElementById('create-edit-modal');
    createEditModalTitle = document.getElementById('create-edit-modal-title');
    createEditInput = document.getElementById('create-edit-input');
    createEditConfirmBtn = document.getElementById('create-edit-confirm-btn');
    createEditCancelBtn = document.getElementById('create-edit-cancel-btn');

    confirmModal = document.getElementById('confirm-modal');
    confirmModalMessage = document.getElementById('confirm-modal-message');
    confirmOkBtn = document.getElementById('confirm-ok-btn');
    confirmCancelBtn = document.getElementById('confirm-cancel-btn');


    // --- Прив'язка подій ---
    loginButton.addEventListener('click', handleLogin);
    logoutButton.addEventListener('click', handleLogout);
    loginInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') { handleLogin(); } });
    
    // createProjectButton тепер буде викликати showCreateEditModal
    createProjectButton.addEventListener('click', () => showCreateEditModal('create')); 
    
    backToProjectsButton.addEventListener('click', showProjectsList); 
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') { sendMessage(); } });

    // Запускаємо перевірку логіну
    checkLoginOnLoad();
});

// --- Логіка Логіну ---
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
    localStorage.removeItem('bookBotUser');
    chatWindow.innerHTML = ''; 
    showLoginScreen();
}

function showLoginScreen() {
    loginContainer.classList.remove('hidden'); 
    appContainer.classList.add('hidden'); 
}

function showAppScreen() {
    loginContainer.classList.add('hidden'); 
    appContainer.classList.remove('hidden'); 
    usernameDisplay.textContent = currentUser;
    showProjectsList(); 
    loadProjects(currentUser); 
}

function showProjectsList() {
    chatContainer.classList.add('hidden');
    projectsContainer.classList.remove('hidden');
    currentProjectID = null; 
}


// --- Логіка Картотеки ---
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
                titleSpan.onclick = () => { openChatForProject(project.id, project.title); };

                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'project-buttons';

                const editBtn = document.createElement('button');
                editBtn.textContent = 'Змінити';
                editBtn.className = 'btn-icon edit-btn';
                // handleEditTitle тепер викликається через showCreateEditModal
                editBtn.onclick = (e) => { e.stopPropagation(); showCreateEditModal('edit', project.id, project.title); };

                const exportBtn = document.createElement('button');
                exportBtn.textContent = 'Експорт';
                exportBtn.className = 'btn-icon export-btn';
                exportBtn.onclick = (e) => { e.stopPropagation(); window.open(`/export-project?projectID=${project.id}`, '_blank'); };

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Видалити';
                deleteBtn.className = 'btn-icon delete-btn';
                // handleDeleteProject тепер викликається через showConfirmModal
                deleteBtn.onclick = (e) => { e.stopPropagation(); showConfirmModal(`Ви впевнені, що хочете видалити проєкт "${project.title}"?`, () => handleDeleteProject(project.id, project.title)); };

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

// handleCreateProject тепер викликається з параметром title
async function handleCreateProject(title) {
    if (!title || title.trim() === "") {
        showToast("Назва не може бути порожньою!", 'error');
        return;
    }

    showSpinner(); 
    try {
        const response = await fetch('/create-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: currentUser, title: title.trim() }) });
        if (!response.ok) throw new Error('Сервер не зміг створити проєкт.');
        const newProject = await response.json(); 
        await loadProjects(currentUser); // Використовуємо await, щоб список оновився перед відкриттям чату
        openChatForProject(newProject.id, newProject.title);
        showToast('Проєкт створено!', 'success'); 
    } catch (error) { 
        console.error('Помилка при створенні проєкту:', error);
        showToast('Не вдалося створити проєкт.', 'error');
    } finally {
        hideSpinner(); 
    }
}

// handleDeleteProject тепер отримує ID та викликається після підтвердження
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

// handleEditTitle тепер отримує ID та нову назву
async function handleEditTitle(projectID, newTitle) {
    if (!newTitle || newTitle.trim() === "") {
        showToast("Назва не може бути порожньою!", 'error');
        return;
    }

    showSpinner(); 
    try {
        const response = await fetch('/update-title', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectID: projectID, newTitle: newTitle.trim() }) });
        if (!response.ok) throw new Error('Сервер не зміг оновити назву.');
        loadProjects(currentUser);
        showToast('Назву оновлено.', 'success'); 
    } catch (error) {
        console.error('Помилка при оновленні назви:', error);
        showToast('Не вдалося оновити назву.', 'error');
    } finally {
        hideSpinner(); 
    }
}

// --- Логіка Чату ---
async function openChatForProject(projectId, projectTitle) {
    currentProjectID = projectId;
    currentProjectTitle.textContent = projectTitle;
    projectsContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    chatWindow.innerHTML = 'Завантаження історії...'; 

    try {
        const response = await fetch(`/chat-history?projectID=${projectId}`);
        if (!response.ok) throw new Error('Не вдалося завантажити історію');
        const history = await response.json();
        chatWindow.innerHTML = ''; 
        history.forEach(message => {
            const sender = message.role === 'model' ? 'bot' : 'user';
            const text = message.parts[0].text;
            addMessageToChat(text, sender);
        });
    } catch (error) { 
        console.error("Помилка завантаження історії:", error); 
        chatWindow.innerHTML = 'Не вдалося завантажити історію.';
        showToast('Не вдалося завантажити історію.', 'error');
    }
}
        
async function sendMessage() {
    const messageText = userInput.value.trim();
    if (messageText === "" || !currentProjectID || !currentUser) return;
    addMessageToChat(messageText, 'user');
    userInput.value = '';
    sendButton.disabled = true; 
    try {
        const response = await fetch('/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectID: currentProjectID, message: messageText, user: currentUser }) });
        if (!response.ok) throw new Error('Сервер повернув помилку');
        const data = await response.json();
        const botMessage = data.message;
        addMessageToChat(botMessage, 'bot');
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
    messageElement.textContent = text;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}


// === ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ UI ===

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

    // Автоматично видалити повідомлення через 3 секунди
    setTimeout(() => {
        toast.remove();
    }, 3000);
}


// === НОВІ ФУНКЦІЇ ДЛЯ КАСТОМНИХ МОДАЛЬНИХ ВІКОН ===

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
            if (newValue !== oldTitle) { // Змінюємо тільки якщо назва змінилася
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