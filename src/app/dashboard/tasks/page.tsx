"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type WorkflowJobStatus = "pending" | "queued" | "running" | "succeeded" | "failed" | "cancelled";
type WorkflowNodeStatus =
  | "pending"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "waiting_approval"
  | "approved"
  | "cancelled";

type WorkflowJobSummary = {
  id: string;
  projectId: string;
  teamId: string;
  ownerId: string;
  status: WorkflowJobStatus;
  currentNode: string | null;
  progress: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type WorkflowNodeDetail = {
  id: string;
  jobId: string;
  nodeType: string;
  status: WorkflowNodeStatus;
  version: number;
  error: { code?: string; message?: string } | null;
  retryable: boolean;
};

type WorkflowJobDetail = WorkflowJobSummary & {
  nodes: WorkflowNodeDetail[];
  artifacts: Array<{
    id: string;
    nodeId: string;
    type: string;
    storageUrl: string;
    createdAt: string;
  }>;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type WorkflowJobListResponse = {
  code: string;
  message?: string;
  data?: {
    jobs: WorkflowJobSummary[];
    pagination: Pagination;
  };
};

type WorkflowJobDetailResponse = {
  code: string;
  message?: string;
  data?: {
    job: WorkflowJobDetail;
  };
};

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: WorkflowJobStatus | ""; label: string }> = [
  { value: "", label: "全部" },
  { value: "pending", label: "待处理" },
  { value: "queued", label: "排队中" },
  { value: "running", label: "执行中" },
  { value: "succeeded", label: "已完成" },
  { value: "failed", label: "失败" },
  { value: "cancelled", label: "已取消" },
];

const NODE_STATUS_LABELS: Record<WorkflowNodeStatus, string> = {
  pending: "待处理",
  queued: "排队中",
  running: "执行中",
  succeeded: "已成功",
  failed: "失败",
  waiting_approval: "待确认",
  approved: "已确认",
  cancelled: "已取消",
};

const JOB_STATUS_LABELS: Record<WorkflowJobStatus, string> = {
  pending: "待处理",
  queued: "排队中",
  running: "执行中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNodeType(value: string) {
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function TasksPage() {
  const [jobs, setJobs] = useState<WorkflowJobSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<WorkflowJobDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState<WorkflowJobStatus | "">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionNodeId, setActionNodeId] = useState<string | null>(null);
  const [actionJobId, setActionJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const activeJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: PAGE_SIZE.toString(),
    });

    if (statusFilter) {
      params.set("status", statusFilter);
    }

    try {
      const response = await fetch(`/api/video-jobs?${params}`);
      const body = (await response.json()) as WorkflowJobListResponse;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "任务加载失败");
        return;
      }

      setJobs(body.data.jobs);
      setPagination(body.data.pagination);
      setSelectedJobId((current) => current ?? body.data?.jobs[0]?.id ?? null);
    } catch (error) {
      console.error("Failed to fetch workflow jobs:", error);
      setErrorMessage("任务加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  const fetchJobDetail = useCallback(async (jobId: string) => {
    setDetailLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/video-jobs/${jobId}`);
      const body = (await response.json()) as WorkflowJobDetailResponse;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "任务详情加载失败");
        return;
      }

      setSelectedJob(body.data.job);
    } catch (error) {
      console.error("Failed to fetch workflow job detail:", error);
      setErrorMessage("任务详情加载失败");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJob(null);
      return;
    }

    fetchJobDetail(selectedJobId);
  }, [fetchJobDetail, selectedJobId]);

  async function runNodeAction(node: WorkflowNodeDetail, action: "retry" | "approve") {
    if (!selectedJobId) {
      return;
    }

    setActionNodeId(node.id);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/video-jobs/${selectedJobId}/nodes/${node.id}/${action}`, {
        method: "POST",
      });
      const body = await response.json();

      if (body.code !== "SUCCESS") {
        setErrorMessage(body.message || "操作失败");
        return;
      }

      await fetchJobs();
      await fetchJobDetail(selectedJobId);
    } catch (error) {
      console.error("Failed to run workflow node action:", error);
      setErrorMessage("操作失败");
    } finally {
      setActionNodeId(null);
    }
  }

  async function cancelSelectedJob() {
    if (!selectedJobId) {
      return;
    }

    const confirmed = window.confirm("取消当前任务？");
    if (!confirmed) {
      return;
    }

    setActionJobId(selectedJobId);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/video-jobs/${selectedJobId}/cancel`, {
        method: "POST",
      });
      const body = await response.json();

      if (body.code !== "SUCCESS") {
        setErrorMessage(body.message || "任务取消失败");
        return;
      }

      await fetchJobs();
      await fetchJobDetail(selectedJobId);
    } catch (error) {
      console.error("Failed to cancel workflow job:", error);
      setErrorMessage("任务取消失败");
    } finally {
      setActionJobId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">视频任务</h1>
          <div className="mt-2 text-sm text-gray-500">共 {pagination.total} 个任务</div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as WorkflowJobStatus | "");
              setPage(1);
              setSelectedJobId(null);
            }}
            className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={fetchJobs}
            className="h-10 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            刷新
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
            任务列表
          </div>

          {loading ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">加载中...</div>
          ) : jobs.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">暂无任务</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJobId(job.id)}
                  className={`block w-full px-4 py-4 text-left hover:bg-gray-50 ${
                    job.id === selectedJobId ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900">
                        {job.id}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {JOB_STATUS_LABELS[job.status]} · {formatDateTime(job.updatedAt)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-700">{job.progress}%</div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gray-900"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                  {job.errorMessage && (
                    <div className="mt-2 truncate text-xs text-red-600">{job.errorMessage}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-500">
            <span>
              第 {pagination.page} / {Math.max(pagination.totalPages, 1)} 页
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                className="rounded-md border border-gray-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={pagination.totalPages === 0 || page >= pagination.totalPages}
                onClick={() => setPage((current) => Math.min(current + 1, pagination.totalPages))}
                className="rounded-md border border-gray-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <div className="text-sm font-medium text-gray-900">
                {activeJob ? activeJob.id : "任务详情"}
              </div>
              {activeJob && (
                <div className="mt-1 text-xs text-gray-500">
                  {JOB_STATUS_LABELS[activeJob.status]} · 当前节点 {activeJob.currentNode || "-"}
                </div>
              )}
            </div>
            {activeJob && !["succeeded", "cancelled"].includes(activeJob.status) && (
              <button
                type="button"
                disabled={actionJobId === activeJob.id}
                onClick={cancelSelectedJob}
                className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                取消
              </button>
            )}
          </div>

          {detailLoading ? (
            <div className="px-5 py-16 text-center text-sm text-gray-500">加载中...</div>
          ) : selectedJob ? (
            <div className="space-y-6 p-5">
              <div className="grid gap-3 md:grid-cols-4">
                <Metric label="进度" value={`${selectedJob.progress}%`} />
                <Metric label="状态" value={JOB_STATUS_LABELS[selectedJob.status]} />
                <Metric label="产物" value={selectedJob.artifacts.length.toString()} />
                <Metric label="更新时间" value={formatDateTime(selectedJob.updatedAt)} />
              </div>

              {selectedJob.errorMessage && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {selectedJob.errorMessage}
                </div>
              )}

              <div className="overflow-hidden rounded-md border border-gray-200">
                <div className="grid grid-cols-[1fr_120px_90px_150px] border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500">
                  <span>节点</span>
                  <span>状态</span>
                  <span>版本</span>
                  <span className="text-right">操作</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {selectedJob.nodes.map((node) => (
                    <div
                      key={node.id}
                      className="grid grid-cols-[1fr_120px_90px_150px] items-center px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-900">
                          {formatNodeType(node.nodeType)}
                        </div>
                        {node.error?.message && (
                          <div className="mt-1 truncate text-xs text-red-600">{node.error.message}</div>
                        )}
                      </div>
                      <span className="text-gray-600">{NODE_STATUS_LABELS[node.status]}</span>
                      <span className="text-gray-600">v{node.version}</span>
                      <div className="flex justify-end gap-2">
                        {node.status === "failed" && node.retryable && (
                          <button
                            type="button"
                            disabled={actionNodeId === node.id}
                            onClick={() => runNodeAction(node, "retry")}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            重试
                          </button>
                        )}
                        {node.status === "waiting_approval" && (
                          <button
                            type="button"
                            disabled={actionNodeId === node.id}
                            onClick={() => runNodeAction(node, "approve")}
                            className="rounded-md border border-gray-900 bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            确认
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-gray-900">产物</div>
                {selectedJob.artifacts.length === 0 ? (
                  <div className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
                    暂无产物
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
                    {selectedJob.artifacts.map((artifact) => (
                      <div key={artifact.id} className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{artifact.type}</div>
                        <div className="mt-1 truncate text-xs text-gray-500">{artifact.storageUrl}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="px-5 py-16 text-center text-sm text-gray-500">暂无任务</div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}
