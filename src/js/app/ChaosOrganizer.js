// Оркестратор — логическое ядро приложения. Связывает REST-клиент,
// WebSocket и UI-компоненты: компоненты друг о друге не знают и общаются
// только через колбэки, которые оркестратор передаёт им при создании.
//
// Поток данных: действия пользователя → REST-запрос → сервер рассылает
// событие по WebSocket → все вкладки (включая текущую) обновляют UI.
// Дедупликация по id в MessagesView исключает дубли.

import { API_URL, WS_URL } from '../config';
import ApiClient from '../api/ApiClient';
import SocketClient from '../api/SocketClient';
import MessagesView from '../ui/MessagesView';
import ComposerView from '../ui/ComposerView';
import PinnedBar from '../ui/PinnedBar';
import Sidebar from '../ui/Sidebar';
import SearchPanel from '../ui/SearchPanel';
import RecorderModal from '../ui/RecorderModal';
import PasswordModal from '../ui/PasswordModal';
import ConfirmModal from '../ui/ConfirmModal';
import DropZone from '../ui/DropZone';
import MediaRecorderService from '../services/MediaRecorderService';
import SpeechRecognitionService from '../services/SpeechRecognitionService';
import getCurrentPosition from '../services/geolocation';
import {
  encryptText, decryptText, encryptFile, decryptFile,
} from '../services/encryption';
import showToast from '../ui/Toast';

const MAX_JUMP_PAGES = 100;
const MAX_FILL_PAGES = 5;
// Команда, к которой клиент прикладывает координаты (настоящая погода).
const WEATHER_COMMAND = /^@chaos:\s*погода\s*$/i;
// Подсказка в окне записи, когда распознавание речи не работает на платформе.
const SPEECH_UNAVAILABLE_NOTE = 'Распознавание речи в этом браузере недоступно — запись отправится без стенограммы';

export default class ChaosOrganizer {
  #root;

  #api = new ApiClient(API_URL);

  #recorder = new MediaRecorderService();

  #speech = new SpeechRecognitionService();

  #socket;

  #messagesView;

  #composer;

  #pinnedBar;

  #sidebar;

  #search;

  #recorderModal;

  #passwordModal;

  #confirmModal;

  #dropZone;

  #status;

  #hasMore = false;

  #loading = false;

  #recording = false;

  #recordKind = 'audio';

  // Пароль шифрования для исходящих сообщений/файлов, пока включён
  // режим шифрования (кнопка-замок в композере). Хранится только в памяти
  // вкладки и никогда не отправляется на сервер.
  #encryptPassword = null;

  constructor(root) {
    this.#root = root;
  }

  init() {
    this.#status = this.#root.querySelector('[data-status]');

    this.#messagesView = new MessagesView(this.#root, {
      onReachTop: () => this.#loadMore(),
      onAction: (action, id) => this.#handleAction(action, id),
      fileUrl: (id) => this.#api.fileUrl(id),
      downloadUrl: (id) => this.#api.downloadUrl(id),
    });

    this.#composer = new ComposerView(this.#root, {
      onSend: (text) => this.#send(text),
      onFiles: (files) => this.#uploadFiles(files),
      onGeo: () => this.#sendGeo(),
      onRecord: (kind) => this.#startRecording(kind),
      onToggleEncrypt: () => this.#toggleEncrypt(),
    });

    this.#passwordModal = new PasswordModal(this.#root);
    this.#confirmModal = new ConfirmModal(this.#root);

    this.#pinnedBar = new PinnedBar(this.#root, {
      onJump: (id) => this.#jumpTo(id),
      onUnpin: (id) => this.#handleAction('pin', id),
    });

    this.#sidebar = new Sidebar(this.#root, {
      onTab: (tab) => this.#loadSidebar(tab),
      onJump: (id) => {
        this.#sidebar.close();
        this.#jumpTo(id);
      },
    });

    this.#search = new SearchPanel(this.#root, {
      onQuery: (query) => this.#runSearch(query),
      onPick: (id) => this.#jumpTo(id),
    });

    this.#recorderModal = new RecorderModal(this.#root, {
      onConfirm: () => this.#finishRecording(),
      onCancel: () => this.#cancelRecording(),
    });

    this.#dropZone = new DropZone(this.#root, (files) => this.#uploadFiles(files));

    this.#socket = new SocketClient(WS_URL, {
      onOpen: () => {
        this.#setOnline(true);
        this.#syncMissed();
      },
      onClose: () => this.#setOnline(false),
      onEvent: (event, payload) => this.#handleSocketEvent(event, payload),
    });

    this.#socket.connect();
    this.#loadInitial();
  }

  // ----- История и ленивая подгрузка -----

  async #loadInitial() {
    try {
      const { messages, hasMore } = await this.#api.getMessages();
      this.#hasMore = hasMore;
      this.#messagesView.setInitial(messages);
      await this.#fillViewport();

      const { message } = await this.#api.getPinned();
      this.#applyPin(message);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async #loadMore() {
    if (this.#loading || !this.#hasMore) return;
    this.#loading = true;
    try {
      const { messages, hasMore } = await this.#api.getMessages({
        before: this.#messagesView.firstId(),
      });
      this.#hasMore = hasMore;
      this.#messagesView.prepend(messages);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      this.#loading = false;
    }
  }

  // Если первая страница короче высоты окна, скролла не возникает —
  // догружаем историю, пока лента не станет прокручиваемой.
  async #fillViewport() {
    let attempts = 0;
    while (this.#hasMore && !this.#messagesView.isScrollable() && attempts < MAX_FILL_PAGES) {
      attempts += 1;
      await this.#loadMore();
    }
    this.#messagesView.scrollToBottom();
  }

  // После переподключения WebSocket догружаем пропущенные сообщения.
  async #syncMissed() {
    const lastId = this.#messagesView.lastId();
    if (!lastId) return;
    try {
      const { messages } = await this.#api.getMessagesAfter(lastId);
      messages.forEach((message) => this.#messagesView.append(message));
    } catch {
      // сервер ещё недоступен — новые сообщения придут по WebSocket
    }
  }

  // ----- События WebSocket (синхронизация вкладок) -----

  #handleSocketEvent(event, payload) {
    if (event === 'message') {
      this.#messagesView.append(payload);
      if (this.#sidebar.isOpen && payload.file) this.#loadSidebar(this.#sidebar.activeTab);
    }
    if (event === 'typing') this.#messagesView.showTyping();
    if (event === 'pin') this.#applyPin(payload);
    if (event === 'favorite') {
      this.#messagesView.setFavorite(payload.id, payload.favorite);
      if (this.#sidebar.isOpen && this.#sidebar.activeTab === 'favorites') {
        this.#loadSidebar('favorites');
      }
    }
    if (event === 'delete') {
      this.#messagesView.remove(payload.id);
      if (this.#sidebar.isOpen) this.#loadSidebar(this.#sidebar.activeTab);
    }
  }

  #applyPin(message) {
    this.#pinnedBar.set(message);
    this.#messagesView.setPinnedId(message ? message.id : null);
  }

  #setOnline(online) {
    this.#status.textContent = online ? 'в сети' : 'переподключение…';
    this.#status.classList.toggle('is-online', online);
    this.#status.classList.toggle('is-offline', !online);
  }

  // ----- Отправка контента -----

  async #send(text) {
    try {
      let payload = { text };
      if (this.#encryptPassword) {
        payload = { text: encryptText(text, this.#encryptPassword), encrypted: true };
      } else if (WEATHER_COMMAND.test(text)) {
        // Для настоящего прогноза боту нужны координаты пользователя —
        // запрашиваем геолокацию и прикладываем к команде. Если доступ
        // не дали, отправляем без координат: бот подскажет это в ответе.
        try {
          payload.botGeo = await getCurrentPosition();
        } catch {
          // пользователь не разрешил геолокацию — бот объяснит сам
        }
      }
      const { message } = await this.#api.createMessage(payload);
      this.#messagesView.append(message);
      this.#messagesView.scrollToBottom();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  // Если включено шифрование, каждый файл шифруется целиком на клиенте
  // и загружается как непрозрачный блоб; исходные имя/MIME передаются
  // отдельными открытыми полями — только для отображения и категоризации.
  // sharedExtra — дополнительные поля формы (например, стенограмма
  // голосового); при шифровании они сознательно отбрасываются.
  async #uploadFiles(files, sharedExtra = {}) {
    for (const file of files) {
      try {
        let payload = file;
        let extra = { ...sharedExtra };
        if (this.#encryptPassword) {
          const cipherBlob = await encryptFile(file, this.#encryptPassword);
          payload = new File([cipherBlob], `${file.name}.enc`, { type: 'text/plain' });
          extra = {
            encrypted: 'true',
            originalName: file.name,
            originalMimeType: file.type || 'application/octet-stream',
          };
        }
        const { message } = await this.#api.uploadFile(payload, extra);
        this.#messagesView.append(message);
        this.#messagesView.scrollToBottom();
      } catch (error) {
        showToast(`${file.name}: ${error.message}`, 'error');
      }
    }
  }

  async #sendGeo() {
    try {
      const geo = await getCurrentPosition();
      const { message } = await this.#api.createMessage({ geo });
      this.#messagesView.append(message);
      this.#messagesView.scrollToBottom();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  // ----- Действия над сообщениями: закрепить, избранное, удалить -----

  async #handleAction(action, id) {
    try {
      if (action === 'favorite') {
        const result = await this.#api.toggleFavorite(id);
        this.#messagesView.setFavorite(result.id, result.favorite);
      }
      if (action === 'pin') {
        if (this.#pinnedBar.currentId === id) {
          await this.#api.unpin(id);
          this.#applyPin(null);
        } else {
          const { message } = await this.#api.pin(id);
          this.#applyPin(message);
        }
      }
      if (action === 'delete') await this.#deleteMessage(id);
      if (action === 'reveal') await this.#revealText(id);
      if (action === 'decrypt-file') await this.#revealFile(id);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  // Удаление необратимо (данные стираются и на сервере), поэтому
  // спрашиваем подтверждение. Остальные вкладки узнают по WebSocket.
  async #deleteMessage(id) {
    const confirmed = await this.#confirmModal.ask('Удалить сообщение? Это действие необратимо.');
    if (!confirmed) return;
    await this.#api.deleteMessage(id);
    this.#messagesView.remove(id);
    if (this.#pinnedBar.currentId === id) this.#applyPin(null);
  }

  // ----- Шифрование: переключатель, расшифровка текста и файлов -----

  async #toggleEncrypt() {
    if (this.#encryptPassword) {
      this.#encryptPassword = null;
      this.#composer.setEncrypted(false);
      showToast('Шифрование отключено');
      return;
    }
    const password = await this.#passwordModal.ask('Пароль для шифрования сообщений');
    if (!password) return;
    this.#encryptPassword = password;
    this.#composer.setEncrypted(true);
    showToast('Шифрование включено — все сообщения и файлы теперь шифруются');
  }

  async #revealText(id) {
    const cipherText = this.#messagesView.getCipherText(id);
    if (!cipherText) return;
    const password = await this.#passwordModal.ask('Введите пароль для расшифровки');
    if (!password) return;
    const text = decryptText(cipherText, password);
    this.#messagesView.revealText(id, text);
  }

  async #revealFile(id) {
    const meta = this.#messagesView.getEncryptedFileMeta(id);
    if (!meta) return;
    const password = await this.#passwordModal.ask('Введите пароль для расшифровки');
    if (!password) return;
    const response = await fetch(this.#api.fileUrl(id));
    if (!response.ok) throw new Error('Не удалось загрузить зашифрованный файл');
    const cipherBlob = await response.blob();
    const blob = await decryptFile(cipherBlob, password, meta.mimeType);
    const blobUrl = URL.createObjectURL(blob);
    this.#messagesView.revealFile(id, meta.name, blob.size, meta.category, blobUrl);
  }

  // ----- Боковая панель и поиск -----

  async #loadSidebar(tab) {
    this.#sidebar.showLoading();
    try {
      const { messages } = tab === 'favorites'
        ? await this.#api.getFavorites()
        : await this.#api.getCategory(tab);
      this.#sidebar.render(tab, messages, {
        fileUrl: (id) => this.#api.fileUrl(id),
        downloadUrl: (id) => this.#api.downloadUrl(id),
      });
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async #runSearch(query) {
    try {
      const { messages, total } = await this.#api.search(query);
      this.#search.show(messages, query, total);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  // Переход к сообщению (из поиска, избранного или закреплённой плашки):
  // если сообщение ещё не загружено, докручиваем историю страницами.
  async #jumpTo(id) {
    let guard = 0;
    while (!this.#messagesView.has(id) && this.#hasMore && guard < MAX_JUMP_PAGES) {
      guard += 1;
      await this.#loadMore();
    }
    if (!this.#messagesView.scrollToMessage(id)) {
      showToast('Сообщение не найдено в загруженной истории', 'error');
    }
  }

  // ----- Запись аудио и видео -----

  async #startRecording(kind) {
    if (this.#recording) return;
    if (!MediaRecorderService.isSupported()) {
      showToast('Запись не поддерживается этим браузером', 'error');
      return;
    }
    try {
      const stream = await this.#recorder.start(kind);
      this.#recording = true;
      this.#recordKind = kind;
      this.#recorderModal.open(kind, stream);
      // Параллельно с записью распознаём речь (если браузер умеет):
      // живые субтитры в окне записи + стенограмма к отправленному голосовому.
      // Если распознавание недоступно (Android, Opera/Mi без сервиса Google,
      // Firefox) — показываем честную подсказку, запись при этом работает.
      if (SpeechRecognitionService.isSupported()) {
        this.#speech.start(
          (text) => this.#recorderModal.setTranscript(text),
          () => this.#recorderModal.setTranscript(SPEECH_UNAVAILABLE_NOTE),
        );
      } else {
        this.#recorderModal.setTranscript(SPEECH_UNAVAILABLE_NOTE);
      }
    } catch {
      showToast('Не удалось получить доступ к микрофону/камере', 'error');
    }
  }

  async #finishRecording() {
    if (!this.#recording) return;
    this.#recording = false;
    const transcript = this.#speech.stop();
    const blob = await this.#recorder.stop();
    this.#recorderModal.close();

    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const prefix = this.#recordKind === 'video' ? 'video' : 'voice';
    const file = new File([blob], `${prefix}-${stamp}.${extension}`, { type: blob.type });
    // Зашифрованные голосовые уходят БЕЗ стенограммы: открытый текст
    // рядом с шифротекстом выдал бы содержимое зашифрованного аудио.
    const extra = transcript && !this.#encryptPassword ? { transcript } : {};
    await this.#uploadFiles([file], extra);
  }

  #cancelRecording() {
    if (!this.#recording) return;
    this.#recording = false;
    this.#speech.stop();
    this.#recorder.cancel();
    this.#recorderModal.close();
  }
}
