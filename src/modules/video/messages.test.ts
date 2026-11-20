import i18n from '../../i18n';
import {videoErrorMessage, videoModelReason} from './messages';
import {makeVideoOptions} from './testFixtures';

beforeEach(async () => {await i18n.changeLanguage('ru');});
afterEach(async () => {await i18n.changeLanguage('ru');});

it('translates the actual English Craft subscription blocker on a Russian page', () => {
  const message = videoErrorMessage({code: 'CRAFT_SUBSCRIPTION_REQUIRED',
    detail: 'Paid Craft models require a subscription. Use a personal API connection.'}, i18n.t);
  expect(message).toBe('Для платных видеомоделей Craft нужна подписка. Можно подключить свой API в профиле.');
});

it('keeps a named Russian preparation issue and translates it on an English page', async () => {
  const error = {code: 'VIDEO_CHARACTER_NOT_READY', detail: 'Подготовьте внешность: Анна.'};
  expect(videoErrorMessage(error, i18n.t)).toBe(error.detail);
  await i18n.changeLanguage('en');
  expect(videoErrorMessage(error, i18n.t)).toBe('Prepare the appearance of the scene characters.');
});

it('translates model availability reasons instead of displaying provider internals', () => {
  const model = makeVideoOptions().models[0];
  expect(videoModelReason({...model, unavailableReason: 'Provider is not configured.'}, i18n.t))
    .toBe('Этот провайдер пока не подключён в Craft.');
  expect(videoErrorMessage({code: 'VIDEO_NEW_ERROR', detail: 'VIDEO_PROVIDER_RESPONSE_INVALID'}, i18n.t))
    .toBe('Не удалось запустить видео. Проверьте условия и повторите попытку.');
});
