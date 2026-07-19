import './css/style.css';
import ChaosOrganizer from './js/app/ChaosOrganizer';

document.addEventListener('DOMContentLoaded', () => {
  const app = new ChaosOrganizer(document.querySelector('.app'));
  app.init();
});
