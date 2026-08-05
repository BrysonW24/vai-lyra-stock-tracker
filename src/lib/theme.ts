/**
 * App theme (dark by default, light opt-in). Lyra is dark by nature; the light theme is applied
 * app-wide by setting data-theme="light" on <html> (the token layer + globals.css light overrides
 * do the rest). Dark is the absence of the attribute, so it needs no class and is the SSR default -
 * which is why the no-FOUC script in layout.tsx only ever ADDS the light attribute.
 */
export type Theme = 'dark' | 'light';

export const THEME_KEY = 'lyra-theme';
export const DEFAULT_THEME: Theme = 'dark';

/** The inline script string run before paint in layout.tsx. Sets light before the body renders so
 * a light-theme user never sees a dark flash. Kept tiny and dependency-free by design. */
export const THEME_INIT_SCRIPT =
  "(function(){try{if(localStorage.getItem('lyra-theme')==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();";

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Reflect a theme onto <html> without persisting. Dark removes the attribute (it is the default). */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');
}

/** Persist + apply. */
export function setTheme(theme: Theme): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* private mode / storage disabled - still apply for this session */
    }
  }
  applyTheme(theme);
}
