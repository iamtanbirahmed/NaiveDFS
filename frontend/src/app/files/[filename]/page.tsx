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

  const renderNavbar = () => (
    <nav className="border-b border-white/10 bg-[#0f1115]/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-[2000px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <span className="font-bold text-white text-sm font-mono tracking-tighter">nD</span>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">NaiveDFS</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20 ml-2">
              Cluster Active
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 transition-all text-sm font-medium">
              <ArrowLeft size={16} /> Dashboard
            </button>
          </Link>
        </div>
      </div>
    </nav>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1115] text-slate-300 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
        {renderNavbar()}
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-400 font-medium">Loading block metadata...</p>
        </div>
      </div>
    );
  }

  if (error || !fileMetadata) {
    return (
      <div className="min-h-screen bg-[#0f1115] text-slate-300 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
        {renderNavbar()}
        <div className="flex flex-col items-center min-h-[calc(100vh-4rem)] px-4 py-12 max-w-5xl mx-auto w-full">
          <div className="p-8 rounded-xl bg-red-500/10 border border-red-500/20 w-full animate-fade-in text-center flex flex-col items-center">
            <AlertCircle size={48} className="mb-4 text-red-400" />
            <h2 className="text-2xl font-bold mb-2 text-white">Error Loading File</h2>
            <p className="text-red-300">{error || "File not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1115] text-slate-300 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 flex flex-col">
      {renderNavbar()}

      <main className="flex-1 p-6 md:p-8 xl:p-12 max-w-[2500px] mx-auto w-full animate-fade-in relative z-10">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none translate-y-1/3 -translate-x-1/3"></div>

        <div className="w-full bg-[#13151a]/80 backdrop-blur-sm border border-white/10 rounded-2xl p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-500"></div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-xl bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10 shrink-0">
                <Layers size={36} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Block Explorer</h1>
                <p className="text-slate-400 flex items-center gap-2">
                  <span>
                    File: <span className="text-white font-medium">{fileMetadata.filename}</span>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>Complete block distribution map</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-400">{fileMetadata.blocks.length}</p>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mt-1">Total Blocks</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
          {fileMetadata.blocks.map((block: BlockInfo, idx: number) => (
            <div
              key={block.blockId}
              className="group bg-white/5 border border-white/5 rounded-xl p-5 hover:bg-white/10 hover:border-white/15 transition-all relative overflow-hidden"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/30 group-hover:bg-emerald-400 transition-colors"></div>

              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-300">
                  Block {idx + 1}
                </span>
                <span className="text-xs text-slate-400 font-mono bg-black/20 px-2 py-1 rounded">
                  {block.blockSize} bytes
                </span>
              </div>

              <div
                className="text-[10px] font-mono text-slate-500 mb-5 truncate bg-black/20 p-2 rounded border border-white/5"
                title={block.blockId}
              >
                ID: {block.blockId}
              </div>

              <div className="space-y-3">
                <Link href={`/nodes/${block.leaderNode.id}`} className="block">
                  <div className="flex items-center gap-2 text-sm bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 p-2.5 rounded-lg transition-colors cursor-pointer group/link">
                    <Server size={14} className="text-blue-400" />
                    <span className="text-blue-100 font-medium text-xs truncate flex-1">
                      Leader: {block.leaderNode.id}
                    </span>
                    <ArrowRight
                      size={14}
                      className="text-blue-400/0 group-hover/link:text-blue-400/50 transition-colors"
                    />
                  </div>
                </Link>

                {block.followerNodes.map((fn: NodeInfo) => (
                  <Link key={fn.id} href={`/nodes/${fn.id}`} className="block">
                    <div className="flex items-center gap-2 text-sm bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/40 p-2.5 rounded-lg pl-6 relative transition-colors cursor-pointer group/link">
                      {/* Connecting line simulating a tree/graph */}
                      <div className="absolute left-3.5 top-[-10px] bottom-1/2 w-px bg-slate-600/50"></div>
                      <div className="absolute left-3.5 top-1/2 w-2 h-px bg-slate-600/50"></div>
                      <Database size={12} className="text-purple-400 min-w-min" />
                      <span className="text-purple-100/80 text-xs truncate flex-1">Replica: {fn.id}</span>
                      <ArrowRight
                        size={14}
                        className="text-purple-400/0 group-hover/link:text-purple-400/50 transition-colors"
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
