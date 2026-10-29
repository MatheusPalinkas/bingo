import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BingoService } from '../../services/bingo';
import { BingoBall, Game } from '../../models/game.model';

@Component({
  selector: 'app-history',
  imports: [RouterLink],
  templateUrl: './history.html',
  styleUrl: './history.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class History {
  private readonly bingo = inject(BingoService);
  private readonly router = inject(Router);

  readonly games = this.bingo.games;

  /** Id da partida expandida no momento */
  readonly expandedId = signal<string | null>(null);

  readonly totalGames = computed(() => this.games().length);

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  isExpanded(id: string): boolean {
    return this.expandedId() === id;
  }

  /** Pedras de uma partida na ordem em que foram sorteadas */
  ballsOf(game: Game): BingoBall[] {
    return game.drawnNumbers.map((n) => this.bingo.toBall(n));
  }

  reopen(game: Game): void {
    this.bingo.reopenGame(game.id);
    this.router.navigate(['/']);
  }

  remove(game: Game): void {
    const ok = confirm(`Remover "${game.name}" do histórico?`);
    if (ok) {
      this.bingo.deleteGame(game.id);
    }
  }

  statusLabel(game: Game): string {
    return game.status === 'em-andamento' ? 'Em andamento' : 'Finalizada';
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
