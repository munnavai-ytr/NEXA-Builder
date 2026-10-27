// NEXA Builder Design Tokens & Theme System

export interface ThemeTokens {
  id: string;
  name: string;
  colors: {
    bg: string;
    bgElevated: string;
    bgSurface: string;
    bgHover: string;
    border: string;
    borderFocus: string;
    accentPrimary: string;
    accentSecondary: string;
    accentGradient: string;
    accentGlow: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
  radius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    glass: string;
    accent: string;
  };
  fonts: {
    sans: string;
    mono: string;
  };
}

export const THEME_PRESETS: Record<string, ThemeTokens> = {
  violetCyan: {
    id: 'violetCyan',
    name: 'NEXA Violet & Cyan (Default)',
    colors: {
      bg: '#070A12',
      bgElevated: '#0C101D',
      bgSurface: 'rgba(16, 22, 38, 0.65)',
      bgHover: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.08)',
      borderFocus: 'rgba(124, 92, 255, 0.6)',
      accentPrimary: '#7C5CFF',
      accentSecondary: '#22D3EE',
      accentGradient: 'linear-gradient(135deg, #7C5CFF 0%, #22D3EE 100%)',
      accentGlow: '0 0 24px rgba(124, 92, 255, 0.35)',
      textPrimary: '#F1F5F9',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#38BDF8',
    },
    radius: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      full: '9999px',
    },
    shadows: {
      sm: '0 1px 2px rgba(0, 0, 0, 0.5)',
      md: '0 4px 12px rgba(0, 0, 0, 0.6)',
      lg: '0 12px 32px rgba(0, 0, 0, 0.8)',
      glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      accent: '0 4px 20px rgba(124, 92, 255, 0.25)',
    },
    fonts: {
      sans: 'Inter, system-ui, -apple-system, sans-serif',
      mono: '"JetBrains Mono", "Fira Code", monospace',
    },
  },
  emeraldMatrix: {
    id: 'emeraldMatrix',
    name: 'Cyber Emerald',
    colors: {
      bg: '#050D0A',
      bgElevated: '#081711',
      bgSurface: 'rgba(10, 28, 20, 0.65)',
      bgHover: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(16, 185, 129, 0.15)',
      borderFocus: 'rgba(16, 185, 129, 0.6)',
      accentPrimary: '#10B981',
      accentSecondary: '#34D399',
      accentGradient: 'linear-gradient(135deg, #059669 0%, #34D399 100%)',
      accentGlow: '0 0 24px rgba(16, 185, 129, 0.35)',
      textPrimary: '#F0FDF4',
      textSecondary: '#A7F3D0',
      textMuted: '#6EE7B7',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#06B6D4',
    },
    radius: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      full: '9999px',
    },
    shadows: {
      sm: '0 1px 2px rgba(0, 0, 0, 0.5)',
      md: '0 4px 12px rgba(0, 0, 0, 0.6)',
      lg: '0 12px 32px rgba(0, 0, 0, 0.8)',
      glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      accent: '0 4px 20px rgba(16, 185, 129, 0.25)',
    },
    fonts: {
      sans: 'Inter, system-ui, -apple-system, sans-serif',
      mono: '"JetBrains Mono", "Fira Code", monospace',
    },
  },
  amberSolar: {
    id: 'amberSolar',
    name: 'Solar Amber',
    colors: {
      bg: '#0F0B06',
      bgElevated: '#1A140A',
      bgSurface: 'rgba(32, 23, 10, 0.65)',
      bgHover: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(245, 158, 11, 0.15)',
      borderFocus: 'rgba(245, 158, 11, 0.6)',
      accentPrimary: '#F59E0B',
      accentSecondary: '#F97316',
      accentGradient: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)',
      accentGlow: '0 0 24px rgba(245, 158, 11, 0.35)',
      textPrimary: '#FFFBEB',
      textSecondary: '#FDE68A',
      textMuted: '#B45309',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#38BDF8',
    },
    radius: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      full: '9999px',
    },
    shadows: {
      sm: '0 1px 2px rgba(0, 0, 0, 0.5)',
      md: '0 4px 12px rgba(0, 0, 0, 0.6)',
      lg: '0 12px 32px rgba(0, 0, 0, 0.8)',
      glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      accent: '0 4px 20px rgba(245, 158, 11, 0.25)',
    },
    fonts: {
      sans: 'Inter, system-ui, -apple-system, sans-serif',
      mono: '"JetBrains Mono", "Fira Code", monospace',
    },
  },
};

export function applyTheme(themeKey: string) {
  if (typeof document === 'undefined') return;
  const theme = THEME_PRESETS[themeKey] || THEME_PRESETS.violetCyan;
  const root = document.documentElement;

  root.style.setProperty('--nexa-bg', theme.colors.bg);
  root.style.setProperty('--nexa-bg-elevated', theme.colors.bgElevated);
  root.style.setProperty('--nexa-bg-surface', theme.colors.bgSurface);
  root.style.setProperty('--nexa-bg-hover', theme.colors.bgHover);
  root.style.setProperty('--nexa-border', theme.colors.border);
  root.style.setProperty('--nexa-border-focus', theme.colors.borderFocus);
  root.style.setProperty('--nexa-accent-primary', theme.colors.accentPrimary);
  root.style.setProperty('--nexa-accent-secondary', theme.colors.accentSecondary);
  root.style.setProperty('--nexa-accent-gradient', theme.colors.accentGradient);
  root.style.setProperty('--nexa-accent-glow', theme.colors.accentGlow);
  root.style.setProperty('--nexa-text-primary', theme.colors.textPrimary);
  root.style.setProperty('--nexa-text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--nexa-text-muted', theme.colors.textMuted);
  root.style.setProperty('--nexa-success', theme.colors.success);
  root.style.setProperty('--nexa-warning', theme.colors.warning);
  root.style.setProperty('--nexa-danger', theme.colors.danger);
  root.style.setProperty('--nexa-info', theme.colors.info);
  root.style.setProperty('--nexa-radius-sm', theme.radius.sm);
  root.style.setProperty('--nexa-radius-md', theme.radius.md);
  root.style.setProperty('--nexa-radius-lg', theme.radius.lg);
  root.style.setProperty('--nexa-radius-xl', theme.radius.xl);
}
