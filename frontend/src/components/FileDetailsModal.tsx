"use client";

import { Layers, Server, Database, ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

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

interface FileDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileMetadata: FileMetadata | null;
}

export default function FileDetailsModal({ isOpen, onClose, fileMetadata }: FileDetailsModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen || !fileMetadata) return null;

  const totalBlocks = fileMetadata.blocks.length;
  // Truncate to 6 blocks
  const visibleBlocks = fileMetadata.blocks.slice(0, 6);
  const hiddenBlocksCount = totalBlocks - visibleBlocks.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900/90 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-slate-800/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/20 text-teal-400">
              <Layers size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Live Data Fragmentation</h2>
              <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
                <span>File: {fileMetadata.filename}</span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 font-medium">{totalBlocks} Total Blocks</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleBlocks.map((block: BlockInfo, idx: number) => (
              <div
                key={block.blockId}
                className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold px-2 py-1 rounded bg-slate-700 text-slate-300">
                    Block {idx + 1}
                  </span>
                  <span className="text-xs text-slate-400">{block.blockSize} bytes</span>
                </div>

                <div className="text-[10px] font-mono text-slate-500 mb-4 truncate" title={block.blockId}>
                  ID: {block.blockId}
                </div>

                <div className="space-y-3">
                  <Link href={`/nodes/${block.leaderNode.id}`} className="block">
                    <div className="flex items-center gap-2 text-sm bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 p-2 rounded-lg transition-colors cursor-pointer group">
                      <Server size={14} className="text-blue-400" />
                      <span className="text-blue-100 font-medium text-xs truncate flex-1">
                        Leader: {block.leaderNode.id}
                      </span>
                      <ArrowRight
                        size={14}
                        className="text-blue-400/0 group-hover:text-blue-400/50 transition-colors"
                      />
                    </div>
                  </Link>

                  {block.followerNodes.map((fn: NodeInfo) => (
                    <Link key={fn.id} href={`/nodes/${fn.id}`} className="block">
                      <div className="flex items-center gap-2 text-sm bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 p-2 rounded-lg pl-6 relative transition-colors cursor-pointer group">
                        {/* Connecting line simulating a tree/graph */}
                        <div className="absolute left-3.5 top-[-10px] bottom-1/2 w-px bg-slate-600"></div>
                        <div className="absolute left-3.5 top-1/2 w-2 h-px bg-slate-600"></div>
                        <Database size={12} className="text-purple-400 min-w-min" />
                        <span className="text-purple-100/80 text-xs truncate flex-1">Replica: {fn.id}</span>
                        <ArrowRight
                          size={14}
                          className="text-purple-400/0 group-hover:text-purple-400/50 transition-colors"
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        {hiddenBlocksCount > 0 && (
          <div className="p-4 border-t border-slate-700/50 bg-slate-800/40 flex justify-center">
            <Link href={`/files/${fileMetadata.filename}`}>
              <button className="px-6 py-2.5 rounded-lg border flex items-center gap-2 font-medium text-white border-blue-500/50 bg-blue-500/20 hover:bg-blue-500/30 transition-colors group">
                View All Blocks ({hiddenBlocksCount} more)
                <ArrowRight size={16} className="text-blue-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
