import type { HeroClassId, PetId } from '../game/types';

export function HeroEmblemSvg({ heroId, className = 'w-6 h-6' }: { heroId: HeroClassId; className?: string }) {
  switch (heroId) {
    case 'berserker':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <path d="M5 19L19 5M14 4c3 0 6 3 6 6l-5 1-2-2 1-5z" stroke="#0e0c0f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 19L19 5" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M14 4c3 0 6 3 6 6l-5 1-2-2 1-5z" fill="#dc2626" stroke="#fca5a5" strokeWidth="1" />
        </svg>
      );
    case 'ranger':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <path d="M5 19C5 10 10 5 19 5" stroke="#0e0c0f" strokeWidth="4" strokeLinecap="round" />
          <path d="M5 19C5 10 10 5 19 5" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M5 19L19 5M19 5h-4M19 5v4" stroke="#fde68a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'sorcerer':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <path d="M5 20L15 10" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="17" cy="7" r="4.5" fill="#f59e0b" stroke="#60a5fa" strokeWidth="1.5" />
          <circle cx="17" cy="7" r="1.8" fill="#fef3c7" />
        </svg>
      );
    case 'battle':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" fill="#3b82f6" stroke="#0e0c0f" strokeWidth="2" />
          <path d="M12 6v12M8 10h8" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'vampire_hunter':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <path d="M4 12h16M12 4v16" stroke="#9f1239" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M12 3l3 4h-6l3-4z" fill="#e2e8f0" />
          <circle cx="12" cy="12" r="2.5" fill="#fda4af" />
        </svg>
      );
    case 'chef_samurai':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <path d="M4 18L18 4l2 2-11 11-5 1z" fill="#2dd4bf" stroke="#0e0c0f" strokeWidth="1.5" />
          <path d="M7 15l2 2" stroke="#fef08a" strokeWidth="2" strokeLinecap="round" />
          <circle cx="16" cy="17" r="3" fill="#f8fafc" stroke="#0e0c0f" strokeWidth="1.2" />
        </svg>
      );
  }
}

export function PetEmblemSvg({ petId, className = 'w-5 h-5' }: { petId: PetId; className?: string }) {
  if (petId === 'wolf') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
        <path d="M5 17l2-9 3 3h4l3-3 2 9-7 3-7-3z" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  }
  if (petId === 'rhino') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
        <path d="M4 15c0-4 3-7 8-7h4l4-4-1 7 1 5H4v-1z" fill="#78716c" stroke="#fde68a" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  }
  if (petId === 'dragon') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
        <path d="M4 14l4-6 4 3 4-3 4 6-8 5-8-5z" fill="#ef4444" stroke="#fbbf24" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7" stroke="#64748b" strokeWidth="1.8" strokeDasharray="3 3" />
    </svg>
  );
}
