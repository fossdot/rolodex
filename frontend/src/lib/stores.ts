import { writable } from 'svelte/store';
import { pb } from './pb';
import type { User } from './types';

// ── Auth ──────────────────────────────────────────────────────────────────────
function createAuthStore() {
  const { subscribe, set } = writable<User | null>(
    pb.authStore.isValid ? (pb.authStore.record as unknown as User) : null
  );

  if (typeof window !== 'undefined') {
    pb.authStore.onChange(() => {
      set(pb.authStore.isValid ? (pb.authStore.record as unknown as User) : null);
    });
  }

  return { subscribe };
}
export const currentUser = createAuthStore();

// ── Keyboard-shortcuts help dialog ─────────────────────────────────────────────
function createShortcutsStore() {
  const { subscribe, set } = writable(false);
  return { subscribe, open: () => set(true), close: () => set(false) };
}
export const shortcutsHelp = createShortcutsStore();

// ── Theme ─────────────────────────────────────────────────────────────────────
function createThemeStore() {
  const initial: 'light' | 'dark' =
    typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark'
      ? 'dark'
      : 'light';

  const { subscribe, update, set } = writable<'light' | 'dark'>(initial);

  return {
    subscribe,
    toggle() {
      update((t) => {
        const next = t === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', next);
        document.documentElement.classList.toggle('dark', next === 'dark');
        return next;
      });
    },
    init() {
      if (typeof window === 'undefined') return;
      const saved = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const resolved = saved ? saved : prefersDark ? 'dark' : 'light';
      set(resolved as 'light' | 'dark');
      document.documentElement.classList.toggle('dark', resolved === 'dark');
    },
  };
}
export const theme = createThemeStore();

// ── Toasts ────────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'info';
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  function add(type: ToastType, message: string) {
    const id = Math.random().toString(36).slice(2, 9);
    update((t) => [...t, { id, type, message }]);
    setTimeout(() => remove(id), 4500);
  }

  function remove(id: string) {
    update((t) => t.filter((x) => x.id !== id));
  }

  return {
    subscribe,
    success: (m: string) => add('success', m),
    error: (m: string) => add('error', m),
    info: (m: string) => add('info', m),
    remove,
  };
}
export const toasts = createToastStore();
