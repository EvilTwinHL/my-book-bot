// src/ui/dom.js - (ОНОВЛЕНО ФАЗА 4: Додано модалку деталей проєкту)

import { setUI } from '../state.js';

/**
 * Зв'язує всі DOM-елементи з об'єктом `ui` для легкого доступу.
 */
export function bindUIElements() {
    const ui = {
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
        
        // === НОВА МОДАЛКА (ФАЗА 4) ===
        projectDetailsModal: document.getElementById('project-details-modal'),
        projectDetailsTitle: document.getElementById('project-details-title'),
        projectDetailsNameInput: document.getElementById('project-details-name-input'),
        projectDetailsGenreInput: document.getElementById('project-details-genre-input'),
        projectDetailsImageInput: document.getElementById('project-details-image-input'),
        projectDetailsConfirmBtn: document.getElementById('project-details-confirm-btn'),
        projectDetailsCancelBtn: document.getElementById('project-details-cancel-btn'),
        // ==============================

        // --- АУТЕНТИФІКАЦІЯ ---
        authContainer: document.getElementById('auth-container'),
        signInBtn: document.getElementById('signInBtn'), 

        // --- v2.7.0: Глобальний Хедер ---
        globalHeader: document.getElementById('global-header'),
        usernameContainer: document.getElementById('username-container'),
        headerUsername: document.getElementById('header-username'),
        editUsernameIcon: document.getElementById('edit-username-icon'),
        headerLogoutBtn: document.getElementById('header-logout-btn'),
        globalSearchInput: document.getElementById('global-search-input'),

        // --- Головний контейнер ---
        workspaceContainer: document.getElementById('workspace-container'),
        
        // --- Панель проєктів ---
        projectsView: document.getElementById('projects-view'), 
        projectsContainer: document.getElementById('projects-container'),
        projectsList: document.getElementById('projects-list'),
        createProjectBtn: document.getElementById('create-project-btn'),
        
        // --- Контекстне меню проєкту ---
        projectContextMenu: document.getElementById('project-context-menu'),
        contextEditBtn: document.getElementById('context-edit-btn'),
        contextExportBtn: document.getElementById('context-export-btn'),
        contextDeleteBtn: document.getElementById('context-delete-btn'),

        // --- Робоча область: Навігація ---
        workspaceHeader: document.getElementById('workspace-header'),
        workspaceTitle: document.getElementById('workspace-title'),
        
        // === ВИДАЛЕНО (ФАЗА 3) ===
        // workspaceTitleInput: document.getElementById('workspace-title-input'),
        
        saveStatusIndicator: document.getElementById('save-status-indicator'),
        saveStatusText: document.getElementById('save-status-text'),
        saveStatusSpinner: document.getElementById('save-status-spinner'),
        backToProjectsBtn: document.getElementById('back-to-projects-btn'),
        
        breadcrumbs: document.getElementById('breadcrumbs'), 
        breadcrumbProjects: document.getElementById('breadcrumb-projects'), 
        breadcrumbCurrent: document.getElementById('breadcrumb-current'), 
        quickAccessBar: document.getElementById('quick-access-bar'),
        navProgress: document.getElementById('nav-progress'), 

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
        
        // Контекстна навігація Розділів
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
        
        // Контекстна навігація Персонажів
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
        
        // Контекстна навігація Локацій
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
        
        // Контекстна навігація Сюжетних ліній
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
        
        // Опції контексту чату
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
    
    // Встановлення об'єкта ui в глобальний стан
    setUI(ui);
    
    console.log("Елементи UI зв'язані (включно з новою модалкою).");
}