import { ref, watchEffect } from 'vue';

export type ThemeMode = 'system' | 'light' | 'dark';

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

const saved = localStorage.getItem('theme');
const themeMode = ref<ThemeMode>(
  saved === 'system' || saved === 'light' || saved === 'dark' ? saved : 'system'
);

// Synchronous init to prevent FOUC
document.documentElement.dataset.theme = resolveTheme(themeMode.value);

watchEffect((onCleanup) => {
  const mode = themeMode.value;
  document.documentElement.dataset.theme = resolveTheme(mode);
  localStorage.setItem('theme', mode);

  if (mode === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => {
      document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
    };
    mq.addEventListener('change', listener);
    onCleanup(() => mq.removeEventListener('change', listener));
  }
});

export function useTheme() {
  function setTheme(mode: ThemeMode) {
    themeMode.value = mode;
  }
  return { themeMode, setTheme };
}
