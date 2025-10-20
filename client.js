// Глобальні змінні
let currentUser = null;
let currentProjectID = null;

// --- Елементи DOM ---
// Ми "знайдемо" їх, коли сторінка завантажиться
let loginContainer, appContainer, loginInput, loginButton, logoutButton, usernameDisplay,
    projectsContainer, projectsList, createProjectButton, chatContainer, backToProjectsButton,
    currentProjectTitle, sendButton, userInput, chatWindow;

// --- Головна функція, яка запускається при завантаженні ---
document.addEventListener('DOMContentLoaded', () => {
    // Знаходимо всі елементи один раз
    loginContainer = document.getElementById('login-container');
    appContainer = document.getElementById('app-container');
    loginInput = document.getElementById('login-input');
    loginButton = document.getElementById('login-button');
    logoutButton = document.getElementById('logout-button');
    usernameDisplay = document.getElementById('username-display');
    projectsContainer = document.getElementById('projects-container'); 
    projectsList = document.getElementById('projects-list');
    createProjectButton = document.getElementById('create-project-button');
    chatContainer = document.getElementById('chat-container');
    backToProjectsButton = document.getElementById('back-to-projects'); 
    currentProjectTitle = document.getElementById('current-project-title');
    sendButton = document.getElementById('sendButton');
    userInput = document.getElementById('userInput');
    chatWindow = document.getElementById('chat-window');
    
    // --- Прив'язка подій ---
    loginButton.addEventListener('click', handleLogin);
    logoutButton.addEventListener('click', handleLogout);
    loginInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') { handleLogin(); } });
    createProjectButton.addEventListener('click', handleCreateProject);
    backToProjectsButton.addEventListener('click', showProjectsList); 
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') { sendMessage(); } });

    // Запускаємо перевірку логіну
    checkLoginOnLoad();
});

// --- Логіка Логіну ---
function checkLoginOnLoad() {
    const savedUser = localStorage.getItem('bookBotUser');
    if (savedUser) { currentUser = savedUser; showAppScreen(); } else { showLoginScreen(); }
}
function handleLogin() {
    const user = loginInput.value.trim();
    if (user === "") { alert("Логін не може бути порожнім!"); return; }
    currentUser = user;
    localStorage.setItem('bookBotUser', user);
    showAppScreen();
}
function handleLogout() {
    currentUser = null; currentProjectID = null;
    localStorage.removeItem('bookBotUser');
    chatWindow.innerHTML = ''; 
    showLoginScreen();
}
function showLoginScreen() {
    loginContainer.classList.remove('hidden'); 
    appContainer.classList.add('hidden'); 
}
function showAppScreen() {
    loginContainer.classList.add('hidden'); 
    appContainer.classList.remove('hidden'); 
    usernameDisplay.textContent = currentUser;
    showProjectsList(); 
    loadProjects(currentUser); 
}
function showProjectsList() {
    chatContainer.classList.add('hidden');
    projectsContainer.classList.remove('hidden');
    currentProjectID = null; 
}

// --- Логіка Картотеки ---
async function loadProjects(user) {
    projectsList.innerHTML = '<li>Завантаження...</li>'; 
    try {
        const response = await fetch(`/get-projects?user=${user}`);
        if (!response.ok) throw new Error('Помилка мережі');
        
        const projects = await response.json();
        projectsList.innerHTML = ''; 

        if (projects.length === 0) {
            projectsList.innerHTML = '<li>У вас ще немає проєктів.</li>';
        } else {
            projects.forEach(project => {
                const li = document.createElement('li');
                
                const titleSpan = document.createElement('span');
                titleSpan.textContent = project.title;
                titleSpan.onclick = () => {
                    openChatForProject(project.id, project.title);
                };

                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'project-buttons';
                
                // НОВА КНОПКА: Редагувати
                const editBtn = document.createElement('button');
                editBtn.textContent = 'Змінити'; // Або можете використати іконку 📝
                editBtn.className = 'btn-icon edit-btn';
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    handleEditTitle(project.id, project.title);
                };

                const exportBtn = document.createElement('button');
                exportBtn.textContent = 'Експорт';
                exportBtn.className = 'btn-icon export-btn';
                exportBtn.onclick = (e) => {
                    e.stopPropagation();
                    window.open(`/export-project?projectID=${project.id}`, '_blank');
                };

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Видалити';
                deleteBtn.className = 'btn-icon delete-btn';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation(); 
                    handleDeleteProject(project.id, project.title);
                };

                buttonsDiv.appendChild(exportBtn);
                buttonsDiv.appendChild(deleteBtn);
                li.appendChild(titleSpan);
                li.appendChild(buttonsDiv);
                projectsList.appendChild(li);
            });
        }
    } catch (error) {
        console.error('Не вдалося завантажити проєкти:', error);
        projectsList.innerHTML = '<li>Не вдалося завантажити проєкти.</li>';
    }
}

async function handleCreateProject() {
    const title = prompt("Введіть назву для вашої нової книги:", "Нова книга " + new Date().toLocaleDateString());
    if (!title || title.trim() === "") return; 

    try {
        const response = await fetch('/create-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: currentUser, title: title.trim() }) });
        if (!response.ok) throw new Error('Сервер не зміг створити проєкт.');
        const newProject = await response.json(); 
        loadProjects(currentUser); 
        openChatForProject(newProject.id, newProject.title);
    } catch (error) { console.error('Помилка при створенні проєкту:', error); alert('Не вдалося створити проєкт. Дивіться консоль.'); }
}

async function handleDeleteProject(projectID, title) {
    if (!confirm(`Ви впевнені, що хочете видалити проєкт "${title}"? Цю дію неможливо скасувати.`)) { return; }
    try {
        const response = await fetch('/delete-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectID: projectID }) });
        if (!response.ok) throw new Error('Сервер не зміг видалити проєкт.');
        loadProjects(currentUser);
    } catch (error) { console.error('Помилка при видаленні:', error); alert('Не вдалося видалити проєкт.'); }
}

// НОВА ФУНКЦІЯ: Оновлення назви проєкту
async function handleEditTitle(projectID, oldTitle) {
    // Викликаємо prompt, щоб запитати нову назву
    const newTitle = prompt(`Введіть нову назву для проєкту "${oldTitle}":`, oldTitle);
    
    if (!newTitle || newTitle.trim() === "" || newTitle === oldTitle) {
        return; // Користувач скасував, ввів порожній рядок або не змінив назву
    }

    try {
        // Викликаємо наш новий маршрут на бекенді
        const response = await fetch('/update-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectID: projectID, newTitle: newTitle.trim() })
        });
        
        if (!response.ok) throw new Error('Сервер не зміг оновити назву.');
        
        // Успіх! Оновлюємо список, щоб побачити зміни
        loadProjects(currentUser);
        
    } catch (error) {
        console.error('Помилка при оновленні назви:', error);
        alert('Не вдалося оновити назву.');
    }
}

// --- Логіка Чату ---
async function openChatForProject(projectId, projectTitle) {
    currentProjectID = projectId;
    currentProjectTitle.textContent = projectTitle;
    projectsContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    chatWindow.innerHTML = 'Завантаження історії...'; 

    try {
        const response = await fetch(`/chat-history?projectID=${projectId}`);
        if (!response.ok) throw new Error('Не вдалося завантажити історію');
        const history = await response.json();
        chatWindow.innerHTML = ''; 
        history.forEach(message => {
            const sender = message.role === 'model' ? 'bot' : 'user';
            const text = message.parts[0].text;
            addMessageToChat(text, sender);
        });
    } catch (error) { console.error("Помилка завантаження історії:", error); chatWindow.innerHTML = 'Не вдалося завантажити історію.'; }
}

async function sendMessage() {
    const messageText = userInput.value.trim();
    if (messageText === "" || !currentProjectID || !currentUser) return;
    addMessageToChat(messageText, 'user');
    userInput.value = '';
    sendButton.disabled = true; 
    try {
        const response = await fetch('/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectID: currentProjectID, message: messageText, user: currentUser }) });
        if (!response.ok) throw new Error('Сервер повернув помилку');
        const data = await response.json();
        const botMessage = data.message;
        addMessageToChat(botMessage, 'bot');
    } catch (error) { console.error("Помилка відправки повідомлення:", error); addMessageToChat("Ой, сталася помилка. Спробуйте ще раз.", 'bot');
    } finally { sendButton.disabled = false; }
}

function addMessageToChat(text, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);
    messageElement.textContent = text;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}