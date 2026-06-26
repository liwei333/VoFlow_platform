"use client";

import { useMemo, useState } from "react";
import type { EditingPipPosition } from "@prisma/client";
import type { SerializedEditingConfig } from "@/lib/editing/serializer";
import {
  EDITING_CONTROL_RANGES,
  EDITING_PIP_POSITION_OPTIONS,
} from "@/lib/editing/ui";

export type EditingMediaAssetViewModel = {
  id: string;
  name: string;
  type: string;
  licenseStatus: string;
};

export type EditingConfigDraft = {
  subtitleEnabled: boolean;
  keywordHighlightEnabled: boolean;
  bgmDuckingEnabled: boolean;
  pipEnabled: boolean;
  pipAssetId: string | null;
  pipPosition: EditingPipPosition;
  pipSize: number;
  backgroundAssetId: string | null;
  voiceVolume: number;
  bgmVolume: number;
  transitionStrength: number;
};

export function EditingConfigPanel({
  config,
  mediaAssets,
  saving = false,
  previewing = false,
  onSave,
  onPreview,
}: {
  config: SerializedEditingConfig;
  mediaAssets: EditingMediaAssetViewModel[];
  saving?: boolean;
  previewing?: boolean;
  onSave: (draft: EditingConfigDraft) => void;
  onPreview: () => void;
}) {
  const selectableVisualAssets = useMemo(
    () =>
      mediaAssets.filter(
        (asset) =>
          (asset.type === "image" || asset.type === "video") &&
          asset.licenseStatus === "approved"
      ),
    [mediaAssets]
  );
  const keywordHighlight = readKeywordHighlight(config.configJson);
  const [draft, setDraft] = useState<EditingConfigDraft>({
    subtitleEnabled: config.subtitleEnabled,
    keywordHighlightEnabled: config.keywordHighlightEnabled,
    bgmDuckingEnabled: config.bgmDuckingEnabled,
    pipEnabled: config.pipEnabled,
    pipAssetId: config.pipAssetId,
    pipPosition: config.pipPosition as EditingPipPosition,
    pipSize: config.pipSize,
    backgroundAssetId: config.backgroundAssetId,
    voiceVolume: config.voiceVolume,
    bgmVolume: config.bgmVolume,
    transitionStrength: config.transitionStrength,
  });

  function updateDraft(patch: Partial<EditingConfigDraft>) {
    setDraft((current) => ({
      ...current,
      ...patch,
    }));
  }

  return (
    <section className="rounded-md border border-gray-200 bg-white p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">视频剪辑</h2>
          <div className="mt-1 text-sm text-gray-500">
            字幕、画中画、背景、音量和转场配置
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPreview}
            disabled={previewing}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {previewing ? "生成中..." : "生成剪辑预览"}
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={saving}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存剪辑配置"}
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className="space-y-5">
          <fieldset className="rounded-md border border-gray-200 p-4">
            <legend className="px-1 text-sm font-semibold text-gray-900">字幕</legend>
            <div className="grid gap-3 md:grid-cols-3">
              <ToggleControl
                label="字幕"
                checked={draft.subtitleEnabled}
                onChange={(checked) => updateDraft({ subtitleEnabled: checked })}
              />
              <ToggleControl
                label="关键词高亮"
                checked={draft.keywordHighlightEnabled}
                onChange={(checked) => updateDraft({ keywordHighlightEnabled: checked })}
              />
              <ToggleControl
                label="BGM 自动闪避"
                checked={draft.bgmDuckingEnabled}
                onChange={(checked) => updateDraft({ bgmDuckingEnabled: checked })}
              />
            </div>
            {keywordHighlight.keywords.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {keywordHighlight.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="rounded-md border border-gray-200 p-4">
            <legend className="px-1 text-sm font-semibold text-gray-900">画中画</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <ToggleControl
                label="画中画"
                checked={draft.pipEnabled}
                onChange={(checked) => updateDraft({ pipEnabled: checked })}
              />
              <label className="text-sm font-medium text-gray-700">
                画中画素材
                <select
                  value={draft.pipAssetId ?? ""}
                  onChange={(event) =>
                    updateDraft({ pipAssetId: event.target.value || null })
                  }
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                >
                  <option value="">不使用画中画素材</option>
                  {selectableVisualAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">
                画中画位置
                <select
                  value={draft.pipPosition}
                  onChange={(event) =>
                    updateDraft({ pipPosition: event.target.value as EditingPipPosition })
                  }
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                >
                  {EDITING_PIP_POSITION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <RangeControl
                label="画中画大小"
                value={draft.pipSize}
                min={EDITING_CONTROL_RANGES.pipSize.min}
                max={EDITING_CONTROL_RANGES.pipSize.max}
                suffix="%"
                onChange={(pipSize) => updateDraft({ pipSize })}
              />
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-gray-200 p-4">
            <legend className="px-1 text-sm font-semibold text-gray-900">背景和转场</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">
                背景素材
                <select
                  value={draft.backgroundAssetId ?? ""}
                  onChange={(event) =>
                    updateDraft({ backgroundAssetId: event.target.value || null })
                  }
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                >
                  <option value="">不使用背景素材</option>
                  {selectableVisualAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </label>
              <RangeControl
                label="转场强度"
                value={draft.transitionStrength}
                min={EDITING_CONTROL_RANGES.transitionStrength.min}
                max={EDITING_CONTROL_RANGES.transitionStrength.max}
                suffix="%"
                onChange={(transitionStrength) => updateDraft({ transitionStrength })}
              />
            </div>
          </fieldset>
        </div>

        <aside className="rounded-md border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-semibold text-gray-900">音量</h3>
          <div className="mt-4 space-y-4">
            <RangeControl
              label="人声音量"
              value={draft.voiceVolume}
              min={EDITING_CONTROL_RANGES.voiceVolume.min}
              max={EDITING_CONTROL_RANGES.voiceVolume.max}
              suffix="%"
              onChange={(voiceVolume) => updateDraft({ voiceVolume })}
            />
            <RangeControl
              label="BGM 音量"
              value={draft.bgmVolume}
              min={EDITING_CONTROL_RANGES.bgmVolume.min}
              max={EDITING_CONTROL_RANGES.bgmVolume.max}
              suffix="%"
              onChange={(bgmVolume) => updateDraft({ bgmVolume })}
            />
            <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
              <div className="text-xs text-gray-500">预览产物</div>
              <div className="mt-1 font-medium text-gray-900">
                {config.previewArtifact ? "已生成轻量预览" : "暂无预览"}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ToggleControl({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-300"
      />
    </label>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-sm font-medium text-gray-700">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="text-gray-500">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full"
      />
    </label>
  );
}

function readKeywordHighlight(configJson: unknown): { keywords: string[] } {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return { keywords: [] };
  }

  const keywordHighlight = (configJson as { keywordHighlight?: unknown }).keywordHighlight;
  if (
    !keywordHighlight ||
    typeof keywordHighlight !== "object" ||
    Array.isArray(keywordHighlight)
  ) {
    return { keywords: [] };
  }

  const keywords = (keywordHighlight as { keywords?: unknown }).keywords;
  return {
    keywords: Array.isArray(keywords)
      ? keywords.filter((keyword): keyword is string => typeof keyword === "string")
      : [],
  };
}
