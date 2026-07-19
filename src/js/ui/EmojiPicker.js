// Пикер эмодзи: кнопка над композером открывает панель с сеткой символов.
// Клик по эмодзи вставляет его в поле ввода в позицию курсора.
// Символы — обычный юникод, специальной библиотеки не требуется.

const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😉', '😍', '😘',
  '🤔', '😎', '🙄', '😴', '😢', '😭', '😡', '🤯',
  '👍', '👎', '👏', '🙏', '🤝', '💪', '👋', '✌️',
  '❤️', '🔥', '✨', '🎉', '💡', '⭐', '✅', '❌',
  '📌', '📎', '📷', '🎬', '🎵', '☕', '🍕', '🚴',
  '☀️', '🌧️', '❄️', '🐱', '🐶', '💻', '📚', '⏰',
];

export default class EmojiPicker {
  #panel;

  #onPick;

  #isOpen = false;

  constructor(root, onPick) {
    const button = root.querySelector('[data-emoji-btn]');
    this.#panel = root.querySelector('[data-emoji-panel]');
    this.#onPick = onPick;

    this.#panel.append(...EMOJIS.map((emoji) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'emoji-panel__item';
      item.dataset.emoji = emoji;
      item.textContent = emoji;
      return item;
    }));

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggle();
    });

    this.#panel.addEventListener('click', (event) => {
      const item = event.target.closest('[data-emoji]');
      if (item) this.#onPick(item.dataset.emoji);
    });

    document.addEventListener('click', (event) => {
      if (this.#isOpen && !event.target.closest('[data-emoji-wrap]')) this.close();
    });
  }

  toggle() {
    if (this.#isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.#isOpen = true;
    this.#panel.hidden = false;
  }

  close() {
    this.#isOpen = false;
    this.#panel.hidden = true;
  }
}
