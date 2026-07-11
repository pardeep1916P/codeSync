import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Button } from '../components/Button';
import { THEMES, getSavedThemeId, saveThemeId } from '../styles/themes';

const PrivateIcon: React.FC = () => (
  <svg className="w-4 h-4 text-rose-500 fill-none stroke-current shrink-0 animate-pulse" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const PublicIcon: React.FC = () => (
  <svg className="w-4 h-4 text-emerald-500 fill-none stroke-current shrink-0" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);

export const Popup: React.FC = () => {
  const store = useStore();
  const { initialize } = store;
  const [tokenInput, setTokenInput] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const [isQueueDropdownOpen, setIsQueueDropdownOpen] = useState(false);
  const [themeId, setThemeId] = useState('amoled');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const requestConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
        await onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  useEffect(() => {
    initialize();

    // Load initial theme
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['themeId'], (res) => {
        if (res.themeId) setThemeId(res.themeId);
      });
    } else {
      setThemeId(getSavedThemeId());
    }

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.settings) {
        initialize();
      }
      if (changes.themeId) {
        setThemeId(changes.themeId.newValue);
      }
    };

    const handleRuntimeMessage = (message: { action: string; payload: { problemTitle: string; error?: string; queueLength?: number } }) => {
      if (message.action === 'SYNC_SUCCESS') {
        showToast(`Synced "${message.payload.problemTitle}" successfully!`, 'success');
        initialize();
      } else if (message.action === 'SYNC_FAILED') {
        showToast(`Sync failed for "${message.payload.problemTitle}": ${message.payload.error}`, 'error');
      } else if (message.action === 'SUBMISSION_QUEUED') {
        showToast(`"${message.payload.problemTitle}" queued (${message.payload.queueLength} pending)`, 'success');
        initialize();
      }
    };

    let listenerActive = false;
    let messageListenerActive = false;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      listenerActive = true;
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleRuntimeMessage);
      messageListenerActive = true;
    }

    return () => {
      if (listenerActive && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
      if (messageListenerActive && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      }
    };
  }, [initialize]);

  useEffect(() => {
    if (!isRepoDropdownOpen && !isThemeDropdownOpen && !isQueueDropdownOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isRepoDropdownOpen && !target.closest('.repo-dropdown-container')) {
        setIsRepoDropdownOpen(false);
      }
      if (isThemeDropdownOpen && !target.closest('.theme-dropdown-container')) {
        setIsThemeDropdownOpen(false);
      }
      if (isQueueDropdownOpen && !target.closest('.queue-dropdown-container')) {
        setIsQueueDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isRepoDropdownOpen, isThemeDropdownOpen, isQueueDropdownOpen]);

  useEffect(() => {
    const activeTheme = THEMES[themeId] || THEMES.matrix;
    if (typeof document !== 'undefined') {
      document.body.style.backgroundColor = activeTheme.bg;
      document.documentElement.style.backgroundColor = activeTheme.bg;
    }
  }, [themeId]);

  const [pendingSubmissions, setPendingSubmissions] = useState<{ id: string; title: string; lang: string }[]>([]);

  useEffect(() => {
    const fetchPendingDetails = async () => {
      const list = [];
      for (const id of store.commitQueue) {
        const key = `sub_${id}`;
        let data = null;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const res = await new Promise<Record<string, unknown>>((resolve) => {
            chrome.storage.local.get([key], (val) => resolve(val || {}));
          });
          data = res[key] as { problem: { title: string }; language: string } | null;
        } else if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(key);
          if (raw) data = JSON.parse(raw);
        }
        if (data && data.problem) {
          list.push({ id, title: data.problem.title, lang: data.language });
        } else {
          list.push({ id, title: `Submission #${id}`, lang: '' });
        }
      }
      setPendingSubmissions(list);
    };
    fetchPendingDetails();
  }, [store.commitQueue]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    await store.login(tokenInput.trim());
  };

  const handleManualSync = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'TRIGGER_SYNC' }, (response) => {
        if (response?.success) {
          showToast('Sync triggered successfully!', 'success');
          store.initialize();
        } else {
          showToast(`Sync failed: ${response?.error || 'Unknown error'}`, 'error');
        }
      });
    } else {
      showToast('Manual sync simulation successful.', 'success');
    }
  };

  const openOptionsPage = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('../options/index.html', '_blank');
    }
  };

  const activeTheme = THEMES[themeId] || THEMES.matrix;
  const selectedRepoObj = store.repositories.find(r => r.full_name === store.selectedRepo);

  if (store.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full p-6 bg-black text-zinc-400 font-mono">
        <svg className="animate-spin h-7 w-7 text-white opacity-90 mb-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase animate-pulse">
          $ loading_codesync...
        </span>
      </div>
    );
  }

  return (
    <div 
      className="relative flex flex-col h-screen w-full p-5 font-mono select-none transition-all duration-300"
      style={{ backgroundColor: activeTheme.bg, color: activeTheme.text }}
    >
      {/* Terminal Title Bar */}
      <header className="flex items-center justify-between border-b pb-3.5 mb-4" style={{ borderColor: activeTheme.border }}>
        <div className="flex items-center gap-2">
          <span className="font-extrabold" style={{ color: activeTheme.accent }}>$</span>
          <span className="text-xs font-bold tracking-wider" style={{ color: activeTheme.textHighlight }}>codesync --status</span>
          {store.githubToken && (
            <span 
              className="text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 shrink-0"
              style={{
                backgroundColor: store.syncOnAccept ? 'rgba(34, 197, 94, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                color: store.syncOnAccept ? activeTheme.accent : '#f97316',
                border: `1px solid ${store.syncOnAccept ? 'rgba(34, 197, 94, 0.3)' : 'rgba(249, 115, 22, 0.3)'}`
              }}
              title={store.syncOnAccept ? "Auto Sync is enabled: solved problems are synced instantly" : "Auto Sync is disabled: solved problems will queue"}
            >
              <span className="h-1 w-1 rounded-full animate-pulse" style={{ backgroundColor: store.syncOnAccept ? activeTheme.accent : '#f97316' }}></span>
              {store.syncOnAccept ? 'AUTO' : 'QUEUE'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 relative theme-dropdown-container">
          {/* Theme Dropdown Toggle */}
          <button 
            onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
            className="p-1 rounded-lg border transition-all duration-150 flex items-center justify-center"
            style={{ 
              borderColor: activeTheme.border, 
              backgroundColor: activeTheme.inputBg,
              color: activeTheme.text 
            }}
            title="Switch theme"
          >
            <svg className="w-4 h-4 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          </button>

          {isThemeDropdownOpen && (
            <div className="absolute right-8 top-0 w-36 max-h-48 overflow-y-auto border rounded-xl shadow-2xl z-50 py-1 no-scrollbar"
                 style={{ 
                   backgroundColor: activeTheme.bg, 
                   borderColor: activeTheme.border 
                 }}>
              {Object.values(THEMES).map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setThemeId(t.id);
                    saveThemeId(t.id);
                    setIsThemeDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left text-[10px] font-bold tracking-wider uppercase transition-colors hover:bg-white/5"
                  style={{ 
                    color: themeId === t.id ? t.accent : activeTheme.text,
                  }}
                >
                  {t.name.split(' ')[0]}
                  {themeId === t.id && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.accent }}></span>
                  )}
                </button>
              ))}
            </div>
          )}

          <button 
            onClick={openOptionsPage}
            className="p-1 rounded-lg border transition-all duration-150 flex items-center justify-center"
            style={{ 
              borderColor: activeTheme.border, 
              backgroundColor: activeTheme.inputBg,
              color: activeTheme.text 
            }}
            title="Configure options"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col gap-4 overflow-visible pr-0.5">
        {store.error && (
          <div 
            className="border text-[11px] p-3.5 rounded-xl flex flex-col gap-0.5"
            style={{ 
              backgroundColor: activeTheme.dangerBg, 
              borderColor: activeTheme.dangerBorder, 
              color: activeTheme.dangerText 
            }}
          >
            <span className="font-bold flex items-center gap-1.5 uppercase tracking-wide">
              <svg className="w-3.5 h-3.5 stroke-current" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              SYSTEM_ERROR
            </span>
            <span className="opacity-90 leading-relaxed text-[10px]">{store.error}</span>
          </div>
        )}

        {!store.githubToken ? (
          /* Authentication Screen */
          <div className="flex-1 flex flex-col justify-center gap-4">
            <button 
              onClick={() => store.loginOAuth()} 
              className="w-full flex items-center justify-center gap-2.5 font-bold py-2.5 px-4 rounded-xl shadow transition-all duration-150 active:scale-95 text-xs tracking-wider uppercase"
              style={{ backgroundColor: activeTheme.textHighlight, color: activeTheme.bg }}
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              AUTHENTICATE_OAUTH
            </button>

            <div className="flex items-center my-1 text-[9px] font-bold tracking-wider uppercase opacity-50">
              <div className="flex-grow border-t" style={{ borderColor: activeTheme.border }}></div>
              <span className="px-2">OR_USE_ACCESS_TOKEN</span>
              <div className="flex-grow border-t" style={{ borderColor: activeTheme.border }}></div>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[9px] font-bold mb-1.5 tracking-wider uppercase opacity-55">
                  github_pat_token
                </label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="ghp_..."
                  className="w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-none transition-all duration-150 font-mono"
                  style={{ 
                    backgroundColor: activeTheme.inputBg, 
                    borderColor: activeTheme.border,
                    color: activeTheme.textHighlight
                  }}
                  required
                />
              </div>
              <Button 
                type="submit" 
                variant="secondary" 
                className="w-full py-2.5 text-xs font-bold tracking-wider uppercase border"
                style={{ 
                  backgroundColor: activeTheme.inputBg, 
                  borderColor: activeTheme.border,
                  color: activeTheme.textHighlight
                }}
              >
                CONNECT_WITH_PAT
              </Button>
              <p className="text-[10px] text-center leading-normal px-2 opacity-50">
                Generate a token with <code className="px-1 py-0.5 rounded font-mono text-[9px]" style={{ backgroundColor: activeTheme.inputBg, color: activeTheme.accent }}>repo</code> scope to sync.
              </p>
            </form>
          </div>
        ) : (
          /* Main Dashboard Status Screen */
          <div className="flex flex-col gap-4">
            {/* User Profile Card */}
            <div className="border rounded-2xl p-3.5 flex items-center gap-3.5" style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}>
              <img 
                src={store.user?.avatar_url || 'https://github.com/identicons/guest.png'} 
                alt={store.user?.login || 'User'} 
                className="w-11 h-11 rounded-full border bg-zinc-900"
                style={{ borderColor: activeTheme.border }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: activeTheme.textHighlight }}>
                  {store.user?.login}
                </p>
                <p className="text-[9px] font-bold flex items-center gap-1 uppercase tracking-wider" style={{ color: activeTheme.accent }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: activeTheme.accent }}></span>
                  GITHUB_ACTIVE
                </p>
              </div>
              <button 
                onClick={() => store.logout()}
                className="text-[9px] font-bold border px-2.5 py-1.5 rounded-xl transition-all duration-150 tracking-wider uppercase"
                style={{ 
                  backgroundColor: activeTheme.dangerBg, 
                  borderColor: activeTheme.dangerBorder,
                  color: activeTheme.dangerText 
                }}
              >
                LOGOUT
              </button>
            </div>

            {/* Configured Repository */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-bold tracking-wider uppercase opacity-55">
                  TARGET_REPOSITORY
                </label>
                {store.githubToken && store.selectedRepo && (
                  <span className="text-[9px] font-extrabold tracking-wider uppercase" style={{ color: activeTheme.accent }}>
                    SOLVED: {store.solvedCount}
                  </span>
                )}
              </div>
              {store.repositories.length === 0 ? (
                <div className="text-[11px] border rounded-xl p-3 leading-relaxed" style={{ backgroundColor: activeTheme.dangerBg, borderColor: activeTheme.dangerBorder, color: activeTheme.dangerText }}>
                  No repositories found. Ensure your token/connection has permissions to access your repositories.
                </div>
              ) : (
                <div className="relative repo-dropdown-container">
                  <button
                    onClick={() => setIsRepoDropdownOpen(!isRepoDropdownOpen)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 border rounded-xl text-xs font-semibold hover:bg-white/5 transition-all duration-150"
                    style={{ 
                      backgroundColor: activeTheme.inputBg, 
                      borderColor: activeTheme.border,
                      color: activeTheme.textHighlight
                    }}
                  >
                    <span className="flex items-center gap-2">
                      {selectedRepoObj ? (
                        <>
                          {selectedRepoObj.private ? <PrivateIcon /> : <PublicIcon />}
                          <span className="truncate">{selectedRepoObj.full_name}</span>
                        </>
                      ) : (
                        <span style={{ color: activeTheme.text }} className="opacity-50">Select repository...</span>
                      )}
                    </span>
                    <svg className="fill-current h-4 w-4 transition-transform duration-150" style={{ color: activeTheme.text, transform: isRepoDropdownOpen ? 'rotate(180deg)' : 'none' }} viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </button>
                  
                  {isRepoDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1.5 max-h-60 overflow-y-auto border rounded-xl shadow-2xl z-50 py-1 repo-dropdown-scrollbar"
                         style={{ 
                           backgroundColor: activeTheme.bg, 
                           borderColor: activeTheme.border 
                         }}>
                      {store.repositories.map((repo) => (
                        <button
                          key={repo.id}
                          onClick={() => {
                            store.selectRepo(repo.full_name);
                            setIsRepoDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left text-xs font-semibold transition-all duration-150 hover:bg-white/5"
                          style={{ 
                            color: store.selectedRepo === repo.full_name ? activeTheme.textHighlight : activeTheme.text,
                            backgroundColor: store.selectedRepo === repo.full_name ? 'rgba(255,255,255,0.03)' : 'transparent'
                          }}
                        >
                          {repo.private ? <PrivateIcon /> : <PublicIcon />}
                          <span className="truncate">{repo.full_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

             {/* Queue and Sync Action */}
             <div className="border rounded-2xl p-4 flex flex-col gap-4" style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}>
               
               <div className="flex items-center justify-between">
                 <span className="text-[9px] font-bold tracking-wider uppercase opacity-55">SYNC_STATUS</span>
               </div>

               {/* Action Buttons */}
               <div className="flex gap-2">
                 <Button 
                    onClick={handleManualSync} 
                    disabled={!store.selectedRepo || store.isSyncing}
                    className="flex-1 py-2.5 text-xs font-bold tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2"
                    style={{ 
                      backgroundColor: store.isSyncing ? activeTheme.cardBg : activeTheme.accent, 
                      color: store.isSyncing ? activeTheme.text : activeTheme.bg,
                      borderColor: activeTheme.border,
                      borderWidth: store.isSyncing ? '1px' : '0px'
                    }}
                  >
                    {store.isSyncing ? (
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

                 {store.commitQueue.length > 0 && (
                   <button
                     onClick={() => {
                        requestConfirm(
                          'CLEAR QUEUE',
                          'Are you sure you want to clear the entire pending sync queue?',
                          async () => {
                            await store.clearQueue();
                            showToast('Queue cleared.', 'success');
                          }
                        );
                      }}
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

               {/* Collapsible Queue Dropdown (placed below the buttons) */}
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
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: store.commitQueue.length > 0 ? activeTheme.dangerText : activeTheme.accent }}></span>
                       <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: store.commitQueue.length > 0 ? activeTheme.dangerText : activeTheme.accent }}></span>
                     </span>
                     <span>{store.commitQueue.length} PENDING</span>
                   </span>
                   <svg className="fill-current h-4 w-4 transition-transform duration-150 text-zinc-400" style={{ transform: isQueueDropdownOpen ? 'rotate(180deg)' : 'none' }} viewBox="0 0 20 20">
                     <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                   </svg>
                 </button>

                 {/* Dropdown list of pending items (floating downwards) */}
                 {isQueueDropdownOpen && (
                   <div className="absolute left-0 right-0 top-full mt-1.5 max-h-36 overflow-y-auto border rounded-xl shadow-2xl z-50 py-1.5 px-2 flex flex-col gap-1 repo-dropdown-scrollbar"
                        style={{ 
                          backgroundColor: activeTheme.bg, 
                          borderColor: activeTheme.border 
                        }}>
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
                               store.removeItemFromQueue(sub.id);
                               showToast('Item removed from queue.', 'success');
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
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-[9px] text-center font-bold mt-4 border-t pt-3 tracking-wider uppercase opacity-40" style={{ borderColor: activeTheme.border }}>
        codesync v1.0.0
      </footer>

      {/* Toast Notification */}
      {toast && (
        <div 
          className="absolute bottom-4 left-4 right-4 p-3.5 rounded-xl text-[11px] font-bold shadow-2xl border flex items-center justify-between transition-all duration-300 transform translate-y-0 z-50"
          style={{ 
            backgroundColor: toast.type === 'success' ? activeTheme.bg : activeTheme.dangerBg, 
            borderColor: toast.type === 'success' ? activeTheme.border : activeTheme.dangerBorder,
            color: toast.type === 'success' ? activeTheme.accent : activeTheme.dangerText
          }}
        >
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: toast.type === 'success' ? activeTheme.accent : activeTheme.dangerText }}></span>
            {toast.message}
          </span>
          <button onClick={() => setToast(null)} className="p-0.5 hover:bg-white/10 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div 
          className="absolute inset-0 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
        >
          <div 
            className="w-full max-w-[280px] border rounded-2xl p-5 flex flex-col gap-4 shadow-2xl animate-scale-up"
            style={{ 
              backgroundColor: activeTheme.bg === '#000000' ? '#09090b' : activeTheme.bg, 
              borderColor: activeTheme.border 
            }}
          >
            <div className="flex flex-col gap-1.5">
              <span 
                className="text-[9px] font-extrabold tracking-widest uppercase opacity-65"
                style={{ color: activeTheme.text }}
              >
                {confirmModal.title}
              </span>
              <p 
                className="text-xs font-semibold leading-relaxed"
                style={{ color: activeTheme.textHighlight }}
              >
                {confirmModal.message}
              </p>
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2 text-xs font-bold tracking-wider uppercase border rounded-xl hover:opacity-85 transition-all"
                style={{ 
                  borderColor: activeTheme.border, 
                  color: activeTheme.textHighlight,
                  backgroundColor: 'rgba(255, 255, 255, 0.03)'
                }}
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                }}
                className="flex-1 py-2 text-xs font-bold tracking-wider uppercase rounded-xl hover:opacity-85 transition-all"
                style={{ 
                  backgroundColor: activeTheme.dangerBg, 
                  borderColor: activeTheme.dangerBorder, 
                  color: activeTheme.dangerText,
                  borderWidth: '1px'
                }}
              >
                CLEAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
