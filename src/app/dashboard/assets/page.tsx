"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ASSET_TYPE_OPTIONS,
  ASSET_USAGE_SCOPE_OPTIONS,
  AssetType,
  AssetUsageScope,
  DEFAULT_ASSET_CONSENT_TEXT,
  LicenseStatus,
  formatAssetSize,
  getAssetTypeLabel,
  getLicenseStatusView,
} from "@/lib/assets/ui";

type Asset = {
  id: string;
  teamId: string;
  ownerId: string;
  type: AssetType;
  name: string;
  storageUrl: string;
  fileName: string;
  accessUrl: string;
  mimeType: string;
  sizeBytes: string;
  metadata: unknown;
  licenseStatus: LicenseStatus;
  createdAt: string;
  updatedAt: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type AssetListResponse = {
  code: string;
  message?: string;
  data?: {
    assets: Asset[];
    pagination: Pagination;
  };
};

const LICENSE_STATUS_OPTIONS: Array<{ value: LicenseStatus; label: string }> = [
  { value: "pending", label: "待授权" },
  { value: "approved", label: "已授权" },
  { value: "rejected", label: "已拒绝" },
  { value: "expired", label: "已过期" },
];

const PAGE_SIZE = 20;

function getAssetTypeForFile(file: File | null): AssetType {
  if (!file) {
    return "image";
  }

  if (file.type.startsWith("audio/")) {
    return "audio";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  return "image";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AssetsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [typeFilter, setTypeFilter] = useState<AssetType | "">("");
  const [licenseStatusFilter, setLicenseStatusFilter] = useState<LicenseStatus | "">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadType, setUploadType] = useState<AssetType>("image");
  const [uploading, setUploading] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [consentAsset, setConsentAsset] = useState<Asset | null>(null);
  const [selectedUsageScopes, setSelectedUsageScopes] = useState<AssetUsageScope[]>([
    "video_generation",
    "publishing",
  ]);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [submittingConsent, setSubmittingConsent] = useState(false);

  const canSubmitUpload = useMemo(
    () => Boolean(selectedFile) && !uploading,
    [selectedFile, uploading]
  );
  const canSubmitConsent = useMemo(
    () =>
      Boolean(consentAsset) &&
      consentConfirmed &&
      selectedUsageScopes.length > 0 &&
      !submittingConsent,
    [consentAsset, consentConfirmed, selectedUsageScopes.length, submittingConsent]
  );

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: PAGE_SIZE.toString(),
    });

    if (typeFilter) {
      params.set("type", typeFilter);
    }

    if (licenseStatusFilter) {
      params.set("licenseStatus", licenseStatusFilter);
    }

    try {
      const response = await fetch(`/api/assets?${params}`);
      const data = (await response.json()) as AssetListResponse;

      if (data.code !== "SUCCESS" || !data.data) {
        setErrorMessage(data.message || "素材加载失败");
        return;
      }

      setAssets(data.data.assets);
      setPagination(data.data.pagination);
    } catch (error) {
      console.error("Failed to fetch assets:", error);
      setErrorMessage("素材加载失败");
    } finally {
      setLoading(false);
    }
  }, [licenseStatusFilter, page, typeFilter]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    setUploadType(getAssetTypeForFile(file));
    setUploadName(file?.name ?? "");
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      return;
    }

    setUploading(true);
    setErrorMessage("");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("type", uploadType);
    if (uploadName.trim()) {
      formData.append("name", uploadName.trim());
    }

    try {
      const response = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (data.code !== "SUCCESS") {
        setErrorMessage(data.message || "素材上传失败");
        return;
      }

      setSelectedFile(null);
      setUploadName("");
      setUploadType("image");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setPage(1);
      await fetchAssets();
    } catch (error) {
      console.error("Failed to upload asset:", error);
      setErrorMessage("素材上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (asset: Asset) => {
    const confirmed = window.confirm(`删除素材「${asset.name}」？`);
    if (!confirmed) {
      return;
    }

    setDeletingAssetId(asset.id);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.code !== "SUCCESS") {
        setErrorMessage(data.message || "删除失败");
        return;
      }

      await fetchAssets();
    } catch (error) {
      console.error("Failed to delete asset:", error);
      setErrorMessage("删除失败");
    } finally {
      setDeletingAssetId(null);
    }
  };

  const openConsentModal = (asset: Asset) => {
    setConsentAsset(asset);
    setSelectedUsageScopes(["video_generation", "publishing"]);
    setConsentConfirmed(false);
    setErrorMessage("");
  };

  const closeConsentModal = () => {
    if (submittingConsent) {
      return;
    }

    setConsentAsset(null);
    setConsentConfirmed(false);
  };

  const toggleUsageScope = (scope: AssetUsageScope) => {
    setSelectedUsageScopes((current) =>
      current.includes(scope)
        ? current.filter((item) => item !== scope)
        : [...current, scope]
    );
  };

  const handleConsentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!consentAsset || !canSubmitConsent) {
      return;
    }

    setSubmittingConsent(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/assets/${consentAsset.id}/consents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          consentText: DEFAULT_ASSET_CONSENT_TEXT,
          usageScope: selectedUsageScopes,
          deviceJson: {
            userAgent: window.navigator.userAgent,
          },
        }),
      });
      const data = await response.json();

      if (data.code !== "SUCCESS") {
        setErrorMessage(data.message || "授权确认失败");
        return;
      }

      setConsentAsset(null);
      setConsentConfirmed(false);
      await fetchAssets();
    } catch (error) {
      console.error("Failed to confirm asset consent:", error);
      setErrorMessage("授权确认失败");
    } finally {
      setSubmittingConsent(false);
    }
  };

  const handleTypeFilterChange = (value: AssetType | "") => {
    setTypeFilter(value);
    setPage(1);
  };

  const handleLicenseStatusFilterChange = (value: LicenseStatus | "") => {
    setLicenseStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">素材库</h2>
          <div className="mt-1 text-sm text-gray-500">
            共 {pagination.total} 个素材
          </div>
        </div>

        <form
          onSubmit={handleUpload}
          className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm xl:grid-cols-[minmax(220px,1fr)_160px_minmax(180px,240px)_96px] xl:items-end"
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">文件</span>
            <input
              ref={fileInputRef}
              type="file"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-gray-800"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">类型</span>
            <select
              value={uploadType}
              onChange={(event) => setUploadType(event.target.value as AssetType)}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ASSET_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">名称</span>
            <input
              type="text"
              value={uploadName}
              onChange={(event) => setUploadName(event.target.value)}
              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="素材名称"
            />
          </label>

          <button
            type="submit"
            disabled={!canSubmitUpload}
            className="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {uploading ? "上传中" : "上传"}
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="block">
            <span className="sr-only">素材类型</span>
            <select
              value={typeFilter}
              onChange={(event) => handleTypeFilterChange(event.target.value as AssetType | "")}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-44"
            >
              <option value="">全部类型</option>
              {ASSET_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="sr-only">授权状态</span>
            <select
              value={licenseStatusFilter}
              onChange={(event) =>
                handleLicenseStatusFilterChange(event.target.value as LicenseStatus | "")
              }
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-44"
            >
              <option value="">全部状态</option>
              {LICENSE_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={fetchAssets}
          className="h-10 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          刷新
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-[34%] px-4 py-3 text-left font-medium text-gray-600">
                  素材
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">类型</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">授权</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">大小</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">上传时间</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    加载中
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    暂无素材
                  </td>
                </tr>
              ) : (
                assets.map((asset) => {
                  const statusView = getLicenseStatusView(asset.licenseStatus);
                  return (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {asset.type === "image" && asset.accessUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={asset.accessUrl}
                              alt=""
                              className="h-12 w-12 flex-none rounded-md border border-gray-200 object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-xs font-medium text-gray-500">
                              {getAssetTypeLabel(asset.type)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate font-medium text-gray-900">{asset.name}</div>
                            <div className="truncate text-xs text-gray-500">{asset.fileName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                        {getAssetTypeLabel(asset.type)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusView.className}`}
                        >
                          {statusView.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                        {formatAssetSize(asset.sizeBytes)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                        {formatDateTime(asset.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {asset.licenseStatus !== "approved" && (
                            <button
                              type="button"
                              onClick={() => openConsentModal(asset)}
                              className="rounded-md px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
                            >
                              授权
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(asset)}
                            disabled={deletingAssetId === asset.id}
                            className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-400"
                          >
                            {deletingAssetId === asset.id ? "删除中" : "删除"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <div className="text-sm text-gray-500">
            第 {pagination.page} / {Math.max(pagination.totalPages, 1)} 页
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={pagination.totalPages === 0 || page >= pagination.totalPages}
              onClick={() =>
                setPage((current) => Math.min(current + 1, pagination.totalPages))
              }
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {consentAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">授权确认</h3>
              <div className="mt-1 truncate text-sm text-gray-500">{consentAsset.name}</div>
            </div>

            <form onSubmit={handleConsentSubmit} className="space-y-5 px-5 py-4">
              <div>
                <div className="mb-2 text-sm font-medium text-gray-700">授权文本</div>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm leading-6 text-gray-700">
                  {DEFAULT_ASSET_CONSENT_TEXT}
                </div>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-gray-700">用途范围</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {ASSET_USAGE_SCOPE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsageScopes.includes(option.value)}
                        onChange={() => toggleUsageScope(option.value)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex items-start gap-3 rounded-md border border-gray-200 px-3 py-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={consentConfirmed}
                  onChange={(event) => setConsentConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>我已阅读并确认上述授权文本</span>
              </label>

              <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={closeConsentModal}
                  disabled={submittingConsent}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!canSubmitConsent}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {submittingConsent ? "提交中" : "确认授权"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
