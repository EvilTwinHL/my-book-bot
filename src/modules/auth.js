// src/modules/auth.js

import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore'; 

import { 
    auth, 
    provider, 
    setFirebaseRefs, 
    setCurrentUser, 
    setCurrentProjectID, 
    setCurrentProjectData 
} from '../state.js';
import { handleError, showView, hideSpinner } from '../ui/global.js';
import { projectCache } from '../core/cache.js';
import { ui } from '../state.js'; // Отримуємо ui зі state
import { loadUserProjects } from './projects.js';

// --- Ініціалізація Firebase ---

export function initializeFirebase() {
    try {
        const firebaseConfig = window.firebaseConfig; 
        
        if (!firebaseConfig || !firebaseConfig.apiKey) {
            throw new Error("firebaseConfig не знайдено або неповний.");
        }
        
        const app = firebase.initializeApp(firebaseConfig);
        
        // Зберігаємо посилання на Firebase Auth та Firestore у глобальному стані
        setFirebaseRefs(app.auth(), new firebase.auth.GoogleAuthProvider(), app.firestore());
        
        console.log("Firebase ініціалізовано.");
        setupAuthObserver();
    } catch (error) {
        handleError(error, "firebase-init");
    }
}

/**
 * ▼▼▼ НОВА ФУНКЦІЯ v2.7.0 ▼▼▼
 * Отримує або створює displayName для користувача.
 * @param {firebase.User} user - Об'єкт користувача Firebase
 */
async function getOrCreateDisplayName(user) {
    if (user.displayName) {
        return user.displayName;
    }

    // Якщо displayName немає, створюємо його за замовчуванням
    // TODO: Замінити це модальним вікном, що питає ім'я при першому вході
    let newName = user.email ? user.email.split('@')[0] : "Користувач";
    
    try {
        await user.updateProfile({
            displayName: newName
        });
        return newName;
    } catch (error) {
        console.error("Помилка оновлення профілю:", error);
        return "Користувач"; // Повертаємо запасний варіант
    }
}

/**
 * ▼▼▼ ОНОВЛЕНА ФУНКЦІЯ v2.7.0 ▼▼▼
 * Cтежить за станом автентифікації та оновлює UI.
 */
function setupAuthObserver() {
    if (!auth) {
        handleError("Auth не ініціалізовано.", "setupAuthObserver");
        return;
    }
    
    // Робимо колбек асинхронним, щоб чекати getOrCreateDisplayName
    auth.onAuthStateChanged(async (user) => { 
        if (user) {
            // --- Користувач увійшов ---
            setCurrentUser(user);
            
            // Отримуємо ім'я та оновлюємо новий хедер
            const displayName = await getOrCreateDisplayName(user);
            if (ui.headerUsername) ui.headerUsername.textContent = displayName;
            if (ui.globalHeader) ui.globalHeader.classList.remove('hidden'); // Показываємо хедер

            // Завантажуємо проєкти та показуємо view
            loadUserProjects();
            showView('projects'); 
            
            // --- Старий код (видалено) ---
            // if (ui.userDisplay) ui.userDisplay.textContent = `Вітаємо, ${user.displayName || user.email}`;
            // if (ui.signOutBtn) ui.signOutBtn.classList.remove('hidden');

        } else {
            // --- Користувач вийшов ---
            setCurrentUser(null);
            setCurrentProjectID(null);
            setCurrentProjectData(null);
            
            // Ховаємо новий хедер
            if (ui.globalHeader) ui.globalHeader.classList.add('hidden');
            
            hideSpinner();
            showView('auth');
            projectCache.clearAll();

            // --- Старий код (видалено) ---
            // if (ui.userDisplay) ui.userDisplay.textContent = '';
            // if (ui.signOutBtn) ui.signOutBtn.classList.add('hidden');
        }
    }, error => {
        handleError(error, "auth-check");
    });
}

// --- Функція входу (без змін) ---
export function signIn() {
    if (!auth || !provider) {
        handleError("Firebase Auth не ініціалізовано.", "sign-in");
        return;
    }
    
    auth.signInWithPopup(provider)
        .then(result => {
            console.log("Успішний вхід (Popup):", result.user.displayName);
        })
        .catch(error => {
            if (error.code !== 'auth/popup-closed-by-user') {
                 handleError(error, "sign-in-popup");
            }
            hideSpinner();
        });
}

// --- Функція виходу (без змін) ---
// onAuthStateChanged автоматично обробить вихід
export function signOut() {
    if (!auth) return;
    auth.signOut().then(() => {
        console.log("Користувач вийшов.");
    }).catch(error => {
        handleError(error, "sign-out");
    });
}