import React from 'react';
import { THEMES, Theme, saveThemeId } from '../../styles/themes';

interface HeaderProps {
  activeTheme: Theme;
  themeId: string;
  setThemeId: (id: string) => void;
  isThemeDropdownOpen: boolean;
  setIsThemeDropdownOpen: (open: boolean) => void;
  hasGithubToken: boolean;
  isRefreshingGithub: boolean;
  onRefreshGithub: () => void;
  onOpenOptions: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTheme,
  themeId,
  setThemeId,
  isThemeDropdownOpen,
  setIsThemeDropdownOpen,
  hasGithubToken,
  isRefreshingGithub,
  onRefreshGithub,
  onOpenOptions,
}) => {
  return (
    <header className="flex items-center justify-between border-b pb-3.5 mb-4" style={{ borderColor: activeTheme.border }}>
      <div className="flex items-center gap-2">
        <span className="font-extrabold" style={{ color: activeTheme.accent }}>$</span>
        <span className="text-xs font-bold tracking-wider" style={{ color: activeTheme.textHighlight }}>codesync --status</span>
      </div>
      <div className="flex items-center gap-2 relative theme-dropdown-container">
        {/* Refresh GitHub Data */}
        {hasGithubToken && (
          <button 
            onClick={onRefreshGithub}
            disabled={isRefreshingGithub}
            className={`p-1 rounded-lg border transition-all duration-150 flex items-center justify-center ${isRefreshingGithub ? 'animate-pulse opacity-50' : ''}`}
            style={{ 
              borderColor: activeTheme.border, 
              backgroundColor: activeTheme.inputBg,
              color: activeTheme.text 
            }}
            title="Refresh GitHub data"
            aria-label="Refresh GitHub data"
          >
            <svg className={`w-4 h-4 fill-none stroke-current ${isRefreshingGithub ? 'animate-spin' : ''}`} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        )}

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
          onClick={onOpenOptions}
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
  );
};
