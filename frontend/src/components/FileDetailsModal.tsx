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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0f1115]/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-[#13151a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Layers size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Live Data Fragmentation</h2>
              <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
                <span>File: {fileMetadata.filename}</span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 font-medium">{totalBlocks} Total Blocks</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
                className="group bg-white/5 border border-white/5 rounded-xl p-5 hover:bg-white/10 hover:border-white/15 transition-all relative overflow-hidden"
              >
                {/* Accent line */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/30 group-hover:bg-emerald-400 transition-colors"></div>

                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-300">
                    Block {idx + 1}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{block.blockSize} bytes</span>
                </div>

                <div className="text-[10px] font-mono text-slate-500 mb-4 truncate" title={block.blockId}>
                  ID: {block.blockId}
                </div>

                <div className="space-y-3">
                  <Link href={`/nodes/${block.leaderNode.id}`} className="block">
                    <div className="flex items-center gap-2 text-sm bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 p-2 rounded-lg transition-colors cursor-pointer group/link">
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
                      <div className="flex items-center gap-2 text-sm bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/40 p-2 rounded-lg pl-6 relative transition-colors cursor-pointer group/link">
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
        </div>

        {/* Footer */}
        {hiddenBlocksCount > 0 && (
          <div className="p-4 border-t border-white/5 bg-[#0f1115] flex justify-center">
            <Link href={`/files/${fileMetadata.filename}`}>
              <button className="px-6 py-2.5 rounded-lg border flex items-center gap-2 font-medium text-white border-blue-500/30 bg-blue-500/20 hover:bg-blue-500/30 hover:border-blue-500/50 transition-all group">
                Open Full Block Explorer ({hiddenBlocksCount} more)
                <ArrowRight size={16} className="text-blue-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
