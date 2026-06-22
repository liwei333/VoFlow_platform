"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { SerializedAsset } from "@/lib/assets/serializer";
import type { SerializedAvatar } from "@/lib/avatar/serializer";
import {
  AVATAR_PHOTO_ACCEPT_ATTRIBUTE,
  AVATAR_PHOTO_UPLOAD_HELP_TEXT,
} from "@/lib/avatar/constants";
import {
  AVATAR_CONSENT_USAGE_SCOPE_OPTIONS,
  AvatarConsentUsageScope,
  DEFAULT_AVATAR_CONSENT_TEXT,
  getAvatarLicenseStatusView,
  getAvatarStatusView,
} from "@/lib/avatar/ui";

type ApiResponse<T> = {
  code: string;
  message?: string;
  data?: T;
};

type QualityReason = {
  code: string;
  message: string;
};

type QualityReport = {
  passed: boolean;
  faceCount: number;
  resolution: {
    width: number;
    height: number;
  };
  blurScore: number;
  yaw: number;
  pitch: number;
  roll: number;
  occlusion: string;
  exposure: string;
  reasons: QualityReason[];
};

type PhotoCheckResult = {
  asset: SerializedAsset;
  qualityReport: QualityReport;
};

function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AvatarsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatars, setAvatars] = useState<SerializedAvatar[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [avatarName, setAvatarName] = useState("");
  const [photoCheckResult, setPhotoCheckResult] = useState<PhotoCheckResult | null>(null);
  const [consentText, setConsentText] = useState(DEFAULT_AVATAR_CONSENT_TEXT);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [usageScope, setUsageScope] = useState<AvatarConsentUsageScope[]>(
    AVATAR_CONSENT_USAGE_SCOPE_OPTIONS.map((option) => option.value)
  );
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingAvatarId, setDeletingAvatarId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");

  const canRunPhotoCheck = Boolean(selectedFile) && !checking;
  const canCreateAvatar =
    Boolean(photoCheckResult?.asset.id) &&
    Boolean(photoCheckResult?.qualityReport.passed) &&
    Boolean(avatarName.trim()) &&
    consentConfirmed &&
    usageScope.length === AVATAR_CONSENT_USAGE_SCOPE_OPTIONS.length &&
    !creating;

  const fetchAvatars = useCallback(async () => {
    setErrorMessage("");

    try {
      const response = await fetch("/api/avatars");
      const body = (await response.json()) as ApiResponse<{ avatars: SerializedAvatar[] }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setAvatars([]);
        setErrorMessage(body.message || "数字人列表加载失败");
        return;
      }

      setAvatars(body.data.avatars);
    } catch (error) {
      console.error("Failed to fetch avatars:", error);
      setAvatars([]);
      setErrorMessage("数字人列表加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvatars();
  }, [fetchAvatars]);

  function handleFileChange(file: File | null) {
    setSelectedFile(file);
    setPhotoCheckResult(null);
    setNoticeMessage("");
    setErrorMessage("");
    if (file) {
      setAvatarName(file.name.replace(/\.[^.]+$/, ""));
    }
  }

  async function runPhotoCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      return;
    }

    setChecking(true);
    setErrorMessage("");
    setNoticeMessage("");

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (avatarName.trim()) {
      formData.append("name", avatarName.trim());
    }

    try {
      const response = await fetch("/api/avatars/photo-check", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as ApiResponse<PhotoCheckResult>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "照片质检失败");
        return;
      }

      setPhotoCheckResult(body.data);
      setNoticeMessage(body.data.qualityReport.passed ? "照片质检通过" : "照片质检未通过");
    } catch (error) {
      console.error("Failed to check avatar photo:", error);
      setErrorMessage("照片质检失败");
    } finally {
      setChecking(false);
    }
  }

  async function createAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photoCheckResult || !canCreateAvatar) {
      return;
    }

    setCreating(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch("/api/avatars", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceAssetId: photoCheckResult.asset.id,
          name: avatarName.trim(),
          consentText,
          usageScope,
        }),
      });
      const body = (await response.json()) as ApiResponse<{ avatar: SerializedAvatar }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "数字人创建失败");
        return;
      }

      setNoticeMessage("数字人创建成功");
      setSelectedFile(null);
      setPhotoCheckResult(null);
      setAvatarName("");
      setConsentConfirmed(false);
      setConsentText(DEFAULT_AVATAR_CONSENT_TEXT);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await fetchAvatars();
    } catch (error) {
      console.error("Failed to create avatar:", error);
      setErrorMessage("数字人创建失败");
    } finally {
      setCreating(false);
    }
  }

  async function deleteAvatar(avatar: SerializedAvatar) {
    const confirmed = window.confirm(`删除数字人「${avatar.name}」？`);
    if (!confirmed) {
      return;
    }

    setDeletingAvatarId(avatar.id);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/avatars/${avatar.id}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as ApiResponse<unknown>;

      if (body.code !== "SUCCESS") {
        setErrorMessage(body.message || "数字人删除失败");
        return;
      }

      setNoticeMessage("数字人已删除");
      await fetchAvatars();
    } catch (error) {
      console.error("Failed to delete avatar:", error);
      setErrorMessage("数字人删除失败");
    } finally {
      setDeletingAvatarId(null);
    }
  }

  function toggleUsageScope(scope: AvatarConsentUsageScope) {
    setUsageScope((current) =>
      current.includes(scope)
        ? current.filter((item) => item !== scope)
        : [...current, scope]
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">我的数字人</h1>
          <div className="mt-2 text-sm text-gray-500">
            上传本人照片，完成照片质检和肖像授权后创建可复用数字人
          </div>
        </div>
        <button
          type="button"
          onClick={fetchAvatars}
          disabled={loading}
          className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          刷新
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}
      {noticeMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {noticeMessage}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-md border border-gray-200 bg-white p-5">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-gray-900">上传本人照片</h2>
            <p className="mt-1 text-sm text-gray-500">{AVATAR_PHOTO_UPLOAD_HELP_TEXT}</p>
          </div>

          <form onSubmit={runPhotoCheck} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">照片文件</span>
              <input
                ref={fileInputRef}
                type="file"
                accept={AVATAR_PHOTO_ACCEPT_ATTRIBUTE}
                onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">数字人名称</span>
              <input
                value={avatarName}
                onChange={(event) => setAvatarName(event.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="本人数字人"
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={!canRunPhotoCheck}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checking ? "质检中" : "照片质检"}
              </button>
            </div>
          </form>

          {photoCheckResult && (
            <div className="mt-5 rounded-md border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">照片质检</h3>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                    photoCheckResult.qualityReport.passed
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-rose-50 text-rose-700 ring-rose-200"
                  }`}
                >
                  {photoCheckResult.qualityReport.passed ? "通过" : "未通过"}
                </span>
              </div>
              <div className="grid gap-3 text-sm text-gray-600 sm:grid-cols-3">
                <div>人脸数量：{photoCheckResult.qualityReport.faceCount}</div>
                <div>
                  分辨率：{photoCheckResult.qualityReport.resolution.width} x{" "}
                  {photoCheckResult.qualityReport.resolution.height}
                </div>
                <div>清晰度：{Math.round(photoCheckResult.qualityReport.blurScore)}</div>
              </div>
              {photoCheckResult.qualityReport.reasons.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-rose-700">
                  {photoCheckResult.qualityReport.reasons.map((reason) => (
                    <li key={reason.code}>{reason.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="rounded-md border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">肖像授权</h2>
          <form onSubmit={createAvatar} className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">授权文本</span>
              <textarea
                value={consentText}
                onChange={(event) => setConsentText(event.target.value)}
                rows={5}
                className="block w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <div className="space-y-2">
              {AVATAR_CONSENT_USAGE_SCOPE_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={usageScope.includes(option.value)}
                    onChange={() => toggleUsageScope(option.value)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  {option.label}
                </label>
              ))}
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={consentConfirmed}
                onChange={(event) => setConsentConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300"
              />
              <span>我已确认肖像授权</span>
            </label>

            <button
              type="submit"
              disabled={!canCreateAvatar}
              className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "创建中" : "创建数字人"}
            </button>
          </form>
        </section>
      </div>

      <section className="rounded-md border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">数字人列表</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3">数字人</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">授权</th>
                <th className="px-5 py-3">创建时间</th>
                <th className="px-5 py-3">删除</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {avatars.map((avatar) => {
                const statusView = getAvatarStatusView(avatar.status);
                const licenseView = getAvatarLicenseStatusView(avatar.licenseStatus);
                return (
                  <tr key={avatar.id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {avatar.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatar.previewUrl}
                            alt={avatar.name}
                            className="h-12 w-9 rounded object-cover ring-1 ring-gray-200"
                          />
                        ) : (
                          <div className="h-12 w-9 rounded bg-gray-100 ring-1 ring-gray-200" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{avatar.name}</div>
                          <div className="mt-1 text-xs text-gray-500">{avatar.sourceAsset.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusView.className}`}>
                        {statusView.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${licenseView.className}`}>
                        {licenseView.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500">{formatDateTime(avatar.createdAt)}</td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => deleteAvatar(avatar)}
                        disabled={deletingAvatarId === avatar.id}
                        className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingAvatarId === avatar.id ? "删除中" : "删除"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && avatars.length === 0 && (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-gray-500" colSpan={5}>
                    暂无数字人
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
