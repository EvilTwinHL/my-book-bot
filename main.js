// === V2.5.2: ІМПОРТ FIREBASE (для Vite/ES Modules) ===
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore'; 

// v2.4.0: SortableJS (якщо ви не перейшли на npm)
if (typeof Sortable === 'undefined') {
    console.error("Sortable.js не знайдено. Drag & Drop вимкнено.");
}


// === КОНФІГУРАЦІЯ ДОДАТКУ [v1.4.0 - P11] ===
const CONFIG = {
    APP_VERSION: "2.5.7", // ОНОВЛЕНО v2.5.7 (Enhanced Navigation: Quick Access, Contextual Navigation)
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
let currentTab = 'chapters'; // v2.5.7: Відстеження активної вкладки

// v1.7.0: Таймер автозбереження
/** @type {{timer: Timeout | null, func: Function | null}} */
let pendingSave = { timer: null, func: null };

/** @type {boolean} v1.2.0: Прапор для P15/P21 */
let hasUnsavedChanges = false;

// v1.6.0: Менеджер Історії
const historyManager = {
    /** @type {HTMLInputElement | HTMLTextAreaElement | null} */
    currentField: null,
    /** @type {string[]} */
    stack: [],
    pointer: -1,
    isRestoring: false,
    debounceTimer: null
};

// === v1.5.0: Керування кешем ===
const projectCache = {
    set: (key, data) => {
        try {
            // v2.5.6: Переконуємось, що data існує перед збереженням
            if (!data || !data.content) throw new Error("Немає даних для кешування.");

            const item = {
                data: data,
                timestamp: new Date().getTime()
            };
            sessionStorage.setItem(key, JSON.stringify(item));
            console.log("Проєкт", key, "збережено в кеш.");
        } catch (e) {
            console.warn("Помилка збереження в кеш:", e);
            sessionStorage.removeItem(key);
        }
    },
    /**
     * @param {string} key 
     * @returns {object | null}
     */
    get: (key) => {
        try {
            const itemStr = sessionStorage.getItem(key);
            if (!itemStr) { return null; }
            
            const item = JSON.parse(itemStr);
            const now = new Date().getTime();
            const expiryTime = CONFIG.CACHE_DURATION_MIN * 60 * 1000;
            
            // v2.5.6 CRITICAL FIX: Перевірка прострочення АБО пошкодження структури
            if (now - item.timestamp > expiryTime || !item.data || !item.data.content) {
                console.log("Кеш", key, "прострочено або пошкоджено. Видалення...");
                sessionStorage.removeItem(key);
                return null;
            }
            console.log("Проєкт", key, "завантажено з кешу.");
            return item.data;
        } catch (e) {
            console.warn("Помилка читання з кешу, кеш очищено:", e);
            sessionStorage.removeItem(key); // Очистити пошкоджений кеш
            return null;
        }
    },
    clear: (key) => {
        sessionStorage.removeItem(key);
        console.log("Кеш", key, "очищено.");
    },
    clearAll: () => {
        sessionStorage.clear();
        console.log("Весь кеш sessionStorage очищено.");
    }
};

// === v1.1.0: Елементи UI === (Оновлено v2.5.7)
let ui = {};
/**
 * Зв'язує всі DOM-елементи з об'єктом `ui` для легкого доступу.
 */
function bindUIElements() {
    ui = {
        spinner: document.getElementById('spinner-overlay'),
        toastContainer: document.getElementById('toast-container'),
        
        // --- Модальні вікна ---
        createEditModal: document.getElementById('create-edit-modal'),
        createEditModalTitle: document.getElementById('create-edit-modal-title'),
        createEditInput: document.getElementById('create-edit-input'),
        createEditConfirmBtn: document.getElementById('create-edit-confirm-btn'),
        createEditCancelBtn: document.getElementById('create-edit-cancel-btn'),
        
        confirmModal: document.getElementById('confirm-modal'),
        confirmModalTitle: document.getElementById('confirm-modal-title'),
        confirmModalText: document.getElementById('confirm-modal-text'),
        confirmModalConfirmBtn: document.getElementById('confirm-modal-confirm-btn'),
        confirmModalCancelBtn: document.getElementById('confirm-modal-cancel-btn'),

        searchResultsModal: document.getElementById('search-results-modal'),
        searchResultsList: document.getElementById('search-results-list'),
        searchResultsCloseBtn: document.getElementById('search-results-close-btn'),
        
        // --- Автентифікація ---
        authContainer: document.getElementById('auth-container'),
        signInBtn: document.getElementById('sign-in-btn'),
        signOutBtn: document.getElementById('sign-out-btn'),
        userDisplay: document.getElementById('user-display'),

        // --- Головний контейнер ---
        workspaceContainer: document.getElementById('workspace-container'),
        
        // --- Панель проєктів ---
        projectsContainer: document.getElementById('projects-container'),
        projectsList: document.getElementById('projects-list'),
        createProjectBtn: document.getElementById('create-project-btn'),
        
        // --- Контекстне меню проєкту ---
        projectContextMenu: document.getElementById('project-context-menu'),
        contextEditBtn: document.getElementById('context-edit-btn'),
        contextExportBtn: document.getElementById('context-export-btn'),
        contextDeleteBtn: document.getElementById('context-delete-btn'),

        // --- Робоча область: Навігація v2.5.7 ---
        workspaceHeader: document.getElementById('workspace-header'),
        workspaceTitle: document.getElementById('workspace-title'),
        workspaceTitleInput: document.getElementById('workspace-title-input'),
        saveStatusIndicator: document.getElementById('save-status-indicator'),
        saveStatusText: document.getElementById('save-status-text'),
        saveStatusSpinner: document.getElementById('save-status-spinner'),
        backToProjectsBtn: document.getElementById('back-to-projects-btn'),
        globalSearchInput: document.getElementById('global-search-input'),
        
        breadcrumbs: document.getElementById('breadcrumbs'), // v2.5.7 NEW
        breadcrumbProjects: document.getElementById('breadcrumb-projects'), // v2.5.7 NEW
        breadcrumbCurrent: document.getElementById('breadcrumb-current'), // v2.5.7 NEW
        quickAccessBar: document.getElementById('quick-access'), // v2.5.7 NEW
        navProgress: document.getElementById('nav-progress'), // v2.5.7 NEW

        workspaceNav: document.getElementById('workspace-nav'),
        
        // --- Вкладки ---
        tabs: {
            chapters: document.getElementById('chapters-tab'),
            characters: document.getElementById('characters-tab'),
            locations: document.getElementById('locations-tab'),
            plotlines: document.getElementById('plotlines-tab'),
            world: document.getElementById('world-tab'),
            chat: document.getElementById('chat-tab')
        },
        tabButtons: {
            chapters: document.querySelector('button[data-tab="chapters-tab"]'),
            characters: document.querySelector('button[data-tab="characters-tab"]'),
            locations: document.querySelector('button[data-tab="locations-tab"]'),
            plotlines: document.querySelector('button[data-tab="plotlines-tab"]'),
            world: document.querySelector('button[data-tab="world-tab"]'),
            chat: document.querySelector('button[data-tab="chat-tab"]')
        },

        // --- Розділи (Chapters) ---
        chaptersList: document.getElementById('chapters-list'),
        addChapterBtn: document.getElementById('add-chapter-btn'),
        chapterEditorPane: document.getElementById('chapter-editor-pane'),
        chapterEditorPlaceholder: document.getElementById('chapter-editor-placeholder'),
        chapterTitleInput: document.getElementById('chapter-title'),
        chapterStatusSelect: document.getElementById('chapter-status'),
        chapterTextarea: document.getElementById('chapter-text'),
        chapterSynopsisTextarea: document.getElementById('chapter-synopsis'),
        chapterStats: document.getElementById('chapter-stats'),
        chapterDeleteBtn: document.getElementById('chapter-delete-btn'),
        totalWordCountDisplay: document.getElementById('total-word-count'),
        wordGoalDisplay: document.getElementById('word-goal-display'),
        wordGoalProgress: document.getElementById('word-goal-progress'),
        
        // v2.5.7: Контекстна навігація Розділів
        chapterNavigation: document.getElementById('chapter-navigation'),
        prevChapterBtn: document.getElementById('prev-chapter-btn'),
        nextChapterBtn: document.getElementById('next-chapter-btn'),
        chapterCounter: document.getElementById('chapter-counter'),
        
        // --- Персонажі (Characters) ---
        charactersList: document.getElementById('characters-list'),
        addCharacterBtn: document.getElementById('add-character-btn'),
        characterEditorPane: document.getElementById('character-editor-pane'),
        characterEditorPlaceholder: document.getElementById('character-editor-placeholder'),
        characterNameInput: document.getElementById('character-name'),
        characterDescTextarea: document.getElementById('character-description'),
        characterArcTextarea: document.getElementById('character-arc'),
        characterDeleteBtn: document.getElementById('character-delete-btn'),
        
        // v2.5.7: Контекстна навігація Персонажів
        characterNavigation: document.getElementById('character-navigation'),
        prevCharacterBtn: document.getElementById('prev-character-btn'),
        nextCharacterBtn: document.getElementById('next-character-btn'),
        characterCounter: document.getElementById('character-counter'),

        // --- Локації (Locations) ---
        locationsList: document.getElementById('locations-list'),
        addLocationBtn: document.getElementById('add-location-btn'),
        locationEditorPane: document.getElementById('location-editor-pane'),
        locationEditorPlaceholder: document.getElementById('location-editor-placeholder'),
        locationNameInput: document.getElementById('location-name'),
        locationDescTextarea: document.getElementById('location-description'),
        locationDeleteBtn: document.getElementById('location-delete-btn'),
        
        // v2.5.7: Контекстна навігація Локацій
        locationNavigation: document.getElementById('location-navigation'),
        prevLocationBtn: document.getElementById('prev-location-btn'),
        nextLocationBtn: document.getElementById('next-location-btn'),
        locationCounter: document.getElementById('location-counter'),
        
        // --- Сюжетні лінії (Plotlines) ---
        plotlinesList: document.getElementById('plotlines-list'),
        addPlotlineBtn: document.getElementById('add-plotline-btn'),
        plotlineEditorPane: document.getElementById('plotline-editor-pane'),
        plotlineEditorPlaceholder: document.getElementById('plotline-editor-placeholder'),
        plotlineTitleInput: document.getElementById('plotline-title'),
        plotlineDescTextarea: document.getElementById('plotline-description'),
        plotlineDeleteBtn: document.getElementById('plotline-delete-btn'),
        
        // v2.5.7: Контекстна навігація Сюжетних ліній
        plotlineNavigation: document.getElementById('plotline-navigation'),
        prevPlotlineBtn: document.getElementById('prev-plotline-btn'),
        nextPlotlineBtn: document.getElementById('next-plotline-btn'),
        plotlineCounter: document.getElementById('plotline-counter'),
        
        // --- Світ (World) ---
        premiseTextarea: document.getElementById('premise-textarea'),
        themeTextarea: document.getElementById('theme-textarea'),
        mainArcTextarea: document.getElementById('main-arc-textarea'),
        wordGoalInput: document.getElementById('word-goal-input'),
        notesTextarea: document.getElementById('notes-textarea'),
        researchTextarea: document.getElementById('research-textarea'),
        
        // --- Чат (Chat) ---
        chatWindow: document.getElementById('chat-window'),
        userInput: document.getElementById('userInput'),
        sendButton: document.getElementById('sendButton'),
        
        // ДОДАНО v2.3.0: Опції контексту чату
        chatContextOptions: {
            world: document.getElementById('chat-include-world'),
            chapters: document.getElementById('chat-include-chapters'),
            characters: document.getElementById('chat-include-characters'),
            locations: document.getElementById('chat-include-locations'),
            plotlines: document.getElementById('chat-include-plotlines')
        },
        
        // --- Підвал ---
        versionNumber: document.getElementById('version-number')
    };
    console.log("Елементи UI зв'язані.");
}

// === v1.1.0: Обробка помилок ===
/**
 * @param {Error | string} error
 * @param {string} [context]
 */
function handleError(error, context = "Невідома помилка") {
    console.error(`[${context}]:`, error);
    let message = (error instanceof Error) ? error.message : String(error);
    
    // v1.1.0: Логування на сервері
    fetch('/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            message: message, 
            stack: (error instanceof Error) ? error.stack : 'N/A', 
            context: context, 
            user: currentUser ? currentUser.uid : 'anonymous',
            project: currentProjectID || 'N/A'
        })
    }).catch(err => console.error("Не вдалося залогувати помилку на сервер:", err));
    
    // v1.1.0: Не показуємо тост, якщо це помилка автентифікації при завантаженні
    if (context === "auth-check") {
        return;
    }
    
    showToast(`Помилка: ${message}`, 'error');
}

/**
 * @param {string} message
 * @param {'info' | 'error' | 'success'} type
 */
function showToast(message, type = 'info') {
    if (!ui.toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    ui.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10); 

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (ui.toastContainer.contains(toast)) {
                 ui.toastContainer.removeChild(toast);
            }
        }, 500);
    }, CONFIG.TOAST_DURATION);
}

// === v1.1.0: Управління станом UI ===

function showSpinner(message = "Завантаження...") {
    console.log(message); 
    if (ui.spinner) ui.spinner.classList.remove('hidden');
}

function hideSpinner() {
    if (ui.spinner) ui.spinner.classList.add('hidden');
}

/**
 * @param {string} view 
 */
function showView(view) {
    if (ui.authContainer) ui.authContainer.classList.add('hidden');
    if (ui.projectsContainer) ui.projectsContainer.classList.add('hidden');
    if (ui.workspaceContainer) ui.workspaceContainer.classList.add('hidden');

    if (view === 'auth' && ui.authContainer) {
        ui.authContainer.classList.remove('hidden');
    } else if (view === 'projects' && ui.projectsContainer) {
        ui.projectsContainer.classList.remove('hidden');
        if (ui.breadcrumbs) ui.breadcrumbs.classList.add('hidden'); // v2.5.7
        if (ui.quickAccessBar) ui.quickAccessBar.classList.add('hidden'); // v2.5.7
    } else if (view === 'workspace' && ui.workspaceContainer) {
        ui.workspaceContainer.classList.remove('hidden');
        if (ui.breadcrumbs) ui.breadcrumbs.classList.remove('hidden'); // v2.5.7
        if (ui.quickAccessBar) ui.quickAccessBar.classList.remove('hidden'); // v2.5.7
        // v2.5.7: Оновлюємо хлібні крихти при вході в простір
        updateBreadcrumbs(); 
    }
}

/**
 * @param {string} tabId 
 */
function switchTab(tabId) {
    Object.values(ui.tabs).forEach(tab => tab?.classList.remove('active'));
    Object.values(ui.tabButtons).forEach(btn => btn?.classList.remove('active'));
    
    const tabName = tabId.replace('-tab', '');
    currentTab = tabName; // v2.5.7: Оновлення активної вкладки

    const tabToShow = ui.tabs[tabName];
    const buttonToActivate = ui.tabButtons[tabName];
    
    if (tabToShow) {
        tabToShow.classList.add('active');
    }
    if (buttonToActivate) {
        buttonToActivate.classList.add('active');
    }
    
    updateBreadcrumbs(); // v2.5.7: Оновлення хлібних крихт
    
    // v2.5.7: Скидання контекстної навігації при зміні вкладки
    hideChapterEditor();
    hideCharacterEditor();
    hideLocationEditor();
    hidePlotlineEditor();
}

/**
 * v2.5.7: Оновлення хлібних крихт
 */
function updateBreadcrumbs() {
    if (!ui.breadcrumbs || !ui.breadcrumbCurrent || !currentProjectData) return;

    const tabMap = {
        chapters: 'Розділи',
        characters: 'Персонажі',
        locations: 'Локації',
        plotlines: 'Сюжет',
        world: 'Світ',
        chat: 'Чат (Опус)'
    };
    
    const currentName = tabMap[currentTab] || 'Робоча область';
    
    ui.breadcrumbCurrent.textContent = currentName;

    if (ui.breadcrumbProjects) {
        ui.breadcrumbProjects.textContent = currentProjectData.title || 'Проєкт';
        ui.breadcrumbProjects.removeEventListener('click', handleBackToProjects);
        ui.breadcrumbProjects.addEventListener('click', handleBackToProjects);
    }
}

/**
 * @param {string} title
 * @param {string} text
 * @returns {Promise<boolean>} 
 */
function showConfirmModal(title, text) {
    return new Promise(resolve => {
        if (!ui.confirmModal) return resolve(false);

        ui.confirmModalTitle.textContent = title;
        ui.confirmModalText.textContent = text;
        ui.confirmModal.classList.remove('hidden');

        const confirmHandler = () => {
            ui.confirmModal.classList.add('hidden');
            cleanup();
            resolve(true);
        };

        const cancelHandler = () => {
            ui.confirmModal.classList.add('hidden');
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            ui.confirmModalConfirmBtn.removeEventListener('click', confirmHandler);
            ui.confirmModalCancelBtn.removeEventListener('click', cancelHandler);
            document.removeEventListener('keydown', escapeHandler);
        };
        
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                cancelHandler();
            }
        };

        ui.confirmModalConfirmBtn.addEventListener('click', confirmHandler);
        ui.confirmModalCancelBtn.addEventListener('click', cancelHandler);
        document.addEventListener('keydown', escapeHandler);
    });
}

/**
 * @param {string} title
 * @param {string} [initialValue='']
 * @returns {Promise<string | null>}
 */
function showCreateEditModal(title, initialValue = '') {
    return new Promise(resolve => {
        if (!ui.createEditModal) return resolve(null);
        
        ui.createEditModalTitle.textContent = title;
        ui.createEditInput.value = initialValue;
        ui.createEditModal.classList.remove('hidden');
        ui.createEditInput.focus();
        ui.createEditInput.select();

        const confirmHandler = () => {
            const value = ui.createEditInput.value.trim();
            if (value) {
                ui.createEditModal.classList.add('hidden');
                cleanup();
                resolve(value);
            } else {
                showToast("Назва не може бути порожньою.", "error");
            }
        };

        const cancelHandler = () => {
            ui.createEditModal.classList.add('hidden');
            cleanup();
            resolve(null);
        };
        
        const keyHandler = (e) => {
            if (e.key === 'Enter') {
                confirmHandler();
            } else if (e.key === 'Escape') {
                cancelHandler();
            }
        };

        const cleanup = () => {
            ui.createEditConfirmBtn.removeEventListener('click', confirmHandler);
            ui.createEditCancelBtn.removeEventListener('click', cancelHandler);
            ui.createEditInput.removeEventListener('keydown', keyHandler);
        };

        ui.createEditConfirmBtn.addEventListener('click', confirmHandler);
        ui.createEditCancelBtn.addEventListener('click', cancelHandler);
        ui.createEditInput.addEventListener('keydown', keyHandler);
    });
}

/**
 * @param {'saved' | 'saving' | 'error' | 'unsaved'} status
 */
function setSaveStatus(status) {
    if (!ui.saveStatusIndicator) return;

    ui.saveStatusIndicator.classList.remove('status-saved', 'status-saving', 'status-error', 'status-unsaved');
    ui.saveStatusSpinner?.classList.add('hidden');
    hasUnsavedChanges = false; 

    switch (status) {
        case 'saved':
            ui.saveStatusIndicator.classList.add('status-saved');
            ui.saveStatusText.textContent = 'Збережено';
            break;
        case 'saving':
            ui.saveStatusIndicator.classList.add('status-saving');
            ui.saveStatusText.textContent = 'Збереження...';
            ui.saveStatusSpinner?.classList.remove('hidden');
            break;
        case 'unsaved':
            ui.saveStatusIndicator.classList.add('status-unsaved');
            ui.saveStatusText.textContent = 'Зберегти';
            hasUnsavedChanges = true;
            break;
        case 'error':
            ui.saveStatusIndicator.classList.add('status-error');
            ui.saveStatusText.textContent = 'Помилка';
            hasUnsavedChanges = true; // v1.2.0: Дозволяємо повторну спробу
            break;
    }
}

// === v2.5.2: Ініціалізація Firebase ===
let auth, provider, firestore;

function initializeFirebase() {
    try {
        // v2.5.2: Використовуємо глобальний window.firebaseConfig, переданий з index.html
        const firebaseConfig = window.firebaseConfig; 
        
        if (!firebaseConfig || !firebaseConfig.apiKey) {
            throw new Error("firebaseConfig не знайдено або неповний.");
        }
        
        // Викликаємо імпортований об'єкт firebase
        const app = firebase.initializeApp(firebaseConfig);
        
        // v2.5.2: Тепер доступ до auth та firestore йде через app
        auth = app.auth();
        provider = new firebase.auth.GoogleAuthProvider();
        firestore = app.firestore(); 
        
        console.log("Firebase ініціалізовано.");
        setupAuthObserver();
    } catch (error) {
        handleError(error, "firebase-init");
        showToast("Критична помилка: Не вдалося завантажити Firebase.", "error");
    }
}

// === v1.1.0: Логіка Автентифікації ===

function setupAuthObserver() {
    if (!auth) {
        handleError("Auth не ініціалізовано.", "setupAuthObserver");
        return;
    }
    
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            if (ui.userDisplay) ui.userDisplay.textContent = `Вітаємо, ${user.displayName || user.email}`;
            if (ui.signOutBtn) ui.signOutBtn.classList.remove('hidden');
            loadUserProjects();
            showView('projects');
        } else {
            currentUser = null;
            currentProjectID = null;
            currentProjectData = null;
            if (ui.userDisplay) ui.userDisplay.textContent = '';
            if (ui.signOutBtn) ui.signOutBtn.classList.add('hidden');
            hideSpinner();
            showView('auth');
            projectCache.clearAll();
        }
    }, error => {
        handleError(error, "auth-check");
    });
}

function signIn() {
    if (!auth || !provider) {
        handleError("Firebase Auth не ініціалізовано.", "sign-in");
        return;
    }
    
    auth.signInWithPopup(provider)
        .then(result => {
            console.log("Успішний вхід (Popup):", result.user.displayName);
        })
        .catch(error => {
            if (error.code !== 'auth/popup-closed-by-user') {
                 handleError(error, "sign-in-popup");
            }
            hideSpinner();
        });
}

function signOut() {
    if (!auth) return;
    auth.signOut().then(() => {
        console.log("Користувач вийшов.");
    }).catch(error => {
        handleError(error, "sign-out");
    });
}

// === v1.1.0: Логіка Проєктів (Головна) === 

/**
 * v2.0.0: Логіка завантаження проєктів повністю переписана для Firestore
 */
async function loadUserProjects() {
    if (!currentUser) return;
    showSpinner("Завантаження проєктів...");
    
    // v1.5.0: Використовуємо скелетони
    if (ui.projectsList) ui.projectsList.innerHTML = '<div class="skeleton-item"></div><div class="skeleton-item"></div><div class="skeleton-item"></div>';

    try {
        const response = await fetch(`/get-projects?user=${currentUser.uid}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP помилка! Статус: ${response.status}`);
        }

        const projects = await response.json();
        
        if (ui.projectsList) {
            if (projects.length === 0) {
                ui.projectsList.innerHTML = '<p class="empty-list-info">У вас ще немає проєктів. Натисніть "Створити проєкт", щоб почати.</p>';
            } else {
                ui.projectsList.innerHTML = ''; // Очищуємо скелетони
                projects.forEach(project => {
                    const item = document.createElement('div');
                    item.className = 'project-item';
                    item.dataset.id = project.id;
                    
                    item.innerHTML = `
                        <h3>${escapeHTML(project.title)}</h3>
                        <p>Слів: ${project.totalWordCount || 0}</p>
                        <p>Оновлено: ${new Date(project.updatedAt).toLocaleString('uk-UA')}</p>
                    `;
                    item.addEventListener('click', () => openProject(project.id));
                    item.addEventListener('contextmenu', (e) => showProjectContextMenu(e, project.id, project.title));
                    ui.projectsList.appendChild(item);
                });
            }
        }
    } catch (error) {
        handleError(error, "load-projects");
        if (ui.projectsList) ui.projectsList.innerHTML = '<p class="empty-list-info error-info">Не вдалося завантажити список проєктів. Спробуйте оновити сторінку.</p>';
    } finally {
        hideSpinner();
    }
}

/**
 * v2.0.0: Логіка створення проєкту повністю переписана для Firestore
 */
async function createProject() {
    if (!currentUser) return;

    const title = await showCreateEditModal("Створити новий проєкт", "Нова книга");
    if (!title) return;

    showSpinner("Створення проєкту...");
    try {
        const response = await fetch('/create-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title, user: currentUser.uid }) 
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP помилка! Статус: ${response.status}`);
        }

        const newProject = await response.json();
        
        currentProjectID = newProject.id;
        // v2.5.6: Гарантуємо, що масиви існують при створенні
        currentProjectData = { 
            ...newProject.data, 
            content: { 
                ...(newProject.data.content || {}), 
                chapters: newProject.data.content?.chapters || [],
                characters: newProject.data.content?.characters || [],
                locations: newProject.data.content?.locations || [],
                plotlines: newProject.data.content?.plotlines || [],
            },
            chatHistory: newProject.data.chatHistory || [],
        };
        
        projectCache.set(currentProjectID, currentProjectData); 
        
        loadWorkspace();
        showView('workspace');
        showToast(`Проєкт "${title}" створено!`, 'success');
        
        loadUserProjects();

    } catch (error) {
        handleError(error, "create-project");
    } finally {
        hideSpinner();
    }
}

/**
 * v2.0.0: Логіка видалення проєкту повністю переписана для Firestore
 */
async function deleteProject(projectID, projectTitle) {
    const confirmed = await showConfirmModal(
        "Видалити проєкт?",
        `Ви впевнені, що хочете назавжди видалити "${projectTitle}"? Цю дію неможливо скасувати.`
    );

    if (!confirmed) return;

    showSpinner(`Видалення "${projectTitle}"...`);
    try {
        const response = await fetch('/delete-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectID: projectID })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP помилка! Статус: ${response.status}`);
        }

        showToast(`Проєкт "${projectTitle}" видалено.`, 'success');
        projectCache.clear(projectID); 
        loadUserProjects(); 
        
    } catch (error) {
        handleError(error, "delete-project");
    } finally {
        hideSpinner();
    }
}

/**
 * v2.0.0: Логіка редагування назви переписана
 */
async function editProjectTitle(projectID, oldTitle) {
    const newTitle = await showCreateEditModal("Змінити назву проєкту", oldTitle);
    
    if (!newTitle || newTitle === oldTitle) return;

    showSpinner("Оновлення назви...");
    try {
        const response = await fetch('/update-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectID: projectID, newTitle: newTitle })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP помилка! Статус: ${response.status}`);
        }
        
        showToast("Назву оновлено.", 'success');
        loadUserProjects(); 
        
        const cachedData = projectCache.get(projectID);
        if (cachedData) {
            cachedData.title = newTitle;
            projectCache.set(projectID, cachedData);
        }

    } catch (error) {
        handleError(error, "edit-title");
    } finally {
        hideSpinner();
    }
}

/**
 * v2.0.0: Логіка експорту переписана
 */
async function exportProject(projectID, projectTitle) {
    showSpinner(`Експорт "${projectTitle}"...`);
    try {
        const response = await fetch(`/export-project?projectID=${projectID}`, {
            method: 'GET'
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(errorData || `HTTP помилка! Статус: ${response.status}`);
        }

        const textContent = await response.text();
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        
        const contentDisposition = response.headers.get('content-disposition');
        let filename = `${projectTitle || 'export'}.txt`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+?)"/);
            if (filenameMatch?.length > 1) {
                filename = filenameMatch[1];
            }
        }
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("Експорт завершено.", "success");

    } catch (error) {
        handleError(error, "export-project");
    } finally {
        hideSpinner();
    }
}


// === v1.1.0: Контекстне меню проєкту ===
let contextMenuProjectID = null;
let contextMenuProjectTitle = null;

function showProjectContextMenu(e, projectID, projectTitle) {
    e.preventDefault();
    if (!ui.projectContextMenu) return;
    
    contextMenuProjectID = projectID;
    contextMenuProjectTitle = projectTitle;

    // v1.4.0: Позиціонування відносно курсора
    const x = e.clientX;
    const y = e.clientY;
    
    ui.projectContextMenu.style.left = `${x}px`;
    ui.projectContextMenu.style.top = `${y}px`;
    ui.projectContextMenu.classList.remove('hidden');

    // Обробник для закриття меню
    const closeMenuHandler = (event) => {
        if (!ui.projectContextMenu.contains(event.target)) {
            ui.projectContextMenu.classList.add('hidden');
            document.removeEventListener('click', closeMenuHandler);
        }
    };
    document.addEventListener('click', closeMenuHandler);
}

/**
 * v2.5.7: Обробник для повернення до списку проєктів (використовується в хлібних крихтах)
 */
function handleBackToProjects(e) {
    e.preventDefault();
    if (hasUnsavedChanges) {
        triggerManualSave(); // v1.7.0: Зберігаємо перед виходом
    }
    currentProjectID = null;
    currentProjectData = null;
    showView('projects');
    loadUserProjects(); // Оновлюємо список
}

// === v1.1.0: Завантаження робочої області ===

/**
 * v2.0.0: Логіка відкриття проєкту повністю переписана
 */
async function openProject(projectID) {
    showSpinner("Відкриття проєкту...");
    currentProjectID = projectID;
    
    // v2.5.6 FIX: Використовуємо оновлений кеш-метод з додатковою перевіркою
    const cachedData = projectCache.get(projectID); 
    
    if (cachedData) {
        console.log("Проєкт завантажено з кешу sessionStorage.");
        currentProjectData = cachedData;
        loadWorkspace();
        showView('workspace');
        hideSpinner();
        // v1.5.0: Запускаємо фонову синхронізацію, щоб оновити кеш
        syncProjectInBackground(projectID);
        return;
    }

    // Якщо в кеші немає
    try {
        const response = await fetch(`/get-project-content?projectID=${projectID}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP помилка! Статус: ${response.status}`);
        }

        const freshData = await response.json();
        
        // v2.5.6: Гарантуємо, що масиви існують після завантаження з сервера
        currentProjectData = {
            ...freshData,
            content: { 
                ...(freshData.content || {}),
                chapters: freshData.content?.chapters || [],
                characters: freshData.content?.characters || [],
                locations: freshData.content?.locations || [],
                plotlines: freshData.content?.plotlines || [],
            },
            chatHistory: freshData.chatHistory || [],
        };

        projectCache.set(projectID, currentProjectData); 
        
        loadWorkspace();
        showView('workspace');
        
    } catch (error) {
        handleError(error, "open-project");
        currentProjectID = null;
        showView('projects'); 
    } finally {
        hideSpinner();
    }
}

/**
 * v1.5.0: Фонова синхронізація 
 */
async function syncProjectInBackground(projectID) {
    if (projectID !== currentProjectID) {
        return; 
    }
    
    console.log(`[Sync]: Починаю фонову синхронізацію для ${projectID}...`);
    try {
        const response = await fetch(`/get-project-content?projectID=${projectID}`);
        if (!response.ok) {
            throw new Error("Не вдалося синхронізувати");
        }
        const freshData = await response.json();
        
        // v1.7.0: Перевірка на unsaved changes перед оновленням
        if (hasUnsavedChanges) {
            console.warn("[Sync]: Відміна синхронізації, оскільки є незбережені зміни.");
            return;
        }

        // v2.5.6: Нормалізуємо дані з сервера перед оновленням
        currentProjectData = {
            ...freshData,
            content: { 
                ...(freshData.content || {}),
                chapters: freshData.content?.chapters || [],
                characters: freshData.content?.characters || [],
                locations: freshData.content?.locations || [],
                plotlines: freshData.content?.plotlines || [],
            },
            chatHistory: freshData.chatHistory || [],
        };

        projectCache.set(projectID, currentProjectData);
        console.log("[Sync]: Проєкт синхронізовано та кеш оновлено.");
        
        // v1.5.0: Оновлюємо UI, лише якщо користувач нічого не редагує
        const activeEl = document.activeElement;
        const isEditing = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA';
        
        if (!isEditing) {
            console.log("[Sync]: Оновлюю UI...");
            loadWorkspace();
            showToast("Дані проєкту синхронізовано.", "info");
        } else {
            console.log("[Sync]: Користувач редагує, UI не оновлено.");
        }
        
    } catch (error) {
        console.error("[Sync] Помилка фонової синхронізації:", error);
        showToast("Помилка синхронізації. Ваші дані можуть бути застарілими.", "error");
    }
}

/**
 * v2.0.0: Заповнює робочу область даними з `currentProjectData`
 */
function loadWorkspace() {
    if (!currentProjectData) {
        handleError("Спроба завантажити робочу область без даних.", "load-workspace");
        showView('projects');
        return;
    }
    
    // Скидання стану
    selectedChapterIndex = null;
    selectedCharacterIndex = null;
    selectedLocationIndex = null;
    selectedPlotlineIndex = null;
    setSaveStatus('saved');
    resetHistory();

    const { title, content, chatHistory } = currentProjectData;

    // --- Заголовок ---
    if (ui.workspaceTitle) ui.workspaceTitle.textContent = title;
    if (ui.workspaceTitleInput) ui.workspaceTitleInput.value = title;
    
    // --- Вкладка: Розділи ---
    renderChaptersList();
    hideChapterEditor();
    
    // --- Вкладка: Персонажі ---
    renderCharactersList();
    hideCharacterEditor();
    
    // --- Вкладка: Локації ---
    renderLocationsList();
    hideLocationEditor();
    
    // --- Вкладка: Сюжет ---
    renderPlotlinesList();
    hidePlotlineEditor();

    // --- Вкладка: Світ ---
    if (ui.premiseTextarea) ui.premiseTextarea.value = content.premise || '';
    if (ui.themeTextarea) ui.themeTextarea.value = content.theme || '';
    if (ui.mainArcTextarea) ui.mainArcTextarea.value = content.mainArc || '';
    if (ui.wordGoalInput) ui.wordGoalInput.value = content.wordGoal || CONFIG.DEFAULT_GOAL_WORDS;
    if (ui.notesTextarea) ui.notesTextarea.value = content.notes || '';
    if (ui.researchTextarea) ui.researchTextarea.value = content.research || '';

    // --- Вкладка: Чат ---
    renderChatHistory(chatHistory);

    // --- Статистика ---
    updateTotalWordCount();

    // --- Навігація ---
    switchTab('chapters-tab');
    
    // v1.6.0: Очистити пошук
    if (ui.globalSearchInput) ui.globalSearchInput.value = '';

    // v2.4.0: Ініціалізація Drag & Drop
    initializeSortableLists(); 
    
    // v2.5.7: Сховати індикатори прогресу
    if (ui.navProgress) ui.navProgress.classList.add('hidden'); 
}


// === v1.1.0: Логіка Автозбереження ===

/**
 * v2.0.0: Повністю переписано для нової структури
 * @param {string} field - Поле для збереження (напр., 'content.chapters', 'content.premise')
 * @param {any} value - Нове значення
 */
function scheduleSave(field, value) {
    setSaveStatus('unsaved');
    
    // Очистити попередній таймер, якщо він є
    if (pendingSave.timer) {
        clearTimeout(pendingSave.timer);
        console.log("Попереднє збереження скасовано, нове заплановано.");
    }
    
    // Створюємо функцію збереження
    const saveFunction = async () => {
        setSaveStatus('saving');
        
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
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP помилка! Статус: ${response.status}`);
            }

            // v2.5.5 CRITICAL FIX: Ми повинні оновити кеш повним об'єктом,
            // який містить щойно збережені зміни.
            projectCache.set(currentProjectID, currentProjectData);
            
            setSaveStatus('saved');
            console.log(`Збережено: ${field}`);
            
            // v2.0.0: Якщо ми оновили розділи, оновлюємо загальну к-ть слів
            if (field === 'content.chapters') {
                updateTotalWordCount();
                // ... і оновлюємо список проєктів у фоні, щоб оновити там лічильник
                loadUserProjects();
            }

        } catch (error) {
            handleError(error, "schedule-save");
            setSaveStatus('error');
        }
        
        pendingSave.timer = null;
        pendingSave.func = null;
    };

    // Зберігаємо функцію та запускаємо таймер
    pendingSave.func = saveFunction;
    pendingSave.timer = setTimeout(saveFunction, CONFIG.AUTOSAVE_DELAY);
}

// === v1.1.0: Логіка Вкладок (CRUD) ===

// --- Утиліти ---

/**
 * @param {string} html
 */
function escapeHTML(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
}

/**
 * @param {string} text
 * @param {number} length
 */
function getSnippet(text, length = CONFIG.SNIPPET_LENGTH) {
    if (!text || text.trim() === '') {
        return "<i>(Немає опису)</i>";
    }
    const snippet = escapeHTML(text).substring(0, length);
    return text.length > length ? snippet + "..." : snippet;
}

/**
 * v2.4.0: Drag & Drop
 * @param {number} index
 * @param {'chapters' | 'characters' | 'locations' | 'plotlines'} type
 * @param {number} direction
 */
function moveItemInArray(index, type, direction) {
    const list = currentProjectData?.content?.[type];
    if (!list) return;
    
    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= list.length) {
        return; 
    }
    
    const [item] = list.splice(index, 1);
    list.splice(newIndex, 0, item);
    
    scheduleSave(`content.${type}`, list);
    
    // Перемальовуємо список
    if (type === 'chapters') {
        renderChaptersList();
        selectChapter(newIndex);
    } else if (type === 'characters') {
        renderCharactersList();
        selectCharacter(newIndex);
    } else if (type === 'locations') {
        renderLocationsList();
        selectLocation(newIndex);
    } else if (type === 'plotlines') {
        renderPlotlinesList();
        selectPlotline(newIndex);
    }
}

// === v2.4.0: ЛОГІКА DRAG & DROP (Sortable.js) ===
/**
 * Ініціалізує Drag & Drop для всіх списків за допомогою SortableJS.
 */
function initializeSortableLists() {
    // Перевіряємо, чи підключено бібліотеку
    if (typeof Sortable === 'undefined') {
        return;
    }

    // Централізована функція, яка оновлює модель даних після перетягування
    const onSortHandler = (event, type) => {
        const oldIndex = event.oldIndex;
        const newIndex = event.newState;
        
        if (oldIndex === newIndex) return;

        const list = currentProjectData?.content?.[type];
        if (!list) return;
        
        // Sortable.js вже перемістив елемент в DOM,
        // нам потрібно лише синхронізувати JS-масив:
        const [movedItem] = list.splice(oldIndex, 1);
        list.splice(newIndex, 0, movedItem);
        
        scheduleSave(`content.${type}`, list);

        // Невеликий таймаут, щоб дати Sortable.js завершити DOM-операції
        // та оновити підсвічування активного елемента (якщо потрібно)
        setTimeout(() => {
            if (type === 'chapters') renderChaptersList();
            if (type === 'characters') renderCharactersList();
            if (type === 'locations') renderLocationsList();
            if (type === 'plotlines') renderPlotlinesList();
        }, 50);
    };


    // Налаштування для кожного списку
    if (ui.chaptersList) new Sortable(ui.chaptersList, {
        group: 'shared',
        animation: 150,
        handle: '.drag-handle',
        onEnd: (event) => onSortHandler(event, 'chapters')
    });
    if (ui.charactersList) new Sortable(ui.charactersList, {
        group: 'shared',
        animation: 150,
        handle: '.drag-handle',
        onEnd: (event) => onSortHandler(event, 'characters')
    });
    if (ui.locationsList) new Sortable(ui.locationsList, {
        group: 'shared',
        animation: 150,
        handle: '.drag-handle',
        onEnd: (event) => onSortHandler(event, 'locations')
    });
    if (ui.plotlinesList) new Sortable(ui.plotlinesList, {
        group: 'shared',
        animation: 150,
        handle: '.drag-handle',
        onEnd: (event) => onSortHandler(event, 'plotlines')
    });

    console.log("Drag & Drop ініціалізовано.");
}

// v2.5.7: Логіка контекстної навігації (Prev/Next)
/**
 * @param {'chapter' | 'character' | 'location' | 'plotline'} type
 * @param {number} newIndex
 * @param {number} total
 */
function updateContextualNavigation(type, newIndex, total) {
    const index = newIndex; 
    const isEditing = index !== null;
    
    // Карта елементів
    const elements = {
        chapter: {
            nav: ui.chapterNavigation, counter: ui.chapterCounter,
            prevBtn: ui.prevChapterBtn, nextBtn: ui.nextChapterBtn,
            select: selectChapter, list: currentProjectData?.content?.chapters
        },
        character: {
            nav: ui.characterNavigation, counter: ui.characterCounter,
            prevBtn: ui.prevCharacterBtn, nextBtn: ui.nextCharacterBtn,
            select: selectCharacter, list: currentProjectData?.content?.characters
        },
        location: {
            nav: ui.locationNavigation, counter: ui.locationCounter,
            prevBtn: ui.prevLocationBtn, nextBtn: ui.nextLocationBtn,
            select: selectLocation, list: currentProjectData?.content?.locations
        },
        plotline: {
            nav: ui.plotlineNavigation, counter: ui.plotlineCounter,
            prevBtn: ui.prevPlotlineBtn, nextBtn: ui.nextPlotlineBtn,
            select: selectPlotline, list: currentProjectData?.content?.plotlines
        },
    };

    const uiMap = elements[type];
    if (!uiMap || !uiMap.nav) return;

    if (!isEditing || total === 0) {
        uiMap.nav.classList.add('hidden');
        return;
    }
    
    // 1. Показуємо панель
    uiMap.nav.classList.remove('hidden');

    // 2. Оновлюємо лічильник
    const singularName = { chapter: 'Розділ', character: 'Персонаж', location: 'Локація', plotline: 'Сюжет' }[type];
    if (uiMap.counter) {
        uiMap.counter.textContent = `${singularName} ${index + 1} з ${total}`;
    }

    // 3. Управління кнопками
    if (uiMap.prevBtn) {
        uiMap.prevBtn.disabled = (index <= 0);
        // Обробник додається в DOMContentLoaded
    }
    if (uiMap.nextBtn) {
        uiMap.nextBtn.disabled = (index >= total - 1);
        // Обробник додається в DOMContentLoaded
    }
}

// --- РОЗДІЛИ (Chapters) ---

function renderChaptersList() {
    // v2.5.4 FIX: Використання опціонального чейнінгу та || [] для гарантії масиву
    const chapters = currentProjectData?.content?.chapters || [];
    if (!ui.chaptersList) return;
    
    if (chapters.length === 0) {
        ui.chaptersList.innerHTML = '<p class="empty-list-info">Додайте свій перший розділ, натиснувши "Новий розділ".</p>';
        return;
    }
    
    ui.chaptersList.innerHTML = '';
    chapters.forEach((chapter, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.dataset.index = index;
        if (index === selectedChapterIndex) {
            item.classList.add('active');
        }
        
        // v2.4.0: Додано drag-handle та індикатор статусу
        item.innerHTML = `
            <div class="drag-handle">::</div>
            <div class="list-item-content">
                <span class="list-item-status status-${chapter.status || 'draft'}"></span>
                <h4 class="list-item-title">${escapeHTML(chapter.title) || '<i>Розділ без назви</i>'}</h4>
                <p class="list-item-snippet">${getSnippet(chapter.synopsis || chapter.text)}</p>
            </div>
        `;
        
        // v1.4.0: Обробник для кліку (тільки на контент)
        item.querySelector('.list-item-content')?.addEventListener('click', () => {
            selectChapter(index);
        });
        
        ui.chaptersList.appendChild(item);
    });
}

function selectChapter(index) {
    const chapters = currentProjectData?.content?.chapters;
    if (!chapters || !ui.chapterEditorPane || !ui.chapterEditorPlaceholder) return;
    
    if (index === null || index < 0 || index >= chapters.length) {
        hideChapterEditor();
        return;
    }

    selectedChapterIndex = index;
    const chapter = chapters[index];
    
    if (ui.chapterTitleInput) ui.chapterTitleInput.value = chapter.title || '';
    if (ui.chapterStatusSelect) ui.chapterStatusSelect.value = chapter.status || 'draft';
    if (ui.chapterTextarea) ui.chapterTextarea.value = chapter.text || '';
    if (ui.chapterSynopsisTextarea) ui.chapterSynopsisTextarea.value = chapter.synopsis || '';
    
    updateChapterWordCount(chapter.text || '');
    
    ui.chapterEditorPlaceholder.classList.add('hidden');
    ui.chapterEditorPane.classList.remove('hidden');
    
    // v1.6.0: Скидаємо історію для нового поля
    if (ui.chapterTextarea) resetHistory(ui.chapterTextarea);

    renderChaptersList(); // Оновити список, щоб підсвітити
    
    // v2.5.7: Оновлення навігації
    updateContextualNavigation('chapter', index, chapters.length);
}

function hideChapterEditor() {
    selectedChapterIndex = null;
    if (ui.chapterEditorPlaceholder) ui.chapterEditorPlaceholder.classList.remove('hidden');
    if (ui.chapterEditorPane) ui.chapterEditorPane.classList.add('hidden');
    renderChaptersList();
    // v2.5.7: Сховати навігацію
    if (ui.chapterNavigation) ui.chapterNavigation.classList.add('hidden');
}

function addChapter() {
    if (!currentProjectData) return;
    
    // v2.5.4 FIX: Ініціалізуємо масив, якщо він null/undefined
    if (!currentProjectData.content.chapters) {
        currentProjectData.content.chapters = [];
    }

    const newChapter = {
        title: "Новий розділ",
        status: "draft",
        text: "",
        synopsis: "",
        word_count: 0
    };
    
    currentProjectData.content.chapters.push(newChapter);
    const newIndex = currentProjectData.content.chapters.length - 1;
    
    // v2.5.5: Зберігаємо та оновлюємо
    scheduleSave('content.chapters', currentProjectData.content.chapters);
    
    renderChaptersList();
    selectChapter(newIndex);
    if (ui.chapterTitleInput) {
        ui.chapterTitleInput.focus();
        ui.chapterTitleInput.select();
    }
}

async function deleteChapter() {
    if (selectedChapterIndex === null || !currentProjectData?.content?.chapters) return;
    
    const chapterTitle = currentProjectData.content.chapters[selectedChapterIndex].title || "Розділ без назви";
    const confirmed = await showConfirmModal("Видалити розділ?", `Ви впевнені, що хочете видалити "${chapterTitle}"?`);

    if (!confirmed) return;

    currentProjectData.content.chapters.splice(selectedChapterIndex, 1);
    scheduleSave('content.chapters', currentProjectData.content.chapters);
    
    hideChapterEditor();
}

function updateChapterWordCount(text) {
    const count = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    if (ui.chapterStats) ui.chapterStats.textContent = `Слів у розділі: ${count}`;
    
    // v1.2.0: Оновлюємо лічильник в об'єкті
    if (selectedChapterIndex !== null && currentProjectData?.content?.chapters?.[selectedChapterIndex]) {
        currentProjectData.content.chapters[selectedChapterIndex].word_count = count;
    }
}

function updateTotalWordCount() {
    const chapters = currentProjectData?.content?.chapters || [];
    const totalCount = chapters.reduce((sum, chapter) => sum + (chapter.word_count || 0), 0);
    
    const goal = currentProjectData?.content?.wordGoal || CONFIG.DEFAULT_GOAL_WORDS;
    const progress = (totalCount / goal) * 100;

    if (ui.totalWordCountDisplay) ui.totalWordCountDisplay.textContent = `Загальна кількість слів: ${totalCount}`;
    if (ui.wordGoalDisplay) ui.wordGoalDisplay.textContent = `(Мета: ${goal} слів)`;
    if (ui.wordGoalProgress) ui.wordGoalProgress.style.width = `${Math.min(progress, 100)}%`;
    
    // v2.0.0: Оновлюємо дані в головному об'єкті (для кешу)
    if (currentProjectData) currentProjectData.totalWordCount = totalCount;
}

// --- ПЕРСОНАЖІ (Characters) ---

function renderCharactersList() {
    // v2.5.4 FIX: Використання опціонального чейнінгу та || [] для гарантії масиву
    const characters = currentProjectData?.content?.characters || [];
    if (!ui.charactersList) return;
    
    if (characters.length === 0) {
        ui.charactersList.innerHTML = '<p class="empty-list-info">Додайте свого першого персонажа.</p>';
        return;
    }
    
    ui.charactersList.innerHTML = '';
    characters.forEach((char, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.dataset.index = index;
        if (index === selectedCharacterIndex) {
            item.classList.add('active');
        }
        
        // v2.4.0: Додано drag-handle
        item.innerHTML = `
            <div class="drag-handle">::</div>
            <div class="list-item-content">
                <h4 class="list-item-title">${escapeHTML(char.name) || '<i>Персонаж без імені</i>'}</h4>
                <p class="list-item-snippet">${getSnippet(char.description)}</p>
            </div>
        `;
        
        item.querySelector('.list-item-content')?.addEventListener('click', () => {
            selectCharacter(index);
        });
        
        ui.charactersList.appendChild(item);
    });
}

function selectCharacter(index) {
    const characters = currentProjectData?.content?.characters;
    if (!characters || !ui.characterEditorPane || !ui.characterEditorPlaceholder) return;
    
    if (index === null || index < 0 || index >= characters.length) {
        hideCharacterEditor();
        return;
    }
    
    selectedCharacterIndex = index;
    const character = characters[index];
    
    if (ui.characterNameInput) ui.characterNameInput.value = character.name || '';
    if (ui.characterDescTextarea) ui.characterDescTextarea.value = character.description || '';
    if (ui.characterArcTextarea) ui.characterArcTextarea.value = character.arc || '';
    
    ui.characterEditorPlaceholder.classList.add('hidden');
    ui.characterEditorPane.classList.remove('hidden');
    
    if (ui.characterDescTextarea) resetHistory(ui.characterDescTextarea);

    renderCharactersList();
    
    // v2.5.7: Оновлення навігації
    updateContextualNavigation('character', index, characters.length);
}

function hideCharacterEditor() {
    selectedCharacterIndex = null;
    if (ui.characterEditorPlaceholder) ui.characterEditorPlaceholder.classList.remove('hidden');
    if (ui.characterEditorPane) ui.characterEditorPane.classList.add('hidden');
    renderCharactersList();
    // v2.5.7: Сховати навігацію
    if (ui.characterNavigation) ui.characterNavigation.classList.add('hidden');
}

function addCharacter() {
    if (!currentProjectData) return;
    
    // v2.5.4 FIX: Ініціалізуємо масив, якщо він null/undefined
    if (!currentProjectData.content.characters) {
        currentProjectData.content.characters = [];
    }
    
    const newChar = {
        name: "Новий персонаж",
        description: "",
        arc: ""
    };
    
    currentProjectData.content.characters.push(newChar);
    const newIndex = currentProjectData.content.characters.length - 1;
    
    scheduleSave('content.characters', currentProjectData.content.characters);
    
    renderCharactersList();
    selectCharacter(newIndex);
    if (ui.characterNameInput) {
        ui.characterNameInput.focus();
        ui.characterNameInput.select();
    }
}

async function deleteCharacter() {
    if (selectedCharacterIndex === null || !currentProjectData?.content?.characters) return;
    
    const charName = currentProjectData.content.characters[selectedCharacterIndex].name || "Персонаж без імені";
    const confirmed = await showConfirmModal("Видалити персонажа?", `Ви впевнені, що хочете видалити "${charName}"?`);

    if (!confirmed) return;

    currentProjectData.content.characters.splice(selectedCharacterIndex, 1);
    scheduleSave('content.characters', currentProjectData.content.characters);
    
    hideCharacterEditor();
}

// --- ЛОКАЦІЇ (Locations) ---

function renderLocationsList() {
    // v2.5.4 FIX: Використання опціонального чейнінгу та || [] для гарантії масиву
    const locations = currentProjectData?.content?.locations || [];
    if (!ui.locationsList) return;

    if (locations.length === 0) {
        ui.locationsList.innerHTML = '<p class="empty-list-info">Додайте свою першу локацію.</p>';
        return;
    }
    
    ui.locationsList.innerHTML = '';
    locations.forEach((loc, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.dataset.index = index;
        if (index === selectedLocationIndex) {
            item.classList.add('active');
        }
        
        // v2.4.0: Додано drag-handle
        item.innerHTML = `
            <div class="drag-handle">::</div>
            <div class="list-item-content">
                <h4 class="list-item-title">${escapeHTML(loc.name) || '<i>Локація без назви</i>'}</h4>
                <p class="list-item-snippet">${getSnippet(loc.description)}</p>
            </div>
        `;
        
        item.querySelector('.list-item-content')?.addEventListener('click', () => {
            selectLocation(index);
        });
        
        ui.locationsList.appendChild(item);
    });
}

function selectLocation(index) {
    const locations = currentProjectData?.content?.locations;
    if (!locations || !ui.locationEditorPane || !ui.locationEditorPlaceholder) return;
    
    if (index === null || index < 0 || index >= locations.length) {
        hideLocationEditor();
        return;
    }
    
    selectedLocationIndex = index;
    const location = locations[index];
    
    if (ui.locationNameInput) ui.locationNameInput.value = location.name || '';
    if (ui.locationDescTextarea) ui.locationDescTextarea.value = location.description || '';
    
    ui.locationEditorPlaceholder.classList.add('hidden');
    ui.locationEditorPane.classList.remove('hidden');
    
    if (ui.locationDescTextarea) resetHistory(ui.locationDescTextarea);

    renderLocationsList();
    
    // v2.5.7: Оновлення навігації
    updateContextualNavigation('location', index, locations.length);
}

function hideLocationEditor() {
    selectedLocationIndex = null;
    if (ui.locationEditorPlaceholder) ui.locationEditorPlaceholder.classList.remove('hidden');
    if (ui.locationEditorPane) ui.locationEditorPane.classList.add('hidden');
    renderLocationsList();
    // v2.5.7: Сховати навігацію
    if (ui.locationNavigation) ui.locationNavigation.classList.add('hidden');
}

function addLocation() {
    if (!currentProjectData) return;

    // v2.5.4 FIX: Ініціалізуємо масив, якщо він null/undefined
    if (!currentProjectData.content.locations) {
        currentProjectData.content.locations = [];
    }
    
    const newLoc = {
        name: "Нова локація",
        description: ""
    };
    
    currentProjectData.content.locations.push(newLoc);
    const newIndex = currentProjectData.content.locations.length - 1;
    
    scheduleSave('content.locations', currentProjectData.content.locations);
    
    renderLocationsList();
    selectLocation(newIndex);
    if (ui.locationNameInput) {
        ui.locationNameInput.focus();
        ui.locationNameInput.select();
    }
}

async function deleteLocation() {
    if (selectedLocationIndex === null || !currentProjectData?.content?.locations) return;
    
    const locName = currentProjectData.content.locations[selectedLocationIndex].name || "Локація без назви";
    const confirmed = await showConfirmModal("Видалити локацію?", `Ви впевнені, що хочете видалити "${locName}"?`);

    if (!confirmed) return;

    currentProjectData.content.locations.splice(selectedLocationIndex, 1);
    scheduleSave('content.locations', currentProjectData.content.locations);
    
    hideLocationEditor();
}

// --- СЮЖЕТНІ ЛІНІЇ (Plotlines) ---

function renderPlotlinesList() {
    // v2.5.4 FIX: Використання опціонального чейнінгу та || [] для гарантії масиву
    const plotlines = currentProjectData?.content?.plotlines || [];
    if (!ui.plotlinesList) return;

    if (plotlines.length === 0) {
        ui.plotlinesList.innerHTML = '<p class="empty-list-info">Додайте свою першу сюжетну лінію.</p>';
        return;
    }
    
    ui.plotlinesList.innerHTML = '';
    plotlines.forEach((plot, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.dataset.index = index;
        if (index === selectedPlotlineIndex) {
            item.classList.add('active');
        }
        
        // v2.4.0: Додано drag-handle
        item.innerHTML = `
            <div class="drag-handle">::</div>
            <div class="list-item-content">
                <h4 class="list-item-title">${escapeHTML(plot.title) || '<i>Сюжет без назви</i>'}</h4>
                <p class="list-item-snippet">${getSnippet(plot.description)}</p>
            </div>
        `;
        
        item.querySelector('.list-item-content')?.addEventListener('click', () => {
            selectPlotline(index);
        });
        
        ui.plotlinesList.appendChild(item);
    });
}

function selectPlotline(index) {
    const plotlines = currentProjectData?.content?.plotlines;
    if (!plotlines || !ui.plotlineEditorPane || !ui.plotlineEditorPlaceholder) return;
    
    if (index === null || index < 0 || index >= plotlines.length) {
        hidePlotlineEditor();
        return;
    }
    
    selectedPlotlineIndex = index;
    const plotline = plotlines[index];
    
    if (ui.plotlineTitleInput) ui.plotlineTitleInput.value = plotline.title || '';
    if (ui.plotlineDescTextarea) ui.plotlineDescTextarea.value = plotline.description || '';
    
    ui.plotlineEditorPlaceholder.classList.add('hidden');
    ui.plotlineEditorPane.classList.remove('hidden');
    
    if (ui.plotlineDescTextarea) resetHistory(ui.plotlineDescTextarea);

    renderPlotlinesList();
    
    // v2.5.7: Оновлення навігації
    updateContextualNavigation('plotline', index, plotlines.length);
}

function hidePlotlineEditor() {
    selectedPlotlineIndex = null;
    if (ui.plotlineEditorPlaceholder) ui.plotlineEditorPlaceholder.classList.remove('hidden');
    if (ui.plotlineEditorPane) ui.plotlineEditorPane.classList.add('hidden');
    renderPlotlinesList();
    // v2.5.7: Сховати навігацію
    if (ui.plotlineNavigation) ui.plotlineNavigation.classList.add('hidden');
}

function addPlotline() {
    if (!currentProjectData) return;

    // v2.5.4 FIX: Ініціалізуємо масив, якщо він null/undefined
    if (!currentProjectData.content.plotlines) {
        currentProjectData.content.plotlines = [];
    }
    
    const newPlot = {
        title: "Нова сюжетна лінія",
        description: ""
    };
    
    currentProjectData.content.plotlines.push(newPlot);
    const newIndex = currentProjectData.content.plotlines.length - 1;
    
    scheduleSave('content.plotlines', currentProjectData.content.plotlines);
    
    renderPlotlinesList();
    selectPlotline(newIndex);
    if (ui.plotlineTitleInput) {
        ui.plotlineTitleInput.focus();
        ui.plotlineTitleInput.select();
    }
}

async function deletePlotline() {
    if (selectedPlotlineIndex === null || !currentProjectData?.content?.plotlines) return;
    
    const plotTitle = currentProjectData.content.plotlines[selectedPlotlineIndex].title || "Сюжет без назви";
    const confirmed = await showConfirmModal("Видалити сюжетну лінію?", `Ви впевнені, що хочете видалити "${plotTitle}"?`);

    if (!confirmed) return;

    currentProjectData.content.plotlines.splice(selectedPlotlineIndex, 1);
    scheduleSave('content.plotlines', currentProjectData.content.plotlines);
    
    hidePlotlineEditor();
}


// === v1.1.0: Логіка ЧАТУ === 

/**
 * v2.0.0: Логіка рендеру чату 
 * @param {Array<object>} history
 */
function renderChatHistory(history) {
    if (!ui.chatWindow) return;
    ui.chatWindow.innerHTML = '';
    // v2.0.0: Пропускаємо перші 2 повідомлення (системний промпт)
    (history || []).slice(2).forEach(msg => {
        addMessageToChat(msg.role, msg.parts[0].text);
    });
}

/**
 * v2.0.0: Логіка відправки (Оновлено для v2.3.0)
 */
async function sendChatMessage() {
    if (!ui.userInput || !ui.sendButton) return;
    
    const messageText = ui.userInput.value.trim();
    if (messageText === '' || !currentProjectID) return;

    addMessageToChat('user', messageText);
    ui.userInput.value = '';
    ui.userInput.disabled = true;
    ui.sendButton.disabled = true;
    addMessageToChat('model', '...', true); // Індикатор завантаження

    // v2.3.0: Збираємо опції контексту
    const contextOptions = {
        includeWorld: ui.chatContextOptions.world?.checked,
        includeChapters: ui.chatContextOptions.chapters?.checked,
        includeCharacters: ui.chatContextOptions.characters?.checked,
        includeLocations: ui.chatContextOptions.locations?.checked,
        includePlotlines: ui.chatContextOptions.plotlines?.checked
    };

    try {
        // v2.3.0: Надсилаємо опції разом із запитом
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectID: currentProjectID,
                message: messageText,
                contextOptions: contextOptions 
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP помилка! Статус: ${response.status}`);
        }

        const data = await response.json();
        
        // v2.1.1: Сервер повертає ТІЛЬКИ нову відповідь
        updateLastChatMessage(data.message);
        
        // v2.1.1: Ми більше не отримуємо повну історію,
        // тому маємо вручну додати її до нашого локального стану
        if (currentProjectData) {
            currentProjectData.chatHistory.push({ role: 'user', parts: [{ text: messageText }] });
            currentProjectData.chatHistory.push({ role: "model", parts: [{ text: data.message }] });
            
            // v1.7.0: Кешуємо оновлену історію
            projectCache.set(currentProjectID, currentProjectData);
        }

    } catch (error) {
        handleError(error, "chat-send");
        updateLastChatMessage("Вибачте, сталася помилка. Спробуйте ще раз.");
    } finally {
        if (ui.userInput) ui.userInput.disabled = false;
        if (ui.sendButton) ui.sendButton.disabled = false;
        if (ui.userInput) ui.userInput.focus();
    }
}

/**
 * @param {'user' | 'model'} role
 * @param {string} text
 * @param {boolean} [isLoading=false]
 */
function addMessageToChat(role, text, isLoading = false) {
    if (!ui.chatWindow) return;
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', `${role}-message`);
    
    // v1.3.0: Обробка markdown (дуже базово)
    let html = escapeHTML(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>')   // Italic
        .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>') // Code block
        .replace(/`(.*?)`/g, '<code>$1</code>')     // Inline code
        .replace(/\n/g, '<br>');             // Newlines

    if (isLoading) {
        messageElement.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        messageElement.id = 'loading-message';
    } else {
        messageElement.innerHTML = html;
    }
    
    ui.chatWindow.appendChild(messageElement);
    ui.chatWindow.scrollTop = ui.chatWindow.scrollHeight;
}

function updateLastChatMessage(text) {
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) {
        // v1.3.0: Обробка markdown
        let html = escapeHTML(text)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
            
        loadingMessage.innerHTML = html;
        loadingMessage.id = '';
    } else {
        // Якщо індикатора чомусь немає, просто додаємо нове повідомлення
        addMessageToChat('model', text);
    }
}

// === v1.6.0: Глобальний Пошук === 

function performGlobalSearch(query) {
    if (!currentProjectData || !ui.searchResultsList || !ui.searchResultsModal) return;
    
    if (!query || query.length < 3) {
        ui.searchResultsList.innerHTML = '<p>Введіть щонайменше 3 символи для пошуку.</p>';
        ui.searchResultsModal.classList.remove('hidden');
        return;
    }
    
    const lowerQuery = query.toLowerCase();
    const results = [];
    const { content } = currentProjectData;

    // Пошук по розділах
    (content.chapters || []).forEach((item, index) => {
        if (item.title?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Розділ', title: item.title, text: getSnippet(item.synopsis || item.text), tab: 'chapters', index });
        }
        if (item.text?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Розділ (текст)', title: item.title, text: getSnippet(item.text), tab: 'chapters', index });
        }
        if (item.synopsis?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Розділ (синопсис)', title: item.title, text: getSnippet(item.synopsis), tab: 'chapters', index });
        }
    });
    
    // Пошук по персонажах
    (content.characters || []).forEach((item, index) => {
        if (item.name?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Персонаж', title: item.name, text: getSnippet(item.description), tab: 'characters', index });
        }
        if (item.description?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Персонаж (опис)', title: item.name, text: getSnippet(item.description), tab: 'characters', index });
        }
        if (item.arc?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Персонаж (арка)', title: item.name, text: getSnippet(item.arc), tab: 'characters', index });
        }
    });
    
    // Пошук по локаціях
    (content.locations || []).forEach((item, index) => {
        if (item.name?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Локація', title: item.name, text: getSnippet(item.description), tab: 'locations', index });
        }
        if (item.description?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Локація (опис)', title: item.name, text: getSnippet(item.description), tab: 'locations', index });
        }
    });

    // Пошук по сюжету
    (content.plotlines || []).forEach((item, index) => {
        if (item.title?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Сюжет', title: item.title, text: getSnippet(item.description), tab: 'plotlines', index });
        }
        if (item.description?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Сюжет (опис)', title: item.title, text: getSnippet(item.description), tab: 'plotlines', index });
        }
    });
    
    // Пошук по світу
    if (content.premise?.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'Світ', title: 'Premise (Logline)', text: getSnippet(content.premise), tab: 'world', field: 'premise-textarea' });
    }
    if (content.theme?.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'Світ', title: 'Тема', text: getSnippet(content.theme), tab: 'world', field: 'theme-textarea' });
    }
    if (content.mainArc?.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'Світ', title: 'Головна арка', text: getSnippet(content.mainArc), tab: 'world', field: 'main-arc-textarea' });
    }
    if (content.notes?.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'Світ', title: 'Нотатки', text: getSnippet(content.notes), tab: 'world', field: 'notes-textarea' });
    }
    if (content.research?.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'Світ', title: 'Дослідження', text: getSnippet(content.research), tab: 'world', field: 'research-textarea' });
    }

    renderSearchResults(results, lowerQuery);
    ui.searchResultsModal.classList.remove('hidden');
}

function renderSearchResults(results, query) {
    if (!ui.searchResultsList) return;
    
    if (results.length === 0) {
        ui.searchResultsList.innerHTML = '<p>Нічого не знайдено.</p>';
        return;
    }
    
    ui.searchResultsList.innerHTML = '';
    results.forEach(res => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        
        // Підсвітка
        const title = (res.title || '...').replace(new RegExp(query, 'gi'), (match) => `<mark>${match}</mark>`);
        const text = res.text.replace(new RegExp(query, 'gi'), (match) => `<mark>${match}</mark>`);
        
        item.innerHTML = `
            <strong>${res.type}:</strong> ${title}
            <p>${text}</p>
        `;
        
        item.addEventListener('click', () => {
            navigateToSearchResult(res);
        });
        
        ui.searchResultsList.appendChild(item);
    });
}

function navigateToSearchResult(result) {
    if (!ui.searchResultsModal || !ui.globalSearchInput) return;
    
    ui.searchResultsModal.classList.add('hidden');
    ui.globalSearchInput.value = '';
    
    const tabId = `${result.tab}-tab`;
    switchTab(tabId);
    
    // v1.6.0: Використовуємо switch для навігації
    switch (result.tab) {
        case 'chapters':
            selectChapter(result.index);
            if (ui.chapterTextarea) ui.chapterTextarea.focus();
            break;
        case 'characters':
            selectCharacter(result.index);
            if (ui.characterDescTextarea) ui.characterDescTextarea.focus();
            break;
        case 'locations':
            selectLocation(result.index);
            if (ui.locationDescTextarea) ui.locationDescTextarea.focus();
            break;
        case 'plotlines':
            selectPlotline(result.index);
            if (ui.plotlineDescTextarea) ui.plotlineDescTextarea.focus();
            break;
        case 'world':
            const field = document.getElementById(result.field);
            if (field) {
                field.focus();
                field.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            break;
    }
}

// === v1.6.0: Історія (Undo/Redo) === 

/**
 * @param {HTMLInputElement | HTMLTextAreaElement} [field]
 */
function resetHistory(field = null) {
    historyManager.currentField = field;
    historyManager.stack = field ? [field.value] : [];
    historyManager.pointer = 0;
    historyManager.isRestoring = false;
    if (historyManager.debounceTimer) {
        clearTimeout(historyManager.debounceTimer);
        historyManager.debounceTimer = null;
    }
}

function recordHistory(e) {
    if (historyManager.isRestoring || !historyManager.currentField) {
        return;
    }
    
    if (historyManager.debounceTimer) {
        clearTimeout(historyManager.debounceTimer);
    }
    
    historyManager.debounceTimer = setTimeout(() => {
        const value = e.target.value;
        if (value === historyManager.stack[historyManager.pointer]) {
            return; // Нічого не змінилось
        }
        
        // Якщо ми "повернулись" і почали писати, відрізаємо "майбутнє"
        if (historyManager.pointer < historyManager.stack.length - 1) {
            historyManager.stack = historyManager.stack.slice(0, historyManager.pointer + 1);
        }
        
        historyManager.stack.push(value);
        historyManager.pointer = historyManager.stack.length - 1;
        
        historyManager.debounceTimer = null;
    }, CONFIG.HISTORY_DEBOUNCE);
}

function undo() {
    if (!historyManager.currentField || historyManager.pointer <= 0) { return; }
    historyManager.isRestoring = true;
    historyManager.pointer--;
    const value = historyManager.stack[historyManager.pointer];
    historyManager.currentField.value = value;
    // v1.7.0: Треба також викликати 'input' і 'change'
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


// === v1.7.0: ФУНКЦІЯ ПРИМУСОВОГО ЗБЕРЕЖЕННЯ ===
function triggerManualSave() {
    if (!hasUnsavedChanges && !pendingSave.timer) {
        showToast("Все збережено", "info");
        return;
    }
    
    // v1.7.0: Знімаємо фокус з активного елемента, щоб змусити спрацювати onchange
    const activeEl = document.activeElement;
    if (activeEl && activeEl.blur && activeEl !== document.body) {
        activeEl.blur(); 
    }
    
    if (pendingSave.func) {
        clearTimeout(pendingSave.timer);
        console.log("Примусове виконання збереження, що очікувало...");
        pendingSave.func(); // Викликаємо збереження негайно
        pendingSave.timer = null;
        pendingSave.func = null;
    } else {
        // Якщо нічого не очікувало (малоймовірно, але можливо)
        setSaveStatus('saved');
    }
}

// v2.5.7: Обробник швидкого доступу
function handleQuickAccessAction(e) {
    const actionElement = e.target.closest('.quick-action');
    if (!actionElement) return;

    const action = actionElement.dataset.action;

    switch (action) {
        case 'new-chapter':
            switchTab('chapters-tab');
            addChapter();
            break;
        case 'new-character':
            switchTab('characters-tab');
            addCharacter();
            break;
        case 'save-project':
            triggerManualSave();
            break;
        case 'export-project':
            if (currentProjectID && currentProjectData?.title) {
                exportProject(currentProjectID, currentProjectData.title);
            }
            break;
        case 'quick-chat':
            switchTab('chat-tab');
            if (ui.userInput) ui.userInput.focus();
            break;
    }
}


// === v1.1.0: Ініціалізація та Обробники Подій === 

document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("DOMContentLoaded спрацював. Починаю ініціалізацію.");
        
        bindUIElements();
        
        // Встановлення версії
        if (ui.versionNumber) { 
            ui.versionNumber.textContent = CONFIG.APP_VERSION;
            console.log(`Версію встановлено на: ${CONFIG.APP_VERSION}`);
        } else {
            console.error("Елемент для версії (version-number) не знайдено.");
        }
        
        // --- Глобальні обробники ---
        window.addEventListener('beforeunload', (e) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'У вас є незбережені зміни. Ви впевнені, що хочете піти?';
            }
        });

        document.addEventListener('keydown', (e) => {
            // v1.6.0: Undo/Redo
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    undo();
                } else if (e.key === 'y') {
                    e.preventDefault();
                    redo();
                }
                // v1.7.0: Ctrl+S
                if (e.key === 's') {
                    e.preventDefault();
                    triggerManualSave();
                }
                // v2.5.7: Ctrl+K для пошуку
                if (e.key === 'k') {
                    e.preventDefault();
                    if (ui.globalSearchInput) {
                        ui.globalSearchInput.focus();
                    }
                }
            }
            // v1.6.0: Пошук
            if (e.key === 'Escape') {
                if (!ui.searchResultsModal?.classList.contains('hidden')) {
                    ui.searchResultsModal.classList.add('hidden');
                }
            }
        });

        // --- Автентифікація ---
        ui.signInBtn?.addEventListener('click', signIn);
        ui.signOutBtn?.addEventListener('click', signOut);

        // --- Проєкти ---
        ui.createProjectBtn?.addEventListener('click', createProject);
        ui.projectContextMenu?.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = e.target.id;
            if (action === 'context-edit-btn') {
                editProjectTitle(contextMenuProjectID, contextMenuProjectTitle);
            } else if (action === 'context-delete-btn') {
                deleteProject(contextMenuProjectID, contextMenuProjectTitle);
            } else if (action === 'context-export-btn') {
                exportProject(contextMenuProjectID, contextMenuProjectTitle);
            }
            ui.projectContextMenu?.classList.add('hidden');
        });

        // --- Робоча область (Загальне) ---
        // v2.5.7: Використовуємо універсальний обробник
        ui.backToProjectsBtn?.addEventListener('click', handleBackToProjects);
        
        // v2.5.7: Обробник хлібних крихт "До проєктів"
        ui.breadcrumbProjects?.addEventListener('click', handleBackToProjects);

        // v2.5.7: Швидкий доступ
        ui.quickAccessBar?.addEventListener('click', handleQuickAccessAction);
        
        // v1.7.0: Збереження по кліку
        ui.saveStatusIndicator?.addEventListener('click', triggerManualSave);
        
        ui.workspaceTitleInput?.addEventListener('change', (e) => {
            const newTitle = e.target.value;
            if (ui.workspaceTitle) ui.workspaceTitle.textContent = newTitle;
            if (currentProjectData) currentProjectData.title = newTitle;
            
            // v1.7.0: Це не автозбереження, це окремий ендпоінт
            (async () => {
                setSaveStatus('saving');
                try {
                    await fetch('/update-title', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ projectID: currentProjectID, newTitle: newTitle })
                    });
                    projectCache.set(currentProjectID, currentProjectData);
                    setSaveStatus('saved');
                    loadUserProjects(); // Оновити список у фоні
                } catch (error) {
                    handleError(error, "update-title-inline");
                    setSaveStatus('error');
                }
            })();
            updateBreadcrumbs(); // v2.5.7: Оновлюємо хлібні крихти
        });
        ui.workspaceTitle?.addEventListener('click', () => {
            ui.workspaceTitle.classList.add('hidden');
            ui.workspaceTitleInput?.classList.remove('hidden');
            ui.workspaceTitleInput?.focus();
            ui.workspaceTitleInput?.select();
        });
        ui.workspaceTitleInput?.addEventListener('blur', () => {
            ui.workspaceTitle?.classList.remove('hidden');
            ui.workspaceTitleInput?.classList.add('hidden');
        });
        ui.workspaceTitleInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.target.blur();
            }
        });
        
        // v1.6.0: Глобальний пошук
        ui.globalSearchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                performGlobalSearch(e.target.value);
            }
        });
        ui.searchResultsCloseBtn?.addEventListener('click', () => {
            ui.searchResultsModal?.classList.add('hidden');
        });

        // --- Навігація по вкладках ---
        ui.workspaceNav?.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                const tabId = e.target.dataset.tab;
                if (tabId) {
                    switchTab(tabId);
                }
            }
        });
        
        // --- Обробники автозбереження ---
        
        const addWorldSaveListener = (element, fieldName, property) => {
            if (!element) return;
            
            // v1.6.0: Історія
            element.addEventListener('focus', () => resetHistory(element));
            element.addEventListener('input', recordHistory);
            
            element.addEventListener('change', (e) => {
                if (historyManager.isRestoring) return; // v1.6.0
                
                if (!currentProjectData || !currentProjectData.content) return;
                
                const value = (element.type === 'number') ? parseFloat(e.target.value) : e.target.value;
                currentProjectData.content[property] = value;
                
                scheduleSave(fieldName, value);
                
                if (fieldName === 'content.wordGoal') {
                    updateTotalWordCount();
                }
            });
        };
        
        // --- Вкладка: Світ ---
        addWorldSaveListener(ui.premiseTextarea, 'content.premise', 'premise');
        addWorldSaveListener(ui.themeTextarea, 'content.theme', 'theme');
        addWorldSaveListener(ui.mainArcTextarea, 'content.mainArc', 'mainArc');
        addWorldSaveListener(ui.wordGoalInput, 'content.wordGoal', 'wordGoal');
        addWorldSaveListener(ui.notesTextarea, 'content.notes', 'notes');
        addWorldSaveListener(ui.researchTextarea, 'content.research', 'research');

        // --- Вкладка: Розділи ---
        ui.addChapterBtn?.addEventListener('click', addChapter);
        ui.chapterDeleteBtn?.addEventListener('click', deleteChapter);
        
        // v2.5.7: Обробники контекстної навігації для розділів
        ui.prevChapterBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            selectChapter(selectedChapterIndex - 1);
        });
        ui.nextChapterBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            selectChapter(selectedChapterIndex + 1);
        });
        
        const addChapterSaveListener = (element, property) => {
            if (!element) return;
            
            // v1.6.0: Історія
            element.addEventListener('focus', () => resetHistory(element));
            element.addEventListener('input', recordHistory);
            
            element.addEventListener('change', (e) => {
                if (historyManager.isRestoring) return;
                if (selectedChapterIndex === null || !currentProjectData?.content?.chapters) return;
                
                const value = e.target.value;
                currentProjectData.content.chapters[selectedChapterIndex][property] = value;
                scheduleSave('content.chapters', currentProjectData.content.chapters);
                
                if (property === 'title' || property === 'status') {
                    renderChaptersList(); // Оновити назву/статус у списку
                }
            });
        };
        
        addChapterSaveListener(ui.chapterTitleInput, 'title');
        addChapterSaveListener(ui.chapterStatusSelect, 'status');
        addChapterSaveListener(ui.chapterSynopsisTextarea, 'synopsis');
        addChapterSaveListener(ui.chapterTextarea, 'text');
        
        // v1.6.0: Історія (лише для головного поля)
        ui.chapterTextarea?.addEventListener('input', (e) => {
            if (historyManager.isRestoring) return;
            updateChapterWordCount(e.target.value);
            recordHistory(e); // v1.6.0
        });

        // --- Вкладка: Персонажі ---
        ui.addCharacterBtn?.addEventListener('click', addCharacter);
        ui.characterDeleteBtn?.addEventListener('click', deleteCharacter);
        
        // v2.5.7: Обробники контекстної навігації для персонажів
        ui.prevCharacterBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            selectCharacter(selectedCharacterIndex - 1);
        });
        ui.nextCharacterBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            selectCharacter(selectedCharacterIndex + 1);
        });

        const addCharacterSaveListener = (element, property) => {
            if (!element) return;
            
            // v1.6.0: Історія
            element.addEventListener('focus', () => resetHistory(element));
            element.addEventListener('input', recordHistory);
            
            element.addEventListener('change', (e) => {
                if (historyManager.isRestoring) return;
                if (selectedCharacterIndex === null || !currentProjectData?.content?.characters) return;
                
                const value = e.target.value;
                currentProjectData.content.characters[selectedCharacterIndex][property] = value;
                scheduleSave('content.characters', currentProjectData.content.characters);
                
                if (property === 'name') {
                    renderCharactersList();
                }
            });
        };
        
        addCharacterSaveListener(ui.characterNameInput, 'name');
        addCharacterSaveListener(ui.characterDescTextarea, 'description');
        addCharacterSaveListener(ui.characterArcTextarea, 'arc');
        
        // --- Вкладка: Локації ---
        ui.addLocationBtn?.addEventListener('click', addLocation);
        ui.locationDeleteBtn?.addEventListener('click', deleteLocation);
        
        // v2.5.7: Обробники контекстної навігації для локацій
        ui.prevLocationBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            selectLocation(selectedLocationIndex - 1);
        });
        ui.nextLocationBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            selectLocation(selectedLocationIndex + 1);
        });

        const addLocationSaveListener = (element, property) => {
            if (!element) return;
            
            // v1.6.0: Історія
            element.addEventListener('focus', () => resetHistory(element));
            element.addEventListener('input', recordHistory);
            
            element.addEventListener('change', (e) => {
                if (historyManager.isRestoring) return;
                if (selectedLocationIndex === null || !currentProjectData?.content?.locations) return;
                
                const value = e.target.value;
                currentProjectData.content.locations[selectedLocationIndex][property] = value;
                scheduleSave('content.locations', currentProjectData.content.locations);
                
                if (property === 'name') {
                    renderLocationsList();
                }
            });
        };
        
        addLocationSaveListener(ui.locationNameInput, 'name');
        addLocationSaveListener(ui.locationDescTextarea, 'description');
        
        // --- Вкладка: Сюжетні лінії ---
        ui.addPlotlineBtn?.addEventListener('click', addPlotline);
        ui.plotlineDeleteBtn?.addEventListener('click', deletePlotline);
        
        // v2.5.7: Обробники контекстної навігації для сюжетних ліній
        ui.prevPlotlineBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            selectPlotline(selectedPlotlineIndex - 1);
        });
        ui.nextPlotlineBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            selectPlotline(selectedPlotlineIndex + 1);
        });
        
        const addPlotlineSaveListener = (element, property) => {
            if (!element) return;
            
            // v1.6.0: Історія
            element.addEventListener('focus', () => resetHistory(element));
            element.addEventListener('input', recordHistory);
            
            element.addEventListener('change', (e) => {
                if (historyManager.isRestoring) return;
                if (selectedPlotlineIndex === null || !currentProjectData?.content?.plotlines) return;
                
                const value = e.target.value;
                currentProjectData.content.plotlines[selectedPlotlineIndex][property] = value;
                scheduleSave('content.plotlines', currentProjectData.content.plotlines);
                
                if (property === 'title') {
                    renderPlotlinesList();
                }
            });
        };
        
        addPlotlineSaveListener(ui.plotlineTitleInput, 'title');
        addPlotlineSaveListener(ui.plotlineDescTextarea, 'description');

        // --- Вкладка: Чат ---
        ui.sendButton?.addEventListener('click', sendChatMessage);
        ui.userInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });

        // --- Ініціалізація Firebase ---
        initializeFirebase();
        
    } catch (e) {
        // v2.5.3: Логуємо всі критичні помилки ініціалізації
        handleError(e, "DOMContentLoaded_init");
        showToast("Критична помилка ініціалізації. Перевірте консоль браузера.", "error");
    }
});