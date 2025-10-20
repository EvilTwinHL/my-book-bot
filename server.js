// === 1. ПІДКЛЮЧЕННЯ ===
const express = require('express');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// НОВЕ: Підключаємо Firebase Admin SDK для роботи з базою даних
const admin = require('firebase-admin');

// === 2. НАЛАШТУВАННЯ ===
const app = express();
const port = 3000;
app.use(express.json());
app.use(express.static('.'));

// --- Налаштування Firebase ---
// НОВЕ: Завантажуємо наш ключ до бази даних
const serviceAccount = require('./serviceAccountKey.json');

// НОВЕ: Ініціалізуємо додаток Firebase, надавши йому "ключ"
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// НОВЕ: Отримуємо доступ до нашої бази даних (Firestore)
const db = admin.firestore();
// НОВЕ: Визначаємо "ID" нашого проєкту. Це буде "документ" у базі.
// Ви можете змінити це ім'я, якщо хочете мати *різні* проєкти
const PROJECT_ID = 'my-first-book';

// --- Налаштування Gemini ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Використовуємо вашу робочу модель, яку ви знайшли
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

// НОВЕ: Переносимо "особистість" у функцію, яка створює нову історію
const botPersona = `
Ти — "Опус", експертний помічник зі створення книг та літературний наставник. Твоя мета — допомагати користувачеві писати книгу крок за кроком, від ідеї до фінального тексту.

Твої головні принципи:
1.  **Ти — Співавтор:** Став навідні запитання, щоб допомогти користувачеві писати. Не пиши великі шматки тексту за нього.
2.  **Структура — це все:** Завжди думай про структуру (жанр, 3-актна структура, розвиток персонажа).
3.  **Тон:** Будь підтримуючим, професійним та надихаючим. Використовуй емодзі (✍️, 📚, 🤔, ✨) доречно.
4.  **Стислість:** Відповідай коротко і по суті (2-3 речення), щоб підтримувати темп розмови.
`;

// НОВЕ: Створюємо "початкову історію", якщо в базі нічого немає
const createInitialHistory = () => {
  return [
    { role: "user", parts: [{ text: botPersona }] },
    { role: "model", parts: [{ text: "Я Опус, ваш літературний наставник. З якої великої ідеї ми почнемо сьогодні? ✍️" }] }
  ];
};

// === 3. ОБРОБКА ЗАПИТІВ (Повністю переписана) ===

app.post('/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    console.log('Сервер отримав від користувача:', userMessage);

    // --- КРОК 1: Завантажуємо історію з Firestore ---
    // Створюємо посилання на наш "документ" у базі даних
    const projectDocRef = db.collection('projects').doc(PROJECT_ID);
    const doc = await projectDocRef.get();

    let history;
    if (!doc.exists) {
      // Якщо документа немає, створюємо нову історію
      console.log('Документ не знайдено, створюю нову історію...');
      history = createInitialHistory();
    } else {
      // Якщо документ є, завантажуємо з нього історію
      console.log('Історію завантажено з Firestore.');
      history = doc.data().history;
    }

    // --- КРОК 2: Додаємо нове повідомлення користувача до історії ---
    history.push({ role: "user", parts: [{ text: userMessage }] });

    // --- КРОК 3: Надсилаємо всю історію в Gemini ---
    // Ми більше не використовуємо `chatSession`, а `generateContent`
    const result = await model.generateContent({ contents: history });
    const botResponse = result.response.text();
    
    console.log('Gemini відповів:', botResponse);

    // --- КРОК 4: Зберігаємо оновлену історію в Firestore ---
    // Додаємо відповідь бота до історії, *перед* збереженням
    history.push({ role: "model", parts: [{ text: botResponse }] });

    // Повністю перезаписуємо документ новою, повною історією
    await projectDocRef.set({ history: history });
    console.log('Історію збережено в Firestore.');

    // --- КРОК 5: Відправляємо відповідь на фронтенд ---
    res.json({ message: botResponse });

  } catch (error) {
    console.error("Помилка в /chat:", error);
    res.status(500).json({ message: "Ой, щось зламалось у моєму мозку... Перевірте термінал сервера." });
  }
});

// НОВЕ: Маршрут для отримання списку проєктів для конкретного користувача
app.get('/get-projects', async (req, res) => {
    // Ми очікуємо на запит типу: /get-projects?user=Mikhailo_V
    const user = req.query.user; 
    
    if (!user) {
        return res.status(400).json({ message: "Необхідно вказати користувача (user)" });
    }

    try {
        const projectsRef = db.collection('projects');
        // Головний запит: шукаємо всі проєкти, де поле 'owner' == 'Mikhailo_V'
        const snapshot = await projectsRef.where('owner', '==', user).get();

        if (snapshot.empty) {
            console.log(`Проєктів для ${user} не знайдено.`);
            return res.json([]); // Повертаємо порожній масив, це не помилка
        }

        const projects = [];
        snapshot.forEach(doc => {
            // Збираємо список проєктів, відправляємо ID та title
            projects.push({
                id: doc.id,
                title: doc.data().title || 'Проєкт без назви' // '||' - на випадок, якщо назви немає
            });
        });
        
        console.log(`Надсилаю ${projects.length} проєкт(ів) для ${user}`);
        res.json(projects);
    } catch (error) {
        console.error("Помилка при отриманні проєктів:", error);
        res.status(500).json({ message: "Не вдалося завантажити проєкти." });
    }
});

// НОВЕ: Маршрут для СТВОРЕННЯ нового проєкту
app.post('/create-project', async (req, res) => {
    // Ми очікуємо отримати { user: "Mykhailo", title: "Нова книга" }
    const { user, title } = req.body;

    if (!user || !title) {
        return res.status(400).json({ message: "Необхідно вказати 'user' та 'title'" });
    }

    try {
        // Створюємо нову, свіжу історію для цього проєкту
        const initialHistory = [
            { role: "user", parts: [{ text: botPersona }] },
            { role: "model", parts: [{ text: `Я Опус. Радий почати роботу над вашою новою книгою "${title}"! З якої ідеї почнемо? ✍️` }] }
        ];

        // Додаємо новий документ в колекцію 'projects'
        const newProjectRef = await db.collection('projects').add({
            owner: user,
            title: title,
            history: initialHistory,
            createdAt: new Date() // Додамо дату створення, це корисно
        });

        console.log(`Створено новий проєкт: ${newProjectRef.id} для ${user}`);
        
        // Повертаємо ID та title нового проєкту на фронтенд
        res.status(201).json({ id: newProjectRef.id, title: title });

    } catch (error) {
        console.error("Помилка при створенні проєкту:", error);
        res.status(500).json({ message: "Не вдалося створити проєкт." });
    }
});

// ПРИМІТКА: Нам потрібно, щоб botPersona була доступна
// Переконайтеся, що змінна `botPersona` визначена на самому початку вашого server.js,
// щоб цей новий маршрут міг її "бачити". (У нашому коді вона вже там, так що все гаразд).

// === 4. ЗАПУСК СЕРВЕРА ===
app.listen(port, () => {
  console.log(`✅ Сервер успішно запущено! http://localhost:${port}`);
});