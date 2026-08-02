// Утилиты форматирования: экранирование HTML, кликабельные ссылки,
// дата и человекочитаемый размер файла.

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}

const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,!?)\]])/g;

// Превращает http(s)-ссылки в кликабельные. Текст должен быть
// предварительно экранирован через escapeHtml.
export function linkify(escapedText) {
  return escapedText.replace(
    URL_PATTERN,
    (url) => `<a class="msg__link" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
  );
}

export function formatDate(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
