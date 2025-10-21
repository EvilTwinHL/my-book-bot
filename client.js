// === ГЛОБАЛЬНІ ЗМІННІ ===
let currentUser = null;
let currentProjectID = null;
/** @type {object | null} Зберігає ВСІ дані поточного проєкту */
let currentProjectData = null; 
/** @type {number | null} Індекс обраного персонажа в масиві */
let selectedCharacterIndex = null;
/** @type {number | null} Індекс обраного розділу в масиві */
let selectedChapterIndex = null;
/** @type {Timeout | null} Таймер для затримки автозбереження */
let saveTimer = null;


// === ЕЛЕМЕНТИ DOM ===
let loginContainer, appContainer, loginInput, loginButton, logoutButton, usernameDisplay,
    projectsContainer, projectsList, createProjectButton,
    spinnerOverlay, toastContainer,
    createEditModal, createEditModalTitle, createEditInput, createEditConfirmBtn, createEditCancelBtn,
    confirmModal, confirmModalMessage, confirmOkBtn, confirmCancelBtn;

// ЕЛЕМЕНТИ РОБОЧОГО ПРОСТОРУ
let workspaceContainer, workspaceTitle, backToProjectsButton, workspaceNav,
    chatWindow, userInput, sendButton,
    corePremiseInput, coreThemeInput, coreArcInput,
    notesGeneralInput, notesResearchInput;

// ЕЛЕМЕНТИ (ВКЛАДКА ПЕРСОНАЖІВ)
let charactersList, addCharacterBtn, characterEditorPane,
    characterEditorPlaceholder, characterEditorTitle, characterNameInput,
    characterDescInput, characterArcInput, deleteCharacterBtn;

// ЕЛЕМЕНТИ (ВКЛАДКА РОЗДІЛІВ)
let chaptersList, addChapterBtn, chapterEditorPane,
    chapterEditorPlaceholder, chapterEditorTitle, chapterTitleInput,
    chapterStatusInput, chapterTextInput, deleteChapterBtn;


// === ГОЛОВНИЙ ЗАПУСК ===
document.addEventListener('DOMContentLoaded', () => {
    bindUIElements();
    bindEventListeners();
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

    // Вкладка "Персонажі"
    charactersList = document.getElementById('characters-list');
    addCharacterBtn = document.getElementById('add-character-btn');
    characterEditorPane = document.getElementById('character-editor-pane');
    characterEditorPlaceholder = document.getElementById('character-editor-placeholder');
    characterEditorTitle = document.getElementById('character-editor-title');
    characterNameInput = document.getElementById('character-name-input');
    characterDescInput = document.getElementById('character-desc-input');
    characterArcInput = document.getElementById('character-arc-input');
    deleteCharacterBtn = document.getElementById('delete-character-btn');

    // Вкладка "Розділи"
    chaptersList = document.getElementById('chapters-list');
    addChapterBtn = document.getElementById('add-chapter-btn');
    chapterEditorPane = document.getElementById('chapter-editor-pane');
    chapterEditorPlaceholder = document.getElementById('chapter-editor-placeholder');
    chapterEditorTitle = document.getElementById('chapter-editor-title');
    chapterTitleInput = document.getElementById('chapter-title-input');
    chapterStatusInput = document.getElementById('chapter-status-input');
    chapterTextInput = document.getElementById('chapter-text-input');
    deleteChapterBtn = document.getElementById('delete-chapter-btn');
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

    // Автозбереження (прості поля)
    corePremiseInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    coreThemeInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    coreArcInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    notesGeneralInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    notesResearchInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    
    // Обробники для вкладки "Персонажі"
    addCharacterBtn.addEventListener('click', handleAddNewCharacter);
    deleteCharacterBtn.addEventListener('click', handleDeleteCharacter);
    characterNameInput.addEventListener('blur', (e) => handleCharacterFieldSave('name', e.target.value));
    characterDescInput.addEventListener('blur', (e) => handleCharacterFieldSave('description', e.target.value));
    characterArcInput.addEventListener('blur', (e) => handleCharacterFieldSave('arc', e.target.value));

    // Обробники для вкладки "Розділи"
    addChapterBtn.addEventListener('click', handleAddNewChapter);
    deleteChapterBtn.addEventListener('click', handleDeleteChapter);
    chapterTitleInput.addEventListener('blur', (e) => handleChapterFieldSave('title', e.target.value));
    chapterStatusInput.addEventListener('change', (e) => handleChapterFieldSave('status', e.target.value)); // 'change' для select
    chapterTextInput.addEventListener('blur', (e) => handleChapterFieldSave('text', e.target.value));
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
    loadProjects(currentUser); 
}

/**
 * Відкриває робочий простір проєкту
 */
async function openProjectWorkspace(projectID) {
    showSpinner();
    try {
        const response = await fetch(`/get-project-content?projectID=${projectID}`);
        if (!response.ok) throw new Error('Не вдалося завантажити проєкт');
        
        currentProjectData = await response.json();
        currentProjectID = projectID; 

        // --- Ініціалізація даних (ВАЖЛИВО) ---
        if (!currentProjectData.content) {
            currentProjectData.content = {};
        }
        if (!currentProjectData.content.characters) {
            currentProjectData.content.characters = [];
        }
        if (!currentProjectData.content.chapters) {
            currentProjectData.content.chapters = [];
        }
        if (!currentProjectData.chatHistory) {
            currentProjectData.chatHistory = [];
        }

        appContainer.classList.add('hidden');
        workspaceContainer.classList.remove('hidden');

        renderWorkspace();
        showTab('core-tab');

    } catch (error) {
        console.error("Помилка при відкритті проєкту:", error);
        showToast(error.message, 'error');
    } finally {
        hideSpinner();
    }
}

/**
 * Заповнює робочий простір даними з `currentProjectData`
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
    chatWindow.innerHTML = ''; 
    // === ВИПРАВЛЕНО ТУТ ===
    // (Додано 'currentProjectData.' та '|| []' для безпеки)
    (currentProjectData.chatHistory || []).slice(1).forEach(message => { 
        const sender = message.role === 'model' ? 'bot' : 'user';
        const text = message.parts[0].text.split("--- КОНТЕКСТ ПРОЄКТУ")[0]; 
        addMessageToChat(text, sender);
    });
    
    // 5. Заповнити вкладку "Персонажі"
    renderCharacterList();
    showCharacterEditor(false); 
    
    // 6. Заповнити вкладку "Розділи"
    renderChapterList();
    showChapterEditor(false); 
}

/**
 * Логіка перемикання вкладок
 */
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

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
                titleSpan.onclick = () => { openProjectWorkspace(project.id); };

                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'project-buttons';

                const editBtn = document.createElement('button');
                editBtn.textContent = 'Змінити';
                editBtn.className = 'btn-icon edit-btn';
                editBtn.onclick = (e) => { e.stopPropagation(); showCreateEditModal('edit', project.id, project.title); };
                
                const exportBtn = document.createElement('button');
                exportBtn.textContent = 'Експорт';
                exportBtn.className = 'btn-icon export-btn';
                exportBtn.onclick = (e) => { e.stopPropagation(); window.open(`/export-project?projectID=${project.id}`, '_blank'); };
                
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
        
        const newProject = await response.json(); 
        currentProjectData = newProject.data;
        currentProjectID = newProject.id;
        
        appContainer.classList.add('hidden');
        workspaceContainer.classList.remove('hidden');
        renderWorkspace();
        showTab('core-tab'); 

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
        
        if (currentProjectID === projectID) {
            currentProjectData.title = newTitle;
            workspaceTitle.textContent = newTitle;
        }
        
        loadProjects(currentUser); 
        showToast('Назву оновлено.', 'success'); 
    } catch (error) {
        console.error('Помилка при оновленні назви:', error);
        showToast('Не вдалося оновити назву.', 'error');
    } finally {
        hideSpinner(); 
    }
}

/**
 * Автозбереження для простих полів (Ядро, Нотатки)
 */
async function handleSimpleAutoSave(field, value) {
    if (!currentProjectID || !currentProjectData) return;
    
    const fieldName = field.split('.')[1]; 
    if (currentProjectData.content[fieldName] === value) {
        return; 
    }
    
    // === ВИПРАВЛЕНО ТУТ ===
    // Оновлюємо локальні дані одразу, щоб уникнути "відкату" UI
    currentProjectData.content[fieldName] = value;
    console.log(`Збереження... ${field}`);
    
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
        showToast(`Збереження...`, 'info'); 
        try {
            const response = await fetch('/save-project-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    projectID: currentProjectID, 
                    field: field, 
                    value: value // Надсилаємо нове значення
                })
            });
            if (!response.ok) throw new Error('Помилка збереження');
            
            // Локальні дані вже оновлено
            showToast('Збережено!', 'success');
        } catch (error) {
            console.error('Помилка автозбереження:', error);
            showToast('Помилка збереження.', 'error');
        }
    }, 1000); 
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
            body: JSON.stringify({ 
                projectID: currentProjectID, 
                message: messageText 
            }) 
        });
        if (!response.ok) throw new Error('Сервер повернув помилку');
        
        const data = await response.json();
        const botMessage = data.message;
        
        addMessageToChat(botMessage, 'bot');

        // Додаємо в локальну історію
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
    messageElement.innerHTML = text.replace(/\n/g, '<br>'); 
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}


// === ДОПОМІЖНІ ФУНКЦІЇ (UI) ===

function showSpinner() {
    spinnerOverlay.classList.remove('hidden');
}
function hideSpinner() {
    spinnerOverlay.classList.add('hidden');
}
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}
function showCreateEditModal(mode, projectID = null, oldTitle = '') {
    createEditModal.classList.remove('hidden'); 
    if (mode === 'create') {
        createEditModalTitle.textContent = "Введіть назву для нової книги:";
        createEditInput.value = "Нова книга " + new Date().toLocaleDateString();
    } else if (mode === 'edit') {
        createEditModalTitle.textContent = `Змінити назву "${oldTitle}":`;
        createEditInput.value = oldTitle;
    }
    createEditInput.focus(); 

    createEditConfirmBtn.onclick = null;
    createEditCancelBtn.onclick = null;
    createEditInput.onkeypress = null;

    createEditConfirmBtn.onclick = () => {
        const newValue = createEditInput.value.trim();
        hideCreateEditModal();
        if (mode === 'create') {
            handleCreateProject(newValue); 
        } else if (mode === 'edit') {
            if (newValue !== oldTitle && newValue !== "") {
                handleEditTitle(projectID, newValue);
            }
        }
    };
    createEditCancelBtn.onclick = hideCreateEditModal;
    createEditInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            createEditConfirmBtn.click();
        }
    };
}
function hideCreateEditModal() {
    createEditModal.classList.add('hidden');
}
function showConfirmModal(message, onConfirm) {
    confirmModal.classList.remove('hidden'); 
    confirmModalMessage.textContent = message;

    confirmOkBtn.onclick = null;
    confirmCancelBtn.onclick = null;

    confirmOkBtn.onclick = () => {
        hideConfirmModal();
        onConfirm(); 
    };
    confirmCancelBtn.onclick = hideConfirmModal;
}
function hideConfirmModal() {
    confirmModal.classList.add('hidden');
}


// === ФУНКЦІЇ: ВКЛАДКА "ПЕРСОНАЖІ" ===

function renderCharacterList() {
    if (!currentProjectData) return;
    charactersList.innerHTML = ''; 
    currentProjectData.content.characters.forEach((character, index) => {
        const li = document.createElement('li');
        li.textContent = character.name || 'Персонаж без імені';
        li.dataset.index = index;
        li.addEventListener('click', () => {
            selectCharacter(index);
        });
        if (index === selectedCharacterIndex) {
            li.classList.add('active');
        }
        charactersList.appendChild(li);
    });
}
function showCharacterEditor(show = true) {
    if (show) {
        characterEditorPane.classList.remove('hidden');
        characterEditorPlaceholder.classList.add('hidden');
    } else {
        characterEditorPane.classList.add('hidden');
        characterEditorPlaceholder.classList.remove('hidden');
        selectedCharacterIndex = null;
        renderCharacterList(); 
    }
}
function selectCharacter(index) {
    selectedCharacterIndex = index;
    const character = currentProjectData.content.characters[index];
    if (!character) return;
    characterEditorTitle.textContent = `Редагування "${character.name}"`;
    characterNameInput.value = character.name || '';
    characterDescInput.value = character.description || '';
    characterArcInput.value = character.arc || '';
    showCharacterEditor(true);
    renderCharacterList();
}
async function handleAddNewCharacter() {
    const newCharacter = {
        name: "Новий персонаж",
        description: "",
        arc: ""
    };
    currentProjectData.content.characters.push(newCharacter);
    await saveCharactersArray();
    const newIndex = currentProjectData.content.characters.length - 1;
    selectCharacter(newIndex);
}
function handleDeleteCharacter() {
    if (selectedCharacterIndex === null) return;
    const characterName = currentProjectData.content.characters[selectedCharacterIndex].name;
    showConfirmModal(`Ви впевнені, що хочете видалити персонажа "${characterName}"?`, async () => {
        currentProjectData.content.characters.splice(selectedCharacterIndex, 1);
        await saveCharactersArray();
        showCharacterEditor(false); 
        renderCharacterList(); 
    });
}
async function handleCharacterFieldSave(field, value) {
    if (selectedCharacterIndex === null) return;
    const character = currentProjectData.content.characters[selectedCharacterIndex];
    if (character[field] === value) return; 
    
    character[field] = value;
    if (field === 'name') {
        characterEditorTitle.textContent = `Редагування "${value}"`;
    }
    await saveCharactersArray(); 
    renderCharacterList();
}
async function saveCharactersArray() {
    if (!currentProjectID) return;
    console.log("Збереження масиву персонажів...");
    
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
        showToast(`Збереження...`, 'info'); 
        try {
            const response = await fetch('/save-project-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    projectID: currentProjectID, 
                    field: "content.characters", 
                    value: currentProjectData.content.characters
                })
            });
            if (!response.ok) throw new Error('Помилка збереження персонажів');
            showToast('Персонажів збережено!', 'success');
        } catch (error) {
            console.error('Помилка автозбереження персонажів:', error);
            showToast('Помилка збереження.', 'error');
        }
    }, 500); 
}

// === ФУНКЦІЇ: ВКЛАДКА "РОЗДІЛИ" ===

function renderChapterList() {
    if (!currentProjectData) return;
    chaptersList.innerHTML = ''; 
    currentProjectData.content.chapters.forEach((chapter, index) => {
        const li = document.createElement('li');
        li.textContent = chapter.title || 'Розділ без назви';
        li.dataset.index = index;
        li.addEventListener('click', () => {
            selectChapter(index);
        });
        if (index === selectedChapterIndex) {
            li.classList.add('active');
        }
        chaptersList.appendChild(li);
    });
}
function showChapterEditor(show = true) {
    if (show) {
        chapterEditorPane.classList.remove('hidden');
        chapterEditorPlaceholder.classList.add('hidden');
    } else {
        chapterEditorPane.classList.add('hidden');
        chapterEditorPlaceholder.classList.remove('hidden');
        selectedChapterIndex = null;
        renderChapterList(); 
    }
}
function selectChapter(index) {
    selectedChapterIndex = index;
    const chapter = currentProjectData.content.chapters[index];
    if (!chapter) return;
    
    chapterEditorTitle.textContent = `Редагування "${chapter.title}"`;
    chapterTitleInput.value = chapter.title || '';
    chapterStatusInput.value = chapter.status || 'Чернетка';
    chapterTextInput.value = chapter.text || '';
    
    showChapterEditor(true);
    renderChapterList();
}
async function handleAddNewChapter() {
    const newChapter = {
        title: "Новий розділ",
        status: "Чернетка",
        text: ""
    };
    currentProjectData.content.chapters.push(newChapter);
    await saveChaptersArray(); 
    const newIndex = currentProjectData.content.chapters.length - 1;
    selectChapter(newIndex);
}
function handleDeleteChapter() {
    if (selectedChapterIndex === null) return;
    const chapterTitle = currentProjectData.content.chapters[selectedChapterIndex].title;
    showConfirmModal(`Ви впевнені, що хочете видалити розділ "${chapterTitle}"?`, async () => {
        currentProjectData.content.chapters.splice(selectedChapterIndex, 1);
        await saveChaptersArray();
        showChapterEditor(false); 
        renderChapterList(); 
    });
}
async function handleChapterFieldSave(field, value) {
    if (selectedChapterIndex === null) return;
    const chapter = currentProjectData.content.chapters[selectedChapterIndex];
    if (chapter[field] === value) return; 
    
    chapter[field] = value;
    if (field === 'title') {
        chapterEditorTitle.textContent = `Редагування "${value}"`;
    }
    
    // === ВИПРАВЛЕНО ТУТ ===
    // Викликаємо правильну функцію збереження
    await saveChaptersArray(); 
    renderChapterList();
}
async function saveChaptersArray() {
    if (!currentProjectID) return;
    console.log("Збереження масиву розділів...");
    
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
        showToast(`Збереження...`, 'info'); 
        try {
            const response = await fetch('/save-project-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    projectID: currentProjectID, 
                    field: "content.chapters", // Зберігаємо ВЕСЬ масив
                    value: currentProjectData.content.chapters
                })
            });
            if (!response.ok) throw new Error('Помилка збереження розділів');
            showToast('Розділи збережено!', 'success');
        } catch (error) {
            console.error('Помилка автозбереження розділів:', error);
            showToast('Помилка збереження.', 'error');
        }
    }, 500); 
}