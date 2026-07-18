// Модальное окно записи: таймер, живой предпросмотр с камеры
// (для видео), кнопки «Отправить» и «Отмена».

export default class RecorderModal {
  #modal;

  #title;

  #timer;

  #preview;

  #transcript;

  #interval = null;

  #startedAt = 0;

  constructor(root, { onConfirm, onCancel }) {
    this.#modal = root.querySelector('[data-recorder]');
    this.#title = root.querySelector('[data-recorder-title]');
    this.#timer = root.querySelector('[data-recorder-timer]');
    this.#preview = root.querySelector('[data-recorder-preview]');
    this.#transcript = root.querySelector('[data-recorder-transcript]');

    root.querySelector('[data-recorder-confirm]').addEventListener('click', () => onConfirm());
    root.querySelector('[data-recorder-cancel]').addEventListener('click', () => onCancel());
  }

  open(kind, stream) {
    this.#title.textContent = kind === 'video' ? 'Запись видео' : 'Запись аудио';
    if (kind === 'video') {
      this.#preview.srcObject = stream;
      this.#preview.hidden = false;
    }
    this.#modal.hidden = false;
    this.#startedAt = Date.now();
    this.#tick();
    this.#interval = setInterval(() => this.#tick(), 500);
  }

  // Живая стенограмма: появляется, как только распознались первые слова,
  // и обновляется по мере речи (включая промежуточные результаты).
  setTranscript(text) {
    if (!text) return;
    this.#transcript.textContent = text;
    this.#transcript.hidden = false;
    this.#transcript.scrollTop = this.#transcript.scrollHeight;
  }

  close() {
    this.#modal.hidden = true;
    clearInterval(this.#interval);
    this.#preview.srcObject = null;
    this.#preview.hidden = true;
    this.#transcript.hidden = true;
    this.#transcript.textContent = '';
    this.#timer.textContent = '00:00';
  }

  #tick() {
    const seconds = Math.floor((Date.now() - this.#startedAt) / 1000);
    const pad = (value) => String(value).padStart(2, '0');
    this.#timer.textContent = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
  }
}
