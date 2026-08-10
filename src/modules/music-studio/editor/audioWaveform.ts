export const DEFAULT_WAVEFORM_BIN_COUNT = 1200;

export interface AudioWaveformPeak {
  max: number;
  min: number;
}

export interface AudioBufferLike {
  duration: number;
  getChannelData: (channel: number) => ArrayLike<number>;
  numberOfChannels: number;
}

export interface AudioWaveformData {
  duration: number;
  peaks: AudioWaveformPeak[];
}

const normaliseDuration = (duration: number) => (
  Number.isFinite(duration) && duration > 0 ? duration : 0
);

const normaliseSample = (sample: number) => {
  if (!Number.isFinite(sample)) return null;
  return Math.max(-1, Math.min(1, sample));
};

/**
 * Reduces decoded PCM channel data to min/max peaks without inventing samples.
 * All channels contribute to each time bin so stereo transients remain visible.
 */
export const downsampleAudioBuffer = (
  audioBuffer: AudioBufferLike,
  targetBinCount = DEFAULT_WAVEFORM_BIN_COUNT,
): AudioWaveformData => {
  const channelCount = Number.isFinite(audioBuffer.numberOfChannels)
    ? Math.max(0, Math.floor(audioBuffer.numberOfChannels))
    : 0;
  const channels: ArrayLike<number>[] = [];

  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    channels.push(audioBuffer.getChannelData(channelIndex));
  }

  const sampleCount = channels.reduce(
    (largestLength, channel) => Math.max(largestLength, channel.length),
    0,
  );
  if (sampleCount === 0) {
    return {duration: normaliseDuration(audioBuffer.duration), peaks: []};
  }

  const requestedBinCount = Number.isFinite(targetBinCount)
    ? Math.max(1, Math.floor(targetBinCount))
    : DEFAULT_WAVEFORM_BIN_COUNT;
  const binCount = Math.min(sampleCount, requestedBinCount);
  const peaks: AudioWaveformPeak[] = [];

  for (let binIndex = 0; binIndex < binCount; binIndex += 1) {
    const sampleStart = Math.floor((binIndex * sampleCount) / binCount);
    const sampleEnd = Math.max(
      sampleStart + 1,
      Math.floor(((binIndex + 1) * sampleCount) / binCount),
    );
    let min = 1;
    let max = -1;
    let containsSample = false;

    for (const channel of channels) {
      const channelEnd = Math.min(sampleEnd, channel.length);
      for (let sampleIndex = sampleStart; sampleIndex < channelEnd; sampleIndex += 1) {
        const sample = normaliseSample(Number(channel[sampleIndex]));
        if (sample === null) continue;

        containsSample = true;
        min = Math.min(min, sample);
        max = Math.max(max, sample);
      }
    }

    peaks.push(containsSample ? {max, min} : {max: 0, min: 0});
  }

  return {
    duration: normaliseDuration(audioBuffer.duration),
    peaks,
  };
};
