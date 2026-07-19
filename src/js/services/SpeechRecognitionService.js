// Живое распознавание речи (Web Speech API, нативный браузерный API —
// без сторонних библиотек и ключей). Принципиальное ограничение API:
// SpeechRecognition не принимает готовые аудиофайлы на вход, он слушает
// только микрофон — поэтому расшифровка возможна исключительно «на лету»,
// параллельно с записью голосового сообщения.
//
// Реальная поддержка (важно!):
// - Настольные Chrome и Edge — работает (распознавание выполняет сервис
//   браузера: бесплатно, без ключей, но нужен интернет).
// - Android — распознавание ОДНОВРЕМЕННО с записью не работает: система
//   отдаёт микрофон MediaRecorder'у монопольно, распознавателю достаётся
//   тишина.
// - Chromium-форки (Opera, Brave, Mi Browser…) — API формально есть, но
//   не работает: путь распознавания в Chromium требует ключей сервиса
//   Google, которые поставляются только с официальным Chrome (ошибка
//   'network').
// - Firefox — API отсутствует.
// Во всех нерабочих случаях сервис сообщает об этом через onUnavailable,
// а голосовое отправляется без стенограммы.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Ошибки, после которых перезапускать распознавание бессмысленно.
const FATAL_ERRORS = ['not-allowed', 'service-not-allowed', 'network', 'audio-capture', 'language-not-supported'];

// Если распознавание несколько раз подряд завершилось, не выдав ни одного
// результата (пользователь при этом говорит — идёт запись голосового!),
// считаем его неработоспособным. Так проявляется Android: ошибок нет,
// но в распознаватель приходит тишина.
const MAX_SILENT_RESTARTS = 2;

export default class SpeechRecognitionService {
  #recognition = null;

  #finalText = '';

  #interimText = '';

  #onUpdate = null;

  #onUnavailable = null;

  #active = false;

  #resultSinceStart = false;

  #silentRestarts = 0;

  static isSupported() {
    return Boolean(Recognition);
  }

  start(onUpdate, onUnavailable) {
    if (!Recognition) return;
    this.#finalText = '';
    this.#interimText = '';
    this.#onUpdate = onUpdate;
    this.#onUnavailable = onUnavailable || null;
    this.#active = true;
    this.#resultSinceStart = false;
    this.#silentRestarts = 0;

    this.#recognition = new Recognition();
    this.#recognition.lang = 'ru-RU';
    this.#recognition.continuous = true;
    this.#recognition.interimResults = true;

    this.#recognition.addEventListener('result', (event) => {
      this.#resultSinceStart = true;
      this.#silentRestarts = 0;
      this.#interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          this.#finalText += `${result[0].transcript} `;
        } else {
          this.#interimText += result[0].transcript;
        }
      }
      if (this.#onUpdate) this.#onUpdate(this.transcript);
    });

    this.#recognition.addEventListener('error', (event) => {
      if (FATAL_ERRORS.includes(event.error)) this.#giveUp();
    });

    // Распознавание самостоятельно останавливается на длинных паузах —
    // пока идёт запись, перезапускаем его. Но не бесконечно: если оно
    // раз за разом завершается без единого результата, значит на этой
    // платформе оно не работает — честно сдаёмся.
    this.#recognition.addEventListener('end', () => {
      if (!this.#active || !this.#recognition) return;
      if (!this.#resultSinceStart) {
        this.#silentRestarts += 1;
        if (this.#silentRestarts >= MAX_SILENT_RESTARTS) {
          this.#giveUp();
          return;
        }
      }
      this.#resultSinceStart = false;
      try {
        this.#recognition.start();
      } catch {
        // уже запущено или остановлено между событиями — игнорируем
      }
    });

    this.#recognition.start();
  }

  // Останавливает распознавание и возвращает итоговую стенограмму.
  stop() {
    this.#active = false;
    if (this.#recognition) {
      try {
        this.#recognition.stop();
      } catch {
        // распознавание могло уже завершиться само — игнорируем
      }
      this.#recognition = null;
    }
    const text = this.transcript;
    this.#finalText = '';
    this.#interimText = '';
    this.#onUpdate = null;
    this.#onUnavailable = null;
    return text;
  }

  // Распознавание неработоспособно: прекращаем попытки и сообщаем наверх,
  // чтобы интерфейс показал честную подсказку вместо молчаливого «ничего».
  #giveUp() {
    if (!this.#active) return;
    this.#active = false;
    if (this.#onUnavailable) this.#onUnavailable();
    this.#onUnavailable = null;
  }

  get transcript() {
    return `${this.#finalText}${this.#interimText}`.replace(/\s+/g, ' ').trim();
  }
}
