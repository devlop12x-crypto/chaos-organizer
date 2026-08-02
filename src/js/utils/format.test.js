import {
  escapeHtml, linkify, formatDate, formatSize,
} from './format';

describe('escapeHtml', () => {
  test('экранирует опасные символы', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    );
  });

  test('не трогает обычный текст', () => {
    expect(escapeHtml('Привет, мир!')).toBe('Привет, мир!');
  });
});

describe('linkify', () => {
  test('оборачивает http(s)-ссылки в тег <a>', () => {
    const result = linkify('Смотри https://learn.javascript.ru тут');
    expect(result).toContain('<a class="msg__link" href="https://learn.javascript.ru"');
    expect(result).toContain('target="_blank"');
  });

  test('не создаёт ссылок в тексте без URL', () => {
    expect(linkify('просто текст')).toBe('просто текст');
  });

  test('не включает завершающую пунктуацию в ссылку', () => {
    const result = linkify('Ссылка: https://example.com/page.');
    expect(result).toContain('href="https://example.com/page"');
  });
});

describe('formatDate', () => {
  test('форматирует дату как ДД.ММ.ГГГГ ЧЧ:ММ', () => {
    const timestamp = new Date(2026, 6, 15, 9, 5).getTime();
    expect(formatDate(timestamp)).toBe('15.07.2026 09:05');
  });
});

describe('formatSize', () => {
  test('байты', () => {
    expect(formatSize(512)).toBe('512 Б');
  });

  test('килобайты', () => {
    expect(formatSize(2048)).toBe('2.0 КБ');
  });

  test('мегабайты', () => {
    expect(formatSize(5 * 1024 * 1024)).toBe('5.0 МБ');
  });
});
