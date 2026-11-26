export const THEME_COOKIE = "kontaflow_theme";

export const THEME_MODES = ["light", "dark", "system"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);
}

/**
 * Runs before first paint so the stored theme is applied without a flash.
 * Kept dependency-free because it is injected into <head> as an inline script.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var match=document.cookie.match(/(?:^|; )kontaflow_theme=([^;]+)/);
var mode=match?decodeURIComponent(match[1]):"system";
if(mode!=="light"&&mode!=="dark"&&mode!=="system"){mode="system";}
var prefersDark=window.matchMedia("(prefers-color-scheme: dark)").matches;
var dark=mode==="dark"||(mode==="system"&&prefersDark);
var root=document.documentElement;
root.classList.toggle("dark",dark);
root.style.colorScheme=dark?"dark":"light";
root.dataset.theme=mode;
}catch(e){}})();`;
