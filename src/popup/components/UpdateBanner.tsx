import React from 'react';
import { Theme } from '../../styles/themes';
import { useStore } from '../../store';

interface UpdateBannerProps {
  activeTheme: Theme;
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({ activeTheme, onShowToast }) => {
  const { updateInfo, applyUpdate } = useStore();

  if (!updateInfo) return null;

  const handleUpdate = () => {
    onShowToast('Applying update and reloading...', 'success');
    setTimeout(() => {
      applyUpdate();
    }, 500);
  };

  return (
    <div 
      className="border text-[11px] p-3 rounded-xl flex items-center justify-between gap-2 shadow-lg animate-fade-in"
      style={{ 
        backgroundColor: activeTheme.cardBg, 
        borderColor: activeTheme.accent,
        color: activeTheme.textHighlight
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: activeTheme.accent }}></span>
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: activeTheme.accent }}></span>
        </span>
        <div className="flex flex-col min-w-0">
          <span className="font-extrabold text-[10px] uppercase tracking-wider truncate" style={{ color: activeTheme.accent }}>
            Update Available (v{updateInfo.version})
          </span>
          <span className="text-[9px] opacity-70 truncate">
            A new version is ready to install.
          </span>
        </div>
      </div>

      <button
        onClick={handleUpdate}
        className="px-2.5 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider shrink-0 transition-transform active:scale-95 shadow"
        style={{ 
          backgroundColor: activeTheme.accent, 
          color: activeTheme.bg 
        }}
      >
        Update Now
      </button>
    </div>
  );
};
