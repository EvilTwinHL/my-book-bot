// src/modules/chat.js

import { 
    ui, 
    currentProjectID 
} from '../state.js';
import { 
    sendChatMessageAPI 
} from '../api.js';
import { 
    escapeHTML 
} from '../utils/utils.js';

/**
 * @param {Array<object>} history
 */
export function renderChatHistory(history) {
    if (!ui.chatWindow) return;
    ui.chatWindow.innerHTML = '';
    
    (history || []).slice(2).forEach(msg => {
        addMessageToChat(msg.role, msg.parts[0].text, false);
    });
}

export async function sendChatMessage() {
    if (!ui.userInput || !ui.sendButton) return;
    
    const messageText = ui.userInput.value.trim();
    if (messageText === '' || !currentProjectID) return;

    addMessageToChat('user', messageText);
    ui.userInput.value = '';
    ui.userInput.disabled = true;
    ui.sendButton.disabled = true;
    addMessageToChat('model', '...', true);

    const contextOptions = {
        includeWorld: ui.chatContextOptions.world?.checked,
        includeChapters: ui.chatContextOptions.chapters?.checked,
        includeCharacters: ui.chatContextOptions.characters?.checked,
        includeLocations: ui.chatContextOptions.locations?.checked,
        includePlotlines: ui.chatContextOptions.plotlines?.checked
    };

    try {
        const modelResponse = await sendChatMessageAPI(messageText, contextOptions);
        updateLastChatMessage(modelResponse);

    } catch (error) {
        console.error("Помилка під час чату:", error);
        updateLastChatMessage("Вибачте, сталася помилка. Спробуйте ще раз.");
    } finally {
        if (ui.userInput) ui.userInput.disabled = false;
        if (ui.sendButton) ui.sendButton.disabled = false;
        if (ui.userInput) ui.userInput.focus();
    }
}

/**
 * @param {'user' | 'model'} role
 * @param {string} text
 * @param {boolean} [isLoading=false]
 */
function addMessageToChat(role, text, isLoading = false) {
    if (!ui.chatWindow) return;
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', `${role}-message`);
    
    let html = escapeHTML(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');

    if (isLoading) {
        messageElement.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        messageElement.id = 'loading-message';
    } else {
        messageElement.innerHTML = html;
    }
    
    ui.chatWindow.appendChild(messageElement);
    ui.chatWindow.scrollTop = ui.chatWindow.scrollHeight;
}

function updateLastChatMessage(text) {
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) {
        let html = escapeHTML(text)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
            
        loadingMessage.innerHTML = html;
        loadingMessage.id = '';
    } else {
        addMessageToChat('model', text);
    }
}
