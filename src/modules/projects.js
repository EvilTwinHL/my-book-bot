// src/modules/projects.js

import { 
    currentUser, 
    currentProjectID, 
    currentProjectData, 
    setCurrentProjectData, 
    setCurrentProjectID, 
    ui, 
    hasUnsavedChanges 
} from '../state.js';
import { 
    showSpinner, 
    hideSpinner, 
    handleError, 
    showToast, 
    showView 
} from '../ui/global.js';
import { 
    showConfirmModal, 
    showCreateEditModal 
} from '../ui/modal.js';
import { 
    fetchProjects, 
    createNewProject, 
    deleteProjectAPI, 
    updateProjectTitleAPI, 
    exportProjectAPI 
} from '../api.js';
import { projectCache } from '../core/cache.js';
import { escapeHTML } from '../utils/utils.js';
import { openProject, updateBreadcrumbs } from './workspace.js';

let contextMenuProjectID = null;
let contextMenuProjectTitle = null;

// --- Рендеринг ---

/**
 * @param {Array<object>} projects
 */
function renderProjectsList(projects) {
    if (!ui.projectsList) return;
    
    if (projects.length === 0) {
        ui.projectsList.innerHTML = '<p class="empty-list-info">У вас ще немає проєктів. Натисніть "Створити проєкт", щоб почати.</p>';
        return;
    }
    
    ui.projectsList.innerHTML = ''; 
    projects.forEach(project => {
        const item = document.createElement('div');
        item.className = 'project-item';
        item.dataset.id = project.id;
        
        item.innerHTML = `
            <h3>${escapeHTML(project.title)}</h3>
            <p>Слів: ${project.totalWordCount || 0}</p>
            <p>Оновлено: ${new Date(project.updatedAt).toLocaleString('uk-UA')}</p>
        `;
        item.addEventListener('click', () => openProject(project.id));
        item.addEventListener('contextmenu', (e) => showProjectContextMenu(e, project.id, project.title));
        ui.projectsList.appendChild(item);
    });
}

// --- CRUD та Завантаження ---

export async function loadUserProjects() {
    if (!currentUser) return;
    showSpinner("Завантаження проєктів...");
    
    if (ui.projectsList) ui.projectsList.innerHTML = '<div class="skeleton-item"></div><div class="skeleton-item"></div><div class="skeleton-item"></div>';

    try {
        const projects = await fetchProjects();
        renderProjectsList(projects);
    } catch (error) {
        handleError(error, "load-projects");
        if (ui.projectsList) ui.projectsList.innerHTML = '<p class="empty-list-info error-info">Не вдалося завантажити список проєктів. Спробуйте оновити сторінку.</p>';
    } finally {
        hideSpinner();
    }
}

export async function createProject() {
    if (!currentUser) return;

    const title = await showCreateEditModal("Створити новий проєкт", "Нова книга");
    if (!title) return;

    showSpinner("Створення проєкту...");
    try {
        const newProject = await createNewProject(title, currentUser.uid);
        
        setCurrentProjectID(newProject.id);
        setCurrentProjectData({ 
            ...newProject.data, 
            content: { 
                ...(newProject.data.content || {}), 
                chapters: newProject.data.content?.chapters || [],
                characters: newProject.data.content?.characters || [],
                locations: newProject.data.content?.locations || [],
                plotlines: newProject.data.content?.plotlines || [],
            },
            chatHistory: newProject.data.chatHistory || [],
        });
        
        projectCache.set(newProject.id, currentProjectData); 
        
        await loadUserProjects();
        (await import('./workspace.js')).loadWorkspace();
        showView('workspace');
        showToast(`Проєкт "${title}" створено!`, 'success');
        
    } catch (error) {
        handleError(error, "create-project");
    } finally {
        hideSpinner();
    }
}

export async function deleteProjectAction(projectID, projectTitle) {
    const confirmed = await showConfirmModal(
        "Видалити проєкт?",
        `Ви впевнені, що хочете назавжди видалити "${projectTitle}"? Цю дію неможливо скасувати.`
    );

    if (!confirmed) return;

    showSpinner(`Видалення "${projectTitle}"...`);
    try {
        await deleteProjectAPI(projectID);

        showToast(`Проєкт "${projectTitle}" видалено.`, 'success');
        projectCache.clear(projectID); 
        loadUserProjects(); 
        
    } catch (error) {
        handleError(error, "delete-project");
    } finally {
        hideSpinner();
    }
}

export async function editProjectTitleAction(projectID, oldTitle) {
    const newTitle = await showCreateEditModal("Змінити назву проєкту", oldTitle);
    
    if (!newTitle || newTitle === oldTitle) return;

    showSpinner("Оновлення назви...");
    try {
        await updateProjectTitleAPI(projectID, newTitle);

        showToast("Назву оновлено.", 'success');
        loadUserProjects(); 
        
        const cachedData = projectCache.get(projectID);
        if (cachedData) {
            cachedData.title = newTitle;
            projectCache.set(projectID, cachedData);
        }
        
        if (projectID === currentProjectID) {
            if (ui.workspaceTitle) ui.workspaceTitle.textContent = newTitle;
            if (ui.workspaceTitleInput) ui.workspaceTitleInput.value = newTitle;
            if (currentProjectData) currentProjectData.title = newTitle;
            updateBreadcrumbs();
        }

    } catch (error) {
        handleError(error, "edit-title");
    } finally {
        hideSpinner();
    }
}

export async function exportProjectAction(projectID, projectTitle) {
    showSpinner(`Експорт "${projectTitle}"...`);
    try {
        const response = await exportProjectAPI(projectID);

        const textContent = await response.text();
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        
        const contentDisposition = response.headers.get('content-disposition');
        let filename = `${projectTitle || 'export'}.txt`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+?)"/);
            if (filenameMatch?.length > 1) {
                filename = filenameMatch[1];
            }
        }
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("Експорт завершено.", "success");

    } catch (error) {
        handleError(error, "export-project");
    } finally {
        hideSpinner();
    }
}

// --- Контекстне меню ---

export function showProjectContextMenu(e, projectID, projectTitle) {
    e.preventDefault();
    if (!ui.projectContextMenu) return;
    
    contextMenuProjectID = projectID;
    contextMenuProjectTitle = projectTitle;

    const x = e.clientX;
    const y = e.clientY;
    
    ui.projectContextMenu.style.left = `${x}px`;
    ui.projectContextMenu.style.top = `${y}px`;
    ui.projectContextMenu.classList.remove('hidden');

    const closeMenuHandler = (event) => {
        if (!ui.projectContextMenu.contains(event.target)) {
            ui.projectContextMenu.classList.add('hidden');
            document.removeEventListener('click', closeMenuHandler);
        }
    };
    document.addEventListener('click', closeMenuHandler);
}

// Обробники для контекстного меню (викликаються з main.js)
export function handleContextEdit() {
    editProjectTitleAction(contextMenuProjectID, contextMenuProjectTitle);
    ui.projectContextMenu?.classList.add('hidden');
}

export function handleContextDelete() {
    deleteProjectAction(contextMenuProjectID, contextMenuProjectTitle);
    ui.projectContextMenu?.classList.add('hidden');
}

export function handleContextExport() {
    exportProjectAction(contextMenuProjectID, contextMenuProjectTitle);
    ui.projectContextMenu?.classList.add('hidden');
}

export { createProject as handleCreateProject };