// src/core/config.js

/**
 * CONFIGURATION SETTINGS (v2.6.2)
 */
export const CONFIG = {
    APP_VERSION: "2.6.2", // ОНОВЛЕНО v2.6.2 (fix(deploy): Resolve Express PathError in production mode)
    AUTOSAVE_DELAY: 1500, // ms
    DEFAULT_GOAL_WORDS: 50000,
    SNIPPET_LENGTH: 80, // characters
    TOAST_DURATION: 3000, // ms
    CACHE_KEY_PROJECT: 'opusProjectCache',
    CACHE_DURATION_MIN: 5, 
    HISTORY_DEBOUNCE: 500 // v1.6.0
};
