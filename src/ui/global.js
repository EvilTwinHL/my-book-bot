// src/ui/global.js (v3.0.2: ФІНАЛЬНИЙ FIX view IDs)

import { ui, hasUnsavedChanges, setHasUnsavedChanges } from '../state.js';
import { CONFIG } from '../core/config.js';
import { logError } from '../api.js';

// === Управління станом UI ===

/**
 * Глобальна функція для логування всіх помилок.
 * @param {Error | string} error 
 * @param {string} [context] 
 */
export function handleError(error, context = "Невідома помилка") {
    console.error(`[${context}]:`, error);
    
    // 1. Логування на сервері
    // logError(error, context); // Залишаємо вимкненим, щоб уникнути додаткових помилок під час ініціалізації
    
    // 2. Показ тосту
    let message = (error instanceof Error) ? error.message : String(error);
    if (context !== "auth-check") {
        // Ми не показуємо тост, якщо ui.toastContainer ще не ініціалізовано,
        // тому перевірка на ui.toastContainer відбувається всередині showToast
        showToast(`Помилка: ${message}`, 'error');
    }
}

/**
 * Показує повідомлення Toast.
 * @param {string} message 
 * @param {'info' | 'error' | 'success'} type 
 */
export function showToast(message, type = 'info') {
    if (!ui.toastContainer) return; // Надійна перевірка
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    ui.toastContainer.appendChild(toast);
    
    // Показуємо
    setTimeout(() => {
        toast.classList.add('show');
    }, 10); 

    // Ховаємо
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            // Надійна перевірка перед видаленням
            if (ui.toastContainer && ui.toastContainer.contains(toast)) {
                 ui.toastContainer.removeChild(toast);
            }
        }, 500);
    }, CONFIG.TOAST_DURATION || 3000); // Використовуємо фолбек для CONFIG
}

export function showSpinner(message = "Завантаження...") {
    console.log(message); 
    if (ui.spinner) ui.spinner.classList.remove('hidden'); // Надійна перевірка
}

export function hideSpinner() {
    if (ui.spinner) ui.spinner.classList.add('hidden'); // Надійна перевірка
}

/**
 * Перемикає відображуваний основний контейнер.
 * @param {'auth-container'|'projects-view'|'workspace-container'} viewId 
 */
export function showView(viewId) {
    console.log(`[View Switch]: Переключення на #${viewId}`);
    
    // Визначення елементів, які ми хочемо приховати
    const allViews = [
        ui.authContainer,      // #auth-container
        ui.projectsView,       // #projects-view (ми припустимо, що ui.projectsContainer - це помилково названий ui.projectsView)
        ui.workspaceContainer  // #workspace-container
    ];
    
    // 1. Приховуємо всі основні View
    allViews.forEach(viewEl => {
        if (viewEl) viewEl.classList.add('hidden');
    });

    // 2. Визначаємо цільове View та перемикаємо його
    let targetView = null;
    
    // Використовуємо ID, як ми їх визначили в інших модулях
    if (viewId === 'auth-container') {
        targetView = ui.authContainer;
    } else if (viewId === 'projects-view') { 
        targetView = ui.projectsView;
    } else if (viewId === 'workspace-container') {
        targetView = ui.workspaceContainer;
    }
    
    if (targetView) {
        targetView.classList.remove('hidden');
    } else {
        handleError(new Error(`Критична помилка: Елемент #${viewId} не знайдено в DOM/ui.`), "show-view-fail");
        return; // Зупиняємо виконання, якщо не вдалося знайти
    }

    // 3. Додаткова логіка навігації (для Projects/Workspace)
    // viewId: 'projects-view' - це контейнер для списку проєктів
    if (viewId === 'projects-view') {
        if (ui.breadcrumbs) ui.breadcrumbs.classList.add('hidden');
        if (ui.quickAccessBar) ui.quickAccessBar.classList.add('hidden');
        if (ui.globalHeader) ui.globalHeader.classList.remove('hidden'); 
    } 
    
    // viewId: 'workspace-container'
    else if (viewId === 'workspace-container') {
        if (ui.breadcrumbs) ui.breadcrumbs.classList.remove('hidden');
        if (ui.quickAccessBar) ui.quickAccessBar.classList.remove('hidden');
        if (ui.globalHeader) ui.globalHeader.classList.remove('hidden'); 
    }
    
    // viewId: 'auth-container'
    else if (viewId === 'auth-container') {
        if (ui.globalHeader) ui.globalHeader.classList.add('hidden');
    }
    
    // Завжди приховуємо модальні вікна при переключенні View
    ui.createEditModal?.classList.add('hidden');
    ui.confirmModal?.classList.add('hidden');
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