// Панель ввода: отправка текста (Enter или кнопка), выбор файлов через
// иконку-скрепку, кнопки геолокации, записи аудио/видео, пикер эмодзи
// и переключатель шифрования исходящих сообщений.

import EmojiPicker from './EmojiPicker';

export default class ComposerView {
  #input;

  #encryptBtn;

  #callbacks;

  constructor(root, callbacks) {
    this.#callbacks = callbacks;
    this.#input = root.querySelector('[data-text-input]');
    this.#encryptBtn = root.querySelector('[data-encrypt-toggle]');
    const fileInput = root.querySelector('[data-file-input]');

    root.querySelector('[data-send-btn]').addEventListener('click', () => this.#submit());

    this.#input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.#submit();
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) this.#callbacks.onFiles([...fileInput.files]);
      fileInput.value = '';
    });

    root.querySelector('[data-geo-btn]').addEventListener('click', () => this.#callbacks.onGeo());
    root.querySelector('[data-audio-btn]').addEventListener('click', () => this.#callbacks.onRecord('audio'));
    root.querySelector('[data-video-btn]').addEventListener('click', () => this.#callbacks.onRecord('video'));
    this.#encryptBtn.addEventListener('click', () => this.#callbacks.onToggleEncrypt());

    // eslint-disable-next-line no-new
    new EmojiPicker(root, (emoji) => this.#insertAtCursor(emoji));
  }

  // Вставляет эмодзи в текущую позицию курсора, а не просто в конец строки.
  #insertAtCursor(emoji) {
    const { value, selectionStart, selectionEnd } = this.#input;
    const start = selectionStart ?? value.length;
    const end = selectionEnd ?? value.length;
    this.#input.value = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    const caret = start + emoji.length;
    this.#input.focus();
    this.#input.setSelectionRange(caret, caret);
  }

  // Визуально отражает состояние «следующее сообщение будет зашифровано».
  setEncrypted(active) {
    this.#encryptBtn.classList.toggle('is-active', active);
    this.#encryptBtn.title = active ? 'Шифрование включено (нажмите, чтобы отключить)' : 'Зашифровать сообщение';
  }

  #submit() {
    const text = this.#input.value.trim();
    if (!text) return;
    this.#callbacks.onSend(text);
    this.#input.value = '';
    this.#input.focus();
  }
}
