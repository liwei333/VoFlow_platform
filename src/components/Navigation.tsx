"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/dashboard", label: "创作工作台", icon: "🎬" },
  { href: "/dashboard/hot-content", label: "爆款提取", icon: "🔥" },
  { href: "/dashboard/scripts", label: "文案库", icon: "📝" },
  { href: "/dashboard/voices", label: "我的声音", icon: "🎤" },
  { href: "/dashboard/avatars", label: "我的数字人", icon: "👤" },
  { href: "/dashboard/tasks", label: "视频任务", icon: "📋" },
  { href: "/dashboard/publish", label: "发布中心", icon: "🚀" },
  { href: "/dashboard/assets", label: "素材库", icon: "📁" },
  { href: "/dashboard/models", label: "本地模型", icon: "🤖" },
  { href: "/dashboard/settings", label: "设置", icon: "⚙️" },
];

interface ModelStatus {
  configured: boolean;
  status: "online" | "offline" | "unknown";
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen">
      <div className="p-4">
        <h1 className="text-xl font-bold">VoFlow</h1>
        <p className="text-sm text-gray-400">智能口播平台</p>
      </div>

      <nav className="mt-6">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-4 py-3 text-sm hover:bg-gray-800 ${
                isActive ? "bg-gray-800 border-l-4 border-blue-500" : ""
              }`}
            >
              <span className="mr-3">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function ModelStatusBadge() {
  const [modelStatus, setModelStatus] = useState<{
    llm: ModelStatus;
    tts: ModelStatus;
    asr: ModelStatus;
    avatar: ModelStatus;
  } | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (data.models) {
          setModelStatus(data.models);
        }
      })
      .catch(() => {
        // Silently fail, keep as null
      });
  }, []);

  if (!modelStatus) {
    return (
      <div className="flex items-center space-x-2">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
        <span className="text-sm text-gray-500">本地模型: 检测中</span>
      </div>
    );
  }

  const allConfigured = Object.values(modelStatus).every((m) => m.configured);
  const anyOnline = Object.values(modelStatus).some((m) => m.status === "online");
  const anyOffline = Object.values(modelStatus).some((m) => m.status === "offline");
  const anyUnknown = Object.values(modelStatus).some((m) => m.status === "unknown");

  let statusText = "未配置";
  let statusColor = "bg-gray-400";

  if (allConfigured && anyOnline && !anyOffline) {
    statusText = "就绪";
    statusColor = "bg-green-500";
  } else if (anyOffline) {
    statusText = "部分离线";
    statusColor = "bg-yellow-500";
  } else if (anyUnknown && !allConfigured) {
    statusText = "未配置";
    statusColor = "bg-gray-400";
  } else if (anyOnline) {
    statusText = "部分就绪";
    statusColor = "bg-yellow-500";
  }

  return (
    <div className="flex items-center space-x-2">
      <span className={`w-2 h-2 rounded-full ${statusColor}`}></span>
      <span className="text-sm text-gray-600">本地模型: {statusText}</span>
    </div>
  );
}

export function TopBar() {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center flex-1">
        <input
          type="text"
          placeholder="搜索项目、文案、素材..."
          className="w-96 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center space-x-4">
        <ModelStatusBadge />
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          退出登录
        </button>
      </div>
    </header>
  );
}
