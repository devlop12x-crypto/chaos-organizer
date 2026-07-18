/**
 * @jest-environment jsdom
 */

// Регрессионные тесты модалки пароля. Ключевой кейс: промис из ask()
// ОБЯЗАН резолвиться при подтверждении — из-за обнуления #resolve внутри
// #close() до его вызова промис зависал навсегда, и шифрование молча
// не включалось (сообщения уходили открытым текстом).

import PasswordModal from './PasswordModal';

function buildFixture() {
  document.body.innerHTML = `
    <div class="app">
      <div data-password-modal hidden>
        <p data-password-title></p>
        <input data-password-input>
        <button type="button" data-password-cancel></button>
        <button type="button" data-password-confirm></button>
      </div>
    </div>`;
  return document.body.querySelector('.app');
}

describe('PasswordModal', () => {
  test('ask() резолвится введённым паролем при подтверждении', async () => {
    const root = buildFixture();
    const modal = new PasswordModal(root);

    const promise = modal.ask('Введите пароль');
    root.querySelector('[data-password-input]').value = 'secret123';
    root.querySelector('[data-password-confirm]').click();

    await expect(promise).resolves.toBe('secret123');
    expect(root.querySelector('[data-password-modal]').hidden).toBe(true);
  });

  test('ask() резолвится null при отмене', async () => {
    const root = buildFixture();
    const modal = new PasswordModal(root);

    const promise = modal.ask('Введите пароль');
    root.querySelector('[data-password-cancel]').click();

    await expect(promise).resolves.toBeNull();
  });

  test('пустой пароль не закрывает окно и не резолвит промис', async () => {
    const root = buildFixture();
    const modal = new PasswordModal(root);

    let settled = false;
    const promise = modal.ask('Введите пароль');
    promise.then(() => {
      settled = true;
    });

    root.querySelector('[data-password-confirm]').click();
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(root.querySelector('[data-password-modal]').hidden).toBe(false);
    expect(root.querySelector('[data-password-input]').classList.contains('is-invalid')).toBe(true);

    // после ввода пароля подтверждение срабатывает как обычно
    root.querySelector('[data-password-input]').value = 'secret123';
    root.querySelector('[data-password-confirm]').click();
    await expect(promise).resolves.toBe('secret123');
  });
});
