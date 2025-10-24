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
    app.get('*', (req, res) => {
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

// v2.0.0: Маршрут для отримання повного контенту проєкту
app.get('/get-project-content', async (req, res) => {
    const { projectID } = req.query;
    if (!projectID) {
        return res.status(400).json({ error: "Необхідний ідентифікатор проєкту." });
    }
    
    try {
        const projectRef = db.collection('projects').doc(projectID);
        const projectDoc = await projectRef.get();
        
        if (!projectDoc.exists) {
            return res.status(404).json({ error: "Проєкт не знайдено." });
        }
        
        let projectData = projectDoc.data();
        
        // --- v2.0.0: Збираємо дані з субколекцій ---
        const content = {};
        const dataCollectionRef = projectRef.collection('data');

        // 1. World (один документ)
        const worldDoc = await dataCollectionRef.doc('world').get();
        if (worldDoc.exists) {
            const worldData = worldDoc.data();
            content.premise = worldData.premise || '';
            content.theme = worldData.theme || '';
            content.mainArc = worldData.mainArc || '';
            content.wordGoal = worldData.wordGoal || 50000;
            content.notes = worldData.notes || '';
            content.research = worldData.research || '';
        } else {
            // Ініціалізація, якщо документа немає
            content.premise = ''; content.theme = ''; content.mainArc = ''; content.wordGoal = 50000; content.notes = ''; content.research = '';
        }

        // 2. Chat History (один документ, v2.1.0+)
        const chatDoc = await dataCollectionRef.doc('chatHistory').get();
        const chatHistory = chatDoc.exists ? (chatDoc.data().history || []) : [];

        // 3. Списки (багато документів)
        const collectionsToFetch = ['chapters', 'characters', 'locations', 'plotlines'];
        for (const collectionName of collectionsToFetch) {
            const snapshot = await dataCollectionRef.doc(collectionName).collection('items').orderBy('index', 'asc').get();
            // Сортування не працює, якщо index не існує, тому використовуємо ручний обхід
            content[collectionName] = [];
            
            // В v2.2.0 ми зберігаємо масив, тому тут логіка з get() для повної сумісності
            // Збираємо усі документи і сортуємо їх, якщо вони мають поле 'index'
            const docsWithIndex = [];
            snapshot.forEach(doc => {
                 const item = doc.data();
                 item.id = doc.id;
                 docsWithIndex.push(item);
            });
            // Якщо є поле 'index', сортуємо, інакше залишаємо як є
            docsWithIndex.sort((a, b) => (a.index || 0) - (b.index || 0));

            content[collectionName] = docsWithIndex;
        }


        res.json({
            id: projectDoc.id,
            title: projectData.title,
            owner: projectData.owner,
            totalWordCount: projectData.totalWordCount || 0,
            updatedAt: projectData.updatedAt ? projectData.updatedAt.toDate().toISOString() : new Date().toISOString(),
            content: content,
            chatHistory: chatHistory
        });

    } catch (error) {
        console.error("Помилка при отриманні контенту проєкту:", error);
        res.status(500).json({ error: "Не вдалося отримати контент проєкту." });
    }
});


// v2.0.0: Маршрут для збереження контенту (оновлено для субколекцій)
app.post('/save-project-content', async (req, res) => {
    const { projectID, field, value } = req.body;
    if (!projectID || !field) {
        return res.status(400).json({ error: "Необхідні projectID та field." });
    }

    try {
        const batch = db.batch();
        const projectRef = db.collection('projects').doc(projectID);
        const dataCollectionRef = projectRef.collection('data');

        // Оновлюємо основний документ проєкту (для updated/wordCount)
        batch.update(projectRef, {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        // --- Логіка збереження полів ---

        // 1. World (преміса, тема, тощо)
        if (field.startsWith('content.')) {
            const worldField = field.substring('content.'.length);
            const worldDocRef = dataCollectionRef.doc('world');
            
            // Використовуємо set з merge: true для оновлення конкретного поля
            const update = {};
            update[worldField] = value;
            batch.set(worldDocRef, update, { merge: true });

            // 2. Оновлення загальної кількості слів (якщо змінюється wordGoal)
            if (worldField === 'wordGoal') {
                batch.update(projectRef, { wordGoal: value });
            }
        } 
        
        // 3. Chat History (один документ)
        if (field === 'chatHistory') {
            const chatDocRef = dataCollectionRef.doc('chatHistory');
            // Зберігаємо всю історію (масив) в полі 'history'
            batch.set(chatDocRef, { history: value });
        }
        
        // 4. Списки (chapters, characters, locations, plotlines)
        // Тут ми очікуємо, що клієнт надсилає ВЕСЬ оновлений масив
        const listFields = ['content.chapters', 'content.characters', 'content.locations', 'content.plotlines'];

        if (listFields.includes(field)) {
            const collectionName = field.substring('content.'.length);
            const collectionRef = dataCollectionRef.doc(collectionName).collection('items');
            
            // Логіка видалення та перезапису спрощується до перебору масиву
            // (Клієнт повинен обробляти ID, але для v2.0.0 ми використовуємо індекси)
            
            // NOTE: Оскільки ми перейшли на Array CRUD, ми можемо це спростити:
            
            // Якщо це список розділів, ми також оновлюємо загальний лічильник слів у projects/{id}
            if (collectionName === 'chapters') {
                const totalWordCount = value.reduce((sum, item) => sum + (item.word_count || 0), 0);
                batch.update(projectRef, { totalWordCount: totalWordCount });
            }
            
            // В v2.0.0 ми зберігаємо масив як один документ, але переходимо на субколекції:
            // В v2.2.0 ми вирішили не використовувати колекцію 'items' (бо це складно),
            // а зберігати весь масив у документі "chapters" (залишаємо як є)
            const listDocRef = dataCollectionRef.doc(collectionName);
            
            // Оновлюємо документ списку
            const listUpdate = {};
            listUpdate[`items`] = value; // В v2.0.0 ми зберігали в content
            
            batch.set(listDocRef, { items: value }); // Зберігаємо масив у полі 'items'

        }

        await batch.commit();

        res.status(200).json({ status: 'saved' });

    } catch (error) {
        console.error("Помилка при збереженні контенту:", error);
        res.status(500).json({ error: "Не вдалося зберегти контент проєкту." });
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
    // ... (код експорту залишається без змін)
    // ... (завантаження контенту)
    const projectContentResponse = await fetch(`http://localhost:${port}/get-project-content?projectID=${projectID}`);
    if (!projectContentResponse.ok) {
        throw new Error("Не вдалося завантажити контент для експорту.");
    }
    const { title, content } = await projectContentResponse.json();

    // ... (формування тексту)

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
        const [projectDoc, worldDoc, chatDoc] = await Promise.all([
            projectRef.get(),
            dataCollectionRef.doc('world').get(),
            dataCollectionRef.doc('chatHistory').get()
        ]);

        if (!projectDoc.exists) {
            return res.status(404).json({ error: "Проєкт не знайдено." });
        }

        const projectTitle = projectDoc.data().title;
        const worldData = worldDoc.exists ? worldDoc.data() : {};
        const currentChatHistory = chatDoc.exists ? (chatDoc.data().history || []) : [];

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
            const chaptersSnapshot = await dataCollectionRef.doc('chapters').get();
            const chapters = chaptersSnapshot.exists ? (chaptersSnapshot.data().items || []) : [];
            
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
            const charactersSnapshot = await dataCollectionRef.doc('characters').get();
            const characters = charactersSnapshot.exists ? (charactersSnapshot.data().items || []) : [];
            
            if (characters.length > 0) {
                context += `--- ПЕРСОНАЖІ (${characters.length}) ---\n\n`;
                characters.forEach(p => {
                    context += `Ім'я: ${p.name || '...'}\nОпис: ${p.description || '...'}\nАрка: ${p.arc || '...'}\n\n`;
                });
            }
        }
        
        // 2.3. Локації
        if (includeLocations) {
            const locationsSnapshot = await dataCollectionRef.doc('locations').get();
            const locations = locationsSnapshot.exists ? (locationsSnapshot.data().items || []) : [];
            
            if (locations.length > 0) {
                context += `--- ЛОКАЦІЇ (${locations.length}) ---\\n\\n`;
                locations.forEach(l => {
                    context += `Назва: ${l.name || '...'}\\nОпис: ${l.description || '...'}\\n\\n`;
                });
            }
        }
        
        // 2.4. Сюжетні лінії
        if (includePlotlines) {
            const plotlinesSnapshot = await dataCollectionRef.doc('plotlines').get();
            const plotlines = plotlinesSnapshot.exists ? (plotlinesSnapshot.data().items || []) : [];

            if (plotlines.length > 0) {
                context += `--- СЮЖЕТНІ ЛІНІЇ (${plotlines.length}) ---\\n\\n`;
                plotlines.forEach(p => {
                    context += `Назва: ${p.title || '...'}\\nОпис: ${p.description || '...'}\\n\\n`;
                });
            }
        }
        
        // 3. Формуємо історію чату (System + History + New Message)
        const systemMessage = { role: "system", parts: [{ text: context }] };
        
        // NOTE: Ми не зберігаємо systemMessage в історії, щоб не витрачати ресурси Firestore.
        // Ми додаємо її лише для надсилання в API.
        const fullHistory = [systemMessage, ...currentChatHistory];
        
        // Додаємо нове повідомлення
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
/**
 * Рекурсивно видаляє колекцію в Firestore.
 * @param {admin.firestore.Firestore} db - Екземпляр Firestore.
 * @param {admin.firestore.CollectionReference} collectionRef - Посилання на колекцію.
 * @param {number} batchSize - Розмір пачки.
 */
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
            // Якщо документів немає, завершуємо
            return resolve();
        }

        // Створюємо пачку для видалення
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        // Рекурсивно викликаємо функцію для наступної пачки
        if (snapshot.size === batchSize) {
            // Невеликий таймаут, щоб уникнути лімітів Firestore
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