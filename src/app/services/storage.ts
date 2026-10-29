/**
 * Helpers de leitura/escrita em localStorage com tratamento de erros.
 * Centraliza o padrão try/catch repetido pelos serviços e componentes.
 */

/** Chaves de localStorage usadas em toda a aplicação. */
export const STORAGE_KEYS = {
  games: 'bingo:games:v1',
  theme: 'bingo:theme:v1',
  cardSizes: 'bingo:cardSizes:v3',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignora falhas de armazenamento (modo privado, quota excedida, etc.)
  }
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignora
  }
}
