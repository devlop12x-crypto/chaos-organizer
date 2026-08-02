// Шифрование сообщений и файлов — на нативном Web Crypto API
// (crypto.subtle), без единой сторонней библиотеки. Шифрование и
// расшифровка происходят полностью на клиенте: сервер видит только
// непрозрачный шифротекст и никогда не получает ни пароль, ни ключ.
//
// Схема:
//   деривация ключа — PBKDF2-HMAC-SHA256, 600 000 итераций (рекомендация
//       OWASP на 2023+ для PBKDF2-SHA256), случайная 16-байтовая соль.
//       Подбор даже простого пароля упирается в стоимость итераций,
//       а соль исключает rainbow-таблицы и общий ключ у разных паролей;
//   шифр — AES-256-GCM. GCM — это AEAD: помимо конфиденциальности даёт
//       аутентификацию. Подмена хотя бы одного байта шифротекста или
//       неверный пароль гарантированно выявляются при расшифровке
//       (исключение на проверке тэга), а не превращаются в «мусорный»
//       текст, как у схем без проверки целостности;
//   случайность — свежий 12-байтовый IV на каждое сообщение и файл
//       (для GCM повтор IV под одним ключом недопустим — здесь он
//       исключён криптостойким генератором crypto.getRandomValues).
//
// Формат шифротекста сообщения: base64( соль ‖ IV ‖ шифротекст с тэгом ).
// Формат зашифрованного файла — самодостаточный бинарный контейнер:
//   [ magic 'CHAO' (4) | версия (1) | соль (16) | IV (12) | шифротекст ]
// Бинарный контейнер компактнее текстового base64 примерно на 25%,
// что ощутимо на файлах до 20 МБ.
//
// Требование secure context (HTTPS или localhost) у Web Crypto API
// для этого проекта выполняется всегда: GitHub Pages и Render — HTTPS.

const PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const GCM_TAG_BYTES = 16;
// Заголовок файлового контейнера: 'CHAO' + номер версии формата.
const FILE_MAGIC = [0x43, 0x48, 0x41, 0x4f]; // 'CHAO'
const FILE_FORMAT_VERSION = 1;
const FILE_HEADER_LENGTH = FILE_MAGIC.length + 1 + SALT_LENGTH + IV_LENGTH;

// Кэш ключей сессии: деривация PBKDF2 на 600k итераций — это ~секунда
// работы, поэтому для одного пароля ключ вычисляется один раз и дальше
// переиспользуется. На стойкости это не сказывается: соль всё равно
// хранится вместе с каждым шифротекстом (расшифровка самодостаточна),
// а обязательную для GCM уникальность пары (ключ, IV) обеспечивает
// свежий случайный IV при каждом шифровании.
// Значение — { salt, keyPromise }: промис кэшируется, чтобы параллельные
// вызовы с одним паролем не запускали деривацию повторно.
const sessionKeys = new Map();

function deriveKey(password, salt) {
  const materialPromise = crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return materialPromise.then((material) => crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  ));
}

function getSessionEntry(password) {
  let entry = sessionKeys.get(password);
  if (!entry) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    entry = { salt, keyPromise: deriveKey(password, salt) };
    sessionKeys.set(password, entry);
  }
  return entry;
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function encryptBytes(data, password) {
  const { salt, keyPromise } = getSessionEntry(password);
  const key = await keyPromise;
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { salt, iv, cipher: new Uint8Array(cipherBuffer) };
}

async function decryptBytes(salt, iv, cipher, password) {
  // Если пароль уже использовался в этой сессии и соль совпадает —
  // берём готовый ключ, иначе дерируем по соли из самого шифротекста.
  const cached = sessionKeys.get(password);
  const key = cached && bytesEqual(cached.salt, salt)
    ? await cached.keyPromise
    : await deriveKey(password, salt);
  try {
    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return new Uint8Array(plainBuffer);
  } catch {
    // AES-GCM — AEAD: неверный пароль или подмена хотя бы одного байта
    // гарантированно приводят к исключению на проверке тэга целостности.
    throw new Error('Неверный пароль или повреждённые данные');
  }
}

function concatBytes(...arrays) {
  const total = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  arrays.forEach((arr) => {
    result.set(arr, offset);
    offset += arr.length;
  });
  return result;
}

// base64 собирается кусками: String.fromCharCode с распаковкой массива
// целиком упирается в лимит аргументов вызова на больших данных.
function bytesToBase64(bytes) {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptText(text, password) {
  const { salt, iv, cipher } = await encryptBytes(new TextEncoder().encode(text), password);
  return bytesToBase64(concatBytes(salt, iv, cipher));
}

export async function decryptText(cipherText, password) {
  let raw;
  try {
    raw = base64ToBytes(cipherText);
  } catch {
    throw new Error('Неверный пароль или повреждённые данные');
  }
  if (raw.length < SALT_LENGTH + IV_LENGTH + GCM_TAG_BYTES) {
    throw new Error('Неверный пароль или повреждённые данные');
  }
  const salt = raw.subarray(0, SALT_LENGTH);
  const iv = raw.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const cipher = raw.subarray(SALT_LENGTH + IV_LENGTH);
  const plain = await decryptBytes(salt, iv, cipher, password);
  return new TextDecoder().decode(plain);
}

// Файл шифруется целиком как бинарные данные и упаковывается в контейнер
// с заголовком — такой шифротекст загружается через тот же /files endpoint.
export async function encryptFile(file, password) {
  const data = new Uint8Array(await file.arrayBuffer());
  const { salt, iv, cipher } = await encryptBytes(data, password);
  const header = new Uint8Array(FILE_HEADER_LENGTH);
  header.set(FILE_MAGIC, 0);
  header[FILE_MAGIC.length] = FILE_FORMAT_VERSION;
  header.set(salt, FILE_MAGIC.length + 1);
  header.set(iv, FILE_MAGIC.length + 1 + SALT_LENGTH);
  return new Blob([header, cipher], { type: 'application/octet-stream' });
}

export async function decryptFile(cipherBlob, password, mimeType) {
  const raw = new Uint8Array(await cipherBlob.arrayBuffer());
  // Проверка заголовка заодно отсекает шифротексты старого формата
  // (до перехода на Web Crypto): там контейнера не было.
  const hasValidHeader = raw.length >= FILE_HEADER_LENGTH + GCM_TAG_BYTES
    && bytesEqual(raw.subarray(0, FILE_MAGIC.length), Uint8Array.from(FILE_MAGIC))
    && raw[FILE_MAGIC.length] === FILE_FORMAT_VERSION;
  if (!hasValidHeader) {
    throw new Error('Неверный пароль или повреждённые данные');
  }
  const salt = raw.subarray(FILE_MAGIC.length + 1, FILE_MAGIC.length + 1 + SALT_LENGTH);
  const iv = raw.subarray(
    FILE_MAGIC.length + 1 + SALT_LENGTH,
    FILE_HEADER_LENGTH,
  );
  const cipher = raw.subarray(FILE_HEADER_LENGTH);
  const plain = await decryptBytes(salt, iv, cipher, password);
  return new Blob([plain], { type: mimeType || 'application/octet-stream' });
}
