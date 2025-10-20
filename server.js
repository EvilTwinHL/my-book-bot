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
// ЗМІНЕНО/ДОДАНО: Використовуємо generationModel для чату
const generationModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
// ДОДАНО: Модель для Embeddings (навіть якщо використовуємо keyword-RAG, її краще вказати)
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
const model = generationModel; // Ваша робоча модель (тепер generationModel)

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

// =======================================================
// НОВА ФУНКЦІЯ: РОЗУМНИЙ ПОШУК КОНТЕКСТУ (SMART RAG)
// =======================================================

/**
 * Виконує пошук релевантного контексту у ВСІХ проєктах, фільтруючи за ключовими словами.
 * @param {string} query Промпт користувача для RAG-пошуку.
 * @param {string} currentProjectTitle Назва поточного проєкту для пріоритету.
 * @returns {string} Форматований рядок з найбільш релевантними уривками.
 */
async function getRelevantContext(query, currentProjectTitle) {
    const CHUNKS_TO_RETRIEVE = 3;
    const queryLower = query.toLowerCase();
    
    // 1. Отримуємо всі уривки з бази (лише 100 для продуктивності)
    const allProjectsSnapshot = await db.collection('projects').limit(100).get();
    let allSnippets = [];

    allProjectsSnapshot.forEach(doc => {
        const title = doc.data().title || '';
        const history = doc.data().history;
        
        // Витягуємо лише відповіді бота для натхнення
        history.forEach(msg => {
            if (msg.role === 'model' && msg.parts[0].text) {
                // Додаємо інформацію про те, чи збігається тема/назва проєкту, щоб пізніше дати пріоритет
                allSnippets.push({
                    text: msg.parts[0].text,
                    isRelevantProject: title.toLowerCase().includes(currentProjectTitle.toLowerCase()) 
                                        || currentProjectTitle.toLowerCase().includes(title.toLowerCase())
                });
            }
        });
    });

    if (allSnippets.length === 0) return "";
    
    // 2. Фільтрація: Комбінуємо релевантність проєкту та збіг ключових слів
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);
    
    const relevantSnippets = allSnippets
        .map(snippet => {
            let score = 0;
            // Рахуємо бали за збіг ключових слів
            queryWords.forEach(word => {
                if (snippet.text.toLowerCase().includes(word)) {
                    score += 1;
                }
            });
            // Даємо високий пріоритет, якщо уривок з релевантного проєкту
            if (snippet.isRelevantProject) {
                score += 5; // Високий бонус
            }
            return { text: snippet.text, score: score };
        })
        .filter(s => s.score > 0) // Вибираємо лише ті, що мають бал
        .sort((a, b) => b.score - a.score); // Сортуємо за балами
    
    // 3. Обмежуємо та форматуємо результат
    const contextText = relevantSnippets
        .slice(0, CHUNKS_TO_RETRIEVE)
        .map(s => s.text)
        .join('\n---\n');

    if (contextText) {
        return `\n\n[УРИВКИ КОЛЕКТИВНОГО РОЗУМУ (для натхнення): \n${contextText}\n]\n\n`;
    }
    
    return "";
}

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

// --- Маршрут: Отримання історії чату для проєкту (Без змін) ---
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

// --- ОНОВЛЕННЯ: Маршрут /chat з RAG-логікою ---
app.post('/chat', async (req, res) => {
    const { projectID, message, user } = req.body; 
    if (!projectID || !message || !user) {
        return res.status(400).json({ message: "Необхідні projectID, message та user" });
    }

    try {
        // КРОК 1: Отримуємо поточну історію проєкту
        const projectDocRef = db.collection('projects').doc(projectID);
        const doc = await projectDocRef.get();
        if (!doc.exists) {
            return res.status(404).json({ message: "Проєкт не знайдено." });
        }
        let history = doc.data().history;
        // ЗБЕРІГАЄМО НАЗВУ ПРОЄКТУ
        const currentProjectTitle = doc.data().title || ''; 

        // --- КРОК 2: Запуск Smart RAG (Логіка залишається) ---
        let inspirationPrompt = "";
        
        const inspirationKeywords = ['ідея', 'придумай', 'допоможи', 'натхнення', 'поворот', 'сюжет', 'герой'];
        const needsInspiration = inspirationKeywords.some(k => message.toLowerCase().includes(k));

        if (needsInspiration) {
            console.log("Користувач шукає натхнення. Запускаю Smart RAG...");
            inspirationPrompt = await getRelevantContext(message, currentProjectTitle); 
        }
        
        // --- КРОК 3: Формуємо запит до Gemini ---
        const messageWithContext = message + inspirationPrompt; 
        
        history.push({ role: "user", parts: [{ text: messageWithContext }] });
        
        // Виклик Gemini
        const result = await model.generateContent({ contents: history });
        // ВИПРАВЛЕНО: ПОВЕРНУТО .text() (з дужками)
        const botResponse = result.response.text(); 
        
        console.log(`Gemini відповів для проєкту ${projectID}:`, botResponse);

        // --- КРОК 4: Зберігаємо ВСЕ в базі (лише чисті повідомлення) ---
        // Відкочуємо останній запис, щоб видалити RAG-контекст з історії
        history.pop(); 
        
        // Додаємо ЧИСТИЙ запит користувача (без RAG-контексту)
        history.push({ role: "user", parts: [{ text: message }] }); 
        // Додаємо відповідь бота
        history.push({ role: "model", parts: [{ text: botResponse }] }); 
        
        await projectDocRef.update({ history: history });
        
        // --- КРОК 5: Відправляємо відповідь на фронтенд ---
        res.json({ message: botResponse });

    } catch (error) {
        console.error("Помилка в /chat:", error);
        res.status(500).json({ message: "Ой, щось зламалось у моєму мозку... Перевірте термінал сервера." });
    }
});


// НОВИЙ МАРШРУТ: Видалення проєкту (Без змін)
app.post('/delete-project', async (req, res) => {
    const { projectID } = req.body; 

    if (!projectID) {
        return res.status(400).json({ message: "Необхідно вказати projectID" });
    }

    try {
        await db.collection('projects').doc(projectID).delete();
        
        console.log(`Проєкт ${projectID} успішно видалено.`);
        res.status(200).json({ message: 'Проєкт видалено' });

    } catch (error) {
        console.error("Помилка при видаленні проєкту:", error);
        res.status(500).json({ message: "Не вдалося видалити проєкт." });
    }
});

// НОВИЙ МАРШРУТ: Експорт проєкту в .txt (Без змін)
app.get('/export-project', async (req, res) => {
    const { projectID } = req.query; 

    if (!projectID) {
        return res.status(400).send("Необхідно вказати projectID");
    }

    try {
        const docRef = db.collection('projects').doc(projectID);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).send("Проєкт не знайдено");
        }

        const projectData = doc.data();
        const history = projectData.history;
        const title = projectData.title || 'Untitled Project';

        let fileContent = `Проєкт: ${title}\n`;
        fileContent += "========================================\n\n";

        history.forEach(message => {
            if (message.role === 'user' && message.parts[0].text.startsWith('Ти — "Опус"')) {
                return;
            }
            
            const sender = message.role === 'model' ? 'Опус' : 'Користувач';
            const text = message.parts[0].text;
            
            fileContent += `${sender}:\n${text}\n\n---\n\n`;
        });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_')}.txt"`);
        res.send(fileContent);

    } catch (error) {
        console.error("Помилка при експорті проєкту:", error);
        res.status(500).send("Не вдалося експортувати проєкт.");
    }
});

// НОВИЙ МАРШРУТ: Оновлення назви проєкту (Без змін)
app.post('/update-title', async (req, res) => {
    const { projectID, newTitle } = req.body; 

    if (!projectID || !newTitle) {
        return res.status(400).json({ message: "Необхідно вказати projectID та newTitle" });
    }

    try {
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
    // ПОВЕРНУТО до оригінального рядка
    console.log(`✅ The server was successfully started. https://gemini-opusai.onrender.com:${port}`);
});