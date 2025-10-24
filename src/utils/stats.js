// src/utils/stats.js

import { 
    currentProjectData, 
    ui 
} from '../state.js';
import { CONFIG } from '../core/config.js';

export function updateChapterWordCount(text) {
    const count = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    if (ui.chapterStats) ui.chapterStats.textContent = `Слів у розділі: ${count}`;
    return count;
}

export function updateTotalWordCount() {
    const chapters = currentProjectData?.content?.chapters || [];
    const totalCount = chapters.reduce((sum, chapter) => sum + (chapter.word_count || 0), 0);
    
    const goal = currentProjectData?.content?.wordGoal || CONFIG.DEFAULT_GOAL_WORDS;
    const progress = (totalCount / goal) * 100;

    if (ui.totalWordCountDisplay) ui.totalWordCountDisplay.textContent = `Загальна кількість слів: ${totalCount}`;
    if (ui.wordGoalDisplay) ui.wordGoalDisplay.textContent = `(Мета: ${goal} слів)`;
    if (ui.wordGoalProgress) ui.wordGoalProgress.style.width = `${Math.min(progress, 100)}%`;
    
    if (currentProjectData) currentProjectData.totalWordCount = totalCount;
}