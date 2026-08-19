import React from 'react';
import { Theme } from '../../styles/themes';
import { getExtensionVersion } from '../../utils/version';
import { useStore } from '../../store';

interface FooterProps {
  activeTheme: Theme;
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

export const Footer: React.FC<FooterProps> = ({ activeTheme, onShowToast }) => {
  const { checkForUpdates, isCheckingUpdate } = useStore();
  const version = getExtensionVersion();

  const handleCheckUpdate = async () => {
    if (isCheckingUpdate) return;
    try {
      const result = await checkForUpdates();
      if (result.status === 'update_available') {
        onShowToast(`Update v${result.version || ''} available!`, 'success');
      } else {
        onShowToast(`CodeSync v${version} is up to date.`, 'success');
      }
    } catch {
      onShowToast(`CodeSync v${version} is up to date.`, 'success');
    }
  };

  return (
    <footer 
      className="text-[9px] flex items-center justify-between mt-4 border-t pt-3 tracking-wider uppercase opacity-60" 
      style={{ borderColor: activeTheme.border }}
    >
      <span className="font-bold font-mono">codesync v{version}</span>
      <button
        onClick={handleCheckUpdate}
        disabled={isCheckingUpdate}
        className="hover:underline flex items-center gap-1 font-bold lowercase opacity-80 hover:opacity-100 transition-opacity"
        style={{ color: activeTheme.accent }}
      >
        {isCheckingUpdate ? (
          <>
            <svg className="animate-spin h-2.5 w-2.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>checking...</span>
          </>
        ) : (
          <span>check updates</span>
        )}
      </button>
    </footer>
  );
};
