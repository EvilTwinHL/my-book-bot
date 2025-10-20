// === 1. ПІДКЛЮЧЕННЯ ===
const express = require('express');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

// === 2. НАЛАШТУВАННЯ ===
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(express.static('.'));

// --- Налаштування Firebase ---
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// --- Налаштування Gemini ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Ваша робоча модель

// --- Персона Бота (залишається) ---
const botPersona = `
Ти — "Опус", експертний помічник зі створення книг... (Ваш текст персони)
`;

// --- Початкова історія (залишається) ---
const createInitialHistory = (title) => {
  return [
    { role: "user", parts: [{ text: botPersona }] },
    { role: "model", parts: [{ text: `Я Опус. Радий почати роботу над вашою новою книгою "${title}"! З якої ідеї почнемо? ✍️` }] }
  ];
};

// === 3. МАРШРУТИ API ===

// --- Маршрут для отримання проєктів (Без змін) ---
app.get('/get-projects', async (req, res) => {
    const user = req.query.user; 
    if (!user) {
        return res.status(400).json({ message: "Необхідно вказати користувача (user)" });
    }
    try {
        const snapshot = await db.collection('projects').where('owner', '==', user).get();
        if (snapshot.empty) {
            return res.json([]); 
        }
        const projects = [];
        snapshot.forEach(doc => {
            projects.push({ id: doc.id, title: doc.data().title || 'Проєкт без назви' });
        });
        res.json(projects);
    } catch (error) {
        console.error("Помилка при отриманні проєктів:", error);
        res.status(500).json({ message: "Не вдалося завантажити проєкти." });
    }
});

// --- Маршрут для створення проєкту (Без змін) ---
app.post('/create-project', async (req, res) => {
    const { user, title } = req.body;
    if (!user || !title) {
        return res.status(400).json({ message: "Необхідно вказати 'user' та 'title'" });
    }
    try {
        const initialHistory = createInitialHistory(title); // Використовуємо функцію
        const newProjectRef = await db.collection('projects').add({
            owner: user,
            title: title,
            history: initialHistory,
            createdAt: new Date()
        });
        res.status(201).json({ id: newProjectRef.id, title: title });
    } catch (error) {
        console.error("Помилка при створенні проєкту:", error);
        res.status(500).json({ message: "Не вдалося створити проєкт." });
    }
});

// --- НОВИЙ Маршрут: Отримання історії чату для проєкту ---
app.get('/chat-history', async (req, res) => {
    const projectID = req.query.projectID;
    if (!projectID) {
        return res.status(400).json({ message: "Необхідно вказати projectID" });
    }

    try {
        const docRef = db.collection('projects').doc(projectID);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: "Проєкт не знайдено." });
        }
        
        const fullHistory = doc.data().history;
        // Відправляємо історію, відрізавши системний промпт (перше повідомлення)
        res.json(fullHistory.slice(1)); 
        
    } catch (error) {
        console.error("Помилка при отриманні історії:", error);
        res.status(500).json({ message: "Не вдалося завантажити історію." });
    }
});

// --- НОВИЙ Маршрут: Відправка повідомлення в чат (з "навчанням") ---
app.post('/chat', async (req, res) => {
    const { projectID, message, user } = req.body; // 'user' нам потрібен для RAG
    if (!projectID || !message || !user) {
        return res.status(400).json({ message: "Необхідні projectID, message та user" });
    }

    try {
        // --- КРОК 1: Отримуємо поточну історію проєкту ---
        const projectDocRef = db.collection('projects').doc(projectID);
        const doc = await projectDocRef.get();
        if (!doc.exists) {
            return res.status(404).json({ message: "Проєкт не знайдено." });
        }
        let history = doc.data().history;
        
        // --- КРОК 2: (Майбутнє RAG) Пошук "натхнення" ---
        let inspirationPrompt = "";
        
        // Перевіряємо, чи просить користувач про ідеї
        const keywords = ['ідея', 'придумай', 'допоможи', 'натхнення', 'поворот'];
        const needsInspiration = keywords.some(k => message.toLowerCase().includes(k));

        if (needsInspiration) {
            console.log("Користувач шукає натхнення. Запускаю RAG...");
            const snapshot = await db.collection('projects').limit(10).get(); // Беремо 10 випадкових проєктів
            let inspirationSnippets = [];
            
            snapshot.forEach(doc => {
                // Беремо 1-2 випадкові репліки з кожного проєкту (але не наші!)
                const otherHistory = doc.data().history.slice(2, 10); // Беремо середину історії
                if (otherHistory.length > 0) {
                    const snippet = otherHistory[Math.floor(Math.random() * otherHistory.length)];
                    inspirationSnippets.push(snippet.parts[0].text);
                }
            });
            
            if (inspirationSnippets.length > 0) {
                inspirationPrompt = " \n\n[Додатковий контекст для натхнення з інших проєктів (не показуй це користувачу): \n" +
                                    inspirationSnippets.join("\n---\n") + 
                                    "]\n\n";
            }
        }
        
        // --- КРОК 3: Формуємо запит до Gemini ---
        // Додаємо нове повідомлення + (можливо) промпт з натхненням
        history.push({ role: "user", parts: [{ text: message + inspirationPrompt }] });
        
        // Формуємо запит, використовуючи всю історію
        const result = await model.generateContent({ contents: history });
        const botResponse = result.response.text();
        
        console.log(`Gemini відповів для проєкту ${projectID}:`, botResponse);

        // --- КРОК 4: Зберігаємо ВСЕ в базі ---
        // Додаємо відповідь бота (вже *без* inspirationPrompt)
        history.push({ role: "model", parts: [{ text: botResponse }] });
        
        // Оновлюємо документ в Firestore
        await projectDocRef.update({ history: history });
        
        // --- КРОК 5: Відправляємо відповідь на фронтенд ---
        res.json({ message: botResponse });

    } catch (error) {
        console.error("Помилка в /chat:", error);
        res.status(500).json({ message: "Ой, щось зламалось у моєму мозку... Перевірте термінал сервера." });
    }
});

// НОВИЙ МАРШРУТ: Видалення проєкту
app.post('/delete-project', async (req, res) => {
    // Ми очікуємо отримати { projectID: "..." }
    const { projectID } = req.body; 

    if (!projectID) {
        return res.status(400).json({ message: "Необхідно вказати projectID" });
    }

    try {
        // Знаходимо документ за ID і видаляємо його
        await db.collection('projects').doc(projectID).delete();
        
        console.log(`Проєкт ${projectID} успішно видалено.`);
        res.status(200).json({ message: 'Проєкт видалено' });

    } catch (error) {
        console.error("Помилка при видаленні проєкту:", error);
        res.status(500).json({ message: "Не вдалося видалити проєкт." });
    }
});

// НОВИЙ МАРШРУТ: Експорт проєкту в .txt
app.get('/export-project', async (req, res) => {
    // Очікуємо ID проєкту з параметрів URL
    const { projectID } = req.query; 

    if (!projectID) {
        return res.status(400).send("Необхідно вказати projectID");
    }

    try {
        // 1. Отримуємо документ проєкту
        const docRef = db.collection('projects').doc(projectID);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).send("Проєкт не знайдено");
        }

        const projectData = doc.data();
        const history = projectData.history;
        const title = projectData.title || 'Untitled Project';

        // 2. Форматуємо історію в читабельний текст
        let fileContent = `Проєкт: ${title}\n`;
        fileContent += "========================================\n\n";

        history.forEach(message => {
            // Пропускаємо початковий системний промпт
            if (message.role === 'user' && message.parts[0].text.startsWith('Ти — "Опус"')) {
                return;
            }
            
            const sender = message.role === 'model' ? 'Опус' : 'Користувач';
            const text = message.parts[0].text;
            
            fileContent += `${sender}:\n${text}\n\n---\n\n`;
        });

        // 3. Відправляємо файл браузеру
        // Встановлюємо "заголовки", які кажуть браузеру "Це файл, завантаж його"
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_')}.txt"`);
        res.send(fileContent);

    } catch (error) {
        console.error("Помилка при експорті проєкту:", error);
        res.status(500).send("Не вдалося експортувати проєкт.");
    }
});

// НОВИЙ МАРШРУТ: Оновлення назви проєкту
app.post('/update-title', async (req, res) => {
    const { projectID, newTitle } = req.body; // Очікуємо ID та нову назву

    if (!projectID || !newTitle) {
        return res.status(400).json({ message: "Необхідно вказати projectID та newTitle" });
    }

    try {
        // Знаходимо документ і оновлюємо *лише* поле 'title'
        await db.collection('projects').doc(projectID).update({
            title: newTitle
        });
        
        console.log(`Назву проєкту ${projectID} оновлено на: ${newTitle}`);
        res.status(200).json({ message: 'Назву оновлено' });

    } catch (error) {
        console.error("Помилка при оновленні назви:", error);
        res.status(500).json({ message: "Не вдалося оновити назву." });
    }
});

// === 4. ЗАПУСК СЕРВЕРА ===
app.listen(port, () => {
  console.log(`✅ The server was successfully started. https://gemini-opusai.onrender.com:${port}`);
});