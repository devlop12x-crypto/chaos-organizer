// Построение DOM-элемента одного сообщения через <template>.
// Весь пользовательский контент экранируется (защита от XSS),
// http(s)-ссылки становятся кликабельными.

import {
  escapeHtml, linkify, formatDate, formatSize,
} from '../utils/format';

// Отрисовка обычного (уже расшифрованного, если нужно) текста —
// используется и для открытых сообщений, и для показа результата расшифровки.
export function renderPlainText(text) {
  return `<p class="msg__text">${linkify(escapeHtml(text))}</p>`;
}

function renderText(message) {
  if (message.encrypted) {
    return `
      <p class="msg__text msg__encrypted" data-encrypted-text data-cipher="${escapeHtml(message.text)}">
        <svg class="icon"><use href="#i-lock"></use></svg>
        Зашифрованное сообщение
        <button class="btn btn--ghost msg__reveal" type="button" data-action="reveal">Показать</button>
      </p>`;
  }
  return renderPlainText(message.text);
}

function renderGeo(message) {
  const { latitude, longitude } = message.geo;
  const href = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
  return `
    <p class="msg__text msg__geo">
      <svg class="icon"><use href="#i-geo"></use></svg>
      <a class="msg__link" href="${href}" target="_blank" rel="noopener noreferrer">
        ${latitude.toFixed(5)}, ${longitude.toFixed(5)}
      </a>
    </p>`;
}

// Изображения показываются превью, видео и аудио — встроенными плеерами
// (воспроизведение через браузерные API). Строка файла с кнопкой
// скачивания выводится для любого вложения. Используется как для обычных
// файлов (src/download ведут на сервер), так и для уже расшифрованных
// (src/download ведут на blob-URL, построенный из расшифрованных байт).
export function renderFileBody(name, size, category, fileUrl, downloadUrl) {
  const safeName = escapeHtml(name);

  let media = '';
  if (category === 'image') {
    media = `<a href="${fileUrl}" target="_blank" rel="noopener noreferrer">
      <img class="msg__image" src="${fileUrl}" alt="${safeName}" loading="lazy">
    </a>`;
  }
  if (category === 'video') {
    media = `<video class="msg__video" src="${fileUrl}" controls preload="metadata"></video>`;
  }
  if (category === 'audio') {
    media = `<audio class="msg__audio" src="${fileUrl}" controls preload="metadata"></audio>`;
  }

  return `
    ${media}
    <div class="msg__file">
      <svg class="icon msg__file-icon"><use href="#i-doc"></use></svg>
      <span class="msg__file-name">${safeName}</span>
      <span class="msg__file-size">${formatSize(size)}</span>
      <a class="icon-btn msg__download" href="${downloadUrl}" title="Скачать" aria-label="Скачать файл" download="${safeName}">
        <svg class="icon"><use href="#i-download"></use></svg>
      </a>
    </div>`;
}

function renderFile(message, urls) {
  const { file } = message;
  const name = escapeHtml(file.name);

  if (file.encrypted) {
    const originalMime = escapeHtml(file.originalMimeType || 'application/octet-stream');
    return `
      <div class="msg__file msg__file--locked" data-encrypted-file
        data-original-mime="${originalMime}" data-category="${file.category}">
        <svg class="icon msg__file-icon"><use href="#i-lock"></use></svg>
        <span class="msg__file-name" data-file-name>${name}</span>
        <span class="msg__file-size">${formatSize(file.size)}</span>
        <button class="icon-btn" type="button" title="Расшифровать" aria-label="Расшифровать файл" data-action="decrypt-file">
          <svg class="icon"><use href="#i-download"></use></svg>
        </button>
      </div>`;
  }

  // Стенограмма голосового (или подпись) выводится под плеером;
  // тот же текст индексируется поиском на сервере — голосовые сообщения
  // можно находить по их содержимому.
  const caption = message.text
    ? `<p class="msg__text msg__caption">${linkify(escapeHtml(message.text))}</p>`
    : '';

  return `${renderFileBody(file.name, file.size, file.category, urls.file, urls.download)}${caption}`;
}

function renderContent(message, urls) {
  if (message.type === 'file') return renderFile(message, urls);
  if (message.type === 'geo') return renderGeo(message);
  return renderText(message);
}

export default function renderMessage(message, urls = {}) {
  const author = message.author === 'bot'
    ? '<header class="msg__author"><span class="msg__avatar">🤖</span>Chaos Organizer</header>'
    : '';

  const classes = [
    'msg',
    `msg--${message.author}`,
    message.favorite ? 'is-favorite' : '',
    message.pinned ? 'is-pinned' : '',
  ].filter(Boolean).join(' ');

  const template = document.createElement('template');
  template.innerHTML = `
    <article class="${classes}" data-id="${message.id}">
      <div class="msg__bubble">
        ${author}
        ${renderContent(message, urls)}
        <div class="msg__meta">
          <time class="msg__time">${formatDate(message.timestamp)}</time>
        </div>
        <div class="msg__actions">
          <button class="icon-btn msg__act msg__act--pin" type="button" title="Закрепить" data-action="pin">
            <svg class="icon"><use href="#i-pin"></use></svg>
          </button>
          <button class="icon-btn msg__act msg__act--fav" type="button" title="В избранное" data-action="favorite">
            <svg class="icon"><use href="#i-star"></use></svg>
          </button>
          <button class="icon-btn msg__act msg__act--delete" type="button" title="Удалить" data-action="delete">
            <svg class="icon"><use href="#i-trash"></use></svg>
          </button>
        </div>
      </div>
    </article>`.trim();

  return template.content.firstElementChild;
}
