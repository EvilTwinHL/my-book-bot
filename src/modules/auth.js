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
import { ui } from '../state.js';
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

function setupAuthObserver() {
    if (!auth) {
        handleError("Auth не ініціалізовано.", "setupAuthObserver");
        return;
    }
    
    auth.onAuthStateChanged(user => {
        if (user) {
            setCurrentUser(user);
            if (ui.userDisplay) ui.userDisplay.textContent = `Вітаємо, ${user.displayName || user.email}`;
            if (ui.signOutBtn) ui.signOutBtn.classList.remove('hidden');
            loadUserProjects();
            showView('projects');
        } else {
            setCurrentUser(null);
            setCurrentProjectID(null);
            setCurrentProjectData(null);
            if (ui.userDisplay) ui.userDisplay.textContent = '';
            if (ui.signOutBtn) ui.signOutBtn.classList.add('hidden');
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
