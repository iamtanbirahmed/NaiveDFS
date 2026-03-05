"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Upload, Download, File, AlertCircle, CheckCircle2, Activity, Network, Database } from "lucide-react";
import FileDetailsModal from "../components/FileDetailsModal";

interface NodeInfo {
  id: string;
  ip: string;
  port: number;
}

interface BlockInfo {
  blockId: string;
  blockSize: number;
  leaderNode: NodeInfo;
  followerNodes: NodeInfo[];
}

interface FileMetadata {
  filename: string;
  blocks: BlockInfo[];
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Telemetry States
  const [traces, setTraces] = useState<
    { traceID: string; spans: { duration: number; startTime: number }[]; processes: Record<string, unknown> }[]
  >([]);
  const [loadingTraces, setLoadingTraces] = useState(true);

  const [status, setStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({
    type: "idle",
    message: "",
  });
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_URL = "http://localhost:8080/api/files"; // Target the control plane API
  const JAEGER_API = "/jaeger-api/traces?service=naive-dfs-control-plane&limit=10";

  const fetchFiles = async () => {
    try {
      const response = await axios.get(`${API_URL}/list`);
      if (response.data.success) {
        setFiles(response.data.files || []);
      }
    } catch (err) {
      console.error("Failed to fetch files", err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadFiles = async () => {
      try {
        const response = await axios.get(`${API_URL}/list`);
        if (response.data.success && isMounted) {
          setFiles(response.data.files || []);
        }
      } catch (err) {
        console.error("Failed to fetch files", err);
      }
    };

    const fetchTraces = async () => {
      try {
        const response = await axios.get(JAEGER_API);
        if (response.data && response.data.data && isMounted) {
          setTraces(response.data.data);
        }
      } catch (err: unknown) {
        console.error("Failed to fetch telemetry data from Jaeger", err);
      } finally {
        if (isMounted) setLoadingTraces(false);
      }
    };

    loadFiles();
    fetchTraces();

    const interval = setInterval(() => {
      loadFiles();
      fetchTraces();
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const uploadFile = async () => {
    if (!file) {
      setStatus({ type: "error", message: "Please select a file first." });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setStatus({ type: "loading", message: "Uploading to NaiveDFS Control Plane..." });
    setProgress(0);

    try {
      await axios.post(`${API_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percentCompleted);
          }
        },
      });
      setStatus({ type: "success", message: `File '${file.name}' uploaded successfully to the cluster.` });
      setFile(null);
      fetchFiles(); // Refresh the list instantly
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: string } }).response?.data ||
        (err as { message?: string }).message ||
        "Failed to upload file.";
      setStatus({ type: "error", message: `Upload failed: ${errorMsg}` });
    }
  };

  const downloadFile = async (filename: string) => {
    setStatus({ type: "loading", message: `Contacting Control Plane for '${filename}'...` });
    setProgress(0);

    try {
      const response = await axios.get(`${API_URL}/download`, {
        params: { filename: filename },
        responseType: "blob",
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percentCompleted);
          }
        },
      });

      // Trigger file download in browser
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setStatus({ type: "success", message: `File '${filename}' downloaded successfully.` });
    } catch (err: unknown) {
      setStatus({
        type: "error",
        message: `File not found or cluster error: ${(err as { message?: string }).message}`,
      });
    }
  };

  const fetchMetadata = async (filename: string) => {
    setStatus({ type: "loading", message: `Fetching block metadata for '${filename}'...` });
    try {
      const response = await axios.get(`${API_URL}/metadata`, {
        params: { filename: filename },
      });
      setFileMetadata(response.data);
      setIsModalOpen(true);
      setStatus({ type: "success", message: `Successfully loaded map for '${filename}'` });
    } catch (err: unknown) {
      setStatus({
        type: "error",
        message: `Failed to load metadata: ${(err as { message?: string }).message}`,
      });
      setFileMetadata(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen px-4 md:px-8 py-8 w-full bg-[#0a0f18] text-slate-300 font-sans">
      {/* Top Navbar */}
      <nav
        className="w-full max-w-[1400px] mx-auto flex items-center justify-between py-4 mb-8 border-b border-white/5 pb-6 animate-fade-in-up"
        style={{ animationDelay: "0ms" }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-500/20 text-teal-400">
            <Activity size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            SYNTHESIS{" "}
            <span className="text-slate-500 font-light text-sm hidden sm:inline">{"// NAIVEDFS DASHBOARD"}</span>
          </h1>
        </div>
        <div className="hidden md:flex gap-8 text-sm font-medium text-slate-400">
          <span className="text-white border-b-2 border-teal-400 pb-2">Overview</span>
          <span className="hover:text-white cursor-pointer pb-2 transition-colors">Data Studio</span>
          <span className="hover:text-white cursor-pointer pb-2 transition-colors">Activity</span>
          <span className="hover:text-white cursor-pointer pb-2 transition-colors">Reports</span>
        </div>
      </nav>

      {/* Main Grid Layout */}
      <div
        className="grid grid-cols-1 lg:grid-cols-5 gap-8 w-full max-w-[1400px] mx-auto flex-grow"
        style={{ animationDelay: "100ms" }}
      >
        {/* LEFT COLUMN: Data Pipeline (60% i.e. 3/5 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-6 animate-fade-in-up">
          <h2 className="text-2xl font-semibold text-white tracking-tight">Data Pipeline</h2>

          {/* Upload Widget */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
            {/* Glowing Accent */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-blue-500 opacity-70"></div>

            <div
              className={`border border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer shadow-inner
                ${file ? "border-teal-500/50 bg-teal-500/5" : "border-slate-600/50 hover:border-slate-400/80 hover:bg-white/5"}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
              {file ? (
                <div className="flex flex-col items-center animate-fade-in-up">
                  <File size={36} className="text-teal-400 mb-3" />
                  <p className="text-white font-medium text-lg">{file.name}</p>
                  <p className="text-slate-400 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB ready</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload size={32} className="text-slate-400 mb-3 group-hover:text-teal-400 transition-colors" />
                  <p className="text-slate-300 font-medium text-lg">Drop files here or click to upload</p>
                  <p className="text-slate-500 text-sm mt-1">Max cluster chunk size: 128MB per block</p>
                </div>
              )}
            </div>

            {/* Progress Bar & Actions */}
            <div className="flex items-center justify-between mt-6 gap-4">
              <div className="flex-grow flex items-center gap-3">
                <div className="h-2 flex-grow bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className="text-sm font-bold text-teal-400 min-w-[40px]">{progress}%</span>
              </div>

              <button
                onClick={uploadFile}
                disabled={!file || status.type === "loading"}
                className="py-2.5 px-6 rounded-lg font-bold text-sm text-white bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:bg-slate-700 disabled:text-slate-400 transition-all shadow-[0_0_15px_rgba(20,184,166,0.2)] disabled:shadow-none whitespace-nowrap"
              >
                START UPLOAD
              </button>
            </div>
          </div>

          {/* File Cards List */}
          <div className="mt-4 flex flex-col gap-3 flex-grow pb-12">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-2">
              {files.length} FILES INDEXED
            </h3>

            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 bg-white/5 border border-white/5 rounded-xl text-center">
                <Database size={28} className="text-slate-600 mb-3" />
                <p className="text-slate-400">Storage cluster is empty</p>
              </div>
            ) : (
              files.map((filename) => (
                <div
                  key={filename}
                  className="group flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 rounded-xl transition-all cursor-default relative overflow-hidden"
                >
                  {/* Left edge accent */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/50 group-hover:bg-emerald-400 transition-colors"></div>

                  <div className="flex items-center gap-4 pl-2">
                    <div className="p-2.5 bg-slate-800 rounded-lg shadow-inner">
                      <File size={20} className="text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-medium text-base truncate max-w-[200px] sm:max-w-[300px]">
                        {filename}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        <span>Completed</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => fetchMetadata(filename)}
                      className="p-2 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-transparent hover:border-slate-600"
                      title="Inspect Metadata & Blocks"
                    >
                      <Network size={16} />
                    </button>
                    <button
                      onClick={() => downloadFile(filename)}
                      className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors border border-transparent hover:border-blue-500/30"
                      title="Download File"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: OpenTelemetry Widget (40% i.e. 2/5 cols) */}
        <div className="lg:col-span-2 flex flex-col gap-6 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <h2 className="text-2xl font-semibold text-white tracking-tight">System Telemetry</h2>

          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl flex flex-col overflow-hidden h-full min-h-[500px]">
            {/* Widget Header */}
            <div className="px-5 py-4 bg-black/20 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 tracking-wider">
                <Activity size={14} className="text-orange-400" />
                OPENTELEMETRY // INSIGHTS
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
                <span className="text-xs font-bold text-emerald-500">LIVE</span>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-5 flex flex-col flex-grow">
              {/* Quick Summary / Status */}
              <div className="mb-8">
                <h3 className="text-sm font-medium text-white mb-4">Trace Status Indicators</h3>
                <div className="space-y-3">
                  {/* Extract unique services from recent traces or show mock if none */}
                  {traces.length > 0 ? (
                    Array.from(
                      new Set(
                        traces.flatMap((t) =>
                          Object.values(t.processes).map((p) => (p as { serviceName: string }).serviceName),
                        ),
                      ),
                    )
                      .slice(0, 3)
                      .map((svc) => (
                        <div key={svc as string} className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                          <span className="text-sm text-slate-300 font-mono tracking-tight">
                            {svc.toUpperCase()} <span className="text-emerald-400 ml-1">(OK)</span>
                          </span>
                        </div>
                      ))
                  ) : (
                    <div className="text-xs text-slate-500 italic">Awaiting telemetry data...</div>
                  )}
                </div>
              </div>

              {/* Log Stream Section */}
              <div className="flex-grow flex flex-col">
                <h3 className="text-sm font-medium text-white mb-3">Log Stream</h3>
                <div className="flex-grow bg-[#05080f] rounded-xl border border-white/5 p-4 font-mono text-[11px] sm:text-xs overflow-y-auto max-h-[350px] custom-scrollbar shadow-inner relative">
                  {loadingTraces && traces.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-indigo-500/50 border-t-indigo-500 rounded-full animate-spin"></div>
                    </div>
                  )}

                  {traces.length === 0 && !loadingTraces && (
                    <div className="text-slate-600 py-4 text-center">No trace logs captured yet.</div>
                  )}

                  {traces.map((trace) => {
                    const time = new Date(trace.spans[0].startTime / 1000).toTimeString().split(" ")[0];
                    const duration = (trace.spans[0].duration / 1000).toFixed(1);
                    const svcNames = Array.from(
                      new Set(Object.values(trace.processes).map((p) => (p as { serviceName: string }).serviceName)),
                    );
                    const svcStr = svcNames[0] || "unknown";

                    return (
                      <div
                        key={trace.traceID}
                        className="mb-2 leading-relaxed opacity-90 hover:opacity-100 hover:bg-white/5 rounded px-1 -mx-1 transition-colors"
                      >
                        <span className="text-teal-400">[{time}]</span>
                        <span className="text-slate-500 ml-2">({duration}ms)</span>
                        <span className="text-purple-400 ml-2 font-semibold">[{svcStr}]</span>
                        <span className="text-slate-300 ml-2">Trace span {trace.traceID.substring(0, 8)}</span>
                      </div>
                    );
                  })}
                  {/* Fading bottom edge */}
                  <div className="sticky bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#05080f] to-transparent pointer-events-none"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Status Toast (Floating) */}
      {status.message && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
          <div
            className={`shadow-2xl p-4 rounded-xl flex items-center gap-3 backdrop-blur-xl border ${
              status.type === "error"
                ? "bg-red-500/20 border-red-500/50 text-red-100"
                : status.type === "success"
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-100"
                  : "bg-blue-500/20 border-blue-500/50 text-blue-100"
            }`}
          >
            {status.type === "error" && <AlertCircle size={20} />}
            {status.type === "success" && <CheckCircle2 size={20} className="text-emerald-400" />}
            {status.type === "loading" && (
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            )}
            <span className="font-medium text-sm">{status.message}</span>
            <button
              onClick={() => setStatus({ type: "idle", message: "" })}
              className="ml-4 opacity-50 hover:opacity-100 text-lg leading-none"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* File Details Modal */}
      <FileDetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} fileMetadata={fileMetadata} />
    </div>
  );
}
