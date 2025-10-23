// === ГЛОБАЛЬНІ ЗМІННІ ===
const APP_VERSION = "1.1.0"; // ОНОВЛЕНО: v1.1.0

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
    versionNumberSpan,
    // v0.8.0
    dashboardProjectTitle, dashboardWriteBtn, dashboardTotalWords,
    dashboardProgressFill, dashboardProgressLabel, dashboardLastUpdated;

// v1.0.0: КОНТЕКСТНЕ МЕНЮ
let projectContextMenu, contextEditBtn, contextExportBtn, contextDeleteBtn;

// ЕЛЕМЕНТИ (ВКЛАДКА ПЕРСОНАЖІВ)
let charactersList, addCharacterBtn, characterEditorPane,
    characterEditorPlaceholder, characterEditorTitle, characterNameInput,
    characterDescInput, characterArcInput, deleteCharacterBtn;

// ЕЛЕМЕНТИ (ВКЛАДКА РОЗДІЛІВ)
let chaptersList, addChapterBtn, chapterEditorPane,
    chapterEditorPlaceholder, chapterEditorTitle, chapterTitleInput,
    chapterStatusInput, chapterTextInput, deleteChapterBtn,
    chaptersTotalWordCount, chapterCurrentWordCount; 

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
    chatWindow = document.getElementById('chat-window');
    userInput = document.getElementById('userInput');
    sendButton = document.getElementById('sendButton');
    corePremiseInput = document.getElementById('core-premise-input');
    coreThemeInput = document.getElementById('core-theme-input');
    coreArcInput = document.getElementById('core-arc-input');
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

    corePremiseInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    coreThemeInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    coreArcInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    notesGeneralInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    notesResearchInput.addEventListener('blur', (e) => handleSimpleAutoSave(e.target.dataset.field, e.target.value));
    dashboardWriteBtn.addEventListener('click', () => { showTab('chapters-tab'); });
    
    // v1.0.0: Закриття контекстного меню
    document.addEventListener('click', (e) => {
        if (!projectContextMenu.classList.contains('hidden')) {
            hideProjectContextMenu();
        }
    });
    
    addCharacterBtn.addEventListener('click', handleAddNewCharacter);
    deleteCharacterBtn.addEventListener('click', handleDeleteCharacter);
    characterNameInput.addEventListener('blur', (e) => handleCharacterFieldSave('name', e.target.value));
    characterDescInput.addEventListener('blur', (e) => handleCharacterFieldSave('description', e.target.value));
    characterArcInput.addEventListener('blur', (e) => handleCharacterFieldSave('arc', e.target.value));

    addChapterBtn.addEventListener('click', handleAddNewChapter);
    deleteChapterBtn.addEventListener('click', handleDeleteChapter);
    chapterTitleInput.addEventListener('blur', (e) => handleChapterFieldSave('title', e.target.value));
    chapterStatusInput.addEventListener('change', (e) => handleChapterFieldSave('status', e.target.value)); 
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

    } catch (error) {
        console.error("Помилка при відкритті проєкту:", error);
        showToast(error.message, 'error');
        logErrorToServer(error, "openProjectWorkspace"); // v1.1.0
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


// === ЛОГІКА API (КАРТОТЕКА) ===

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
        logErrorToServer(error, "loadProjects"); // v1.1.0
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
        showToast('Проєкт створено!', 'success'); 

    } catch (error) { 
        console.error('Помилка при створенні проєкту:', error);
        showToast(error.message, 'error');
        logErrorToServer(error, "handleCreateProject"); // v1.1.0
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
        logErrorToServer(error, "handleDeleteProject"); // v1.1.0
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
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Сервер не зміг оновити назву.');
        }
        
        if (currentProjectID === projectID) {
            currentProjectData.title = newTitle;
            workspaceTitle.textContent = newTitle;
        }
        
        loadProjects(currentUser); 
        showToast('Назву оновлено.', 'success'); 

    } catch (error) {
        console.error('Помилка при оновленні назви:', error);
        showToast(error.message, 'error');
        logErrorToServer(error, "handleEditTitle"); // v1.1.0
    } finally {
        hideSpinner(); 
    }
}

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
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Помилка збереження');
            }
            showToast('Збережено!', 'success');

        } catch (error) {
            console.error('Помилка автозбереження:', error);
            showToast(error.message, 'error');
            logErrorToServer(error, "handleSimpleAutoSave"); // v1.1.0
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
        logErrorToServer(error, "sendMessage"); // v1.1.0
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

    // ОНОВЛЕНО v1.1.0: Логуємо помилки на сервер
    if (type === 'error') {
        logErrorToServer(new Error(message), "showToast");
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

// === v1.0.0: КОНТЕКСТНЕ МЕНЮ ===

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

// === v1.1.0: ЛОГУВАННЯ ПОМИЛОК ===
/**
 * Відправляє помилки на сервер для логування
 * @param {Error} error - Об'єкт помилки
 * @param {string} contextName - Назва функції, де сталася помилка
 */
async function logErrorToServer(error, contextName) {
    console.error(`[${contextName}]`, error); // Залишаємо лог в консолі
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

// Глобальні обробники помилок
window.onerror = (message, source, lineno, colno, error) => {
    logErrorToServer(error || new Error(message), 'window.onerror');
};
window.onunhandledrejection = (event) => {
    logErrorToServer(event.reason || new Error('Unhandled rejection'), 'window.onunhandledrejection');
};

// === v0.5.1 - ЛІЧИЛЬНИК СЛІВ ===

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

// === v0.8.0: DASHBOARD ===

function renderDashboard() {
    if (!currentProjectData) return;
    const GOAL_WORDS = 50000; 
    const totalCount = currentProjectData.totalWordCount || 0;
    
    dashboardProjectTitle.textContent = currentProjectData.title || "Без назви";
    dashboardTotalWords.textContent = totalCount.toLocaleString('uk-UA'); 

    if (currentProjectData.updatedAt) {
        const date = new Date(currentProjectData.updatedAt._seconds * 1000);
        dashboardLastUpdated.textContent = date.toLocaleString('uk-UA');
    } else {
        dashboardLastUpdated.textContent = 'Ще не зберігалось';
    }
    const progressPercent = Math.min((totalCount / GOAL_WORDS) * 100, 100);
    dashboardProgressFill.style.width = `${progressPercent}%`;
    dashboardProgressLabel.textContent = `${Math.floor(progressPercent)}% до мети (${GOAL_WORDS.toLocaleString('uk-UA')} слів)`;
}


// === ВКЛАДКА "ПЕРСОНАЖІ" ===

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
async function handleAddNewCharacter() {
    const newCharacter = { name: "Новий персонаж", description: "", arc: "" };
    currentProjectData.content.characters.push(newCharacter);
    await saveCharactersArray(true); 
    const newIndex = currentProjectData.content.characters.length - 1;
    selectCharacter(newIndex);
}
function handleDeleteCharacter() {
    if (selectedCharacterIndex === null) return;
    const characterName = currentProjectData.content.characters[selectedCharacterIndex].name;
    showConfirmModal(`Ви впевнені, що хочете видалити персонажа "${characterName}"?`, async () => {
        currentProjectData.content.characters.splice(selectedCharacterIndex, 1);
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

// === ВКЛАДКА "РОЗДІЛИ" ===

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
            snippet = chapter.text.substring(0, 80) + '...'; 
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
    const count = chapter.word_count || countWords(chapter.text || '');
    chapter.word_count = count; 
    chapterCurrentWordCount.textContent = `${count} слів`;
    showChapterEditor(true);
    renderChapterList();
}
async function handleAddNewChapter() {
    const newChapter = {
        title: "Новий розділ", status: "Заплановано", text: "",
        synopsis: "", word_count: 0, updated_at: new Date().toISOString()
    };
    currentProjectData.content.chapters.push(newChapter);
    await saveChaptersArray(true); 
    const newIndex = currentProjectData.content.chapters.length - 1;
    selectChapter(newIndex);
}
function handleDeleteChapter() {
    if (selectedChapterIndex === null) return;
    const chapterTitle = currentProjectData.content.chapters[selectedChapterIndex].title;
    showConfirmModal(`Ви впевнені, що хочете видалити розділ "${chapterTitle}"?`, async () => {
        currentProjectData.content.chapters.splice(selectedChapterIndex, 1);
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
        snippet = chapter.synopsis || 'Немає синопсису...';
        snippetClass = 'card-snippet synopsis';
    } else if (chapter.text) {
        snippet = chapter.text.substring(0, 80) + '...';
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

// === ВКЛАДКА "ЛОКАЦІЇ" ===

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
async function handleAddNewLocation() {
    const newLocation = { name: "Нова локація", description: "" };
    currentProjectData.content.locations.push(newLocation);
    await saveLocationsArray(true); 
    const newIndex = currentProjectData.content.locations.length - 1;
    selectLocation(newIndex);
}
function handleDeleteLocation() {
    if (selectedLocationIndex === null) return;
    const locationName = currentProjectData.content.locations[selectedLocationIndex].name;
    showConfirmModal(`Ви впевнені, що хочете видалити локацію "${locationName}"?`, async () => {
        currentProjectData.content.locations.splice(selectedLocationIndex, 1);
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

// === ВКЛАДКА "СЮЖЕТНІ ЛІНІЇ" ===

function renderPlotlineList() {
    if (!currentProjectData) return;
    plotlinesList.innerHTML = ''; 
    currentProjectData.content.plotlines.forEach((plotline, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${plotline.title || 'Лінія без назви'}`;
        li.dataset.index = index;
        li.addEventListener('click', () => { selectPlotline(index); });
        if (index === selectedPlotlineIndex) li.classList.add('active'); // ВИПРАВЛЕНО
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
    const newPlotline = { title: "Нова сюжетна лінія", description: "" };
    currentProjectData.content.plotlines.push(newPlotline);
    await savePlotlinesArray(true); 
    const newIndex = currentProjectData.content.plotlines.length - 1;
    selectPlotline(newIndex);
}
function handleDeletePlotline() {
    if (selectedPlotlineIndex === null) return;
    const plotlineTitle = currentProjectData.content.plotlines[selectedPlotlineIndex].title;
    showConfirmModal(`Ви впевнені, що хочете видалити сюжетну лінію "${plotlineTitle}"?`, async () => {
        currentProjectData.content.plotlines.splice(selectedPlotlineIndex, 1);
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
    if (field === 'title') { // ВИПРАВЛЕНО (було 'name')
        plotlineEditorTitle.textContent = `Редагування "${value}"`;
    }
    await savePlotlinesArray(); 
    renderPlotlineList();
}
async function savePlotlinesArray(immediate = false) {
    await saveArrayToDb("content.plotlines", currentProjectData.content.plotlines, "сюжетних ліній", immediate);
}


// === СОРТУВАННЯ ===

function initSortableLists() {
    if (!currentProjectData) return;
    new Sortable(chaptersList, {
        animation: 150, ghostClass: 'sortable-ghost', handle: '.card-drag-handle', 
        onEnd: async (evt) => {
            const { oldIndex, newIndex } = evt;
            const [item] = currentProjectData.content.chapters.splice(oldIndex, 1);
            currentProjectData.content.chapters.splice(newIndex, 0, item);
            await saveChaptersArray(true);
            renderChapterList();
        }
    });
    new Sortable(charactersList, {
        animation: 150, ghostClass: 'sortable-ghost',
        onEnd: async (evt) => {
            const { oldIndex, newIndex } = evt;
            const [item] = currentProjectData.content.characters.splice(oldIndex, 1);
            currentProjectData.content.characters.splice(newIndex, 0, item);
            await saveCharactersArray(true);
            renderCharacterList();
        }
    });
    new Sortable(locationsList, {
        animation: 150, ghostClass: 'sortable-ghost',
        onEnd: async (evt) => {
            const { oldIndex, newIndex } = evt;
            const [item] = currentProjectData.content.locations.splice(oldIndex, 1);
            currentProjectData.content.locations.splice(newIndex, 0, item);
            await saveLocationsArray(true);
            renderLocationList();
        }
    });
    new Sortable(plotlinesList, {
        animation: 150, ghostClass: 'sortable-ghost',
        onEnd: async (evt) => {
            const { oldIndex, newIndex } = evt;
            const [item] = currentProjectData.content.plotlines.splice(oldIndex, 1);
            currentProjectData.content.plotlines.splice(newIndex, 0, item);
            await savePlotlinesArray(true);
            renderPlotlineList();
        }
    });
}


// === УНІВЕРСАЛЬНА ФУНКЦІЯ ЗБЕРЕЖЕННЯ ===

async function saveArrayToDb(field, array, nameForToast, immediate = false) {
    if (!currentProjectID) return;
    console.log(`Запит на збереження ${nameForToast}. Негайно: ${immediate}`);
    clearTimeout(saveTimer); 

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

            const updatedProjectResponse = await fetch(`/get-project-content?projectID=${currentProjectID}`);
            if (!updatedProjectResponse.ok) throw new Error('Не вдалося оновити локальні дані');
            currentProjectData = await updatedProjectResponse.json();
            renderDashboard(); 
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || `Помилка збереження ${nameForToast}`);
            }
            showToast(`${nameForToast.charAt(0).toUpperCase() + nameForToast.slice(1)} збережено!`, 'success');

        } catch (error) {
            console.error(`Помилка автозбереження ${nameForToast}:`, error);
            showToast(error.message, 'error');
            logErrorToServer(error, "saveArrayToDb"); // v1.1.0
        }
    };

    if (immediate) {
        await doSave();
    } else {
        saveTimer = setTimeout(doSave, 1000); 
    }
}