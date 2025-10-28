// src/modules/projects.js (ОНОВЛЕНО ФАЗА 5: Рефакторинг редагування деталей)

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
    // === ОНОВЛЕНО (ФАЗА 5): 'updateProjectTitleAPI' замінено на 'updateProjectDetailsAPI' ===
    updateProjectDetailsAPI, 
    exportProjectAPI 
} from '../api.js';
import { projectCache } from '../core/cache.js';
import { escapeHTML } from '../utils/utils.js';

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
        
        // === ОНОВЛЕНО (ФАЗА 5): Використання нових полів ===
        const title = escapeHTML(project.title);
        const genre = escapeHTML(project.genre || 'Без жанру');
        const imageURL = project.imageURL ? escapeHTML(project.imageURL) : 'assets/card-placeholder.png';
        const wordCount = project.totalWordCount || 0;
        const updatedAt = new Date(project.updatedAt).toLocaleString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
        
        const goal = project.content?.wordGoal || project.wordGoal || 0; 
        
        let progressPercent = 0;
        if (goal > 0 && wordCount > 0) {
            progressPercent = Math.min(100, (wordCount / goal) * 100);
        }

        // === ОНОВЛЕНО (ФАЗА 5): Нова структура картки ===
        item.innerHTML = `
            <div class="project-card-image">
                <img src="${imageURL}" alt="Обкладинка проєкту" onerror="this.src='assets/card-placeholder.png'; this.onerror=null;">
            </div>
            <div class="project-card-content">
                <span class="project-card-genre">${genre}</span>
                <h3 class="project-card-title">${title}</h3>
                
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
                    <p class="project-card-updated">Оновлено: ${updatedAt}</p>
                </div>
            </div>
        `;

        item.addEventListener('click', (e) => {
            callOpenProject(project.id); // !!! ВИКЛИК ОБГОРТКИ !!!
        });

        // === ОНОВЛЕНО (ФАЗА 5): Передаємо весь об'єкт 'project' в контекстне меню ===
        item.addEventListener('contextmenu', (e) => showProjectContextMenu(e, project));
        
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
    
    if (!ui.projectsView) {
        console.error("Критична помилка: Контейнер #projects-view не знайдено.");
        showView('auth-container'); 
        return;
    }
    
    showView('projects-view'); 
    showSpinner("Завантаження проєктів...");

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

// ... (createNewProjectAction, createProject без змін)
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

// === ВИДАЛЕНО (ФАЗА 5): Старі функції editProjectTitleAction та updateProjectTitle ===

// === ДОДАНО (ФАЗА 5): Нова логіка для модалки деталей проєкту ===

/**
 * Відкриває модальне вікно для редагування деталей проєкту.
 * Викликається з handleContextEditDetails.
 */
function openProjectDetailsModal() {
    if (!contextMenuProjectID) return;

    // Отримуємо повні дані проєкту з кешу
    const project = projectCache.get(contextMenuProjectID);
    if (!project) {
        showToast("Не вдалося знайти дані проєкту. Спробуйте оновити сторінку.", "error");
        return;
    }

    // Заповнюємо модальне вікно
    ui.projectDetailsTitle.textContent = `Редагувати "${escapeHTML(project.title)}"`;
    ui.projectDetailsNameInput.value = project.title || '';
    ui.projectDetailsGenreInput.value = project.genre || '';
    ui.projectDetailsImageInput.value = project.imageURL || '';

    ui.projectDetailsModal.classList.remove('hidden');
    ui.projectDetailsNameInput.focus();

    // Створюємо одноразових слухачів
    const confirmHandler = () => {
        const newDetails = {
            title: ui.projectDetailsNameInput.value.trim(),
            genre: ui.projectDetailsGenreInput.value.trim(),
            imageURL: ui.projectDetailsImageInput.value.trim()
        };
        
        if (!newDetails.title) {
            showToast("Назва проєкту не може бути порожньою.", "error");
            return;
        }

        updateProjectDetails(contextMenuProjectID, newDetails);
        closeModal();
    };

    const cancelHandler = () => {
        closeModal();
    };

    const closeModal = () => {
        ui.projectDetailsModal.classList.add('hidden');
        ui.projectDetailsConfirmBtn.removeEventListener('click', confirmHandler);
        ui.projectDetailsCancelBtn.removeEventListener('click', cancelHandler);
    };

    ui.projectDetailsConfirmBtn.addEventListener('click', confirmHandler);
    ui.projectDetailsCancelBtn.addEventListener('click', cancelHandler);
}

/**
 * Оновлює деталі проєкту в Firestore.
 * @param {string} id
 * @param {{title: string, genre: string, imageURL: string}} details
 */
async function updateProjectDetails(id, details) {
    showSpinner("Оновлення деталей...");
    try {
        // Використовуємо новий API ендпоінт
        await updateProjectDetailsAPI(id, details);
        
        // Оновлюємо дані в кеші
        const cachedProject = projectCache.get(id);
        if (cachedProject) {
            projectCache.set(id, {
                ...cachedProject,
                ...details,
                updatedAt: new Date().toISOString() // Оновлюємо час
            });
        }

        // Якщо це поточний проєкт, оновлюємо UI воркспейсу
        if (id === currentProjectID) {
            currentProjectData.title = details.title;
            // (genre та imageURL не відображаються у воркспейсі, але title - так)
            callUpdateBreadcrumbs(); // !!! ВИКЛИК ОБГОРТКИ !!!
            if (ui.workspaceTitle) {
                ui.workspaceTitle.textContent = details.title;
            }
        }

        // Перезавантажуємо список проєктів, щоб відобразити зміни
        await loadProjects(); 
        
        showToast(`Проєкт "${details.title}" успішно оновлено.`, "success");
    } catch (error) {
        handleError(error, "update-project-details");
        showToast("Помилка оновлення деталей проєкту.", "error");
    } finally {
        hideSpinner();
    }
}

// ... (deleteProjectAction, deleteProject без змін)
export function deleteProjectAction(id, title) {
    showConfirmModal(
        'Видалити проєкт?',
        `Ви впевнені, що хочете остаточно видалити проєкт "${escapeHTML(title)}"? Цю дію не можна скасувати.`,
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
        
        showToast(`Проєкт "${escapeHTML(contextMenuProjectTitle)}" експортовано!`, "success");
    } catch (error) {
        handleError(error, "export-project");
        showToast("Помилка експорту проєкту.", "error");
    } finally {
        hideSpinner();
    }
}


// --- Контекстне меню ---

let contextMenuProjectID = null;
let contextMenuProjectTitle = null;

/**
 * @param {Event} e
 * @param {object} project - Повний об'єкт проєкту
 */
export function showProjectContextMenu(e, project) {
    e.preventDefault();
    if (!ui.projectContextMenu) return;
    
    // === ОНОВЛЕНО (ФАЗА 5): Зберігаємо дані проєкту ===
    contextMenuProjectID = project.id;
    contextMenuProjectTitle = project.title; // Для delete/export

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

// === ОНОВЛЕНО (ФАЗА 5): 'handleContextEdit' -> 'handleContextEditDetails' ===
export function handleContextEditDetails() {
    openProjectDetailsModal(); // Нова функція, що відкриває нову модалку
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
    
    // === ОНОВЛЕНО (ФАЗА 5): Змінено обробник ===
    ui.contextEditBtn?.addEventListener('click', handleContextEditDetails);
    
    ui.contextDeleteBtn?.addEventListener('click', handleContextDelete);
    ui.contextExportBtn?.addEventListener('click', handleContextExport);
}