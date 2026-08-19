import React from 'react';
import { Theme } from '../../styles/themes';
import { GitHubRepo } from '../../github/types';
import { PrivateIcon, PublicIcon } from './Icons';

interface RepoSelectorProps {
  repositories: GitHubRepo[];
  selectedRepo: string | null;
  solvedCount: number;
  hasToken: boolean;
  isRepoDropdownOpen: boolean;
  setIsRepoDropdownOpen: (open: boolean) => void;
  onSelectRepo: (repoFullName: string) => void;
  activeTheme: Theme;
}

export const RepoSelector: React.FC<RepoSelectorProps> = ({
  repositories,
  selectedRepo,
  solvedCount,
  hasToken,
  isRepoDropdownOpen,
  setIsRepoDropdownOpen,
  onSelectRepo,
  activeTheme,
}) => {
  const selectedRepoObj = repositories.find(r => r.full_name === selectedRepo);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <label className="text-[9px] font-bold tracking-wider uppercase opacity-55">
          TARGET_REPOSITORY
        </label>
        {hasToken && selectedRepo && (
          <span className="text-[9px] font-extrabold tracking-wider uppercase" style={{ color: activeTheme.accent }}>
            SOLVED: {solvedCount}
          </span>
        )}
      </div>

      {repositories.length === 0 ? (
        <div 
          className="text-[11px] border rounded-xl p-3 leading-relaxed" 
          style={{ 
            backgroundColor: activeTheme.dangerBg, 
            borderColor: activeTheme.dangerBorder, 
            color: activeTheme.dangerText 
          }}
        >
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
            <svg 
              className="fill-current h-4 w-4 transition-transform duration-150" 
              style={{ color: activeTheme.text, transform: isRepoDropdownOpen ? 'rotate(180deg)' : 'none' }} 
              viewBox="0 0 20 20"
            >
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </button>
          
          {isRepoDropdownOpen && (
            <div 
              className="absolute left-0 right-0 mt-1.5 max-h-60 overflow-y-auto border rounded-xl shadow-2xl z-50 py-1 repo-dropdown-scrollbar"
              style={{ 
                backgroundColor: activeTheme.bg, 
                borderColor: activeTheme.border 
              }}
            >
              {repositories.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => {
                    onSelectRepo(repo.full_name);
                    setIsRepoDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left text-xs font-semibold transition-all duration-150 hover:bg-white/5"
                  style={{ 
                    color: selectedRepo === repo.full_name ? activeTheme.textHighlight : activeTheme.text,
                    backgroundColor: selectedRepo === repo.full_name ? 'rgba(255,255,255,0.03)' : 'transparent'
                  }}
                >
                  {repo.private ? <PrivateIcon /> : <PublicIcon />}
                  <span className="truncate">{repo.full_name}</span>
                </button>
              ))}
            </div>
          )}

          {!selectedRepo && (
            <div 
              className="text-[10px] p-2.5 rounded-xl border flex items-center gap-2 mt-1 animate-fade-in"
              style={{ 
                backgroundColor: 'rgba(59, 130, 246, 0.08)', 
                borderColor: 'rgba(59, 130, 246, 0.25)', 
                color: '#60a5fa' 
              }}
            >
              <svg className="w-3.5 h-3.5 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Choose a repository above to sync your accepted solutions automatically.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
