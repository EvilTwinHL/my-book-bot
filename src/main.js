// src/main.js - Головна точка входу (v2.6.0)

import { CONFIG } from './core/config.js';
import { 
    ui, 
    currentProjectData, 
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
import { handleBackToProjects, handleQuickAccessAction, handleTitleUpdate, handleGlobalSearch, switchTab } from './modules/workspace.js';
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
import { closeSearchResultsModal } from './ui/modal.js';


/**
 * @param {HTMLInputElement | HTMLTextAreaElement} element 
 * @param {string} fieldName 
 * @param {string} property 
 * @param {boolean} [isNumber=false] 
 */
function addSaveListener(element, fieldName, property, isNumber = false) {
    if (!element) return;
    
    // Історія
    element.addEventListener('focus', () => resetHistory(element));
    element.addEventListener('input', recordHistory);
    
    element.addEventListener('change', (e) => {
        // Якщо це була дія історії (undo/redo), state.js вже оновив значення, просто зберігаємо
        if (e.isTrusted === false && (e.type === 'change' || e.type === 'input')) return;

        if (!currentProjectData || !fieldName) return;

        const value = isNumber ? parseFloat(e.target.value) : e.target.value;

        // Оновлення локального стану
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
        } else if (fieldName.startsWith('content.')) { // World fields
            const prop = fieldName.substring('content.'.length);
            currentProjectData.content[prop] = value;
        }

        // Запуск збереження
        if (fieldName.startsWith('content.') && ['chapters', 'characters', 'locations', 'plotlines'].includes(fieldName.substring('content.'.length))) {
            scheduleSave(fieldName, currentProjectData.content[fieldName.substring('content.'.length)]);
        } else {
            scheduleSave(fieldName, value);
        }

        // Оновлення списку (якщо потрібно)
        if (property === 'title' || property === 'status' || property === 'name') {
            const { renderChaptersList, renderCharactersList, renderLocationsList, renderPlotlinesList } = require('./modules/lists.js');
            if (fieldName === 'content.chapters') renderChaptersList();
            if (fieldName === 'content.characters') renderCharactersList();
            if (fieldName === 'content.locations') renderLocationsList();
            if (fieldName === 'content.plotlines') renderPlotlinesList();
        }
    });
}

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
            else if (e.key === 'k') { e.preventDefault(); handleQuickAccessAction({ target: { closest: () => ({ dataset: { action: 'global-search' } }) } }) }
        }
        if (e.key === 'Escape' && ui.searchResultsModal && !ui.searchResultsModal.classList.contains('hidden')) {
            closeSearchResultsModal();
        }
    });

    // --- Автентифікація ---
    ui.signInBtn?.addEventListener('click', signIn);
    ui.signOutBtn?.addEventListener('click', signOut);

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
    ui.globalSearchInput?.addEventListener('keydown', handleGlobalSearch);
    ui.searchResultsCloseBtn?.addEventListener('click', closeSearchResultsModal);

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


document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log(`Ініціалізація Opus: Бот-Співавтор v${CONFIG.APP_VERSION}`);
        
        bindUIElements();
        
        if (ui.versionNumber) { 
            ui.versionNumber.textContent = CONFIG.APP_VERSION;
        }

        setupGlobalListeners();

        initializeFirebase();
        
    } catch (e) {
        handleError(e, "DOMContentLoaded_init");
        showToast("Критична помилка ініціалізації. Перевірте консоль браузера.", "error");
    }
});
