import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {Modal} from 'antd';
import type {GenerationCostEstimate, PersonalApiSettings} from '../../../api/generated/contracts';
import i18n from '../../../i18n';
import {estimateGenerationCost, notifyCreditBalanceUpdated} from '../api/creditApi';
import {fetchPersonalApiSettings, saveGenerationPreference} from '../../personal-api/api/personalApi';
import {confirmGenerationCost, GenerationApproval, GenerationCostPreview, prepareGenerationCost, runApprovedGeneration, runGenerationWithCredits} from './GenerationCostGuard';

jest.mock('../api/creditApi', () => ({estimateGenerationCost: jest.fn(), getGenerationRoutingMode: jest.fn(() => 'manual'), notifyCreditBalanceUpdated: jest.fn()}));
jest.mock('../../personal-api/api/personalApi', () => ({...jest.requireActual('../../personal-api/api/personalApi'), fetchPersonalApiSettings: jest.fn(), saveGenerationPreference: jest.fn()}));
const mockedEstimate = estimateGenerationCost as jest.MockedFunction<typeof estimateGenerationCost>;
const mockedSettings = fetchPersonalApiSettings as jest.MockedFunction<typeof fetchPersonalApiSettings>;
const mockedSave = saveGenerationPreference as jest.MockedFunction<typeof saveGenerationPreference>;
const mockedNotify = notifyCreditBalanceUpdated as jest.MockedFunction<typeof notifyCreditBalanceUpdated>;
const estimate: GenerationCostEstimate = {
  domain: 'character', operation: 'generate', provider: 'gemini', modelKey: 'gemini-image', modelName: 'Gemini Image', currency: 'USD',
  estimatedCost: '0.039', reservationAmount: '0.039', pricingSource: 'google', costIsEstimate: true, availableBalance: '1.00',
  sufficientBalance: true, accountFrozen: false, routingMode: 'manual', routingReason: 'manual-selection', routeCandidates: [],
  generationSource: 'platform', modality: 'image', isFree: false,
};
const settings: PersonalApiSettings = {
  connections: [{id: 'connection', name: 'My Gemini', provider: 'gemini', keyHint: '••••1234', isActive: true, version: 1, createdAt: '', updatedAt: ''}],
  preferences: [{modality: 'image', source: 'personal', routes: [{connectionId: 'connection', modelKey: 'gemini-image'}]},
    {modality: 'text', source: 'personal', routes: []}, {modality: 'music', source: 'platform', routes: []}, {modality: 'sound_effect', source: 'platform', routes: []}],
  providers: [{id: 'gemini', label: 'Google Gemini', modalities: ['image', 'text']}],
  models: [{key: 'gemini-image', label: 'Gemini Image', modality: 'image', providers: ['gemini'], operations: ['generate', 'reference'], isFree: false}],
  hasPaidSubscription: false, storageAvailable: true,
};
const personalEstimate: GenerationCostEstimate = {...estimate, generationSource: 'personal', generationAccessToken: 'signed-approved-route', connectionName: 'My Gemini', estimatedCost: '0', reservationAmount: '0', availableBalance: '0', accountFrozen: true, sufficientBalance: false};

beforeEach(async () => {
  jest.clearAllMocks(); await act(async () => {await i18n.changeLanguage('en');});
  mockedSettings.mockResolvedValue(settings);
  mockedSave.mockImplementation(async (modality, payload) => ({modality, ...payload}));
  mockedEstimate.mockResolvedValue(personalEstimate);
});
afterEach(async () => {
  act(() => Modal.destroyAll());
  await waitFor(() => expect(document.querySelector('.generation-cost-modal')).toBeNull());
  jest.restoreAllMocks();
});

test('personal zero-Craft-cost work requires explicit approval even with a frozen empty wallet', async () => {
  const operation = jest.fn().mockResolvedValue('job');
  const result = runGenerationWithCredits({domain: 'character', modelKey: 'old-platform-model'}, operation);
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(within(dialog).getByRole('button', {name: 'Start generation'})).toBeEnabled());
  expect(operation).not.toHaveBeenCalled();
  expect(within(dialog).queryByText(/The provider charges your account/)).not.toBeInTheDocument();
  expect(within(dialog).getByText('My Gemini')).toBeInTheDocument();
  expect(mockedEstimate).toHaveBeenCalledWith(expect.objectContaining({generationSource: 'personal', modelKey: undefined}));
  fireEvent.click(within(dialog).getByRole('button', {name: 'Start generation'}));
  await expect(result).resolves.toBe('job');
  expect(operation).toHaveBeenCalledWith(personalEstimate);
  expect(mockedNotify).not.toHaveBeenCalled(); expect(mockedSave).not.toHaveBeenCalled();
});

test('image-only credentials cannot approve paid text or incompatible image editing', async () => {
  const decision = jest.fn();
  const view = render(<GenerationApproval intent={{domain: 'text', operation: 'structured'}} onDecision={decision} />);
  await screen.findByText('No compatible personal connection for this operation. Configure one in profile settings.');
  expect(screen.getByRole('button', {name: 'Start generation'})).toBeDisabled();
  expect(mockedEstimate).not.toHaveBeenCalled(); view.unmount();
  render(<GenerationApproval intent={{domain: 'reference', operation: 'edit'}} onDecision={decision} />);
  await screen.findByText('No compatible personal connection for this operation. Configure one in profile settings.');
  expect(screen.getByRole('button', {name: 'Start generation'})).toBeDisabled(); expect(decision).not.toHaveBeenCalled();
});

test('a paid Craft rejection permits switching to personal and saves only the current modality', async () => {
  mockedSettings.mockResolvedValue({...settings, preferences: settings.preferences.map((item) => item.modality === 'image' ? {...item, source: 'platform'} : item)});
  mockedEstimate.mockImplementation(async (request) => {if (request.generationSource === 'platform') throw new Error('Subscription required'); return personalEstimate;});
  const decision = jest.fn();
  render(<GenerationApproval intent={{domain: 'poster'}} onDecision={decision} />);
  await screen.findByText('Subscription required');
  expect(screen.getByRole('button', {name: 'Start generation'})).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', {name: 'My API'}));
  await waitFor(() => expect(screen.getByRole('button', {name: 'Start generation'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button', {name: 'Start generation'}));
  await waitFor(() => expect(decision).toHaveBeenCalledWith(personalEstimate));
  expect(mockedSave).toHaveBeenCalledWith('image', {source: 'personal', routes: settings.preferences[0].routes});
  expect(mockedSave).toHaveBeenCalledTimes(1);
});

test('known-free Craft work ignores wallet restrictions', async () => {
  mockedEstimate.mockResolvedValue({...estimate, isFree: true, accountFrozen: true, sufficientBalance: false});
  await expect(prepareGenerationCost({domain: 'text', generationSource: 'platform'})).resolves.toEqual(expect.objectContaining({isFree: true}));
  await expect(runApprovedGeneration({...estimate, isFree: true}, jest.fn().mockResolvedValue('free'))).resolves.toBe('free');
  expect(mockedNotify).not.toHaveBeenCalled();
});

test('paid platform work still blocks an insufficient wallet', async () => {
  mockedEstimate.mockResolvedValue({...estimate, sufficientBalance: false});
  const errorSpy = jest.spyOn(Modal, 'error').mockReturnValue({destroy: jest.fn(), update: jest.fn()} as never);
  await expect(prepareGenerationCost({domain: 'poster'})).resolves.toBeNull(); expect(errorSpy).toHaveBeenCalled();
});

test('personal preview shows the source rather than suggesting free generation', async () => {
  render(<GenerationCostPreview intent={{domain: 'reference'}} />); await screen.findByText('My API'); expect(screen.queryByText(/0 C/)).not.toBeInTheDocument();
});

test('Craft preview retains three decimal places', async () => {
  mockedEstimate.mockResolvedValue({...estimate, estimatedCost: '0.134502', reservationAmount: '0.134502'});
  render(<GenerationCostPreview intent={{domain: 'reference'}} />); await screen.findByText(/≈ 0[,.]135 C/);
});

test('cancelling the themed source dialog leaves preferences unchanged', async () => {
  const result = confirmGenerationCost({domain: 'character'}); const dialog = await screen.findByRole('dialog');
  expect(dialog.closest('.generation-cost-modal')).not.toBeNull();
  fireEvent.click(within(dialog).getByRole('button', {name: 'Cancel'})); await expect(result).resolves.toBeNull(); expect(mockedSave).not.toHaveBeenCalled();
});
