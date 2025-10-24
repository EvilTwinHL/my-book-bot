// src/state.js

import { CONFIG } from './core/config.js';

// === ГЛОБАЛЬНІ ЗМІННІ ===
export let ui = {}; // DOM elements placeholder
export let auth, provider, firestore; // Firebase references
export let currentUser = null;
export let currentProjectID = null;
export let currentTab = 'chapters';

/** @type {object | null} Зберігає ВСІ дані поточного проєкту */
export let currentProjectData = null; 
export let selectedChapterIndex = null;
export let selectedCharacterIndex = null;
export let selectedLocationIndex = null;
export let selectedPlotlineIndex = null;

/** @type {{timer: Timeout | null, func: Function | null}} Таймер автозбереження */
export let pendingSave = { timer: null, func: null };

/** @type {boolean} Прапор для onbeforeunload */
export let hasUnsavedChanges = false;


// === Менеджер Історії (Undo/Redo) ===
export const historyManager = {
    /** @type {HTMLInputElement | HTMLTextAreaElement | null} */
    currentField: null,
    /** @type {string[]} */
    stack: [],
    pointer: -1,
    isRestoring: false,
    debounceTimer: null
};

// === Оновлення стану ===
export function setUI(newUI) { ui = newUI; }
export function setFirebaseRefs(newAuth, newProvider, newFirestore) {
    auth = newAuth;
    provider = newProvider;
    firestore = newFirestore;
}
export function setCurrentUser(user) { currentUser = user; }
export function setCurrentProjectID(id) { currentProjectID = id; }
export function setCurrentProjectData(data) { currentProjectData = data; }
export function setCurrentTab(tab) { currentTab = tab; }

export function setSelectedChapterIndex(index) { selectedChapterIndex = index; }
export function setSelectedCharacterIndex(index) { selectedCharacterIndex = index; }
export function setSelectedLocationIndex(index) { selectedLocationIndex = index; }
export function setSelectedPlotlineIndex(index) { selectedPlotlineIndex = index; }

export function setHasUnsavedChanges(value) { hasUnsavedChanges = value; }

// === Функції Історії ===

/**
 * @param {HTMLInputElement | HTMLTextAreaElement} [field]
 */
export function resetHistory(field = null) {
    historyManager.currentField = field;
    historyManager.stack = field ? [field.value] : [];
    historyManager.pointer = 0;
    historyManager.isRestoring = false;
    if (historyManager.debounceTimer) {
        clearTimeout(historyManager.debounceTimer);
        historyManager.debounceTimer = null;
    }
}

/**
 * @param {Event} e
 */
export function recordHistory(e) {
    if (historyManager.isRestoring || !historyManager.currentField) {
        return;
    }
    
    if (historyManager.debounceTimer) {
        clearTimeout(historyManager.debounceTimer);
    }
    
    historyManager.debounceTimer = setTimeout(() => {
        const value = e.target.value;
        if (value === historyManager.stack[historyManager.pointer]) {
            return;
        }
        
        if (historyManager.pointer < historyManager.stack.length - 1) {
            historyManager.stack = historyManager.stack.slice(0, historyManager.pointer + 1);
        }
        
        historyManager.stack.push(value);
        historyManager.pointer = historyManager.stack.length - 1;
        
        historyManager.debounceTimer = null;
    }, CONFIG.HISTORY_DEBOUNCE);
}

/**
 * @param {boolean} [isRedo=false]
 */
function applyHistoryChange(isRedo = false) {
    if (!historyManager.currentField) return;
    
    const newPointer = historyManager.pointer + (isRedo ? 1 : -1);
    
    if (newPointer < 0 || newPointer >= historyManager.stack.length) {
        return;
    }

    historyManager.isRestoring = true;
    historyManager.pointer = newPointer;
    const value = historyManager.stack[historyManager.pointer];
    historyManager.currentField.value = value;
    
    // Подія 'input' для оновлення лічильників слів, 'change' для збереження
    historyManager.currentField.dispatchEvent(new Event('input', { bubbles: true }));
    historyManager.currentField.dispatchEvent(new Event('change', { bubbles: true }));
    historyManager.isRestoring = false;
}

export function undo() { applyHistoryChange(false); }
export function redo() { applyHistoryChange(true); }
