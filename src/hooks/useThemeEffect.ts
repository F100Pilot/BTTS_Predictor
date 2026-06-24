import { useEffect } from 'react';
import { useSettings } from '@/store/settingsStore';

/** Applies the selected theme to <html> and reacts to system changes. */
export function useThemeEffect(): void {
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = (): void => {
      const isDark = theme === 'dark' || (theme === 'system' && media.matches);
      root.classList.toggle('dark', isDark);
    };

    apply();
    if (theme === 'system') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
    return undefined;
  }, [theme]);
}
