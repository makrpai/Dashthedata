export const THEME_KEY = 'dtd:theme';
export const CONTRAST_KEY = 'dtd:contrast';
export const SIDEBAR_KEY = 'dtd:sidebar';

/** Runs before first paint (inline script) so the theme never flashes. */
export const themeInitScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('${THEME_KEY}');d.dataset.theme=(t==='light'||t==='dark')?t:'system';var c=localStorage.getItem('${CONTRAST_KEY}');d.dataset.contrast=c==='high'?'high':'normal';var s=localStorage.getItem('${SIDEBAR_KEY}');if(s)d.dataset.sidebar=s;}catch(e){}})();`;
