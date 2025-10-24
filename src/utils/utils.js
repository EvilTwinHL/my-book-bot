// src/utils/utils.js

import { CONFIG } from '../core/config.js';

/**
 * @param {string} html
 */
export function escapeHTML(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
}

/**
 * @param {string | undefined} text
 * @param {number} [length=CONFIG.SNIPPET_LENGTH]
 */
export function getSnippet(text, length = CONFIG.SNIPPET_LENGTH) {
    if (!text || text.trim() === '') {
        return "<i>(Немає опису)</i>";
    }
    const snippet = escapeHTML(text).substring(0, length);
    return text.length > length ? snippet + "..." : snippet;
}