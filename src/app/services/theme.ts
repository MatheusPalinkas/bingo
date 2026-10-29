import { Injectable, signal } from '@angular/core';
import { readStorage, writeStorage, STORAGE_KEYS } from './storage';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.load());

  constructor() {
    this.apply(this.theme());
  }

  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    this.theme.set(theme);
    this.apply(theme);
    writeStorage(STORAGE_KEYS.theme, theme);
  }

  private apply(theme: Theme): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  private load(): Theme {
    // Nota: em SSR/prerender não há window; o tema inicial será 'light' e
    // é reconciliado no cliente, podendo causar um breve flash.
    const saved = readStorage<Theme | null>(STORAGE_KEYS.theme, null);
    if (saved === 'light' || saved === 'dark') return saved;

    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
}
