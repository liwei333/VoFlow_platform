import { VOICE_CONSENT_USAGE_SCOPES } from "@/lib/voice-clone/constants";
import type { SerializedVoice } from "@/lib/tts/serializer";

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

export function groupVoicesByType(voices: SerializedVoice[]) {
  return {
    preset: voices.filter((voice) => voice.voiceType === "preset"),
    cloned: voices.filter((voice) => voice.voiceType === "cloned"),
  };
}

export function getVoiceStatusLabel(status: string) {
  if (status === "active") {
    return "可用";
  }
  if (status === "disabled") {
    return "已停用";
  }

  return status;
}

export function getVoiceLicenseLabel(licenseStatus: string) {
  if (licenseStatus === "approved") {
    return "授权通过";
  }
  if (licenseStatus === "pending") {
    return "授权待确认";
  }
  if (licenseStatus === "rejected") {
    return "授权拒绝";
  }
  if (licenseStatus === "expired") {
    return "授权过期";
  }

  return licenseStatus;
}

export function getVoiceCloneTrainingStatusLabel(status?: string | null) {
  if (!status) {
    return "未开始";
  }

  if (status === "queued") {
    return "排队中";
  }
  if (status === "running") {
    return "训练中";
  }
  if (status === "succeeded") {
    return "已完成";
  }
  if (status === "failed") {
    return "失败";
  }

  return status;
}
