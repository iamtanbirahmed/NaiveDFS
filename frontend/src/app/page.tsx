"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  Upload,
  Download,
  File,
  AlertCircle,
  CheckCircle2,
  Server,
  FolderUp,
  Activity,
  Network,
  Database,
  Clock,
  ServerCog,
  ArrowRight,
} from "lucide-react";
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

  const getServiceColor = (serviceName: string) => {
    if (serviceName.includes("master")) return "text-purple-400 bg-purple-400/10 border-purple-400/30";
    if (serviceName.includes("datanode")) return "text-emerald-400 bg-emerald-400/10 border-emerald-400/30";
    if (serviceName.includes("control-plane")) return "text-blue-400 bg-blue-400/10 border-blue-400/30";
    return "text-slate-400 bg-slate-400/10 border-slate-400/30";
  };

  const getServiceIcon = (serviceName: string) => {
    if (serviceName.includes("master")) return <ServerCog size={16} />;
    if (serviceName.includes("datanode")) return <Database size={16} />;
    return <Server size={16} />;
  };

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
    <div className="flex flex-col items-center min-h-screen px-4 md:px-8 xl:px-12 py-12 max-w-[2500px] mx-auto w-full">
      <div className="text-center w-full mb-16 animate-fade-in-up relative" style={{ animationDelay: "0ms" }}>
        <div className="inline-flex items-center justify-center p-3 mb-4 rounded-full bg-blue-500/10 text-blue-400">
          <Server size={32} />
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4 gradient-text">NaiveDFS Web Console</h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
          A highly available distributed file system interface. Manage chunks, explore nodes, and interact with the
          Control Plane.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8 w-full mb-8">
        {/* Upload Card */}
        <div
          className="glass-card p-8 animate-fade-in-up flex flex-col lg:col-span-1"
          style={{ animationDelay: "100ms" }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
              <Upload size={24} />
            </div>
            <h2 className="text-2xl font-bold text-white">Upload File</h2>
          </div>

          <div
            className={`flex-grow border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer
              ${file ? "border-blue-500/50 bg-blue-500/5" : "border-slate-600 hover:border-slate-500 hover:bg-slate-800/30"}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            {file ? (
              <div className="flex flex-col items-center">
                <File size={40} className="text-blue-400 mb-4" />
                <p className="text-white font-medium">{file.name}</p>
                <p className="text-slate-400 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <FolderUp size={40} className="text-slate-500 mb-4" />
                <p className="text-slate-300 font-medium">Click to browse or drag a file here</p>
                <p className="text-slate-500 text-sm mt-2">Maximum file size: 500MB</p>
              </div>
            )}
          </div>

          <button
            onClick={uploadFile}
            disabled={!file || status.type === "loading"}
            className="mt-6 w-full py-4 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {status.type === "loading" && progress > 0 ? `Uploading... ${progress}%` : "Upload to Cluster"}
          </button>
        </div>

        {/* File Browser Card */}
        <div
          className="glass-card p-8 animate-fade-in-up flex flex-col lg:col-span-2 xl:col-span-3"
          style={{ animationDelay: "200ms" }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Database size={24} />
            </div>
            <h2 className="text-2xl font-bold text-white">Cluster File Browser</h2>
          </div>

          <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar" style={{ maxHeight: "300px" }}>
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8 border-2 border-dashed border-slate-700/50 rounded-xl">
                <File size={32} className="text-slate-600 mb-3" />
                <p className="text-slate-400 font-medium">No files in cluster yet</p>
                <p className="text-slate-500 text-sm mt-1">Upload a file to see it appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {files.map((filename) => (
                  <div
                    key={filename}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-slate-800/60 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <File size={18} className="text-blue-400 shrink-0" />
                      <span className="text-white font-medium truncate">{filename}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => fetchMetadata(filename)}
                        className="p-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors group relative"
                        title="View Details"
                      >
                        <Network size={16} />
                      </button>
                      <button
                        onClick={() => downloadFile(filename)}
                        className="p-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-colors border border-purple-500/20"
                        title="Download"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 w-full">
        {/* Live Telemetry Dashboard */}
        <div className="w-full glass-card p-8 animate-fade-in-up flex flex-col" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Activity size={24} />
            </div>
            <h2 className="text-2xl font-bold text-white">Live Distributed Telemetry</h2>
          </div>

          <p className="text-slate-400 mb-6">
            Monitor distributed gRPC traces across the NaiveDFS cluster in real-time using OpenTelemetry.
          </p>

          {loadingTraces && traces.length === 0 ? (
            <div className="flex justify-center py-10">
              <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          ) : traces.length === 0 ? (
            <div className="p-8 text-center text-slate-400 border-dashed border-2 border-slate-700/50 rounded-xl">
              <Activity size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-medium">No system traces found.</p>
              <p className="text-sm mt-1">Upload or download a file to generate telemetry data.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {traces.map(
                (trace: {
                  traceID: string;
                  spans: { duration: number; startTime: number }[];
                  processes: Record<string, unknown>;
                }) => {
                  const durationMs = (trace.spans[0].duration / 1000).toFixed(2);
                  const numSpans = trace.spans.length;
                  const startTime = new Date(trace.spans[0].startTime / 1000).toLocaleTimeString();
                  const processMap = trace.processes;

                  const servicesInvolved = Array.from(
                    new Set(Object.values(processMap).map((p: unknown) => (p as { serviceName: string }).serviceName)),
                  );

                  return (
                    <div
                      key={trace.traceID}
                      className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 hover:bg-slate-800/60 transition-all hover:border-indigo-500/30"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 pb-4 border-b border-slate-700/50">
                        <div>
                          <h3 className="text-lg font-bold text-white mb-2 font-mono text-sm break-all">
                            Trace: {trace.traceID.substring(0, 16)}...
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            <span className="flex items-center gap-1.5">
                              <Clock size={16} /> {startTime}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
                              {numSpans} spans
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 md:mt-0 text-right">
                          <div className="text-2xl font-light text-indigo-400">
                            {durationMs} <span className="text-sm text-indigo-400/50">ms</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Services Involved
                        </h4>
                        <div className="flex flex-wrap gap-2 items-center">
                          {servicesInvolved.map((serviceName: string, i) => (
                            <div key={serviceName} className="flex items-center">
                              <span
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${getServiceColor(serviceName)}`}
                              >
                                {getServiceIcon(serviceName)}
                                {serviceName}
                              </span>
                              {i < servicesInvolved.length - 1 && (
                                <ArrowRight size={14} className="text-slate-600 mx-1" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status Indicators */}
      {status.message && (
        <div
          className={`mt-10 p-6 rounded-xl glass-card w-full animate-fade-in-up flex items-start gap-4 ${
            status.type === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : status.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-blue-500/30 bg-blue-500/10 text-blue-200"
          }`}
          style={{ animationDelay: "300ms", animationFillMode: "both" }}
        >
          {status.type === "error" && <AlertCircle className="shrink-0 mt-0.5" />}
          {status.type === "success" && <CheckCircle2 className="shrink-0 mt-0.5 text-emerald-400" />}
          {status.type === "loading" && (
            <div className="shrink-0 w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mt-0.5"></div>
          )}
          <div className="flex flex-col">
            <h3 className="font-semibold text-lg mb-1">
              {status.type === "error"
                ? "Operation Failed"
                : status.type === "success"
                  ? "Operation Successful"
                  : "Processing Request..."}
            </h3>
            <p className="opacity-90">{status.message}</p>
          </div>
        </div>
      )}

      {/* File Details Modal */}
      <FileDetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} fileMetadata={fileMetadata} />
    </div>
  );
}
