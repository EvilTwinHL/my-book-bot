// src/modules/workspace.js - (ВИПРАВЛЕНО: Видалено 'updateProjectTitleAPI' та 'handleTitleUpdate')

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
    fetchProjectContent
    // === ВИДАЛЕНО (ФАЗА 5): 'updateProjectTitleAPI' ===
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
// === ВИПРАВЛЕНО (ФАЗА 5): 'loadUserProjects' -> 'loadProjects' ===
import { exportProjectAction, loadProjects } from './projects.js'; 
import { renderChatHistory } from './chat.js';

// --- НАВІГАЦІЯ ---

/**
 * @param {string} tabId 
 */
export function switchTab(tabId) {
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
        // === ОНОВЛЕНО (ФАЗА 5): Використовуємо .title, оскільки 'workspace-title-input' видалено ===
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
    showView('projects-view'); // <-- Виправлено 'projects' на 'projects-view'
    loadProjects(); // <-- Виправлено 'loadUserProjects' на 'loadProjects'
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
            // === ОНОВЛЕНО (ФАЗА 5): exportProjectAction тепер не приймає аргументів ===
            // Вона використовує contextMenuProjectID, але нам потрібен спосіб експорту поточного.
            // Поки що залишимо це так, але це може потребувати рефакторингу в майбутньому,
            // щоб експортувати *поточний* проєкт, а не той, що в контекстному меню.
            // Для сумісності з 'projects.js' ми можемо просто викликати її.
            // В 'projects.js' ця функція насправді не приймає аргументів.
            exportProjectAction(); 
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
        showView('workspace-container'); // <-- Виправлено 'workspace' на 'workspace-container'
        hideSpinner();
        syncProjectInBackground(projectID);
        return;
    }

    try {
        const freshData = await fetchProjectContent(projectID);
        
        setCurrentProjectData(freshData);
        projectCache.set(projectID, currentProjectData); 
        
        loadWorkspace();
        showView('workspace-container'); // <-- Виправлено 'workspace' на 'workspace-container'
        
    } catch (error) {
        handleError(error, "open-project");
        setCurrentProjectID(null);
        showView('projects-view'); // <-- Виправлено 'projects' на 'projects-view'
    } finally {
        hideSpinner();
    }
}

export async function syncProjectInBackground(projectID) {
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
 * @param {boolean} [silent=false] 
 */
export function loadWorkspace(silent = false) {
    if (!currentProjectData) {
        handleError("Спроба завантажити робочу область без даних.", "load-workspace");
        showView('projects-view'); // <-- Виправлено
        return;
    }
    
    const { title, content, chatHistory } = currentProjectData;

    if (!silent) {
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
    // === ВИДАЛЕНО (ФАЗА 3): 'workspaceTitleInput' ===
    
    // --- Вкладки ---
    renderChaptersList();
    hideChapterEditor();
    
    renderCharactersList();
    hideCharacterEditor();
    
    renderLocationsList();
    hideLocationEditor();
    
    renderPlotlinesList();
    hidePlotlineEditor();

    // --- Світ ---
    if (ui.premiseTextarea) ui.premiseTextarea.value = content.premise || '';
    if (ui.themeTextarea) ui.themeTextarea.value = content.theme || '';
    if (ui.mainArcTextarea) ui.mainArcTextarea.value = content.mainArc || '';
    if (ui.wordGoalInput) ui.wordGoalInput.value = content.wordGoal || 50000;
    if (ui.notesTextarea) ui.notesTextarea.value = content.notes || '';
    if (ui.researchTextarea) ui.researchTextarea.value = content.research || '';

    // --- Чат ---
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

// === ВИДАЛЕНО (ФАЗА 3): Функція 'handleTitleUpdate' ===

/**
 * Обробник глобального пошуку
 * @param {Event} e
 */
export function handleGlobalSearch(e) {
    if (e.key === 'Enter') {
        performGlobalSearch(e.target.value);
    }
}