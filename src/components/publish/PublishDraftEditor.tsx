"use client";

import { useMemo, useState } from "react";
import type { SerializedPublishDraft } from "@/lib/publish/serializer";

export type PublishDraftEditorViewModel = SerializedPublishDraft;

export interface PublishDraftFormState {
  title: string;
  description: string;
  tagsText: string;
  topicsText: string;
  coverArtifactId: string;
}

export interface PublishDraftSavePayload {
  title: string;
  description: string;
  tags: string[];
  topics: string[];
  coverArtifactId: string | null;
}

export function PublishDraftEditor({
  drafts,
  savingDraftId,
  onSave,
}: {
  drafts: PublishDraftEditorViewModel[];
  savingDraftId: string | null;
  onSave: (draftId: string, payload: PublishDraftSavePayload) => void;
}) {
  const [activeDraftId, setActiveDraftId] = useState(drafts[0]?.id ?? "");
  const [forms, setForms] = useState<Record<string, PublishDraftFormState>>(() =>
    Object.fromEntries(drafts.map((draft) => [draft.id, createPublishDraftFormState(draft)]))
  );
  const activeDraft = useMemo(
    () => drafts.find((draft) => draft.id === activeDraftId) ?? drafts[0] ?? null,
    [activeDraftId, drafts]
  );
  const activeForm = activeDraft ? forms[activeDraft.id] ?? createPublishDraftFormState(activeDraft) : null;

  if (drafts.length === 0 || !activeDraft || !activeForm) {
    return (
      <section className="rounded-md border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">发布信息编辑</h2>
        <div className="mt-6 rounded-md border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
          暂无发布草稿
        </div>
      </section>
    );
  }

  const titleLength = countCharacters(activeForm.title);
  const tags = parsePublishDelimitedText(activeForm.tagsText);
  const topics = parsePublishDelimitedText(activeForm.topicsText);

  function updateActiveForm(patch: Partial<PublishDraftFormState>) {
    if (!activeDraft) return;

    setForms((current) => ({
      ...current,
      [activeDraft.id]: {
        ...(current[activeDraft.id] ?? createPublishDraftFormState(activeDraft)),
        ...patch,
      },
    }));
  }

  function saveActiveDraft() {
    if (!activeDraft || !activeForm) return;

    onSave(activeDraft.id, {
      title: activeForm.title,
      description: activeForm.description,
      tags,
      topics,
      coverArtifactId: activeForm.coverArtifactId.trim() || null,
    });
  }

  return (
    <section className="rounded-md border border-gray-200 bg-white p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">发布信息编辑</h2>
          <div className="mt-1 text-sm text-gray-500">
            按平台维护标题、标签、描述、话题和封面参数
          </div>
        </div>
        <button
          type="button"
          onClick={saveActiveDraft}
          disabled={savingDraftId === activeDraft.id}
          className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {savingDraftId === activeDraft.id ? "保存中..." : "保存发布信息"}
        </button>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto border-b border-gray-200 pb-2">
        {drafts.map((draft) => {
          const form = forms[draft.id] ?? createPublishDraftFormState(draft);
          const isActive = draft.id === activeDraft.id;
          return (
            <button
              key={draft.id}
              type="button"
              onClick={() => setActiveDraftId(draft.id)}
              className={`min-w-36 rounded-md border px-3 py-2 text-left text-sm ${
                isActive
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <div className="font-medium">{draft.rule.label}</div>
              <div className={`mt-1 text-xs ${isActive ? "text-gray-200" : "text-gray-500"}`}>
                {countCharacters(form.title)} / {draft.rule.title.maxChars} 字
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            标题
            <input
              value={activeForm.title}
              onChange={(event) => updateActiveForm({ title: event.target.value })}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
            <span
              className={`mt-1 block text-xs ${
                titleLength > activeDraft.rule.title.maxChars ? "text-red-600" : "text-gray-500"
              }`}
            >
              标题 {titleLength} / {activeDraft.rule.title.maxChars}
            </span>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            标签
            <input
              value={activeForm.tagsText}
              onChange={(event) => updateActiveForm({ tagsText: event.target.value })}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
            <span
              className={`mt-1 block text-xs ${
                tags.length > activeDraft.rule.tags.maxCount ? "text-red-600" : "text-gray-500"
              }`}
            >
              标签 {tags.length} / {activeDraft.rule.tags.maxCount}
            </span>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            描述
            <textarea
              value={activeForm.description}
              onChange={(event) => updateActiveForm({ description: event.target.value })}
              rows={5}
              className="mt-2 w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            话题
            <input
              value={activeForm.topicsText}
              onChange={(event) => updateActiveForm({ topicsText: event.target.value })}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
            <span className="mt-1 block text-xs text-gray-500">
              当前 {topics.length} 个话题
            </span>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            封面 Artifact ID
            <input
              value={activeForm.coverArtifactId}
              onChange={(event) => updateActiveForm({ coverArtifactId: event.target.value })}
              placeholder="cover artifact id"
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </label>
        </div>

        <aside className="rounded-md border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-semibold text-gray-900">{activeDraft.rule.label} 规则</h3>
          <div className="mt-4 space-y-3">
            <RuleBlock label="标题限制" value={`${activeDraft.rule.title.maxChars} 字`} />
            <RuleBlock label="标签数量" value={`${activeDraft.rule.tags.maxCount} 个`} />
            <RuleBlock
              label="封面比例"
              value={`推荐 ${activeDraft.rule.cover.recommendedAspectRatio}`}
              detail={`允许 ${activeDraft.rule.cover.allowedAspectRatios.join("、")}`}
            />
            <RuleBlock
              label="视频时长"
              value={`${activeDraft.rule.video.minDurationSeconds}-${activeDraft.rule.video.maxDurationSeconds} 秒`}
              detail={`允许 ${activeDraft.rule.video.allowedAspectRatios.join("、")}`}
            />
          </div>
        </aside>
      </div>
    </section>
  );
}

export function createPublishDraftFormState(
  draft: Pick<
    PublishDraftEditorViewModel,
    "title" | "description" | "tags" | "topics" | "coverArtifactId"
  >
): PublishDraftFormState {
  return {
    title: draft.title,
    description: draft.description,
    tagsText: draft.tags.join(", "),
    topicsText: draft.topics.join(", "),
    coverArtifactId: draft.coverArtifactId ?? "",
  };
}

export function parsePublishDelimitedText(value: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const item of value.split(/[,，\n]/)) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    items.push(normalized);
  }

  return items;
}

function countCharacters(value: string): number {
  return Array.from(value.trim()).length;
}

function RuleBlock({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-900">{value}</div>
      {detail && <div className="mt-1 text-xs text-gray-500">{detail}</div>}
    </div>
  );
}
