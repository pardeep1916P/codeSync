import React from 'react';

export const LeetCodeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.144l2.766-2.96a1.374 1.374 0 0 0-.961-2.327l-.842.744zM16.48 14.887a1.38 1.38 0 0 0 0 2.76h4.757a1.38 1.38 0 1 0 0-2.76H16.48z" />
  </svg>
);

export const CodeforcesIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <rect x="2" y="10" width="4.5" height="11" rx="1.5" fill="#E8A723" />
    <rect x="9.5" y="3" width="4.5" height="18" rx="1.5" fill="#318CE7" />
    <rect x="17" y="6.5" width="4.5" height="14.5" rx="1.5" fill="#ED1B24" />
  </svg>
);

export const CodeChefIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.5 2 5.8 4.2 5.2 7.2C3.3 7.8 2 9.6 2 11.7C2 14.1 3.7 16.1 6 16.4V19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V16.4C20.3 16.1 22 14.1 22 11.7C22 9.6 20.7 7.8 18.8 7.2C18.2 4.2 15.5 2 12 2ZM8 17H16V19H8V17ZM12 4C14.2 4 16.1 5.6 16.7 7.8C16.1 8.2 15.6 8.8 15.3 9.5C14.5 8.6 13.3 8 12 8C10.7 8 9.5 8.6 8.7 9.5C8.4 8.8 7.9 8.2 7.3 7.8C7.9 5.6 9.8 4 12 4Z" />
  </svg>
);

export const HackerRankIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-3 16.5H6.5v-9H9v3.25h6V7.5h2.5v9H15v-3.25H9v3.25z" />
  </svg>
);

export const GeeksforGeeksIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3c-2 0-3 1.5-3 3.5v2.5c0 1.5-1 2-2 2 1 0 2 .5 2 2v2.5C5 17.5 6 19 8 19" />
    <path d="M16 3c2 0 3 1.5 3 3.5v2.5c0 1.5 1 2 2 2-1 0-2 .5-2 2v2.5c0 2-1 3.5-3 3.5" />
    <circle cx="12" cy="11" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export const AllPlatformsIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);
