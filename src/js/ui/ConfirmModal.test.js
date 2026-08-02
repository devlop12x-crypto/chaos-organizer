/**
 * @jest-environment jsdom
 */

import ConfirmModal from './ConfirmModal';

function buildFixture() {
  document.body.innerHTML = `
    <div class="app">
      <div data-confirm-modal hidden>
        <p data-confirm-text></p>
        <button type="button" data-confirm-cancel></button>
        <button type="button" data-confirm-ok></button>
      </div>
    </div>`;
  return document.body.querySelector('.app');
}

describe('ConfirmModal', () => {
  test('подтверждение резолвит true и закрывает окно', async () => {
    const root = buildFixture();
    const modal = new ConfirmModal(root);

    const promise = modal.ask('Удалить сообщение?');
    expect(root.querySelector('[data-confirm-modal]').hidden).toBe(false);
    expect(root.querySelector('[data-confirm-text]').textContent).toBe('Удалить сообщение?');

    root.querySelector('[data-confirm-ok]').click();
    await expect(promise).resolves.toBe(true);
    expect(root.querySelector('[data-confirm-modal]').hidden).toBe(true);
  });

  test('отмена резолвит false', async () => {
    const root = buildFixture();
    const modal = new ConfirmModal(root);

    const promise = modal.ask('Удалить сообщение?');
    root.querySelector('[data-confirm-cancel]').click();
    await expect(promise).resolves.toBe(false);
  });
});
