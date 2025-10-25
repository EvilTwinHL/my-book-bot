// src/main.js - (Оновлено для v2.8.0)

import { CONFIG } from './core/config.js';
import { 
    ui, 
    currentProjectData, 
    currentUser, // <-- НОВЕ
    currentUserProfile, // <-- НОВЕ
    setCurrentUserProfile, // <-- НОВЕ
    firestore, // <-- НОВЕ
    selectedChapterIndex, 
    selectedCharacterIndex, 
    selectedLocationIndex, 
    selectedPlotlineIndex, 
    resetHistory, 
    recordHistory, 
    undo, 
    redo 
} from './state.js';
import { bindUIElements } from './ui/dom.js';
import { handleError, showToast } from './ui/global.js';
import { initializeFirebase, signIn, signOut } from './modules/auth.js';
import { handleCreateProject, handleContextEdit, handleContextDelete, handleContextExport } from './modules/projects.js';
import { handleBackToProjects, handleQuickAccessAction, handleTitleUpdate, switchTab } from './modules/workspace.js';
import { triggerManualSave } from './modules/save.js';
import { scheduleSave } from './api.js';
import { updateChapterWordCount } from './utils/stats.js';
import { 
    addChapter, 
    deleteChapter, 
    addCharacter, 
    deleteCharacter, 
    addLocation, 
    deleteLocation, 
    addPlotline, 
    deletePlotline, 
    selectChapter,
    selectCharacter,
    selectLocation,
    selectPlotline
} from './modules/lists.js';
import { sendChatMessage } from './modules/chat.js';
import { openSearchModal } from './modules/search.js'; // <-- Імпорт з v2.7.0
import { closeSearchResultsModal } from './ui/modal.js';


/**
 * @param {HTMLInputElement | HTMLTextAreaElement} element 
 * @param {string} fieldName 
 * @param {string} property 
 * @param {boolean} [isNumber=false] 
 */
function addSaveListener(element, fieldName, property, isNumber = false) {
    if (!element) return;
    
    element.addEventListener('focus', () => resetHistory(element));
    element.addEventListener('input', recordHistory);
    
    element.addEventListener('change', (e) => {
        if (e.isTrusted === false && (e.type === 'change' || e.type === 'input')) return;
        if (!currentProjectData || !fieldName) return;
        const value = isNumber ? parseFloat(e.target.value) : e.target.value;

        if (fieldName === 'content.chapters' && selectedChapterIndex !== null) {
            currentProjectData.content.chapters[selectedChapterIndex][property] = value;
            if (property === 'text') {
                currentProjectData.content.chapters[selectedChapterIndex].word_count = updateChapterWordCount(value);
            }
        } else if (fieldName === 'content.characters' && selectedCharacterIndex !== null) {
            currentProjectData.content.characters[selectedCharacterIndex][property] = value;
        } else if (fieldName === 'content.locations' && selectedLocationIndex !== null) {
            currentProjectData.content.locations[selectedLocationIndex][property] = value;
        } else if (fieldName === 'content.plotlines' && selectedPlotlineIndex !== null) {
            currentProjectData.content.plotlines[selectedPlotlineIndex][property] = value;
        } else if (fieldName.startsWith('content.')) { 
            const prop = fieldName.substring('content.'.length);
            currentProjectData.content[prop] = value;
        }

        if (fieldName.startsWith('content.') && ['chapters', 'characters', 'locations', 'plotlines'].includes(fieldName.substring('content.'.length))) {
            scheduleSave(fieldName, currentProjectData.content[fieldName.substring('content.'.length)]);
        } else {
            scheduleSave(fieldName, value);
        }

        if (property === 'title' || property === 'status' || property === 'name') {
            const { renderChaptersList, renderCharactersList, renderLocationsList, renderPlotlinesList } = require('./modules/lists.js');
            if (fieldName === 'content.chapters') renderChaptersList();
            if (fieldName === 'content.characters') renderCharactersList();
            if (fieldName === 'content.locations') renderLocationsList();
            if (fieldName === 'content.plotlines') renderPlotlinesList();
        }
    });
}

// --- v2.8.0: Функція зміни імені ---
/**
 * Відкриває модальне вікно для зміни імені користувача
 */
function handleChangeDisplayName() {
    if (!currentUser || !currentUserProfile || !firestore) return;
    
    // Використовуємо ту саму модалку
    ui.createEditModalTitle.textContent = "Змінити ім'я";
    ui.createEditInput.value = currentUserProfile.displayName;
    ui.createEditInput.placeholder = "Введіть нове ім'я";
    ui.createEditModal.classList.remove('hidden');
    ui.createEditInput.focus();
    ui.createEditInput.select();

    // Створюємо одноразових слухачів
    const confirmHandler = async () => {
        const newName = ui.createEditInput.value.trim();
        if (newName && newName !== currentUserProfile.displayName) {
            try {
                const userRef = firestore.collection('users').doc(currentUser.uid);
                await userRef.update({ displayName: newName });

                // Оновлюємо локальний стан та UI
                const updatedProfile = { ...currentUserProfile, displayName: newName };
                setCurrentUserProfile(updatedProfile);
                if (ui.headerUsername) ui.headerUsername.textContent = newName;
                
                showToast("Ім'я успішно змінено!", "success");
                
            } catch (e) {
                handleError(e, "update-display-name");
                showToast("Не вдалося змінити ім'я.", "error");
            }
        }
        closeModal();
    };

    const cancelHandler = () => {
        closeModal();
    };

    const closeModal = () => {
        ui.createEditModal.classList.add('hidden');
        ui.createEditConfirmBtn.removeEventListener('click', confirmHandler);
        ui.createEditCancelBtn.removeEventListener('click', cancelHandler);
    };

    ui.createEditConfirmBtn.addEventListener('click', confirmHandler);
    ui.createEditCancelBtn.addEventListener('click', cancelHandler);
}


/**
 * Прив'язує слухачі до елементів UI
 */
function setupGlobalListeners() {
    // --- Глобальні обробники ---
    window.addEventListener('beforeunload', (e) => {
        if (currentProjectData && currentProjectData.hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = 'У вас є незбережені зміни. Ви впевнені, що хочете піти?';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') { e.preventDefault(); undo(); } 
            else if (e.key === 'y') { e.preventDefault(); redo(); }
            else if (e.key === 's') { e.preventDefault(); triggerManualSave(); }
            else if (e.key === 'k') { 
                e.preventDefault(); 
                ui.globalSearchInput?.focus();
            }
        }
        if (e.key === 'Escape' && ui.searchResultsModal && !ui.searchResultsModal.classList.contains('hidden')) {
            closeSearchResultsModal();
        }
    });

    // --- Автентифікація ---
    ui.signInBtn?.addEventListener('click', signIn);
    // ui.signOutBtn?.addEventListener('click', signOut); // (Видалено v2.7.0)

    // --- v2.7.0 / v2.8.0: Хедер ---
    ui.headerLogoutBtn?.addEventListener('click', signOut); // (Переміщено)
    ui.headerUsername?.addEventListener('click', handleChangeDisplayName); // (НОВЕ)

    // --- Проєкти та Контекстне меню ---
    ui.createProjectBtn?.addEventListener('click', handleCreateProject);
    ui.projectContextMenu?.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = e.target.id;
        if (action === 'context-edit-btn') handleContextEdit();
        else if (action === 'context-delete-btn') handleContextDelete();
        else if (action === 'context-export-btn') handleContextExport();
    });

    // --- Робоча область (Загальне) ---
    ui.backToProjectsBtn?.addEventListener('click', handleBackToProjects);
    ui.breadcrumbProjects?.addEventListener('click', handleBackToProjects);
    ui.quickAccessBar?.addEventListener('click', handleQuickAccessAction);
    ui.saveStatusIndicator?.addEventListener('click', triggerManualSave);
    ui.workspaceTitleInput?.addEventListener('change', handleTitleUpdate);
    
    // --- Пошук (v2.7.1) ---
    ui.searchResultsCloseBtn?.addEventListener('click', closeSearchResultsModal);
    ui.globalSearchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            openSearchModal();
        }
    });

    // Toggle title edit mode
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
        if (e.key === 'Enter') { e.target.blur(); }
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
    
    // --- Обробники World (Світ) ---
    addSaveListener(ui.premiseTextarea, 'content.premise', 'premise');
    addSaveListener(ui.themeTextarea, 'content.theme', 'theme');
    addSaveListener(ui.mainArcTextarea, 'content.mainArc', 'mainArc');
    addSaveListener(ui.wordGoalInput, 'content.wordGoal', 'wordGoal', true);
    addSaveListener(ui.notesTextarea, 'content.notes', 'notes');
    addSaveListener(ui.researchTextarea, 'content.research', 'research');

    // --- Обробники Chapters (Розділи) ---
    ui.addChapterBtn?.addEventListener('click', addChapter);
    ui.chapterDeleteBtn?.addEventListener('click', deleteChapter);
    ui.prevChapterBtn?.addEventListener('click', (e) => { e.preventDefault(); selectChapter(selectedChapterIndex - 1); });
    ui.nextChapterBtn?.addEventListener('click', (e) => { e.preventDefault(); selectChapter(selectedChapterIndex + 1); });
    
    addSaveListener(ui.chapterTitleInput, 'content.chapters', 'title');
    addSaveListener(ui.chapterStatusSelect, 'content.chapters', 'status');
    addSaveListener(ui.chapterSynopsisTextarea, 'content.chapters', 'synopsis');
    addSaveListener(ui.chapterTextarea, 'content.chapters', 'text');
    
    ui.chapterTextarea?.addEventListener('input', (e) => {
        if (currentProjectData && selectedChapterIndex !== null) {
            currentProjectData.content.chapters[selectedChapterIndex].word_count = updateChapterWordCount(e.target.value);
        }
        recordHistory(e);
    });

    // --- Обробники Characters (Персонажі) ---
    ui.addCharacterBtn?.addEventListener('click', addCharacter);
    ui.characterDeleteBtn?.addEventListener('click', deleteCharacter);
    ui.prevCharacterBtn?.addEventListener('click', (e) => { e.preventDefault(); selectCharacter(selectedCharacterIndex - 1); });
    ui.nextCharacterBtn?.addEventListener('click', (e) => { e.preventDefault(); selectCharacter(selectedCharacterIndex + 1); });
    addSaveListener(ui.characterNameInput, 'content.characters', 'name');
    addSaveListener(ui.characterDescTextarea, 'content.characters', 'description');
    addSaveListener(ui.characterArcTextarea, 'content.characters', 'arc');
    
    // --- Обробники Locations (Локації) ---
    ui.addLocationBtn?.addEventListener('click', addLocation);
    ui.locationDeleteBtn?.addEventListener('click', deleteLocation);
    ui.prevLocationBtn?.addEventListener('click', (e) => { e.preventDefault(); selectLocation(selectedLocationIndex - 1); });
    ui.nextLocationBtn?.addEventListener('click', (e) => { e.preventDefault(); selectLocation(selectedLocationIndex + 1); });
    addSaveListener(ui.locationNameInput, 'content.locations', 'name');
    addSaveListener(ui.locationDescTextarea, 'content.locations', 'description');
    
    // --- Обробники Plotlines (Сюжетні лінії) ---
    ui.addPlotlineBtn?.addEventListener('click', addPlotline);
    ui.plotlineDeleteBtn?.addEventListener('click', deletePlotline);
    ui.prevPlotlineBtn?.addEventListener('click', (e) => { e.preventDefault(); selectPlotline(selectedPlotlineIndex - 1); });
    ui.nextPlotlineBtn?.addEventListener('click', (e) => { e.preventDefault(); selectPlotline(selectedPlotlineIndex + 1); });
    addSaveListener(ui.plotlineTitleInput, 'content.plotlines', 'title');
    addSaveListener(ui.plotlineDescTextarea, 'content.plotlines', 'description');

    // --- Обробники Chat (Чат) ---
    ui.sendButton?.addEventListener('click', sendChatMessage);
    ui.userInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
}


// ▼▼▼ ОНОВЛЕНИЙ БЛОК ЗАВАНТАЖЕННЯ (з v2.7.0) ▼▼▼
document.addEventListener('DOMContentLoaded', () => {
    try {
        // 1. Зв'язуємо UI елементи В ПЕРШУ ЧЕРГУ.
        bindUIElements();
        
        // 2. Тепер, коли UI зв'язаний, ми можемо логувати та оновлювати UI.
        console.log(`Ініціалізація Opus: Бот-Співавтор v${CONFIG.APP_VERSION}`);
        
        if (ui.versionNumber) { 
            ui.versionNumber.textContent = CONFIG.APP_VERSION;
        }

        // 3. Встановлюємо слухачі
        setupGlobalListeners();

        // 4. Ініціалізуємо Firebase
        initializeFirebase();
        
    } catch (e) {
        console.error("Критична помилка під час DOMContentLoaded:", e);
        handleError(e, "DOMContentLoaded_init");
        showToast("Критична помилка ініціалізації. Перевірте консоль.", "error");
    }
});