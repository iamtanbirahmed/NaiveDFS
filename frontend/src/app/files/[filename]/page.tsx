"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Layers, Server, Database, ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

export default function FileDetailsPage() {
  const params = useParams();
  const filename = decodeURIComponent(params.filename as string);
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const API_URL = "http://localhost:8080/api/files"; // Target the control plane API

  useEffect(() => {
    let isMounted = true;

    const fetchMetadata = async () => {
      try {
        const response = await axios.get(`${API_URL}/metadata`, {
          params: { filename },
        });
        if (isMounted) {
          setFileMetadata(response.data);
          setError("");
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(
            (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
              (err as { message?: string }).message ||
              "Failed to load file details",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (filename) {
      fetchMetadata();
    }

    return () => {
      isMounted = false;
    };
  }, [filename]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-400">Loading block metadata...</p>
      </div>
    );
  }

  if (error || !fileMetadata) {
    return (
      <div className="flex flex-col items-center min-h-screen px-4 py-12 max-w-5xl mx-auto w-full">
        <div className="w-full flex justify-start mb-8">
          <Link href="/">
            <button className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={20} /> Back to Dashboard
            </button>
          </Link>
        </div>
        <div className="p-8 rounded-xl glass-card w-full animate-fade-in-up border-red-500/30 bg-red-500/10 text-red-200 flex flex-col items-center text-center">
          <AlertCircle size={48} className="mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2">Error Loading File</h2>
          <p className="text-red-300">{error || "File not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-4 md:px-8 xl:px-12 py-12 max-w-[2500px] mx-auto w-full">
      <div className="w-full flex justify-start mb-8 animate-fade-in-up">
        <Link href="/">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-all hover:-translate-x-1 group">
            <ArrowLeft size={18} className="group-hover:text-blue-400 transition-colors" />
            <span>Back to Dashboard</span>
          </button>
        </Link>
      </div>

      <div className="w-full glass-card p-8 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-slate-700/50 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
              <Layers size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">File Details: {fileMetadata.filename}</h1>
              <p className="text-slate-400">Complete block distribution map across the cluster</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">{fileMetadata.blocks.length}</p>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mt-1">Total Blocks</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {fileMetadata.blocks.map((block: BlockInfo, idx: number) => (
            <div
              key={block.blockId}
              className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 hover:bg-slate-800/60 transition-all hover:border-slate-500/50 group"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold px-2 py-1 rounded bg-slate-700 text-slate-300 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">
                  Block {idx + 1}
                </span>
                <span className="text-xs text-slate-400">{block.blockSize} bytes</span>
              </div>

              <div className="text-[10px] font-mono text-slate-500 mb-4 truncate" title={block.blockId}>
                ID: {block.blockId}
              </div>

              <div className="space-y-3">
                <Link href={`/nodes/${block.leaderNode.id}`} className="block">
                  <div className="flex items-center gap-2 text-sm bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 p-2 rounded-lg transition-colors cursor-pointer cursor-group">
                    <Server size={14} className="text-blue-400" />
                    <span className="text-blue-100 font-medium text-xs truncate flex-1">
                      Leader: {block.leaderNode.id}
                    </span>
                    <ArrowRight
                      size={14}
                      className="text-blue-400/0 cursor-group-hover:text-blue-400/50 transition-colors"
                    />
                  </div>
                </Link>

                {block.followerNodes.map((fn: NodeInfo) => (
                  <Link key={fn.id} href={`/nodes/${fn.id}`} className="block">
                    <div className="flex items-center gap-2 text-sm bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 p-2 rounded-lg pl-6 relative transition-colors cursor-pointer cursor-group">
                      {/* Connecting line simulating a tree/graph */}
                      <div className="absolute left-3.5 top-[-10px] bottom-1/2 w-px bg-slate-600"></div>
                      <div className="absolute left-3.5 top-1/2 w-2 h-px bg-slate-600"></div>
                      <Database size={12} className="text-purple-400 min-w-min" />
                      <span className="text-purple-100/80 text-xs truncate flex-1">Replica: {fn.id}</span>
                      <ArrowRight
                        size={14}
                        className="text-purple-400/0 cursor-group-hover:text-purple-400/50 transition-colors"
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
