// WebSocket-клиент: слушает события сервера и автоматически
// переподключается с растущей задержкой. Именно через него приходят
// новые сообщения во все открытые вкладки (синхронизация).

const START_DELAY = 1000;
const MAX_DELAY = 15000;

export default class SocketClient {
  #url;

  #handlers;

  #socket = null;

  #delay = START_DELAY;

  constructor(url, handlers = {}) {
    this.#url = url;
    this.#handlers = handlers;
  }

  connect() {
    this.#socket = new WebSocket(this.#url);

    this.#socket.addEventListener('open', () => {
      this.#delay = START_DELAY;
      if (this.#handlers.onOpen) this.#handlers.onOpen();
    });

    this.#socket.addEventListener('message', (event) => {
      try {
        const { event: name, payload } = JSON.parse(event.data);
        if (this.#handlers.onEvent) this.#handlers.onEvent(name, payload);
      } catch {
        // повреждённое сообщение игнорируем
      }
    });

    this.#socket.addEventListener('close', () => {
      if (this.#handlers.onClose) this.#handlers.onClose();
      setTimeout(() => this.connect(), this.#delay);
      this.#delay = Math.min(this.#delay * 2, MAX_DELAY);
    });
  }
}
