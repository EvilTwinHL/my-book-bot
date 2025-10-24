// src/utils/sortable.js

import { 
    currentProjectData, 
    ui, 
    selectedChapterIndex, 
    selectedCharacterIndex, 
    selectedLocationIndex, 
    selectedPlotlineIndex 
} from '../state.js';
import { scheduleSave } from '../modules/save.js';
import { 
    renderChaptersList, 
    renderCharactersList, 
    renderLocationsList, 
    renderPlotlinesList, 
    selectChapter, 
    selectCharacter, 
    selectLocation, 
    selectPlotline 
} from '../modules/lists.js';

/**
 * Ініціалізує Drag & Drop для всіх списків за допомогою SortableJS.
 */
export function initializeSortableLists() {
    if (typeof Sortable === 'undefined') {
        console.error("Sortable.js не знайдено. Drag & Drop вимкнено.");
        return;
    }

    const onSortHandler = (event, type) => {
        const oldIndex = event.oldIndex;
        const newIndex = event.newIndex; // Correct property for Sortable v1.15.0

        if (oldIndex === newIndex) return;

        const list = currentProjectData?.content?.[type];
        if (!list) return;
        
        const [movedItem] = list.splice(oldIndex, 1);
        list.splice(newIndex, 0, movedItem);
        
        scheduleSave(`content.${type}`, list);

        setTimeout(() => {
            if (type === 'chapters') {
                renderChaptersList();
                if (selectedChapterIndex === oldIndex) selectChapter(newIndex);
            }
            if (type === 'characters') {
                renderCharactersList();
                if (selectedCharacterIndex === oldIndex) selectCharacter(newIndex);
            }
            if (type === 'locations') {
                renderLocationsList();
                if (selectedLocationIndex === oldIndex) selectLocation(newIndex);
            }
            if (type === 'plotlines') {
                renderPlotlinesList();
                if (selectedPlotlineIndex === oldIndex) selectPlotline(newIndex);
            }
        }, 50);
    };

    // Уникнення повторної ініціалізації
    if (ui.chaptersList && !ui.chaptersList.__sortable) { 
        ui.chaptersList.__sortable = new Sortable(ui.chaptersList, { group: 'chapters', animation: 150, handle: '.drag-handle', onEnd: (event) => onSortHandler(event, 'chapters') });
    }
    if (ui.charactersList && !ui.charactersList.__sortable) {
        ui.charactersList.__sortable = new Sortable(ui.charactersList, { group: 'characters', animation: 150, handle: '.drag-handle', onEnd: (event) => onSortHandler(event, 'characters') });
    }
    if (ui.locationsList && !ui.locationsList.__sortable) {
        ui.locationsList.__sortable = new Sortable(ui.locationsList, { group: 'locations', animation: 150, handle: '.drag-handle', onEnd: (event) => onSortHandler(event, 'locations') });
    }
    if (ui.plotlinesList && !ui.plotlinesList.__sortable) {
        ui.plotlinesList.__sortable = new Sortable(ui.plotlinesList, { group: 'plotlines', animation: 150, handle: '.drag-handle', onEnd: (event) => onSortHandler(event, 'plotlines') });
    }

    console.log("Drag & Drop ініціалізовано.");
}