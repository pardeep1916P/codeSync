import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { THEMES, getSavedThemeId } from '../styles/themes';
import { Header } from './components/Header';
import { UpdateBanner } from './components/UpdateBanner';
import { UserProfileCard } from './components/UserProfileCard';
import { RepoSelector } from './components/RepoSelector';
import { SyncControl } from './components/SyncControl';
import { AuthForm } from './components/AuthForm';
import { ConfirmModal } from './components/ConfirmModal';
import { Footer } from './components/Footer';

export const Popup: React.FC = () => {
  const store = useStore();
  const { initialize } = store;
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const [isQueueDropdownOpen, setIsQueueDropdownOpen] = useState(false);
  const [isRefreshingGithub, setIsRefreshingGithub] = useState(false);
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

  const handleRefreshGithubData = async () => {
    if (isRefreshingGithub) return;
    setIsRefreshingGithub(true);
    try {
      await store.refreshGithubData(true);
      showToast('GitHub data refreshed successfully!', 'success');
    } catch (err) {
      showToast(`Failed to refresh: ${(err as Error).message}`, 'error');
    } finally {
      setIsRefreshingGithub(false);
    }
  };

  const handleManualSync = () => {
    if (store.commitQueue.length === 0) return;
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

  if (store.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[480px] w-[360px] p-6 bg-black text-zinc-400 font-mono box-border">
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
      className="relative flex flex-col h-[480px] w-[360px] p-5 font-mono select-none transition-all duration-300 box-border overflow-hidden"
      style={{ backgroundColor: activeTheme.bg, color: activeTheme.text }}
    >
      {/* Terminal Title Bar */}
      <Header
        activeTheme={activeTheme}
        themeId={themeId}
        setThemeId={setThemeId}
        isThemeDropdownOpen={isThemeDropdownOpen}
        setIsThemeDropdownOpen={setIsThemeDropdownOpen}
        hasGithubToken={!!store.githubToken}
        isRefreshingGithub={isRefreshingGithub}
        onRefreshGithub={handleRefreshGithubData}
        onOpenOptions={openOptionsPage}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col gap-4 overflow-visible pr-0.5">
        {/* Update Notification Banner */}
        <UpdateBanner activeTheme={activeTheme} onShowToast={showToast} />

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
          <AuthForm
            onLoginOAuth={() => store.loginOAuth()}
            onLoginPAT={(token) => store.login(token)}
            activeTheme={activeTheme}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <UserProfileCard
              user={store.user}
              activeTheme={activeTheme}
              onLogout={() => store.logout()}
            />

            <RepoSelector
              repositories={store.repositories}
              selectedRepo={store.selectedRepo}
              solvedCount={store.solvedCount}
              hasToken={!!store.githubToken}
              isRepoDropdownOpen={isRepoDropdownOpen}
              setIsRepoDropdownOpen={setIsRepoDropdownOpen}
              onSelectRepo={(repo) => store.selectRepo(repo)}
              activeTheme={activeTheme}
            />

            <SyncControl
              hasToken={!!store.githubToken}
              syncOnAccept={store.syncOnAccept}
              selectedRepo={store.selectedRepo}
              isSyncing={store.isSyncing}
              commitQueue={store.commitQueue}
              pendingSubmissions={pendingSubmissions}
              isQueueDropdownOpen={isQueueDropdownOpen}
              setIsQueueDropdownOpen={setIsQueueDropdownOpen}
              onManualSync={handleManualSync}
              onRequestClearQueue={() => {
                requestConfirm(
                  'CLEAR QUEUE',
                  'Are you sure you want to clear the entire pending sync queue?',
                  async () => {
                    await store.clearQueue();
                    showToast('Queue cleared.', 'success');
                  }
                );
              }}
              onRemoveItemFromQueue={(id) => {
                store.removeItemFromQueue(id);
                showToast('Item removed from queue.', 'success');
              }}
              activeTheme={activeTheme}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer activeTheme={activeTheme} onShowToast={showToast} />

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
export default Popup;
