import type {
  FinalVideoValidationResult,
  FfprobeResult,
} from "@/lib/export/media-validation";
import { validateFinalVideoProbe } from "@/lib/export/media-validation";
import { inspectMediaWithConfiguredFfprobe } from "@/services/exportFfmpegService";

export interface ValidateFinalVideoFileInput {
  filePath: string;
  sizeBytes: number;
  expectedDurationSeconds?: number | null;
}

export interface ValidateFinalVideoFileDependencies {
  inspectMedia(filePath: string): Promise<FfprobeResult>;
}

const defaultValidateFinalVideoFileDependencies: ValidateFinalVideoFileDependencies = {
  inspectMedia: inspectMediaWithConfiguredFfprobe,
};

export async function validateFinalVideoFile(
  input: ValidateFinalVideoFileInput,
  dependencies: Partial<ValidateFinalVideoFileDependencies> = {}
): Promise<FinalVideoValidationResult> {
  const { inspectMedia } = {
    ...defaultValidateFinalVideoFileDependencies,
    ...dependencies,
  };
  const probe = await inspectMedia(input.filePath);

  return validateFinalVideoProbe({
    sizeBytes: input.sizeBytes,
    expectedDurationSeconds: input.expectedDurationSeconds,
    probe,
  });
}
