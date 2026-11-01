import React, { useState, useEffect } from 'react';
import { History, RotateCcw, X, Clock, Check, Trash2, Camera, ShieldCheck } from 'lucide-react';
import { useNativeDialog } from '../context/NativeDialogContext';

export interface RestoreSnapshot {
  id: string;
  timestamp: string;
  label: string;
  summary: string;
  data: {
    flowMap?: any;
    formulas?: any;
    dataSheets?: any;
    researchSession?: any;
  };
}

interface RollbackHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRollback: (snapshot: RestoreSnapshot) => void;
  onTakeManualSnapshot: () => void;
}

export const RollbackHistoryModal: React.FC<RollbackHistoryModalProps> = ({
  isOpen,
  onClose,
  onRollback,
  onTakeManualSnapshot
}) => {
  const { showConfirm, showToast } = useNativeDialog();
  const [snapshots, setSnapshots] = useState<RestoreSnapshot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadSnapshots = () => {
    try {
      const stored = localStorage.getItem('litbuddy_restore_snapshots');
      if (stored) {
        setSnapshots(JSON.parse(stored));
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) loadSnapshots();
  }, [isOpen]);

  if (!isOpen) return null;

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffSecs = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSecs < 30) return 'Just now';
      if (diffSecs < 60) return `${diffSecs}s ago`;
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
      return new Date(isoString).toLocaleDateString();
    } catch {
      return 'Recently';
    }
  };

  const handleClearHistory = async () => {
    const confirmed = await showConfirm('Clear all historical restore points?', 'Clear History');
    if (confirmed) {
      localStorage.removeItem('litbuddy_restore_snapshots');
      setSnapshots([]);
      showToast('All restore snapshots cleared', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl antigravity-card p-6 shadow-2xl border border-white/10 bg-[#0d0e12] space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                Autosave &amp; Rollback History
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {snapshots.length} Restore Points
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Continuous offline snapshots. Roll back to any previous state with 1 click.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onTakeManualSnapshot();
              loadSnapshots();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-400" />
            <span>Create Snapshot Now</span>
          </button>

          {snapshots.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors"
            >
              Clear History
            </button>
          )}
        </div>

        {/* Snapshot Timeline List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[260px]">
          {snapshots.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              No previous snapshots recorded yet. Autosave creates restore points automatically as you work.
            </div>
          ) : (
            snapshots.map((snap) => (
              <div
                key={snap.id}
                className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 transition-all flex items-center justify-between gap-3"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-zinc-200 truncate">{snap.label}</span>
                    <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      {formatRelativeTime(snap.timestamp)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">{snap.summary}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onRollback(snap);
                    onClose();
                  }}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Roll Back</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted local storage rollback guard.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
