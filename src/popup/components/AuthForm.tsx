import React, { useState } from 'react';
import { Theme } from '../../styles/themes';
import { Button } from '../../components/Button';
import { GitHubIcon } from './Icons';

interface AuthFormProps {
  onLoginOAuth: () => void;
  onLoginPAT: (token: string) => void;
  activeTheme: Theme;
}

export const AuthForm: React.FC<AuthFormProps> = ({
  onLoginOAuth,
  onLoginPAT,
  activeTheme,
}) => {
  const [tokenInput, setTokenInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    onLoginPAT(tokenInput.trim());
  };

  return (
    <div className="flex-1 flex flex-col justify-center gap-4">
      <button 
        onClick={onLoginOAuth} 
        className="w-full flex items-center justify-center gap-2.5 font-bold py-2.5 px-4 rounded-xl shadow transition-all duration-150 active:scale-95 text-xs tracking-wider uppercase"
        style={{ backgroundColor: activeTheme.textHighlight, color: activeTheme.bg }}
      >
        <GitHubIcon />
        AUTHENTICATE_OAUTH
      </button>

      <div className="flex items-center my-1 text-[9px] font-bold tracking-wider uppercase opacity-50">
        <div className="flex-grow border-t" style={{ borderColor: activeTheme.border }}></div>
        <span className="px-2">OR_USE_ACCESS_TOKEN</span>
        <div className="flex-grow border-t" style={{ borderColor: activeTheme.border }}></div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label className="block text-[9px] font-bold mb-1.5 tracking-wider uppercase opacity-55">
            github_pat_token
          </label>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="ghp_..."
            className="w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-none transition-all duration-150 font-mono"
            style={{ 
              backgroundColor: activeTheme.inputBg, 
              borderColor: activeTheme.border,
              color: activeTheme.textHighlight
            }}
            required
          />
        </div>
        <Button 
          type="submit" 
          variant="secondary" 
          className="w-full py-2.5 text-xs font-bold tracking-wider uppercase border"
          style={{ 
            backgroundColor: activeTheme.inputBg, 
            borderColor: activeTheme.border,
            color: activeTheme.textHighlight
          }}
        >
          CONNECT_WITH_PAT
        </Button>
        <p className="text-[10px] text-center leading-normal px-2 opacity-50">
          Generate a token with <code className="px-1 py-0.5 rounded font-mono text-[9px]" style={{ backgroundColor: activeTheme.inputBg, color: activeTheme.accent }}>repo</code> scope to sync.
        </p>
      </form>
    </div>
  );
};
