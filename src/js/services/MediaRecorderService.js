// Запись аудио и видео браузерными API: getUserMedia + MediaRecorder.
// Возвращает Blob записи, который затем загружается на сервер как файл.

export default class MediaRecorderService {
  #recorder = null;

  #stream = null;

  #chunks = [];

  static isSupported() {
    return Boolean(navigator.mediaDevices && window.MediaRecorder);
  }

  async start(kind) {
    const constraints = kind === 'video'
      ? { audio: true, video: { width: { ideal: 1280 } } }
      : { audio: true };
    this.#stream = await navigator.mediaDevices.getUserMedia(constraints);

    const mimeType = MediaRecorderService.#pickMimeType(kind);
    this.#recorder = new MediaRecorder(this.#stream, mimeType ? { mimeType } : undefined);
    this.#chunks = [];
    this.#recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) this.#chunks.push(event.data);
    });
    this.#recorder.start();
    return this.#stream;
  }

  stop() {
    return new Promise((resolve) => {
      this.#recorder.addEventListener('stop', () => {
        const type = this.#recorder.mimeType || 'audio/webm';
        const blob = new Blob(this.#chunks, { type });
        this.#cleanup();
        resolve(blob);
      }, { once: true });
      this.#recorder.stop();
    });
  }

  cancel() {
    if (this.#recorder && this.#recorder.state !== 'inactive') {
      this.#recorder.addEventListener('stop', () => this.#cleanup(), { once: true });
      this.#recorder.stop();
    } else {
      this.#cleanup();
    }
  }

  #cleanup() {
    if (this.#stream) this.#stream.getTracks().forEach((track) => track.stop());
    this.#stream = null;
    this.#recorder = null;
    this.#chunks = [];
  }

  static #pickMimeType(kind) {
    const candidates = kind === 'video'
      ? ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  }
}
