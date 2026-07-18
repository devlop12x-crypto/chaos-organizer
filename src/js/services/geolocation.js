// Определение геопозиции пользователя: промис-обёртка над Geolocation API
// с понятными русскоязычными текстами ошибок.

const ERRORS = {
  1: 'Доступ к геолокации запрещён. Разрешите доступ в настройках браузера.',
  2: 'Не удалось определить местоположение.',
  3: 'Превышено время ожидания геолокации.',
};

export default function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Геолокация не поддерживается этим браузером'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(ERRORS[error.code] || 'Ошибка определения геолокации'));
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  });
}
