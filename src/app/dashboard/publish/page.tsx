"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  PublishDraftEditor,
  type PublishDraftEditorViewModel,
  type PublishDraftSavePayload,
} from "@/components/publish/PublishDraftEditor";
import { PublishCenterPanel } from "@/components/publish/PublishCenterPanel";
import type { SerializedChannelAccount } from "@/lib/publish/channel-account";
import type { SerializedPublish } from "@/lib/publish/publish";
import type { PublishPlatform } from "@/lib/publish/rules";
import type { PublishPlatformValidationResult } from "@/lib/publish/validation";

type ApiResponse<T> = {
  code: string;
  message?: string;
  data?: T;
};

export default function PublishPage() {
  const [jobId, setJobId] = useState("");
  const [drafts, setDrafts] = useState<PublishDraftEditorViewModel[]>([]);
  const [accounts, setAccounts] = useState<SerializedChannelAccount[]>([]);
  const [validationResults, setValidationResults] = useState<
    PublishPlatformValidationResult[]
  >([]);
  const [publishes, setPublishes] = useState<SerializedPublish[]>([]);
  const [scheduleAt, setScheduleAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [exportingMp4, setExportingMp4] = useState(false);
  const [savingDraftId, setSavingDraftId] = useState<string | null>(null);
  const [retryingPublishId, setRetryingPublishId] = useState<string | null>(null);
  const [authorizingPlatform, setAuthorizingPlatform] = useState<PublishPlatform | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const selectedPlatforms = useMemo(
    () => drafts.map((draft) => draft.platform),
    [drafts]
  );

  const loadAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/channel-accounts");
      const body = (await response.json()) as ApiResponse<{
        accounts: SerializedChannelAccount[];
      }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "账号授权状态加载失败");
        return;
      }

      setAccounts(body.data.accounts);
    } catch (error) {
      console.error("Failed to load channel accounts:", error);
      setErrorMessage("账号授权状态加载失败");
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const loadDrafts = useCallback(async (nextJobId: string) => {
    const normalizedJobId = nextJobId.trim();
    if (!normalizedJobId) {
      setErrorMessage("请输入视频任务 ID");
      setDrafts([]);
      setValidationResults([]);
      setPublishes([]);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/video-jobs/${normalizedJobId}/publish-drafts`);
      const body = (await response.json()) as ApiResponse<{
        drafts: PublishDraftEditorViewModel[];
      }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "发布草稿加载失败");
        setDrafts([]);
        return;
      }

      setDrafts(body.data.drafts);
      setValidationResults([]);
      setPublishes([]);
      setNoticeMessage(`已加载 ${body.data.drafts.length} 个平台草稿`);
      await loadAccounts();
    } catch (error) {
      console.error("Failed to load publish drafts:", error);
      setErrorMessage("发布草稿加载失败");
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [loadAccounts]);

  async function handleLoadDrafts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadDrafts(jobId);
  }

  async function handleSaveDraft(draftId: string, payload: PublishDraftSavePayload) {
    setSavingDraftId(draftId);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/publish-drafts/${draftId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as ApiResponse<{
        draft: PublishDraftEditorViewModel;
      }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "发布信息保存失败");
        return;
      }

      setDrafts((current) =>
        current.map((draft) => (draft.id === draftId ? body.data!.draft : draft))
      );
      setNoticeMessage("发布草稿已保存");
    } catch (error) {
      console.error("Failed to save publish draft:", error);
      setErrorMessage("发布信息保存失败");
    } finally {
      setSavingDraftId(null);
    }
  }

  async function handleValidatePublish() {
    const normalizedJobId = jobId.trim();
    if (!normalizedJobId || selectedPlatforms.length === 0) {
      setErrorMessage("请先加载发布草稿");
      return;
    }

    setChecking(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/video-jobs/${normalizedJobId}/publish/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ platforms: selectedPlatforms }),
      });
      const body = (await response.json()) as ApiResponse<{
        results: PublishPlatformValidationResult[];
        summary: {
          canPublish: boolean;
        };
      }>;

      if (body.data?.results) {
        setValidationResults(body.data.results);
      }

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "发布参数检查未通过");
        return;
      }

      setNoticeMessage(
        body.data.summary.canPublish ? "发布参数检查已通过" : "发布参数检查未通过"
      );
      await loadAccounts();
    } catch (error) {
      console.error("Failed to validate publish parameters:", error);
      setErrorMessage("发布参数检查失败");
    } finally {
      setChecking(false);
    }
  }

  async function handleCreatePublishes() {
    const normalizedJobId = jobId.trim();
    if (!normalizedJobId || selectedPlatforms.length === 0) {
      setErrorMessage("请先加载发布草稿");
      return;
    }

    setPublishing(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/video-jobs/${normalizedJobId}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platforms: selectedPlatforms,
          ...(scheduleAt ? { scheduleAt } : {}),
        }),
      });
      const body = (await response.json()) as ApiResponse<{
        publishes: SerializedPublish[];
        summary: {
          published: number;
          failed: number;
          skipped: number;
        };
      }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "一键发布失败");
        return;
      }

      setPublishes(body.data.publishes);
      setNoticeMessage(
        `一键发布完成：成功 ${body.data.summary.published}，失败 ${body.data.summary.failed}，跳过 ${body.data.summary.skipped}`
      );
    } catch (error) {
      console.error("Failed to create publishes:", error);
      setErrorMessage("一键发布失败");
    } finally {
      setPublishing(false);
    }
  }

  async function handleRetryPublish(publishId: string) {
    setRetryingPublishId(publishId);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/publishes/${publishId}/retry`, {
        method: "POST",
      });
      const body = (await response.json()) as ApiResponse<{
        publish: SerializedPublish;
      }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "发布重试失败");
        return;
      }

      setPublishes((current) =>
        current.map((publish) =>
          publish.id === publishId ? body.data!.publish : publish
        )
      );
      setNoticeMessage("发布重试已提交");
    } catch (error) {
      console.error("Failed to retry publish:", error);
      setErrorMessage("发布重试失败");
    } finally {
      setRetryingPublishId(null);
    }
  }

  async function handleAuthorizePlatform(platform: PublishPlatform) {
    setAuthorizingPlatform(platform);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/channel-accounts/${platform}/mock-authorize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const body = (await response.json()) as ApiResponse<{
        account: SerializedChannelAccount;
      }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "渠道授权失败");
        return;
      }

      setAccounts((current) =>
        current.map((account) =>
          account.platform === platform ? body.data!.account : account
        )
      );
      setNoticeMessage("渠道账号已授权");
    } catch (error) {
      console.error("Failed to authorize channel account:", error);
      setErrorMessage("渠道授权失败");
    } finally {
      setAuthorizingPlatform(null);
    }
  }

  async function handleExportMp4Only() {
    const normalizedJobId = jobId.trim();
    if (!normalizedJobId) {
      setErrorMessage("请先输入视频任务 ID");
      return;
    }

    setExportingMp4(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/video-jobs/${normalizedJobId}/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ outputProfile: "mp4_1080p" }),
      });
      const body = (await response.json()) as ApiResponse<{ id: string }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "MP4 导出任务创建失败");
        return;
      }

      setNoticeMessage("MP4 导出任务已创建");
    } catch (error) {
      console.error("Failed to create MP4 export:", error);
      setErrorMessage("MP4 导出任务创建失败");
    } finally {
      setExportingMp4(false);
    }
  }

  function handleSaveDraftsFromCenter() {
    setErrorMessage("");
    setNoticeMessage("请在下方发布信息编辑区保存当前平台草稿");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">发布中心</h1>
          <div className="mt-2 text-sm text-gray-500">
            发布信息编辑、账号授权、参数检查和多平台发布
          </div>
        </div>

        <form onSubmit={handleLoadDrafts} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <label className="min-w-0 text-sm font-medium text-gray-700">
            视频任务 ID
            <input
              value={jobId}
              onChange={(event) => setJobId(event.target.value)}
              placeholder="video job id"
              className="mt-1 h-10 w-full min-w-72 rounded-md border border-gray-300 px-3 text-sm text-gray-900"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-0 h-10 rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-6"
          >
            {loading ? "加载中..." : "加载发布草稿"}
          </button>
        </form>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {noticeMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {noticeMessage}
        </div>
      )}

      <PublishCenterPanel
        accounts={accounts}
        validationResults={validationResults}
        publishes={publishes}
        selectedPlatforms={selectedPlatforms}
        scheduleAt={scheduleAt}
        checking={checking}
        publishing={publishing}
        exportingMp4={exportingMp4}
        retryingPublishId={retryingPublishId}
        authorizingPlatform={authorizingPlatform}
        onScheduleAtChange={setScheduleAt}
        onRefreshAccounts={loadAccounts}
        onAuthorize={handleAuthorizePlatform}
        onValidate={handleValidatePublish}
        onSaveDrafts={handleSaveDraftsFromCenter}
        onExportMp4={handleExportMp4Only}
        onPublish={handleCreatePublishes}
        onRetry={handleRetryPublish}
      />

      <PublishDraftEditor
        drafts={drafts}
        savingDraftId={savingDraftId}
        onSave={handleSaveDraft}
      />
    </div>
  );
}
