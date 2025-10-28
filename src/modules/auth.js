// src/modules/auth.js - (Виправлено v2.9.19: Коректні назви View)

import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore'; 

import { 
    auth, 
    provider, 
    firestore, 
    setFirebaseRefs, 
    setCurrentUser, 
    setCurrentUserProfile, 
    setCurrentProjectID, 
    setCurrentProjectData,
    ui
} from '../state.js';
import { handleError, showView, hideSpinner, showToast } from '../ui/global.js';
import { projectCache } from '../core/cache.js';

// ПРЯМИЙ ІМПОРТ: Замість динамічних обгорток, використовуємо прямий імпорт, що є стандартом ES модулів
import { loadProjects } from './projects.js';

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
        // Якщо ініціалізація Firebase провалюється, ми повинні показати екран входу як фолбек.
        showView('auth-container'); 
    }
}

/**
 * Отримує або створює профіль користувача в колекції 'users'
 * (Логіка без змін)
 */
async function getOrCreateUserProfile(user) {
    if (!firestore) throw new Error("Firestore не ініціалізовано.");
    
    const userRef = firestore.collection('users').doc(user.uid);
    const doc = await userRef.get();

    if (doc.exists) {
        return doc.data();
    } else {
        console.log("Створення нового профілю користувача...");
        showToast("Ласкаво просимо! Оберіть ваше ім'я.", "info");

        const defaultName = user.displayName || "Автор";
        
        return new Promise((resolve) => {
            if (!ui.simpleEditModal || !ui.simpleEditModalTitle || !ui.simpleEditModalInput || !ui.simpleEditModalConfirmBtn || !ui.simpleEditModalCancelBtn) {
                console.error("Елементи модального вікна не знайдені!");
                resolve(null); 
                return;
            }

            ui.simpleEditModalTitle.textContent = "Як вас називати?";
            ui.simpleEditModalInput.value = defaultName;
            ui.simpleEditModalInput.placeholder = "Введіть ваше ім'я";
            ui.simpleEditModalCancelBtn.classList.add('hidden'); 
            ui.simpleEditModal.classList.remove('hidden');

            const onConfirm = async () => {
                const newName = ui.simpleEditModalInput.value.trim() || defaultName;
                const userProfile = {
                    displayName: newName,
                    email: user.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                try {
                    await userRef.set(userProfile);
                    console.log("Профіль створено:", userProfile);
                    
                    ui.simpleEditModal.classList.add('hidden');
                    ui.simpleEditModalCancelBtn.classList.remove('hidden');
                    ui.simpleEditModalConfirmBtn.removeEventListener('click', onConfirm);
                    
                    resolve(userProfile);

                } catch (e) {
                    handleError(e, "create-user-profile");
                    resolve(null); 
                }
            };

            ui.simpleEditModalConfirmBtn.addEventListener('click', onConfirm);
        });
    }
}


/**
 * Оновлений спостерігач Auth
 */
async function setupAuthObserver() {
    if (!auth) {
        handleError("Auth не ініціалізовано.", "setupAuthObserver");
        showView('auth-container'); // Фолбек, якщо auth не ініціалізовано
        return;
    }
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // --- Користувач увійшов ---
            try {
                setCurrentUser(user);
                
                const userProfile = await getOrCreateUserProfile(user);
                if (!userProfile) throw new Error("Не вдалося отримати профіль користувача.");
                
                setCurrentUserProfile(userProfile);
                
                // Оновлюємо новий хедер
                if (ui.headerUsername) ui.headerUsername.textContent = userProfile.displayName;
                if (ui.globalHeader) ui.globalHeader.classList.remove('hidden');

                // Переходимо до завантаження проєктів
                loadProjects(); 
                
                // loadProjects() ВЖЕ викликає showView('projects-view')

            } catch (error) {
                handleError(error, "auth-observer-login");
                hideSpinner();
                showView('auth-container'); // !!! ВИПРАВЛЕНО: 'auth' -> 'auth-container'
            }

        } else {
            // --- Користувач вийшов / Не увійшов ---
            setCurrentUser(null);
            setCurrentUserProfile(null); 
            setCurrentProjectID(null);
            setCurrentProjectData(null);
            
            if (ui.globalHeader) ui.globalHeader.classList.add('hidden'); 
            
            hideSpinner();
            showView('auth-container'); // !!! ВИПРАВЛЕНО: 'auth' -> 'auth-container'
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