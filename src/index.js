import './css/style.css';
import ChaosOrganizer from './js/app/ChaosOrganizer';
import initTheme from './js/services/theme';

// Тема применяется до первой отрисовки, чтобы не было «вспышки»
// неправильной темы при загрузке страницы.
initTheme();

document.addEventListener('DOMContentLoaded', () => {
  const app = new ChaosOrganizer(document.querySelector('.app'));
  app.init();
});
