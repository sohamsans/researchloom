import React, { useState, useEffect } from 'react';
import {
  Download,
  FolderOpen,
  FileText,
  Trash2,
  ExternalLink,
  Search,
  HardDrive,
  RefreshCw,
  Archive,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';

interface DownloadItem {
  vault_id: string;
  doi: string | null;
  title: string;
  file_path: string;
  file_size_bytes: number;
  source_resolved: string;
  download_count: number;
  file_exists: boolean;
  created_at: string | null;
  has_figures: boolean;
  has_fulltext: boolean;
}

interface DownloadManagerViewProps {
  onOpenPdf: (vaultId: string, title: string) => void;
}

export const DownloadManagerView: React.FC<DownloadManagerViewProps> = ({ onOpenPdf }) => {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [vaultDir, setVaultDir] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchDownloads = async () => {
    setIsLoading(true);
    try {
      const data = await api.listVaultDownloads();
      setDownloads(data.items || []);
      setTotalFiles(data.total_files || 0);
      setTotalBytes(data.total_bytes || 0);
      setVaultDir(data.vault_dir || '');
    } catch (e: any) {
      console.error('Failed to load downloads:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDownloads();
  }, []);

  const handleOpenFolder = async () => {
    try {
      await api.openVaultFolder();
      setActionNotice('Opened PDF vault directory in File Explorer.');
      setTimeout(() => setActionNotice(null), 3500);
    } catch (e: any) {
      setActionNotice(e.message || 'Could not reveal folder.');
      setTimeout(() => setActionNotice(null), 3500);
    }
  };

  const handleDelete = async (vaultId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}" from the local vault?`)) return;
    try {
      await api.deleteVaultedFile(vaultId);
      setDownloads((prev) => prev.filter((d) => d.vault_id !== vaultId));
      setTotalFiles((prev) => Math.max(0, prev - 1));
      setActionNotice(`Deleted "${title.slice(0, 40)}..." from vault.`);
      setTimeout(() => setActionNotice(null), 3000);
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    }
  };

  const handleBulkZip = async () => {
    if (downloads.length === 0) return;
    const papers = downloads.map((d) => ({
      id: d.vault_id,
      title: d.title,
      doi: d.doi,
      authors: [],
      year: null
    }));
    try {
      setActionNotice('Creating bulk ZIP archive...');
      await api.bulkDownloadPapers(papers);
      setActionNotice('ZIP archive generated and downloaded!');
      setTimeout(() => setActionNotice(null), 3000);
    } catch (e: any) {
      alert(`Bulk ZIP failed: ${e.message}`);
    }
  };

  const handleSyncVault = async () => {
    try {
      setActionNotice('Scanning disk for unregistered PDFs...');
      const result = await api.syncVaultDisk();
      setActionNotice(result.message);
      setTimeout(() => setActionNotice(null), 5000);
      // Refresh the list to show newly synced files
      await fetchDownloads();
    } catch (e: any) {
      alert(`Vault sync failed: ${e.message}`);
      setActionNotice(null);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const filteredDownloads = downloads.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      (d.doi && d.doi.toLowerCase().includes(q)) ||
      d.source_resolved.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 flex flex-col space-y-6 overflow-y-auto animate-fade-in">
      {/* Header & Stats Banner */}
      <div className="bg-[#1e1f20] border border-[#3c4043] rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#8ab4f8]/10 text-[#8ab4f8] rounded-2xl border border-[#8ab4f8]/20">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#e3e3e3]">Document Downloads & Vault</h1>
              <p className="text-xs text-[#9aa0a6]">
                Offline 0ms local storage with high-yield academic resolvers
              </p>
            </div>
          </div>

          {vaultDir && (
            <div className="flex items-center gap-2 pt-2 text-[11px] text-[#5f6368] font-mono truncate max-w-xl">
              <HardDrive className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{vaultDir}</span>
            </div>
          )}
        </div>

        {/* Quick Stats & Folder Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 bg-[#131314] border border-[#3c4043] rounded-2xl text-center">
            <div className="text-lg font-bold text-[#8ab4f8]">{totalFiles}</div>
            <div className="text-[10px] text-[#9aa0a6] uppercase tracking-wider font-semibold">Vaulted PDFs</div>
          </div>

          <div className="px-4 py-2 bg-[#131314] border border-[#3c4043] rounded-2xl text-center">
            <div className="text-lg font-bold text-[#34d399]">{formatBytes(totalBytes)}</div>
            <div className="text-[10px] text-[#9aa0a6] uppercase tracking-wider font-semibold">Storage Used</div>
          </div>

          <button
            onClick={handleOpenFolder}
            className="inline-flex items-center gap-2 px-4 py-3 bg-[#282a2c] hover:bg-[#3c4043] border border-[#3c4043] text-[#e3e3e3] rounded-2xl text-xs font-medium transition-colors shadow-sm"
            title="Open storage folder in Windows File Explorer"
          >
            <FolderOpen className="w-4 h-4 text-[#8ab4f8]" />
            <span>Open Folder</span>
          </button>

          <button
            onClick={handleSyncVault}
            className="inline-flex items-center gap-2 px-4 py-3 bg-[#282a2c] hover:bg-[#3c4043] border border-[#34d399]/30 text-[#34d399] rounded-2xl text-xs font-medium transition-colors shadow-sm"
            title="Scan the LitBuddy Papers folder and register any PDFs not yet in the vault database"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Sync Vault</span>
          </button>

          <button
            onClick={handleBulkZip}
            disabled={downloads.length === 0}
            className="inline-flex items-center gap-2 px-4 py-3 bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#131314] rounded-2xl text-xs font-semibold transition-colors shadow-lg shadow-[#8ab4f8]/10 disabled:opacity-50"
            title="Package all vaulted papers into a single ZIP file"
          >
            <Archive className="w-4 h-4" />
            <span>Export All (ZIP)</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="px-4 py-2.5 bg-[#8ab4f8]/10 border border-[#8ab4f8]/30 rounded-2xl text-xs text-[#8ab4f8] flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex items-center justify-between gap-4 bg-[#1e1f20] border border-[#3c4043] rounded-2xl p-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa0a6]" />
          <input
            type="text"
            placeholder="Search downloaded papers by title, DOI, or source..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#131314] border border-[#3c4043] rounded-xl text-xs text-[#e3e3e3] placeholder-[#5f6368] focus:outline-none focus:border-[#8ab4f8] transition-colors"
          />
        </div>

        <button
          onClick={fetchDownloads}
          disabled={isLoading}
          className="p-2 text-[#9aa0a6] hover:text-[#e3e3e3] hover:bg-[#282a2c] rounded-xl border border-[#3c4043] transition-colors"
          title="Refresh download list"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Downloads List Table */}
      <div className="bg-[#1e1f20] border border-[#3c4043] rounded-3xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-6 h-6 text-[#8ab4f8] animate-spin mx-auto" />
            <p className="text-xs text-[#9aa0a6]">Reading document vault records...</p>
          </div>
        ) : filteredDownloads.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <FileText className="w-10 h-10 text-[#5f6368] mx-auto" />
            <p className="text-sm font-medium text-[#e3e3e3]">No downloaded papers found</p>
            <p className="text-xs text-[#9aa0a6] max-w-sm mx-auto">
              {search
                ? 'Try a different search keyword.'
                : 'Papers downloaded during your literature searches will appear here for 0ms offline access.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#3c4043]">
            {filteredDownloads.map((item) => (
              <div
                key={item.vault_id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#282a2c]/50 transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className="p-2.5 bg-[#131314] rounded-xl border border-[#3c4043] text-[#8ab4f8] flex-shrink-0 mt-0.5">
                    <FileText className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <h3 className="text-sm font-semibold text-[#e3e3e3] leading-snug line-clamp-2">
                      {item.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-[#9aa0a6]">
                      <span className="px-2 py-0.5 bg-[#131314] border border-[#3c4043] rounded-md font-mono text-[10px] text-[#8ab4f8]">
                        {item.source_resolved.toUpperCase()}
                      </span>

                      <span>•</span>
                      <span className="text-[#34d399] font-medium">{formatBytes(item.file_size_bytes)}</span>

                      {item.doi && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[#9aa0a6] truncate max-w-[200px]">{item.doi}</span>
                        </>
                      )}

                      {item.created_at && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </>
                      )}

                      {item.has_figures && (
                        <>
                          <span>•</span>
                          <span className="px-1.5 py-0.5 bg-[#c084fc]/10 text-[#c084fc] border border-[#c084fc]/20 rounded text-[10px]">
                            Figures Parsed
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => onOpenPdf(item.vault_id, item.title)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#8ab4f8]/10 hover:bg-[#8ab4f8]/20 border border-[#8ab4f8]/30 text-[#8ab4f8] rounded-xl text-xs font-medium transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Read PDF</span>
                  </button>

                  <a
                    href={api.getVaultDownloadUrl(item.vault_id)}
                    download
                    className="p-2 text-[#9aa0a6] hover:text-[#e3e3e3] hover:bg-[#131314] rounded-xl border border-[#3c4043] transition-colors"
                    title="Download to PC"
                  >
                    <Download className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => handleDelete(item.vault_id, item.title)}
                    className="p-2 text-[#9aa0a6] hover:text-red-400 hover:bg-[#131314] rounded-xl border border-[#3c4043] transition-colors"
                    title="Delete PDF from local vault"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
