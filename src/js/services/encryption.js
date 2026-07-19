// Шифрование сообщений и файлов — реализовано буквально по формулировке
// ТЗ («привет crypto-js!»): AES через библиотеку crypto-js. Шифрование
// и расшифровка происходят полностью на клиенте — сервер видит только
// непрозрачный шифротекст и никогда не получает пароль.
//
// Осознанное упрощение (см. README): деривация ключа из пароля в
// crypto-js — это устаревшая одно-проходная схема на базе MD5 без соли
// и итераций, а само шифрование не проверяет целостность данных (не
// AEAD). Для демонстрации функции по ТЗ этого достаточно, но как
// продакшен-грейд криптографию рассматривать не стоит.

import CryptoJS from 'crypto-js';

export function encryptText(text, password) {
  return CryptoJS.AES.encrypt(text, password).toString();
}

// Неверный пароль не бросает исключение при расшифровке AES сам по себе —
// на выходе получается пустая или «мусорная» строка, поэтому проверяем результат.
export function decryptText(cipherText, password) {
  let text;
  try {
    text = CryptoJS.AES.decrypt(cipherText, password).toString(CryptoJS.enc.Utf8);
  } catch {
    text = '';
  }
  if (!text) throw new Error('Неверный пароль или повреждённые данные');
  return text;
}

// Побитовые операции здесь неизбежны: так устроена распаковка 32-битных
// слов crypto-js (WordArray) в обычный побайтовый Uint8Array.
/* eslint-disable no-bitwise */
function wordArrayToBytes(wordArray) {
  const { words, sigBytes } = wordArray;
  const bytes = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i += 1) {
    bytes[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return bytes;
}
/* eslint-enable no-bitwise */

// Файл шифруется целиком как бинарные данные и упаковывается в текстовый
// Blob — такой шифротекст можно загрузить через тот же /files endpoint.
export async function encryptFile(file, password) {
  const buffer = await file.arrayBuffer();
  const wordArray = CryptoJS.lib.WordArray.create(buffer);
  const cipherText = CryptoJS.AES.encrypt(wordArray, password).toString();
  return new Blob([cipherText], { type: 'text/plain' });
}

export async function decryptFile(cipherBlob, password, mimeType) {
  const cipherText = await cipherBlob.text();
  let bytes;
  try {
    bytes = wordArrayToBytes(CryptoJS.AES.decrypt(cipherText, password));
  } catch {
    bytes = new Uint8Array(0);
  }
  if (!bytes.length) throw new Error('Неверный пароль или повреждённые данные');
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}
