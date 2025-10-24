// src/modules/search.js

import { 
    currentProjectData, 
    ui 
} from '../state.js';
import { 
    switchTab 
} from './workspace.js';
import { 
    selectChapter, 
    selectCharacter, 
    selectLocation, 
    selectPlotline 
} from './lists.js';
import { 
    escapeHTML, 
    getSnippet 
} from '../utils/utils.js';
import { closeSearchResultsModal } from '../ui/modal.js';

export function performGlobalSearch(query) {
    if (!currentProjectData || !ui.searchResultsList || !ui.searchResultsModal) return;
    
    if (!query || query.length < 3) {
        ui.searchResultsList.innerHTML = '<p>Введіть щонайменше 3 символи для пошуку.</p>';
        ui.searchResultsModal.classList.remove('hidden');
        return;
    }
    
    const lowerQuery = query.toLowerCase();
    const results = [];
    const { content } = currentProjectData;

    // Search logic remains the same
    (content.chapters || []).forEach((item, index) => {
        if (item.title?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Розділ', title: item.title, text: getSnippet(item.synopsis || item.text), tab: 'chapters', index });
        }
        if (item.text?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Розділ (текст)', title: item.title, text: getSnippet(item.text), tab: 'chapters', index });
        }
        if (item.synopsis?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Розділ (синопсис)', title: item.title, text: getSnippet(item.synopsis), tab: 'chapters', index });
        }
    });
    
    (content.characters || []).forEach((item, index) => {
        if (item.name?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Персонаж', title: item.name, text: getSnippet(item.description), tab: 'characters', index });
        }
        if (item.description?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Персонаж (опис)', title: item.name, text: getSnippet(item.description), tab: 'characters', index });
        }
        if (item.arc?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Персонаж (арка)', title: item.name, text: getSnippet(item.arc), tab: 'characters', index });
        }
    });
    
    (content.locations || []).forEach((item, index) => {
        if (item.name?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Локація', title: item.name, text: getSnippet(item.description), tab: 'locations', index });
        }
        if (item.description?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Локація (опис)', title: item.name, text: getSnippet(item.description), tab: 'locations', index });
        }
    });

    (content.plotlines || []).forEach((item, index) => {
        if (item.title?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Сюжет', title: item.title, text: getSnippet(item.description), tab: 'plotlines', index });
        }
        if (item.description?.toLowerCase().includes(lowerQuery)) {
            results.push({ type: 'Сюжет (опис)', title: item.title, text: getSnippet(item.description), tab: 'plotlines', index });
        }
    });
    
    if (content.premise?.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'Світ', title: 'Premise (Logline)', text: getSnippet(content.premise), tab: 'world', field: 'premise-textarea' });
    }
    if (content.theme?.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'Світ', title: 'Тема', text: getSnippet(content.theme), tab: 'world', field: 'theme-textarea' });
    }
    if (content.mainArc?.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'Світ', title: 'Головна арка', text: getSnippet(content.mainArc), tab: 'world', field: 'main-arc-textarea' });
    }
    if (content.notes?.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'Світ', title: 'Нотатки', text: getSnippet(content.notes), tab: 'world', field: 'notes-textarea' });
    }
    if (content.research?.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'Світ', title: 'Дослідження', text: getSnippet(content.research), tab: 'world', field: 'research-textarea' });
    }

    renderSearchResults(results, lowerQuery);
    ui.searchResultsModal.classList.remove('hidden');
}

function renderSearchResults(results, query) {
    if (!ui.searchResultsList) return;
    
    if (results.length === 0) {
        ui.searchResultsList.innerHTML = '<p>Нічого не знайдено.</p>';
        return;
    }
    
    ui.searchResultsList.innerHTML = '';
    results.forEach(res => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        
        const title = (res.title || '...').replace(new RegExp(query, 'gi'), (match) => `<mark>${match}</mark>`);
        const text = res.text.replace(new RegExp(query, 'gi'), (match) => `<mark>${match}</mark>`);
        
        item.innerHTML = `
            <strong>${res.type}:</strong> ${title}
            <p>${text}</p>
        `;
        
        item.addEventListener('click', () => {
            navigateToSearchResult(res);
        });
        
        ui.searchResultsList.appendChild(item);
    });
}

function navigateToSearchResult(result) {
    closeSearchResultsModal();
    
    const tabId = `${result.tab}-tab`;
    switchTab(tabId);
    
    switch (result.tab) {
        case 'chapters':
            selectChapter(result.index);
            if (ui.chapterTextarea) ui.chapterTextarea.focus();
            break;
        case 'characters':
            selectCharacter(result.index);
            if (ui.characterDescTextarea) ui.characterDescTextarea.focus();
            break;
        case 'locations':
            selectLocation(result.index);
            if (ui.locationDescTextarea) ui.locationDescTextarea.focus();
            break;
        case 'plotlines':
            selectPlotline(result.index);
            if (ui.plotlineDescTextarea) ui.plotlineDescTextarea.focus();
            break;
        case 'world':
            const field = document.getElementById(result.field);
            if (field) {
                field.focus();
                field.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            break;
    }
}
