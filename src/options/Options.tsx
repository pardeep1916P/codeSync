import React, { useEffect } from 'react';
import { useStore } from '../store';
import { Button } from '../components/Button';

export const Options: React.FC = () => {
  const store = useStore();

  useEffect(() => {
    store.initialize();
  }, []);

  const handleToggleSync = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await store.setSyncOnAccept(e.target.checked);
  };

  const handleClearQueue = async () => {
    if (confirm('Are you sure you want to clear the pending sync queue?')) {
      await store.logout(); // Simple reset
      alert('Cleared settings successfully.');
      store.initialize();
    }
  };

  if (store.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-500">
        <svg className="animate-spin h-8 w-8 text-brand-600 mb-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-base">Loading configuration...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="border-b pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CodeSync Configuration</h1>
          <p className="text-sm text-gray-500">Customize how CodeSync synchronizes coding solutions to your GitHub.</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-600 to-green-400 flex items-center justify-center text-white font-extrabold text-xl shadow-md">
          CS
        </div>
      </header>

      {/* Main Form/Controls */}
      <main className="flex flex-col gap-6">
        {/* Connection Section */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-800">1. Authentication</h2>
          <div className="bg-gray-50 border rounded-xl p-4 flex flex-col gap-4">
            {store.githubToken ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img 
                    src={store.user?.avatar_url || 'https://github.com/identicons/guest.png'} 
                    alt={store.user?.login || 'User'} 
                    className="w-12 h-12 rounded-full border bg-white"
                  />
                  <div>
                    <p className="text-base font-semibold text-gray-900">{store.user?.login}</p>
                    <p className="text-xs text-gray-500">Authenticated successfully</p>
                  </div>
                </div>
                <Button variant="danger" onClick={() => store.logout()}>Disconnect Account</Button>
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                You are currently disconnected. Open the extension popup window from the browser toolbar to enter your Personal Access Token.
              </div>
            )}
          </div>
        </section>

        {/* Sync Settings */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-800">2. Synchronization Preferences</h2>
          <div className="bg-gray-50 border rounded-xl p-4 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <label htmlFor="syncOnAccept" className="text-sm font-semibold text-gray-900 block mb-1">
                  Automatic Sync
                </label>
                <span className="text-xs text-gray-500 block">
                  Automatically synchronize your solution as soon as you submit an accepted answer on a supported platform.
                </span>
              </div>
              <input
                id="syncOnAccept"
                type="checkbox"
                checked={store.syncOnAccept}
                onChange={handleToggleSync}
                className="h-4 w-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500 mt-1"
              />
            </div>

            <div className="border-t pt-4">
              <label className="text-sm font-semibold text-gray-900 block mb-1">
                Target Repository
              </label>
              {store.githubToken ? (
                <div className="flex flex-col gap-2">
                  <select
                    value={store.selectedRepo || ''}
                    onChange={(e) => store.selectRepo(e.target.value)}
                    className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="" disabled>Select a repository...</option>
                    {store.repositories.map((repo) => (
                      <option key={repo.id} value={repo.full_name}>
                        {repo.full_name} {repo.private ? '(Private 🔒)' : '(Public 🌐)'}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">
                    We will save files under directory structures named after the problem slug inside this repo.
                  </p>
                </div>
              ) : (
                <div className="text-xs text-gray-400 italic">
                  Authenticate your GitHub account to choose a target repository.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Directory Customization */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-800">3. Repository Structure Layout (Future)</h2>
          <div className="bg-gray-50 border border-dashed rounded-xl p-4 flex flex-col gap-2">
            <p className="text-sm text-gray-600">
              Customize directory templates. Default: <code className="bg-white px-1.5 py-0.5 rounded border text-xs">{`{platform}/{problem_slug}/`}</code>
            </p>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                disabled
                placeholder="{platform}/{problem_slug}/"
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-400 cursor-not-allowed"
              />
              <Button disabled variant="secondary">Save Layout</Button>
            </div>
            <span className="text-[10px] text-amber-600 font-semibold">Available in Phase 2</span>
          </div>
        </section>

        {/* Reset / Backup */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-800">4. Danger Zone</h2>
          <div className="border border-red-200 bg-red-50/30 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-red-800">Reset extension settings</p>
              <p className="text-xs text-red-600">This action clears your credentials and empties the sync queue.</p>
            </div>
            <Button variant="danger" onClick={handleClearQueue}>Reset Settings</Button>
          </div>
        </section>
      </main>

      <footer className="text-center text-xs text-gray-400 border-t pt-4 mt-4">
        Need help? Check our documentation on <a href="https://github.com/pardeep1916P/codeSync" target="_blank" rel="noreferrer" className="text-brand-600 underline">GitHub</a>.
      </footer>
    </div>
  );
};
