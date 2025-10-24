// src/api.js

import { 
    currentUser, 
    currentProjectID, 
    currentProjectData, 
    setCurrentProjectData, 
} from './state.js';
import { projectCache } from './core/cache.js';
import { handleError, setSaveStatus } from './ui/global.js';
import { updateTotalWordCount } from './utils/stats.js';

/**
 * Централізована функція для виконання запитів до бекенду.
 * @param {string} path 
 * @param {string} [method='GET']
 * @param {object} [body=null]
 * @returns {Promise<object>}
 */
async function fetchBackend(path, method = 'GET', body = null) {
    const options = {
        method: method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(path, options);

    if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
            errorData = JSON.parse(errorText);
        } catch {
            errorData = { error: errorText || `HTTP помилка! Статус: ${response.status}` };
        }
        throw new Error(errorData.error || `HTTP помилка! Статус: ${response.status}`);
    }

    // Для деяких запитів (наприклад, експорт) відповідь не JSON
    if (response.headers.get('content-type')?.includes('application/json')) {
        return response.json();
    }
    return response; 
}

// === Проєкти (CRUD) ===

export async function fetchProjects() {
    if (!currentUser) return [];
    return fetchBackend(`/get-projects?user=${currentUser.uid}`);
}

export async function fetchProjectContent(projectID) {
    const freshData = await fetchBackend(`/get-project-content?projectID=${projectID}`);
    
    // v2.5.6: Гарантуємо, що масиви існують після завантаження з сервера
    const normalizedData = {
        ...freshData,
        content: { 
            ...(freshData.content || {}),
            chapters: freshData.content?.chapters || [],
            characters: freshData.content?.characters || [],
            locations: freshData.content?.locations || [],
            plotlines: freshData.content?.plotlines || [],
        },
        chatHistory: freshData.chatHistory || [],
    };
    return normalizedData;
}

export async function createNewProject(title, user) {
    return fetchBackend('/create-project', 'POST', { title, user });
}

export async function deleteProjectAPI(projectID) {
    return fetchBackend('/delete-project', 'POST', { projectID });
}

export async function updateProjectTitleAPI(projectID, newTitle) {
    return fetchBackend('/update-title', 'POST', { projectID, newTitle });
}

export async function exportProjectAPI(projectID) {
    return fetchBackend(`/export-project?projectID=${projectID}`, 'GET');
}


// === Збереження (Save) ===

/**
 * @param {string} field - Поле для збереження (напр., 'content.chapters')
 * @param {any} value - Нове значення
 */
export async function scheduleSave(field, value) {
    setSaveStatus('unsaved');
    
    const { pendingSave, CONFIG } = await import('./state.js');

    if (pendingSave.timer) {
        clearTimeout(pendingSave.timer);
    }
    
    const saveFunction = async () => {
        setSaveStatus('saving');
        
        try {
            await fetchBackend('/save-project-content', 'POST', {
                projectID: currentProjectID,
                field: field,
                value: value
            });
            
            projectCache.set(currentProjectID, currentProjectData);
            
            setSaveStatus('saved');
            console.log(`Збережено: ${field}`);
            
            if (field === 'content.chapters') {
                updateTotalWordCount();
                (await import('./modules/projects.js')).loadUserProjects();
            }

        } catch (error) {
            handleError(error, "schedule-save");
            setSaveStatus('error');
        }
        
        pendingSave.timer = null;
        pendingSave.func = null;
    };

    pendingSave.func = saveFunction;
    pendingSave.timer = setTimeout(saveFunction, CONFIG.AUTOSAVE_DELAY);
}

// === Чат (Chat) ===

export async function sendChatMessageAPI(messageText, contextOptions) {
    const response = await fetchBackend('/chat', 'POST', {
        projectID: currentProjectID,
        message: messageText,
        contextOptions: contextOptions 
    });
    
    if (currentProjectData) {
        currentProjectData.chatHistory.push({ role: 'user', parts: [{ text: messageText }] });
        currentProjectData.chatHistory.push({ role: "model", parts: [{ text: response.message }] });
        projectCache.set(currentProjectID, currentProjectData);
    }
    
    return response.message;
}

// === Логування помилок ===

/**
 * @param {Error | string} error
 * @param {string} context
 */
export function logError(error, context = "Невідома помилка") {
    let message = (error instanceof Error) ? error.message : String(error);
    
    fetch('/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            message: message, 
            stack: (error instanceof Error) ? error.stack : 'N/A', 
            context: context, 
            user: currentUser ? currentUser.uid : 'anonymous',
            project: currentProjectID || 'N/A'
        })
    }).catch(err => console.error("Не вдалося залогувати помилку на сервер:", err));
}
