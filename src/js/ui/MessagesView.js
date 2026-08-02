// Лента сообщений: отрисовка, триггер ленивой подгрузки при прокрутке
// вверх, сохранение позиции скролла при добавлении старых сообщений,
// переход к сообщению с подсветкой, индикатор «бот печатает».
// Дедупликация по id защищает от повторов (ответ POST + событие WebSocket).

import renderMessage, { renderPlainText, renderFileBody } from './MessageRenderer';

const TOP_TRIGGER = 60;
const BOTTOM_STICK = 120;
const FLASH_DURATION = 1600;
const TYPING_TIMEOUT = 6000;

export default class MessagesView {
  #list;

  #empty;

  #typing;

  #callbacks;

  #urls;

  #items = new Map();

  #typingTimer = null;

  constructor(root, {
    onReachTop, onAction, fileUrl, downloadUrl,
  }) {
    this.#list = root.querySelector('[data-messages]');
    this.#empty = root.querySelector('[data-empty]');
    this.#typing = root.querySelector('[data-typing]');
    this.#callbacks = { onReachTop, onAction };
    this.#urls = { fileUrl, downloadUrl };
    this.#bind();
  }

  #bind() {
    this.#list.addEventListener('scroll', () => {
      if (this.#list.scrollTop <= TOP_TRIGGER) this.#callbacks.onReachTop();
    });

    // Делегирование кликов по кнопкам действий (закрепить, избранное).
    this.#list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const message = button.closest('[data-id]');
      this.#callbacks.onAction(button.dataset.action, message.dataset.id);
    });
  }

  #build(message) {
    const urls = message.file
      ? { file: this.#urls.fileUrl(message.id), download: this.#urls.downloadUrl(message.id) }
      : {};
    const element = renderMessage(message, urls);
    this.#items.set(message.id, element);
    return element;
  }

  #refreshEmpty() {
    this.#empty.hidden = this.#items.size > 0;
  }

  #nearBottom() {
    const { scrollHeight, scrollTop, clientHeight } = this.#list;
    return scrollHeight - scrollTop - clientHeight < BOTTOM_STICK;
  }

  setInitial(messages) {
    messages.forEach((message) => this.#typing.before(this.#build(message)));
    this.#refreshEmpty();
    this.scrollToBottom();
  }

  // Старые сообщения добавляются сверху; позиция прокрутки сохраняется —
  // лента не «прыгает» при подгрузке истории.
  prepend(messages) {
    const previousHeight = this.#list.scrollHeight;
    const previousTop = this.#list.scrollTop;
    const elements = messages.map((message) => this.#build(message));
    this.#empty.after(...elements);
    this.#list.scrollTop = this.#list.scrollHeight - previousHeight + previousTop;
    this.#refreshEmpty();
  }

  append(message) {
    if (this.#items.has(message.id)) return;
    const stick = this.#nearBottom();
    this.#typing.before(this.#build(message));
    if (message.author === 'bot') this.hideTyping();
    this.#refreshEmpty();
    if (stick) this.scrollToBottom();
  }

  has(id) {
    return this.#items.has(id);
  }

  // Убирает сообщение из ленты (например, после удаления — локального
  // или пришедшего WebSocket-событием из другой вкладки).
  remove(id) {
    const element = this.#items.get(id);
    if (!element) return;
    element.remove();
    this.#items.delete(id);
    this.#refreshEmpty();
  }

  firstId() {
    const first = this.#empty.nextElementSibling;
    return first && first.dataset.id ? first.dataset.id : null;
  }

  lastId() {
    const last = this.#typing.previousElementSibling;
    return last && last.dataset.id ? last.dataset.id : null;
  }

  isScrollable() {
    return this.#list.scrollHeight > this.#list.clientHeight + 10;
  }

  scrollToBottom() {
    this.#list.scrollTop = this.#list.scrollHeight;
  }

  scrollToMessage(id) {
    const element = this.#items.get(id);
    if (!element) return false;
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    element.classList.add('is-flash');
    setTimeout(() => element.classList.remove('is-flash'), FLASH_DURATION);
    return true;
  }

  // Шифротекст сообщения хранится в data-атрибуте плейсхолдера —
  // сам оркестратор его не запрашивает у сервера повторно.
  getCipherText(id) {
    const element = this.#items.get(id);
    const container = element && element.querySelector('[data-encrypted-text]');
    return container ? container.dataset.cipher : null;
  }

  // Метаданные зашифрованного файла (исходный MIME, категория, имя) —
  // содержимое на диске сервер отдаёт как непрозрачный шифротекст.
  getEncryptedFileMeta(id) {
    const element = this.#items.get(id);
    const container = element && element.querySelector('[data-encrypted-file]');
    if (!container) return null;
    return {
      name: container.querySelector('[data-file-name]').textContent,
      mimeType: container.dataset.originalMime,
      category: container.dataset.category,
    };
  }

  // Заменяет плейсхолдер зашифрованного текста на расшифрованный
  // (вызывается после успешного ввода пароля).
  revealText(id, text) {
    const element = this.#items.get(id);
    const container = element && element.querySelector('[data-encrypted-text]');
    if (container) container.outerHTML = renderPlainText(text);
  }

  // Заменяет плейсхолдер зашифрованного файла на воспроизводимый/скачиваемый
  // контент с blob-URL, построенным из расшифрованных байт.
  revealFile(id, name, size, category, blobUrl) {
    const element = this.#items.get(id);
    const container = element && element.querySelector('[data-encrypted-file]');
    if (container) container.outerHTML = renderFileBody(name, size, category, blobUrl, blobUrl);
  }

  setFavorite(id, favorite) {
    const element = this.#items.get(id);
    if (element) element.classList.toggle('is-favorite', favorite);
  }

  setPinnedId(id) {
    this.#items.forEach((element) => element.classList.remove('is-pinned'));
    const target = id ? this.#items.get(id) : null;
    if (target) target.classList.add('is-pinned');
  }

  showTyping() {
    const stick = this.#nearBottom();
    this.#typing.hidden = false;
    if (stick) this.scrollToBottom();
    clearTimeout(this.#typingTimer);
    this.#typingTimer = setTimeout(() => this.hideTyping(), TYPING_TIMEOUT);
  }

  hideTyping() {
    this.#typing.hidden = true;
    clearTimeout(this.#typingTimer);
  }
}
