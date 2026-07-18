// Всплывающие уведомления: подсказки и ошибки показываются пользователю
// в интерфейсе, а не в консоли.

const LIFETIME = 4000;

export default function showToast(text, type = 'info') {
  const container = document.querySelector('[data-toasts]');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = text;
  container.append(toast);

  setTimeout(() => {
    toast.classList.add('toast--hide');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, LIFETIME);
}
