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
    {
      traceID: string;
      spans: { duration: number; startTime: number; operationName?: string }[];
      processes: Record<string, unknown>;
    }[]
  >([]);
  const [loadingTraces, setLoadingTraces] = useState(true);
  const [clusterNodes, setClusterNodes] = useState<
    { nodeId: string; ipAddress: string; port: number; status: string }[]
  >([]);

  const [status, setStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({
    type: "idle",
    message: "",
  });
  const [isDragging, setIsDragging] = useState(false);
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

    const fetchNodes = async () => {
      try {
        const response = await axios.get(`${API_URL}/nodes`);
        if (response.data && response.data.success && isMounted) {
          setClusterNodes(response.data.nodes || []);
        }
      } catch (err: unknown) {
        console.error("Failed to fetch cluster nodes", err);
      }
    };

    loadFiles();
    fetchTraces();
    fetchNodes();

    const interval = setInterval(() => {
      loadFiles();
      fetchTraces();
      fetchNodes();
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
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
    <div className="flex flex-col min-h-screen px-4 md:px-8 py-8 w-full bg-transparent text-slate-300 font-sans">
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
          <h2 className="text-2xl font-bold tracking-tight mb-2 gradient-text w-fit">Data Pipeline</h2>

          {/* Upload Widget */}
          <div className="glass-card neon-border p-6 relative overflow-hidden group hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all duration-500">
            {/* Glowing Accent */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-500 opacity-70 group-hover:opacity-100 transition-opacity"></div>

            <div
              className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer overflow-hidden
                ${
                  isDragging || file
                    ? "border-emerald-400/50 bg-emerald-500/10 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]"
                    : "border-slate-600/50 hover:border-slate-400/80 hover:bg-white/5 shadow-inner"
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {isDragging && (
                <div className="absolute inset-0 bg-emerald-500/5 animate-pulse transition-opacity duration-300"></div>
              )}
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
              {file ? (
                <div className="flex flex-col items-center animate-fade-in-up relative z-10">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                    <CheckCircle2 size={32} className="text-emerald-400" />
                  </div>
                  <p className="text-white font-medium text-lg">{file.name}</p>
                  <p className="text-slate-400 text-sm mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB • Ready to sequence
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors duration-300 ${isDragging ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-400 group-hover:text-emerald-400"}`}
                  >
                    <Upload size={32} />
                  </div>
                  <p
                    className={`font-medium text-lg transition-colors duration-300 ${isDragging ? "text-emerald-400" : "text-slate-300"}`}
                  >
                    {isDragging ? "Drop to initialize transfer" : "Drop blocks here or click to index"}
                  </p>
                  <p className="text-slate-500 text-sm mt-2">Maximum fragment payload: 128MB per cluster limit.</p>
                </div>
              )}
            </div>

            {/* Progress Bar & Actions */}
            <div className={`mt-6 transition-all duration-300 ${file ? "opacity-100 translate-y-0" : "opacity-50"}`}>
              <div className="flex items-center justify-between mt-2 gap-4">
                <div className="flex-grow flex flex-col gap-2">
                  <div className="h-2 flex-grow bg-slate-800 rounded-full overflow-hidden shadow-inner w-full">
                    <div
                      className={`h-full transition-all duration-300 ${status.type === "success" ? "bg-emerald-500" : "bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500"}`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>

                <button
                  onClick={uploadFile}
                  disabled={!file || status.type === "loading"}
                  className="py-2.5 px-6 rounded-lg font-bold text-sm text-white bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 disabled:opacity-50 disabled:bg-slate-800 disabled:border-slate-800 disabled:text-slate-500 transition-all shadow-lg whitespace-nowrap group focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {status.type === "loading" ? "TRANSFERRING..." : "START UPLOAD"}
                </button>
              </div>
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
          <h2 className="text-2xl font-bold tracking-tight mb-2 gradient-text w-fit">System Telemetry</h2>

          <div className="glass-card neon-border flex flex-col overflow-hidden h-full min-h-[500px] hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all duration-500">
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
              {/* Server Nodes Status */}
              <div className="mb-8">
                <h3 className="text-sm font-medium text-white mb-4 tracking-tight flex items-center gap-2">
                  <Database size={16} className="text-teal-400" />
                  Cluster Nodes
                </h3>
                <div className="flex flex-col gap-3">
                  {/* We expect exactly 3 nodes for this demo. If fewer are returned, the others are offline. */}
                  {["naivedfs-data-node-1", "naivedfs-data-node-2", "naivedfs-data-node-3"].map((expectedNodeId) => {
                    const node = clusterNodes.find((n) => n.nodeId === expectedNodeId);
                    const isOnline = !!node;

                    return (
                      <div
                        key={expectedNodeId}
                        className={`group relative overflow-hidden rounded-xl border p-4 transition-all duration-500 backdrop-blur-md ${
                          isOnline
                            ? "bg-cyan-900/10 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:bg-cyan-900/20 hover:border-cyan-400 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)]"
                            : "bg-rose-900/10 border-rose-500/40 shadow-[0_0_20px_rgba(225,29,72,0.15)] hover:bg-rose-900/20 hover:border-rose-400 hover:shadow-[0_0_30px_rgba(225,29,72,0.3)]"
                        }`}
                      >
                        <div
                          className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r pointer-events-none ${
                            isOnline
                              ? "from-cyan-500/0 via-cyan-500/10 to-cyan-500/0"
                              : "from-rose-500/0 via-rose-500/10 to-rose-500/0"
                          }`}
                        />
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-4">
                            {/* Neon Indicator */}
                            <div className="relative flex h-3 w-3">
                              {isOnline && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                              )}
                              <span
                                className={`relative inline-flex rounded-full h-3 w-3 shadow-[0_0_15px_currentColor] border border-white/30 ${
                                  isOnline ? "bg-cyan-500 text-cyan-400" : "bg-rose-500 text-rose-500"
                                }`}
                              ></span>
                            </div>

                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-white tracking-wide">
                                {expectedNodeId.toUpperCase()}
                              </span>
                              {isOnline ? (
                                <span className="text-xs text-slate-400 font-mono">
                                  {node.ipAddress}:{node.port}
                                </span>
                              ) : (
                                <span className="text-xs text-rose-400/80 font-mono tracking-tight">
                                  CONNECTION_LOST
                                </span>
                              )}
                            </div>
                          </div>

                          <div
                            className={`text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full border backdrop-blur-sm ${
                              isOnline
                                ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                                : "bg-rose-500/10 text-rose-300 border-rose-500/30 shadow-[0_0_10px_rgba(225,29,72,0.2)]"
                            }`}
                          >
                            {isOnline ? "ONLINE" : "OFFLINE"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Latency Graph */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-white mb-3">Recent Trace Latency</h3>
                <div className="flex items-end gap-[1px] h-16 w-full border-b border-white/10 pb-1 pr-1 pl-1">
                  {(() => {
                    const validTraces = traces.filter((t) => t.spans && t.spans.length > 0 && t.spans[0]?.duration != null);
                    const durations = validTraces.map((t) => (t.spans?.[0]?.duration ?? 1000) / 1000);
                    const maxDuration = Math.max(...durations, 10);
                    
                    return validTraces
                      .slice(0, 30)
                      .reverse()
                      .map((trace, i) => {
                        const duration = (trace.spans?.[0]?.duration ?? 1000) / 1000;
                        const height = Math.max((duration / maxDuration) * 100, 5);
                        return (
                          <div
                            key={`graph-${trace.traceID}-${i}`}
                            className="flex-1 bg-emerald-500/40 hover:bg-emerald-400 rounded-t-[1px] transition-all group/graph relative cursor-crosshair min-w-[3px]"
                            style={{ height: `${height}%` }}
                          >
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover/graph:opacity-100 bg-black text-xs text-white px-2 py-1 rounded pointer-events-none z-10 whitespace-nowrap shadow-xl">
                              {duration.toFixed(1)}ms
                            </div>
                          </div>
                        );
                      });
                  })()}
                  {traces.length === 0 && (
                    <div className="w-full text-center text-xs text-slate-500 self-center">
                      No trace data available yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Log Stream Section */}
              <div className="flex-grow flex flex-col overflow-hidden">
                <h3 className="text-sm font-medium text-white mb-3 flex items-center justify-between">
                  <span>Log Stream</span>
                  <span className="text-[10px] text-slate-500 uppercase font-mono tracking-widest bg-white/5 px-2 py-0.5 rounded">
                    tail -f
                  </span>
                </h3>
                <div className="flex-grow bg-[#030712] rounded-xl border border-cyan-500/20 p-4 font-mono text-[11px] overflow-y-auto overflow-x-hidden max-h-[250px] custom-scrollbar shadow-[inset_0_0_20px_rgba(6,182,212,0.05)] relative">
                  {loadingTraces && traces.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-indigo-500/50 border-t-indigo-500 rounded-full animate-spin"></div>
                    </div>
                  )}

                  {traces.length === 0 && !loadingTraces && (
                    <div className="text-slate-600 py-4 text-center">No trace logs captured yet.</div>
                  )}

                  {traces.map((trace) => {
                    if (!trace.spans || trace.spans.length === 0 || trace.spans[0]?.duration == null) return null;
                    const time = new Date(trace.spans[0].startTime / 1000).toTimeString().split(" ")[0];
                    const duration = (trace.spans[0].duration / 1000).toFixed(1);
                    const svcNames = Array.from(
                      new Set(
                        Object.values(trace.processes || {})
                          .filter((p) => typeof p === "object" && p !== null && "serviceName" in p && typeof (p as { serviceName: string }).serviceName === "string")
                          .map((p) => (p as { serviceName: string }).serviceName)
                      )
                    );
                    const svcStr = svcNames[0] || "unknown";

                    return (
                      <div
                        key={trace.traceID}
                        className="mb-2 leading-relaxed opacity-90 hover:opacity-100 hover:bg-cyan-900/10 rounded px-2 py-1 -mx-2 transition-colors break-words whitespace-pre-wrap border border-transparent hover:border-cyan-500/20"
                      >
                        <span className="text-cyan-400">[{time}]</span>
                        <span className="text-slate-500 ml-2">({duration}ms)</span>
                        <span className="text-blue-400 ml-2 font-semibold">[{svcStr}]</span>
                        <span className="text-slate-300 ml-2 break-all">
                          {trace.spans[0].operationName || "Operation"} - Trace ID:{" "}
                          <span className="opacity-70">{trace.traceID.substring(0, 16)}</span>
                        </span>
                      </div>
                    );
                  })}
                  {/* Fading bottom edge */}
                  <div className="sticky bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0c1017] to-transparent pointer-events-none"></div>
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
