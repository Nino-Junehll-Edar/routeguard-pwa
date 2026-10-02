export type AppTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'routeguard-theme';

export function initializeTheme(): AppTheme {
  let theme: AppTheme = 'light';
  if (typeof window !== 'undefined') {
    try {
      theme = window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = theme;
  }
  return theme;
}

export function setAppTheme(theme: AppTheme): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The current page still changes theme when storage is unavailable.
    }
  }
}