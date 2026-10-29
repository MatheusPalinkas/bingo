import { Injectable, computed, signal } from '@angular/core';
import { BingoBall, BingoLetter, Game } from '../models/game.model';
import { readStorage, writeStorage, STORAGE_KEYS } from './storage';

const TOTAL_NUMBERS = 75;

const COLUMN_RANGES: { letter: BingoLetter; min: number; max: number }[] = [
  { letter: 'B', min: 1, max: 15 },
  { letter: 'I', min: 16, max: 30 },
  { letter: 'N', min: 31, max: 45 },
  { letter: 'G', min: 46, max: 60 },
  { letter: 'O', min: 61, max: 75 },
];

@Injectable({ providedIn: 'root' })
export class BingoService {
  private readonly gamesSignal = signal<Game[]>(this.load());

  readonly games = this.gamesSignal.asReadonly();

  constructor() {
    // Mantém as janelas (ex.: painel destacado) sincronizadas: quando outra
    // janela grava no localStorage, recarregamos o estado aqui.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEYS.games) {
          this.gamesSignal.set(this.load());
        }
      });
    }
  }

  readonly currentGame = computed(
    () => this.gamesSignal().find((g) => g.status === 'em-andamento') ?? null,
  );

  startNewGame(): Game {
    const now = Date.now();

    // Clona cada partida para preservar a imutabilidade do estado.
    const games = this.gamesSignal().map((g) =>
      g.status === 'em-andamento'
        ? { ...g, status: 'finalizada' as const, finishedAt: now, updatedAt: now }
        : { ...g },
    );

    const number = this.nextGameNumber(games);
    const newGame: Game = {
      id: this.makeId(),
      number,
      name: `Partida #${number}`,
      status: 'em-andamento',
      createdAt: now,
      updatedAt: now,
      drawnNumbers: [],
    };

    this.gamesSignal.set([newGame, ...games]);
    this.persist();
    return newGame;
  }

  toggleNumber(gameId: string, n: number): void {
    if (n < 1 || n > TOTAL_NUMBERS) return;
    this.updateGame(gameId, (game) => {
      if (game.status !== 'em-andamento') return game;
      const idx = game.drawnNumbers.indexOf(n);
      if (idx >= 0) {
        game.drawnNumbers.splice(idx, 1);
      } else {
        game.drawnNumbers.push(n);
      }
      game.updatedAt = Date.now();
      return game;
    });
  }

  finishGame(gameId: string): void {
    this.updateGame(gameId, (game) => {
      game.status = 'finalizada';
      game.finishedAt = Date.now();
      game.updatedAt = Date.now();
      return game;
    });
  }

  reopenGame(gameId: string): void {
    const now = Date.now();
    const games = this.gamesSignal().map((g) => {
      if (g.id === gameId) {
        return { ...g, status: 'em-andamento' as const, finishedAt: undefined, updatedAt: now };
      }
      if (g.status === 'em-andamento') {
        return { ...g, status: 'finalizada' as const, finishedAt: now, updatedAt: now };
      }
      return { ...g };
    });
    this.gamesSignal.set(games);
    this.persist();
  }

  deleteGame(gameId: string): void {
    this.gamesSignal.set(this.gamesSignal().filter((g) => g.id !== gameId));
    this.persist();
  }

  toBall(n: number): BingoBall {
    const range = COLUMN_RANGES.find((r) => n >= r.min && n <= r.max) ?? COLUMN_RANGES[0];
    return { number: n, letter: range.letter, label: `${range.letter}-${n}` };
  }

  private updateGame(gameId: string, mutator: (game: Game) => Game): void {
    const games = this.gamesSignal().map((g) =>
      g.id === gameId ? mutator({ ...g, drawnNumbers: [...g.drawnNumbers] }) : g,
    );
    this.gamesSignal.set(games);
    this.persist();
  }

  private persist(): void {
    writeStorage(STORAGE_KEYS.games, this.gamesSignal());
  }

  private load(): Game[] {
    const parsed = readStorage<unknown>(STORAGE_KEYS.games, []);
    if (!Array.isArray(parsed)) return [];
    // Migração: garante o campo `number` em dados antigos.
    return parsed
      .filter((g): g is Game => !!g && typeof g === 'object' && 'id' in g)
      .map((g, i) => ({
        ...(g as Game),
        number: (g as Game).number ?? this.extractNumber((g as Game).name) ?? i + 1,
        drawnNumbers: Array.isArray((g as Game).drawnNumbers) ? (g as Game).drawnNumbers : [],
      }));
  }

  private nextGameNumber(games: Game[]): number {
    const max = games.reduce((m, g) => Math.max(m, g.number ?? 0), 0);
    return max + 1;
  }

  private extractNumber(name: string | undefined): number | null {
    if (!name) return null;
    const match = name.match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  private makeId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
