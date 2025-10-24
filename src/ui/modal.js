// src/ui/modal.js

import { ui } from '../state.js';
import { showToast } from './global.js';

/**
 * @param {string} title
 * @param {string} text
 * @returns {Promise<boolean>} 
 */
export function showConfirmModal(title, text) {
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
export function showCreateEditModal(title, initialValue = '') {
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

export function closeSearchResultsModal() {
    if (!ui.searchResultsModal || !ui.globalSearchInput) return;
    ui.searchResultsModal.classList.add('hidden');
    ui.globalSearchInput.value = '';
}