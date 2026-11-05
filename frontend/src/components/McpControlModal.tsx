import React, { useState, useEffect } from 'react';
import { Cpu, Terminal, Copy, Check, ToggleLeft, ToggleRight, X, ExternalLink, ShieldCheck } from 'lucide-react';

interface McpControlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const McpControlModal: React.FC<McpControlModalProps> = ({ isOpen, onClose }) => {
  const [statusData, setStatusData] = useState<any>(null);
  const [configData, setConfigData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadMcpInfo();
    }
  }, [isOpen]);

  const loadMcpInfo = async () => {
    setLoading(true);
    try {
      const [resStatus, resConfig] = await Promise.all([
        fetch('/api/mcp/status'),
        fetch('/api/mcp/config')
      ]);
      if (resStatus.ok) setStatusData(await resStatus.json());
      if (resConfig.ok) setConfigData(await resConfig.json());
    } catch (e) {
      console.error('Failed to load MCP info:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTool = async (toolName: string, currentEnabled: boolean) => {
    try {
      const res = await fetch('/api/mcp/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_name: toolName,
          enabled: !currentEnabled
        })
      });
      if (res.ok) {
        setStatusData((prev: any) => ({
          ...prev,
          tools: prev.tools.map((t: any) =>
            t.name === toolName ? { ...t, enabled: !currentEnabled } : t
          )
        }));
      }
    } catch (e) {
      console.error('Toggle error:', e);
    }
  };

  const handleCopyConfig = () => {
    if (configData?.config_json) {
      navigator.clipboard.writeText(configData.config_json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl bg-[#111216] border border-white/10 shadow-2xl p-6 text-zinc-200 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-100">Model Context Protocol (MCP) Control Center</h3>
              <p className="text-[11px] text-zinc-400">Expose literature review tools to Claude Desktop, Cursor, and Agent Sidecars</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tools Section */}
        <div className="my-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-zinc-300">Registered MCP Tools</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Protocol: {statusData?.protocol_version || '2024-11-05'}
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {statusData?.tools?.map((tool: any) => (
                <div
                  key={tool.name}
                  className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono font-medium text-sky-400 text-[11px]">{tool.name}</div>
                    <div className="text-[10px] text-zinc-400 truncate">{tool.description}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleTool(tool.name, tool.enabled)}
                    className="text-zinc-400 hover:text-zinc-200 cursor-pointer shrink-0"
                  >
                    {tool.enabled ? (
                      <ToggleRight className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-zinc-600" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Config Snippet */}
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                <span>Claude Desktop Configuration Snippet</span>
              </div>
              <button
                type="button"
                onClick={handleCopyConfig}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200 inline-flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="text-[10px] font-mono text-zinc-400 p-2 rounded bg-black/60 overflow-x-auto max-h-24">
              {configData?.config_json || '// Loading snippet...'}
            </pre>
            <div className="text-[10px] text-zinc-500">
              Paste this block inside <code className="text-zinc-400">%APPDATA%\Claude\claude_desktop_config.json</code> to enable full bidirectional synthesis from Claude Desktop.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
