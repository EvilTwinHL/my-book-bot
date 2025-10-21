// === 1. ПІДКЛЮЧЕННЯ ===
const express = require('express');
const path = require('path'); // Нам потрібен 'path' для маршруту '/'
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

// === 2. НАЛАШТУВАННЯ ===
const app = express();
// Render надасть нам свій порт, локально використовуємо 3000
const port = process.env.PORT || 3000;
app.use(express.json({ limit: '50mb' })); // Збільшимо ліміт, оскільки 'content' може бути великим
app.use(express.static('.')); // Для 'index.html', 'style.css', 'client.js'

// --- Налаштування Firebase ---
// Ми очікуємо, що serviceAccountKey.json або в файлі, або в 'Environment' на Render
try {
    let serviceAccount;
    if (process.env.SERVICE_ACCOUNT_KEY_JSON) {
        // Якщо ключ вставлений в Environment Variable на Render
        serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY_JSON);
    } else {
        // Якщо ми запускаємо локально з файлу
        serviceAccount = require('./serviceAccountKey.json');
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
} catch (error) {
    console.error("ПОМИЛКА: Не вдалося ініціалізувати Firebase Admin SDK.");
    console.error("Переконайтеся, що 'serviceAccountKey.json' існує, або 'SERVICE_ACCOUNT_KEY_JSON' встановлено в Render.");
    console.error(error.message);
    process.exit(1); // Зупинити сервер, якщо база не підключена
}

const db = admin.firestore();

// --- Налаштування Gemini ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Оновлено до 1.5

// --- Персона Бота ---
const botPersona = `
Ти — "Опус", експертний помічник зі створення книг, літературний критик та співавтор.
Твоє завдання — допомагати користувачу структурувати його ідеї, розвивати персонажів, прописувати сюжетні лінії та писати текст книги.
Ти завжди звертаєшся до користувача на "Ви".
Ти маєш доступ до всіх його нотаток: персонажів, локацій, розділів та сюжетних ліній. Використовуй цей контекст, щоб надавати максимально релевантні поради.
Твій стиль спілкування: професійний, ввічливий, креативний та підтримуючий.
`;

// === 3. ДОПОМІЖНІ ФУНКЦІЇ ===

/**
 * Створює початкову історію чату для нового проєкту
 */
const createInitialChatHistory = (title) => {
  return [
    { role: "user", parts: [{ text: botPersona }] },
    { role: "model", parts: [{ text: `Я Опус. Вітаю! Я готовий почати роботу над Вашим новим проєктом "${title}". З чого почнемо? ✍️` }] }
  ];
};

/**
 * Створює порожній об'єкт контенту для нового проєкту
 */
const createInitialContent = () => {
    return {
        premise: "",
        theme: "",
        mainArc: "",
        chapters: [],
        characters: [],
        locations: [],
        plotlines: [],
        timeline: [],
        notes: "",
        research: ""
    };
};

/**
 * (Використовується в /chat) Збирає весь текстовий контент в єдиний промпт для RAG
 */
const compileContentForRAG = (content) => {
    let context = "--- КОНТЕКСТ ПРОЄКТУ (Тільки для Вашої інформації) ---\n\n";
    
    context += `[ЯДРО ІДЕЇ]\n`;
    context += `Про що книга (Premise): ${content.premise || 'не вказано'}\n`;
    context += `Проблематика (Theme): ${content.theme || 'не вказано'}\n`;
    context += `Головна арка (Main Arc): ${content.mainArc || 'не вказано'}\n\n`;

    if (content.characters && content.characters.length > 0) {
        context += `[ПЕРСОНАЖІ]\n`;
        content.characters.forEach(c => {
            context += `- ${c.name}: ${c.description}\n`;
        });
        context += `\n`;
    }
    
    if (content.chapters && content.chapters.length > 0) {
        context += `[ТЕКСТ РОЗДІЛІВ (Уривки)]\n`;
        content.chapters.forEach(ch => {
            context += `Розділ "${ch.title}": ${ch.text.substring(0, 150)}...\n`; // Беремо лише уривок
        });
        context += `\n`;
    }

    if (content.notes) {
        context += `[ЗАГАЛЬНІ НОТАТКИ]\n${content.notes}\n\n`;
    }
    
    context += "--- КІНЕЦЬ КОНТЕКСТУ ---\n\n";
    return context;
};


// === 4. МАРШРУТИ API ===

// --- Головний маршрут для віддачі index.html ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

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

// --- ОНОВЛЕНО: Маршрут для створення проєкту ---
app.post('/create-project', async (req, res) => {
    const { user, title } = req.body;
    if (!user || !title) {
        return res.status(400).json({ message: "Необхідно вказати 'user' та 'title'" });
    }
    try {
        // Створюємо нову, повну структуру проєкту
        const newProjectData = {
            owner: user,
            title: title,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            chatHistory: createInitialChatHistory(title),
            content: createInitialContent() // Створюємо порожній 'content'
        };

        const newProjectRef = await db.collection('projects').add(newProjectData);
        
        res.status(201).json({ 
            id: newProjectRef.id, 
            title: title,
            data: newProjectData // Відправляємо всі дані назад на фронтенд
        });
    } catch (error) {
        console.error("Помилка при створенні проєкту:", error);
        res.status(500).json({ message: "Не вдалося створити проєкт." });
    }
});

// --- НОВИЙ: Маршрут для отримання ВСІХ даних проєкту ---
app.get('/get-project-content', async (req, res) => {
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
        
        // Відправляємо всі дані проєкту
        res.json(doc.data()); 
        
    } catch (error) {
        console.error("Помилка при отриманні контенту проєкту:", error);
        res.status(500).json({ message: "Не вдалося завантажити дані проєкту." });
    }
});

// --- НОВИЙ: Маршрут для збереження контенту проєкту (універсальний) ---
app.post('/save-project-content', async (req, res) => {
    // Очікуємо { projectID, field, value }
    // 'field' - це рядок з крапковою нотацією, напр. "content.notes" або "content.characters"
    const { projectID, field, value } = req.body;

    if (!projectID || !field) {
        return res.status(400).json({ message: "Необхідно вказати projectID та field" });
    }

    try {
        const docRef = db.collection('projects').doc(projectID);
        
        // Використовуємо [field] (computed property name) для оновлення
        // за допомогою крапкової нотації Firestore.
        await docRef.update({
            [field]: value
        });
        
        res.status(200).json({ message: `Поле ${field} успішно оновлено.` });

    } catch (error) {
        console.error(`Помилка при оновленні ${field}:`, error);
        res.status(500).json({ message: "Помилка збереження." });
    }
});


// --- ОНОВЛЕНО: Маршрут чату (з новим RAG) ---
app.post('/chat', async (req, res) => {
    const { projectID, message } = req.body; 
    if (!projectID || !message) {
        return res.status(400).json({ message: "Необхідні projectID та message" });
    }

    try {
        // --- КРОК 1: Отримуємо проєкт ---
        const projectDocRef = db.collection('projects').doc(projectID);
        const doc = await projectDocRef.get();
        if (!doc.exists) {
            return res.status(404).json({ message: "Проєкт не знайдено." });
        }
        
        const projectData = doc.data();
        let chatHistory = projectData.chatHistory;
        
        // --- КРОК 2: RAG - Збираємо весь контент для контексту ---
        // (Це ще не той "розумний" RAG з пошуком, але це вже повний контекст)
        const ragContext = compileContentForRAG(projectData.content);
        
        // --- КРОК 3: Формуємо запит до Gemini ---
        // Додаємо RAG-контекст *тільки* до останнього повідомлення користувача
        chatHistory.push({ role: "user", parts: [{ text: ragContext + message }] });
        
        const result = await model.generateContent({ contents: chatHistory });
        const botResponse = result.response.text();
        
        console.log(`Gemini відповів для проєкту ${projectID}`);

        // --- КРОК 4: Зберігаємо в базі ---
        // Видаляємо повідомлення з RAG-контекстом
        chatHistory.pop(); 
        // Додаємо чисте повідомлення користувача
        chatHistory.push({ role: "user", parts: [{ text: message }] });
        // Додаємо відповідь бота
        chatHistory.push({ role: "model", parts: [{ text: botResponse }] });
        
        await projectDocRef.update({ chatHistory: chatHistory });
        
        // --- КРОК 5: Відправляємо відповідь на фронтенд ---
        res.json({ message: botResponse });

    } catch (error) {
        console.error("Помилка в /chat:", error);
        res.status(500).json({ message: "Ой, щось зламалось у моєму мозку..." });
    }
});

// --- Маршрут для видалення проєкту (Без змін) ---
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

// --- ОНОВЛЕНО: Маршрут експорту проєкту (тепер експортує ВСЕ) ---
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
        const { title, content, chatHistory } = projectData;

        // 2. Форматуємо ВСІ дані в читабельний текст
        let fileContent = `Проєкт: ${title}\n`;
        fileContent += "========================================\n\n";

        fileContent += "--- ЯДРО ІДЕЇ ---\n";
        fileContent += `Про що книга: ${content.premise || 'N/A'}\n`;
        fileContent += `Проблематика: ${content.theme || 'N/A'}\n`;
        fileContent += `Головна арка: ${content.mainArc || 'N/A'}\n\n`;

        fileContent += "--- ПЕРСОНАЖІ ---\n";
        if (content.characters && content.characters.length > 0) {
            content.characters.forEach(c => {
                fileContent += `Ім'я: ${c.name}\nОпис: ${c.description}\nАрка: ${c.arc}\n---\n`;
            });
        } else { fileContent += "N/A\n"; }
        fileContent += "\n";
        
        fileContent += "--- РОЗДІЛИ ---\n";
         if (content.chapters && content.chapters.length > 0) {
            content.chapters.forEach(c => {
                fileContent += `Розділ: ${c.title} (Статус: ${c.status})\n`;
                fileContent += `${c.text}\n---\n`;
            });
        } else { fileContent += "N/A\n"; }
        fileContent += "\n";
        
        fileContent += "--- НОТАТКИ ---\n";
        fileContent += `${content.notes || 'N/A'}\n\n`;

        fileContent += "========================================\n";
        fileContent += "--- ІСТОРІЯ ЧАТУ З ОПУСОМ ---\n\n";
        
        chatHistory.forEach(message => {
            if (message.role === 'user' && message.parts[0].text.startsWith('Ти — "Опус"')) return; // Пропускаємо промпт
            const sender = message.role === 'model' ? 'Опус' : 'Користувач';
            const text = message.parts[0].text.split("--- КОНТЕКСТ ПРОЄКТУ")[0]; // Вирізаємо RAG
            fileContent += `${sender}:\n${text}\n\n---\n\n`;
        });

        // 3. Відправляємо файл браузеру
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_')}.txt"`);
        res.send(fileContent);

    } catch (error) {
        console.error("Помилка при експорті проєкту:", error);
        res.status(500).send("Не вдалося експортувати проєкт.");
    }
});

// --- Маршрут для оновлення назви (Без змін) ---
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


// === 5. ЗАПУСК СЕРВЕРА ===
app.listen(port, () => {
  console.log(`✅ Сервер успішно запущено на порту ${port}`);
  if (!process.env.PORT) {
    console.log(`   Локальна адреса: localhost:${port}`);
  } else {
    console.log(`   Публічна адреса (на Render): gemini-opusai.onrender.com`);
  }
});