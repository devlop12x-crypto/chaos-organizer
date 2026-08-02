// Управление темой оформления. Выбор пользователя хранится в localStorage;
// если выбора ещё не было, тема следует системной настройке
// prefers-color-scheme. Сама палитра переключается CSS-переменными
// (блок [data-theme="dark"] в style.css) — этот модуль лишь выставляет
// атрибут data-theme на <html>.

const THEME_KEY = 'chaos-theme';

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

// Вызывается до первой отрисовки страницы (см. index.js), чтобы
// избежать «вспышки» неверной темы при загрузке.
export default function initTheme() {
  let theme = localStorage.getItem(THEME_KEY);
  if (!theme) {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme(theme);

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('[data-theme-toggle]');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(THEME_KEY, next);
    });
  });
}
