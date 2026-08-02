// REST-клиент серверной части: все запросы проходят через #request
// с единообразной обработкой ошибок (текст ошибки приходит из JSON).

export default class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async #request(path, options = {}) {
    let response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, options);
    } catch {
      throw new Error('Нет соединения с сервером');
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Ошибка сервера: ${response.status}`);
    }
    return response.json();
  }

  getMessages({ before, limit = 10 } = {}) {
    const params = new URLSearchParams({ limit });
    if (before) params.set('before', before);
    return this.#request(`/messages?${params}`);
  }

  getMessagesAfter(after) {
    return this.#request(`/messages?after=${encodeURIComponent(after)}`);
  }

  createMessage(payload) {
    return this.#request('/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  uploadFile(file, extra = {}) {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(extra).forEach(([key, value]) => formData.append(key, value));
    return this.#request('/files', { method: 'POST', body: formData });
  }

  search(query) {
    return this.#request(`/messages/search?q=${encodeURIComponent(query)}`);
  }

  getCategory(category) {
    return this.#request(`/messages/category/${category}`);
  }

  getFavorites() {
    return this.#request('/messages/favorites');
  }

  getPinned() {
    return this.#request('/messages/pinned');
  }

  pin(id) {
    return this.#request(`/messages/${id}/pin`, { method: 'PUT' });
  }

  unpin(id) {
    return this.#request(`/messages/${id}/pin`, { method: 'DELETE' });
  }

  toggleFavorite(id) {
    return this.#request(`/messages/${id}/favorite`, { method: 'PUT' });
  }

  deleteMessage(id) {
    return this.#request(`/messages/${id}`, { method: 'DELETE' });
  }

  fileUrl(id) {
    return `${this.baseUrl}/files/${id}`;
  }

  downloadUrl(id) {
    return `${this.baseUrl}/files/${id}/download`;
  }
}
