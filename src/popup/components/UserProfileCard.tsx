import React from 'react';
import { Theme } from '../../styles/themes';
import { GitHubUser } from '../../github/types';

interface UserProfileCardProps {
  user: GitHubUser | null;
  activeTheme: Theme;
  onLogout: () => void;
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  user,
  activeTheme,
  onLogout,
}) => {
  return (
    <div 
      className="border rounded-2xl p-3.5 flex items-center gap-3.5" 
      style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}
    >
      <img 
        src={user?.avatar_url || 'https://github.com/identicons/guest.png'} 
        alt={user?.login || 'User'} 
        className="w-11 h-11 rounded-full border bg-zinc-900"
        style={{ borderColor: activeTheme.border }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate" style={{ color: activeTheme.textHighlight }}>
          {user?.login}
        </p>
        <p className="text-[9px] font-bold flex items-center gap-1 uppercase tracking-wider" style={{ color: activeTheme.accent }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: activeTheme.accent }}></span>
          GITHUB_ACTIVE
        </p>
      </div>
      <button 
        onClick={onLogout}
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
  );
};
