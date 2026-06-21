import { z } from "zod";
import { TTS_PITCH_RANGE, TTS_SPEED_RANGE } from "@/lib/tts/constants";

export const ttsParamsSchema = z.object({
  speed: z.number().min(TTS_SPEED_RANGE.min).max(TTS_SPEED_RANGE.max).default(TTS_SPEED_RANGE.defaultValue),
  pitch: z.number().min(TTS_PITCH_RANGE.min).max(TTS_PITCH_RANGE.max).default(TTS_PITCH_RANGE.defaultValue),
  pauseJson: z.record(z.unknown()).optional(),
});

export type TtsParams = z.infer<typeof ttsParamsSchema>;
