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

// === ОНОВЛЕНО (ФАЗА 1): Замінено '/update-title' на '/update-project-details' ===
app.use(['/chat', '/create-project', '/delete-project', '/save-project-content', '/get-projects', '/get-project-content', '/update-project-details', '/export-project', '/migrate-project-data'], apiLimiter);


// === 3. API МАРШРУТИ (ПОВИННІ ЙТИ ПЕРЕД ОБСЛУГОВУВАННЯМ ФРОНТЕНДУ) === 

// v2.0.0: Маршрут для отримання всіх проєктів користувача
app.get('/get-projects', async (req, res) => {
    if (!db) return res.status(500).json({ error: "Сервіси бази даних не ініціалізовані." });
    
    const user = req.query.user;
        if (!user) {
            return res.status(400).json({ error: "Необхідний ідентифікатор користувача (user ID)." });
        }
        try {
            const projectsRef = db.collection('projects')
                .where('owner', '==', user)            .orderBy('updatedAt', 'desc'); 
        const snapshot = await projectsRef.get();
        
        const projects = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            projects.push({
                id: doc.id,
                title: data.title,
                totalWordCount: data.totalWordCount || 0,
                updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
                // === ОНОВЛЕНО (ФАЗА 1): Додано нові поля ===
                genre: data.genre || 'Інше', // Повертаємо жанр, або 'Інше' за замовчуванням
                imageURL: data.imageURL || '/assets/card-placeholder.png' // Повертаємо обкладинку
            });
        });
        
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
            
            const oldCollectionRef = dataCollectionRef.doc(collectionName).collection('items');
            
            try {
                const oldSnapshot = await oldCollectionRef.get();
                
                if (!oldSnapshot.empty) {
                    const oldItems = [];
                    oldSnapshot.forEach(oldDoc => {
                        oldItems.push({ ...oldDoc.data(), id: oldDoc.id });
                    });
                    
                    oldItems.sort((a, b) => (a.index || 0) - (b.index || 0));
                    
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
            // === ОНОВЛЕНО (ФАЗА 1): Додано нові поля ===
            genre: projectData.genre || 'Інше',
            imageURL: projectData.imageURL || '/assets/card-placeholder.png',
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

        batch.update(projectRef, {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        if (field.startsWith('content.')) {
            const worldField = field.substring('content.'.length);
            
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
        
        if (field === 'chatHistory') {
            const chatDocRef = dataCollectionRef.doc('chatHistory');
            batch.set(chatDocRef, { history: value });
        }
        
        const listFields = ['content.chapters', 'content.characters', 'content.locations', 'content.plotlines'];
        if (listFields.includes(field)) {
            const collectionName = field.substring('content.'.length);
            const listDocRef = dataCollectionRef.doc(collectionName);
            
            batch.set(listDocRef, { items: value });
            
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
            
            const oldCollectionRef = dataCollectionRef.doc(collectionName).collection('items');
            const oldSnapshot = await oldCollectionRef.get();
            
            if (oldSnapshot.empty) {
                continue;
            }

            const oldItems = [];
            oldSnapshot.forEach(oldDoc => {
                oldItems.push({ ...oldDoc.data(), id: oldDoc.id });
            });

            oldItems.sort((a, b) => (a.index || 0) - (b.index || 0));

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

// === ОНОВЛЕНО (ФАЗА 1): Маршрут для створення проєкту ===
app.post('/create-project', async (req, res) => {
    console.log('Request body:', req.body);
    if (!db) return res.status(500).json({ error: "Сервіси бази даних не ініціалізовані." });

    const { details, user } = req.body;
    const { title, genre, imageURL } = details || {};

    if (!title || !user) {
        return res.status(400).json({ error: "Необхідні title та user ID." });
    }

    try {
        const projectRef = db.collection('projects').doc();
        const projectID = projectRef.id;

        const defaultGenre = genre || 'Інше';
        const defaultImage = imageURL || '/assets/card-placeholder.png';

        await projectRef.set({
            title: title,
            owner: user,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            totalWordCount: 0,
            wordGoal: 50000,
            genre: defaultGenre,
            imageURL: defaultImage
        });

        const dataCollectionRef = projectRef.collection('data');
        await dataCollectionRef.doc('world').set({ premise: '', theme: '', mainArc: '', wordGoal: 50000, notes: '', research: '' });
        await dataCollectionRef.doc('chatHistory').set({ history: [] });
        const emptyLists = ['chapters', 'characters', 'locations', 'plotlines'];
        for (const listName of emptyLists) {
            await dataCollectionRef.doc(listName).set({ items: [] });
        }

        res.status(201).json({
            id: projectID,
            message: "Проєкт створено",
            data: {
                id: projectID,
                title: title,
                genre: defaultGenre,
                imageURL: defaultImage,
                updatedAt: new Date().toISOString(),
                totalWordCount: 0,
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

        const dataCollectionRef = projectRef.collection('data');
        await deleteCollection(db, dataCollectionRef, 10);
        
        await projectRef.delete();

        res.status(200).json({ status: 'deleted' });
    } catch (error) {
        console.error("Помилка при видаленні проєкту:", error);
        res.status(500).json({ error: "Не вдалося видалити проєкт." });
    }
});

// === ОНОВЛЕНО (ФАЗА 1): Новий маршрут для оновлення деталей проєкту ===
// (Замінює старий '/update-title')
app.post('/update-project-details', async (req, res) => {
	if (!db) return res.status(500).json({ error: "Сервіси бази даних не ініціалізовані." });
	
	const { projectID, details } = req.body;
	
	if (!projectID || !details) {
			return res.status(400).json({ error: "Необхідний projectID та details." });
	}

    const { title, genre, imageURL } = details;

    // Створюємо об'єкт оновлення лише з тими даними, що надійшли
    const updateData = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (title) {
        updateData.title = title;
    }
    if (genre) {
        updateData.genre = genre;
    }
    if (imageURL) {
        updateData.imageURL = imageURL;
    }

    // Перевіряємо, чи є що оновлювати (окрім дати)
    if (Object.keys(updateData).length <= 1) {
         return res.status(400).json({ error: "Не надано даних для оновлення (title, genre, imageURL)." });
    }

		try {
			const projectRef = db.collection('projects').doc(projectID);
			await projectRef.update(updateData);
			res.status(200).json({ status: 'updated' });
	} catch (error) {
			console.error("Помилка при оновленні деталей проєкту:", error);
			res.status(500).json({ error: "Не вдалося оновити деталі проєкту." });
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
        const projectContentResponse = await fetch(`http://localhost:${port}/get-project-content?projectID=${projectID}`);
        if (!projectContentResponse.ok) {
            throw new Error("Не вдалося завантажити контент для експорту.");
        }
        // === ОНОВЛЕНО (ФАЗА 1): Отримуємо нові поля ===
        const { title, content, genre, totalWordCount } = await projectContentResponse.json();

        let exportText = `Назва: ${title}\n`;
        // === ОНОВЛЕНО (ФАЗА 1): Додано жанр ===
        exportText += `Жанр: ${genre || 'Не вказано'}\n`;
        exportText += `Слів: ${totalWordCount || 0}\n`; // Використовуємо загальний лічильник
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

        const getDataForChat = async (doc, collectionName) => {
            if (doc.exists && doc.data().items) {
                return doc.data().items || [];
            }
            return [];
        };

        let context = `Я - письменник, що працює над книгою: "${projectTitle}". \n`;
        context += `Моя роль: допомогти мені у творчому процесі. \n`;
        context += `Твої відповіді мають бути лаконічними, зосередженими та корисними, з огляду на наданий контекст. \n\n`;
        
        context += `--- ЯДРО ТА МЕТА ПРОЄКТУ ---\n`;
        context += `Тема: ${worldData.theme || '...'}\n`;
        context += `Головна арка: ${worldData.mainArc || '...'}\n`;
        context += `Преміса (Logline): ${worldData.premise || '...'}\n\n`;

        const { includeChapters, includeCharacters, includeLocations, includePlotlines } = contextOptions || {};
        
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
        
        if (includeCharacters) {
            const characters = await getDataForChat(charactersDoc, 'characters');
            
            if (characters.length > 0) {
                context += `--- ПЕРСОНАЖІ (${characters.length}) ---\n\n`;
                characters.forEach(p => {
                    context += `Ім'я: ${p.name || '...'}\nОпис: ${p.description || '...'}\nАрка: ${p.arc || '...'}\n\n`;
                });
            }
        }
        
        if (includeLocations) {
            const locations = await getDataForChat(locationsDoc, 'locations');
            
            if (locations.length > 0) {
                context += `--- ЛОКАЦІЇ (${locations.length}) ---\n\n`;
                locations.forEach(l => {
                    context += `Назва: ${l.name || '...'}\nОпис: ${l.description || '...'}\n\n`;
                });
            }
        }
        
        if (includePlotlines) {
            const plotlines = await getDataForChat(plotlinesDoc, 'plotlines');

            if (plotlines.length > 0) {
                context += `--- СЮЖЕТНІ ЛІНІЇ (${plotlines.length}) ---\n\n`;
                plotlines.forEach(p => {
                    context += `Назва: ${p.title || '...'}\nОпис: ${p.description || '...'}\n\n`;
                });
            }
        }
        
        const chatModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const contents = [...currentChatHistory.map(h => ({ 
            role: h.role, 
            parts: h.parts 
        })), { role: "user", parts: [{ text: message }] }];

        const result = await chatModel.generateContent({
            contents: contents,
            config: { systemInstruction: context } 
        });

        const modelResponse = result.text.trim();
        
        const newChatHistory = [...currentChatHistory];
        newChatHistory.push({ role: "user", parts: [{ text: message }] });
        newChatHistory.push({ role: "model", parts: [{ text: modelResponse }] });
        
        await dataCollectionRef.doc('chatHistory').set({ history: newChatHistory });
        
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


// === 4. ОБСЛУГОВУВАННЯ ФРОНТЕНДУ (УМОВНО) === 

if (process.env.NODE_ENV === 'production') {
    console.log("РЕЖИМ: Production. Обслуговування папки dist.");
    
    app.use(express.static(path.join(__dirname, 'dist')));
    
    app.get(/.*/, (req, res) => { 
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
} else {
    console.log("РЕЖИМ: Development. Фронтенд обслуговується Vite.");
    // === ОНОВЛЕНО (ФАЗА 1): Додано app.use(express.static('.')) для dev ===
    // Це потрібно, щоб dev-сервер міг знайти активи, якщо Vite не запущений,
    // або для обслуговування файлів, які Vite не обробляє (наприклад, serviceAccountKey.json у dev)
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