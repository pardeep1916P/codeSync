import React from 'react';
import { Theme } from '../../styles/themes';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  activeTheme: Theme;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  activeTheme,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="absolute inset-0 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
    >
      <div 
        className="w-full max-w-[280px] border rounded-2xl p-5 flex flex-col gap-4 shadow-2xl animate-scale-up"
        style={{ 
          backgroundColor: activeTheme.bg === '#000000' ? '#09090b' : activeTheme.bg, 
          borderColor: activeTheme.border 
        }}
      >
        <div className="flex flex-col gap-1.5">
          <span 
            className="text-[9px] font-extrabold tracking-widest uppercase opacity-65"
            style={{ color: activeTheme.text }}
          >
            {title}
          </span>
          <p 
            className="text-xs font-semibold leading-relaxed"
            style={{ color: activeTheme.textHighlight }}
          >
            {message}
          </p>
        </div>

        <div className="flex gap-2.5 mt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-xs font-bold tracking-wider uppercase border rounded-xl hover:opacity-85 transition-all"
            style={{ 
              borderColor: activeTheme.border, 
              color: activeTheme.textHighlight,
              backgroundColor: 'rgba(255, 255, 255, 0.03)'
            }}
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 text-xs font-bold tracking-wider uppercase rounded-xl hover:opacity-85 transition-all"
            style={{ 
              backgroundColor: activeTheme.dangerBg, 
              borderColor: activeTheme.dangerBorder, 
              color: activeTheme.dangerText,
              borderWidth: '1px'
            }}
          >
            CONFIRM
          </button>
        </div>
      </div>
    </div>
  );
};
