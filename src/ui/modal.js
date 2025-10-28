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
        if (!ui.simpleEditModal) return resolve(null);
        
        ui.simpleEditModalTitle.textContent = title;
        ui.simpleEditModalInput.value = initialValue;
        ui.simpleEditModal.classList.remove('hidden');
        ui.simpleEditModalInput.focus();
        ui.simpleEditModalInput.select();

        const confirmHandler = () => {
            const value = ui.simpleEditModalInput.value.trim();
            if (value) {
                ui.simpleEditModal.classList.add('hidden');
                cleanup();
                resolve(value);
            } else {
                showToast("Назва не може бути порожньою.", "error");
            }
        };

        const cancelHandler = () => {
            ui.simpleEditModal.classList.add('hidden');
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
            ui.simpleEditModalConfirmBtn.removeEventListener('click', confirmHandler);
            ui.simpleEditModalCancelBtn.removeEventListener('click', cancelHandler);
            ui.simpleEditModalInput.removeEventListener('keydown', keyHandler);
        };

        ui.simpleEditModalConfirmBtn.addEventListener('click', confirmHandler);
        ui.simpleEditModalCancelBtn.addEventListener('click', cancelHandler);
        ui.simpleEditModalInput.addEventListener('keydown', keyHandler);
    });
}

export function closeSearchResultsModal() {
    if (!ui.searchResultsModal || !ui.globalSearchInput) return;
    ui.searchResultsModal.classList.add('hidden');
    ui.globalSearchInput.value = '';
}

/**
 * @returns {Promise<{title: string, genre: string, imageURL: string} | null>}
 */
export function showCreateProjectModal() {
    return new Promise(resolve => {
        if (!ui.createEditModal) return resolve(null);

        // Reset fields
        ui.createEditModalTitle.textContent = 'Створення нової книги';
        ui.createModalTitleInput.value = '';
        ui.createModalGenreSelect.value = '';
        ui.createModalImageSelect.value = '/assets/card-placeholder.png';

        ui.createEditModal.classList.remove('hidden');
        ui.createModalTitleInput.focus();

        const confirmHandler = () => {
            const title = ui.createModalTitleInput.value.trim();
            const genre = ui.createModalGenreSelect.value;
            const imageURL = ui.createModalImageSelect.value;

            if (!title) {
                showToast("Назва книги не може бути порожньою.", "error");
                return;
            }
            if (!genre) {
                showToast("Будь ласка, оберіть жанр.", "error");
                return;
            }

            cleanup();
            resolve({ title, genre, imageURL });
        };

        const cancelHandler = () => {
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
            ui.createEditModal.classList.add('hidden');
            ui.createModalConfirmBtn.removeEventListener('click', confirmHandler);
            ui.createModalCancelBtn.removeEventListener('click', cancelHandler);
            document.removeEventListener('keydown', keyHandler);
        };

        ui.createModalConfirmBtn.addEventListener('click', confirmHandler);
        ui.createModalCancelBtn.addEventListener('click', cancelHandler);
        document.addEventListener('keydown', keyHandler);
    });
}
