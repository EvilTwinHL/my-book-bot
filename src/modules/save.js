// src/modules/save.js

import { pendingSave, hasUnsavedChanges, ui } from '../state.js';
import { scheduleSave as scheduleSaveAPI } from '../api.js';
import { showToast, setSaveStatus } from '../ui/global.js';

export function scheduleSave(field, value) {
    scheduleSaveAPI(field, value);
}

// === ФУНКЦІЯ ПРИМУСОВОГО ЗБЕРЕЖЕННЯ ===
export function triggerManualSave() {
    if (!hasUnsavedChanges && !pendingSave.timer) {
        setSaveStatus('saved');
        showToast("Все збережено", "info");
        return;
    }
    
    // Знімаємо фокус з активного елемента, щоб змусити спрацювати onchange/onsave
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT') && activeEl !== document.body) {
        // Тригеримо change, який запустить scheduleSave
        activeEl.dispatchEvent(new Event('change', { bubbles: true }));
        activeEl.blur(); 
    }
    
    // Якщо є запланована функція, виконуємо її негайно
    if (pendingSave.func) {
        clearTimeout(pendingSave.timer);
        console.log("Примусове виконання збереження, що очікувало...");
        pendingSave.func(); // Викликаємо збереження негайно
        pendingSave.timer = null;
        pendingSave.func = null;
    } else if (hasUnsavedChanges) {
        // Якщо auto-save не спрацював, але зміни є
        setSaveStatus('saved');
    }
}
