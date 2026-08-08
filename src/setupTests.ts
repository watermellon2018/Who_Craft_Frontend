// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
// Initialize i18n once for the whole test run so components that call
// useTranslation render real strings instead of bare keys.
import i18n from './i18n';
// Force Russian locale in tests so existing assertions ("Показать ещё",
// "Создать персонажа", etc.) keep matching. LanguageDetector would otherwise
// pick `navigator.language`, which in jsdom is "en-US".
beforeAll(() => {
  i18n.changeLanguage('ru');
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});
