// Модальное окно запроса пароля: используется и при включении шифрования
// (пароль для AES), и при просмотре зашифрованного сообщения/файла.
// Возвращает Promise<string|null> — null означает отмену.

export default class PasswordModal {
  #modal;

  #title;

  #input;

  #resolve = null;

  constructor(root) {
    this.#modal = root.querySelector('[data-password-modal]');
    this.#title = root.querySelector('[data-password-title]');
    this.#input = root.querySelector('[data-password-input]');

    root.querySelector('[data-password-confirm]').addEventListener('click', () => this.#confirm());
    root.querySelector('[data-password-cancel]').addEventListener('click', () => this.#cancel());
    this.#input.addEventListener('input', () => this.#input.classList.remove('is-invalid'));
    this.#input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.#confirm();
      if (event.key === 'Escape') this.#cancel();
    });
  }

  ask(title) {
    if (this.#resolve) this.#resolve(null);
    this.#title.textContent = title;
    this.#input.value = '';
    this.#input.classList.remove('is-invalid');
    this.#modal.hidden = false;
    this.#input.focus();
    return new Promise((resolve) => {
      this.#resolve = resolve;
    });
  }

  // Пустой пароль — это не то же самое, что явная отмена: молча
  // соглашаться на него нельзя, иначе шифрование «включается» без
  // реального ключа и пользователь об этом не узнает. Поэтому пустое
  // поле не закрывает модалку, а подсвечивается как ошибка.
  //
  // Важно: resolve сохраняется в локальную переменную ДО вызова #close(),
  // потому что #close() обнуляет поле #resolve — иначе промис из ask()
  // никогда не завершится и вызывающий код зависнет на await.
  #confirm() {
    const { value } = this.#input;
    if (!value) {
      this.#input.classList.add('is-invalid');
      this.#input.focus();
      return;
    }
    const resolve = this.#resolve;
    this.#close();
    if (resolve) resolve(value);
  }

  #cancel() {
    const resolve = this.#resolve;
    this.#close();
    if (resolve) resolve(null);
  }

  #close() {
    this.#modal.hidden = true;
    this.#input.value = '';
    this.#resolve = null;
  }
}
