// Боковая панель в духе Telegram: вложения по категориям
// (фото — сеткой превью, видео/аудио/файлы — списком со скачиванием)
// и избранные сообщения с переходом к сообщению в ленте.
// Панель — «глупое» представление: данные ей передаёт оркестратор.

import { escapeHtml, formatDate, formatSize } from '../utils/format';

const ROW_ICONS = {
  video: 'i-cam',
  audio: 'i-music',
  file: 'i-doc',
};

const FAVORITE_ICONS = {
  text: '💬',
  file: '📎',
  geo: '📍',
};

const MAX_SNIPPET = 70;

export default class Sidebar {
  #panel;

  #content;

  #tabs;

  #overlay;

  #callbacks;

  #activeTab = 'image';

  #isOpen = false;

  constructor(root, { onTab, onJump }) {
    this.#panel = root.querySelector('[data-sidebar]');
    this.#content = root.querySelector('[data-sidebar-content]');
    this.#overlay = root.querySelector('[data-overlay]');
    this.#tabs = [...this.#panel.querySelectorAll('[data-tab]')];
    this.#callbacks = { onTab, onJump };

    root.querySelector('[data-sidebar-toggle]').addEventListener('click', () => this.toggle());
    root.querySelector('[data-sidebar-close]').addEventListener('click', () => this.close());
    this.#overlay.addEventListener('click', () => this.close());

    this.#panel.querySelector('.sidebar__tabs').addEventListener('click', (event) => {
      const tab = event.target.closest('[data-tab]');
      if (tab) this.setTab(tab.dataset.tab);
    });

    // Клик по строке (кроме ссылки скачивания) — переход к сообщению.
    this.#content.addEventListener('click', (event) => {
      const row = event.target.closest('[data-jump]');
      if (row && !event.target.closest('a')) this.#callbacks.onJump(row.dataset.jump);
    });
  }

  get activeTab() {
    return this.#activeTab;
  }

  get isOpen() {
    return this.#isOpen;
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
    this.#panel.classList.add('is-open');
    this.#overlay.hidden = false;
    this.#callbacks.onTab(this.#activeTab);
  }

  close() {
    this.#isOpen = false;
    this.#panel.classList.remove('is-open');
    this.#overlay.hidden = true;
  }

  setTab(tab) {
    this.#activeTab = tab;
    this.#tabs.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.tab === tab);
    });
    this.#callbacks.onTab(tab);
  }

  showLoading() {
    this.#content.innerHTML = '<div class="sidebar__empty">Загрузка…</div>';
  }

  render(tab, messages, urls) {
    if (tab !== this.#activeTab) return;
    if (!messages.length) {
      this.#content.innerHTML = '<div class="sidebar__empty">Пока пусто</div>';
      return;
    }
    if (tab === 'image') {
      this.#renderGrid(messages, urls);
    } else if (tab === 'favorites') {
      this.#renderFavorites(messages);
    } else {
      this.#renderRows(tab, messages, urls);
    }
  }

  #renderGrid(messages, urls) {
    const items = messages.map((message) => `
      <a class="sidebar__thumb" href="${urls.fileUrl(message.id)}" target="_blank"
        rel="noopener noreferrer" title="${escapeHtml(message.file.name)}">
        <img src="${urls.fileUrl(message.id)}" alt="${escapeHtml(message.file.name)}" loading="lazy">
      </a>`).join('');
    this.#content.innerHTML = `<div class="sidebar__grid">${items}</div>`;
  }

  #renderRows(tab, messages, urls) {
    const icon = ROW_ICONS[tab] || 'i-doc';
    this.#content.innerHTML = messages.map((message) => `
      <div class="sidebar__row" data-jump="${message.id}">
        <svg class="icon sidebar__row-icon"><use href="#${icon}"></use></svg>
        <div class="sidebar__row-main">
          <div class="sidebar__row-name">${escapeHtml(message.file.name)}</div>
          <div class="sidebar__row-sub">${formatSize(message.file.size)} · ${formatDate(message.timestamp)}</div>
        </div>
        <a class="icon-btn" href="${urls.downloadUrl(message.id)}" title="Скачать" aria-label="Скачать файл">
          <svg class="icon"><use href="#i-download"></use></svg>
        </a>
      </div>`).join('');
  }

  #renderFavorites(messages) {
    this.#content.innerHTML = messages.map((message) => {
      const icon = FAVORITE_ICONS[message.type] || '💬';
      const source = message.text || (message.file ? message.file.name : 'Геолокация');
      const compact = source.replace(/\s+/g, ' ');
      const short = compact.length > MAX_SNIPPET ? `${compact.slice(0, MAX_SNIPPET)}…` : compact;
      return `
        <div class="sidebar__row" data-jump="${message.id}">
          <span class="sidebar__row-icon">${icon}</span>
          <div class="sidebar__row-main">
            <div class="sidebar__row-name">${escapeHtml(short)}</div>
            <div class="sidebar__row-sub">${formatDate(message.timestamp)}</div>
          </div>
        </div>`;
    }).join('');
  }
}
