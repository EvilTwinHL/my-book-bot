// === КОНФІГУРАЦІЯ ДОДАТКУ [v1.4.0 - P11] ===
const CONFIG = {
    APP_VERSION: "1.4.0",
    AUTOSAVE_DELAY: 1500, // ms
    DEFAULT_GOAL_WORDS: 50000,
    SNIPPET_LENGTH: 80, // characters
    TOAST_DURATION: 3000 // ms
};

// === ГЛОБАЛЬНІ ЗМІННІ ===
// (Видалено APP_VERSION, тепер вона в CONFIG)
let currentUser = null;
let currentProjectID = null;
/** @type {object | null} Зберігає ВСІ дані поточного проєкту */
let currentProjectData = null; 
let selectedCharacterIndex = null;
let selectedChapterIndex = null;
let selectedLocationIndex = null;
let selectedPlotlineIndex = null;
/** @type {Timeout | null} Таймер для затримки автозбереження */
let saveTimer = null;
/** @type {boolean} v1.2.0: Прапор для P15/P21 */
let hasUnsavedChanges = false;


// === ЕЛЕМЕНТИ DOM ===
let loginContainer, appContainer, loginInput, loginButton, logoutButton, usernameDisplay,
    projectsContainer, projectsList, createProjectButton,
    spinnerOverlay, toastContainer,
    createEditModal, createEditModalTitle, createEditInput, createEditConfirmBtn, createEditCancelBtn,
    confirmModal, confirmModalMessage, confirmOkBtn, confirmCancelBtn;

// ЕЛЕМЕНТИ РОБОЧОГО ПРОСТОРУ
let workspaceContainer, workspaceTitle, backToProjectsButton, workspaceNav,
    chatWindow, userInput, sendButton,
    corePremiseInput, coreThemeInput, coreArcInput, coreGoalInput, // ОНОВЛЕНО v1.4.0
    notesGeneralInput, notesResearchInput,
    versionNumberSpan,
    // v0.8.0
    dashboardProjectTitle, dashboardWriteBtn, dashboardTotalWords,
    dashboardProgressFill, dashboardProgressLabel, dashboardLastUpdated;

// v1.0.0: КОНТЕКСТНЕ МЕНЮ
let projectContextMenu, contextEditBtn, contextExportBtn, contextDeleteBtn;

// v1.2.0: ІНДИКАТОР ЗБЕРЕЖЕННЯ
let saveStatusIndicator, saveStatusDot, saveStatusText;

// ЕЛЕМЕНТИ (ВКЛАДКА ПЕРСОНАЖІВ)
let charactersList, addCharacterBtn, characterEditorPane,
    characterEditorPlaceholder, characterEditorTitle, characterNameInput,
    characterDescInput, characterArcInput, deleteCharacterBtn;

// ЕЛЕМЕНТИ (ВКЛАДКА РОЗДІЛІВ)
let chaptersList, addChapterBtn, chapterEditorPane,
    chapterEditorPlaceholder, chapterEditorTitle, chapterTitleInput,
    chapterStatusInput, chapterTextInput, deleteChapterBtn,
    chaptersTotalWordCount, chapterCurrentWordCount,
    chapterSynopsisInput; // v1.2.1

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
    
    // ОНОВЛЕНО v1.4.0: Використовуємо CONFIG
    versionNumberSpan.textContent = CONFIG.APP_VERSION;
});

/** Знаходить всі елементи DOM і зберігає їх у глобальні змінні */
function bindUIElements() {
    loginContainer = document.getElementById('login-container');
    appContainer = document.getElementById('app-container');
    projectsContainer = document.getElementById('projects-container'); 
    workspaceContainer = document.getElementById('workspace-container');
    spinnerOverlay = document.getElementById('spinner-overlay');
    toastContainer = document.getElementById('toast-container');
    versionNumberSpan = document.getElementById('version-number');
    loginInput = document.getElementById('login-input');
    loginButton = document.getElementById('login-button');
    logoutButton = document.getElementById('logout-button');
    usernameDisplay = document.getElementById('username-display');
    projectsList = document.getElementById('projects-list');
    createProjectButton = document.getElementById('create-project-button');
    createEditModal = document.getElementById('create-edit-modal');
    createEditModalTitle = document.getElementById('create-edit-modal-title');
    createEditInput = document.getElementById('create-edit-input');
    createEditConfirmBtn = document.getElementById('create-edit-confirm-btn');
    createEditCancelBtn = document.getElementById('create-edit-cancel-btn');
    confirmModal = document.getElementById('confirm-modal');
    confirmModalMessage = document.getElementById('confirm-modal-message');
    confirmOkBtn = document.getElementById('confirm-ok-btn');
    confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    projectContextMenu = document.getElementById('project-context-menu');
    contextEditBtn = document.getElementById('context-edit-btn');
    contextExportBtn = document.getElementById('context-export-btn');
    contextDeleteBtn = document.getElementById('context-delete-btn');
    workspaceTitle = document.getElementById('workspace-title');
    backToProjectsButton = document.getElementById('back-to-projects');
    workspaceNav = document.getElementById('workspace-nav');
    
    saveStatusIndicator = document.getElementById('save-status-indicator');
    saveStatusDot = document.getElementById('save-status-dot');
    saveStatusText = document.getElementById('save-status-text');

    chatWindow = document.getElementById('chat-window');
    userInput = document.getElementById('userInput');
    sendButton = document.getElementById('sendButton');
    corePremiseInput = document.getElementById('core-premise-input');
    coreThemeInput = document.getElementById('core-theme-input');
    coreArcInput = document.getElementById('core-arc-input');
    coreGoalInput = document.getElementById('core-goal-input'); // ОНОВЛЕНО v1.4.0
    notesGeneralInput = document.getElementById('notes-general-input');
    notesResearchInput = document.getElementById('notes-research-input');
    dashboardProjectTitle = document.getElementById('dashboard-project-title');
    dashboardWriteBtn = document.getElementById('dashboard-write-btn');
    dashboardTotalWords = document.getElementById('dashboard-total-words');
    dashboardProgressFill = document.getElementById('dashboard-progress-fill');
    dashboardProgressLabel = document.getElementById('dashboard-progress-label');
    dashboardLastUpdated = document.getElementById('dashboard-last-updated');
    charactersList = document.getElementById('characters-list');
    addCharacterBtn = document.getElementById('add-character-btn');
    characterEditorPane = document.getElementById('character-editor-pane');
    characterEditorPlaceholder = document.getElementById('character-editor-placeholder');
    characterEditorTitle = document.getElementById('character-editor-title');
    characterNameInput = document.getElementById('character-name-input');
    characterDescInput = document.getElementById('character-desc-input');
    characterArcInput = document.getElementById('character-arc-input');
    deleteCharacterBtn = document.getElementById('delete-character-btn');
    chaptersList = document.getElementById('chapters-list');
    addChapterBtn = document.getElementById('add-chapter-btn');
    chapterEditorPane = document.getElementById('chapter-editor-pane');
    chapterEditorPlaceholder = document.getElementById('chapter-editor-placeholder');
    chapterEditorTitle = document.getElementById('chapter-editor-title');
    chapterTitleInput = document.getElementById('chapter-title-input');
    chapterStatusInput = document.getElementById('chapter-status-input');
    chapterTextInput = document.getElementById('chapter-text-input');
    chapterSynopsisInput = document.getElementById('chapter-synopsis-input'); // v1.2.1
    deleteChapterBtn = document.getElementById('delete-chapter-btn');
    chaptersTotalWordCount = document.getElementById('chapters-total-word-count');
    chapterCurrentWordCount = document.getElementById('chapter-current-word-count');
    locationsList = document.getElementById('locations-list');
    addLocationBtn = document.getElementById('add-location-btn');
    locationEditorPane = document.getElementById('location-editor-pane');
    locationEditorPlaceholder = document.getElementById('location-editor-placeholder');
    locationEditorTitle = document.getElementById('location-editor-title');
    locationNameInput = document.getElementById('location-name-input');
    locationDescInput = document.getElementById('location-desc-input');
    deleteLocationBtn = document.getElementById('delete-location-btn');
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
    loginButton.addEventListener('click', handleLogin);
    logoutButton.addEventListener('click', handleLogout);
    loginInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
    createProjectButton.addEventListener('click', () => showCreateEditModal('create')); 
    backToProjectsButton.addEventListener('click', showProjectsList); 
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

    workspaceNav.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-btn')) {
            showTab(e.target.dataset.tab);
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!projectContextMenu.classList.contains('hidden')) {
            hideProjectContextMenu();
        }
    });

    // v1.3.0: Глобальний слухач гарячих клавіш [P16]
    document.addEventListener('keydown', handleGlobalHotkeys);

    // --- ОНОВЛЕНО v1.4.0: Слухачі для індикатора збереження ---
    // Слухаємо *всі* поля вводу
    const inputs = document.querySelectorAll(
        '#core-premise-input, #core-theme-input, #core-arc-input, #core-goal-input, ' + // Додано core-goal-input
        '#notes-general-input, #notes-research-input, ' +
        '#character-name-input, #character-desc-input, #character-arc-input, ' +
        '#chapter-title-input, #chapter-status-input, #chapter-text-input, ' +
        '#chapter-synopsis-input, ' + 
        '#location-name-input, #location-desc-input, ' +
        '#plotline-title-input, #plotline-desc-input'
    );
    inputs.forEach(input => {
        input.addEventListener('input', () => updateSaveStatus('unsaved'));
        input.addEventListener('change', () => updateSaveStatus('unsaved'));
    });
    
    // Слухачі для автозбереження (залишаються на 'blur' або 'change')
    corePremiseInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    coreThemeInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    coreArcInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    // ОНОВЛЕНО v1.4.0: Збереження мети (конвертуємо в число)
    coreGoalInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, parseInt(e.target.value, 10) || 0));

    notesGeneralInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    notesResearchInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    dashboardWriteBtn.addEventListener('click', () => { showTab('chapters-tab'); });
    
    addCharacterBtn.addEventListener('click', handleAddNewCharacter);
    deleteCharacterBtn.addEventListener('click', handleDeleteCharacter);
    characterNameInput.addEventListener('blur', (e) => handleCharacterFieldSave('name', e.target.value));
    characterDescInput.addEventListener('blur', (e) => handleCharacterFieldSave('description', e.target.value));
    characterArcInput.addEventListener('blur', (e) => handleCharacterFieldSave('arc', e.target.value));

    addChapterBtn.addEventListener('click', handleAddNewChapter);
    deleteChapterBtn.addEventListener('click', handleDeleteChapter);
    chapterTitleInput.addEventListener('blur', (e) => handleChapterFieldSave('title', e.target.value));
    chapterStatusInput.addEventListener('change', (e) => handleChapterFieldSave('status', e.target.value)); 
    chapterSynopsisInput.addEventListener('blur', (e) => handleChapterFieldSave('synopsis', e.target.value)); // v1.2.1
    chapterTextInput.addEventListener('blur', (e) => handleChapterFieldSave('text', e.target.value));
    chapterTextInput.addEventListener('input', handleChapterTextInput);

    addLocationBtn.addEventListener('click', handleAddNewLocation);
    deleteLocationBtn.addEventListener('click', handleDeleteLocation);
    locationNameInput.addEventListener('blur', (e) => handleLocationFieldSave('name', e.target.value));
    locationDescInput.addEventListener('blur', (e) => handleLocationFieldSave('description', e.target.value));

    addPlotlineBtn.addEventListener('click', handleAddNewPlotline);
    deletePlotlineBtn.addEventListener('click', handleDeletePlotline);
    plotlineTitleInput.addEventListener('blur', (e) => handlePlotlineFieldSave('title', e.target.value));
    plotlineDescInput.addEventListener('blur', (e) => handlePlotlineFieldSave('description', e.target.value));
}

// === ЛОГІКА НАВІГАЦІЇ === (Без змін v1.4.0)

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
    if (hasUnsavedChanges && !confirm("У вас є незбережені зміни. Ви впевнені, що хочете вийти?")) {
        return;
    }
    currentUser = null; 
    currentProjectID = null;
    currentProjectData = null;
    hasUnsavedChanges = false; 
    window.onbeforeunload = null; 
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
    if (hasUnsavedChanges && !confirm("У вас є незбережені зміни. Ви впевнені, що хочете вийти?")) {
        return;
    }
    workspaceContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    currentProjectID = null; 
    currentProjectData = null;
    hasUnsavedChanges = false; 
    window.onbeforeunload = null; 
    loadProjects(currentUser); 
}

async function openProjectWorkspace(projectID) {
    showSpinner();
    try {
        const response = await fetch(`/get-project-content?projectID=${projectID}`);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Не вдалося завантажити проєкт');
        }
        
        currentProjectData = await response.json();
        currentProjectID = projectID; 

        if (!currentProjectData.content) currentProjectData.content = {};
        if (!currentProjectData.content.characters) currentProjectData.content.characters = [];
        if (!currentProjectData.content.chapters) currentProjectData.content.chapters = [];
        if (!currentProjectData.content.locations) currentProjectData.content.locations = [];
        if (!currentProjectData.content.plotlines) currentProjectData.content.plotlines = [];
        if (!currentProjectData.chatHistory) currentProjectData.chatHistory = [];

        appContainer.classList.add('hidden');
        workspaceContainer.classList.remove('hidden');

        renderWorkspace();
        showTab('dashboard-tab');
        initSortableLists(); 
        updateSaveStatus('saved'); 

    } catch (error) {
        console.error("Помилка при відкритті проєкту:", error);
        showToast(error.message, 'error');
        logErrorToServer(error, "openProjectWorkspace"); 
    } finally {
        hideSpinner();
    }
}

function renderWorkspace() {
    if (!currentProjectData) return;

    workspaceTitle.textContent = currentProjectData.title;
    const content = currentProjectData.content;
    corePremiseInput.value = content.premise || '';
    coreThemeInput.value = content.theme || '';
    coreArcInput.value = content.mainArc || '';
    coreGoalInput.value = content.wordGoal || ''; // ОНОВЛЕНО v1.4.0
    notesGeneralInput.value = content.notes || '';
    notesResearchInput.value = content.research || '';

    chatWindow.innerHTML = ''; 
    (currentProjectData.chatHistory || []).slice(1).forEach(message => { 
        const sender = message.role === 'model' ? 'bot' : 'user';
        const text = message.parts[0].text.split("--- КОНТЕКСТ ПРОЄКТУ")[0]; 
        addMessageToChat(text, sender);
    });
    
    renderCharacterList();
    showCharacterEditor(false); 
    renderChapterList();
    showChapterEditor(false); 
    renderLocationList();
    showLocationEditor(false);
    renderPlotlineList();
    showPlotlineEditor(false);
    renderDashboard();
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    workspaceNav.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
}


// === ЛОГІКА API (КАРТОТЕКА) === (Без змін v1.4.0)

async function loadProjects(user) {
    projectsList.innerHTML = '<li>Завантаження...</li>'; 
    try {
        const response = await fetch(`/get-projects?user=${user}`);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Помилка мережі. Перевірте лог сервера.');
        }
        const projects = await response.json();
        
        projectsList.innerHTML = ''; 
        if (projects.length === 0) {
            projectsList.innerHTML = '<li>У вас ще немає проєктів.</li>';
        } else {
            projects.forEach(project => {
                const li = document.createElement('li');
                li.className = 'project-card';
                
                const wordCount = (project.totalWordCount || 0).toLocaleString('uk-UA');
                let lastUpdated = 'нещодавно';
                if (project.updatedAt) {
                    const date = new Date(project.updatedAt._seconds * 1000);
                    lastUpdated = date.toLocaleDateString('uk-UA'); 
                }

                li.innerHTML = `
                    <div class="project-card-header">
                        <h3 class="project-card-title">${project.title}</h3>
                        <button class="project-card-menu-btn" aria-label="Дії з проєктом">...</button>
                    </div>
                    <div class="project-card-footer">
                        <span>${wordCount} слів</span>
                        <span>Оновлено: ${lastUpdated}</span>
                    </div>
                `;

                li.querySelector('.project-card-title').addEventListener('click', () => {
                    openProjectWorkspace(project.id);
                });

                li.querySelector('.project-card-menu-btn').addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    showProjectContextMenu(e, project);
                });

                projectsList.appendChild(li);
            });
        }
    } catch (error) {
        console.error('Не вдалося завантажити проєкти:', error);
        projectsList.innerHTML = '<li>Не вдалося завантажити проєкти.</li>';
        showToast(error.message, 'error');
        logErrorToServer(error, "loadProjects"); 
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
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Сервер не зміг створити проєкт.');
        }
        
        const newProject = await response.json(); 
        currentProjectData = newProject.data;
        currentProjectID = newProject.id;
        
        appContainer.classList.add('hidden');
        workspaceContainer.classList.remove('hidden');
        renderWorkspace();
        showTab('dashboard-tab'); 
        initSortableLists();
        updateSaveStatus('saved'); 
        showToast('Проєкт створено!', 'success'); 

    } catch (error) { 
        console.error('Помилка при створенні проєкту:', error);
        showToast(error.message, 'error');
        logErrorToServer(error, "handleCreateProject"); 
    } finally {
        hideSpinner(); 
    }
}

async function handleDeleteProject(projectID) {
    showSpinner(); 
    try {
        const response = await fetch('/delete-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectID: projectID }) });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Сервер не зміг видалити проєкт.');
        }
        loadProjects(currentUser);
        showToast('Проєкт видалено.', 'success'); 

    } catch (error) { 
        console.error('Помилка при видаленні:', error); 
        showToast(error.message, 'error');
        logErrorToServer(error, "handleDeleteProject"); 
    } finally {
        hideSpinner(); 
    }
}

async function handleEditTitle(projectID, newTitle) {
    if (!newTitle || newTitle.trim() === "") {
        showToast("Назва не може бути порожньою!", 'error');
        return;
    }
    updateSaveStatus('saving'); 
    showSpinner(); 
    try {
        const response = await fetch('/update-title', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectID: projectID, newTitle: newTitle.trim() }) });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Сервер не зміг оновити назву.');
        }
        
        if (currentProjectID === projectID) {
            currentProjectData.title = newTitle;
            workspaceTitle.textContent = newTitle;
        }
        
        loadProjects(currentUser); 
        updateSaveStatus('saved'); 
        showToast('Назву оновлено.', 'success'); 

    } catch (error) {
        console.error('Помилка при оновленні назви:', error);
        showToast(error.message, 'error');
        updateSaveStatus('error'); 
        logErrorToServer(error, "handleEditTitle"); 
    } finally {
        hideSpinner(); 
    }
}

async function handleSimpleAutoSave(field, value) {
    if (!currentProjectID || !currentProjectData) return;
    
    const fieldName = field.split('.')[1]; 
    
    // ОНОВЛЕНО v1.4.0: Також перевіряємо, чи є 'wordGoal' 0
    if (currentProjectData.content[fieldName] === value && fieldName !== 'wordGoal') {
        return; 
    }
    
    currentProjectData.content[fieldName] = value;
    
    // updateSaveStatus('unsaved') вже викликано
    
    clearTimeout(saveTimer);
    // ОНОВЛЕНО v1.4.0: Використовуємо CONFIG
    saveTimer = setTimeout(async () => {
        try {
            await saveArrayToDb(field, value, "даних", true, true);
            // ОНОВЛЕНО v1.4.0: Якщо ми змінили мету, оновити dashboard
            if (fieldName === 'wordGoal') {
                renderDashboard();
            }
        } catch (error) {
            // Обробка помилок тепер в saveArrayToDb
        }
    }, CONFIG.AUTOSAVE_DELAY); 
}

// === ЛОГІКА API (ЧАТ) === (Без змін v1.4.0)
        
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
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Сервер повернув помилку');
        }
        
        const data = await response.json();
        const botMessage = data.message;
        
        addMessageToChat(botMessage, 'bot');
        currentProjectData.chatHistory.push({ role: "user", parts: [{ text: messageText }] });
        currentProjectData.chatHistory.push({ role: "model", parts: [{ text: botMessage }] });

    } catch (error) { 
        console.error("Помилка відправки повідомлення:", error);
        showToast(error.message, 'error');
        logErrorToServer(error, "sendMessage"); 
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
    
    // ОНОВЛЕНО v1.4.0: Використовуємо CONFIG
    setTimeout(() => {
        toast.remove();
    }, CONFIG.TOAST_DURATION);

    if (type === 'error') {
        if (!(message instanceof Error)) {
            logErrorToServer(new Error(message), "showToast");
        }
    }
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

// === v1.0.0: КОНТЕКСТНЕ МЕНЮ === (Без змін v1.4.0)

function showProjectContextMenu(event, project) {
    projectContextMenu.classList.remove('hidden');
    projectContextMenu.style.top = `${event.pageY}px`;
    projectContextMenu.style.left = `${event.pageX}px`;

    contextEditBtn.onclick = () => {
        showCreateEditModal('edit', project.id, project.title);
    };
    contextExportBtn.onclick = () => {
        window.open(`/export-project?projectID=${project.id}`, '_blank');
    };
    contextDeleteBtn.onclick = () => {
        showConfirmModal(`Ви впевнені, що хочете видалити проєкт "${project.title}"?`, () => handleDeleteProject(project.id));
    };
}

function hideProjectContextMenu() {
    projectContextMenu.classList.add('hidden');
}

// === v1.1.0: ЛОГУВАННЯ ПОМИЛОК === (Без змін v1.4.0)
async function logErrorToServer(error, contextName) {
    console.error(`[${contextName}]`, error); 
    try {
        await fetch('/log-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: error.message,
                stack: error.stack,
                context: {
                    name: contextName,
                    user: currentUser,
                    projectID: currentProjectID,
                    href: window.location.href,
                    userAgent: navigator.userAgent
                }
            })
        });
    } catch (logError) {
        console.error("Не вдалося відправити лог на сервер:", logError);
    }
}
window.onerror = (message, source, lineno, colno, error) => {
    logErrorToServer(error || new Error(message), 'window.onerror');
};
window.onunhandledrejection = (event) => {
    logErrorToServer(event.reason || new Error('Unhandled rejection'), 'window.onunhandledrejection');
};

// === v1.3.0: ГАРЯЧІ КЛАВІШІ [P16] === (Без змін v1.4.0)

function handleGlobalHotkeys(e) {
    // P16: Ctrl+S або Cmd+S для Збереження
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); 
        
        if (hasUnsavedChanges) {
            console.log('Hotkey: Force save (blur) triggered.');
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
        } else {
            showToast('Немає що зберігати.', 'info');
        }
    }

    // P16: Клавіша Escape
    if (e.key === 'Escape') {
        if (!createEditModal.classList.contains('hidden')) {
            hideCreateEditModal();
            return;
        }
        if (!confirmModal.classList.contains('hidden')) {
            hideConfirmModal();
            return;
        }
        if (!projectContextMenu.classList.contains('hidden')) {
            hideProjectContextMenu();
            return;
        }
        
        const activeTabId = document.querySelector('.tab-content.active')?.id;
        if (!activeTabId) return;

        switch (activeTabId) {
            case 'characters-tab':
                if (!characterEditorPane.classList.contains('hidden')) {
                    showCharacterEditor(false);
                }
                break;
            case 'chapters-tab':
                 if (!chapterEditorPane.classList.contains('hidden')) {
                    showChapterEditor(false);
                }
                break;
            case 'locations-tab':
                 if (!locationEditorPane.classList.contains('hidden')) {
                    showLocationEditor(false);
                }
                break;
            case 'plotlines-tab':
                 if (!plotlineEditorPane.classList.contains('hidden')) {
                    showPlotlineEditor(false);
                }
                break;
        }
    }
}

// === v1.2.0: НОВА ФУНКЦІЯ ІНДИКАТОРА ЗБЕРЕЖЕННЯ (P15, P21) === (Без змін v1.4.0)
function updateSaveStatus(status) {
    if (!saveStatusIndicator) return; 

    switch (status) {
        case 'saved':
            saveStatusIndicator.classList.remove('saving', 'unsaved', 'error');
            saveStatusText.textContent = "Збережено";
            hasUnsavedChanges = false;
            window.onbeforeunload = null;
            break;
        case 'unsaved':
            saveStatusIndicator.classList.remove('saving', 'error');
            saveStatusIndicator.classList.add('unsaved');
            saveStatusText.textContent = "Не збережено";
            hasUnsavedChanges = true;
            window.onbeforeunload = () => "У вас є незбережені зміни. Ви впевнені, що хочете піти?";
            break;
        case 'saving':
            saveStatusIndicator.classList.remove('unsaved', 'error');
            saveStatusIndicator.classList.add('saving');
            saveStatusText.textContent = "Збереження...";
            hasUnsavedChanges = true; 
            window.onbeforeunload = () => "Іде збереження. Ви впевнені, що хочете піти?";
            break;
        case 'error':
            saveStatusIndicator.classList.remove('saving', 'unsaved');
            saveStatusIndicator.classList.add('error');
            saveStatusText.textContent = "Помилка збереження";
            hasUnsavedChanges = true; 
            window.onbeforeunload = () => "Сталася помилка збереження. Ви впевнені, що хочете піти?";
            break;
    }
}


// === v0.5.1 - ЛІЧИЛЬНИК СЛІВ === (Без змін v1.4.0)

function countWords(text) {
    if (!text || text.trim() === "") {
        return 0;
    }
    const words = text.trim().split(/\s+/);
    return words.length;
}
function handleChapterTextInput(e) {
    if (selectedChapterIndex === null) return;
    const count = countWords(e.target.value);
    chapterCurrentWordCount.textContent = `${count} слів`;
    updateSaveStatus('unsaved'); 
}
function updateTotalWordCount() {
    if (!currentProjectData || !currentProjectData.content.chapters) {
        chaptersTotalWordCount.textContent = 'Загалом: 0 слів';
        return;
    }
    const totalCount = currentProjectData.content.chapters.reduce((sum, chapter) => {
        const count = chapter.word_count || countWords(chapter.text);
        return sum + count;
    }, 0);
    chaptersTotalWordCount.textContent = `Загалом: ${totalCount} слів`;
}

// === v0.8.0: DASHBOARD === (ОНОВЛЕНО v1.4.0)

function renderDashboard() {
    if (!currentProjectData) return;
    
    // ОНОВЛЕНО v1.4.0: Використовуємо динамічну мету [P1/P20]
    const totalCount = currentProjectData.totalWordCount || 0;
    const goalWords = currentProjectData.content.wordGoal || CONFIG.DEFAULT_GOAL_WORDS;
    
    dashboardProjectTitle.textContent = currentProjectData.title || "Без назви";
    dashboardTotalWords.textContent = totalCount.toLocaleString('uk-UA'); 

    if (currentProjectData.updatedAt) {
        const date = new Date(currentProjectData.updatedAt._seconds * 1000);
        dashboardLastUpdated.textContent = date.toLocaleString('uk-UA');
    } else {
        dashboardLastUpdated.textContent = 'Ще не зберігалось';
    }
    
    // Розрахунок прогресу
    const progressPercent = (goalWords > 0) ? Math.min((totalCount / goalWords) * 100, 100) : 0;
    
    dashboardProgressFill.style.width = `${progressPercent}%`;
    dashboardProgressLabel.textContent = `${Math.floor(progressPercent)}% до мети (${goalWords.toLocaleString('uk-UA')} слів)`;
}


// === ВКЛАДКА "ПЕРСОНАЖІ" === (Без змін v1.4.0)

function renderCharacterList() {
    if (!currentProjectData) return;
    charactersList.innerHTML = ''; 
    currentProjectData.content.characters.forEach((character, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${character.name || 'Персонаж без імені'}`;
        li.dataset.index = index;
        li.addEventListener('click', () => { selectCharacter(index); });
        if (index === selectedCharacterIndex) li.classList.add('active');
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
function handleAddNewCharacter() {
    const newCharacter = { 
        name: "Новий персонаж", description: "", arc: "",
        _tempId: Date.now() 
    };
    
    currentProjectData.content.characters.push(newCharacter);
    const newIndex = currentProjectData.content.characters.length - 1;
    renderCharacterList();
    selectCharacter(newIndex);
    updateSaveStatus('unsaved'); 

    saveCharactersArray(true)
        .catch(err => {
            logErrorToServer(err, "handleAddNewCharacter (Optimistic Save)");
            showToast("Помилка! Не вдалося створити персонажа.", 'error');
            if (currentProjectData && currentProjectData.content) {
                currentProjectData.content.characters = currentProjectData.content.characters.filter(
                    c => c._tempId !== newCharacter._tempId
                );
            }
            showCharacterEditor(false);
            renderCharacterList();
        });
}
function handleDeleteCharacter() {
    if (selectedCharacterIndex === null) return;
    const characterName = currentProjectData.content.characters[selectedCharacterIndex].name;
    showConfirmModal(`Ви впевнені, що хочете видалити персонажа "${characterName}"?`, async () => {
        currentProjectData.content.characters.splice(selectedCharacterIndex, 1);
        updateSaveStatus('unsaved'); 
        await saveCharactersArray(true); 
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
async function saveCharactersArray(immediate = false) {
    await saveArrayToDb("content.characters", currentProjectData.content.characters, "персонажів", immediate);
}

// === ВКЛАДКА "РОЗДІЛИ" === (Оновлено v1.4.0)

function getStatusIcon(status) {
    switch (status) {
        case "Заплановано": return "🗓️";
        case "В роботі": return "✏️";
        case "Завершено": return "✅";
        case "На редагуванні": return "🔄";
        case "Потребує уваги": return "❓";
        default: return "📝";
    }
}
function renderChapterList() {
    if (!currentProjectData) return;
    chaptersList.innerHTML = ''; 
    currentProjectData.content.chapters.forEach((chapter, index) => {
        const card = document.createElement('div');
        card.className = 'chapter-card';
        card.dataset.index = index;
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('card-drag-handle')) return;
            selectChapter(index);
        });
        if (index === selectedChapterIndex) card.classList.add('active');
        
        const order = index + 1;
        const title = chapter.title || 'Розділ без назви';
        const status = chapter.status || 'Заплановано';
        const icon = getStatusIcon(status);
        const wordCount = chapter.word_count || 0;
        
        let snippet = '';
        let snippetClass = 'card-snippet';
        if (status === 'Заплановано') {
            snippet = chapter.synopsis || 'Немає синопсису...';
            snippetClass = 'card-snippet synopsis'; 
        } else if (chapter.text) {
            // ОНОВЛЕНО v1.4.0: Використовуємо CONFIG
            snippet = chapter.text.substring(0, CONFIG.SNIPPET_LENGTH) + '...'; 
        } else {
            snippet = 'Немає тексту...';
        }
        
        card.innerHTML = `
            <div class="card-header">
                <span>${order}. ${title}</span>
                <span class="card-drag-handle" title="Перетягнути">::</span>
            </div>
            <div class="card-body">
                <div class="card-meta">
                    <span>${icon} ${status}</span>
                    <span>${wordCount} слів</span>
                </div>
                <div class="${snippetClass}">
                    ${snippet}
                </div>
            </div>
        `;
        chaptersList.appendChild(card);
    });
    updateTotalWordCount();
}
function showChapterEditor(show = true) {
    if (show) {
        chapterEditorPane.classList.remove('hidden');
        chapterEditorPlaceholder.classList.add('hidden');
    } else {
        chapterEditorPane.classList.add('hidden');
        chapterEditorPlaceholder.classList.remove('hidden');
        selectedChapterIndex = null;
        chapterCurrentWordCount.textContent = '0 слів';
        renderChapterList(); 
    }
}
function selectChapter(index) {
    selectedChapterIndex = index;
    const chapter = currentProjectData.content.chapters[index];
    if (!chapter) return;
    chapterEditorTitle.textContent = `Редагування "${chapter.title}"`;
    chapterTitleInput.value = chapter.title || '';
    chapterStatusInput.value = chapter.status || 'Заплановано';
    chapterTextInput.value = chapter.text || '';
    chapterSynopsisInput.value = chapter.synopsis || ''; // v1.2.1

    const count = chapter.word_count || countWords(chapter.text || '');
    chapter.word_count = count; 
    chapterCurrentWordCount.textContent = `${count} слів`;
    showChapterEditor(true);
    renderChapterList();
}
function handleAddNewChapter() {
    const newChapter = {
        title: "Новий розділ", status: "Заплановано", text: "",
        synopsis: "", word_count: 0, updated_at: new Date().toISOString(),
        _tempId: Date.now() 
    };

    currentProjectData.content.chapters.push(newChapter);
    const newIndex = currentProjectData.content.chapters.length - 1;
    renderChapterList();
    selectChapter(newIndex);
    updateSaveStatus('unsaved'); 

    saveChaptersArray(true)
        .catch(err => {
            logErrorToServer(err, "handleAddNewChapter (Optimistic Save)");
            showToast("Помилка! Не вдалося створити розділ.", 'error');
            if (currentProjectData && currentProjectData.content) {
                currentProjectData.content.chapters = currentProjectData.content.chapters.filter(
                    c => c._tempId !== newChapter._tempId
                );
            }
            showChapterEditor(false);
            renderChapterList();
        });
}
function handleDeleteChapter() {
    if (selectedChapterIndex === null) return;
    const chapterTitle = currentProjectData.content.chapters[selectedChapterIndex].title;
    showConfirmModal(`Ви впевнені, що хочете видалити розділ "${chapterTitle}"?`, async () => {
        currentProjectData.content.chapters.splice(selectedChapterIndex, 1);
        updateSaveStatus('unsaved'); 
        await saveChaptersArray(true); 
        showChapterEditor(false); 
        renderChapterList();
        updateTotalWordCount();
        renderDashboard(); 
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
    if (field === 'text') {
        const count = countWords(value);
        chapter.word_count = count;
        chapterCurrentWordCount.textContent = `${count} слів`;
    }
    chapter.updated_at = new Date().toISOString();
    
    await saveChaptersArray(); 
    updateSingleChapterCard(selectedChapterIndex);
    updateTotalWordCount();
    renderDashboard(); 
}
function updateSingleChapterCard(index) {
    const chapter = currentProjectData.content.chapters[index];
    if (!chapter) return;
    const card = chaptersList.querySelector(`[data-index="${index}"]`);
    if (!card) return; 
    const order = index + 1;
    const title = chapter.title || 'Розділ без назви';
    const status = chapter.status || 'Заплановано';
    const icon = getStatusIcon(status);
    const wordCount = chapter.word_count || 0;
    let snippet = '';
    let snippetClass = 'card-snippet';
    if (status === 'Заплановано') {
        if(index === selectedChapterIndex) {
             chapterSynopsisInput.value = chapter.synopsis || '';
        }
        snippet = chapter.synopsis || 'Немає синопсису...';
        snippetClass = 'card-snippet synopsis';
    } else if (chapter.text) {
        // ОНОВЛЕНО v1.4.0: Використовуємо CONFIG
        snippet = chapter.text.substring(0, CONFIG.SNIPPET_LENGTH) + '...';
    } else {
        snippet = 'Немає тексту...';
    }
    card.innerHTML = `
        <div class="card-header">
            <span>${order}. ${title}</span>
            <span class="card-drag-handle" title="Перетягнути">::</span>
        </div>
        <div class="card-body">
            <div class="card-meta">
                <span>${icon} ${status}</span>
                <span>${wordCount} слів</span>
            </div>
            <div class="${snippetClass}">
                ${snippet}
            </div>
        </div>
    `;
}
async function saveChaptersArray(immediate = false) {
    await saveArrayToDb("content.chapters", currentProjectData.content.chapters, "розділів", immediate);
}

// === ВКЛАДКА "ЛОКАЦІЇ" === (Без змін v1.4.0)

function renderLocationList() {
    if (!currentProjectData) return;
    locationsList.innerHTML = ''; 
    currentProjectData.content.locations.forEach((location, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${location.name || 'Локація без назви'}`;
        li.dataset.index = index;
        li.addEventListener('click', () => { selectLocation(index); });
        if (index === selectedLocationIndex) li.classList.add('active');
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
function handleAddNewLocation() {
    const newLocation = { 
        name: "Нова локація", description: "",
        _tempId: Date.now() 
    };
    
    currentProjectData.content.locations.push(newLocation);
    const newIndex = currentProjectData.content.locations.length - 1;
    renderLocationList();
    selectLocation(newIndex);
    updateSaveStatus('unsaved'); 

    saveLocationsArray(true)
        .catch(err => {
            logErrorToServer(err, "handleAddNewLocation (Optimistic Save)");
            showToast("Помилка! Не вдалося створити локацію.", 'error');
            if (currentProjectData && currentProjectData.content) {
                currentProjectData.content.locations = currentProjectData.content.locations.filter(
                    c => c._tempId !== newLocation._tempId
                );
            }
            showLocationEditor(false);
            renderLocationList();
        });
}
function handleDeleteLocation() {
    if (selectedLocationIndex === null) return;
    const locationName = currentProjectData.content.locations[selectedLocationIndex].name;
    showConfirmModal(`Ви впевнені, що хочете видалити локацію "${locationName}"?`, async () => {
        currentProjectData.content.locations.splice(selectedLocationIndex, 1);
        updateSaveStatus('unsaved'); 
        await saveLocationsArray(true); 
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
    await saveLocationsArray(); 
    renderLocationList();
}
async function saveLocationsArray(immediate = false) {
    await saveArrayToDb("content.locations", currentProjectData.content.locations, "локацій", immediate);
}

// === ВКЛАДКА "СЮЖЕТНІ ЛІНІЇ" === (Без змін v1.4.0)

function renderPlotlineList() {
    if (!currentProjectData) return;
    plotlinesList.innerHTML = ''; 
    currentProjectData.content.plotlines.forEach((plotline, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${plotline.title || 'Лінія без назви'}`;
        li.dataset.index = index;
        li.addEventListener('click', () => { selectPlotline(index); });
        if (index === selectedPlotlineIndex) li.classList.add('active'); 
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
function handleAddNewPlotline() {
    const newPlotline = { 
        title: "Нова сюжетна лінія", description: "",
        _tempId: Date.now() 
    };

    currentProjectData.content.plotlines.push(newPlotline);
    const newIndex = currentProjectData.content.plotlines.length - 1;
    renderPlotlineList();
    selectPlotline(newIndex);
    updateSaveStatus('unsaved'); 

    savePlotlinesArray(true)
        .catch(err => {
            logErrorToServer(err, "handleAddNewPlotline (Optimistic Save)");
            showToast("Помилка! Не вдалося створити сюжетну лінію.", 'error');
            if (currentProjectData && currentProjectData.content) {
                currentProjectData.content.plotlines = currentProjectData.content.plotlines.filter(
                    c => c._tempId !== newPlotline._tempId
                );
            }
            showPlotlineEditor(false);
            renderPlotlineList();
        });
}
function handleDeletePlotline() {
    if (selectedPlotlineIndex === null) return;
    const plotlineTitle = currentProjectData.content.plotlines[selectedPlotlineIndex].title;
    showConfirmModal(`Ви впевнені, що хочете видалити сюжетну лінію "${plotlineTitle}"?`, async () => {
        currentProjectData.content.plotlines.splice(selectedPlotlineIndex, 1);
        updateSaveStatus('unsaved'); 
        await savePlotlinesArray(true); 
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
    await savePlotlinesArray(); 
    renderPlotlineList();
}
async function savePlotlinesArray(immediate = false) {
    await saveArrayToDb("content.plotlines", currentProjectData.content.plotlines, "сюжетних ліній", immediate);
}


// === СОРТУВАННЯ === (Без змін v1.4.0)

function initSortableLists() {
    if (!currentProjectData) return;
    
    const onSortEnd = async (evt, array, saveFunction, renderFunction) => {
        const { oldIndex, newIndex } = evt;
        const [item] = array.splice(oldIndex, 1);
        array.splice(newIndex, 0, item);
        updateSaveStatus('unsaved'); 
        await saveFunction(true);
        renderFunction();
    };

    new Sortable(chaptersList, {
        animation: 150, ghostClass: 'sortable-ghost', handle: '.card-drag-handle', 
        onEnd: (evt) => onSortEnd(evt, currentProjectData.content.chapters, saveChaptersArray, renderChapterList)
    });
    new Sortable(charactersList, {
        animation: 150, ghostClass: 'sortable-ghost',
        onEnd: (evt) => onSortEnd(evt, currentProjectData.content.characters, saveCharactersArray, renderCharacterList)
    });
    new Sortable(locationsList, {
        animation: 150, ghostClass: 'sortable-ghost',
        onEnd: (evt) => onSortEnd(evt, currentProjectData.content.locations, saveLocationsArray, renderLocationList)
    });
    new Sortable(plotlinesList, {
        animation: 150, ghostClass: 'sortable-ghost',
        onEnd: (evt) => onSortEnd(evt, currentProjectData.content.plotlines, savePlotlinesArray, renderPlotlineList)
    });
}


// === УНІВЕРСАЛЬНА ФУНКЦІЯ ЗБЕРЕЖЕННЯ === (Оновлено v1.4.0)
/**
 * Універсальна функція для збереження масивів
 * @param {boolean} [isSimpleField=false] - (v1.2.0) Чи це просте поле (не масив)
 */
async function saveArrayToDb(field, array, nameForToast, immediate = false, isSimpleField = false) {
    if (!currentProjectID) return;
    
    const valueToSave = array; 
    
    if (!immediate) {
        console.log(`Запит на збереження ${nameForToast}. Негайно: ${immediate}`);
        clearTimeout(saveTimer);
    }
    
    const doSave = async () => {
        updateSaveStatus('saving'); 
        try {
            let valueToSend = valueToSave;

            if (Array.isArray(valueToSave)) {
                valueToSend = valueToSave.map(item => {
                    if (item && typeof item === 'object' && item._tempId) {
                        const { _tempId, ...rest } = item;
                        return rest;
                    }
                    return item;
                });
            }

            const response = await fetch('/save-project-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    projectID: currentProjectID, 
                    field: field, 
                    value: valueToSend 
                })
            });

            const updatedProjectResponse = await fetch(`/get-project-content?projectID=${currentProjectID}`);
            if (!updatedProjectResponse.ok) throw new Error('Не вдалося оновити локальні дані');
            
            // v1.2.1: ВИПРАВЛЕННЯ ПОМИЛКИ
            const freshProjectData = await updatedProjectResponse.json();
            currentProjectData = freshProjectData;
            
            // v1.2.1: Оновлюємо Dashboard
            renderDashboard(); 
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || `Помилка збереження ${nameForToast}`);
            }

            updateSaveStatus('saved'); 
            showToast(`${nameForToast.charAt(0).toUpperCase() + nameForToast.slice(1)} збережено!`, 'success');

        } catch (error) {
            console.error(`Помилка автозбереження ${nameForToast}:`, error);
            showToast(error.message, 'error');
            logErrorToServer(error, "saveArrayToDb"); 
            updateSaveStatus('error'); 
        }
    };

    if (immediate) {
        await doSave();
    } else {
        // ОНОВЛЕНО v1.4.0: Використовуємо CONFIG
        saveTimer = setTimeout(doSave, CONFIG.AUTOSAVE_DELAY); 
    }
}