import { z } from "zod";
import {
  EDITING_PIP_POSITIONS,
  EDITING_RANGE_LIMITS,
} from "@/lib/editing/constants";

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ])
);

export const saveEditingConfigSchema = z
  .object({
    subtitleEnabled: z.boolean().optional(),
    keywordHighlightEnabled: z.boolean().optional(),
    bgmDuckingEnabled: z.boolean().optional(),
    pipEnabled: z.boolean().optional(),
    pipAssetId: z.string().trim().min(1).nullable().optional(),
    pipPosition: z.enum(EDITING_PIP_POSITIONS).optional(),
    pipSize: z
      .number()
      .int()
      .min(EDITING_RANGE_LIMITS.pipSize.min)
      .max(EDITING_RANGE_LIMITS.pipSize.max)
      .optional(),
    backgroundAssetId: z.string().trim().min(1).nullable().optional(),
    voiceVolume: z
      .number()
      .int()
      .min(EDITING_RANGE_LIMITS.volume.min)
      .max(EDITING_RANGE_LIMITS.volume.max)
      .optional(),
    bgmVolume: z
      .number()
      .int()
      .min(EDITING_RANGE_LIMITS.volume.min)
      .max(EDITING_RANGE_LIMITS.volume.max)
      .optional(),
    transitionStrength: z
      .number()
      .int()
      .min(EDITING_RANGE_LIMITS.transitionStrength.min)
      .max(EDITING_RANGE_LIMITS.transitionStrength.max)
      .optional(),
    configJson: jsonValueSchema.nullable().optional(),
  })
  .strict();

export type SaveEditingConfigInput = z.infer<typeof saveEditingConfigSchema>;
