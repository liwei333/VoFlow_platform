"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LOCAL_MODEL_ENV_EXAMPLES, LocalModelServiceStatus, LocalModelServiceType } from "@/lib/local-model/config";
import {
  formatCheckedAt,
  formatLatency,
  getLocalModelStatusView,
  getLocalModelTypeLabel,
} from "@/lib/local-model/ui";

type LocalModelService = {
  id: string;
  serviceType: LocalModelServiceType;
  name: string;
  baseUrl: string | null;
  modelName: string | null;
  status: LocalModelServiceStatus;
  latencyMs: number | null;
  resource: Record<string, unknown> | null;
  lastError: { errorCode?: string; errorMessage?: string } | null;
  checkedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type LocalModelServicesResponse = {
  code: string;
  message?: string;
  data?: {
    services: LocalModelService[];
  };
};

function serviceCountByStatus(services: LocalModelService[], status: LocalModelServiceStatus) {
  return services.filter((service) => service.status === status).length;
}

function formatResource(resource: Record<string, unknown> | null) {
  if (!resource || Object.keys(resource).length === 0) {
    return "-";
  }

  return Object.entries(resource)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" / ");
}

export default function ModelsPage() {
  const [services, setServices] = useState<LocalModelService[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkingServiceType, setCheckingServiceType] = useState<LocalModelServiceType | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const statusSummary = useMemo(
    () => ({
      total: services.length,
      online: serviceCountByStatus(services, "online"),
      offline: serviceCountByStatus(services, "offline"),
      busy: serviceCountByStatus(services, "busy"),
      misconfigured: serviceCountByStatus(services, "misconfigured"),
    }),
    [services]
  );

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/local-model-services");
      const body = (await response.json()) as LocalModelServicesResponse;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "本地模型状态加载失败");
        return;
      }

      setServices(body.data.services);
    } catch (error) {
      console.error("Failed to fetch local model services:", error);
      setErrorMessage("本地模型状态加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  async function checkService(serviceType: LocalModelServiceType) {
    setCheckingServiceType(serviceType);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/local-model-services/${serviceType}/health`, {
        method: "POST",
      });
      const body = (await response.json()) as { code: string; message?: string };

      if (body.code !== "SUCCESS") {
        setErrorMessage(body.message || "健康检查失败");
        return;
      }

      await fetchServices();
    } catch (error) {
      console.error("Failed to check local model service:", error);
      setErrorMessage("健康检查失败");
    } finally {
      setCheckingServiceType(null);
    }
  }

  async function checkAllServices() {
    setCheckingAll(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/local-model-services/health-all", {
        method: "POST",
      });
      const body = (await response.json()) as { code: string; message?: string };

      if (body.code !== "SUCCESS") {
        setErrorMessage(body.message || "全部健康检查失败");
        return;
      }

      await fetchServices();
    } catch (error) {
      console.error("Failed to check all local model services:", error);
      setErrorMessage("全部健康检查失败");
    } finally {
      setCheckingAll(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">本地模型</h1>
          <div className="mt-2 text-sm text-gray-500">共 {statusSummary.total} 个服务</div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={fetchServices}
            disabled={loading || checkingAll}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            刷新状态
          </button>
          <button
            type="button"
            onClick={checkAllServices}
            disabled={checkingAll || loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checkingAll ? "检查中..." : "全部检查"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCell label="在线" value={statusSummary.online} className="text-emerald-700" />
        <SummaryCell label="离线" value={statusSummary.offline} className="text-rose-700" />
        <SummaryCell label="繁忙" value={statusSummary.busy} className="text-amber-700" />
        <SummaryCell label="未配置" value={statusSummary.misconfigured} className="text-slate-700" />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">服务状态</h2>
        </div>
        {loading ? (
          <div className="rounded-md border border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-500">
            加载中...
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {services.map((service) => (
              <ServiceCard
                key={service.serviceType}
                service={service}
                checking={checkingServiceType === service.serviceType}
                onCheck={() => checkService(service.serviceType)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">环境变量</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {LOCAL_MODEL_ENV_EXAMPLES.map((item) => (
            <div key={item.key} className="rounded-md border border-gray-200 bg-white p-4">
              <div className="text-xs font-medium text-gray-500">{item.key}</div>
              <div className="mt-2 break-all font-mono text-sm text-gray-900">{item.value}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${className}`}>{value}</div>
    </div>
  );
}

function ServiceCard({
  service,
  checking,
  onCheck,
}: {
  service: LocalModelService;
  checking: boolean;
  onCheck: () => void;
}) {
  const statusView = getLocalModelStatusView(service.status);

  return (
    <article className="rounded-md border border-gray-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${statusView.dotClassName}`}></span>
            <h3 className="text-lg font-semibold text-gray-900">
              {getLocalModelTypeLabel(service.serviceType)}
            </h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusView.className}`}>
              {statusView.label}
            </span>
          </div>
          <div className="mt-1 text-sm text-gray-500">{service.name}</div>
        </div>
        <button
          type="button"
          onClick={onCheck}
          disabled={checking}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {checking ? "检查中..." : "检查"}
        </button>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <InfoTerm label="服务地址" value={service.baseUrl || "-"} />
        <InfoTerm label="模型名称" value={service.modelName || "-"} />
        <InfoTerm label="延迟" value={formatLatency(service.latencyMs)} />
        <InfoTerm label="最近检查" value={formatCheckedAt(service.checkedAt)} />
        <InfoTerm label="资源占用" value={formatResource(service.resource)} wide />
        <InfoTerm label="最近错误" value={service.lastError?.errorMessage || "-"} wide tone="error" />
      </dl>
    </article>
  );
}

function InfoTerm({
  label,
  value,
  wide = false,
  tone = "default",
}: {
  label: string;
  value: string;
  wide?: boolean;
  tone?: "default" | "error";
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd
        className={`mt-1 break-words text-sm ${
          tone === "error" && value !== "-" ? "text-rose-700" : "text-gray-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
