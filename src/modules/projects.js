// src/modules/projects.js (ФІНАЛЬНА ВЕРСІЯ З ВИПРАВЛЕННЯМ)

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
    fetchProjects,
    createNewProject,
    deleteProjectAPI,
    updateProjectDetailsAPI,
    exportProjectAPI
} from '../api.js';

// ...

export function renderProjectsList(projects) {
    // ...
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

// ...

export async function createNewProjectAction() {
    const details = await showCreateProjectModal();
    if (details) {
        await createProject(details);
    }
}

async function createProject(details) {
    if (!details || !details.title) return;

    showSpinner();
    try {
        const newProject = await createNewProject(details, currentUser.uid);
        await loadProjects();
        showToast(`Проєкт "${details.title}" створено!`, "success");
        callOpenProject(newProject.id);
    } catch (error) {
        handleError(error, "create-project");
        showToast("Помилка створення проєкту.", "error");
    } finally {
        hideSpinner();
    }
}

// === ЛОГІКА МОДАЛЬНОГО ВІКНА РЕДАГУВАННЯ ===

/**
 * Відкриває модальне вікно для редагування деталей проєкту.
 * @param {string} projectId - ID проєкту для редагування.
 */
function openProjectDetailsModal(projectId) {
    if (!projectId) {
        console.error("openProjectDetailsModal: не передано projectId");
        return;
    }

    const project = projectCache.get(projectId);
    if (!project) {
        showToast("Не вдалося знайти дані проєкту. Спробуйте оновити сторінку.", "error");
        return;
    }
    
    // ПЕРЕВІРКА: чи бачить JS елементи модалки (з dom.js)
    if (!ui.projectDetailsModal || !ui.projectDetailsTitle || !ui.projectDetailsNameInput || !ui.projectDetailsConfirmBtn || !ui.projectDetailsCancelBtn) {
        console.error("Критична помилка: 'ui.projectDetailsModal' або його дочірні елементи не знайдені в 'ui/dom.js'. Перевірте ID в index.html та dom.js.");
        showToast("Помилка UI: Не вдалося відкрити вікно редагування.", "error");
        return;
    }

    // Заповнюємо модальне вікно
    ui.projectDetailsTitle.textContent = `Редагувати "${escapeHTML(project.title)}"`;
    ui.projectDetailsNameInput.value = project.title || '';

    const genreSelect = document.getElementById('project-details-genre-input');
    const imageSelect = document.getElementById('project-details-image-input');

    if (genreSelect) {
        genreSelect.value = project.genre || 'Інше';
    }
    if (imageSelect) {
        imageSelect.value = project.imageURL || '/assets/card-placeholder.png';
    }

    ui.projectDetailsModal.classList.remove('hidden');
    ui.projectDetailsNameInput.focus();

    // Створюємо одноразових слухачів
    const confirmHandler = () => {
        const newDetails = {
            title: ui.projectDetailsNameInput.value.trim(),
            genre: genreSelect.value.trim(),
            imageURL: imageSelect.value.trim()
        };
        
        if (!newDetails.title) {
            showToast("Назва проєкту не може бути порожньою.", "error");
            return;
        }

        updateProjectDetails(projectId, newDetails);
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
        await updateProjectDetailsAPI(id, details);
        
        const cachedProject = projectCache.get(id);
        if (cachedProject) {
            projectCache.set(id, {
                ...cachedProject,
                ...details,
                updatedAt: new Date().toISOString() // Оновлюємо час
            });
        }

        if (id === currentProjectID) {
            currentProjectData.title = details.title;
            callUpdateBreadcrumbs(); // !!! ВИКЛИК ОБГОРТKI !!!
            if (ui.workspaceTitle) {
                ui.workspaceTitle.textContent = details.title;
            }
        }

        await loadProjects(); 
        
        showToast(`Проєкт "${details.title}" успішно оновлено.`, "success");
    } catch (error) {
        handleError(error, "update-project-details");
        showToast("Помилка оновлення деталей проєкту.", "error");
    } finally {
        hideSpinner();
    }
}

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

export function handleContextEditDetails() {
    openProjectDetailsModal(contextMenuProjectID); 
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

// === ФІНАЛЬНЕ ВИПРАВЛЕННЯ ТУТ ===
export function bindProjectListeners() {
    ui.createProjectBtn?.addEventListener('click', createNewProjectAction); 
    
    ui.contextEditBtn?.addEventListener('click', handleContextEditDetails);
    
    ui.contextDeleteBtn?.addEventListener('click', handleContextDelete);
    ui.contextExportBtn?.addEventListener('click', handleContextExport);

    // Додаємо ОДИН обробник на ВЕСЬ список проєктів,
    // який буде "ловити" кліки саме по іконках
    ui.projectsList?.addEventListener('click', (e) => {
        // Перевіряємо, чи був клік саме по елементу з класом 'card-edit-icon'
        if (e.target.classList.contains('card-edit-icon')) {
            e.stopPropagation(); // Зупиняємо клік, щоб не відкрився проєкт
            const projectId = e.target.dataset.projectId;
            if (projectId) {
                // Викликаємо модалку
                openProjectDetailsModal(projectId); 
            }
        }
    });
} // кінець//