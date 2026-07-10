import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyle = 'px-4 py-2 rounded-xl font-mono font-bold text-sm transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center';
  
  const variants = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95 transition-all duration-150',
    secondary: 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 active:scale-95 transition-all duration-150',
    danger: 'bg-rose-950/30 border border-rose-900/40 text-rose-400 hover:bg-rose-950/60 hover:text-rose-200 active:scale-95 transition-all duration-150',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </>
      ) : children}
    </button>
  );
};
