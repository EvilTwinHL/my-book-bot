// === КОНФІГУРАЦІЯ ДОДАТКУ [v1.4.0 - P11] ===
const CONFIG = {
    APP_VERSION: "1.7.0", // ОНОВЛЕНО v1.7.0
    AUTOSAVE_DELAY: 1500, // ms
    DEFAULT_GOAL_WORDS: 50000,
    SNIPPET_LENGTH: 80, // characters
    TOAST_DURATION: 3000, // ms
    CACHE_KEY_PROJECT: 'opusProjectCache',
    CACHE_DURATION_MIN: 5, 
    HISTORY_DEBOUNCE: 500 // v1.6.0
};

// === ГЛОБАЛЬНІ ЗМІННІ ===
let currentUser = null;
let currentProjectID = null;
/** @type {object | null} Зберігає ВСІ дані поточного проєкту */
let currentProjectData = null; 
let selectedCharacterIndex = null;
let selectedChapterIndex = null;
let selectedLocationIndex = null;
let selectedPlotlineIndex = null;

// ОНОВЛЕНО v1.7.0: Таймер автозбереження
/** @type {{timer: Timeout | null, func: Function | null}} */
let pendingSave = { timer: null, func: null };

/** @type {boolean} v1.2.0: Прапор для P15/P21 */
let hasUnsavedChanges = false;

// v1.6.0: Менеджер Історії (Undo/Redo) [P17]
let historyManager = {
    stack: [],
    pointer: -1,
    currentField: null,
    debounceTimer: null,
    isRestoring: false 
};


// === ЕЛЕМЕНТИ DOM ===
let loginContainer, appContainer, loginInput, loginButton, logoutButton, usernameDisplay,
    projectsContainer, projectsList, createProjectButton,
    spinnerOverlay, toastContainer,
    createEditModal, createEditModalTitle, createEditInput, createEditConfirmBtn, createEditCancelBtn,
    confirmModal, confirmModalMessage, confirmOkBtn, confirmCancelBtn,
    projectsListSkeleton; // v1.5.0

// ЕЛЕМЕНТИ РОБОЧОГО ПРОСТОРУ
let workspaceContainer, workspaceTitle, backToProjectsButton, workspaceNav,
    chatWindow, userInput, sendButton,
    corePremiseInput, coreThemeInput, coreArcInput, coreGoalInput, // v1.4.0
    notesGeneralInput, notesResearchInput,
    versionNumberSpan,
    // v0.8.0
    dashboardProjectTitle, dashboardWriteBtn, dashboardTotalWords,
    dashboardProgressFill, dashboardProgressLabel, dashboardLastUpdated,
    // v1.6.0: Пошук [P22]
    globalSearchInput, searchResultsModal, searchResultsList, searchResultsCloseBtn;

// v1.0.0: КОНТЕКСТНЕ МЕНЮ
let projectContextMenu, contextEditBtn, contextExportBtn, contextDeleteBtn;

// ОНОВЛЕНО v1.7.0: Кнопка збереження
let manualSaveButton, saveStatusDot, saveStatusText, saveStatusSpinner;

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
    projectsListSkeleton = document.getElementById('projects-list-skeleton'); // v1.5.0
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
    
    // ОНОВЛЕНО v1.7.0: Індикатор збереження
    manualSaveButton = document.getElementById('manual-save-button');
    saveStatusDot = document.getElementById('save-status-dot');
    saveStatusText = document.getElementById('save-status-text');
    saveStatusSpinner = document.getElementById('save-status-spinner');

    chatWindow = document.getElementById('chat-window');
    userInput = document.getElementById('userInput');
    sendButton = document.getElementById('sendButton');
    corePremiseInput = document.getElementById('core-premise-input');
    coreThemeInput = document.getElementById('core-theme-input');
    coreArcInput = document.getElementById('core-arc-input');
    coreGoalInput = document.getElementById('core-goal-input'); // v1.4.0
    notesGeneralInput = document.getElementById('notes-general-input');
    notesResearchInput = document.getElementById('notes-research-input');
    dashboardProjectTitle = document.getElementById('dashboard-project-title');
    dashboardWriteBtn = document.getElementById('dashboard-write-btn');
    dashboardTotalWords = document.getElementById('dashboard-total-words');
    dashboardProgressFill = document.getElementById('dashboard-progress-fill');
    dashboardProgressLabel = document.getElementById('dashboard-progress-label');
    dashboardLastUpdated = document.getElementById('dashboard-last-updated');
    
    // v1.6.0: Пошук [P22]
    globalSearchInput = document.getElementById('global-search-input');
    searchResultsModal = document.getElementById('search-results-modal');
    searchResultsList = document.getElementById('search-results-list');
    searchResultsCloseBtn = document.getElementById('search-results-close-btn');

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
    
    // ОНОВЛЕНО v1.7.0: Кнопка збереження
    manualSaveButton.addEventListener('click', triggerManualSave);

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

    // v1.4.0: Слухачі для індикатора збереження
    const inputs = document.querySelectorAll(
        '#core-premise-input, #core-theme-input, #core-arc-input, #core-goal-input, ' + 
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
    
    // v1.6.0: Слухачі для Історії (Undo/Redo) [P17]
    const textareas = document.querySelectorAll(
        'textarea, ' +
        '#character-name-input, #location-name-input, #plotline-title-input, #chapter-title-input'
    );
    textareas.forEach(textarea => {
        textarea.addEventListener('focus', initHistory);
        textarea.addEventListener('blur', clearHistoryListeners);
    });

    // Слухачі для автозбереження
    corePremiseInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    coreThemeInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    coreArcInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
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

    // v1.6.0: Слухачі Пошуку [P22]
    globalSearchInput.addEventListener('keypress', handleGlobalSearch);
    searchResultsCloseBtn.addEventListener('click', () => searchResultsModal.classList.add('hidden'));
}

// === ЛОГІКА НАВІГАЦІЇ === (Без змін v1.7.0)

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
    clearCachedProject(); // v1.5.0 [P5]
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
    clearCachedProject(); // v1.5.0 [P5]
    loadProjects(currentUser); 
}

// v1.5.0: Логіка кешування [P5] (Без змін v1.7.0)
async function openProjectWorkspace(projectID) {
    const cachedData = getCachedProject(projectID);
    if (cachedData) {
        console.log("Завантажено проєкт з кешу (швидке завантаження)");
        currentProjectData = cachedData;
        currentProjectID = projectID; 

        appContainer.classList.add('hidden');
        workspaceContainer.classList.remove('hidden');

        renderWorkspace();
        showTab('dashboard-tab');
        initSortableLists(); 
        updateSaveStatus('saved');
        return; 
    }

    console.log("Завантаження проєкту з сервера (повільне завантаження)");
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

        setCachedProject(projectID, currentProjectData);

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
    coreGoalInput.value = content.wordGoal || ''; // v1.4.0
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


// === ЛОГІКА API (КАРТОТЕКА) === (Без змін v1.7.0)

// v1.5.0: Skeleton Loader [P6]
async function loadProjects(user) {
    projectsList.innerHTML = ''; 
    projectsListSkeleton.classList.remove('hidden');

    try {
        const response = await fetch(`/get-projects?user=${user}`);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Помилка мережі. Перевірте лог сервера.');
        }
        const projects = await response.json();
        
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
    } finally {
        projectsListSkeleton.classList.add('hidden');
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
        
        setCachedProject(currentProjectID, currentProjectData); // v1.5.0 [P5]

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
        
        clearCachedProject(); // v1.5.0 [P5]

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
            setCachedProject(currentProjectID, currentProjectData); // v1.5.0 [P5]
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

// ОНОВЛЕНО v1.7.0: `immediate` параметр додано в `handle...Save`
async function handleSimpleAutoSave(field, value, immediate = false) {
    if (!currentProjectID || !currentProjectData) return;
    
    const fieldName = field.split('.')[1]; 
    
    if (currentProjectData.content[fieldName] === value && fieldName !== 'wordGoal') {
        return; 
    }
    
    currentProjectData.content[fieldName] = value;
    
    try {
        await saveArrayToDb(field, value, "даних", immediate, true);
        if (fieldName === 'wordGoal') {
            renderDashboard();
        }
    } catch (error) {
        // Обробка помилок в saveArrayToDb
    }
}

// === ЛОГІКА API (ЧАТ) === (Без змін v1.7.0)
        
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
        
        setCachedProject(currentProjectID, currentProjectData); // v1.5.0 [P5]

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


// === ДОПОМІЖНІ ФУНКЦІЇ (UI) === (Без змін v1.7.0)

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

// === v1.0.0: КОНТЕКСТНЕ МЕНЮ === (Без змін v1.7.0)

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

// === v1.1.0: ЛОГУВАННЯ ПОМИЛОК === (Без змін v1.7.0)
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

// === v1.3.0: ГАРЯЧІ КЛАВІШІ [P16] === (ОНОВЛЕНО v1.7.0)

function handleGlobalHotkeys(e) {
    const key = e.key.toLowerCase();
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    // ОНОВЛЕНО v1.7.0: Ctrl+S (Викликаємо примусове збереження)
    if (isCtrlOrCmd && key === 's') {
        e.preventDefault(); 
        triggerManualSave();
        return;
    }

    // v1.6.0: Ctrl+Z (Undo) [P17]
    if (isCtrlOrCmd && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
    }

    // v1.6.0: Ctrl+Y / Ctrl+Shift+Z (Redo) [P17]
    if ((isCtrlOrCmd && key === 'y') || (isCtrlOrCmd && e.shiftKey && key === 'z')) {
        e.preventDefault();
        redo();
        return;
    }

    // P16: Клавіша Escape
    if (key === 'escape') {
        // ... (Логіка Escape без змін) ...
        if (!searchResultsModal.classList.contains('hidden')) {
            searchResultsModal.classList.add('hidden');
            return;
        }
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
            case 'characters-tab': if (!characterEditorPane.classList.contains('hidden')) { showCharacterEditor(false); } break;
            case 'chapters-tab':   if (!chapterEditorPane.classList.contains('hidden')) { showChapterEditor(false); } break;
            case 'locations-tab':  if (!locationEditorPane.classList.contains('hidden')) { showLocationEditor(false); } break;
            case 'plotlines-tab':  if (!plotlineEditorPane.classList.contains('hidden')) { showPlotlineEditor(false); } break;
        }
    }
}

// === v1.2.0: ФУНКЦІЯ ІНДИКАТОРА ЗБЕРЕЖЕННЯ === (ОНОВЛЕНО v1.7.0)
/**
 * Оновлює візуальний стан кнопки збереження
 * @param {'saved' | 'unsaved' | 'saving' | 'error'} status 
 */
function updateSaveStatus(status) {
    if (!manualSaveButton) return; 

    // Скидаємо всі класи
    manualSaveButton.classList.remove('saving', 'unsaved', 'error');
    saveStatusText.classList.remove('hidden');
    saveStatusDot.classList.remove('hidden');
    saveStatusSpinner.classList.add('hidden');

    switch (status) {
        case 'saved':
            saveStatusText.textContent = "Збережено";
            hasUnsavedChanges = false;
            window.onbeforeunload = null;
            break;
        case 'unsaved':
            manualSaveButton.classList.add('unsaved');
            saveStatusText.textContent = "Зберегти";
            hasUnsavedChanges = true;
            window.onbeforeunload = () => "У вас є незбережені зміни. Ви впевнені, що хочете піти?";
            break;
        case 'saving':
            manualSaveButton.classList.add('saving');
            saveStatusText.classList.add('hidden'); // Ховаємо текст
            saveStatusDot.classList.add('hidden'); // Ховаємо крапку
            saveStatusSpinner.classList.remove('hidden'); // Показуємо спінер
            hasUnsavedChanges = true; 
            window.onbeforeunload = () => "Іде збереження. Ви впевнені, що хочете піти?";
            break;
        case 'error':
            manualSaveButton.classList.add('error');
            saveStatusText.textContent = "Помилка";
            hasUnsavedChanges = true; 
            window.onbeforeunload = () => "Сталася помилка збереження. Ви впевнені, що хочете піти?";
            break;
    }
}


// === v0.5.1 - ЛІЧИЛЬНИК СЛІВ === (Без змін v1.7.0)

function countWords(text) {
    if (!text || text.trim() === "") { return 0; }
    return text.trim().split(/\s+/).length;
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

// === v0.8.0: DASHBOARD === (Без змін v1.7.0)

function renderDashboard() {
    if (!currentProjectData) return;
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
    const progressPercent = (goalWords > 0) ? Math.min((totalCount / goalWords) * 100, 100) : 0;
    dashboardProgressFill.style.width = `${progressPercent}%`;
    dashboardProgressLabel.textContent = `${Math.floor(progressPercent)}% до мети (${goalWords.toLocaleString('uk-UA')} слів)`;
}


// === ВКЛАДКА "ПЕРСОНАЖІ" === (ОНОВЛЕНО v1.7.0)

function renderCharacterList() {
    // ... (без змін) ...
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
    // ... (без змін) ...
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
    // ... (без змін) ...
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
    // ... (без змін) ...
    const newCharacter = { name: "Новий персонаж", description: "", arc: "", _tempId: Date.now() };
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
                currentProjectData.content.characters = currentProjectData.content.characters.filter(c => c._tempId !== newCharacter._tempId);
            }
            showCharacterEditor(false);
            renderCharacterList();
        });
}
function handleDeleteCharacter() {
    // ... (без змін) ...
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
// ОНОВЛЕНО v1.7.0: `immediate` параметр
async function handleCharacterFieldSave(field, value, immediate = false) {
    if (selectedCharacterIndex === null) return;
    const character = currentProjectData.content.characters[selectedCharacterIndex];
    if (character[field] === value) return; 
    character[field] = value;
    if (field === 'name') {
        characterEditorTitle.textContent = `Редагування "${value}"`;
    }
    await saveCharactersArray(immediate); 
    renderCharacterList();
}
async function saveCharactersArray(immediate = false) {
    await saveArrayToDb("content.characters", currentProjectData.content.characters, "персонажів", immediate);
}

// === ВКЛАДКА "РОЗДІЛИ" === (ОНОВЛЕНО v1.7.0)

function getStatusIcon(status) {
    // ... (без змін) ...
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
    // ... (без змін) ...
    if (!currentProjectData) return;
    chaptersList.innerHTML = ''; 
    currentProjectData.content.chapters.forEach((chapter, index) => {
        const card = document.createElement('div');
        card.className = 'chapter-card';
        card.dataset.index = index;
        card.addEventListener('click', (e) => { if (e.target.classList.contains('card-drag-handle')) return; selectChapter(index); });
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
            snippet = chapter.text.substring(0, CONFIG.SNIPPET_LENGTH) + '...'; 
        } else {
            snippet = 'Немає тексту...';
        }
        card.innerHTML = `<div class="card-header"><span>${order}. ${title}</span><span class="card-drag-handle" title="Перетягнути">::</span></div><div class="card-body"><div class="card-meta"><span>${icon} ${status}</span><span>${wordCount} слів</span></div><div class="${snippetClass}">${snippet}</div></div>`;
        chaptersList.appendChild(card);
    });
    updateTotalWordCount();
}
function showChapterEditor(show = true) {
    // ... (без змін) ...
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
    // ... (без змін) ...
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
    // ... (без змін) ...
    const newChapter = { title: "Новий розділ", status: "Заплановано", text: "", synopsis: "", word_count: 0, updated_at: new Date().toISOString(), _tempId: Date.now() };
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
                currentProjectData.content.chapters = currentProjectData.content.chapters.filter(c => c._tempId !== newChapter._tempId);
            }
            showChapterEditor(false);
            renderChapterList();
        });
}
function handleDeleteChapter() {
    // ... (без змін) ...
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
// ОНОВЛЕНО v1.7.0: `immediate` параметр
async function handleChapterFieldSave(field, value, immediate = false) {
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
    
    await saveChaptersArray(immediate); 
    updateSingleChapterCard(selectedChapterIndex);
    updateTotalWordCount();
    renderDashboard(); 
}
function updateSingleChapterCard(index) {
    // ... (без змін) ...
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
        if(index === selectedChapterIndex) { chapterSynopsisInput.value = chapter.synopsis || ''; }
        snippet = chapter.synopsis || 'Немає синопсису...';
        snippetClass = 'card-snippet synopsis';
    } else if (chapter.text) {
        snippet = chapter.text.substring(0, CONFIG.SNIPPET_LENGTH) + '...';
    } else {
        snippet = 'Немає тексту...';
    }
    card.innerHTML = `<div class="card-header"><span>${order}. ${title}</span><span class="card-drag-handle" title="Перетягнути">::</span></div><div class="card-body"><div class="card-meta"><span>${icon} ${status}</span><span>${wordCount} слів</span></div><div class="${snippetClass}">${snippet}</div></div>`;
}
async function saveChaptersArray(immediate = false) {
    await saveArrayToDb("content.chapters", currentProjectData.content.chapters, "розділів", immediate);
}

// === ВКЛАДКА "ЛОКАЦІЇ" === (ОНОВЛЕНО v1.7.0)

function renderLocationList() {
    // ... (без змін) ...
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
    // ... (без змін) ...
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
    // ... (без змін) ...
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
    // ... (без змін) ...
    const newLocation = { name: "Нова локація", description: "", _tempId: Date.now() };
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
                currentProjectData.content.locations = currentProjectData.content.locations.filter(c => c._tempId !== newLocation._tempId);
            }
            showLocationEditor(false);
            renderLocationList();
        });
}
function handleDeleteLocation() {
    // ... (без змін) ...
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
// ОНОВЛЕНО v1.7.0: `immediate` параметр
async function handleLocationFieldSave(field, value, immediate = false) {
    if (selectedLocationIndex === null) return;
    const location = currentProjectData.content.locations[selectedLocationIndex];
    if (location[field] === value) return; 
    location[field] = value;
    if (field === 'name') {
        locationEditorTitle.textContent = `Редагування "${value}"`;
    }
    await saveLocationsArray(immediate); 
    renderLocationList();
}
async function saveLocationsArray(immediate = false) {
    await saveArrayToDb("content.locations", currentProjectData.content.locations, "локацій", immediate);
}

// === ВКЛАДКА "СЮЖЕТНІ ЛІНІЇ" === (ОНОВЛЕНО v1.7.0)

function renderPlotlineList() {
    // ... (без змін) ...
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
    // ... (без змін) ...
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
    // ... (без змін) ...
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
    // ... (без змін) ...
    const newPlotline = { title: "Нова сюжетна лінія", description: "", _tempId: Date.now() };
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
                currentProjectData.content.plotlines = currentProjectData.content.plotlines.filter(c => c._tempId !== newPlotline._tempId);
            }
            showPlotlineEditor(false);
            renderPlotlineList();
        });
}
function handleDeletePlotline() {
    // ... (без змін) ...
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
// ОНОВЛЕНО v1.7.0: `immediate` параметр
async function handlePlotlineFieldSave(field, value, immediate = false) {
    if (selectedPlotlineIndex === null) return;
    const plotline = currentProjectData.content.plotlines[selectedPlotlineIndex];
    if (plotline[field] === value) return; 
    plotline[field] = value;
    if (field === 'title') { 
        plotlineEditorTitle.textContent = `Редагування "${value}"`;
    }
    await savePlotlinesArray(immediate); 
    renderPlotlineList();
}
async function savePlotlinesArray(immediate = false) {
    await saveArrayToDb("content.plotlines", currentProjectData.content.plotlines, "сюжетних ліній", immediate);
}


// === СОРТУВАННЯ === (Без змін v1.7.0)

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
    new Sortable(chaptersList, { animation: 150, ghostClass: 'sortable-ghost', handle: '.card-drag-handle', onEnd: (evt) => onSortEnd(evt, currentProjectData.content.chapters, saveChaptersArray, renderChapterList) });
    new Sortable(charactersList, { animation: 150, ghostClass: 'sortable-ghost', onEnd: (evt) => onSortEnd(evt, currentProjectData.content.characters, saveCharactersArray, renderCharacterList) });
    new Sortable(locationsList, { animation: 150, ghostClass: 'sortable-ghost', onEnd: (evt) => onSortEnd(evt, currentProjectData.content.locations, saveLocationsArray, renderLocationList) });
    new Sortable(plotlinesList, { animation: 150, ghostClass: 'sortable-ghost', onEnd: (evt) => onSortEnd(evt, currentProjectData.content.plotlines, savePlotlinesArray, renderPlotlineList) });
}


// === УНІВЕРСАЛЬНА ФУНКЦІЯ ЗБЕРЕЖЕННЯ === (ОНОВЛЕНО v1.7.0)

/**
 * Універсальна функція для збереження
 * @param {string} field - Поле для оновлення (напр., 'content.chapters')
 * @param {*} value - Нове значення (масив або примітив)
 * @param {string} nameForToast - Назва для тосту (напр., 'розділів')
 * @param {boolean} [immediate=false] - Зберегти негайно (true) чи з затримкою (false)
 * @param {boolean} [isSimpleField=false] - (v1.2.0) Чи це просте поле (не масив)
 */
async function saveArrayToDb(field, value, nameForToast, immediate = false, isSimpleField = false) {
    if (!currentProjectID) return;
    
    // 1. Очищуємо будь-який *попередній* запланований виклик
    clearTimeout(pendingSave.timer);
    pendingSave.func = null;
    pendingSave.timer = null;

    // 2. Створюємо функцію, яка виконає збереження
    const doSave = async () => {
        updateSaveStatus('saving'); 
        try {
            let valueToSend = value;

            if (Array.isArray(valueToSend)) {
                valueToSend = valueToSend.map(item => {
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
            
            const freshProjectData = await updatedProjectResponse.json();
            currentProjectData = freshProjectData;
            
            setCachedProject(currentProjectID, freshProjectData); // v1.5.0 [P5]
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
        } finally {
            // Очищуємо, оскільки ми завершили
            pendingSave.func = null;
            pendingSave.timer = null;
        }
    };

    // 3. Виконуємо негайно або плануємо
    if (immediate) {
        await doSave();
    } else {
        pendingSave.func = doSave;
        pendingSave.timer = setTimeout(doSave, CONFIG.AUTOSAVE_DELAY); 
    }
}


// === v1.5.0: ФУНКЦІЇ КЕШУВАННЯ [P5] === (Без змін v1.7.0)

function setCachedProject(projectID, data) {
    try {
        const cacheEntry = { timestamp: Date.now(), projectID: projectID, data: data };
        sessionStorage.setItem(CONFIG.CACHE_KEY_PROJECT, JSON.stringify(cacheEntry));
        console.log(`Проєкт ${projectID} збережено в кеш.`);
    } catch (error) {
        console.error("Помилка збереження в sessionStorage (можливо, переповнено):", error);
        clearCachedProject();
    }
}
function getCachedProject(projectID) {
    const cached = sessionStorage.getItem(CONFIG.CACHE_KEY_PROJECT);
    if (!cached) return null;
    try {
        const cacheEntry = JSON.parse(cached);
        if (cacheEntry.projectID !== projectID) {
            clearCachedProject();
            return null;
        }
        const ageInMinutes = (Date.now() - cacheEntry.timestamp) / (1000 * 60);
        if (ageInMinutes > CONFIG.CACHE_DURATION_MIN) {
            clearCachedProject();
            return null;
        }
        return cacheEntry.data;
    } catch (error) {
        clearCachedProject();
        return null;
    }
}
function clearCachedProject() {
    console.log("Кеш проєкту очищено.");
    sessionStorage.removeItem(CONFIG.CACHE_KEY_PROJECT);
}


// === v1.6.0: ФУНКЦІЇ ПОШУКУ [P22] === (Без змін v1.7.0)

function handleGlobalSearch(e) {
    if (e.key !== 'Enter') return;
    const query = globalSearchInput.value.trim();
    if (query.length < 2) {
        showToast("Введіть щонайменше 2 символи для пошуку", 'info');
        return;
    }
    const results = searchInProject(query);
    renderSearchResults(results, query);
    searchResultsModal.classList.remove('hidden');
}
function searchInProject(query) {
    const results = [];
    if (!currentProjectData || !currentProjectData.content) return results;
    const q = query.toLowerCase();
    const content = currentProjectData.content;
    
    // ... (Логіка пошуку без змін) ...
    content.chapters.forEach((item, index) => {
        let match = false; let snippet = '';
        if (item.title?.toLowerCase().includes(q)) { match = true; snippet = item.synopsis || item.text || ''; } 
        else if (item.synopsis?.toLowerCase().includes(q)) { match = true; snippet = item.synopsis; } 
        else if (item.text?.toLowerCase().includes(q)) { match = true; snippet = item.text; }
        if (match) { results.push({ type: 'Розділ', typeKey: 'chapter', title: item.title || 'Розділ без назви', snippet: snippet.substring(0, CONFIG.SNIPPET_LENGTH * 2) + '...', index: index }); }
    });
    content.characters.forEach((item, index) => {
        let match = false; let snippet = '';
        if (item.name?.toLowerCase().includes(q)) { match = true; snippet = item.description || item.arc || ''; } 
        else if (item.description?.toLowerCase().includes(q)) { match = true; snippet = item.description; } 
        else if (item.arc?.toLowerCase().includes(q)) { match = true; snippet = item.arc; }
        if (match) { results.push({ type: 'Персонаж', typeKey: 'character', title: item.name || 'Персонаж без назви', snippet: snippet.substring(0, CONFIG.SNIPPET_LENGTH * 2) + '...', index: index }); }
    });
    content.locations.forEach((item, index) => {
        let match = false; let snippet = '';
        if (item.name?.toLowerCase().includes(q)) { match = true; snippet = item.description || ''; } 
        else if (item.description?.toLowerCase().includes(q)) { match = true; snippet = item.description; }
        if (match) { results.push({ type: 'Локація', typeKey: 'location', title: item.name || 'Локація без назви', snippet: snippet.substring(0, CONFIG.SNIPPET_LENGTH * 2) + '...', index: index }); }
    });
    content.plotlines.forEach((item, index) => {
        let match = false; let snippet = '';
        if (item.title?.toLowerCase().includes(q)) { match = true; snippet = item.description || ''; } 
        else if (item.description?.toLowerCase().includes(q)) { match = true; snippet = item.description; }
        if (match) { results.push({ type: 'Сюжетна лінія', typeKey: 'plotline', title: item.title || 'Лінія без назви', snippet: snippet.substring(0, CONFIG.SNIPPET_LENGTH * 2) + '...', index: index }); }
    });
    if (content.notes?.toLowerCase().includes(q)) { results.push({ type: 'Нотатки', typeKey: 'note', title: 'Загальні нотатки', snippet: content.notes.substring(0, CONFIG.SNIPPET_LENGTH * 2) + '...', index: 0 }); }
    if (content.research?.toLowerCase().includes(q)) { results.push({ type: 'Нотатки', typeKey: 'note', title: 'Дослідження', snippet: content.research.substring(0, CONFIG.SNIPPET_LENGTH * 2) + '...', index: 1 }); }
    return results;
}
function renderSearchResults(results, query) {
    searchResultsList.innerHTML = '';
    if (results.length === 0) {
        searchResultsList.innerHTML = '<p>Збігів не знайдено.</p>';
        return;
    }
    results.forEach(res => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.dataset.type = res.typeKey;
        item.dataset.index = res.index;
        item.innerHTML = `<div class="search-result-type">${res.type}</div><h5>${res.title}</h5><div class="search-result-snippet">${res.snippet.replace(new RegExp(query, 'gi'), (match) => `<b>${match}</b>`)}</div>`;
        item.addEventListener('click', () => handleSearchResultClick(res.typeKey, res.index));
        searchResultsList.appendChild(item);
    });
}
function handleSearchResultClick(typeKey, index) {
    searchResultsModal.classList.add('hidden');
    globalSearchInput.value = ''; 
    switch (typeKey) {
        case 'chapter': showTab('chapters-tab'); selectChapter(index); break;
        case 'character': showTab('characters-tab'); selectCharacter(index); break;
        case 'location': showTab('locations-tab'); selectLocation(index); break;
        case 'plotline': showTab('plotlines-tab'); selectPlotline(index); break;
        case 'note': showTab('notes-tab'); if (index === 0) notesGeneralInput.focus(); else notesResearchInput.focus(); break;
    }
}


// === v1.6.0: ФУНКЦІЇ ІСТОРІЇ (UNDO/REDO) [P17] === (Без змін v1.7.0)

function initHistory(e) {
    const field = e.target;
    historyManager.stack = [field.value];
    historyManager.pointer = 0;
    historyManager.currentField = field;
    field.addEventListener('input', handleHistoryInput);
}
function clearHistoryListeners(e) {
    const field = e.target;
    field.removeEventListener('input', handleHistoryInput);
}
function handleHistoryInput(e) {
    if (historyManager.isRestoring) return;
    clearTimeout(historyManager.debounceTimer);
    const value = e.target.value;
    historyManager.debounceTimer = setTimeout(() => {
        recordHistory(value);
    }, CONFIG.HISTORY_DEBOUNCE);
}
function recordHistory(value) {
    if (!historyManager.currentField) return;
    if (historyManager.pointer < historyManager.stack.length - 1) {
        historyManager.stack = historyManager.stack.slice(0, historyManager.pointer + 1);
    }
    historyManager.stack.push(value);
    historyManager.pointer++;
}
function undo() {
    if (!historyManager.currentField || historyManager.pointer <= 0) { return; }
    historyManager.isRestoring = true;
    historyManager.pointer--;
    const value = historyManager.stack[historyManager.pointer];
    historyManager.currentField.value = value;
    historyManager.currentField.dispatchEvent(new Event('input', { bubbles: true }));
    historyManager.currentField.dispatchEvent(new Event('change', { bubbles: true }));
    historyManager.isRestoring = false;
}
function redo() {
    if (!historyManager.currentField || historyManager.pointer >= historyManager.stack.length - 1) { return; }
    historyManager.isRestoring = true;
    historyManager.pointer++;
    const value = historyManager.stack[historyManager.pointer];
    historyManager.currentField.value = value;
    historyManager.currentField.dispatchEvent(new Event('input', { bubbles: true }));
    historyManager.currentField.dispatchEvent(new Event('change', { bubbles: true }));
    historyManager.isRestoring = false;
}


// === ОНОВЛЕНО v1.7.0: ФУНКЦІЯ ПРИМУСОВОГО ЗБЕРЕЖЕННЯ ===

/**
 * Примусово зберігає будь-які поточні зміни
 */
function triggerManualSave() {
    // 1. Перевіряємо, чи є взагалі що зберігати
    if (!hasUnsavedChanges && !pendingSave.timer) {
        showToast("Все збережено", "info");
        return;
    }

    // 2. "Коммітимо" зміни з поля, яке зараз у фокусі (якщо таке є)
    // Це оновить `currentProjectData` і викличе `saveArrayToDb`
    const activeEl = document.activeElement;
    if (activeEl && activeEl.blur && activeEl !== document.body) {
        activeEl.blur(); 
    }
    
    // 3. `blur()` вище *міг* створити новий `pendingSave.func`.
    // Якщо він є, ми його скасовуємо і виконуємо негайно.
    if (pendingSave.func) {
        clearTimeout(pendingSave.timer);
        console.log("Примусове виконання збереження, що очікувало...");
        pendingSave.func(); // Викликаємо збереження негайно
        pendingSave.func = null;
        pendingSave.timer = null;
    } else if (hasUnsavedChanges) {
        // Це випадок, коли `blur` не спрацював (напр, фокус на `body`), 
        // але `hasUnsavedChanges` = true. Це не має статися, але про всяк випадок.
        console.warn("Manual save triggered, but no pending save function found.");
        // Ми не знаємо, *що* зберігати, тому просто показуємо статус
        updateSaveStatus('unsaved');
    }
}