import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Button } from '../components/Button';
import { THEMES, getSavedThemeId } from '../styles/themes';

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

export const Options: React.FC = () => {
  const store = useStore();
  const { initialize } = store;
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false);
  const [themeId, setThemeId] = useState('amoled');

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
    if (!isRepoDropdownOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.repo-dropdown-container')) {
        setIsRepoDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isRepoDropdownOpen]);

  useEffect(() => {
    const activeTheme = THEMES[themeId] || THEMES.matrix;
    if (typeof document !== 'undefined') {
      document.body.style.backgroundColor = activeTheme.bg;
      document.documentElement.style.backgroundColor = activeTheme.bg;
    }
  }, [themeId]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleToggleSync = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await store.setSyncOnAccept(e.target.checked);
  };

  const handleClearQueue = async () => {
    if (confirm('Are you sure you want to clear the pending sync queue?')) {
      await store.logout(); // Simple reset
      showToast('Cleared settings successfully.', 'success');
      store.initialize();
    }
  };

  const activeTheme = THEMES[themeId] || THEMES.matrix;
  const selectedRepoObj = store.repositories.find(r => r.full_name === store.selectedRepo);

  return (
    <div 
      className="flex flex-col gap-8 font-mono select-none p-8 rounded-2xl border transition-all duration-300 w-full"
      style={{ backgroundColor: activeTheme.bg, color: activeTheme.text, borderColor: activeTheme.border }}
    >
      {/* Title */}
      <header className="border-b pb-5" style={{ borderColor: activeTheme.border }}>
        <h1 className="text-xl font-black flex items-center gap-2" style={{ color: activeTheme.textHighlight }}>
          <span className="font-extrabold" style={{ color: activeTheme.accent }}>$</span>
          <span>codesync --config</span>
        </h1>
        <p className="text-xs mt-1.5 leading-relaxed opacity-60">
          Configure synchronization settings, repository target layout, and clean state.
        </p>
      </header>

      {/* Main Settings Form */}
      <main className="flex flex-col gap-8">
        {/* Connection & Auth Status */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold tracking-wider uppercase opacity-55">1. GitHub Authentication</h2>
          <div className="border rounded-2xl p-5 flex items-center justify-between" style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}>
            {store.githubToken ? (
              <div className="flex items-center gap-4">
                <img
                  src={store.user?.avatar_url || 'https://github.com/identicons/guest.png'}
                  alt={store.user?.login || 'User'}
                  className="w-12 h-12 rounded-full border bg-zinc-900"
                  style={{ borderColor: activeTheme.border }}
                />
                <div>
                  <p className="text-sm font-bold" style={{ color: activeTheme.textHighlight }}>{store.user?.login}</p>
                  <p className="text-[10px] font-bold flex items-center gap-1.5 uppercase tracking-wider mt-0.5" style={{ color: activeTheme.accent }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: activeTheme.accent }}></span>
                    STATUS: ACTIVE_OAUTH_SESSION
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold opacity-80">Disconnected</p>
                <p className="text-xs mt-1 leading-relaxed opacity-55">Please authenticate using the popup page to begin syncing solutions.</p>
              </div>
            )}
            {store.githubToken && (
              <Button
                variant="danger"
                onClick={() => {
                  store.logout();
                  showToast('Disconnected from GitHub', 'success');
                }}
                className="text-xs uppercase tracking-wider"
                style={{ 
                  backgroundColor: activeTheme.dangerBg, 
                  borderColor: activeTheme.dangerBorder,
                  color: activeTheme.dangerText 
                }}
              >
                Disconnect
              </Button>
            )}
          </div>
        </section>

        {/* Sync Trigger Settings */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold tracking-wider uppercase opacity-55">2. Sync Rules</h2>
          <div className="border rounded-2xl p-5 flex flex-col gap-5" style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}>
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-6">
                <span className="text-xs font-bold" style={{ color: activeTheme.textHighlight }}>Instant sync on Acceptance</span>
                <span className="text-[11px] block leading-relaxed mt-0.5 opacity-60">
                  Automatically synchronize your solution as soon as you submit an accepted answer on LeetCode.
                </span>
              </div>
              <label htmlFor="syncOnAccept" className="relative inline-flex items-center cursor-pointer mt-1">
                <input
                  id="syncOnAccept"
                  type="checkbox"
                  checked={store.syncOnAccept}
                  onChange={handleToggleSync}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 rounded-full peer transition-all peer-focus:outline-none peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-zinc-400 after:rounded-full after:h-4 after:w-4 after:transition-all"
                     style={{
                       backgroundColor: store.syncOnAccept ? activeTheme.accent : activeTheme.inputBg
                     }}
                ></div>
              </label>
            </div>

            <div className="border-t pt-5" style={{ borderColor: activeTheme.border }}>
              <label className="text-xs font-bold block mb-2 tracking-wider uppercase opacity-55">
                Target Repository
              </label>
              {store.githubToken ? (
                <div className="flex flex-col gap-2">
                  <div className="relative w-full max-w-md repo-dropdown-container">
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
                  <p className="text-[10px] leading-relaxed mt-1 opacity-60">
                    We will save files under directory structures named after the problem slug inside this repo.
                  </p>
                </div>
              ) : (
                <div className="text-xs font-bold italic p-3 rounded-xl border" style={{ backgroundColor: activeTheme.dangerBg, borderColor: activeTheme.dangerBorder, color: activeTheme.dangerText }}>
                  Authenticate your GitHub account to choose a target repository.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Directory Customization */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold tracking-wider uppercase opacity-55">3. Repository Structure Layout (Future)</h2>
          <div className="border rounded-2xl p-5 flex flex-col gap-2.5" style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}>
            <p className="text-xs leading-relaxed opacity-60">
              Customize directory templates. Default: <code className="px-2 py-1 rounded border text-[10px] font-mono" style={{ backgroundColor: activeTheme.inputBg, borderColor: activeTheme.border, color: activeTheme.accent }}>{`{platform}/{problem_slug}/`}</code>
            </p>
            <div className="flex gap-2.5 mt-1.5 max-w-md">
              <input
                type="text"
                disabled
                placeholder="{platform}/{problem_slug}/"
                className="flex-1 px-3.5 py-2.5 border rounded-xl text-xs cursor-not-allowed font-mono"
                style={{ 
                  backgroundColor: activeTheme.inputBg, 
                  borderColor: activeTheme.border,
                  color: activeTheme.text
                }}
              />
              <Button disabled variant="secondary" className="rounded-xl px-4 py-2 border opacity-50" style={{ borderColor: activeTheme.border }}>Save Layout</Button>
            </div>
            <span className="text-[9px] font-bold border px-2.5 py-1 rounded-md w-max uppercase tracking-wider"
                  style={{ 
                    backgroundColor: activeTheme.badgeBg, 
                    borderColor: activeTheme.badgeBorder,
                    color: activeTheme.badgeText
                  }}>
              Available in Phase 2
            </span>
          </div>
        </section>

        {/* Reset / Backup */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold tracking-wider uppercase opacity-55">4. Danger Zone</h2>
          <div className="border rounded-2xl p-5 flex items-center justify-between" style={{ backgroundColor: activeTheme.dangerBg, borderColor: activeTheme.dangerBorder }}>
            <div className="pr-4">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: activeTheme.dangerText }}>Reset extension settings</p>
              <p className="text-[11px] mt-1 font-semibold leading-relaxed opacity-60">This action clears your credentials and empties the sync queue.</p>
            </div>
            <Button 
              variant="danger" 
              className="rounded-xl px-4 py-2.5 text-xs font-bold tracking-wider uppercase" 
              onClick={handleClearQueue}
              style={{ 
                backgroundColor: activeTheme.dangerText, 
                color: activeTheme.bg 
              }}
            >
              Reset Settings
            </Button>
          </div>
        </section>
      </main>

      <footer className="text-center text-[10px] font-bold border-t pt-5 mt-4 tracking-wider uppercase opacity-45" style={{ borderColor: activeTheme.border }}>
        Need help? Check our documentation on <a href="https://github.com/pardeep1916P/codeSync" target="_blank" rel="noreferrer" className="underline transition-colors" style={{ color: activeTheme.accent }}>GitHub</a>.
      </footer>

      {/* Floating Toast Notification */}
      {toast && (
        <div 
          className="fixed top-6 right-6 p-4 rounded-xl text-xs font-bold shadow-2xl border flex items-center justify-between transition-all duration-300 transform translate-y-0 z-50 min-w-[280px]"
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
    </div>
  );
};
