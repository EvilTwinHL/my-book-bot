// src/core/cache.js

import { CONFIG } from './config.js';

export const projectCache = {
    /**
     * @param {string} key 
     * @param {object} data 
     */
    set: (key, data) => {
        try {
            if (!data || !data.content) throw new Error("Немає даних для кешування.");

            const item = {
                data: data,
                timestamp: new Date().getTime()
            };
            sessionStorage.setItem(key, JSON.stringify(item));
            console.log("Проєкт", key, "збережено в кеш.");
        } catch (e) {
            console.warn("Помилка збереження в кеш:", e);
            sessionStorage.removeItem(key);
        }
    },
    /**
     * @param {string} key 
     * @returns {object | null}
     */
    get: (key) => {
        try {
            const itemStr = sessionStorage.getItem(key);
            if (!itemStr) { return null; }
            
            const item = JSON.parse(itemStr);
            const now = new Date().getTime();
            const expiryTime = CONFIG.CACHE_DURATION_MIN * 60 * 1000;
            
            if (now - item.timestamp > expiryTime || !item.data || !item.data.content) {
                console.log("Кеш", key, "прострочено або пошкоджено. Видалення...");
                sessionStorage.removeItem(key);
                return null;
            }
            console.log("Проєкт", key, "завантажено з кешу.");
            return item.data;
        } catch (e) {
            console.warn("Помилка читання з кешу, кеш очищено:", e);
            sessionStorage.removeItem(key);
            return null;
        }
    },
    /**
     * @param {string} key
     */
    clear: (key) => {
        sessionStorage.removeItem(key);
        console.log("Кеш", key, "очищено.");
    },
    clearAll: () => {
        sessionStorage.clear();
        console.log("Весь кеш sessionStorage очищено.");
    }
};
