// === 1. ПІДКЛЮЧЕННЯ ===
const express = require('express');
const path = require('path');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
// v1.1.0: Rate Limiter
const { rateLimit, ipKeyGenerator } = require('express-rate-limit'); // v2.5.1: Додано ipKeyGenerator

// === 2. НАЛАШТУВАННЯ ===
const app = express();
const port = process.env.PORT || 3000;

// v2.3.4: Дозволяємо Express довіряти проксі (Render) для rate-limiter
app.set('trust proxy', 1); 

app.use(express.json({ limit: '50mb' }));

// === v2.5.0: Обслуговування статичних файлів (Vite Production) ===
// У продакшені (після 'npm run build') Express обслуговує папку 'dist'.
if (process.env.NODE_ENV === 'production') {
    console.log("РЕЖИМ: Production. Обслуговування папки dist.");
    // Обслуговування статичних файлів з папки dist
    app.use(express.static(path.join(__dirname, 'dist')));
    
    // Всі GET-запити, що не є API, перенаправляємо на index.html
    app.get(/.*/, (req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
} else {
    // У розробці (без NODE_ENV='production') Express обслуговує поточну папку (для dev-режиму)
    console.log("РЕЖИМ: Development. Фронтенд обслуговується Vite.");
    app.use(express.static('.'));
}

// --- Налаштування Firebase (без змін) ---
try {
    let serviceAccount;
    if (process.env.SERVICE_ACCOUNT_KEY_JSON) {
        serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY_JSON);
    } else {
        serviceAccount = require('./serviceAccountKey.json');
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
} catch (error) {
    console.error("ПОМИЛКА ІНІЦІАЛІЗАЦІЇ FIREBASE:", error.message);
    console.log("Переконайтеся, що SERVICE_ACCOUNT_KEY_JSON або serviceAccountKey.json налаштовано.");
}
const db = admin.firestore();

// --- Налаштування Gemini (без змін) ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// v1.1.0: Rate Limiter Middleware
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 хвилин
    max: 100, // Максимум 100 запитів на IP
    standardHeaders: true,
    legacyHeaders: false,
    // v2.5.1 FIX: Використовуємо ipKeyGenerator для коректної обробки IPv6
    keyGenerator: ipKeyGenerator, 
    message: async (req, res) => {
        res.status(429).json({
            error: "Too Many Requests",
            message: "Забагато запитів. Спробуйте пізніше."
        });
    }
});

// Застосовуємо Rate Limiter тільки до API-маршрутів
app.use(['/chat', '/create-project', '/delete-project', '/save-project-content'], apiLimiter);

// === 3. API МАРШРУТИ === 

// v2.0.0: Маршрут для отримання всіх проєктів користувача
app.get('/get-projects', async (req, res) => {
    const userID = req.query.user;
    if (!userID) {
        return res.status(400).json({ error: "Необхідний ідентифікатор користувача (user ID)." });
    }
    try {
        // v2.0.0: Запит по полю 'owner'
        const projectsRef = db.collection('projects').where('owner', '==', userID).orderBy('updatedAt', 'desc');
        const snapshot = await projectsRef.get();
        
        const projects = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            projects.push({
                id: doc.id,
                title: data.title,
                totalWordCount: data.totalWordCount || 0,
                updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
            });
        });
        res.json(projects);
    } catch (error) {
        console.error("Помилка при отриманні проєктів:", error);
        res.status(500).json({ error: "Не вдалося отримати список проєктів." });
    }
});

// v2.0.0: Маршрут для отримання повного контенту проєкту (ПОКРАЩЕНА ВЕРСІЯ З ДЕТАЛЬНОЮ ВІДЛАДКОЮ)
app.get('/get-project-content', async (req, res) => {
    const { projectID } = req.query;
    if (!projectID) {
        return res.status(400).json({ error: "Необхідний ідентифікатор проєкту." });
    }
    
    try {
        console.log(`=== ЗАВАНТАЖЕННЯ ПРОЄКТУ ${projectID} ===`);
        const projectRef = db.collection('projects').doc(projectID);
        const dataCollectionRef = projectRef.collection('data');
        
        // Отримуємо всі документи одночасно
        const [projectDoc, worldDoc, chatDoc, chaptersDoc, charactersDoc, locationsDoc, plotlinesDoc] = await Promise.all([
            projectRef.get(),
            dataCollectionRef.doc('world').get(),
            dataCollectionRef.doc('chatHistory').get(),
            dataCollectionRef.doc('chapters').get(),
            dataCollectionRef.doc('characters').get(),
            dataCollectionRef.doc('locations').get(),
            dataCollectionRef.doc('plotlines').get()
        ]);

        if (!projectDoc.exists) {
            return res.status(404).json({ error: "Проєкт не знайдено." });
        }

        const projectData = projectDoc.data();
        console.log(`Проєкт знайдено: ${projectData.title}`);
        
        // Отримуємо дані з документів
        const worldData = worldDoc.exists ? worldDoc.data() : {};
        const chatHistory = chatDoc.exists ? (chatDoc.data().history || []) : [];
        
        // Покращена функція для отримання даних з підтримкою старих форматів
        const getDataWithLegacySupport = async (collectionName, doc) => {
            console.log(`\n--- Обробка ${collectionName} ---`);
            
            // Спершу пробуємо новий формат (поле items)
            if (doc.exists) { // (A)
                const docData = doc.data();
                console.log(`Документ ${collectionName} існує:`, Object.keys(docData));
                
                if (docData.items && Array.isArray(docData.items)) {
                    console.log(`Знайдено новий формат (items): ${docData.items.length} елементів`);
                    return docData.items; // (B) New format success
                }
                
                // v2.5.6 CRITICAL FIX: Якщо документ існує, але поле items відсутнє/пошкоджене,
                // це означає, що міграція відбулася або був некоректний запис. 
                // Ми виходимо, щоб уникнути перевірки legacy, яка може повернути [].
                console.warn(`Документ ${collectionName} існує, але items відсутній/пошкоджений. Повертаємо пустий масив, вважаючи, що міграція відбулася.`);
                return []; // Вихід, щоб не перевіряти старий формат

            } else { // (C) New document does NOT exist (first load/no saves)
                console.log(`Документ ${collectionName} не існує`);
            }
            
            // Якщо новий документ не існує, перевіряємо старий формат (субколекції)
            console.log(`Перевіряємо старий формат для ${collectionName}...`);
            const oldCollectionRef = dataCollectionRef.doc(collectionName).collection('items');
            
            try {
                const oldSnapshot = await oldCollectionRef.get();
                console.log(`Старі дані ${collectionName}: ${oldSnapshot.size} елементів`);
                
                if (!oldSnapshot.empty) {
                    console.log(`Знайдено старі дані в субколекції для ${collectionName}: ${oldSnapshot.size} елементів`);
                    const oldItems = [];
                    
                    oldSnapshot.forEach(oldDoc => {
                        const itemData = oldDoc.data();
                        console.log(`Елемент ${oldDoc.id}:`, { 
                            title: itemData.title || itemData.name,
                            hasText: !!itemData.text,
                            hasDescription: !!itemData.description
                        });
                        
                        oldItems.push({
                            ...itemData,
                            id: oldDoc.id
                        });
                    });
                    
                    // Сортуємо за index
                    oldItems.sort((a, b) => (a.index || 0) - (b.index || 0));
                    console.log(`Відсортовано ${oldItems.length} елементів для ${collectionName}`);
                    
                    // Автоматично мігруємо дані в новий формат
                    console.log(`Мігруємо дані ${collectionName} в новий формат...`);
                    const newDocRef = dataCollectionRef.doc(collectionName);
                    // Використовуємо set без merge, щоб замінити старий документ
                    await newDocRef.set({ items: oldItems }); 
                    console.log(`Міграція ${collectionName} завершена!`);
                    
                    return oldItems;
                } else {
                    console.log(`Старі дані для ${collectionName} не знайдено`);
                }
            } catch (error) {
                console.error(`Помилка при перевірці старих даних для ${collectionName}:`, error);
            }
            
            // Якщо немає даних в жодному форматі
            console.log(`Жодних даних не знайдено для ${collectionName}, повертаємо пустий масив`);
            return [];
        };

        // Отримуємо дані з підтримкою обох форматів
        console.log('\n=== ОТРИМАННЯ ДАНИХ ===');
        const chapters = await getDataWithLegacySupport('chapters', chaptersDoc);
        const characters = await getDataWithLegacySupport('characters', charactersDoc);
        const locations = await getDataWithLegacySupport('locations', locationsDoc);
        const plotlines = await getDataWithLegacySupport('plotlines', plotlinesDoc);

        console.log('\n=== РЕЗУЛЬТАТИ ===');
        console.log(`Розділи: ${chapters.length}`);
        console.log(`Персонажі: ${characters.length}`);
        console.log(`Локації: ${locations.length}`);
        console.log(`Сюжетні лінії: ${plotlines.length}`);

        const responseData = {
            id: projectDoc.id,
            title: projectData.title,
            owner: projectData.owner,
            totalWordCount: projectData.totalWordCount || 0,
            updatedAt: projectData.updatedAt ? projectData.updatedAt.toDate().toISOString() : new Date().toISOString(),
            content: {
                premise: worldData.premise || '',
                theme: worldData.theme || '',
                mainArc: worldData.mainArc || '',
                wordGoal: worldData.wordGoal || 50000,
                notes: worldData.notes || '',
                research: worldData.research || '',
                chapters: chapters,
                characters: characters,
                locations: locations,
                plotlines: plotlines
            },
            chatHistory: chatHistory
        };

        res.json(responseData);

    } catch (error) {
        console.error("Помилка при отриманні контенту проєкту:", error);
        res.status(500).json({ error: "Не вдалося отримати контент проєкту." });
    }
});

// v2.0.0: Маршрут для збереження контенту (ВИПРАВЛЕНО)
app.post('/save-project-content', async (req, res) => {
    const { projectID, field, value } = req.body;
    if (!projectID || !field) {
        return res.status(400).json({ error: "Необхідні projectID та field." });
    }

    try {
        const batch = db.batch();
        const projectRef = db.collection('projects').doc(projectID);
        const dataCollectionRef = projectRef.collection('data');

        // Оновлюємо основний документ проєкту
        batch.update(projectRef, {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        // World fields
        if (field.startsWith('content.')) {
            const worldField = field.substring('content.'.length);
            
            // Перевіряємо, чи це поле світу (не список)
            const worldFields = ['premise', 'theme', 'mainArc', 'wordGoal', 'notes', 'research'];
            if (worldFields.includes(worldField)) {
                const worldDocRef = dataCollectionRef.doc('world');
                const update = {};
                update[worldField] = value;
                batch.set(worldDocRef, update, { merge: true });

                if (worldField === 'wordGoal') {
                    batch.update(projectRef, { wordGoal: value });
                }
            }
        } 
        
        // Chat History
        if (field === 'chatHistory') {
            const chatDocRef = dataCollectionRef.doc('chatHistory');
            batch.set(chatDocRef, { history: value });
        }
        
        // Lists (chapters, characters, locations, plotlines)
        const listFields = ['content.chapters', 'content.characters', 'content.locations', 'content.plotlines'];
        if (listFields.includes(field)) {
            const collectionName = field.substring('content.'.length);
            const listDocRef = dataCollectionRef.doc(collectionName);
            
            // Зберігаємо весь масив у полі 'items'
            batch.set(listDocRef, { items: value });
            
            // Оновлюємо загальний лічильник слів для розділів
            if (collectionName === 'chapters') {
                const totalWordCount = value.reduce((sum, item) => sum + (item.word_count || 0), 0);
                batch.update(projectRef, { totalWordCount: totalWordCount });
            }
        }

        await batch.commit();
        res.status(200).json({ status: 'saved' });

    } catch (error) {
        console.error("Помилка при збереженні контенту:", error);
        res.status(500).json({ error: "Не вдалося зберегти контент проєкту." });
    }
});

// Додатковий маршрут для примусової міграції даних
app.post('/migrate-project-data', async (req, res) => {
    const { projectID } = req.body;
    if (!projectID) {
        return res.status(400).json({ error: "Необхідний projectID." });
    }

    try {
        console.log(`=== ПРИМУСОВА МІГРАЦІЯ ПРОЄКТУ ${projectID} ===`);
        const projectRef = db.collection('projects').doc(projectID);
        const dataCollectionRef = projectRef.collection('data');

        const collectionsToMigrate = ['chapters', 'characters', 'locations', 'plotlines'];
        let totalMigrated = 0;

        for (const collectionName of collectionsToMigrate) {
            console.log(`\n--- Міграція ${collectionName} ---`);
            
            // Перевіряємо старі дані
            const oldCollectionRef = dataCollectionRef.doc(collectionName).collection('items');
            const oldSnapshot = await oldCollectionRef.get();
            
            if (oldSnapshot.empty) {
                console.log(`Старі дані для ${collectionName} не знайдені`);
                continue;
            }

            console.log(`Знайдено ${oldSnapshot.size} старих елементів в ${collectionName}`);
            
            // Збираємо старі дані
            const oldItems = [];
            oldSnapshot.forEach(oldDoc => {
                const itemData = oldDoc.data();
                console.log(`Елемент ${oldDoc.id}:`, { 
                    title: itemData.title || itemData.name,
                    id: oldDoc.id
                });
                
                oldItems.push({
                    ...itemData,
                    id: oldDoc.id
                });
            });

            // Сортуємо за index
            oldItems.sort((a, b) => (a.index || 0) - (b.index || 0));

            // Зберігаємо в новому форматі
            const newDocRef = dataCollectionRef.doc(collectionName);
            await newDocRef.set({ items: oldItems });
            
            console.log(`Міграція ${collectionName} завершена: ${oldItems.length} елементів`);
            totalMigrated += oldItems.length;
        }

        res.json({ 
            status: 'success', 
            message: `Міграція завершена. Перенесено ${totalMigrated} елементів.`,
            migrated: totalMigrated
        });

    } catch (error) {
        console.error("Помилка при міграції даних:", error);
        res.status(500).json({ error: "Не вдалося мігрувати дані." });
    }
});

// v2.0.0: Маршрут для створення проєкту
app.post('/create-project', async (req, res) => {
    const { title, user } = req.body;
    if (!title || !user) {
        return res.status(400).json({ error: "Необхідні title та user ID." });
    }

    try {
        const projectRef = db.collection('projects').doc();
        const projectID = projectRef.id;
        
        // --- 1. Створюємо головний документ (projects/{id}) ---
        await projectRef.set({
            title: title,
            owner: user,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            totalWordCount: 0,
            wordGoal: 50000,
        });

        const dataCollectionRef = projectRef.collection('data');
        
        // --- 2. Створюємо допоміжні документи в субколекції data ---
        
        // 2.1. World (основна інформація)
        await dataCollectionRef.doc('world').set({
            premise: '', theme: '', mainArc: '', wordGoal: 50000, notes: '', research: ''
        });

        // 2.2. Chat History
        await dataCollectionRef.doc('chatHistory').set({
            history: []
        });

        // 2.3. Списки (розділи, персонажі, локації, сюжет)
        const emptyLists = ['chapters', 'characters', 'locations', 'plotlines'];
        for (const listName of emptyLists) {
            await dataCollectionRef.doc(listName).set({ items: [] });
        }

        res.status(201).json({ 
            id: projectID, 
            message: "Проєкт створено",
            data: {
                title: title,
                content: { chapters: [], characters: [], locations: [], plotlines: [] },
                chatHistory: []
            } 
        });

    } catch (error) {
        console.error("Помилка при створенні проєкту:", error);
        res.status(500).json({ error: "Не вдалося створити проєкт." });
    }
});

// v2.0.0: Маршрут для видалення проєкту
app.post('/delete-project', async (req, res) => {
    const { projectID } = req.body;
    if (!projectID) {
        return res.status(400).json({ error: "Необхідний projectID." });
    }

    try {
        const projectRef = db.collection('projects').doc(projectID);

        // --- 1. Рекурсивне видалення субколекцій (data) ---
        const dataCollectionRef = projectRef.collection('data');
        
        // Оскільки в 'data' всього декілька документів (world, chatHistory, chapters, ...),
        // ми можемо видалити їх явно або видалити всю колекцію data.
        await deleteCollection(db, dataCollectionRef, 10);
        
        // --- 2. Видалення головного документа ---
        await projectRef.delete();

        res.status(200).json({ status: 'deleted' });
    } catch (error) {
        console.error("Помилка при видаленні проєкту:", error);
        res.status(500).json({ error: "Не вдалося видалити проєкт." });
    }
});

// v2.0.0: Маршрут для оновлення назви проєкту
app.post('/update-title', async (req, res) => {
    const { projectID, newTitle } = req.body;
    if (!projectID || !newTitle) {
        return res.status(400).json({ error: "Необхідні projectID та newTitle." });
    }
    try {
        const projectRef = db.collection('projects').doc(projectID);
        await projectRef.update({
            title: newTitle,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        res.status(200).json({ status: 'updated' });
    } catch (error) {
        console.error("Помилка при оновленні назви:", error);
        res.status(500).json({ error: "Не вдалося оновити назву проєкту." });
    }
});

// v2.0.0: Маршрут для експорту проєкту
app.get('/export-project', async (req, res) => {
    const { projectID } = req.query;
    if (!projectID) {
        return res.status(400).json({ error: "Необхідний projectID." });
    }

    try {
        // Завантажуємо контент проєкту
        const projectContentResponse = await fetch(`http://localhost:${port}/get-project-content?projectID=${projectID}`);
        if (!projectContentResponse.ok) {
            throw new Error("Не вдалося завантажити контент для експорту.");
        }
        const { title, content } = await projectContentResponse.json();

        // Формуємо текст для експорту
        let exportText = `Назва: ${title}\n`;
        exportText += `Слів: ${content.totalWordCount || 0}\n`;
        exportText += `Мета: ${content.wordGoal || 50000}\n\n`;
        exportText += `=====================================\n\n`;

        // 1. Світ
        exportText += `--- СВІТ ТА КОНЦЕПЦІЯ ---\n\n`;
        exportText += `Преміса (Logline):\n${content.premise || '...'}\n\n`;
        exportText += `Тема:\n${content.theme || '...'}\n\n`;
        exportText += `Головна арка:\n${content.mainArc || '...'}\n\n`;
        exportText += `Нотатки:\n${content.notes || '...'}\n\n`;
        exportText += `Дослідження:\n${content.research || '...'}\n\n`;
        exportText += `=====================================\n\n`;

        // 2. Персонажі
        if (content.characters && content.characters.length > 0) {
            exportText += `--- ПЕРСОНАЖІ (${content.characters.length}) ---\n\n`;
            content.characters.forEach(p => {
                exportText += `ІМ'Я: ${p.name || 'Без імені'}\n`;
                exportText += `ОПИС: ${p.description || 'Немає опису'}\n`;
                exportText += `АРКА: ${p.arc || 'Немає арки'}\n\n`;
                exportText += `-----------\n\n`;
            });
            exportText += `=====================================\n\n`;
        }

        // 3. Локації
        if (content.locations && content.locations.length > 0) {
            exportText += `--- ЛОКАЦІЇ (${content.locations.length}) ---\n\n`;
            content.locations.forEach(l => {
                exportText += `НАЗВА: ${l.name || 'Без назви'}\n`;
                exportText += `ОПИС: ${l.description || 'Немає опису'}\n\n`;
                exportText += `-----------\n\n`;
            });
            exportText += `=====================================\n\n`;
        }

        // 4. Сюжетні лінії
        if (content.plotlines && content.plotlines.length > 0) {
            exportText += `--- СЮЖЕТНІ ЛІНІЇ (${content.plotlines.length}) ---\n\n`;
            content.plotlines.forEach(p => {
                exportText += `НАЗВА: ${p.title || 'Без назви'}\n`;
                exportText += `ОПИС: ${p.description || 'Немає опису'}\n\n`;
                exportText += `-----------\n\n`;
            });
            exportText += `=====================================\n\n`;
        }

        // 5. Розділи (ОСНОВНИЙ КОНТЕНТ)
        if (content.chapters && content.chapters.length > 0) {
            exportText += `--- РОЗДІЛИ (${content.chapters.length}) ---\n\n`;
            content.chapters.forEach((chapter, index) => {
                exportText += `### РОЗДІЛ ${index + 1}: ${chapter.title || 'Без назви'} (Статус: ${chapter.status || 'draft'})\n\n`;
                if (chapter.synopsis) {
                    exportText += `СИНОПСИС:\n${chapter.synopsis}\n\n`;
                }
                exportText += `--- ТЕКСТ РОЗДІЛУ ---\n\n`;
                exportText += `${chapter.text || '(Немає тексту)'}\n\n`;
                exportText += `=====================================\n\n`;
            });
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${title || 'export'}_${new Date().toISOString().slice(0, 10)}.txt"`);
        res.send(exportText);
    } catch (error) {
        console.error("Помилка при експорті проєкту:", error);
        res.status(500).json({ error: "Не вдалося експортувати проєкт." });
    }
});

// v2.3.0: Маршрут для чату (оновлено для селективного контексту)
app.post('/chat', async (req, res) => {
    const { projectID, message, contextOptions } = req.body;
    if (!projectID || !message) {
        return res.status(400).json({ error: "Необхідні projectID та message." });
    }

    try {
        const projectRef = db.collection('projects').doc(projectID);
        const dataCollectionRef = projectRef.collection('data');
        
        // --- 1. Отримуємо дані для контексту ---
        const [projectDoc, worldDoc, chatDoc, chaptersDoc, charactersDoc, locationsDoc, plotlinesDoc] = await Promise.all([
            projectRef.get(),
            dataCollectionRef.doc('world').get(),
            dataCollectionRef.doc('chatHistory').get(),
            dataCollectionRef.doc('chapters').get(),
            dataCollectionRef.doc('characters').get(),
            dataCollectionRef.doc('locations').get(),
            dataCollectionRef.doc('plotlines').get()
        ]);

        if (!projectDoc.exists) {
            return res.status(404).json({ error: "Проєкт не знайдено." });
        }

        const projectTitle = projectDoc.data().title;
        const worldData = worldDoc.exists ? worldDoc.data() : {};
        const currentChatHistory = chatDoc.exists ? (chatDoc.data().history || []) : [];

        // Функція для отримання даних з підтримкою обох форматів
        const getDataForChat = async (doc, collectionName) => {
            if (doc.exists && doc.data().items) {
                return doc.data().items || [];
            }
            
            // Перевіряємо старий формат
            const oldCollectionRef = dataCollectionRef.doc(collectionName).collection('items');
            const oldSnapshot = await oldCollectionRef.get();
            
            if (!oldSnapshot.empty) {
                const oldItems = [];
                oldSnapshot.forEach(oldDoc => {
                    oldItems.push(oldDoc.data());
                });
                oldItems.sort((a, b) => (a.index || 0) - (b.index || 0));
                return oldItems;
            }
            
            return [];
        };

        // --- 2. Збираємо контекст (Project Content) ---
        let context = `Я - письменник, що працює над книгою: "${projectTitle}". \n`;
        context += `Моя роль: допомогти мені у творчому процесі. \n`;
        context += `Твої відповіді мають бути лаконічними, зосередженими та корисними, з огляду на наданий контекст. \n\n`;
        context += `--- ЯДРО ТА МЕТА ПРОЄКТУ ---\n`;
        context += `Тема: ${worldData.theme || '...'}\n`;
        context += `Головна арка: ${worldData.mainArc || '...'}\n`;
        context += `Преміса (Logline): ${worldData.premise || '...'}\n\n`;

        // Змінні для керування контекстом
        const { includeWorld, includeChapters, includeCharacters, includeLocations, includePlotlines } = contextOptions || {};
        
        // 2.1. Список розділів
        if (includeChapters) {
            const chapters = await getDataForChat(chaptersDoc, 'chapters');
            
            if (chapters.length > 0) {
                context += `--- РОЗДІЛИ (${chapters.length}) ---\n\n`;
                chapters.forEach((chapter, index) => {
                    context += `[ РОЗДІЛ ${index + 1}: ${chapter.title || 'Без назви'} (Слів: ${chapter.word_count || 0}) ]\n`;
                    context += `Синопсис: ${chapter.synopsis || 'Немає синопсису'}\n\n`;
                });
            }
        }
        
        // 2.2. Персонажі
        if (includeCharacters) {
            const characters = await getDataForChat(charactersDoc, 'characters');
            
            if (characters.length > 0) {
                context += `--- ПЕРСОНАЖІ (${characters.length}) ---\n\n`;
                characters.forEach(p => {
                    context += `Ім'я: ${p.name || '...'}\nОпис: ${p.description || '...'}\nАрка: ${p.arc || '...'}\n\n`;
                });
            }
        }
        
        // 2.3. Локації
        if (includeLocations) {
            const locations = await getDataForChat(locationsDoc, 'locations');
            
            if (locations.length > 0) {
                context += `--- ЛОКАЦІЇ (${locations.length}) ---\n\n`;
                locations.forEach(l => {
                    context += `Назва: ${l.name || '...'}\nОпис: ${l.description || '...'}\n\n`;
                });
            }
        }
        
        // 2.4. Сюжетні лінії
        if (includePlotlines) {
            const plotlines = await getDataForChat(plotlinesDoc, 'plotlines');

            if (plotlines.length > 0) {
                context += `--- СЮЖЕТНІ ЛІНІЇ (${plotlines.length}) ---\n\n`;
                plotlines.forEach(p => {
                    context += `Назва: ${p.title || '...'}\nОпис: ${p.description || '...'}\n\n`;
                });
            }
        }
        
        // 3. Формуємо історію чату (System + History + New Message)
        const systemMessage = { role: "system", parts: [{ text: context }] };
        
        const fullHistory = [systemMessage, ...currentChatHistory];
        fullHistory.push({ role: "user", parts: [{ text: message }] });
        
        // --- 4. Виклик Gemini API ---
        const chat = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }).chats();

        const result = await chat.sendMessage({
            contents: fullHistory 
        });

        const modelResponse = result.text.trim();
        
        // --- 5. Оновлюємо історію в Firestore (якщо запит успішний) ---
        const newChatHistory = [...currentChatHistory];
        newChatHistory.push({ role: "user", parts: [{ text: message }] });
        newChatHistory.push({ role: "model", parts: [{ text: modelResponse }] });
        
        // Оновлюємо документ chatHistory
        await dataCollectionRef.doc('chatHistory').set({ history: newChatHistory });
        
        // Оновлюємо updated дату проєкту
        await projectRef.update({ updatedAt: admin.firestore.FieldValue.serverTimestamp() });

        res.json({ message: modelResponse });

    } catch (error) {
        console.error("Помилка під час чату з Gemini:", error);
        res.status(500).json({ error: "Помилка зв'язку з AI-асистентом." });
    }
});

// v1.1.0: API для логування клієнтських помилок (без змін)
app.post('/log-error', (req, res) => {
    const errorLog = req.body;
    console.error(`КЛІЄНТСЬКА ПОМИЛКА: ${JSON.stringify(errorLog)}`);
    res.status(200).send({ status: 'logged' });
});

// --- Запуск сервера (без змін) ---
app.listen(port, () => {
    console.log(`Сервер запущено на http://localhost:${port}`);
});

// === ОНОВЛЕНО v2.0.0: Допоміжна функція для видалення субколекцій ===
async function deleteCollection(db, collectionRef, batchSize) {
    const query = collectionRef.limit(batchSize);
    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve, reject);
    });
}

async function deleteQueryBatch(db, query, resolve, reject) {
    try {
        const snapshot = await query.get();
        if (snapshot.size === 0) {
            return resolve();
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        if (snapshot.size === batchSize) {
            setTimeout(() => {
                deleteQueryBatch(db, query, resolve, reject);
            }, 100);
        } else {
            resolve();
        }
    } catch (error) {
        reject(error);
    }
}