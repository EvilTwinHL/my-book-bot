// src/modules/projects.js (КОРЕКТНА ВЕРСІЯ v3.0.0: Усунення циклічної залежності)

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

// !!! ВИДАЛЕННЯ СТАТИЧНОГО ІМПОРТУ (openProject, updateBreadcrumbs), ЩОБ РОЗІРВАТИ ЦИКЛ !!!

let contextMenuProjectID = null;
let contextMenuProjectTitle = null;


// --- ДИНАМІЧНІ ОБГОРТКИ (для усунення циклічних залежностей з workspace.js) ---

/** Асинхронно викликає openProject з модуля workspace. */
async function callOpenProject(id) {
    try {
        const workspace = await import('./workspace.js'); 
        workspace.openProject(id);
    } catch (e) {
        handleError(e, "dynamic-openProject");
        showToast("Помилка відкриття проєкту (Workspace).", "error");
    }
}

/** Асинхронно викликає updateBreadcrumbs з модуля workspace. */
async function callUpdateBreadcrumbs() {
    try {
        const workspace = await import('./workspace.js'); 
        workspace.updateBreadcrumbs();
    } catch (e) {
        handleError(e, "dynamic-updateBreadcrumbs");
    }
}


// --- Рендеринг ---

/**
 * @param {Array<object>} projects
 */
export function renderProjectsList(projects) {
    if (!ui.projectsList) {
        console.error("Помилка рендерингу: ui.projectsList не визначено.");
        return;
    }

    // КРИТИЧНО: Захист від того, що fetchProjects повертає null або object, а не Array (ЗБЕРЕЖЕНО)
    const projectList = Array.isArray(projects) ? projects : [];
    
    if (projectList.length === 0) {
        ui.projectsList.innerHTML = '<p class="empty-list-info" style="text-align: center; margin-top: 40px; grid-column: 1 / -1;">У вас ще немає проєктів. Натисніть "+ Створити проєкт", щоб почати.</p>';
        return;
    }
    
    ui.projectsList.innerHTML = ''; 
    projectList.forEach(project => {
        const item = document.createElement('div');
        item.className = 'project-card'; 
        item.dataset.id = project.id;
        
        const title = escapeHTML(project.title);
        const imageURL = 'assets/card-placeholder.png'; 
        const wordCount = project.totalWordCount || 0;
        const updatedAt = new Date(project.updatedAt).toLocaleString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
        
        const goal = project.content?.wordGoal || project.wordGoal || 0; 
        
       let progressPercent = 0;
        if (goal > 0 && wordCount > 0) {
            progressPercent = Math.min(100, (wordCount / goal) * 100);
        }

        item.innerHTML = `
                <div class="project-card-image">
                <img src="${imageURL}" alt="Обкладинка проєкту"> 
            </div>

            <div class="project-card-content">
                <div class="project-card-header">
                    <h3>${title}</h3> 
                    
                </div>

                <div class="project-card-body">
                    <p class="project-card-updated">Оновлено: ${updatedAt}</p>
                </div>

                <div class="project-card-footer">
                    <div class="project-card-stats">
                        <div>Слів: <span>${wordCount.toLocaleString('uk-UA')}</span></div>
                        ${goal > 0 ? `<div>Ціль: <span>${goal.toLocaleString('uk-UA')}</span></div>` : ''}
                    </div>
                    ${goal > 0 ? `
                    <div class="project-card-progress" title="${progressPercent.toFixed(0)}% виконано">
                        <div class="project-card-progress-bar" style="width: ${progressPercent}%;"></div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.closest('.context-menu-trigger')) return; 
            callOpenProject(project.id); // !!! ВИКЛИК ОБГОРТКИ !!!
        });
        item.querySelector('.context-menu-trigger')?.addEventListener('click', (e) => {
             e.stopPropagation(); 
             showProjectContextMenu(e, project.id, project.title);
        });
        item.addEventListener('contextmenu', (e) => showProjectContextMenu(e, project.id, project.title));
        
        ui.projectsList.appendChild(item);
    });
}


/**
 * Завантажує список проєктів і відображає його.
 */
export async function loadProjects() {
    if (!currentUser) {
        showView('auth-container'); 
        return;
    }
    
    // Встановлюємо view до початку завантаження
    if (!ui.projectsView) {
        console.error("Критична помилка: Контейнер #projects-view не знайдено.");
        showView('auth-container'); 
        return;
    }
    
    showView('projects-view'); 
    showSpinner("Завантаження проєктів...");

    // Скелетон
    if (ui.projectsList) {
        ui.projectsList.innerHTML = `
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
        `;
    }

    try {
        const projects = await fetchProjects();
        renderProjectsList(projects);
        
    } catch (error) {
        handleError(error, "load-projects");
        showToast("Помилка завантаження проєктів. Спробуйте пізніше.", "error");
        
        if (ui.projectsList) {
             ui.projectsList.innerHTML = `<p class="error-info empty-list-info" style="grid-column: 1 / -1;">Не вдалося завантажити проєкти. Спробуйте пізніше.</p>`;
        }
    } finally {
        hideSpinner();
    }
}

// ... (createNewProjectAction)
export function createNewProjectAction() {
    showCreateEditModal(
        'Створити новий проєкт',
        'Назва проєкту',
        'Створити',
        async (newTitle) => {
            await createProject(newTitle);
        }
    );
}

async function createProject(title) {
    if (!title) return;

    showSpinner();
    try {
        const newProject = await createNewProject(title, currentUser.uid);
        await loadProjects();
        showToast(`Проєкт "${title}" створено!`, "success");
        callOpenProject(newProject.id); // !!! ВИКЛИК ОБГОРТКИ !!!
    } catch (error) {
        handleError(error, "create-project");
        showToast("Помилка створення проєкту.", "error");
    } finally {
        hideSpinner();
    }
}

// ... (editProjectTitleAction)
export function editProjectTitleAction(id, currentTitle) {
    showCreateEditModal(
        'Редагувати назву проєкту',
        'Нова назва',
        'Зберегти',
        async (newTitle) => {
            if (newTitle && newTitle !== currentTitle) {
                await updateProjectTitle(id, newTitle);
            }
        },
        currentTitle
    );
}

async function updateProjectTitle(id, newTitle) {
    showSpinner();
    try {
        await updateProjectTitleAPI(id, newTitle);
        
        if (id === currentProjectID) {
            currentProjectData.title = newTitle;
            callUpdateBreadcrumbs(); // !!! ВИКЛИК ОБГОРТКИ !!!
            if (ui.workspaceTitle) {
                ui.workspaceTitle.textContent = newTitle;
            }
        }

        await loadProjects(); 
        
        showToast(`Назву проєкту оновлено на "${newTitle}".`, "info");
    } catch (error) {
        handleError(error, "update-title");
        showToast("Помилка оновлення назви.", "error");
    } finally {
        hideSpinner();
    }
}

// ... (deleteProjectAction, deleteProject)
export function deleteProjectAction(id, title) {
    showConfirmModal(
        'Видалити проєкт?',
        `Ви впевнені, що хочете остаточно видалити проєкт "${title}"? Цю дію не можна скасувати.`,
        async () => {
            await deleteProject(id);
        }
    );
}

async function deleteProject(id) {
    showSpinner();
    try {
        await deleteProjectAPI(id);
        
        if (id === currentProjectID) {
            setCurrentProjectID(null);
            setCurrentProjectData(null);
            showView('projects-view');
        }

        await loadProjects();
        
        showToast("Проєкт успішно видалено.", "success");
    } catch (error) {
        handleError(error, "delete-project");
        showToast("Помилка видалення проєкту.", "error");
    } finally {
        hideSpinner();
    }
}


/**
 * Експортує проєкт у форматі TXT. (Використовується в main.js)
 */
export async function exportProjectAction() { 
    if (!contextMenuProjectID) return;

    showSpinner();
    try {
        const blob = await exportProjectAPI(contextMenuProjectID);
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${contextMenuProjectTitle || 'Project'}_Export.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        showToast(`Проєкт "${contextMenuProjectTitle}" експортовано!`, "success");
    } catch (error) {
        handleError(error, "export-project");
        showToast("Помилка експорту проєкту.", "error");
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

export function handleContextEdit() {
    editProjectTitleAction(contextMenuProjectID, contextMenuProjectTitle);
    ui.projectContextMenu?.classList.add('hidden');
}

export function handleContextDelete() {
    deleteProjectAction(contextMenuProjectID, contextMenuProjectTitle);
    ui.projectContextMenu?.classList.add('hidden');
}

export function handleContextExport() {
    exportProjectAction();
    ui.projectContextMenu?.classList.add('hidden');
}

// --- Ініціалізація (обробник викликається з main.js) ---

export function bindProjectListeners() {
    ui.createProjectBtn?.addEventListener('click', createNewProjectAction); 
    ui.contextEditBtn?.addEventListener('click', handleContextEdit);
    ui.contextDeleteBtn?.addEventListener('click', handleContextDelete);
    ui.contextExportBtn?.addEventListener('click', handleContextExport);
}