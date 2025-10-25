// src/modules/auth.js - (Оновлено для v2.8.0)

import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore'; 

import { 
    auth, 
    provider, 
    firestore, // <-- Додано firestore
    setFirebaseRefs, 
    setCurrentUser, 
    setCurrentUserProfile, // <-- НОВЕ
    setCurrentProjectID, 
    setCurrentProjectData,
    ui // <-- Додано ui
} from '../state.js';
import { handleError, showView, hideSpinner, showToast } from '../ui/global.js';
import { projectCache } from '../core/cache.js';
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
 * Отримує або створює профіль користувача в колекції 'users'
 * @param {firebase.User} user - Об'єкт користувача з Firebase Auth
 * @returns {Promise<object>} - Профіль користувача з нашої БД
 */
async function getOrCreateUserProfile(user) {
    if (!firestore) throw new Error("Firestore не ініціалізовано.");
    
    const userRef = firestore.collection('users').doc(user.uid);
    const doc = await userRef.get();

    if (doc.exists) {
        // --- Користувач існує ---
        return doc.data();
    } else {
        // --- Новий користувач ---
        console.log("Створення нового профілю користувача...");
        showToast("Ласкаво просимо! Оберіть ваше ім'я.", "info");

        // Використовуємо ім'я Google як початкове
        const defaultName = user.displayName || "Автор";
        
        // Використовуємо нашу існуючу модалку для запиту імені
        return new Promise((resolve) => {
            if (!ui.createEditModal || !ui.createEditModalTitle || !ui.createEditInput || !ui.createEditConfirmBtn || !ui.createEditCancelBtn) {
                console.error("Елементи модального вікна не знайдені!");
                resolve(null); // Помилка
                return;
            }

            ui.createEditModalTitle.textContent = "Як вас називати?";
            ui.createEditInput.value = defaultName;
            ui.createEditInput.placeholder = "Введіть ваше ім'я";
            ui.createEditCancelBtn.classList.add('hidden'); // Не можна скасувати
            ui.createEditModal.classList.remove('hidden');

            const onConfirm = async () => {
                const newName = ui.createEditInput.value.trim() || defaultName;
                const userProfile = {
                    displayName: newName,
                    email: user.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                try {
                    await userRef.set(userProfile);
                    console.log("Профіль створено:", userProfile);
                    
                    // Очистка
                    ui.createEditModal.classList.add('hidden');
                    ui.createEditCancelBtn.classList.remove('hidden');
                    ui.createEditConfirmBtn.removeEventListener('click', onConfirm);
                    
                    resolve(userProfile);

                } catch (e) {
                    handleError(e, "create-user-profile");
                    resolve(null); // Помилка
                }
            };

            ui.createEditConfirmBtn.addEventListener('click', onConfirm);
        });
    }
}


/**
 * Оновлений спостерігач Auth
 */
async function setupAuthObserver() {
    if (!auth) {
        handleError("Auth не ініціалізовано.", "setupAuthObserver");
        return;
    }
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // --- Користувач увійшов ---
            try {
                setCurrentUser(user);
                
                // Отримуємо або створюємо наш профіль
                const userProfile = await getOrCreateUserProfile(user);
                if (!userProfile) throw new Error("Не вдалося отримати профіль користувача.");
                
                setCurrentUserProfile(userProfile);
                
                // Оновлюємо новий хедер
                if (ui.headerUsername) ui.headerUsername.textContent = userProfile.displayName;
                if (ui.globalHeader) ui.globalHeader.classList.remove('hidden');

                loadUserProjects();
                showView('projects');

            } catch (error) {
                handleError(error, "auth-observer-login");
                hideSpinner();
                showView('auth');
            }

        } else {
            // --- Користувач вийшов ---
            setCurrentUser(null);
            setCurrentUserProfile(null); // <-- Очистка
            setCurrentProjectID(null);
            setCurrentProjectData(null);
            
            if (ui.globalHeader) ui.globalHeader.classList.add('hidden'); // Ховаємо хедер
            
            hideSpinner();
            showView('auth');
            projectCache.clearAll();
        }
    }, error => {
        handleError(error, "auth-check");
    });
}

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

export function signOut() {
    if (!auth) return;
    auth.signOut().then(() => {
        console.log("Користувач вийшов.");
    }).catch(error => {
        handleError(error, "sign-out");
    });
}