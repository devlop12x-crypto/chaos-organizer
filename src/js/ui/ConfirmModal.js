// Модальное окно подтверждения необратимого действия (удаление сообщения).
// Возвращает Promise<boolean>: true — подтверждено, false — отмена.
//
// Resolve сохраняется в локальную переменную до закрытия окна — тот же
// принцип, что в PasswordModal: закрытие обнуляет поле, и без этого
// промис никогда бы не завершился.

export default class ConfirmModal {
  #modal;

  #text;

  #resolve = null;

  constructor(root) {
    this.#modal = root.querySelector('[data-confirm-modal]');
    this.#text = root.querySelector('[data-confirm-text]');

    root.querySelector('[data-confirm-ok]').addEventListener('click', () => this.#settle(true));
    root.querySelector('[data-confirm-cancel]').addEventListener('click', () => this.#settle(false));
  }

  ask(text) {
    if (this.#resolve) this.#resolve(false);
    this.#text.textContent = text;
    this.#modal.hidden = false;
    return new Promise((resolve) => {
      this.#resolve = resolve;
    });
  }

  #settle(result) {
    const resolve = this.#resolve;
    this.#modal.hidden = true;
    this.#resolve = null;
    if (resolve) resolve(result);
  }
}
