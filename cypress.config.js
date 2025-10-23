// cypress.config.js
const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    // Додайте цей рядок
    baseUrl: 'http://localhost:3000', 
    
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
