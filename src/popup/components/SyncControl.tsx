import React from 'react';
import { Theme } from '../../styles/themes';
import { Button } from '../../components/Button';

interface PendingSubmission {
  id: string;
  title: string;
  lang: string;
}

interface SyncControlProps {
  hasToken: boolean;
  syncOnAccept: boolean;
  selectedRepo: string | null;
  isSyncing: boolean;
  commitQueue: string[];
  pendingSubmissions: PendingSubmission[];
  isQueueDropdownOpen: boolean;
  setIsQueueDropdownOpen: (open: boolean) => void;
  onManualSync: () => void;
  onRequestClearQueue: () => void;
  onRemoveItemFromQueue: (id: string) => void;
  activeTheme: Theme;
}

export const SyncControl: React.FC<SyncControlProps> = ({
  hasToken,
  syncOnAccept,
  selectedRepo,
  isSyncing,
  commitQueue,
  pendingSubmissions,
  isQueueDropdownOpen,
  setIsQueueDropdownOpen,
  onManualSync,
  onRequestClearQueue,
  onRemoveItemFromQueue,
  activeTheme,
}) => {
  return (
    <div 
      className="border rounded-2xl p-4 flex flex-col gap-4" 
      style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold tracking-wider uppercase opacity-55">SYNC_STATUS</span>
        {hasToken && (
          <span 
            className="text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 shrink-0 animate-fade-in"
            style={{
              backgroundColor: syncOnAccept ? 'rgba(34, 197, 94, 0.12)' : 'rgba(249, 115, 22, 0.12)',
              color: syncOnAccept ? activeTheme.accent : '#f97316',
              border: `1px solid ${syncOnAccept ? 'rgba(34, 197, 94, 0.25)' : 'rgba(249, 115, 22, 0.25)'}`
            }}
            title={syncOnAccept ? "Auto Sync is enabled: solved problems are synced instantly" : "Auto Sync is disabled: solved problems will queue"}
          >
            <span className="h-1 w-1 rounded-full animate-pulse" style={{ backgroundColor: syncOnAccept ? activeTheme.accent : '#f97316' }}></span>
            {syncOnAccept ? 'AUTO_SYNC: ACTIVE' : 'AUTO_SYNC: INACTIVE'}
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button 
          onClick={onManualSync} 
          disabled={!selectedRepo || isSyncing || commitQueue.length === 0}
          className="flex-1 py-2.5 text-xs font-bold tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2"
          style={{ 
            backgroundColor: (isSyncing || commitQueue.length === 0) ? activeTheme.cardBg : activeTheme.accent, 
            color: (isSyncing || commitQueue.length === 0) ? activeTheme.text : activeTheme.bg,
            borderColor: activeTheme.border,
            borderWidth: (isSyncing || commitQueue.length === 0) ? '1px' : '0px'
          }}
        >
          {isSyncing ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>SYNCING...</span>
            </>
          ) : (
            'TRIGGER_SYNC'
          )}
        </Button>

        {commitQueue.length > 0 && (
          <button
            onClick={onRequestClearQueue}
            className="px-3 border rounded-xl hover:opacity-85 transition-all flex items-center justify-center"
            style={{ 
              borderColor: activeTheme.dangerBorder, 
              backgroundColor: activeTheme.dangerBg,
              color: activeTheme.dangerText 
            }}
            title="Clear queue"
          >
            <svg className="w-4 h-4 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        )}
      </div>

      {/* Collapsible Queue Dropdown */}
      <div className="relative queue-dropdown-container flex flex-col gap-2">
        <button
          onClick={() => setIsQueueDropdownOpen(!isQueueDropdownOpen)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 border rounded-xl text-xs font-semibold hover:bg-white/5 transition-all duration-150"
          style={{ 
            backgroundColor: activeTheme.inputBg, 
            borderColor: activeTheme.border,
            color: activeTheme.textHighlight
          }}
        >
          <span className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: commitQueue.length > 0 ? activeTheme.dangerText : activeTheme.accent }}></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: commitQueue.length > 0 ? activeTheme.dangerText : activeTheme.accent }}></span>
            </span>
            <span>{commitQueue.length} PENDING</span>
          </span>
          <svg className="fill-current h-4 w-4 transition-transform duration-150 text-zinc-400" style={{ transform: isQueueDropdownOpen ? 'rotate(180deg)' : 'none' }} viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </button>

        {/* Dropdown list of pending items */}
        {isQueueDropdownOpen && (
          <div 
            className="absolute left-0 right-0 top-full mt-1.5 max-h-36 overflow-y-auto border rounded-xl shadow-2xl z-50 py-1.5 px-2 flex flex-col gap-1 repo-dropdown-scrollbar"
            style={{ 
              backgroundColor: activeTheme.bg, 
              borderColor: activeTheme.border 
            }}
          >
            {pendingSubmissions.length === 0 ? (
              <div className="text-[10px] text-center py-2 opacity-50 font-semibold uppercase">
                Queue is empty
              </div>
            ) : (
              pendingSubmissions.map((sub) => (
                <div 
                  key={sub.id} 
                  className="flex items-center justify-between text-[10px] py-1.5 px-2.5 border rounded-xl transition-all"
                  style={{ backgroundColor: activeTheme.inputBg, borderColor: activeTheme.border }}
                >
                  <span className="truncate max-w-[190px]" style={{ color: activeTheme.textHighlight }}>
                    {sub.title} <span className="opacity-40">[{sub.lang}]</span>
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItemFromQueue(sub.id);
                    }}
                    className="hover:scale-110 active:scale-95 transition-all p-0.5 rounded"
                    style={{ color: activeTheme.dangerText }}
                    title="Remove from queue"
                  >
                    <svg className="w-3.5 h-3.5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
