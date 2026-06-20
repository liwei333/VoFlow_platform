"use client";

import { useEffect, useState } from "react";

interface Project {
  id: string;
  name: string;
  targetPlatform: string;
  aspectRatio: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface HealthStatus {
  status: string;
  dependencies: {
    postgres: { status: string };
    redis: { status: string };
    minio: { status: string };
  };
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    targetPlatform: "抖音",
    aspectRatio: "9:16" as "9:16" | "16:9" | "1:1",
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchHealth();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.code === "SUCCESS") {
        setProjects(data.data.projects);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth(data);
    } catch (error) {
      console.error("Failed to fetch health:", error);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProject),
      });

      const data = await res.json();

      if (data.code === "SUCCESS") {
        setShowCreateModal(false);
        setNewProject({ name: "", targetPlatform: "抖音", aspectRatio: "9:16" });
        fetchProjects();
      } else {
        alert(data.message || "创建失败");
      }
    } catch (error) {
      console.error("Failed to create project:", error);
      alert("创建失败");
    } finally {
      setCreating(false);
    }
  };

  const aspectRatioLabels: Record<string, string> = {
    "9:16": "竖版 9:16",
    "16:9": "横版 16:9",
    "1:1": "方形 1:1",
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">我的项目</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          创建项目
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-900">{projects.length}</div>
          <div className="text-sm text-gray-500">项目总数</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">
            {projects.filter((p) => p.status === "active").length}
          </div>
          <div className="text-sm text-gray-500">活跃项目</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">0</div>
          <div className="text-sm text-gray-500">运行中任务</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2 h-2 rounded-full ${
                health?.dependencies?.postgres?.status === "up"
                  ? "bg-green-500"
                  : "bg-red-500"
              }`}
            ></span>
            <span className="text-sm text-gray-600">数据库</span>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <span
              className={`w-2 h-2 rounded-full ${
                health?.dependencies?.redis?.status === "up"
                  ? "bg-green-500"
                  : "bg-red-500"
              }`}
            ></span>
            <span className="text-sm text-gray-600">Redis</span>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <span
              className={`w-2 h-2 rounded-full ${
                health?.dependencies?.minio?.status === "up"
                  ? "bg-green-500"
                  : "bg-red-500"
              }`}
            ></span>
            <span className="text-sm text-gray-600">MinIO</span>
          </div>
        </div>
      </div>

      {/* Project List */}
      {projects.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-400 text-lg mb-4">暂无项目</div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-blue-600 hover:text-blue-700"
          >
            创建第一个项目
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white p-4 rounded-lg shadow hover:shadow-md cursor-pointer transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-medium text-gray-900 truncate">{project.name}</h3>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    project.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {project.status === "active" ? "活跃" : "已归档"}
                </span>
              </div>
              <div className="text-sm text-gray-500 space-y-1">
                <div>平台: {project.targetPlatform}</div>
                <div>画布: {aspectRatioLabels[project.aspectRatio]}</div>
                <div>创建: {new Date(project.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(15, 23, 42, 0.16)" }}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">创建项目</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  项目名称
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) =>
                    setNewProject({ ...newProject, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入项目名称"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  目标平台
                </label>
                <select
                  value={newProject.targetPlatform}
                  onChange={(e) =>
                    setNewProject({ ...newProject, targetPlatform: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="抖音">抖音</option>
                  <option value="快手">快手</option>
                  <option value="小红书">小红书</option>
                  <option value="视频号">视频号</option>
                  <option value="B站">B站</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  画布比例
                </label>
                <div className="flex space-x-4">
                  {(["9:16", "16:9", "1:1"] as const).map((ratio) => (
                    <label key={ratio} className="flex items-center">
                      <input
                        type="radio"
                        name="aspectRatio"
                        value={ratio}
                        checked={newProject.aspectRatio === ratio}
                        onChange={(e) =>
                          setNewProject({
                            ...newProject,
                            aspectRatio: e.target.value as "9:16" | "16:9" | "1:1",
                          })
                        }
                        className="mr-2"
                      />
                      <span className="text-sm">{aspectRatioLabels[ratio]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? "创建中..." : "创建"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
