// Живое распознавание речи (Web Speech API, нативный браузерный API —
// без сторонних библиотек и ключей). Принципиальное ограничение API:
// SpeechRecognition не принимает готовые аудиофайлы на вход, он слушает
// только микрофон — поэтому расшифровка возможна исключительно «на лету»,
// параллельно с записью голосового сообщения.
//
// Поддержка: Chrome/Edge/Safari (в Chrome распознавание выполняет сервис
// браузера — бесплатно, но нужен интернет). В Firefox API недоступен —
// запись в этом случае идёт без стенограммы.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default class SpeechRecognitionService {
  #recognition = null;

  #finalText = '';

  #interimText = '';

  #onUpdate = null;

  #active = false;

  static isSupported() {
    return Boolean(Recognition);
  }

  start(onUpdate) {
    if (!Recognition) return;
    this.#finalText = '';
    this.#interimText = '';
    this.#onUpdate = onUpdate;
    this.#active = true;

    this.#recognition = new Recognition();
    this.#recognition.lang = 'ru-RU';
    this.#recognition.continuous = true;
    this.#recognition.interimResults = true;

    this.#recognition.addEventListener('result', (event) => {
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

    // Распознавание самостоятельно останавливается на длинных паузах —
    // пока идёт запись, перезапускаем его.
    this.#recognition.addEventListener('end', () => {
      if (!this.#active || !this.#recognition) return;
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
      this.#recognition.stop();
      this.#recognition = null;
    }
    const text = this.transcript;
    this.#finalText = '';
    this.#interimText = '';
    this.#onUpdate = null;
    return text;
  }

  get transcript() {
    return `${this.#finalText}${this.#interimText}`.replace(/\s+/g, ' ').trim();
  }
}
