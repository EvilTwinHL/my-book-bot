// src/modules/workspace.js (КОРЕКТНА ВЕРСІЯ v2.9.11: Усунення циклічної залежності та виправлення View)

import { 
    currentProjectID, 
    currentProjectData, 
    setCurrentProjectID, 
    setCurrentProjectData, 
    currentTab, 
    setCurrentTab, 
    ui, 
    hasUnsavedChanges
} from '../state.js';
import { 
    showSpinner, 
    hideSpinner, 
    handleError, 
    showToast, 
    showView, 
    setSaveStatus 
} from '../ui/global.js';
import { 
    fetchProjectContent, 
    updateProjectTitleAPI 
} from '../api.js';
import { projectCache } from '../core/cache.js';
import { 
    renderChaptersList, 
    renderCharactersList, 
    renderLocationsList, 
    renderPlotlinesList, 
    hideChapterEditor,
    hideCharacterEditor,
    hideLocationEditor,
    hidePlotlineEditor,
    addChapter,
    addCharacter
} from './lists.js';
import { updateTotalWordCount } from '../utils/stats.js';
import { initializeSortableLists } from '../utils/sortable.js';
import { triggerManualSave } from './save.js';
import { performGlobalSearch } from './search.js';
import { renderChatHistory } from './chat.js';

// !!! КРИТИЧНЕ ВИПРАВЛЕННЯ: ВИДАЛЕННЯ СТАТИЧНОГО ІМПОРТУ З projects.js
// import { exportProjectAction, loadProjects } from './projects.js';


// --- ДИНАМІЧНІ ОБГОРТКИ (для усунення циклічних залежностей з projects.js) ---

/** Асинхронно викликає loadProjects з модуля projects. */
async function callLoadProjects() {
    try {
        const projectsModule = await import('./projects.js'); 
        projectsModule.loadProjects(); 
    } catch (e) {
        handleError(e, "dynamic-loadProjects");
        showToast("Помилка завантаження списку проєктів.", "error");
    }
}

/** Асинхронно викликає exportProjectAction з модуля projects. */
async function callExportProjectAction() {
    try {
        const projectsModule = await import('./projects.js'); 
        // exportProjectAction використовує контекстні ID з projects.js
        projectsModule.exportProjectAction(); 
    } catch (e) {
        handleError(e, "dynamic-exportProjectAction");
        showToast("Помилка експорту проєкту.", "error");
    }
}


// --- НАВІГАЦІЯ ---

/**
 * @param {string} tabId 
 */
export function switchTab(tabId) {
    // ... (логіка switchTab без змін)
    Object.values(ui.tabs).forEach(tab => tab?.classList.remove('active'));
    Object.values(ui.tabButtons).forEach(btn => btn?.classList.remove('active'));
    
    const tabName = tabId.replace('-tab', '');
    setCurrentTab(tabName);

    const tabToShow = ui.tabs[tabName];
    const buttonToActivate = ui.tabButtons[tabName];
    
    if (tabToShow) {
        tabToShow.classList.add('active');
    }
    if (buttonToActivate) {
        buttonToActivate.classList.add('active');
    }
    
    updateBreadcrumbs(); 
    
    // Скидання контекстної навігації при зміні вкладки
    hideChapterEditor();
    hideCharacterEditor();
    hideLocationEditor();
    hidePlotlineEditor();
}

/**
 * Оновлення хлібних крихт
 */
export function updateBreadcrumbs() {
    if (!ui.breadcrumbs || !ui.breadcrumbCurrent || !currentProjectData) return;
    
    // ... (логіка updateBreadcrumbs без змін)
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
    }
}

export function handleBackToProjects(e) {
    e?.preventDefault();
    if (hasUnsavedChanges) {
        triggerManualSave(); 
    }
    setCurrentProjectID(null);
    setCurrentProjectData(null);
    showView('projects-view'); // КРИТИЧНО: ВИПРАВЛЕНО 'projects' -> 'projects-view'
    callLoadProjects();       // КРИТИЧНО: ВИПРАВЛЕНО 'loadUserProjects()' -> 'callLoadProjects()'
}

/**
 * @param {Event} e 
 */
export function handleQuickAccessAction(e) {
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
            // КРИТИЧНО: ВИКЛИК ЧЕРЕЗ ДИНАМІЧНУ ОБГОРТКУ
            if (currentProjectID && currentProjectData?.title) {
                 callExportProjectAction(); // Викликаємо обгортку без аргументів
            }
            break;
        case 'quick-chat':
            switchTab('chat-tab');
            if (ui.userInput) ui.userInput.focus();
            break;
        case 'global-search':
            if (ui.globalSearchInput) ui.globalSearchInput.focus();
            break;
    }
}

// --- ЗАВАНТАЖЕННЯ РОБОЧОЇ ОБЛАСТІ ---

/**
 * @param {string} projectID
 */
export async function openProject(projectID) {
    showSpinner("Відкриття проєкту...");
    setCurrentProjectID(projectID);
    
    const cachedData = projectCache.get(projectID); 
    
    if (cachedData) {
        console.log("Проєкт завантажено з кешу sessionStorage.");
        setCurrentProjectData(cachedData);
        loadWorkspace();
        showView('workspace-container'); // КРИТИЧНО: ВИПРАВЛЕНО 'workspace' -> 'workspace-container'
        hideSpinner();
        syncProjectInBackground(projectID);
        return;
    }

    try {
        const freshData = await fetchProjectContent(projectID);
        
        setCurrentProjectData(freshData);
        projectCache.set(projectID, currentProjectData); 
        
        loadWorkspace();
        showView('workspace-container'); // КРИТИЧНО: ВИПРАВЛЕНО 'workspace' -> 'workspace-container'
        
    } catch (error) {
        handleError(error, "open-project");
        showToast("Не вдалося відкрити проєкт.", "error");
        setCurrentProjectID(null);
        showView('projects-view'); // КРИТИЧНО: ВИПРАВЛЕНО 'projects' -> 'projects-view'
        
    } finally {
        hideSpinner();
    }
}

export async function syncProjectInBackground(projectID) {
    // ... (логіка синхронізації без змін)
    if (projectID !== currentProjectID) return; 
    
    console.log(`[Sync]: Починаю фонову синхронізацію для ${projectID}...`);
    try {
        const freshData = await fetchProjectContent(projectID);
        
        if (hasUnsavedChanges) {
            console.warn("[Sync]: Відміна синхронізації, оскільки є незбережені зміни.");
            return;
        }

        setCurrentProjectData(freshData);
        projectCache.set(projectID, currentProjectData);
        console.log("[Sync]: Проєкт синхронізовано та кеш оновлено.");
        
        const activeEl = document.activeElement;
        const isEditing = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
        
        if (!isEditing) {
            console.log("[Sync]: Оновлюю UI...");
            loadWorkspace(true);
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
 * Заповнює робочу область даними з `currentProjectData`
 * @param {boolean} [silent=false] Якщо true, не скидає вибрані індекси та історію.
 */
export function loadWorkspace(silent = false) {
    if (!currentProjectData) {
        handleError("Спроба завантажити робочу область без даних.", "load-workspace");
        showView('projects-view'); // КРИТИЧНО: ВИПРАВЛЕНО 'projects' -> 'projects-view'
        return;
    }
    
    const { title, content, chatHistory } = currentProjectData;

    if (!silent) {
        // ... (логіка скидання стану без змін)
        (async () => {
            const { setSelectedChapterIndex, setSelectedCharacterIndex, setSelectedLocationIndex, setSelectedPlotlineIndex } = await import('../state.js');
            setSelectedChapterIndex(null);
            setSelectedCharacterIndex(null);
            setSelectedLocationIndex(null);
            setSelectedPlotlineIndex(null);
        })();
        setSaveStatus('saved');
    }

    // --- Заголовок ---
    if (ui.workspaceTitle) ui.workspaceTitle.textContent = title;
    if (ui.workspaceTitleInput) ui.workspaceTitleInput.value = title;
    
    // --- Вкладка: Розділи ---
    renderChaptersList(content.chapters); // ВИПРАВЛЕНО: Додано аргумент
    hideChapterEditor();
    
    // --- Вкладка: Персонажі ---
    renderCharactersList(content.characters); // ВИПРАВЛЕНО: Додано аргумент
    hideCharacterEditor();
    
    // --- Вкладка: Локації ---
    renderLocationsList(content.locations); // ВИПРАВЛЕНО: Додано аргумент
    hideLocationEditor();
    
    // --- Вкладка: Сюжет ---
    renderPlotlinesList(content.plotlines); // ВИПРАВЛЕНО: Додано аргумент
    hidePlotlineEditor();

    // --- Вкладка: Світ ---
    if (ui.premiseTextarea) ui.premiseTextarea.value = content.premise || '';
    if (ui.themeTextarea) ui.themeTextarea.value = content.theme || '';
    if (ui.mainArcTextarea) ui.mainArcTextarea.value = content.mainArc || '';
    if (ui.wordGoalInput) ui.wordGoalInput.value = content.wordGoal || 50000;
    if (ui.notesTextarea) ui.notesTextarea.value = content.notes || '';
    if (ui.researchTextarea) ui.researchTextarea.value = content.research || '';

    // --- Вкладка: Чат ---
    renderChatHistory(chatHistory);

    // --- Статистика ---
    updateTotalWordCount();

    // --- Навігація ---
    if (!silent) {
        switchTab('chapters-tab');
        if (ui.globalSearchInput) ui.globalSearchInput.value = '';
    }
    
    initializeSortableLists();
}

/**
 * Обробник зміни назви проєкту інлайн
 */
export async function handleTitleUpdate(e) {
    const newTitle = e.target.value;
    if (ui.workspaceTitle) ui.workspaceTitle.textContent = newTitle;
    if (currentProjectData) currentProjectData.title = newTitle;
    
    (async () => {
        setSaveStatus('saving');
        try {
            await updateProjectTitleAPI(currentProjectID, newTitle);
            projectCache.set(currentProjectID, currentProjectData);
            setSaveStatus('saved');
            
            callLoadProjects(); // КРИТИЧНО: ВИПРАВЛЕНО 'loadUserProjects()' -> 'callLoadProjects()'
            
        } catch (error) {
            handleError(error, "update-title-inline");
            setSaveStatus('error');
        }
    })();
    updateBreadcrumbs();
}

/**
 * Обробник глобального пошуку
 * @param {Event} e
 */
export function handleGlobalSearch(e) {
    if (e.key === 'Enter') {
        performGlobalSearch(e.target.value);
    }
}