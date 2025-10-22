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
    console.error("ПОМИЛКА: Не вдалося завантажити serviceAccountKey.");
    console.error("Якщо ви на Render, переконайтеся, що змінна SERVICE_ACCOUNT_KEY_JSON існує.");
    console.error("Якщо ви локально, переконайтеся, що файл serviceAccountKey.json існує.");
    console.error(error.message);
}

const db = admin.firestore();

// --- Налаштування Gemini ---
let genAI;
let model;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-2.5-flash"});
} else {
    console.error("ПОМИЛКА: Змінна GEMINI_API_KEY не встановлена.");
}


// === 3. МАРШРУТИ API ===

// --- Головна сторінка ---
app.get('/', (req, res) => {
    // res.send('Сервер працює!'); // Простий тест
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Маршрут для отримання списку проєктів ---
app.get('/get-projects', async (req, res) => {
    const user = req.query.user;
    if (!user) {
        return res.status(400).json({ message: "Необхідно вказати 'user'" });
    }
    try {
        // ОНОВЛЕНО v0.8.0-fix: Прибрано .orderBy('createdAt', 'desc')
        // Це вимагає індексу і призводить до збою завантаження,
        // якщо індекс не створено або дані відсутні.
        const snapshot = await db.collection('projects')
                                .where('owner', '==', user)
                                // .orderBy('createdAt', 'desc') // <-- ВИДАЛЕНО, щоб виправити помилку
                                .get();
        
        if (snapshot.empty) {
            return res.status(200).json([]);
        }
        
        // Повертаємо лише ID та назву
        const projects = snapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title 
        }));
        
        res.status(200).json(projects);
        
    } catch (error) {
        console.error("Помилка при отриманні проєктів:", error);
        res.status(500).send("Не вдалося отримати проєкти.");
    }
});

// --- Маршрут для створення нового проєкту ---
app.post('/create-project', async (req, res) => {
    const { user, title } = req.body;
    if (!user || !title) {
        return res.status(400).json({ message: "Необхідно вказати 'user' та 'title'" });
    }
    
    // Системний промпт для Опуса
    const systemPrompt = "Ти — \"Опус\", експертний помічник зі створення книг, літературний критик та співавтор. Твоє завдання — допомагати користувачу структурувати його ідеї, розвивати персонажів, прописувати сюжетні лінії та писати текст книги. Ти завжди звертаєшся до користувача на \"Ви\". Ти маєш доступ до всіх його нотаток: персонажів, локацій, розділів та сюжетних ліній. Використовуй цей контекст, щоб надавати максимально релевантні поради. Твій стиль спілкування: професійний, ввічливий, креативний та підтримуючий.";
    // Перше повідомлення від бота
    const firstBotMessage = `Я Опус. Вітаю! Я готовий почати роботу над Вашим новим проєктом \"${title}\". З чого почнемо? ✍️`;

    try {
        // Створюємо об'єкт нового проєкту
        const newProjectData = {
            owner: user,
            title: title,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(), // v0.8.0
            totalWordCount: 0, // v0.8.0
            // 'content' містить всі творчі дані
            content: {
                premise: "",
                theme: "",
                mainArc: "",
                notes: "",
                research: "",
                characters: [],
                chapters: [],
                locations: [],
                plotlines: []
            },
            // 'chatHistory' зберігає історію чату
            chatHistory: [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: firstBotMessage }] }
            ]
        };

        const docRef = await db.collection('projects').add(newProjectData);
        
        console.log(`Створено новий проєкт ${docRef.id} для ${user}`);
        
        // Повертаємо повний об'єкт проєкту, щоб клієнт не робив зайвий запит
        res.status(201).json({
            id: docRef.id,
            data: newProjectData
        });

    } catch (error) {
        console.error("Помилка при створенні проєкту:", error);
        res.status(500).send("Не вдалося створити проєкт.");
    }
});

// --- Маршрут для отримання повного вмісту проєкту ---
app.get('/get-project-content', async (req, res) => {
    const projectID = req.query.projectID;
    if (!projectID) {
        return res.status(400).json({ message: "Необхідно вказати 'projectID'" });
    }
    try {
        const doc = await db.collection('projects').doc(projectID).get();
        if (!doc.exists) {
            return res.status(404).json({ message: "Проєкт не знайдено" });
        }
        res.status(200).json(doc.data());
    } catch (error) {
        console.error("Помилка при отриманні вмісту проєкту:", error);
        res.status(500).send("Не вдалося отримати вміст проєкту.");
    }
});

// --- Маршрут для видалення проєкту ---
app.post('/delete-project', async (req, res) => {
    const { projectID } = req.body;
    if (!projectID) {
        return res.status(400).json({ message: "Необхідно вказати 'projectID'" });
    }
    try {
        await db.collection('projects').doc(projectID).delete();
        console.log(`Проєкт ${projectID} видалено.`);
        res.status(200).json({ message: 'Проєкт видалено' });
    } catch (error) {
        console.error("Помилка при видаленні проєкту:", error);
        res.status(500).send("Не вдалося видалити проєкт.");
    }
});


// --- Маршрут для чату ---
app.post('/chat', async (req, res) => {
    const { projectID, message } = req.body;
    
    if (!model) {
        return res.status(500).json({ message: "Модель AI не ініціалізована." });
    }
    if (!projectID || !message) {
        return res.status(400).json({ message: "Необхідно вказати projectID та message" });
    }

    try {
        // 1. Отримуємо документ проєкту
        const projectRef = db.collection('projects').doc(projectID);
        const doc = await projectRef.get();
        if (!doc.exists) {
            return res.status(404).json({ message: "Проєкт не знайдено" });
        }
        
        const projectData = doc.data();
        let history = projectData.chatHistory || [];
        
        // 2. (НОВЕ) Створюємо контекстний блок
        let contextBlock = "--- КОНТЕКСТ ПРОЄКТУ (Тільки для твого відома) ---\n";
        contextBlock += `Назва: ${projectData.title}\n`;
        contextBlock += `Ядро (Logline): ${projectData.content.premise || 'не вказано'}\n`;
        contextBlock += `Тема: ${projectData.content.theme || 'не вказано'}\n`;
        // Додаємо персонажів
        if (projectData.content.characters && projectData.content.characters.length > 0) {
            contextBlock += "\nПерсонажі:\n";
            projectData.content.characters.forEach(c => {
                contextBlock += `- ${c.name}: ${c.description}\n`;
            });
        }
        // Додаємо розділи
        if (projectData.content.chapters && projectData.content.chapters.length > 0) {
            contextBlock += "\nРозділи (тільки назви та статуси):\n";
            projectData.content.chapters.forEach((c, i) => {
                contextBlock += `${i+1}. ${c.title} (Статус: ${c.status})\n`;
            });
        }
        contextBlock += "--- КІНЕЦЬ КОНТЕКСТУ ---\n\n";
        
        // 3. Додаємо контекст до повідомлення користувача
        const messageWithContext = message + "\n\n" + contextBlock;
        
        // 4. Створюємо сесію чату з історією
        const chat = model.startChat({
            history: history,
        });

        // 5. Відправляємо повідомлення з контекстом
        const result = await chat.sendMessage(messageWithContext);
        const response = await result.response;
        const botMessage = response.text();
        
        // 6. Оновлюємо історію в Firebase
        // Додаємо реальне повідомлення користувача (без контексту)
        history.push({ role: "user", parts: [{ text: message }] });
        // Додаємо відповідь бота
        history.push({ role: "model", parts: [{ text: botMessage }] });
        
        await projectRef.update({ chatHistory: history });
        
        // 7. Повертаємо відповідь клієнту
        res.status(200).json({ message: botMessage });

    } catch (error) {
        console.error("Помилка в '/chat':", error);
        res.status(500).send("Помилка при обробці чату.");
    }
});


// --- Маршрут для збереження будь-якого поля в 'content' ---
// ОНОВЛЕНО v0.8.0: Тепер також оновлює 'updatedAt' та 'totalWordCount'
app.post('/save-project-content', async (req, res) => {
    const { projectID, field, value } = req.body;
    
    if (!projectID || !field || value === undefined) {
        return res.status(400).json({ message: "Необхідно вказати projectID, field та value" });
    }

    try {
        const projectRef = db.collection('projects').doc(projectID);

        // Створюємо об'єкт для оновлення
        let updateData = {};

        // 1. Додаємо основні дані (як і раніше)
        // 'field' приходить як "content.premise", "content.chapters" і т.д.
        updateData[field] = value;

        // 2. (НОВЕ v0.8.0) Завжди оновлюємо дату останньої зміни
        updateData['updatedAt'] = admin.firestore.FieldValue.serverTimestamp();

        // 3. (НОВЕ v0.8.0) Якщо оновлюються розділи, перераховуємо загальну к-ть слів
        if (field === 'content.chapters') {
            let totalWordCount = 0;
            // 'value' - це повний масив розділів
            if (Array.isArray(value)) {
                totalWordCount = value.reduce((sum, chapter) => {
                    // chapter.word_count - це число, яке ми зберегли з v0.5.1
                    return sum + (chapter.word_count || 0);
                }, 0);
            }
            updateData['totalWordCount'] = totalWordCount;
            console.log(`Проєкт ${projectID}: Загальна к-ть слів оновлена: ${totalWordCount}`);
        }

        // 4. Виконуємо одне атомарне оновлення
        await projectRef.update(updateData);
        
        console.log(`Проєкт ${projectID}: Поле ${field} успішно збережено.`);
        res.status(200).json({ message: 'Дані збережено' });

    } catch (error) {
        console.error("Помилка при збереженні 'content':", error);
        res.status(500).send("Не вдалося зберегти дані.");
    }
});


// --- Маршрут для експорту в .txt (Без змін) ---
app.get('/export-project', async (req, res) => {
    const { projectID } = req.query;
    if (!projectID) {
        return res.status(400).json({ message: "Необхідно вказати projectID" });
    }
    
    try {
        const doc = await db.collection('projects').doc(projectID).get();
        if (!doc.exists) {
            return res.status(404).json({ message: "Проєкт не знайдено" });
        }
        
        const project = doc.data();
        const content = project.content;
        const title = project.title || "Exported_Project";
        
        let fileContent = `ПРОЄКТ: ${title}\n`;
        fileContent += "========================================\n\n";

        // 1. Ядро
        fileContent += "--- ЯДРО ІДЕЇ ---\n";
        fileContent += `Logline: ${content.premise || '-'}\n`;
        fileContent += `Тема: ${content.theme || '-'}\n`;
        fileContent += `Головна арка: ${content.mainArc || '-'}\n\n`;

        // 2. Персонажі
        if (content.characters && content.characters.length > 0) {
            fileContent += "--- ПЕРСОНАЖІ ---\n";
            content.characters.forEach((c, i) => {
                fileContent += `${i + 1}. ${c.name || 'Без імені'}\n`;
                fileContent += `   Опис: ${c.description || '-'}\n`;
                fileContent += `   Арка: ${c.arc || '-'}\n\n`;
            });
        }
        
        // 3. Локації
        if (content.locations && content.locations.length > 0) {
            fileContent += "--- ЛОКАЦІЇ ---\n";
            content.locations.forEach((l, i) => {
                fileContent += `${i + 1}. ${l.name || 'Без назви'}\n`;
                fileContent += `   Опис: ${l.description || '-'}\n\n`;
            });
        }
        
        // 4. Сюжетні лінії
        if (content.plotlines && content.plotlines.length > 0) {
            fileContent += "--- СЮЖЕТНІ ЛІНІЇ ---\n";
            content.plotlines.forEach((p, i) => {
                fileContent += `${i + 1}. ${p.title || 'Без назви'}\n`;
                fileContent += `   Опис: ${p.description || '-'}\n\n`;
            });
        }

        // 5. Нотатки
        fileContent += "--- НОТАТКИ ТА ДОСЛІДЖЕННЯ ---\n";
        fileContent += `Загальні нотатки:\n${content.notes || '-'}\n\n`;
        fileContent += `Дослідження:\n${content.research || '-'}\n\n`;

        // 6. Розділи (Текст)
        if (content.chapters && content.chapters.length > 0) {
            fileContent += "========================================\n";
            fileContent += "--- ТЕКСТ РУКОПИСУ (РОЗДІЛИ) ---\n";
            fileContent += "========================================\n\n";
            content.chapters.forEach((c, i) => {
                fileContent += `РОЗДІЛ ${i + 1}: ${c.title || 'Без назви'}\n`;
                fileContent += `(Статус: ${c.status || 'не вказано'})\n\n`;
                fileContent += `${c.text || '...'}\n\n`;
                fileContent += "----------------------------------------\n\n";
            });
        }

        // 7. Чат (опціонально, поки вимкнено для чистоти)
        // ... (можна додати, якщо потрібно)

        // 3. Відправляємо файл браузеру
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=\"${title.replace(/[^a-z0-9]/gi, '_')}.txt\"`);
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
        res.status(500).send("Не вдалося оновити назву.");
    }
});

// === 4. ЗАПУСК СЕРВЕРА ===
app.listen(port, () => {
    console.log(`Сервер успішно запущено на порті ${port}`);
});