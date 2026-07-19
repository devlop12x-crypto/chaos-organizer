// Адреса серверной части.
// При локальной разработке используется localhost, на GitHub Pages — Render.

const LOCAL_API = 'http://localhost:7070';

// TODO: после деплоя серверной части на Render впишите сюда URL своего сервиса.
const PRODUCTION_API = 'https://chaos-organizer-backend.onrender.com';

const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const API_URL = isLocal ? LOCAL_API : PRODUCTION_API;
export const WS_URL = API_URL.replace(/^http/, 'ws');
