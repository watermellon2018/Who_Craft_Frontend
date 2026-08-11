import {audioEditDuration} from './audioEditModel';
import type {AudioEditDocument, AudioEditSegment} from './audioEditModel';

interface AudioBufferLike {
  getChannelData: (channel: number) => Float32Array;
  length: number;
  numberOfChannels: number;
  sampleRate: number;
}

interface WebkitAudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
  webkitOfflineAudioContext?: typeof OfflineAudioContext;
}

export interface RenderedAudioEdit {
  durationSeconds: number;
  file: File;
}

const WAV_HEADER_BYTES = 44;
const PCM_BYTES_PER_SAMPLE = 2;

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

export function encodeAudioBufferAsWav(buffer: AudioBufferLike): ArrayBuffer {
  const channels = Math.max(1, buffer.numberOfChannels);
  const dataBytes = buffer.length * channels * PCM_BYTES_PER_SAMPLE;
  const encoded = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(encoded);
  const blockAlign = channels * PCM_BYTES_PER_SAMPLE;

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, encoded.byteLength - 8, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, PCM_BYTES_PER_SAMPLE * 8, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  const channelData = Array.from(
    {length: channels},
    (_, channel) => buffer.getChannelData(channel),
  );
  let offset = WAV_HEADER_BYTES;
  for (let frame = 0; frame < buffer.length; frame += 1) {
    for (const samples of channelData) {
      const sample = Math.min(1, Math.max(-1, samples[frame] ?? 0));
      view.setInt16(
        offset,
        sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff),
        true,
      );
      offset += PCM_BYTES_PER_SAMPLE;
    }
  }

  return encoded;
}

export function editedAudioFileName(sourceName: string): string {
  const extensionIndex = sourceName.lastIndexOf('.');
  const baseName = extensionIndex > 0 ? sourceName.slice(0, extensionIndex) : sourceName;
  return `${baseName.replace(/-edited$/i, '')}-edited.wav`;
}

function segmentGainAt(segment: AudioEditSegment, offsetSeconds: number): number {
  const duration = Math.max(0, segment.sourceEndSeconds - segment.sourceStartSeconds);
  const fadeIn = segment.fadeInSeconds > 0
    ? Math.min(1, Math.max(0,
      (offsetSeconds + (segment.fadeInOffsetSeconds ?? 0)) / segment.fadeInSeconds,
    ))
    : 1;
  const fadeOut = segment.fadeOutSeconds > 0
    ? Math.min(1, Math.max(0,
      (duration - offsetSeconds + (segment.fadeOutOffsetSeconds ?? 0))
        / segment.fadeOutSeconds,
    ))
    : 1;
  return Math.min(1, Math.max(0, segment.gain * Math.min(fadeIn, fadeOut)));
}

function gainCurve(segment: AudioEditSegment, duration: number): Float32Array {
  const sampleCount = Math.max(2, Math.min(4096, Math.ceil(duration * 100)));
  return Float32Array.from(
    {length: sampleCount},
    (_, index) => segmentGainAt(segment, (index / (sampleCount - 1)) * duration),
  );
}

export async function renderAudioEditFile(
  sourceFile: File,
  document: AudioEditDocument,
  signal?: AbortSignal,
): Promise<RenderedAudioEdit> {
  throwIfAborted(signal);
  if (audioEditDuration(document) <= 0) throw new Error('The edited audio is empty.');

  const audioWindow = window as WebkitAudioWindow;
  const AudioContextClass = window.AudioContext ?? audioWindow.webkitAudioContext;
  const OfflineAudioContextClass = window.OfflineAudioContext
    ?? audioWindow.webkitOfflineAudioContext;
  if (!AudioContextClass || !OfflineAudioContextClass) {
    throw new Error('Web Audio rendering is not supported in this browser.');
  }

  const decoder = new AudioContextClass();
  try {
    const sourceBuffer = await decoder.decodeAudioData(await sourceFile.arrayBuffer());
    throwIfAborted(signal);
    const renderSegments = document.segments.flatMap((segment) => {
      const sourceStart = Math.min(sourceBuffer.duration, Math.max(0, segment.sourceStartSeconds));
      const sourceEnd = Math.min(sourceBuffer.duration, Math.max(sourceStart, segment.sourceEndSeconds));
      return sourceEnd > sourceStart
        ? [{duration: sourceEnd - sourceStart, segment, sourceStart}]
        : [];
    });
    const durationSeconds = renderSegments.reduce((sum, segment) => sum + segment.duration, 0);
    if (durationSeconds <= 0) throw new Error('The edited audio is empty.');

    const channels = Math.max(1, Math.min(2, sourceBuffer.numberOfChannels));
    const frameCount = Math.max(1, Math.ceil(durationSeconds * sourceBuffer.sampleRate));
    const renderer = new OfflineAudioContextClass(channels, frameCount, sourceBuffer.sampleRate);
    let timelineOffset = 0;
    for (const {duration, segment, sourceStart} of renderSegments) {
      const source = renderer.createBufferSource();
      const gain = renderer.createGain();
      source.buffer = sourceBuffer;
      gain.gain.setValueCurveAtTime(gainCurve(segment, duration), timelineOffset, duration);
      source.connect(gain).connect(renderer.destination);
      source.start(timelineOffset, sourceStart, duration);
      timelineOffset += duration;
    }

    const renderedBuffer = await renderer.startRendering();
    throwIfAborted(signal);
    const wav = encodeAudioBufferAsWav(renderedBuffer);
    return {
      durationSeconds: renderedBuffer.length / renderedBuffer.sampleRate,
      file: new File([wav], editedAudioFileName(sourceFile.name), {
        lastModified: Date.now(),
        type: 'audio/wav',
      }),
    };
  } finally {
    await decoder.close();
  }
}
