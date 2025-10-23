// === 1. ПІДКЛЮЧЕННЯ ===
const express = require('express');
const path = require('path');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit'); // ОНОВЛЕНО v1.1.0

// === 2. НАЛАШТУВАННЯ ===
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json({ limit: '50mb' })); 
app.use(express.static('.')); 

// --- Налаштування Firebase ---
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
    console.error("ПОМИЛКА: Не вдалося завантажити serviceAccountKey.");
    console.error(error.message);
}

const db = admin.firestore();

// --- Налаштування Gemini ---
let genAI;
let model;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // ОНОВЛЕНО v1.0.1 (ЗАПАМ'ЯТАВ): Використовуємо 2.5 flash
    model = genAI.getGenerativeModel({ model: "gemini-2.5-flash"}); 
} else {
    console.error("ПОМИЛКА: Змінна GEMINI_API_KEY не встановлена.");
}

// --- ОНОВЛЕНО v1.1.0: Налаштування Rate Limiter ---
const chatLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 хвилин
	max: 50, // 50 запитів на 15 хв
	message: { message: 'Забагато запитів до чату. Спробуйте пізніше.' },
    standardHeaders: true, // Вмикає 'Retry-After'
	legacyHeaders: false, 
});

const saveLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 хвилин
	max: 100, // 100 запитів на збереження
	message: { message: 'Забагато запитів на збереження. Спробуйте пізніше.' },
    standardHeaders: true,
	legacyHeaders: false,
});


// === 3. МАРШРУТИ API ===

// --- Головна сторінка ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Маршрут для отримання списку проєктів ---
app.get('/get-projects', async (req, res) => {
    const user = req.query.user;
    if (!user) {
        return res.status(400).json({ message: "Необхідно вказати 'user'" });
    }
    try {
        // v1.0.0: Сортування за 'updatedAt'
        const snapshot = await db.collection('projects')
                                .where('owner', '==', user)
                                .orderBy('updatedAt', 'desc') 
                                .get();
        
        if (snapshot.empty) {
            return res.status(200).json([]);
        }
        
        const projects = snapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title,
            updatedAt: doc.data().updatedAt, 
            totalWordCount: doc.data().totalWordCount || 0 
        }));
        
        res.status(200).json(projects);
        
    } catch (error) {
        console.error("Помилка при отриманні проєктів:", error);
        if (error.code === 9) { 
            console.error("ПОТРІБЕН ІНДЕКС! Перейдіть за посиланням у лозі помилки, щоб створити індекс.");
        }
        res.status(500).send("Не вдалося отримати проєкти. Перевірте лог сервера на помилку індексу.");
    }
});

// --- Маршрут для створення нового проєкту ---
app.post('/create-project', async (req, res) => {
    const { user, title } = req.body;
    if (!user || !title) {
        return res.status(400).json({ message: "Необхідно вказати 'user' та 'title'" });
    }

    // ОНОВЛЕНО v1.1.0: Валідація
    if (title.length > 200) {
        return res.status(400).json({ message: "Назва проєкту занадто довга (макс 200)." });
    }
    
    // v1.0.1: Gemini 2.5 Flash
    const systemPrompt = "Ти — \"Опус\", експертний помічник зі створення книг (на базі Gemini 2.5 Flash), літературний критик та співавтор. Твоє завдання — допомагати користувачу структурувати його ідеї, розвивати персонажів, прописувати сюжетні лінії та писати текст книги. Ти завжди звертаєшся до користувача на \"Ви\". Ти маєш доступ до всіх його нотаток: персонажів, локацій, розділів та сюжетних ліній. Використовуй цей контекст, щоб надавати максимально релевантні поради. Твій стиль спілкування: професійний, ввічливий, креативний та підтримуючий.";
    const firstBotMessage = `Я Опус. Вітаю! Я готовий почати роботу над Вашим новим проєктом \"${title}\". З чого почнемо? ✍️`;

    try {
        const newProjectData = {
            owner: user,
            title: title,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(), 
            totalWordCount: 0, 
            content: {
                premise: "", theme: "", mainArc: "", notes: "", research: "",
                characters: [], chapters: [], locations: [], plotlines: []
            },
            chatHistory: [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: firstBotMessage }] }
            ]
        };

        const docRef = await db.collection('projects').add(newProjectData);
        console.log(`Створено новий проєкт ${docRef.id} для ${user}`);
        
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
// ОНОВЛЕНО v1.1.0: Додано chatLimiter
app.post('/chat', chatLimiter, async (req, res) => {
    const { projectID, message } = req.body;
    
    if (!model) {
        return res.status(500).json({ message: "Модель AI не ініціалізована." });
    }
    if (!projectID || !message) {
        return res.status(400).json({ message: "Необхідно вказати projectID та message" });
    }

    try {
        const projectRef = db.collection('projects').doc(projectID);
        const doc = await projectRef.get();
        if (!doc.exists) {
            return res.status(404).json({ message: "Проєкт не знайдено" });
        }
        
        const projectData = doc.data();
        let history = projectData.chatHistory || [];
        
        let contextBlock = "--- КОНТЕКСТ ПРОЄКТУ (Тільки для твого відома) ---\n";
        contextBlock += `Назва: ${projectData.title}\n`;
        contextBlock += `Ядро (Logline): ${projectData.content.premise || 'не вказано'}\n`;
        if (projectData.content.characters && projectData.content.characters.length > 0) {
            contextBlock += "\nПерсонажі:\n";
            projectData.content.characters.forEach(c => {
                contextBlock += `- ${c.name}: ${c.description}\n`;
            });
        }
        if (projectData.content.chapters && projectData.content.chapters.length > 0) {
            contextBlock += "\nРозділи (тільки назви та статуси):\n";
            projectData.content.chapters.forEach((c, i) => {
                contextBlock += `${i+1}. ${c.title} (Статус: ${c.status})\n`;
            });
        }
        contextBlock += "--- КІНЕЦЬ КОНТЕКСТУ ---\n\n";
        
        const messageWithContext = message + "\n\n" + contextBlock;
        
        const chat = model.startChat({
            history: history,
        });

        const result = await chat.sendMessage(messageWithContext);
        const response = await result.response;
        const botMessage = response.text();
        
        history.push({ role: "user", parts: [{ text: message }] });
        history.push({ role: "model", parts: [{ text: botMessage }] });
        
        await projectRef.update({ chatHistory: history });
        
        res.status(200).json({ message: botMessage });

    } catch (error) {
        console.error("Помилка в '/chat':", error);
        res.status(500).send("Помилка при обробці чату.");
    }
});


// --- Маршрут для збереження будь-якого поля в 'content' ---
// ОНОВЛЕНО v1.1.0: Додано saveLimiter
app.post('/save-project-content', saveLimiter, async (req, res) => {
    const { projectID, field, value } = req.body;
    
    if (!projectID || !field || value === undefined) {
        return res.status(400).json({ message: "Необхідно вказати projectID, field та value" });
    }

    // ОНОВЛЕНО v1.1.0: Валідація (базова)
    if (field === 'content.characters' && Array.isArray(value) && value.length > 500) {
         return res.status(400).json({ message: "Перевищено ліміт персонажів (500)." });
    }
    if (field === 'content.chapters' && Array.isArray(value) && value.length > 1000) {
         return res.status(400).json({ message: "Перевищено ліміт розділів (1000)." });
    }

    try {
        const projectRef = db.collection('projects').doc(projectID);
        let updateData = {};
        updateData[field] = value;
        updateData['updatedAt'] = admin.firestore.FieldValue.serverTimestamp();

        if (field === 'content.chapters') {
            let totalWordCount = 0;
            if (Array.isArray(value)) {
                totalWordCount = value.reduce((sum, chapter) => {
                    return sum + (chapter.word_count || 0);
                }, 0);
            }
            updateData['totalWordCount'] = totalWordCount;
        }

        await projectRef.update(updateData);
        res.status(200).json({ message: 'Дані збережено' });

    } catch (error) {
        console.error("Помилка при збереженні 'content':", error);
        res.status(500).send("Не вдалося зберегти дані.");
    }
});

// --- ОНОВЛЕНО v1.1.0: Новий ендпоінт для логування помилок ---
app.post('/log-error', (req, res) => {
    const { message, stack, context } = req.body;
    console.error("ПОМИЛКА КЛІЄНТА:", {
        user: context.user,
        project: context.projectID,
        message: message,
        stack: stack,
        timestamp: new Date().toISOString()
    });
    // Тут можна додати логіку для збереження в Sentry, LogRocket або Firebase
    res.status(204).send(); // 204 No Content
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
        
        let fileContent = `ПРОЄКТ: ${title}\n========================================\n\n`;
        fileContent += "--- ЯДРО ІДЕЇ ---\n";
        fileContent += `Logline: ${content.premise || '-'}\nТема: ${content.theme || '-'}\nГоловна арка: ${content.mainArc || '-'}\n\n`;

        if (content.characters && content.characters.length > 0) {
            fileContent += "--- ПЕРСОНАЖІ ---\n";
            content.characters.forEach((c, i) => {
                fileContent += `${i + 1}. ${c.name || 'Без імені'}\n   Опис: ${c.description || '-'}\n   Арка: ${c.arc || '-'}\n\n`;
            });
        }
        
        if (content.locations && content.locations.length > 0) {
            fileContent += "--- ЛОКАЦІЇ ---\n";
            content.locations.forEach((l, i) => {
                fileContent += `${i + 1}. ${l.name || 'Без назви'}\n   Опис: ${l.description || '-'}\n\n`;
            });
        }
        
        if (content.plotlines && content.plotlines.length > 0) {
            fileContent += "--- СЮЖЕТНІ ЛІНІЇ ---\n";
            content.plotlines.forEach((p, i) => {
                fileContent += `${i + 1}. ${p.title || 'Без назви'}\n   Опис: ${p.description || '-'}\n\n`;
            });
        }

        fileContent += "--- НОТАТКИ ТА ДОСЛІДЖЕННЯ ---\n";
        fileContent += `Загальні нотатки:\n${content.notes || '-'}\n\n`;
        fileContent += `Дослідження:\n${content.research || '-'}\n\n`;

        if (content.chapters && content.chapters.length > 0) {
            fileContent += "========================================\n--- ТЕКСТ РУКОПИСУ (РОЗДІЛИ) ---\n========================================\n\n";
            content.chapters.forEach((c, i) => {
                fileContent += `РОЗДІЛ ${i + 1}: ${c.title || 'Без назви'}\n(Статус: ${c.status || 'не вказано'})\n\n`;
                fileContent += `${c.text || '...'}\n\n----------------------------------------\n\n`;
            });
        }

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
    // ОНОВЛЕНО v1.1.0: Валідація
    if (newTitle.length > 200) {
        return res.status(400).json({ message: "Назва проєкту занадто довга (макс 200)." });
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