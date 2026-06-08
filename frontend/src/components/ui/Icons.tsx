/**
 * Icons — Custom SVG icon library for LinguaLearn.
 *
 * All icons are generated programmatically (no external fonts/files).
 * Design language: rounded, 2px stroke, consistent 24×24 viewBox.
 * Each icon accepts className and size props.
 */

import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
}

const base = (strokeWidth = 2) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

// ── App Logo ──────────────────────────────────────────────────────────────────

export function AppLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className}>
      {/* Solid blue — visible on both light and dark backgrounds */}
      <rect width="32" height="32" rx="9" fill="#2563eb"/>
      {/* "L" letterform */}
      <path d="M9 8h3v11h7v3H9z" fill="white"/>
      {/* Accent dot */}
      <circle cx="22" cy="9" r="2.5" fill="#93c5fd"/>
    </svg>
  );
}

// ── Navigation ────────────────────────────────────────────────────────────────

export function HomeIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>
      <path d="M9 22V12h6v10"/>
    </svg>
  );
}

export function LibraryIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <rect x="3" y="3" width="5" height="18" rx="1"/>
      <rect x="10" y="3" width="5" height="18" rx="1"/>
      <path d="M17 3l4 2v14l-4 2V3z"/>
    </svg>
  );
}

export function WordsIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M12 20h9"/>
      <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635l-4 1 1-4z"/>
    </svg>
  );
}

export function ReviewIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <rect x="2" y="4" width="20" height="16" rx="3"/>
      <path d="M8 10h8M8 14h5"/>
      <circle cx="18" cy="14" r="2" fill="currentColor" stroke="none"/>
    </svg>
  );
}

export function GamesIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <rect x="2" y="6" width="20" height="12" rx="4"/>
      <path d="M7 12h4M9 10v4"/>
      <circle cx="16" cy="11" r="1" fill="currentColor" stroke="none"/>
      <circle cx="19" cy="13" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}

export function AIIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <path d="M9 10h.01M12 10h.01M15 10h.01" strokeWidth="2.5"/>
    </svg>
  );
}

// ── Actions ───────────────────────────────────────────────────────────────────

export function SpeakIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    </svg>
  );
}

export function MicIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M5 10a7 7 0 0 0 14 0"/>
      <path d="M12 19v3M8 22h8"/>
    </svg>
  );
}

export function SearchIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

export function SaveIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  );
}

export function DeleteIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}

export function StarIcon({ className = '', size = 24, strokeWidth = 2, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  );
}

export function CloseIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  );
}

export function BackIcon({ className = '', size = 24, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  );
}

export function ChevronRight({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

export function CheckIcon({ className = '', size = 24, strokeWidth = 2.5 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

export function RefreshIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}

// ── Dictionary / Learning ─────────────────────────────────────────────────────

export function BookIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
}

export function BulbIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M9 18h6M10 22h4"/>
      <path d="M12 2a7 7 0 0 1 7 7c0 2.87-1.7 5.27-4 6.46V17a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1v-1.54C6.7 14.27 5 11.87 5 9a7 7 0 0 1 7-7z"/>
    </svg>
  );
}

export function LinkIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
}

export function SwapIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <polyline points="17 1 21 5 17 9"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  );
}

export function RepeatIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <polyline points="17 1 21 5 17 9"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  );
}

export function PencilIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/>
    </svg>
  );
}

// ── Stats / Progress ──────────────────────────────────────────────────────────

export function ChartIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
      <line x1="2"  y1="20" x2="22" y2="20"/>
    </svg>
  );
}

export function TrophyIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/>
      <path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
      <path d="M4 5h16v4a8 8 0 0 1-16 0z"/>
      <path d="M12 17v4M8 21h8"/>
      <path d="M9 13.5A7.97 7.97 0 0 0 12 14a7.97 7.97 0 0 0 3-0.5"/>
    </svg>
  );
}

export function FlameIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M12 22a7 7 0 0 1-7-7c0-4.5 3-7.5 4-10 1.5 2 2 4 2 6.5C12 9 14 7 15 4c2 3.5 3 5 3 7a7 7 0 0 1-6 6.93V22z"/>
    </svg>
  );
}

export function XPIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="none"/>
    </svg>
  );
}

// ── Media / Player ────────────────────────────────────────────────────────────

export function PlayIcon({ className = '', size = 24, strokeWidth = 2, filled = true }: IconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <polygon points="5 3 19 12 5 21 5 3" fill={filled ? 'currentColor' : 'none'}/>
    </svg>
  );
}

export function PauseIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}

export function VideoIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <rect x="1" y="4" width="15" height="16" rx="2"/>
      <polygon points="16 9 23 4 23 20 16 15 16 9"/>
    </svg>
  );
}

export function SubtitleIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <rect x="2" y="3" width="20" height="15" rx="2"/>
      <path d="M8 19l4 3 4-3"/>
      <path d="M7 9h4M7 13h10M15 9h2"/>
    </svg>
  );
}

// ── Settings / Profile ────────────────────────────────────────────────────────

export function SettingsIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

export function UserIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

export function BellIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

export function BellOffIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M13.73 21a2 2 0 0 1-3.46 0M18.63 13A17.9 17.9 0 0 1 18 8"/>
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/>
      <path d="M18 8a6 6 0 0 0-9.33-5"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

// ── Misc ──────────────────────────────────────────────────────────────────────

export function OfflineIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
      <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}

export function SyncIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}

export function TagIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="3"/>
    </svg>
  );
}

export function NoteIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

export function ExportIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

export function ImportIcon({ className = '', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

export function SpellingIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M8 16l2-6 2 6M9.5 13h3"/>
      <path d="M14 8v8M17 8h-3v4h3M17 12h-3"/>
    </svg>
  );
}

export function ScrambleIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <rect x="2" y="2" width="9" height="9" rx="2"/>
      <rect x="13" y="2" width="9" height="9" rx="2"/>
      <rect x="2" y="13" width="9" height="9" rx="2"/>
      <rect x="13" y="13" width="9" height="9" rx="2"/>
      <path d="M7 7l10 10M17 7L7 17" strokeWidth="2.5"/>
    </svg>
  );
}

export function MatchIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <rect x="2" y="4" width="8" height="6" rx="1.5"/>
      <rect x="14" y="4" width="8" height="6" rx="1.5"/>
      <rect x="2" y="14" width="8" height="6" rx="1.5"/>
      <rect x="14" y="14" width="8" height="6" rx="1.5"/>
      <path d="M10 7h4M10 17h4"/>
    </svg>
  );
}

export function CrosswordIcon({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(strokeWidth)}>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M9 3v18M3 9h18M15 9v12M3 15h12"/>
    </svg>
  );
}
