import React from 'react';
import { Theme } from '../../styles/themes';
import { RELEASE_NOTES } from './releaseNotes';

export interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void | Promise<void>;
  activeTheme: Theme;
  version: string;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({
  isOpen,
  onClose,
  activeTheme,
  version,
}) => {
  if (!isOpen) return null;

  const highlights = RELEASE_NOTES[version] || RELEASE_NOTES['1.2.2'];

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
    >
      <div 
        className="w-full max-w-[325px] border rounded-2xl p-5 flex flex-col gap-4 shadow-2xl animate-scale-up"
        style={{ 
          backgroundColor: activeTheme.bg === '#000000' ? '#09090b' : activeTheme.bg, 
          borderColor: activeTheme.border 
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: activeTheme.border }}>
          <div className="flex items-center gap-2">
            <span 
              className="text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-widest shadow-sm"
              style={{ backgroundColor: activeTheme.accent, color: activeTheme.bg }}
            >
              WHAT&apos;S NEW
            </span>
            <span 
              className="text-xs font-extrabold tracking-wide"
              style={{ color: activeTheme.textHighlight }}
            >
              v{version}
            </span>
          </div>

          <button 
            onClick={onClose}
            className="p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: activeTheme.text }}
            aria-label="Close release notes"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Highlights List */}
        <div className="flex flex-col gap-3 py-1">
          {highlights.map((item, idx) => (
            <div 
              key={idx} 
              className="p-2.5 rounded-xl border flex flex-col gap-1 transition-all"
              style={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderColor: activeTheme.border 
              }}
            >
              <div className="flex items-center gap-2">
                <span 
                  className="text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    color: activeTheme.accent 
                  }}
                >
                  {item.tag}
                </span>
                <span 
                  className="text-[11px] font-bold truncate"
                  style={{ color: activeTheme.textHighlight }}
                >
                  {item.title}
                </span>
              </div>
              <p 
                className="text-[10px] leading-relaxed opacity-75 pl-0.5"
                style={{ color: activeTheme.text }}
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 text-xs font-black tracking-wider uppercase rounded-xl shadow-lg transition-transform active:scale-95 hover:opacity-90 mt-1"
          style={{ 
            backgroundColor: activeTheme.accent, 
            color: activeTheme.bg 
          }}
        >
          GOT IT!
        </button>
      </div>
    </div>
  );
};
