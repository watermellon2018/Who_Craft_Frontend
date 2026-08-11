import {editedAudioFileName, encodeAudioBufferAsWav} from './renderAudioEditFile';

test('builds a valid stereo PCM WAV file', () => {
  const encoded = encodeAudioBufferAsWav({
    getChannelData: (channel) => channel === 0
      ? new Float32Array([-1, 0.5])
      : new Float32Array([0, 1]),
    length: 2,
    numberOfChannels: 2,
    sampleRate: 48000,
  });
  const view = new DataView(encoded);
  const text = (offset: number, length: number) => Array.from(
    new Uint8Array(encoded, offset, length),
    (character) => String.fromCharCode(character),
  ).join('');

  expect(text(0, 4)).toBe('RIFF');
  expect(text(8, 4)).toBe('WAVE');
  expect(text(36, 4)).toBe('data');
  expect(view.getUint16(22, true)).toBe(2);
  expect(view.getUint32(24, true)).toBe(48000);
  expect(view.getUint32(40, true)).toBe(8);
  expect(encoded.byteLength).toBe(52);
});

test('uses a stable edited version name', () => {
  expect(editedAudioFileName('opening.mp3')).toBe('opening-edited.wav');
  expect(editedAudioFileName('opening-edited.wav')).toBe('opening-edited.wav');
});
