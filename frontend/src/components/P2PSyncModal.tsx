import React, { useState, useEffect } from 'react';
import { Network, Laptop, Tablet, RefreshCw, CheckCircle, ArrowLeftRight, X, ShieldCheck } from 'lucide-react';
import { getApiBase, getAuthHeader, gatherEodCommitPayload } from '../services/api';

interface P2PSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const P2PSyncModal: React.FC<P2PSyncModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [diffData, setDiffData] = useState<any>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [summaryMsg, setSummaryMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadDiff();
    }
  }, [isOpen]);

  const loadDiff = async () => {
    setLoading(true);
    setSyncSuccess(false);
    try {
      const res = await fetch(`${getApiBase()}/sync/eod/diff`, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setDiffData(data);
      }
    } catch (e) {
      console.error('Failed to load sync diff:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCommit = async () => {
    setLoading(true);
    try {
      const payload = gatherEodCommitPayload();
      const res = await fetch(`${getApiBase()}/sync/eod/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setSyncSuccess(true);
        setSummaryMsg(data.message || 'End-of-Day sync completed successfully.');
      }
    } catch (e) {
      console.error('Sync commit error:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-[#111216] border border-white/10 shadow-2xl p-6 text-zinc-200 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-100">End-of-Day P2P Vault Sync</h3>
              <p className="text-[11px] text-zinc-400">Reconcile tablet and desktop research without cloud servers</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="my-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-3">
              <Laptop className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <div className="text-[10px] text-zinc-400 font-mono">Desktop Workstation</div>
                <div className="text-sm font-semibold text-zinc-100">
                  {diffData ? `${diffData.vault_count} Papers` : 'Scanning...'}
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-3">
              <Tablet className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-[10px] text-zinc-400 font-mono">Mobile / Tablet Pad</div>
                <div className="text-sm font-semibold text-zinc-100">
                  {diffData ? `${diffData.notes_count} Notes` : 'Connected'}
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-zinc-400">
              <span>Security Guarantee</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" /> Direct Local Wi-Fi (0 Cloud Logs)
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 leading-relaxed">
              Bi-directional diff merges annotations, stylus strokes, and newly discovered papers into both devices simultaneously.
            </div>
          </div>

          {syncSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{summaryMsg}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
          <button
            type="button"
            onClick={loadDiff}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Rescan Local Network</span>
          </button>

          <button
            type="button"
            onClick={handleSyncCommit}
            disabled={loading || syncSuccess}
            className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>{loading ? 'Reconciling...' : '1-Click End-of-Day Sync'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
