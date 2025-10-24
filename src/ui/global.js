// src/ui/global.js

import { ui, hasUnsavedChanges, setHasUnsavedChanges } from '../state.js';
import { CONFIG } from '../core/config.js';
import { logError } from '../api.js';

// === Управління станом UI ===

/**
 * @param {Error | string} error
 * @param {string} [context]
 */
export function handleError(error, context = "Невідома помилка") {
    console.error(`[${context}]:`, error);
    
    // 1. Логування на сервері
    logError(error, context);
    
    // 2. Показ тосту
    let message = (error instanceof Error) ? error.message : String(error);
    if (context !== "auth-check") {
        showToast(`Помилка: ${message}`, 'error');
    }
}

/**
 * @param {string} message
 * @param {'info' | 'error' | 'success'} type
 */
export function showToast(message, type = 'info') {
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

export function showSpinner(message = "Завантаження...") {
    console.log(message); 
    if (ui.spinner) ui.spinner.classList.remove('hidden');
}

export function hideSpinner() {
    if (ui.spinner) ui.spinner.classList.add('hidden');
}

/**
 * @param {string} view 
 */
export function showView(view) {
    if (ui.authContainer) ui.authContainer.classList.add('hidden');
    if (ui.projectsContainer) ui.projectsContainer.classList.add('hidden');
    if (ui.workspaceContainer) ui.workspaceContainer.classList.add('hidden');

    if (view === 'auth' && ui.authContainer) {
        ui.authContainer.classList.remove('hidden');
    } else if (view === 'projects' && ui.projectsContainer) {
        ui.projectsContainer.classList.remove('hidden');
        if (ui.breadcrumbs) ui.breadcrumbs.classList.add('hidden');
        if (ui.quickAccessBar) ui.quickAccessBar.classList.add('hidden');
    } else if (view === 'workspace' && ui.workspaceContainer) {
        ui.workspaceContainer.classList.remove('hidden');
        if (ui.breadcrumbs) ui.breadcrumbs.classList.remove('hidden');
        if (ui.quickAccessBar) ui.quickAccessBar.classList.remove('hidden');
    }
}

/**
 * @param {'saved' | 'saving' | 'error' | 'unsaved'} status
 */
export function setSaveStatus(status) {
    if (!ui.saveStatusIndicator || !ui.saveStatusText) return;

    ui.saveStatusIndicator.classList.remove('status-saved', 'status-saving', 'status-error', 'status-unsaved');
    ui.saveStatusSpinner?.classList.add('hidden');
    setHasUnsavedChanges(false);

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
            setHasUnsavedChanges(true);
            break;
        case 'error':
            ui.saveStatusIndicator.classList.add('status-error');
            ui.saveStatusText.textContent = 'Помилка';
            setHasUnsavedChanges(true);
            break;
    }
}
