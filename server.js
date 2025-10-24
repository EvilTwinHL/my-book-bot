// === 1. ПІДКЛЮЧЕННЯ ===
const express = require('express');
const path = require('path');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit'); // v2.5.1
const fetch = require('node-fetch'); // Для експорту

// === 2. НАЛАШТУВАННЯ ===
const app = express();
const port = process.env.PORT || 3000;

// v2.3.4: Дозволяємо Express довіряти проксі (Render) для rate-limiter
app.set('trust proxy', 1); 

app.use(express.json({ limit: '50mb' }));

// --- Налаштування Firebase Admin ---
let db;
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
    db = admin.firestore(); // Ініціалізація бази
} catch (error) {
    console.error("ПОМИЛКА КРИТИЧНОЇ ІНІЦІАЛІЗАЦІЇ FIREBASE ADMIN:", error.message);
    db = null; 
}


// --- Налаштування Gemini ---
let genAI;
let model;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
} else {
    console.error("ПОМИЛКА ІНІЦІАЛІЗАЦІЇ GEMINI: GEMINI_API_KEY не знайдено.");
    model = null;
}


// v1.1.0: Rate Limiter Middleware
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 хвилин
    max: 100, // Максимум 100 запитів на IP
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator, 
    message: async (req, res) => {
        res.status(429).json({
            error: "Too Many Requests",
            message: "Забагато запитів. Спробуйте пізніше."
        });
    }
});

// Застосовуємо Rate Limiter тільки до API-маршрутів
app.use(['/chat', '/create-project', '/delete-project', '/save-project-content', '/get-projects', '/get-project-content', '/update-title', '/export-project', '/migrate-project-data'], apiLimiter);


// === 3. API МАРШРУТИ (ПОВИННІ ЙТИ ПЕРЕД ОБСЛУГОВУВАННЯМ ФРОНТЕНДУ) === 

// v2.0.0: Маршрут для отримання всіх проєктів користувача
app.get('/get-projects', async (req, res) => {
    if (!db) return res.status(500).json({ error: "Сервіси бази даних не ініціалізовані." });
    
    const userID = req.query.user;
    if (!userID) {
        return res.status(400).json({ error: "Необхідний ідентифікатор користувача (user ID)." });
    }
    try {
        // v2.6.5 FIX: Використовуємо поле 'owner' для пошуку за UID
        const projectsRef = db.collection('projects')
            .where('owner', '==', userID) 
            .orderBy('updatedAt', 'desc'); 
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
        
        // v2.6.3: Повертаємо масив (навіть якщо він порожній)
        res.json(projects); 
        
    } catch (error) {
        console.error("Помилка при отриманні проєктів:", error);
        res.status(500).json({ error: "Не вдалося отримати список проєктів." });
    }
});

// v2.0.0: Маршрут для отримання повного контенту проєкту (З ЛОГІКОЮ МІГРАЦІЇ)
app.get('/get-project-content', async (req, res) => {
    if (!db) return res.status(500).json({ error: "Сервіси бази даних не ініціалізовані." });
    
    const { projectID } = req.query;
    if (!projectID) {
        return res.status(400).json({ error: "Необхідний ідентифікатор проєкту." });
    }
    
    try {
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
        const worldData = worldDoc.exists ? worldDoc.data() : {};
        const chatHistory = chatDoc.exists ? (chatDoc.data().history || []) : [];
        
        const getDataWithLegacySupport = async (collectionName, doc) => {
            if (doc.exists) { 
                const docData = doc.data();
                if (docData.items && Array.isArray(docData.items)) {
                    return docData.items; 
                }
                return []; 

            }
            
            // Перевіряємо старий формат (субколекції)
            const oldCollectionRef = dataCollectionRef.doc(collectionName).collection('items');
            
            try {
                const oldSnapshot = await oldCollectionRef.get();
                
                if (!oldSnapshot.empty) {
                    const oldItems = [];
                    oldSnapshot.forEach(oldDoc => {
                        oldItems.push({ ...oldDoc.data(), id: oldDoc.id });
                    });
                    
                    oldItems.sort((a, b) => (a.index || 0) - (b.index || 0));
                    
                    // Автоматично мігруємо дані в новий формат
                    const newDocRef = dataCollectionRef.doc(collectionName);
                    await newDocRef.set({ items: oldItems }); 
                    
                    return oldItems;
                } 
            } catch (error) {
                console.error(`Помилка при перевірці старих даних для ${collectionName}:`, error);
            }
            
            return [];
        };

        const chapters = await getDataWithLegacySupport('chapters', chaptersDoc);
        const characters = await getDataWithLegacySupport('characters', charactersDoc);
        const locations = await getDataWithLegacySupport('locations', locationsDoc);
        const plotlines = await getDataWithLegacySupport('plotlines', plotlinesDoc);

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

// v2.0.0: Маршрут для збереження контенту
app.post('/save-project-content', async (req, res) => {
    if (!db) return res.status(500).json({ error: "Сервіси бази даних не ініціалізовані." });
    
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
    if (!db) return res.status(500).json({ error: "Сервіси бази даних не ініціалізовані." });
    
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
            
            // Перевіряємо старі дані
            const oldCollectionRef = dataCollectionRef.doc(collectionName).collection('items');
            const oldSnapshot = await oldCollectionRef.get();
            
            if (oldSnapshot.empty) {
                continue;
            }

            const oldItems = [];
            oldSnapshot.forEach(oldDoc => {
                oldItems.push({ ...oldDoc.data(), id: oldDoc.id });
            });

            // Сортуємо за index
            oldItems.sort((a, b) => (a.index || 0) - (b.index || 0));

            // Зберігаємо в новому форматі
            const newDocRef = dataCollectionRef.doc(collectionName);
            await newDocRef.set({ items: oldItems });
            
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
    if (!db) return res.status(500).json({ error: "Сервіси бази даних не ініціалізовані." });
    
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
    if (!db) return res.status(500).json({ error: "Сервіси бази даних не ініціалізовані." });
    
    const { projectID } = req.body;
    if (!projectID) {
        return res.status(400).json({ error: "Необхідний projectID." });
    }

    try {
        const projectRef = db.collection('projects').doc(projectID);

        // --- 1. Рекурсивне видалення субколекцій (data) ---
        const dataCollectionRef = projectRef.collection('data');
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
    if (!db) return res.status(500).json({ error: "Сервіси бази даних не ініціалізовані." });
    
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
    if (!db) return res.status(500).json({ error: "Сервіси бази даних не ініціалізовані." });
    
    const { projectID } = req.query;
    if (!projectID) {
        return res.status(400).json({ error: "Необхідний projectID." });
    }

    try {
        // Використовуємо http://localhost:${port} для самозвернення
        const projectContentResponse = await fetch(`http://localhost:${port}/get-project-content?projectID=${projectID}`);
        if (!projectContentResponse.ok) {
            throw new Error("Не вдалося завантажити контент для експорту.");
        }
        const { title, content } = await projectContentResponse.json();

        // Формуємо текст для експорту (логіка без змін)
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
    if (!model) return res.status(500).json({ error: "Сервіси AI не ініціалізовані." });
    if (!db) return res.status(500).json({ error: "Сервіси бази даних не ініціалізовані." });
    
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
            return [];
        };

        // --- 2. Збираємо контекст (Project Content) ---
        let context = `Я - письменник, що працює над книгою: "${projectTitle}". \n`;
        context += `Моя роль: допомогти мені у творчому процесі. \n`;
        context += `Твої відповіді мають бути лаконічними, зосередженими та корисними, з огляду на наданий контекст. \n\n`;
        
        // 2.0. World (завжди додаємо, оскільки це ядро, але використовуємо опції для додаткового контексту)
        context += `--- ЯДРО ТА МЕТА ПРОЄКТУ ---\n`;
        context += `Тема: ${worldData.theme || '...'}\n`;
        context += `Головна арка: ${worldData.mainArc || '...'}\n`;
        context += `Преміса (Logline): ${worldData.premise || '...'}\n\n`;

        // Змінні для керування контекстом
        const { includeChapters, includeCharacters, includeLocations, includePlotlines } = contextOptions || {};
        
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
        const chatModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const contents = [...currentChatHistory.map(h => ({ 
            role: h.role, 
            parts: h.parts 
        })), { role: "user", parts: [{ text: message }] }];

        const result = await chatModel.generateContent({
            contents: contents,
            config: { systemInstruction: context } // Передаємо контекст як systemInstruction
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


// === 4. ОБСЛУГОВУВАННЯ ФРОНТЕНДУ (КРИТИЧНО: ЦЕ ПОВИННО БУТИ В КІНЦІ) === 

// У Production, цей блок обслуговує index.html для всіх не-API запитів.
if (process.env.NODE_ENV === 'production') {
    console.log("РЕЖИМ: Production. Обслуговування папки dist.");
    
    // Обслуговування статичних файлів (JS, CSS, IMG)
    app.use(express.static(path.join(__dirname, 'dist')));
    
    // Всі GET-запити, що залишилися (і які не були API), перенаправляємо на index.html
    // v2.6.2 FIX: Використовуємо регулярний вираз /.*/ для надійного catch-all.
    app.get(/.*/, (req, res) => { 
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
} else {
    // У розробці Express обслуговує поточну папку 
    console.log("РЕЖИМ: Development. Фронтенд обслуговується Vite.");
    app.use(express.static('.'));
}

// --- Запуск сервера ---
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