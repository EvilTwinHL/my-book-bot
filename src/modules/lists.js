// src/modules/lists.js

import { 
    currentProjectData, 
    ui, 
    selectedChapterIndex, 
    selectedCharacterIndex, 
    selectedLocationIndex, 
    selectedPlotlineIndex, 
    setSelectedChapterIndex,
    setSelectedCharacterIndex,
    setSelectedLocationIndex,
    setSelectedPlotlineIndex,
    resetHistory
} from '../state.js';
import { scheduleSave } from './save.js';
import { escapeHTML, getSnippet } from '../utils/utils.js';
import { showConfirmModal } from '../ui/modal.js';
import { updateChapterWordCount, updateTotalWordCount } from '../utils/stats.js';

// === HELPER FUNCTIONS ===

/**
 * Оновлення контекстної навігації (Prev/Next)
 * @param {'chapter' | 'character' | 'location' | 'plotline'} type
 * @param {number} index
 * @param {number} total
 */
function updateContextualNavigation(type, index, total) {
    const isEditing = index !== null;
    
    const elements = {
        chapter: { nav: ui.chapterNavigation, counter: ui.chapterCounter, prevBtn: ui.prevChapterBtn, nextBtn: ui.nextChapterBtn },
        character: { nav: ui.characterNavigation, counter: ui.characterCounter, prevBtn: ui.prevCharacterBtn, nextBtn: ui.nextCharacterBtn },
        location: { nav: ui.locationNavigation, counter: ui.locationCounter, prevBtn: ui.prevLocationBtn, nextBtn: ui.nextLocationBtn },
        plotline: { nav: ui.plotlineNavigation, counter: ui.plotlineCounter, prevBtn: ui.prevPlotlineBtn, nextBtn: ui.nextPlotlineBtn },
    };

    const uiMap = elements[type];
    if (!uiMap || !uiMap.nav) return;

    if (!isEditing || total <= 1) {
        uiMap.nav.classList.add('hidden');
        return;
    }
    
    uiMap.nav.classList.remove('hidden');

    const singularName = { chapter: 'Розділ', character: 'Персонаж', location: 'Локація', plotline: 'Сюжет' }[type];
    if (uiMap.counter) {
        uiMap.counter.textContent = `${singularName} ${index + 1} з ${total}`;
    }

    if (uiMap.prevBtn) uiMap.prevBtn.disabled = (index <= 0);
    if (uiMap.nextBtn) uiMap.nextBtn.disabled = (index >= total - 1);
}

// === CHAPTERS (Розділи) ===

export function renderChaptersList() {
    const chapters = currentProjectData?.content?.chapters || [];
    if (!ui.chaptersList) return;
    
    if (chapters.length === 0) {
        ui.chaptersList.innerHTML = '<p class="empty-list-info">Додайте свій перший розділ, натиснувши "Новий розділ".</p>';
        return;
    }
    
    ui.chaptersList.innerHTML = '';
    chapters.forEach((chapter, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.dataset.index = index;
        if (index === selectedChapterIndex) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <div class="drag-handle">::</div>
            <div class="list-item-content">
                <span class="list-item-status status-${chapter.status || 'draft'}"></span>
                <h4 class="list-item-title">${escapeHTML(chapter.title) || '<i>Розділ без назви</i>'}</h4>
                <p class="list-item-snippet">${getSnippet(chapter.synopsis || chapter.text)}</p>
            </div>
        `;
        
        item.querySelector('.list-item-content')?.addEventListener('click', () => selectChapter(index));
        ui.chaptersList.appendChild(item);
    });
}

export function selectChapter(index) {
    const chapters = currentProjectData?.content?.chapters;
    if (!chapters || !ui.chapterEditorPane || !ui.chapterEditorPlaceholder) return;
    
    if (index === null || index < 0 || index >= chapters.length) {
        hideChapterEditor();
        return;
    }

    setSelectedChapterIndex(index);
    const chapter = chapters[index];
    
    if (ui.chapterTitleInput) ui.chapterTitleInput.value = chapter.title || '';
    if (ui.chapterStatusSelect) ui.chapterStatusSelect.value = chapter.status || 'draft';
    if (ui.chapterTextarea) ui.chapterTextarea.value = chapter.text || '';
    if (ui.chapterSynopsisTextarea) ui.chapterSynopsisTextarea.value = chapter.synopsis || '';
    
    updateChapterWordCount(chapter.text || '');
    
    ui.chapterEditorPlaceholder.classList.add('hidden');
    ui.chapterEditorPane.classList.remove('hidden');
    
    if (ui.chapterTextarea) resetHistory(ui.chapterTextarea);

    renderChaptersList();
    updateContextualNavigation('chapter', index, chapters.length);
}

export function hideChapterEditor() {
    setSelectedChapterIndex(null);
    if (ui.chapterEditorPlaceholder) ui.chapterEditorPlaceholder.classList.remove('hidden');
    if (ui.chapterEditorPane) ui.chapterEditorPane.classList.add('hidden');
    renderChaptersList();
    if (ui.chapterNavigation) ui.chapterNavigation.classList.add('hidden');
}

export function addChapter() {
    if (!currentProjectData) return;
    if (!currentProjectData.content.chapters) {
        currentProjectData.content.chapters = [];
    }

    const newChapter = { title: "Новий розділ", status: "draft", text: "", synopsis: "", word_count: 0 };
    
    currentProjectData.content.chapters.push(newChapter);
    const newIndex = currentProjectData.content.chapters.length - 1;
    
    scheduleSave('content.chapters', currentProjectData.content.chapters);
    
    renderChaptersList();
    selectChapter(newIndex);
    if (ui.chapterTitleInput) {
        ui.chapterTitleInput.focus();
        ui.chapterTitleInput.select();
    }
}

export async function deleteChapter() {
    if (selectedChapterIndex === null || !currentProjectData?.content?.chapters) return;
    
    const chapterTitle = currentProjectData.content.chapters[selectedChapterIndex].title || "Розділ без назви";
    const confirmed = await showConfirmModal("Видалити розділ?", `Ви впевнені, що хочете видалити "${chapterTitle}"?`);

    if (!confirmed) return;

    currentProjectData.content.chapters.splice(selectedChapterIndex, 1);
    scheduleSave('content.chapters', currentProjectData.content.chapters);
    
    hideChapterEditor();
    updateTotalWordCount();
}

// === CHARACTERS (Персонажі) ===

export function renderCharactersList() {
    const characters = currentProjectData?.content?.characters || [];
    if (!ui.charactersList) return;
    
    if (characters.length === 0) {
        ui.charactersList.innerHTML = '<p class="empty-list-info">Додайте свого першого персонажа.</p>';
        return;
    }
    
    ui.charactersList.innerHTML = '';
    characters.forEach((char, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.dataset.index = index;
        if (index === selectedCharacterIndex) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <div class="drag-handle">::</div>
            <div class="list-item-content">
                <h4 class="list-item-title">${escapeHTML(char.name) || '<i>Персонаж без імені</i>'}</h4>
                <p class="list-item-snippet">${getSnippet(char.description)}</p>
            </div>
        `;
        
        item.querySelector('.list-item-content')?.addEventListener('click', () => selectCharacter(index));
        ui.charactersList.appendChild(item);
    });
}

export function selectCharacter(index) {
    const characters = currentProjectData?.content?.characters;
    if (!characters || !ui.characterEditorPane || !ui.characterEditorPlaceholder) return;
    
    if (index === null || index < 0 || index >= characters.length) {
        hideCharacterEditor();
        return;
    }
    
    setSelectedCharacterIndex(index);
    const character = characters[index];
    
    if (ui.characterNameInput) ui.characterNameInput.value = character.name || '';
    if (ui.characterDescTextarea) ui.characterDescTextarea.value = character.description || '';
    if (ui.characterArcTextarea) ui.characterArcTextarea.value = character.arc || '';
    
    ui.characterEditorPlaceholder.classList.add('hidden');
    ui.characterEditorPane.classList.remove('hidden');
    
    if (ui.characterDescTextarea) resetHistory(ui.characterDescTextarea);

    renderCharactersList();
    updateContextualNavigation('character', index, characters.length);
}

export function hideCharacterEditor() {
    setSelectedCharacterIndex(null);
    if (ui.characterEditorPlaceholder) ui.characterEditorPlaceholder.classList.remove('hidden');
    if (ui.characterEditorPane) ui.characterEditorPane.classList.add('hidden');
    renderCharactersList();
    if (ui.characterNavigation) ui.characterNavigation.classList.add('hidden');
}

export function addCharacter() {
    if (!currentProjectData) return;
    if (!currentProjectData.content.characters) {
        currentProjectData.content.characters = [];
    }
    
    const newChar = { name: "Новий персонаж", description: "", arc: "" };
    
    currentProjectData.content.characters.push(newChar);
    const newIndex = currentProjectData.content.characters.length - 1;
    
    scheduleSave('content.characters', currentProjectData.content.characters);
    
    renderCharactersList();
    selectCharacter(newIndex);
    if (ui.characterNameInput) {
        ui.characterNameInput.focus();
        ui.characterNameInput.select();
    }
}

export async function deleteCharacter() {
    if (selectedCharacterIndex === null || !currentProjectData?.content?.characters) return;
    
    const charName = currentProjectData.content.characters[selectedCharacterIndex].name || "Персонаж без імені";
    const confirmed = await showConfirmModal("Видалити персонажа?", `Ви впевнені, що хочете видалити "${charName}"?`);

    if (!confirmed) return;

    currentProjectData.content.characters.splice(selectedCharacterIndex, 1);
    scheduleSave('content.characters', currentProjectData.content.characters);
    
    hideCharacterEditor();
}

// === LOCATIONS (Локації) ===

export function renderLocationsList() {
    const locations = currentProjectData?.content?.locations || [];
    if (!ui.locationsList) return;

    if (locations.length === 0) {
        ui.locationsList.innerHTML = '<p class="empty-list-info">Додайте свою першу локацію.</p>';
        return;
    }
    
    ui.locationsList.innerHTML = '';
    locations.forEach((loc, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.dataset.index = index;
        if (index === selectedLocationIndex) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <div class="drag-handle">::</div>
            <div class="list-item-content">
                <h4 class="list-item-title">${escapeHTML(loc.name) || '<i>Локація без назви</i>'}</h4>
                <p class="list-item-snippet">${getSnippet(loc.description)}</p>
            </div>
        `;
        
        item.querySelector('.list-item-content')?.addEventListener('click', () => selectLocation(index));
        ui.locationsList.appendChild(item);
    });
}

export function selectLocation(index) {
    const locations = currentProjectData?.content?.locations;
    if (!locations || !ui.locationEditorPane || !ui.locationEditorPlaceholder) return;
    
    if (index === null || index < 0 || index >= locations.length) {
        hideLocationEditor();
        return;
    }
    
    setSelectedLocationIndex(index);
    const location = locations[index];
    
    if (ui.locationNameInput) ui.locationNameInput.value = location.name || '';
    if (ui.locationDescTextarea) ui.locationDescTextarea.value = location.description || '';
    
    ui.locationEditorPlaceholder.classList.add('hidden');
    ui.locationEditorPane.classList.remove('hidden');
    
    if (ui.locationDescTextarea) resetHistory(ui.locationDescTextarea);

    renderLocationsList();
    updateContextualNavigation('location', index, locations.length);
}

export function hideLocationEditor() {
    setSelectedLocationIndex(null);
    if (ui.locationEditorPlaceholder) ui.locationEditorPlaceholder.classList.remove('hidden');
    if (ui.locationEditorPane) ui.locationEditorPane.classList.add('hidden');
    renderLocationsList();
    if (ui.locationNavigation) ui.locationNavigation.classList.add('hidden');
}

export function addLocation() {
    if (!currentProjectData) return;
    if (!currentProjectData.content.locations) {
        currentProjectData.content.locations = [];
    }
    
    const newLoc = { name: "Нова локація", description: "" };
    
    currentProjectData.content.locations.push(newLoc);
    const newIndex = currentProjectData.content.locations.length - 1;
    
    scheduleSave('content.locations', currentProjectData.content.locations);
    
    renderLocationsList();
    selectLocation(newIndex);
    if (ui.locationNameInput) {
        ui.locationNameInput.focus();
        ui.locationNameInput.select();
    }
}

export async function deleteLocation() {
    if (selectedLocationIndex === null || !currentProjectData?.content?.locations) return;
    
    const locName = currentProjectData.content.locations[selectedLocationIndex].name || "Локація без назви";
    const confirmed = await showConfirmModal("Видалити локацію?", `Ви впевнені, що хочете видалити "${locName}"?`);

    if (!confirmed) return;

    currentProjectData.content.locations.splice(selectedLocationIndex, 1);
    scheduleSave('content.locations', currentProjectData.content.locations);
    
    hideLocationEditor();
}

// === PLOTLINES (Сюжетні лінії) ===

export function renderPlotlinesList() {
    const plotlines = currentProjectData?.content?.plotlines || [];
    if (!ui.plotlinesList) return;

    if (plotlines.length === 0) {
        ui.plotlinesList.innerHTML = '<p class="empty-list-info">Додайте свою першу сюжетну лінію.</p>';
        return;
    }
    
    ui.plotlinesList.innerHTML = '';
    plotlines.forEach((plot, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.dataset.index = index;
        if (index === selectedPlotlineIndex) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <div class="drag-handle">::</div>
            <div class="list-item-content">
                <h4 class="list-item-title">${escapeHTML(plot.title) || '<i>Сюжет без назви</i>'}</h4>
                <p class="list-item-snippet">${getSnippet(plot.description)}</p>
            </div>
        `;
        
        item.querySelector('.list-item-content')?.addEventListener('click', () => selectPlotline(index));
        ui.plotlinesList.appendChild(item);
    });
}

export function selectPlotline(index) {
    const plotlines = currentProjectData?.content?.plotlines;
    if (!plotlines || !ui.plotlineEditorPane || !ui.plotlineEditorPlaceholder) return;
    
    if (index === null || index < 0 || index >= plotlines.length) {
        hidePlotlineEditor();
        return;
    }
    
    setSelectedPlotlineIndex(index);
    const plotline = plotlines[index];
    
    if (ui.plotlineTitleInput) ui.plotlineTitleInput.value = plotline.title || '';
    if (ui.plotlineDescTextarea) ui.plotlineDescTextarea.value = plotline.description || '';
    
    ui.plotlineEditorPlaceholder.classList.add('hidden');
    ui.plotlineEditorPane.classList.remove('hidden');
    
    if (ui.plotlineDescTextarea) resetHistory(ui.plotlineDescTextarea);

    renderPlotlinesList();
    updateContextualNavigation('plotline', index, plotlines.length);
}

export function hidePlotlineEditor() {
    setSelectedPlotlineIndex(null);
    if (ui.plotlineEditorPlaceholder) ui.plotlineEditorPlaceholder.classList.remove('hidden');
    if (ui.plotlineEditorPane) ui.plotlineEditorPane.classList.add('hidden');
    renderPlotlinesList();
    if (ui.plotlineNavigation) ui.plotlineNavigation.classList.add('hidden');
}

export function addPlotline() {
    if (!currentProjectData) return;
    if (!currentProjectData.content.plotlines) {
        currentProjectData.content.plotlines = [];
    }
    
    const newPlot = { title: "Нова сюжетна лінія", description: "" };
    
    currentProjectData.content.plotlines.push(newPlot);
    const newIndex = currentProjectData.content.plotlines.length - 1;
    
    scheduleSave('content.plotlines', currentProjectData.content.plotlines);
    
    renderPlotlinesList();
    selectPlotline(newIndex);
    if (ui.plotlineTitleInput) {
        ui.plotlineTitleInput.focus();
        ui.plotlineTitleInput.select();
    }
}

export async function deletePlotline() {
    if (selectedPlotlineIndex === null || !currentProjectData?.content?.plotlines) return;
    
    const plotTitle = currentProjectData.content.plotlines[selectedPlotlineIndex].title || "Сюжет без назви";
    const confirmed = await showConfirmModal("Видалити сюжетну лінію?", `Ви впевнені, що хочете видалити "${plotTitle}"?`);

    if (!confirmed) return;

    currentProjectData.content.plotlines.splice(selectedPlotlineIndex, 1);
    scheduleSave('content.plotlines', currentProjectData.content.plotlines);
    
    hidePlotlineEditor();
}
