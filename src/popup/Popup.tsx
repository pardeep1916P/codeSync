import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Button } from '../components/Button';

export const Popup: React.FC = () => {
  const store = useStore();
  const [tokenInput, setTokenInput] = useState('');

  useEffect(() => {
    store.initialize();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    await store.login(tokenInput.trim());
  };

  const handleManualSync = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'TRIGGER_SYNC' }, (response) => {
        if (response?.success) {
          alert('Sync triggered successfully!');
          store.initialize(); // refresh local state
        } else {
          alert(`Sync failed: ${response?.error || 'Unknown error'}`);
        }
      });
    } else {
      alert('Manual sync simulation successful.');
    }
  };

  const openOptionsPage = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('../options/index.html', '_blank');
    }
  };

  if (store.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-6 text-gray-500">
        <svg className="animate-spin h-8 w-8 text-brand-600 mb-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-sm font-medium">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full p-4 bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-green-400 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            C
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">CodeSync</h1>
            <p className="text-xs text-gray-500">Git Sync Companion</p>
          </div>
        </div>
        <button 
          onClick={openOptionsPage}
          className="text-gray-500 hover:text-gray-800 transition-colors"
          title="Configure options"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
        {store.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex flex-col gap-1">
            <span className="font-semibold">Error:</span>
            <span>{store.error}</span>
          </div>
        )}

        {!store.githubToken ? (
          /* Authentication Screen */
          <div className="flex-1 flex flex-col justify-center gap-4">
            <Button 
              onClick={() => store.loginOAuth()} 
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Sign in with GitHub (OAuth)
            </Button>

            <div className="flex items-center my-1 text-xs text-gray-400">
              <div className="flex-grow border-t"></div>
              <span className="px-2">or connect with PAT</span>
              <div className="flex-grow border-t"></div>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  GitHub Personal Access Token
                </label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="ghp_..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  required
                />
              </div>
              <Button type="submit" variant="secondary">Connect with PAT</Button>
              <p className="text-[10px] text-center text-gray-500 mt-1">
                Generate a token with <code className="bg-gray-100 px-1 rounded">repo</code> scope to write files.
              </p>
            </form>
          </div>
        ) : (
          /* Main Dashboard Status Screen */
          <div className="flex flex-col gap-4">
            {/* User Profile Card */}
            <div className="bg-white border rounded-xl p-3 flex items-center gap-3 shadow-sm">
              <img 
                src={store.user?.avatar_url || 'https://github.com/identicons/guest.png'} 
                alt={store.user?.login || 'User'} 
                className="w-10 h-10 rounded-full border bg-gray-100"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {store.user?.login}
                </p>
                <p className="text-xs text-gray-500">Connected</p>
              </div>
              <button 
                onClick={() => store.logout()}
                className="text-xs text-red-600 hover:text-red-800 font-semibold"
              >
                Disconnect
              </button>
            </div>

            {/* Configured Repository */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700">
                Target Repository
              </label>
              {store.repositories.length === 0 ? (
                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  No repositories found. Make sure your token has permissions.
                </div>
              ) : (
                <select
                  value={store.selectedRepo || ''}
                  onChange={(e) => store.selectRepo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="" disabled>Select a repository...</option>
                  {store.repositories.map((repo) => (
                    <option key={repo.id} value={repo.full_name}>
                      {repo.full_name} {repo.private ? '🔒' : '🌐'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Queue and Sync Action */}
            <div className="bg-white border rounded-xl p-3 flex flex-col gap-3 shadow-sm mt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Sync Status</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  store.commitQueue.length > 0 
                    ? 'bg-amber-100 text-amber-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {store.commitQueue.length} Pending
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <Button 
                  onClick={handleManualSync} 
                  variant="secondary" 
                  disabled={!store.selectedRepo}
                  className="w-full"
                >
                  Trigger Sync Now
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-[10px] text-center text-gray-400 mt-4 border-t pt-2">
        CodeSync v1.0.0 &bull; Licensed under MIT
      </footer>
    </div>
  );
};
