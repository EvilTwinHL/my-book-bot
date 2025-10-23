// cypress/e2e/smoke.cy.js

describe('Smoke Test', () => {
  it('Додаток повинен завантажитись і показати екран входу', () => {
    // 1. Відвідуємо головну сторінку (використовує `baseUrl` з конфігу)
    cy.visit('/');

    // 2. Перевіряємо, що заголовок правильний
    cy.title().should('eq', 'Опус: Бот-Співавтор');

    // 3. Перевіряємо, що екран входу відображається
    // (Я припускаю, що у вас є #auth-container до входу)
    cy.get('#auth-container').should('be.visible');
    
    // 4. Перевіряємо, що кнопка входу існує
    // (Я припускаю, що кнопка має ID #sign-in-btn)
    cy.get('#sign-in-btn').should('be.visible');
    
    // 5. Перевіряємо, що робоча область прихована
    // (Я припускаю, що #workspace-container має клас .hidden до входу)
    cy.get('#workspace-container').should('have.class', 'hidden');
  });
});