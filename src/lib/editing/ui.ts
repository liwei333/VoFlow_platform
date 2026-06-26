import type { EditingPipPosition } from "@prisma/client";
import {
  EDITING_PIP_POSITIONS,
  EDITING_RANGE_LIMITS,
} from "@/lib/editing/constants";

export const EDITING_PIP_POSITION_LABELS: Record<EditingPipPosition, string> = {
  top_left: "左上",
  top_right: "右上",
  bottom_left: "左下",
  bottom_right: "右下",
};

export const EDITING_PIP_POSITION_OPTIONS = EDITING_PIP_POSITIONS.map((value) => ({
  value,
  label: EDITING_PIP_POSITION_LABELS[value],
}));

export const EDITING_CONTROL_RANGES = {
  pipSize: EDITING_RANGE_LIMITS.pipSize,
  voiceVolume: EDITING_RANGE_LIMITS.volume,
  bgmVolume: EDITING_RANGE_LIMITS.volume,
  transitionStrength: EDITING_RANGE_LIMITS.transitionStrength,
} as const;

export function getEditingPipPositionLabel(value: string): string {
  return EDITING_PIP_POSITION_LABELS[value as EditingPipPosition] ?? value;
}
