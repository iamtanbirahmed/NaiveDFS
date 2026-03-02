"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { Activity, Server, Clock, ServerCog, Database, ArrowRight } from "lucide-react";

export default function TelemetryDashboard() {
  const [traces, setTraces] = useState<
    { traceID: string; spans: { duration: number; startTime: number }[]; processes: Record<string, unknown> }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const JAEGER_API = "http://localhost:16686/api/traces?service=naive-dfs-control-plane&limit=10";

  useEffect(() => {
    fetchTraces();
    // Poll every 5 seconds
    const interval = setInterval(fetchTraces, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchTraces = async () => {
    try {
      const response = await axios.get(JAEGER_API);
      if (response.data && response.data.data) {
        setTraces(response.data.data);
      }
      setError("");
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to fetch telemetry data from Jaeger. Make sure the cluster is running.");
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="flex flex-col min-h-screen px-4 py-12 md:py-24 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-12 animate-fade-in-up">
        <div>
          <div className="inline-flex items-center gap-2 p-2 px-4 mb-4 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Activity size={18} />
            <span className="text-sm font-medium tracking-wide">SYSTEM OBSERVABILITY</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 text-white">Live Telemetry</h1>
          <p className="text-slate-400 text-lg">
            Monitor distributed gRPC traces across the NaiveDFS cluster in real-time.
          </p>
        </div>
        <Link
          href="/"
          className="px-6 py-3 rounded-xl font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition border border-slate-700 hover:text-white"
        >
          Back to Console
        </Link>
      </div>

      {error && (
        <div className="p-4 mb-8 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 animate-fade-in-up">
          {error}
        </div>
      )}

      {loading && traces.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : traces.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-400 border-dashed border-2">
          <Activity size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No traces found.</p>
          <p className="text-sm">Upload or download a file to generate telemetry data.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {traces.map(
            (
              trace: {
                traceID: string;
                spans: { duration: number; startTime: number }[];
                processes: Record<string, unknown>;
              },
              idx,
            ) => {
              const durationMs = (trace.spans[0].duration / 1000).toFixed(2);
              const numSpans = trace.spans.length;
              const startTime = new Date(trace.spans[0].startTime / 1000).toLocaleTimeString();
              const processMap = trace.processes;

              // Extract unique services involved in this trace
              const servicesInvolved = Array.from(
                new Set(Object.values(processMap).map((p: unknown) => (p as { serviceName: string }).serviceName)),
              );

              return (
                <div
                  key={trace.traceID}
                  className="glass-card p-6 rounded-2xl animate-fade-in-up transition-all hover:border-indigo-500/30 hover:bg-slate-800/60"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-6 border-b border-slate-700/50">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2 font-mono text-sm break-all">
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
                      <div className="text-3xl font-light text-indigo-400">
                        {durationMs} <span className="text-lg text-indigo-400/50">ms</span>
                      </div>
                      <p className="text-sm text-slate-500">Total Duration</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                      Services Involved
                    </h4>
                    <div className="flex flex-wrap gap-2 items-center">
                      {servicesInvolved.map((serviceName: string, i) => (
                        <div key={serviceName} className="flex items-center">
                          <span
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm ${getServiceColor(serviceName)}`}
                          >
                            {getServiceIcon(serviceName)}
                            {serviceName}
                          </span>
                          {i < servicesInvolved.length - 1 && <ArrowRight size={16} className="text-slate-600 mx-2" />}
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
  );
}
