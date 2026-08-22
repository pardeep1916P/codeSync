import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Button } from '../components/Button';
import { ConfirmModal } from '../components/ConfirmModal';
import { THEMES, getSavedThemeId } from '../styles/themes';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { FolderLayout } from '../storage';

interface LayoutOption {
  id: FolderLayout;
  name: string;
  template: string;
  description: string;
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: 'flat',
    name: 'Flat Root',
    template: '{problem_slug}/',
    description: 'Saves problems directly in the repository root (e.g. two-sum/)'
  },
  {
    id: 'platform',
    name: 'Platform Namespaced',
    template: '{platform}/{problem_slug}/',
    description: 'Organizes solutions under platform folders (e.g. leetcode/two-sum/)'
  },
  {
    id: 'difficulty',
    name: 'Difficulty Grouped',
    template: '{platform}/{difficulty}/{problem_slug}/',
    description: 'Groups solutions by platform and difficulty (e.g. leetcode/Easy/two-sum/)'
  },
];

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
  const [isLayoutDropdownOpen, setIsLayoutDropdownOpen] = useState(false);
  const [themeId, setThemeId] = useState('amoled');
  const [tokenInput, setTokenInput] = useState('');

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
    if (!isRepoDropdownOpen && !isLayoutDropdownOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isRepoDropdownOpen && !target.closest('.repo-dropdown-container')) {
        setIsRepoDropdownOpen(false);
      }
      if (isLayoutDropdownOpen && !target.closest('.layout-dropdown-container')) {
        setIsLayoutDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isRepoDropdownOpen, isLayoutDropdownOpen]);

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

  const handleConnectPAT = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    await store.login(tokenInput.trim());
    const currentError = useStore.getState().error;
    if (currentError) {
      showToast(currentError, 'error');
    } else {
      setTokenInput('');
      showToast('Connected with PAT successfully!', 'success');
    }
  };

  const handleClearQueue = () => {
    requestConfirm(
      'CLEAR PENDING QUEUE',
      'Are you sure you want to clear all pending submissions from the sync queue?',
      async () => {
        await store.clearQueue();
        showToast('Cleared pending sync queue.', 'success');
      }
    );
  };

  const handleResetSettings = () => {
    requestConfirm(
      'RESET EXTENSION SETTINGS',
      'Are you sure you want to disconnect your GitHub account and reset all extension settings?',
      async () => {
        await store.logout();
        showToast('All settings reset successfully.', 'success');
        store.initialize();
      }
    );
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
          <div className="border rounded-2xl p-5 flex flex-col gap-4" style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}>
            {store.githubToken ? (
              <div className="flex items-center justify-between w-full">
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
              </div>
            ) : (
              <div className="flex flex-col gap-5 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold opacity-80">Disconnected</p>
                    <p className="text-xs mt-1 leading-relaxed opacity-55">Authenticate to link your GitHub account and start syncing solutions.</p>
                  </div>
                  <Button
                    onClick={() => store.loginOAuth()}
                    className="text-xs uppercase tracking-wider font-bold py-2.5 px-4 rounded-xl shadow active:scale-95 transition-all text-center self-start sm:self-auto shrink-0 border"
                    style={{ 
                      backgroundColor: activeTheme.inputBg,
                      borderColor: activeTheme.border,
                      color: activeTheme.textHighlight 
                    }}
                  >
                    Authenticate OAuth
                  </Button>
                </div>
                
                <div className="flex items-center my-1 text-[9px] font-bold tracking-wider uppercase opacity-40">
                  <div className="flex-grow border-t" style={{ borderColor: activeTheme.border }}></div>
                  <span className="px-2">OR CONNECT WITH PERSONAL ACCESS TOKEN</span>
                  <div className="flex-grow border-t" style={{ borderColor: activeTheme.border }}></div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 min-w-[200px] w-full">
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
                    />
                  </div>
                  <Button 
                    onClick={handleConnectPAT}
                    variant="secondary" 
                    className="py-2.5 px-4 text-xs font-bold tracking-wider uppercase border rounded-xl w-full sm:w-auto shrink-0"
                    style={{ 
                      backgroundColor: activeTheme.inputBg, 
                      borderColor: activeTheme.border,
                      color: activeTheme.textHighlight
                    }}
                  >
                    Connect PAT
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Target Repository Selection */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold tracking-wider uppercase opacity-55">2. Target Repository</h2>
          <div className="border rounded-2xl p-5 flex flex-col gap-4" style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}>
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
        </section>

        {/* Synchronization Preferences */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold tracking-wider uppercase opacity-55">3. Synchronization Rules</h2>
          <div className="border rounded-2xl p-5 flex flex-col gap-5" style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}>
            {/* Instant Sync on Accept Toggle */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1 pr-4">
                <Label htmlFor="auto-sync" className="cursor-pointer text-xs font-bold tracking-wider uppercase" style={{ color: activeTheme.textHighlight }}>
                  Instant Sync on Accept
                </Label>
                <p className="text-[11px] font-semibold leading-relaxed opacity-60">
                  Automatically synchronize your solution as soon as you submit an accepted answer on LeetCode.
                </p>
              </div>
              <Switch
                id="auto-sync"
                checked={store.syncOnAccept}
                onCheckedChange={(checked) => {
                  store.setSyncOnAccept(checked);
                  showToast(checked ? 'Instant Sync enabled' : 'Instant Sync disabled', 'success');
                }}
              />
            </div>

            <div className="border-t" style={{ borderColor: activeTheme.border }}></div>

            {/* History Sync Toggle */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1 pr-4">
                <Label htmlFor="history-sync" className="cursor-pointer text-xs font-bold tracking-wider uppercase" style={{ color: activeTheme.textHighlight }}>
                  Historical Submissions Sync
                </Label>
                <p className="text-[11px] font-semibold leading-relaxed opacity-60">
                  Sync older accepted submissions when viewing them in the LeetCode Submissions history tab.
                </p>
              </div>
              <Switch
                id="history-sync"
                checked={store.syncHistoricalOnView}
                onCheckedChange={(checked) => {
                  store.setSyncHistoricalOnView(checked);
                  showToast(checked ? 'History Sync enabled' : 'History Sync disabled', 'success');
                }}
              />
            </div>

            <div className="border-t" style={{ borderColor: activeTheme.border }}></div>

            {/* Desktop Notifications Toggle */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1 pr-4">
                <Label htmlFor="desktop-notifications" className="cursor-pointer text-xs font-bold tracking-wider uppercase" style={{ color: activeTheme.textHighlight }}>
                  Desktop Notifications
                </Label>
                <p className="text-[11px] font-semibold leading-relaxed opacity-60">
                  Display Chrome desktop system notifications when submissions are queued or synced.
                </p>
              </div>
              <Switch
                id="desktop-notifications"
                checked={store.desktopNotifications}
                onCheckedChange={(checked) => {
                  store.setDesktopNotifications(checked);
                  showToast(checked ? 'Desktop notifications enabled' : 'Desktop notifications disabled', 'success');
                }}
              />
            </div>
          </div>
        </section>

        {/* Directory Customization */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold tracking-wider uppercase opacity-55">4. Repository Structure Layout</h2>
          <div className="border rounded-2xl p-5 flex flex-col gap-4" style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}>
            <p className="text-xs leading-relaxed opacity-60">
              Select how solution files and folders are structured inside your repository.
            </p>

            <div className="relative w-full max-w-md layout-dropdown-container">
              <button
                onClick={() => setIsLayoutDropdownOpen(!isLayoutDropdownOpen)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 border rounded-xl text-xs font-semibold hover:bg-white/5 transition-all duration-150"
                style={{ 
                  backgroundColor: activeTheme.inputBg, 
                  borderColor: activeTheme.border,
                  color: activeTheme.textHighlight
                }}
              >
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-bold flex items-center gap-2">
                    <span>{LAYOUT_OPTIONS.find(o => o.id === (store.folderLayout || 'flat'))?.name || 'Flat Root'}</span>
                    <code className="text-[10px] px-1.5 py-0.5 rounded border opacity-75 font-mono" style={{ borderColor: activeTheme.border, color: activeTheme.accent }}>
                      {LAYOUT_OPTIONS.find(o => o.id === (store.folderLayout || 'flat'))?.template || '{problem_slug}/'}
                    </code>
                  </span>
                </div>
                <svg className="fill-current h-4 w-4 transition-transform duration-150 shrink-0" style={{ color: activeTheme.text, transform: isLayoutDropdownOpen ? 'rotate(180deg)' : 'none' }} viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </button>

              {isLayoutDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1.5 border rounded-xl shadow-2xl z-50 py-1"
                     style={{ 
                       backgroundColor: activeTheme.bg, 
                       borderColor: activeTheme.border 
                     }}>
                  {LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        store.setFolderLayout(opt.id);
                        setIsLayoutDropdownOpen(false);
                        showToast(`Directory layout set to ${opt.name}`, 'success');
                      }}
                      className="w-full flex flex-col items-start gap-1 px-3.5 py-2.5 text-left text-xs font-semibold transition-all duration-150 hover:bg-white/5 border-b last:border-b-0"
                      style={{ 
                        borderColor: 'rgba(255,255,255,0.05)',
                        color: store.folderLayout === opt.id ? activeTheme.textHighlight : activeTheme.text,
                        backgroundColor: store.folderLayout === opt.id ? 'rgba(255,255,255,0.03)' : 'transparent'
                      }}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold">{opt.name}</span>
                        <code className="text-[10px] px-1.5 py-0.5 rounded border opacity-75 font-mono" style={{ borderColor: activeTheme.border, color: activeTheme.accent }}>
                          {opt.template}
                        </code>
                      </div>
                      <span className="text-[10px] opacity-60 font-normal leading-relaxed">{opt.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Reset / Backup */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold tracking-wider uppercase opacity-55">5. Danger Zone</h2>
          <div className="border rounded-2xl p-5 flex flex-col gap-4" style={{ backgroundColor: activeTheme.dangerBg, borderColor: activeTheme.dangerBorder }}>
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: activeTheme.dangerBorder }}>
              <div className="pr-4">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: activeTheme.dangerText }}>Clear Pending Queue</p>
                <p className="text-[11px] mt-0.5 font-semibold leading-relaxed opacity-60">Flushes all queued submissions without unlinking your GitHub account.</p>
              </div>
              <Button 
                variant="secondary" 
                className="rounded-xl px-4 py-2 text-xs font-bold tracking-wider uppercase border shrink-0" 
                onClick={handleClearQueue}
                style={{ 
                  backgroundColor: activeTheme.inputBg,
                  borderColor: activeTheme.border,
                  color: activeTheme.textHighlight
                }}
              >
                Clear Queue ({store.commitQueue.length})
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="pr-4">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: activeTheme.dangerText }}>Reset Extension Settings</p>
                <p className="text-[11px] mt-0.5 font-semibold leading-relaxed opacity-60">Clears your stored GitHub token, chosen repository, and resets preferences.</p>
              </div>
              <Button 
                variant="danger" 
                className="rounded-xl px-4 py-2 text-xs font-bold tracking-wider uppercase shrink-0" 
                onClick={handleResetSettings}
                style={{ 
                  backgroundColor: activeTheme.dangerText, 
                  color: activeTheme.bg 
                }}
              >
                Reset All
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="text-center text-[10px] font-bold border-t pt-5 mt-4 tracking-wider uppercase opacity-45" style={{ borderColor: activeTheme.border }}>
        Need help? Check our documentation on <a href="https://github.com/pardeep1916P/codeSync" target="_blank" rel="noreferrer" className="underline transition-colors" style={{ color: activeTheme.accent }}>GitHub</a>.
      </footer>

      {/* Toast Notification (Perfect Bottom Centering) */}
      {toast && (
        <div className="fixed bottom-8 left-0 right-0 flex justify-center items-center pointer-events-none z-50 px-4">
          <div 
            className="pointer-events-auto p-3.5 px-5 rounded-2xl text-xs font-bold shadow-2xl border flex items-center justify-between gap-4 transition-all duration-300 min-w-[300px] max-w-md animate-fade-in"
            style={{ 
              backgroundColor: toast.type === 'success' ? (activeTheme.bg === '#000000' ? '#09090b' : activeTheme.bg) : activeTheme.dangerBg, 
              borderColor: toast.type === 'success' ? activeTheme.border : activeTheme.dangerBorder,
              color: toast.type === 'success' ? activeTheme.accent : activeTheme.dangerText
            }}
          >
            <span className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full animate-pulse shrink-0" style={{ backgroundColor: toast.type === 'success' ? activeTheme.accent : activeTheme.dangerText }}></span>
              <span>{toast.message}</span>
            </span>
            <button onClick={() => setToast(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        activeTheme={activeTheme}
      />
    </div>
  );
};
