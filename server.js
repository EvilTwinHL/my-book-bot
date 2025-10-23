// === 1. ПІДКЛЮЧЕННЯ ===
const express = require('express');
const path = require('path');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
// v1.1.0: Rate Limiter
const rateLimit = require('express-rate-limit');

// === 2. НАЛАШТУВАННЯ ===
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

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
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

// --- v1.1.0: Налаштування Rate Limiter (без змін) ---
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 хвилин
    max: 100, // 100 запитів на IP за 15 хв
    message: 'Занадто багато запитів з вашого IP, будь ласка, спробуйте пізніше.'
});
const sensitiveLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 година
    max: 10, // 10 запитів на IP за 1 год
    message: 'Занадто багато спроб, будь ласка, спробуйте пізніше.'
});


// === 3. МАРШРУТИ ===

// --- v1.1.0: Логування помилок (без змін) ---
app.post('/log-error', (req, res) => {
    console.error("КЛІЄНТСЬКА ПОМИЛКА:", req.body);
    res.status(200).send("Logged");
});

// --- Головна сторінка (без змін) ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Отримання списку проєктів (без змін) ---
// (Цей ендпоінт не змінився, оскільки він читає тільки головні документи)
app.get('/get-projects', apiLimiter, async (req, res) => {
    const user = req.query.user;
    if (!user) {
        return res.status(400).json({ message: "Необхідно вказати 'user'" });
    }
    try {
        const snapshot = await db.collection('projects')
            .where('owner', '==', user)
            .orderBy('updatedAt', 'desc') // v1.0.0: Сортування
            .get();
            
        const projects = snapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title,
            updatedAt: doc.data().updatedAt,
            totalWordCount: doc.data().totalWordCount || 0
        }));
        res.status(200).json(projects);
    } catch (error) {
        console.error("Помилка при отриманні проєктів:", error);
        res.status(500).json({ message: "Не вдалося отримати проєкти." });
    }
});

// === ОНОВЛЕНО v2.0.0: Створення проєкту (Subcollections) ===
app.post('/create-project', sensitiveLimiter, async (req, res) => {
    const { user, title } = req.body;
    if (!user || !title) {
        return res.status(400).json({ message: "Необхідно вказати 'user' та 'title'" });
    }
    try {
        // 1. Створюємо головний документ (тільки метадані)
        const projectData = {
            owner: user,
            title: title,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            totalWordCount: 0
        };
        const projectRef = await db.collection('projects').add(projectData);

        // 2. Створюємо субколекцію 'data' з окремими документами
        const dataBatch = db.batch();
        const dataSubcollectionRef = projectRef.collection('data');

        const defaultContent = {
            premise: "", theme: "", mainArc: "",
            wordGoal: 50000, notes: "", research: ""
        };
        const defaultChatHistory = { 
            history: [{ role: "user", parts: [{ text: "start" }] }, { role: "model", parts: [{ text: "start" }] }]
        };
        
        dataBatch.set(dataSubcollectionRef.doc('content'), defaultContent);
        dataBatch.set(dataSubcollectionRef.doc('chatHistory'), defaultChatHistory);
        dataBatch.set(dataSubcollectionRef.doc('chapters'), { array: [] });
        dataBatch.set(dataSubcollectionRef.doc('characters'), { array: [] });
        dataBatch.set(dataSubcollectionRef.doc('locations'), { array: [] });
        dataBatch.set(dataSubcollectionRef.doc('plotlines'), { array: [] });

        await dataBatch.commit();
        
        console.log(`Проєкт ${projectRef.id} створено з субколекціями.`);

        // 3. Збираємо і повертаємо повний об'єкт, як того очікує клієнт
        const fullProjectData = {
            ...projectData,
            content: {
                ...defaultContent,
                chapters: [],
                characters: [],
                locations: [],
                plotlines: []
            },
            chatHistory: defaultChatHistory.history
        };
        
        res.status(201).json({ id: projectRef.id, data: fullProjectData });

    } catch (error) {
        console.error("Помилка при створенні проєкту:", error);
        res.status(500).json({ message: "Не вдалося створити проєкт." });
    }
});

// === ОНОВЛЕНО v2.0.0: Отримання контенту проєкту (Subcollections) ===
app.get('/get-project-content', apiLimiter, async (req, res) => {
    const projectID = req.query.projectID;
    if (!projectID) {
        return res.status(400).json({ message: "Необхідно вказати projectID" });
    }
    try {
        // 1. Отримуємо головний документ (метадані)
        const projectDoc = await db.collection('projects').doc(projectID).get();
        if (!projectDoc.exists) {
            return res.status(404).json({ message: "Проєкт не знайдено." });
        }
        const projectData = projectDoc.data();
        projectData.id = projectDoc.id;

        // 2. Отримуємо всі документи з субколекції 'data'
        const dataSnapshot = await db.collection('projects').doc(projectID).collection('data').get();

        // 3. "Збираємо" об'єкт `content` та `chatHistory`
        let contentData = {};
        let chatHistoryData = [];
        
        dataSnapshot.docs.forEach(doc => {
            const docId = doc.id;
            const data = doc.data();
            
            if (docId === 'content') {
                contentData = data;
            } else if (docId === 'chatHistory') {
                chatHistoryData = data.history || [];
            } else if (docId === 'chapters' || docId === 'characters' || docId === 'locations' || docId === 'plotlines') {
                contentData[docId] = data.array || [];
            }
        });

        // 4. Комбінуємо все в один об'єкт, як того очікує клієнт
        const fullProjectData = {
            ...projectData,
            content: contentData,
            chatHistory: chatHistoryData
        };

        res.status(200).json(fullProjectData);
        
    } catch (error) {
        console.error("Помилка при отриманні контенту проєкту:", error);
        res.status(500).json({ message: "Не вдалося отримати контент проєкту." });
    }
});

// === ОНОВЛЕНО v2.0.0: Збереження контенту (Subcollections) ===
app.post('/save-project-content', apiLimiter, async (req, res) => {
    const { projectID, field, value } = req.body;
    if (!projectID || !field) {
        return res.status(400).json({ message: "Необхідно вказати projectID та field" });
    }

    try {
        const projectRef = db.collection('projects').doc(projectID);
        const dataSubcollectionRef = projectRef.collection('data');
        
        // Оновлюємо час в головному документі
        const updateTimestampPromise = projectRef.update({
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        let updatePromise;

        // "Маршрутизатор" збереження
        switch (field) {
            case 'content.chapters':
                // Оновлюємо документ 'chapters' та 'totalWordCount' в головному документі
                const wordCount = (value || []).reduce((sum, chapter) => {
                    const text = chapter.text || "";
                    const count = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
                    return sum + count;
                }, 0);
                
                const chaptersPromise = dataSubcollectionRef.doc('chapters').set({ array: value });
                const wordCountPromise = projectRef.update({ totalWordCount: wordCount });
                
                updatePromise = Promise.all([chaptersPromise, wordCountPromise]);
                break;
                
            case 'content.characters':
                updatePromise = dataSubcollectionRef.doc('characters').set({ array: value });
                break;
            case 'content.locations':
                updatePromise = dataSubcollectionRef.doc('locations').set({ array: value });
                break;
            case 'content.plotlines':
                updatePromise = dataSubcollectionRef.doc('plotlines').set({ array: value });
                break;
            
            // Прості поля (з 'content.')
            case 'content.premise':
            case 'content.theme':
            case 'content.mainArc':
            case 'content.wordGoal':
            case 'content.notes':
            case 'content.research':
                const fieldName = field.split('.')[1];
                // Використовуємо `update` з `merge: true` для оновлення одного поля
                updatePromise = dataSubcollectionRef.doc('content').set({ [fieldName]: value }, { merge: true });
                break;
                
            default:
                console.warn(`Невідоме поле для збереження: ${field}`);
                return res.status(400).json({ message: `Невідоме поле: ${field}` });
        }

        // Чекаємо на обидва оновлення
        await Promise.all([updateTimestampPromise, updatePromise]);

        res.status(200).json({ message: 'Контент збережено' });

    } catch (error) {
        console.error("Помилка при збереженні контенту:", error);
        res.status(500).json({ message: "Не вдалося зберегти контент." });
    }
});

// === ОНОВЛЕНО v2.1.1: Чат з Опусом (з кешуванням сесії) ===
app.post('/chat', async (req, res) => {
    try {
        const { projectId, message } = req.body;
        if (!projectId || !message) {
            return res.status(400).json({ error: 'Відсутні projectId або message' });
        }
        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // 1. Вказуємо шлях до нашої кешованої історії
        const chatSessionRef = db.collection('projects').doc(projectId)
                                 .collection('data').doc('chatSession');
        
        let history = [];

        // 2. Намагаємося завантажити історію
        const doc = await chatSessionRef.get();
        if (doc.exists && doc.data().history) {
            history = doc.data().history;
            console.log(`[Chat ${projectId}]: Відновлено історію чату.`);
        } else {
            // 3. Якщо історії немає (перший запуск) - генеруємо її
            console.log(`[Chat ${projectId}]: Історія не знайдена. Створюю новий контекст...`);
            // ВИКОРИСТОВУЄМО ВАШУ ІСНУЮЧУ ФУНКЦІЮ getProjectContext
            const context = await getProjectContext(projectId); 
            
            history = [
                {
                    role: "user",
                    parts: [{ text: "Привіт, Опус. Ось повний контекст мого проєкту для нашої розмови: \n\n" + context }]
                },
                {
                    role: "model",
                    parts: [{ text: "Дякую, я ознайомився з усім контекстом. Я готовий допомагати." }]
                }
            ];
            console.log(`[Chat ${projectId}]: Новий контекст згенеровано.`);
        }

        // 4. Ініціалізуємо чат з отриманою історією
        const chat = model.startChat({ history });

        // 5. Надсилаємо ЛИШЕ нове повідомлення
        console.log(`[Chat ${projectId}]: Надсилаю повідомлення...`);
        const result = await chat.sendMessage(message);
        const response = result.response;

        // 6. Отримуємо ОНОВЛЕНУ історію
        const updatedHistory = await chat.getHistory();

        // 7. ЗБЕРІГАЄМО (або перезаписуємо) її в Firestore
        await chatSessionRef.set({ history: updatedHistory });
        console.log(`[Chat ${projectId}]: Історію чату оновлено.`);

        res.json({ message: response.text() });

    } catch (error) {
        console.error("Помилка в /chat:", error);
        res.status(500).json({ error: 'Помилка обробки чату Gemini.' });
    }
});

// === ОНОВЛЕНО v2.0.0: Експорт (Subcollections) ===
app.get('/export-project', apiLimiter, async (req, res) => {
    const projectID = req.query.projectID;
    if (!projectID) {
        return res.status(400).send("Необхідно вказати projectID");
    }
    try {
        // 1. "Збираємо" проєкт, як в /get-project-content
        const projectDoc = await db.collection('projects').doc(projectID).get();
        if (!projectDoc.exists) {
            return res.status(404).send("Проєкт не знайдено.");
        }
        const projectData = projectDoc.data();
        const dataSnapshot = await db.collection('projects').doc(projectID).collection('data').get();

        let contentData = {};
        let chatHistoryData = [];
        
        dataSnapshot.docs.forEach(doc => {
            const docId = doc.id;
            const data = doc.data();
            if (docId === 'content') contentData = data;
            else if (docId === 'chatHistory') chatHistoryData = data.history || [];
            else if (docId === 'chapters' || docId === 'characters' || docId === 'locations' || docId === 'plotlines') {
                contentData[docId] = data.array || [];
            }
        });
        
        const fullProjectData = {
            ...projectData,
            content: contentData,
            chatHistory: chatHistoryData
        };

        // 2. Генеруємо .txt файл (логіка без змін)
        const { title, content, chatHistory } = fullProjectData;
        let fileContent = `--- ПРОЄКТ: ${title} ---\n`;
        fileContent += `(Згенеровано ${new Date().toLocaleString('uk-UA')})\n\n`;
        fileContent += `--- ЯДРО ІДЕЇ ---\n`;
        fileContent += `Logline: ${content.premise || '...'}\n`;
        fileContent += `Тема: ${content.theme || '...'}\n`;
        fileContent += `Головна арка: ${content.mainArc || '...'}\n`;
        fileContent += `Мета (слів): ${content.wordGoal || 0}\n\n`;
        
        fileContent += `--- РОЗДІЛИ (${content.chapters.length}) ---\n\n`;
        content.chapters.forEach((chapter, index) => {
            fileContent += `[ РОЗДІЛ ${index + 1}: ${chapter.title || 'Без назви'} ]\n`;
            fileContent += `(Статус: ${chapter.status || '...'}, Слів: ${chapter.word_count || 0})\n\n`;
            if (chapter.synopsis) {
                fileContent += `Синопсис:\n${chapter.synopsis}\n\n`;
            }
            fileContent += `Текст:\n${chapter.text || '(Немає тексту)'}\n\n`;
            fileContent += `--------------------\n\n`;
        });
        
        // ... (інші секції експорту без змін) ...
        fileContent += `--- ПЕРСОНАЖІ (${content.characters.length}) ---\n\n`;
        content.characters.forEach(p => {
            fileContent += `Ім'я: ${p.name || '...'}\nОпис: ${p.description || '...'}\nАрка: ${p.arc || '...'}\n\n`;
        });
        fileContent += `--- ЛОКАЦІЇ (${content.locations.length}) ---\n\n`;
        content.locations.forEach(l => {
            fileContent += `Назва: ${l.name || '...'}\nОпис: ${l.description || '...'}\n\n`;
        });
        fileContent += `--- СЮЖЕТНІ ЛІНІЇ (${content.plotlines.length}) ---\n\n`;
        content.plotlines.forEach(p => {
            fileContent += `Назва: ${p.title || '...'}\nОпис: ${p.description || '...'}\n\n`;
        });
        fileContent += `--- НОТАТКИ ---\n\n`;
        fileContent += `Загальні:\n${content.notes || '...'}\n\nДослідження:\n${content.research || '...'}\n\n`;
        fileContent += `--- ІСТОРІЯ ЧАТУ ---\n\n`;
        (chatHistory || []).slice(2).forEach(msg => {
            const sender = msg.role === 'model' ? 'Опус' : 'Користувач';
            const text = msg.parts[0].text.split("--- КОНТЕКСТ ПРОЄКТУ")[0].trim();
            fileContent += `${sender}:\n${text}\n\n---\n\n`;
        });

        // 3. Відправляємо файл браузеру (без змін)
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=\"${title.replace(/[^a-z0-9]/gi, '_')}.txt\"`);
        res.send(fileContent);

    } catch (error) {
        console.error("Помилка при експорті проєкту:", error);
        res.status(500).send("Не вдалося експортувати проєкт.");
    }
});

// --- Оновлення назви (без змін) ---
app.post('/update-title', apiLimiter, async (req, res) => {
    const { projectID, newTitle } = req.body; 
    if (!projectID || !newTitle) {
        return res.status(400).json({ message: "Необхідно вказати projectID та newTitle" });
    }
    try {
        await db.collection('projects').doc(projectID).update({
            title: newTitle,
            updatedAt: admin.firestore.FieldValue.serverTimestamp() // v1.0.0
        });
        console.log(`Назву проєкту ${projectID} оновлено на: ${newTitle}`);
        res.status(200).json({ message: 'Назву оновлено' });
    } catch (error) {
        console.error("Помилка при оновленні назви:", error);
        res.status(500).json({ message: "Не вдалося оновити назву." });
    }
});

// === ОНОВЛЕНО v2.0.0: Видалення проєкту (Subcollections) ===
app.post('/delete-project', sensitiveLimiter, async (req, res) => {
    const { projectID } = req.body; 
    if (!projectID) {
        return res.status(400).json({ message: "Необхідно вказати projectID" });
    }
    try {
        const projectRef = db.collection('projects').doc(projectID);
        
        // 1. Видаляємо субколекцію 'data'
        await deleteCollection(db, projectRef.collection('data'), 100);
        
        // 2. Видаляємо головний документ
        await projectRef.delete();
        
        console.log(`Проєкт ${projectID} та його субколекції видалено.`);
        res.status(200).json({ message: 'Проєкт видалено' });
    } catch (error) {
        console.error("Помилка при видаленні проєкту:", error);
        res.status(500).json({ message: "Не вдалося видалити проєкт." });
    }
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

        // Рекурсивно викликаємо для наступної пачки
        process.nextTick(() => {
            deleteQueryBatch(db, query, resolve, reject);
        });
        
    } catch (err) {
        console.error("Помилка при видаленні пачки субколекції:", err);
        return reject(err);
    }
}