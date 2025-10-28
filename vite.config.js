import { defineConfig } from 'vite';

export default defineConfig({
  // Коренева папка проєкту
  root: '.',
  
  // Налаштування Dev Server
  server: {
    port: 5173, // Порт для Vite Dev Server
    // Проксі-сервер для перенаправлення всіх API-запитів на Express-сервер (порт 3000)
    proxy: {
      '/chat': 'http://localhost:3000',
      '/save-project-content': 'http://localhost:3000',
      '/get-project-content': 'http://localhost:3000',
      '/create-project': 'http://localhost:3000',
      '/delete-project': 'http://localhost:3000',
      
      // === ОНОВЛЕНО (ФАЗА 1/2) ===
      '/update-project-details': 'http://localhost:3000', // Новий маршрут
      // '/update-title': 'http://localhost:3000', // Старий маршрут видалено

      '/export-project': 'http://localhost:3000',
      '/get-projects': 'http://localhost:3000',
      '/log-error': 'http://localhost:3000',
      '/migrate-project-data': 'http://localhost:3000' // Додано про всяк випадок
    }
  },

  // Налаштування продакшн-збірки
  build: {
    outDir: 'dist', // Папка для результатів збірки
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html', // Точка входу
    }
  }
});