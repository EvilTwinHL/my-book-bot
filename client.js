// === ГЛОБАЛЬНІ ЗМІННІ ===
const APP_VERSION = "0.5.0"; // Встановлюємо нову версію

let currentUser = null;
let currentProjectID = null;
/** @type {object | null} Зберігає ВСІ дані поточного проєкту */
let currentProjectData = null; 
/** @type {number | null} Індекс обраного персонажа в масиві */
let selectedCharacterIndex = null;
/** @type {number | null} Індекс обраного розділу в масиві */
let selectedChapterIndex = null;
/** @type {number | null} Індекс обраної локації в масиві */
let selectedLocationIndex = null;
/** @type {number | null} Індекс обраної лінії в масиві */
let selectedPlotlineIndex = null;
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
    notesGeneralInput, notesResearchInput,
    versionNumberSpan;

// ЕЛЕМЕНТИ (ВКЛАДКА ПЕРСОНАЖІВ)
let charactersList, addCharacterBtn, characterEditorPane,
    characterEditorPlaceholder, characterEditorTitle, characterNameInput,
    characterDescInput, characterArcInput, deleteCharacterBtn;

// ЕЛЕМЕНТИ (ВКЛАДКА РОЗДІЛІВ)
let chaptersList, addChapterBtn, chapterEditorPane,
    chapterEditorPlaceholder, chapterEditorTitle, chapterTitleInput,
    chapterStatusInput, chapterTextInput, deleteChapterBtn;

// ЕЛЕМЕНТИ (ВКЛАДКА ЛОКАЦІЙ)
let locationsList, addLocationBtn, locationEditorPane,
    locationEditorPlaceholder, locationEditorTitle, locationNameInput,
    locationDescInput, deleteLocationBtn;

// ЕЛЕМЕНТИ (ВКЛАДКА СЮЖЕТНИХ ЛІНІЙ)
let plotlinesList, addPlotlineBtn, plotlineEditorPane,
    plotlineEditorPlaceholder, plotlineEditorTitle, plotlineTitleInput,
    plotlineDescInput, deletePlotlineBtn;


// === ГОЛОВНИЙ ЗАПУСК ===
document.addEventListener('DOMContentLoaded', () => {
    bindUIElements();
    bindEventListeners();
    checkLoginOnLoad();
    
    versionNumberSpan.textContent = APP_VERSION;
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
    versionNumberSpan = document.getElementById('version-number');
    
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

    // Вкладка "Локації"
    locationsList = document.getElementById('locations-list');
    addLocationBtn = document.getElementById('add-location-btn');
    locationEditorPane = document.getElementById('location-editor-pane');
    locationEditorPlaceholder = document.getElementById('location-editor-placeholder');
    locationEditorTitle = document.getElementById('location-editor-title');
    locationNameInput = document.getElementById('location-name-input');
    locationDescInput = document.getElementById('location-desc-input');
    deleteLocationBtn = document.getElementById('delete-location-btn');

    // Вкладка "Сюжетні лінії"
    plotlinesList = document.getElementById('plotlines-list');
    addPlotlineBtn = document.getElementById('add-plotline-btn');
    plotlineEditorPane = document.getElementById('plotline-editor-pane');
    plotlineEditorPlaceholder = document.getElementById('plotline-editor-placeholder');
    plotlineEditorTitle = document.getElementById('plotline-editor-title');
    plotlineTitleInput = document.getElementById('plotline-title-input');
    plotlineDescInput = document.getElementById('plotline-desc-input');
    deletePlotlineBtn = document.getElementById('delete-plotline-btn');
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
    chapterStatusInput.addEventListener('change', (e) => handleChapterFieldSave('status', e.target.value)); 
    chapterTextInput.addEventListener('blur', (e) => handleChapterFieldSave('text', e.target.value));

    // Обробники для вкладки "Локації"
    addLocationBtn.addEventListener('click', handleAddNewLocation);
    deleteLocationBtn.addEventListener('click', handleDeleteLocation);
    locationNameInput.addEventListener('blur', (e) => handleLocationFieldSave('name', e.target.value));
    locationDescInput.addEventListener('blur', (e) => handleLocationFieldSave('description', e.target.value));

    // Обробники для вкладки "Сюжетні лінії"
    addPlotlineBtn.addEventListener('click', handleAddNewPlotline);
    deletePlotlineBtn.addEventListener('click', handleDeletePlotline);
    plotlineTitleInput.addEventListener('blur', (e) => handlePlotlineFieldSave('title', e.target.value));
    plotlineDescInput.addEventListener('blur', (e) => handlePlotlineFieldSave('description', e.target.value));
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
        if (!currentProjectData.content.locations) {
            currentProjectData.content.locations = [];
        }
        if (!currentProjectData.content.plotlines) {
            currentProjectData.content.plotlines = [];
        }
        if (!currentProjectData.chatHistory) {
            currentProjectData.chatHistory = [];
        }

        appContainer.classList.add('hidden');
        workspaceContainer.classList.remove('hidden');

        renderWorkspace();
        showTab('core-tab');
        
        // НОВЕ: Ініціалізуємо сортування, коли воркспейс готовий
        initSortableLists(); 

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
    
    // 7. Заповнити вкладку "Локації"
    renderLocationList();
    showLocationEditor(false);

    // 8. Заповнити вкладку "Сюжетні лінії"
    renderPlotlineList();
    showPlotlineEditor(false);
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

        // НОВЕ: Ініціалізуємо сортування і для нового проєкту
        initSortableLists();

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
                    value: value 
                })
            });
            if (!response.ok) throw new Error('Помилка збереження');
            
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
        // Відображаємо номер (індекс + 1)
        li.textContent = `${index + 1}. ${character.name || 'Персонаж без імені'}`;
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
    await saveCharactersArray(true); // Негайно зберегти
    const newIndex = currentProjectData.content.characters.length - 1;
    selectCharacter(newIndex);
}
function handleDeleteCharacter() {
    if (selectedCharacterIndex === null) return;
    const characterName = currentProjectData.content.characters[selectedCharacterIndex].name;
    showConfirmModal(`Ви впевнені, що хочете видалити персонажа "${characterName}"?`, async () => {
        currentProjectData.content.characters.splice(selectedCharacterIndex, 1);
        await saveCharactersArray(true); // Негайно зберегти
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
    await saveCharactersArray(); // Зберегти з затримкою
    renderCharacterList();
}
async function saveCharactersArray(immediate = false) {
    await saveArrayToDb("content.characters", currentProjectData.content.characters, "персонажів", immediate);
}

// === ФУНКЦІЇ: ВКЛАДКА "РОЗДІЛИ" ===

function renderChapterList() {
    if (!currentProjectData) return;
    chaptersList.innerHTML = ''; 
    currentProjectData.content.chapters.forEach((chapter, index) => {
        const li = document.createElement('li');
        // Відображаємо номер (індекс + 1)
        li.textContent = `${index + 1}. ${chapter.title || 'Розділ без назви'}`;
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
    chapterStatusInput.value = chapter.status || 'Заплановано'; // <-- ЗМІНЕНО
    chapterTextInput.value = chapter.text || '';
    
    showChapterEditor(true);
    renderChapterList();
}
async function handleAddNewChapter() {
    const newChapter = {
        title: "Новий розділ",
        status: "Заплановано", // <-- ЗМІНЕНО
        text: "",
        synopsis: "", // <-- ДОДАНО
        word_count: 0, // <-- ДОДАНО
        updated_at: new Date().toISOString() // <-- ДОДАНО
    };
    currentProjectData.content.chapters.push(newChapter);
    await saveChaptersArray(true); // Негайно зберегти
    const newIndex = currentProjectData.content.chapters.length - 1;
    selectChapter(newIndex);
}
function handleDeleteChapter() {
    if (selectedChapterIndex === null) return;
    const chapterTitle = currentProjectData.content.chapters[selectedChapterIndex].title;
    showConfirmModal(`Ви впевнені, що хочете видалити розділ "${chapterTitle}"?`, async () => {
        currentProjectData.content.chapters.splice(selectedChapterIndex, 1);
        await saveChaptersArray(true); // Негайно зберегти
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
    
    chapter.updated_at = new Date().toISOString(); // <-- ДОДАНО ЦЕЙ РЯДОК

    await saveChaptersArray(); // Зберегти з затримкою
    renderChapterList();
}
async function saveChaptersArray(immediate = false) {
    await saveArrayToDb("content.chapters", currentProjectData.content.chapters, "розділів", immediate);
}


// === ФУНКЦІЇ: ВКЛАДКА "ЛОКАЦІЇ" ===

function renderLocationList() {
    if (!currentProjectData) return;
    locationsList.innerHTML = ''; 
    currentProjectData.content.locations.forEach((location, index) => {
        const li = document.createElement('li');
        // Відображаємо номер (індекс + 1)
        li.textContent = `${index + 1}. ${location.name || 'Локація без назви'}`;
        li.dataset.index = index;
        li.addEventListener('click', () => {
            selectLocation(index);
        });
        if (index === selectedLocationIndex) {
            li.classList.add('active');
        }
        locationsList.appendChild(li);
    });
}
function showLocationEditor(show = true) {
    if (show) {
        locationEditorPane.classList.remove('hidden');
        locationEditorPlaceholder.classList.add('hidden');
    } else {
        locationEditorPane.classList.add('hidden');
        locationEditorPlaceholder.classList.remove('hidden');
        selectedLocationIndex = null;
        renderLocationList(); 
    }
}
function selectLocation(index) {
    selectedLocationIndex = index;
    const location = currentProjectData.content.locations[index];
    if (!location) return;
    locationEditorTitle.textContent = `Редагування "${location.name}"`;
    locationNameInput.value = location.name || '';
    locationDescInput.value = location.description || '';
    showLocationEditor(true);
    renderLocationList();
}
async function handleAddNewLocation() {
    const newLocation = {
        name: "Нова локація",
        description: ""
    };
    currentProjectData.content.locations.push(newLocation);
    await saveLocationsArray(true); // Негайно зберегти
    const newIndex = currentProjectData.content.locations.length - 1;
    selectLocation(newIndex);
}
function handleDeleteLocation() {
    if (selectedLocationIndex === null) return;
    const locationName = currentProjectData.content.locations[selectedLocationIndex].name;
    showConfirmModal(`Ви впевнені, що хочете видалити локацію "${locationName}"?`, async () => {
        currentProjectData.content.locations.splice(selectedLocationIndex, 1);
        await saveLocationsArray(true); // Негайно зберегти
        showLocationEditor(false); 
        renderLocationList(); 
    });
}
async function handleLocationFieldSave(field, value) {
    if (selectedLocationIndex === null) return;
    const location = currentProjectData.content.locations[selectedLocationIndex];
    if (location[field] === value) return; 
    
    location[field] = value;
    if (field === 'name') {
        locationEditorTitle.textContent = `Редагування "${value}"`;
    }
    await saveLocationsArray(); // Зберегти з затримкою
    renderLocationList();
}
async function saveLocationsArray(immediate = false) {
    await saveArrayToDb("content.locations", currentProjectData.content.locations, "локацій", immediate);
}

// === ФУНКЦІЇ: ВКЛАДКА "СЮЖЕТНІ ЛІНІЇ" ===

function renderPlotlineList() {
    if (!currentProjectData) return;
    plotlinesList.innerHTML = ''; 
    currentProjectData.content.plotlines.forEach((plotline, index) => {
        const li = document.createElement('li');
        // Відображаємо номер (індекс + 1)
        li.textContent = `${index + 1}. ${plotline.title || 'Лінія без назви'}`;
        li.dataset.index = index;
        li.addEventListener('click', () => {
            selectPlotline(index);
        });
        if (index === selectedPlotlineIndex) {
            li.classList.add('active');
        }
        plotlinesList.appendChild(li);
    });
}
function showPlotlineEditor(show = true) {
    if (show) {
        plotlineEditorPane.classList.remove('hidden');
        plotlineEditorPlaceholder.classList.add('hidden');
    } else {
        plotlineEditorPane.classList.add('hidden');
        plotlineEditorPlaceholder.classList.remove('hidden');
        selectedPlotlineIndex = null;
        renderPlotlineList(); 
    }
}
function selectPlotline(index) {
    selectedPlotlineIndex = index;
    const plotline = currentProjectData.content.plotlines[index];
    if (!plotline) return;
    plotlineEditorTitle.textContent = `Редагування "${plotline.title}"`;
    plotlineTitleInput.value = plotline.title || '';
    plotlineDescInput.value = plotline.description || '';
    showPlotlineEditor(true);
    renderPlotlineList();
}
async function handleAddNewPlotline() {
    const newPlotline = {
        title: "Нова сюжетна лінія",
        description: ""
    };
    currentProjectData.content.plotlines.push(newPlotline);
    await savePlotlinesArray(true); // Негайно зберегти
    const newIndex = currentProjectData.content.plotlines.length - 1;
    selectPlotline(newIndex);
}
function handleDeletePlotline() {
    if (selectedPlotlineIndex === null) return;
    const plotlineTitle = currentProjectData.content.plotlines[selectedPlotlineIndex].title;
    showConfirmModal(`Ви впевнені, що хочете видалити сюжетну лінію "${plotlineTitle}"?`, async () => {
        currentProjectData.content.plotlines.splice(selectedPlotlineIndex, 1);
        await savePlotlinesArray(true); // Негайно зберегти
        showPlotlineEditor(false); 
        renderPlotlineList(); 
    });
}
async function handlePlotlineFieldSave(field, value) {
    if (selectedPlotlineIndex === null) return;
    const plotline = currentProjectData.content.plotlines[selectedPlotlineIndex];
    if (plotline[field] === value) return; 
    
    plotline[field] = value;
    if (field === 'title') {
        plotlineEditorTitle.textContent = `Редагування "${value}"`;
    }
    await savePlotlinesArray(); // Зберегти з затримкою
    renderPlotlineList();
}
async function savePlotlinesArray(immediate = false) {
    await saveArrayToDb("content.plotlines", currentProjectData.content.plotlines, "сюжетних ліній", immediate);
}


// ===========================================
// === НОВА ФУНКЦІЯ: ІНІЦІАЛІЗАЦІЯ СОРТУВАННЯ ===
// ===========================================
function initSortableLists() {
    if (!currentProjectData) return;

    // 1. Сортування Розділів
    new Sortable(chaptersList, {
        animation: 150,
        onEnd: async (evt) => {
            const { oldIndex, newIndex } = evt;
            // 1. Оновити локальний масив
            const [item] = currentProjectData.content.chapters.splice(oldIndex, 1);
            currentProjectData.content.chapters.splice(newIndex, 0, item);
            
            // 2. Негайно зберегти (true)
            await saveChaptersArray(true);

            // 3. Оновити UI, щоб індекси були правильні
            renderChapterList();
        }
    });

    // 2. Сортування Персонажів
    new Sortable(charactersList, {
        animation: 150,
        onEnd: async (evt) => {
            const { oldIndex, newIndex } = evt;
            const [item] = currentProjectData.content.characters.splice(oldIndex, 1);
            currentProjectData.content.characters.splice(newIndex, 0, item);
            await saveCharactersArray(true);
            renderCharacterList();
        }
    });

    // 3. Сортування Локацій
    new Sortable(locationsList, {
        animation: 150,
        onEnd: async (evt) => {
            const { oldIndex, newIndex } = evt;
            const [item] = currentProjectData.content.locations.splice(oldIndex, 1);
            currentProjectData.content.locations.splice(newIndex, 0, item);
            await saveLocationsArray(true);
            renderLocationList();
        }
    });

    // 4. Сортування Сюжетних ліній
    new Sortable(plotlinesList, {
        animation: 150,
        onEnd: async (evt) => {
            const { oldIndex, newIndex } = evt;
            const [item] = currentProjectData.content.plotlines.splice(oldIndex, 1);
            currentProjectData.content.plotlines.splice(newIndex, 0, item);
            await savePlotlinesArray(true);
            renderPlotlineList();
        }
    });
}


// ===========================================
// === ОНОВЛЕНА УНІВЕРСАЛЬНА ФУНКЦІЯ ЗБЕРЕЖЕННЯ ===
// ===========================================

/**
 * Універсальна функція для збереження масивів
 * @param {boolean} [immediate=false] - Якщо true, зберегти негайно без таймера
 */
async function saveArrayToDb(field, array, nameForToast, immediate = false) {
    if (!currentProjectID) return;
    console.log(`Запит на збереження ${nameForToast}. Негайно: ${immediate}`);

    clearTimeout(saveTimer); // Завжди скасовуємо попередній таймер

    // Функція, яка власне і зберігає
    const doSave = async () => {
        showToast(`Збереження...`, 'info'); 
        try {
            const response = await fetch('/save-project-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    projectID: currentProjectID, 
                    field: field, 
                    value: array
                })
            });
            if (!response.ok) throw new Error(`Помилка збереження ${nameForToast}`);
            showToast(`${nameForToast.charAt(0).toUpperCase() + nameForToast.slice(1)} збережено!`, 'success');
        } catch (error) {
            console.error(`Помилка автозбереження ${nameForToast}:`, error);
            showToast(`Помилка збереження ${nameForToast}.`, 'error');
        }
    };

    if (immediate) {
        // Якщо негайно - просто викликаємо
        await doSave();
    } else {
        // Якщо ні - ставимо таймер, як і раніше
        saveTimer = setTimeout(doSave, 1000); // Затримка 1 сек (для полів вводу)
    }
}