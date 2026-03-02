"use client";

import { useState, useRef } from "react";
import axios from "axios";
import { Upload, Download, File, AlertCircle, CheckCircle2, Server, FolderUp, Activity } from "lucide-react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [downloadName, setDownloadName] = useState("");
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({
    type: "idle",
    message: "",
  });
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_URL = "http://localhost:8080/api/files"; // Target the control plane API

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
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: string } }).response?.data ||
        (err as { message?: string }).message ||
        "Failed to upload file.";
      setStatus({ type: "error", message: `Upload failed: ${errorMsg}` });
    }
  };

  const downloadFile = async () => {
    if (!downloadName.trim()) {
      setStatus({ type: "error", message: "Please enter a filename to download." });
      return;
    }

    setStatus({ type: "loading", message: `Contacting Control Plane for '${downloadName}'...` });
    setProgress(0);

    try {
      const response = await axios.get(`${API_URL}/download`, {
        params: { filename: downloadName },
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
      link.setAttribute("download", downloadName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setStatus({ type: "success", message: `File '${downloadName}' downloaded successfully.` });
      setDownloadName("");
    } catch (err: unknown) {
      setStatus({
        type: "error",
        message: `File not found or cluster error: ${(err as { message?: string }).message}`,
      });
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-12 md:py-24">
      <div className="text-center mb-16 animate-fade-in-up relative" style={{ animationDelay: "0ms" }}>
        <a
          href="/telemetry"
          className="absolute top-0 right-0 px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl hover:bg-indigo-500/20 transition-colors flex items-center gap-2"
        >
          <Activity size={18} />
          <span>View Telemetry</span>
        </a>
        <div className="inline-flex items-center justify-center p-3 mb-4 rounded-full bg-blue-500/10 text-blue-400">
          <Server size={32} />
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4 gradient-text">NaiveDFS Web Console</h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
          A highly available distributed file system interface. Manage chunks, explore nodes, and interact with the
          Control Plane.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
        {/* Upload Card */}
        <div className="glass-card p-8 animate-fade-in-up flex flex-col" style={{ animationDelay: "100ms" }}>
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

        {/* Download Card */}
        <div className="glass-card p-8 animate-fade-in-up flex flex-col" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
              <Download size={24} />
            </div>
            <h2 className="text-2xl font-bold text-white">Retrieve File</h2>
          </div>

          <p className="text-slate-400 mb-6">
            Enter the exact filename to request the metadata locations from the Master Node and stream chunks from the
            Data Nodes.
          </p>

          <div className="flex flex-col gap-4 flex-grow justify-center">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <File size={18} className="text-slate-500" />
              </div>
              <input
                type="text"
                placeholder="e.g., test_300mb.dat"
                value={downloadName}
                onChange={(e) => setDownloadName(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            <button
              onClick={downloadFile}
              disabled={!downloadName || status.type === "loading"}
              className="mt-2 w-full py-4 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {status.type === "loading" && progress > 0 ? `Fetching... ${progress}%` : "Download File"}
            </button>
          </div>
        </div>
      </div>

      {/* Status Indicators */}
      {status.message && (
        <div
          className={`mt-10 p-6 rounded-xl glass-card w-full max-w-5xl animate-fade-in-up flex items-start gap-4 ${
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
    </div>
  );
}
