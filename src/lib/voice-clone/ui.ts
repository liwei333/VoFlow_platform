import { VOICE_CONSENT_USAGE_SCOPES } from "@/lib/voice-clone/constants";

export type VoiceConsentUsageScope = (typeof VOICE_CONSENT_USAGE_SCOPES)[number];

export const VOICE_CONSENT_USAGE_SCOPE_OPTIONS: Array<{
  value: VoiceConsentUsageScope;
  label: string;
}> = [
  { value: "voice_clone", label: "声音克隆训练" },
  { value: "tts_generation", label: "TTS 语音生成" },
];

export const DEFAULT_VOICE_CONSENT_TEXT =
  "我确认上传声音为本人声音或已获得声音权利人合法授权，并同意将该声音用于声音克隆训练和 TTS 语音生成。";
