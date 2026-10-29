import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BingoService } from '../../services/bingo';
import { BingoBall, BingoLetter } from '../../models/game.model';

@Component({
  selector: 'app-board',
  imports: [RouterLink],
  templateUrl: './board.html',
  styleUrl: './board.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Board {
  private readonly bingo = inject(BingoService);

  readonly letters: BingoLetter[] = ['B', 'I', 'N', 'G', 'O'];

  /**
   * false (padrão): letras no topo, números descendo nas colunas (5 colunas x 15 linhas).
   * true (invertido): letras na lateral esquerda, números na horizontal (5 linhas x 15 colunas).
   */
  readonly horizontal = signal(false);

  readonly game = this.bingo.currentGame;

  /** Layout vertical: 15 linhas, cada uma com 5 bolas (uma por coluna B I N G O). */
  readonly rows = computed<BingoBall[][]>(() => {
    const result: BingoBall[][] = [];
    for (let i = 0; i < 15; i++) {
      const row: BingoBall[] = [];
      for (let c = 0; c < 5; c++) {
        row.push(this.bingo.toBall(c * 15 + i + 1));
      }
      result.push(row);
    }
    return result;
  });

  /** Layout horizontal: 5 linhas (uma por letra), cada uma com 15 bolas. */
  readonly lines = computed<{ letter: BingoLetter; balls: BingoBall[] }[]>(() => {
    return this.letters.map((letter, c) => {
      const balls: BingoBall[] = [];
      for (let i = 0; i < 15; i++) {
        balls.push(this.bingo.toBall(c * 15 + i + 1));
      }
      return { letter, balls };
    });
  });

  readonly drawnSet = computed(() => new Set(this.game()?.drawnNumbers ?? []));

  readonly lastBalls = computed<BingoBall[]>(() => {
    const drawn = this.game()?.drawnNumbers ?? [];
    return drawn.slice(-5).map((n) => this.bingo.toBall(n));
  });

  readonly currentBall = computed<BingoBall | null>(() => {
    const drawn = this.game()?.drawnNumbers ?? [];
    if (!drawn.length) return null;
    return this.bingo.toBall(drawn[drawn.length - 1]);
  });

  readonly drawnCount = computed(() => this.game()?.drawnNumbers.length ?? 0);

  isDrawn(n: number): boolean {
    return this.drawnSet().has(n);
  }

  isCurrent(n: number): boolean {
    return this.currentBall()?.number === n;
  }

  onBallClick(ball: BingoBall): void {
    let game = this.game();
    if (!game) {
      game = this.bingo.startNewGame();
    }
    this.bingo.toggleNumber(game.id, ball.number);
  }

  toggleOrientation(): void {
    this.horizontal.update((v) => !v);
  }

  newGame(): void {
    this.bingo.startNewGame();
  }

  finishGame(): void {
    const game = this.game();
    if (game) {
      this.bingo.finishGame(game.id);
    }
  }
}
