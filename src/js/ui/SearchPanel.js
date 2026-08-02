// Поиск по сообщениям: строка в шапке, запрос уходит на сервер
// (от 2 символов, с debounce), результаты — выпадающим списком
// с подсветкой совпадений. Клик по результату ведёт к сообщению.

import { escapeHtml, formatDate } from '../utils/format';

const DEBOUNCE = 300;
const MIN_LENGTH = 2;
const MAX_SNIPPET = 90;

const TYPE_ICONS = {
  text: '💬',
  file: '📎',
  geo: '📍',
};

// Подсветка совпадений: и текст, и запрос предварительно экранируются,
// спецсимволы регулярных выражений в запросе нейтрализуются.
function highlight(text, query) {
  const escaped = escapeHtml(text);
  const safeQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(`(${safeQuery})`, 'gi'), '<mark>$1</mark>');
}

export default class SearchPanel {
  #input;

  #results;

  #callbacks;

  #timer = null;

  constructor(root, { onQuery, onPick }) {
    this.#input = root.querySelector('[data-search-input]');
    this.#results = root.querySelector('[data-search-results]');
    this.#callbacks = { onQuery, onPick };

    this.#input.addEventListener('input', () => {
      clearTimeout(this.#timer);
      const query = this.#input.value.trim();
      if (query.length < MIN_LENGTH) {
        this.hide();
        return;
      }
      this.#timer = setTimeout(() => this.#callbacks.onQuery(query), DEBOUNCE);
    });

    this.#results.addEventListener('click', (event) => {
      const item = event.target.closest('[data-id]');
      if (!item) return;
      this.#callbacks.onPick(item.dataset.id);
      this.hide();
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('[data-search]')) this.hide();
    });
  }

  show(results, query, total) {
    if (!results.length) {
      this.#results.innerHTML = '<div class="search__empty">Ничего не найдено</div>';
      this.#results.hidden = false;
      return;
    }

    const items = results.map((message) => {
      const source = message.text || (message.file ? message.file.name : 'Геолокация');
      const compact = source.replace(/\s+/g, ' ');
      const short = compact.length > MAX_SNIPPET ? `${compact.slice(0, MAX_SNIPPET)}…` : compact;
      return `
        <button class="search__item" type="button" data-id="${message.id}">
          <span class="search__item-text">${TYPE_ICONS[message.type] || '💬'} ${highlight(short, query)}</span>
          <span class="search__item-date">${formatDate(message.timestamp)}</span>
        </button>`;
    }).join('');

    this.#results.innerHTML = `<div class="search__summary">Найдено: ${total}</div>${items}`;
    this.#results.hidden = false;
  }

  hide() {
    this.#results.hidden = true;
    this.#results.innerHTML = '';
  }
}
