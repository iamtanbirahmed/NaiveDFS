"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Server, Database, ArrowLeft, AlertCircle, HardDrive, Layers, Box } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface NodeBlockInfo {
  blockId: string;
  blockSize: number;
  filename: string;
  isLeader: boolean;
}

interface NodeDetails {
  nodeId: string;
  ipAddress: string;
  port: number;
  freeSpaceBytes: number;
  blocks: NodeBlockInfo[];
}

export default function NodeDetailsPage() {
  const params = useParams();
  const nodeId = decodeURIComponent(params.nodeId as string);
  const [nodeDetails, setNodeDetails] = useState<NodeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const API_URL = "http://localhost:8080/api/files"; // Target the control plane API

  useEffect(() => {
    let isMounted = true;

    const fetchNodeDetails = async () => {
      try {
        const response = await axios.get(`${API_URL}/nodes/${nodeId}`);
        if (isMounted) {
          setNodeDetails(response.data);
          setError("");
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(
            (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
              (err as { message?: string }).message ||
              "Failed to load node details",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (nodeId) {
      fetchNodeDetails();
    }

    return () => {
      isMounted = false;
    };
  }, [nodeId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-400">Loading DataNode details...</p>
      </div>
    );
  }

  if (error || !nodeDetails) {
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
          <h2 className="text-2xl font-bold mb-2">Error Loading DataNode</h2>
          <p className="text-red-300">{error || "DataNode not found"}</p>
        </div>
      </div>
    );
  }

  const leaderBlocks = nodeDetails.blocks.filter((b) => b.isLeader).length;
  const replicaBlocks = nodeDetails.blocks.length - leaderBlocks;

  return (
    <div className="flex flex-col items-center min-h-screen px-4 md:px-8 xl:px-12 py-12 max-w-[2500px] mx-auto w-full">
      <div className="w-full flex justify-start mb-8 animate-fade-in-up">
        <Link href="/">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-all hover:-translate-x-1 group">
            <ArrowLeft size={18} className="group-hover:text-emerald-400 transition-colors" />
            <span>Back to Dashboard</span>
          </button>
        </Link>
      </div>

      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full animate-fade-in-up"
        style={{ animationDelay: "100ms" }}
      >
        {/* Node Metadata Sidebar */}
        <div className="glass-card p-8 flex flex-col lg:col-span-1 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Database size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">DataNode</h1>
              <p className="text-slate-400 font-mono text-sm max-w-[200px] truncate" title={nodeDetails.nodeId}>
                {nodeDetails.nodeId}
              </p>
            </div>
          </div>

          <div className="space-y-6 flex-1">
            <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-2">
                <Server size={18} className="text-slate-400" />
                <h3 className="text-slate-300 font-medium">Network Address</h3>
              </div>
              <p className="text-white font-mono text-lg">
                {nodeDetails.ipAddress}:{nodeDetails.port}
              </p>
            </div>

            <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/50">
              <div className="flex items-center gap-3 mb-2">
                <HardDrive size={18} className="text-slate-400" />
                <h3 className="text-slate-300 font-medium">Free Storage Space</h3>
              </div>
              <p className="text-emerald-400 font-bold text-2xl">
                {(nodeDetails.freeSpaceBytes / 1024 / 1024 / 1024).toFixed(2)} GB
              </p>
              <p className="text-xs text-slate-500 mt-1">{nodeDetails.freeSpaceBytes.toLocaleString()} bytes</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 text-center">
                <div className="text-blue-400 font-bold text-2xl mb-1">{leaderBlocks}</div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Leader Blocks</div>
              </div>
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 text-center">
                <div className="text-purple-400 font-bold text-2xl mb-1">{replicaBlocks}</div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Replica Blocks</div>
              </div>
            </div>
          </div>
        </div>

        {/* Blocks Grid Main Content */}
        <div className="glass-card p-8 flex flex-col lg:col-span-2">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
            <Layers className="text-emerald-400" size={24} />
            <h2 className="text-xl font-bold text-white">Hosted Blocks ({nodeDetails.blocks.length})</h2>
          </div>

          {nodeDetails.blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-700/50 rounded-xl">
              <Box size={40} className="text-slate-600 mb-4" />
              <p className="text-slate-300 font-medium text-lg">No blocks assigned</p>
              <p className="text-slate-500 mt-2">This DataNode is currently empty and waiting for files.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {nodeDetails.blocks.map((block) => (
                <div
                  key={block.blockId}
                  className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 hover:bg-slate-800/60 transition-all hover:border-emerald-500/30 flex flex-col"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded bg-slate-800/80 border ${block.isLeader ? "border-blue-500/30 text-blue-400" : "border-purple-500/30 text-purple-400"}`}
                    >
                      {block.isLeader ? "LEADER" : "REPLICA"}
                    </span>
                    <span className="text-xs text-slate-400">{block.blockSize} bytes</span>
                  </div>

                  <div className="text-[10px] font-mono text-slate-500 mb-4 truncate" title={block.blockId}>
                    ID: {block.blockId}
                  </div>

                  <div className="mt-auto">
                    <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">
                      Belongs to File
                    </div>
                    <Link href={`/files/${block.filename}`}>
                      <div className="text-sm font-medium text-slate-300 truncate hover:text-emerald-400 transition-colors cursor-pointer bg-slate-900/50 px-3 py-2 rounded-lg border border-slate-700">
                        {block.filename}
                      </div>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
