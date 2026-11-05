import React, { useState, useEffect } from 'react';
import { 
  DownloadCloud, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  X, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  FileText
} from 'lucide-react';

interface UpdateInfo {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  release_name: string;
  release_notes: string;
  published_at: string;
  asset_id?: number;
  download_url?: string;
  asset_name?: string;
  asset_size_bytes: number;
}

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose }) => {
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [downloadReady, setDownloadReady] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkForUpdates();
    }
  }, [isOpen]);

  const checkForUpdates = async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch('/api/updater/check');
      if (res.ok) {
        const data = await res.json();
        setUpdateInfo(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || 'Failed to check for updates.');
      }
    } catch (e: any) {
      setError(e.message || 'Network error checking release channel.');
    } finally {
      setChecking(false);
    }
  };

  const handleStartDownload = async () => {
    if (!updateInfo) return;
    setDownloading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (updateInfo.asset_id) {
        queryParams.set('asset_id', updateInfo.asset_id.toString());
      }
      if (updateInfo.download_url) {
        queryParams.set('asset_url', updateInfo.download_url);
      }
      if (updateInfo.latest_version) {
        queryParams.set('version', updateInfo.latest_version);
      }

      const res = await fetch(`/api/updater/download?${queryParams.toString()}`, {
        method: 'POST'
      });
      if (res.ok) {
        // Start polling status
        pollDownloadStatus();
      } else {
        setError('Failed to initiate update download.');
        setDownloading(false);
      }
    } catch (e: any) {
      setError(e.message || 'Download initialization error.');
      setDownloading(false);
    }
  };

  const pollDownloadStatus = () => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/updater/status');
        if (res.ok) {
          const status = await res.json();
          if (status.status === 'downloading') {
            setDownloadPercent(status.percent || 0);
          } else if (status.status === 'ready') {
            clearInterval(interval);
            setDownloading(false);
            setDownloadReady(true);
          } else if (status.status === 'error') {
            clearInterval(interval);
            setDownloading(false);
            setError(status.error_message || 'Download failed.');
          }
        }
      } catch (e) {
        clearInterval(interval);
        setDownloading(false);
      }
    }, 1000);
  };

  const handleApplyUpdate = async () => {
    setApplying(true);
    try {
      const res = await fetch('/api/updater/apply', { method: 'POST' });
      if (res.ok) {
        // App will exit and restart automatically
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || 'Failed to apply update.');
        setApplying(false);
      }
    } catch (e: any) {
      setError(e.message || 'Error executing update.');
      setApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <RefreshCw className={`w-4 h-4 text-zinc-400 ${checking ? 'animate-spin' : ''}`} />
            <h2 className="text-sm font-semibold text-zinc-100">Software Updates</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4">
          {checking && (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-zinc-400">
              <RefreshCw className="w-6 h-6 animate-spin text-zinc-500" />
              <span className="text-xs">Checking official release channel...</span>
            </div>
          )}

          {error && !checking && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg flex items-start gap-3 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div>
                <div className="font-medium">Update Check Notice</div>
                <div className="text-red-400/90 mt-0.5">{error}</div>
              </div>
            </div>
          )}

          {updateInfo && !checking && (
            <>
              {/* Version Comparison Card */}
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Installed Version</div>
                  <div className="text-sm font-mono text-zinc-300 mt-0.5">v{updateInfo.current_version}</div>
                </div>

                <ChevronRight className="w-4 h-4 text-zinc-600" />

                <div>
                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Latest Release</div>
                  <div className="text-sm font-mono text-zinc-100 mt-0.5">v{updateInfo.latest_version}</div>
                </div>

                <div>
                  {updateInfo.update_available ? (
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-950 text-blue-400 border border-blue-800/60">
                      Update Available
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" /> Up to Date
                    </span>
                  )}
                </div>
              </div>

              {/* Release Notes / What's Fixed */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-zinc-400" />
                  Release Notes & Changelog ({updateInfo.release_name})
                </div>
                <div className="max-h-48 overflow-y-auto p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/80 text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed font-sans">
                  {updateInfo.release_notes}
                </div>
              </div>

              {/* Download Progress */}
              {downloading && (
                <div className="space-y-2 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Downloading update in background...</span>
                    <span className="font-mono">{downloadPercent}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-1.5 transition-all duration-300 ease-out" 
                      style={{ width: `${downloadPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-900/30 flex items-center justify-between text-xs">
          <button
            onClick={checkForUpdates}
            disabled={checking || downloading}
            className="text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            Check Again
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
            >
              Close
            </button>

            {updateInfo?.update_available && !downloadReady && (
              <button
                onClick={handleStartDownload}
                disabled={downloading || !updateInfo.download_url}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                {downloading ? 'Downloading...' : '1-Click Update'}
              </button>
            )}

            {downloadReady && (
              <button
                onClick={handleApplyUpdate}
                disabled={applying}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {applying ? 'Restarting...' : 'Restart & Apply Update'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
