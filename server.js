// === 1. ПІДКЛЮЧЕННЯ ===
const express = require('express');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

// === 2. НАЛАШТУВАННЯ ===
const app = express();
// ВИПРАВЛЕНО: Використовуємо змінну середовища Render, або 3000 локально
const port = process.env.PORT || 3000; 
app.use(express.json());
app.use(express.static('.'));

// --- Налаштування Firebase ---
// ПРИМІТКА: Для Render.com рекомендується використовувати змінну середовища
// з JSON-ключем замість файлу serviceAccountKey.json
const serviceAccount = require('./serviceAccountKey.json'); 
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// --- Налаштування Gemini ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const generationModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
// Модель для Embeddings (хоча тут використовуємо key-word RAG)
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" }); 

// --- Персона Бота ---
const botPersona = `
Ти — "Опус", експертний помічник зі створення книг та літературний наставник. Твоя мета — допомагати користувачеві писати книгу крок за кроком, від ідеї до фінального тексту.

Твої головні принципи:
1.  **Ти — Співавтор:** Став навідні запитання, щоб допомогти користувачеві писати. Не пиши великі шматки тексту за нього.
2.  **Структура — це все:** Завжди думай про структуру (жанр, 3-актна структура, розвиток персонажа).
3.  **Тон:** Будь підтримуючим, професійним та надихаючим. Використовуй емодзі (✍️, 📚, 🤔, ✨) доречно.
4.  **Стислість:** Відповідай коротко і по суті (2-3 речення), щоб підтримувати темп розмови.
`;

// --- Створення початкової історії ---
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
 * Виконує пошук релевантного контексту у всіх проєктах за ключовими словами.
 * @param {string} query Промпт користувача для RAG-пошуку.
 * @returns {string} Форматований рядок з 3-ма найбільш релевантними уривками.
 */
async function getRelevantContext(query) {
    const CHUNKS_TO_RETRIEVE = 3;
    const queryLower = query.toLowerCase();
    
    // 1. Отримуємо всі уривки з бази (лише 100 для продуктивності)
    const allProjectsSnapshot = await db.collection('projects').limit(100).get();
    let allSnippets = [];

    allProjectsSnapshot.forEach(doc => {
        const history = doc.data().history;
        // Витягуємо лише відповіді бота для натхнення
        history.forEach(msg => {
            if (msg.role === 'model' && msg.parts[0].text) {
                allSnippets.push(msg.parts[0].text);
            }
        });
    });

    if (allSnippets.length === 0) return "";
    
    // 2. Фільтруємо за ключовими словами (Спрощений семантичний RAG)
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3); // Ігноруємо короткі слова
    
    const relevantSnippets = allSnippets.filter(snippet => 
        queryWords.some(word => snippet.toLowerCase().includes(word))
    );
    
    // 3. Обмежуємо та форматуємо результат
    const contextText = relevantSnippets
        .slice(0, CHUNKS_TO_RETRIEVE)
        .join('\n---\n');

    if (contextText) {
        return `\n\n[УРИВКИ КОЛЕКТИВНОГО РОЗУМУ (для натхнення): \n${contextText}\n]\n\n`;
    }
    
    return "";
}


// === 3. МАРШРУТИ API ===

// (Залишаємо /get-projects, /create-project, /chat-history, /delete-project, /export-project, /update-title БЕЗ ЗМІН)

// --- ОНОВЛЕНИЙ Маршрут: Відправка повідомлення в чат ---
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
        
        // --- КРОК 2: Запуск Smart RAG ---
        let inspirationPrompt = "";
        
        const inspirationKeywords = ['ідея', 'придумай', 'допоможи', 'натхнення', 'поворот', 'сюжет', 'герой'];
        const needsInspiration = inspirationKeywords.some(k => message.toLowerCase().includes(k));

        if (needsInspiration) {
            console.log("Користувач шукає натхнення. Запускаю Smart RAG...");
            inspirationPrompt = await getRelevantContext(message); 
        }
        
        // --- КРОК 3: Формуємо запит до Gemini ---
        const messageWithContext = message + inspirationPrompt; 
        
        // Додаємо запит користувача (з RAG-контекстом) для генерації
        history.push({ role: "user", parts: [{ text: messageWithContext }] });
        
        // Виклик Gemini
        const result = await generationModel.generateContent({ contents: history });
        const botResponse = result.response.text;
        
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


// === 4. ЗАПУСК СЕРВЕРА ===
app.listen(port, () => {
    // Встановлюємо динамічний порт для Render
    console.log(`✅ The server was successfully started. http://localhost:${port} / https://gemini-opusai.onrender.com`);
});