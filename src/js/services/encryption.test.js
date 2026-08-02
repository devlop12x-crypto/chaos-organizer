// Тесты криптографического модуля (Web Crypto API: AES-256-GCM + PBKDF2).
// testEnvironment — node: в Node.js 19+ Web Crypto доступен глобально,
// как и в браузере, поэтому код модуля тестируется «как есть».

import {
  encryptText, decryptText, encryptFile, decryptFile,
} from './encryption';

const PASSWORD = 'Str0ng!Пароль🔑';

describe('шифрование текста', () => {
  test('шифрует и расшифровывает текст (round-trip)', async () => {
    const text = 'Привет, мир! Links: https://example.com 😀';
    const cipherText = await encryptText(text, PASSWORD);
    expect(cipherText).not.toContain(text);
    await expect(decryptText(cipherText, PASSWORD)).resolves.toBe(text);
  });

  test('поддерживает юникод, эмодзи и пустые строки', async () => {
    const samples = ['', '🔒🔑🛡', '  пробелы по краям  ', 'строка\nс\nпереносами'];
    /* eslint-disable no-restricted-syntax */
    for (const sample of samples) {
      const cipherText = await encryptText(sample, PASSWORD);
      // eslint-disable-next-line no-await-in-loop
      await expect(decryptText(cipherText, PASSWORD)).resolves.toBe(sample);
    }
    /* eslint-enable no-restricted-syntax */
  });

  test('каждое шифрование даёт новый шифротекст (случайные соль и IV)', async () => {
    const first = await encryptText('один и тот же текст', PASSWORD);
    const second = await encryptText('один и тот же текст', PASSWORD);
    expect(first).not.toBe(second);
  });

  test('неверный пароль отклоняется ошибкой (AEAD)', async () => {
    const cipherText = await encryptText('секрет', PASSWORD);
    await expect(decryptText(cipherText, 'другой пароль'))
      .rejects.toThrow('Неверный пароль или повреждённые данные');
  });

  test('подмена байта шифротекста обнаруживается (тэг GCM)', async () => {
    const cipherText = await encryptText('секрет', PASSWORD);
    const bytes = Uint8Array.from(atob(cipherText), (ch) => ch.charCodeAt(0));
    /* eslint-disable no-bitwise */
    bytes[bytes.length - 1] ^= 0x01; // инвертируем один бит последнего байта
    /* eslint-enable no-bitwise */
    const tampered = btoa(String.fromCharCode(...bytes));
    await expect(decryptText(tampered, PASSWORD))
      .rejects.toThrow('Неверный пароль или повреждённые данные');
  });

  test('повреждённая (не-base64) строка отклоняется ошибкой', async () => {
    await expect(decryptText('это не шифротекст!!!', PASSWORD))
      .rejects.toThrow('Неверный пароль или повреждённые данные');
  });
});

describe('шифрование файлов', () => {
  const makeFile = (size = 4096) => {
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i += 1) data[i] = i % 256;
    return { data, file: new File([data], 'photo.png', { type: 'image/png' }) };
  };

  test('шифрует и расшифровывает файл с сохранением содержимого и MIME', async () => {
    const { data, file } = makeFile();
    const cipherBlob = await encryptFile(file, PASSWORD);
    expect(cipherBlob.type).toBe('application/octet-stream');
    const blob = await decryptFile(cipherBlob, PASSWORD, file.type);
    expect(blob.type).toBe('image/png');
    const plain = new Uint8Array(await blob.arrayBuffer());
    expect(plain).toEqual(data);
  });

  test('заголовок контейнера: magic CHAO и версия формата', async () => {
    const { file } = makeFile(16);
    const cipherBlob = await encryptFile(file, PASSWORD);
    const raw = new Uint8Array(await cipherBlob.arrayBuffer());
    // 'CHAO'
    expect(Array.from(raw.subarray(0, 4))).toEqual([0x43, 0x48, 0x41, 0x4f]);
    expect(raw[4]).toBe(1); // версия формата
  });

  test('неверный пароль при расшифровке файла отклоняется ошибкой', async () => {
    const { file } = makeFile();
    const cipherBlob = await encryptFile(file, PASSWORD);
    await expect(decryptFile(cipherBlob, 'неверный', file.type))
      .rejects.toThrow('Неверный пароль или повреждённые данные');
  });

  test('данные без заголовка контейнера отклоняются (например, старый формат)', async () => {
    const foreign = new Blob(['U2FsdGVkX1 старый формат'], { type: 'text/plain' });
    await expect(decryptFile(foreign, PASSWORD, 'image/png'))
      .rejects.toThrow('Неверный пароль или повреждённые данные');
  });
});
