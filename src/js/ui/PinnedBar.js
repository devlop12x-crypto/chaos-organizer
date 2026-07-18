// Плашка закреплённого сообщения. По условию закреплено может быть
// только одно сообщение: клик по плашке ведёт к нему, крестик открепляет.

import { escapeHtml } from '../utils/format';

const MAX_SNIPPET = 90;

function snippet(message) {
  if (message.type === 'file') return `📎 ${escapeHtml(message.file.name)}`;
  if (message.type === 'geo') return '📍 Геолокация';
  const text = message.text.replace(/\s+/g, ' ');
  return escapeHtml(text.length > MAX_SNIPPET ? `${text.slice(0, MAX_SNIPPET)}…` : text);
}

export default class PinnedBar {
  #bar;

  #text;

  #currentId = null;

  constructor(root, { onJump, onUnpin }) {
    this.#bar = root.querySelector('[data-pinned]');
    this.#text = root.querySelector('[data-pinned-text]');

    root.querySelector('[data-pinned-body]').addEventListener('click', () => {
      if (this.#currentId) onJump(this.#currentId);
    });

    root.querySelector('[data-pinned-unpin]').addEventListener('click', () => {
      if (this.#currentId) onUnpin(this.#currentId);
    });
  }

  get currentId() {
    return this.#currentId;
  }

  set(message) {
    if (!message) {
      this.#currentId = null;
      this.#bar.hidden = true;
      return;
    }
    this.#currentId = message.id;
    this.#text.innerHTML = snippet(message);
    this.#bar.hidden = false;
  }
}
