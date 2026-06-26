import { EXPORT_AUDIO_MIX_DEFAULTS } from "@/lib/export/constants";

export interface BuildBgmMixFfmpegArgsInput {
  voiceAudioPath: string;
  bgmAudioPath: string;
  outputPath: string;
  durationSeconds: number;
  voiceVolume?: number;
  bgmVolume?: number;
}

export function buildBgmMixFfmpegArgs(
  input: BuildBgmMixFfmpegArgsInput
): string[] {
  const fadeDuration = EXPORT_AUDIO_MIX_DEFAULTS.fadeDurationSeconds;
  const fadeOutStart = Math.max(0, input.durationSeconds - fadeDuration);
  const voiceVolume = normalizeVolume(
    input.voiceVolume ?? EXPORT_AUDIO_MIX_DEFAULTS.voiceVolume
  );
  const bgmVolume = normalizeVolume(
    input.bgmVolume ?? EXPORT_AUDIO_MIX_DEFAULTS.bgmVolume
  );
  const filter = [
    `[0:a]volume=${voiceVolume}[voice]`,
    `[1:a]volume=${bgmVolume},afade=t=in:st=0:d=${formatSeconds(
      fadeDuration
    )},afade=t=out:st=${formatSeconds(fadeOutStart)}:d=${formatSeconds(
      fadeDuration
    )}[bgm]`,
    `[bgm][voice]sidechaincompress=threshold=${EXPORT_AUDIO_MIX_DEFAULTS.duckingThreshold}:ratio=${EXPORT_AUDIO_MIX_DEFAULTS.duckingRatio}:attack=${EXPORT_AUDIO_MIX_DEFAULTS.duckingAttackMs}:release=${EXPORT_AUDIO_MIX_DEFAULTS.duckingReleaseMs}[ducked]`,
    "[voice][ducked]amix=inputs=2:duration=first:dropout_transition=0[mixed]",
  ].join(";");

  return [
    "-y",
    "-i",
    input.voiceAudioPath,
    "-stream_loop",
    "-1",
    "-i",
    input.bgmAudioPath,
    "-filter_complex",
    filter,
    "-map",
    "[mixed]",
    "-t",
    input.durationSeconds.toFixed(3),
    "-c:a",
    "pcm_s16le",
    input.outputPath,
  ];
}

function normalizeVolume(volumePercent: number): string {
  const clamped = Math.min(Math.max(volumePercent, 0), 100);
  return (clamped / 100).toFixed(2);
}

function formatSeconds(value: number): string {
  if (Number.isInteger(value)) {
    return value.toFixed(0);
  }
  return value.toFixed(1);
}
