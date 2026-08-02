// Drag & Drop: при перетаскивании файлов поверх чата появляется
// подсвеченная зона, при отпускании файлы уходят на загрузку.
// Счётчик глубины нужен, чтобы зона не мигала при перемещении
// курсора над дочерними элементами.

export default class DropZone {
  #overlay;

  #onFiles;

  #depth = 0;

  constructor(root, onFiles) {
    this.#overlay = root.querySelector('[data-dropzone]');
    this.#onFiles = onFiles;
    this.#bind();
  }

  #bind() {
    document.addEventListener('dragenter', (event) => {
      if (!DropZone.#hasFiles(event)) return;
      event.preventDefault();
      this.#depth += 1;
      this.#overlay.hidden = false;
    });

    document.addEventListener('dragover', (event) => {
      if (DropZone.#hasFiles(event)) event.preventDefault();
    });

    document.addEventListener('dragleave', () => {
      this.#depth = Math.max(0, this.#depth - 1);
      if (this.#depth === 0) this.#overlay.hidden = true;
    });

    document.addEventListener('drop', (event) => {
      if (!DropZone.#hasFiles(event)) return;
      event.preventDefault();
      this.#depth = 0;
      this.#overlay.hidden = true;
      const files = [...event.dataTransfer.files];
      if (files.length) this.#onFiles(files);
    });
  }

  static #hasFiles(event) {
    return Boolean(event.dataTransfer) && [...event.dataTransfer.types].includes('Files');
  }
}
