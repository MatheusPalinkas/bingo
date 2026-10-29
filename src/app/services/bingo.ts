import { Injectable, computed, signal } from '@angular/core';
import { BingoBall, BingoLetter, Game, GameStatus } from '../models/game.model';

const STORAGE_KEY = 'bingo:games:v1';
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

  readonly currentGame = computed(
    () => this.gamesSignal().find((g) => g.status === 'em-andamento') ?? null,
  );

  readonly allBalls: BingoBall[] = Array.from({ length: TOTAL_NUMBERS }, (_, i) =>
    this.toBall(i + 1),
  );

  startNewGame(): Game {
    const games = [...this.gamesSignal()];

    for (const g of games) {
      if (g.status === 'em-andamento') {
        g.status = 'finalizada';
        g.finishedAt = Date.now();
        g.updatedAt = Date.now();
      }
    }

    const now = Date.now();
    const newGame: Game = {
      id: this.makeId(),
      name: `Partida #${this.nextGameNumber(games)}`,
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
    const games = this.gamesSignal().map((g) => ({ ...g }));
    for (const g of games) {
      if (g.status === 'em-andamento' && g.id !== gameId) {
        g.status = 'finalizada';
        g.finishedAt = Date.now();
        g.updatedAt = Date.now();
      }
    }
    const target = games.find((g) => g.id === gameId);
    if (target) {
      target.status = 'em-andamento';
      target.finishedAt = undefined;
      target.updatedAt = Date.now();
    }
    this.gamesSignal.set(games);
    this.persist();
  }

  deleteGame(gameId: string): void {
    this.gamesSignal.set(this.gamesSignal().filter((g) => g.id !== gameId));
    this.persist();
  }

  /** Busca uma partida pelo id. */
  getGame(gameId: string): Game | undefined {
    return this.gamesSignal().find((g) => g.id === gameId);
  }

  toBall(n: number): BingoBall {
    const range = COLUMN_RANGES.find((r) => n >= r.min && n <= r.max) ?? COLUMN_RANGES[0];
    return { number: n, letter: range.letter, label: `${range.letter}-${n}` };
  }

  private updateGame(gameId: string, mutator: (game: Game) => Game): void {
    const games = this.gamesSignal().map((g) => (g.id === gameId ? mutator({ ...g, drawnNumbers: [...g.drawnNumbers] }) : g));
    this.gamesSignal.set(games);
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.gamesSignal()));
    } catch {
      // Ignora falhas de armazenamento (modo privado, quota, etc.)
    }
  }

  private load(): Game[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Game[];
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  }

  private nextGameNumber(games: Game[]): number {
    const numbers = games
      .map((g) => Number(g.name.replace(/\D/g, '')))
      .filter((n) => !Number.isNaN(n));
    const max = numbers.length ? Math.max(...numbers) : 0;
    return max + 1;
  }

  private makeId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  get columnRanges() {
    return COLUMN_RANGES;
  }
}
