import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
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
  readonly horizontal = signal(true);

  /** Ordem dos cards na tela (arrastável). Persistida no localStorage. */
  private static readonly ORDER_KEY = 'bingo:cardOrder:v1';
  private static readonly SIZE_KEY = 'bingo:cardSizes:v1';
  readonly cardOrder = signal<string[]>(this.loadOrder());

  /** Tamanhos personalizados por card (resize). */
  readonly cardSizes = signal<Record<string, { w: number; h: number }>>(this.loadSizes());

  private dragId: string | null = null;

  /** Referência ao conteúdo do painel que será movido para a janela flutuante. */
  readonly panelContent = viewChild<ElementRef<HTMLElement>>('panelContent');

  /** Marcador do local original do painel na tela principal. */
  readonly panelAnchor = viewChild<ElementRef<HTMLElement>>('panelAnchor');

  /** true quando o painel está destacado em outra janela. */
  readonly poppedOut = signal(false);

  private pipWindow: Window | null = null;

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

  // ----- Reordenar cards (drag & drop) ---------------------------------
  onDragStart(id: string, event: DragEvent): void {
    this.dragId = id;
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  onDrop(targetId: string, event: DragEvent): void {
    event.preventDefault();
    const sourceId = this.dragId ?? event.dataTransfer?.getData('text/plain') ?? null;
    this.dragId = null;
    if (!sourceId || sourceId === targetId) return;

    const order = [...this.cardOrder()];
    const from = order.indexOf(sourceId);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;

    order.splice(from, 1);
    order.splice(to, 0, sourceId);
    this.cardOrder.set(order);
    this.persistOrder(order);
  }

  isDragging(id: string): boolean {
    return this.dragId === id;
  }

  // ----- Redimensionar cards ------------------------------------------
  styleFor(id: string): Record<string, string> {
    const size = this.cardSizes()[id];
    if (!size) return {};
    return { width: `${size.w}px`, height: `${size.h}px` };
  }

  onResizeEnd(id: string, el: HTMLElement): void {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const sizes = { ...this.cardSizes(), [id]: { w, h } };
    this.cardSizes.set(sizes);
    this.persistSizes(sizes);
  }

  resetLayout(): void {
    this.cardOrder.set(['last', 'current', 'panel']);
    this.cardSizes.set({});
    this.persistOrder(this.cardOrder());
    this.persistSizes({});
  }

  // ----- Persistência --------------------------------------------------
  private loadOrder(): string[] {
    const fallback = ['last', 'current', 'panel'];
    try {
      const raw = localStorage.getItem(Board.ORDER_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as string[];
      // Garante que todos os cards estejam presentes.
      const valid = fallback.every((id) => parsed.includes(id)) && parsed.length === fallback.length;
      return valid ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  private persistOrder(order: string[]): void {
    try {
      localStorage.setItem(Board.ORDER_KEY, JSON.stringify(order));
    } catch {
      // ignora
    }
  }

  private loadSizes(): Record<string, { w: number; h: number }> {
    try {
      const raw = localStorage.getItem(Board.SIZE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, { w: number; h: number }>;
    } catch {
      return {};
    }
  }

  private persistSizes(sizes: Record<string, { w: number; h: number }>): void {
    try {
      localStorage.setItem(Board.SIZE_KEY, JSON.stringify(sizes));
    } catch {
      // ignora
    }
  }

  /** Suporte à Document Picture-in-Picture API. */
  get canPopOut(): boolean {
    return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  }

  async popOutPanel(): Promise<void> {
    if (this.poppedOut()) {
      this.closePopOut();
      return;
    }

    const content = this.panelContent()?.nativeElement;
    if (!content) return;

    if (!this.canPopOut) {
      alert('Seu navegador não suporta destacar o painel em janela flutuante. Use o Chrome/Edge mais recente.');
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pip = await (window as any).documentPictureInPicture.requestWindow({
        width: 1000,
        height: 700,
      });
      this.pipWindow = pip as Window;

      // Copia todos os estilos da página para a janela flutuante.
      this.copyStyles(this.pipWindow);
      this.pipWindow.document.title = 'Painel BINGO';
      this.pipWindow.document.body.classList.add('pip-body');

      // Move o conteúdo real do painel para a janela flutuante.
      this.pipWindow.document.body.append(content);
      this.poppedOut.set(true);

      // Quando a janela for fechada, devolve o painel para a tela principal.
      this.pipWindow.addEventListener('pagehide', () => this.restorePanel());
    } catch {
      this.restorePanel();
    }
  }

  closePopOut(): void {
    this.pipWindow?.close();
    this.restorePanel();
  }

  private restorePanel(): void {
    const content = this.panelContent()?.nativeElement;
    const anchor = this.panelAnchor()?.nativeElement;
    if (content && anchor && !anchor.contains(content)) {
      anchor.append(content);
    }
    this.pipWindow = null;
    this.poppedOut.set(false);
  }

  private copyStyles(target: Window): void {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules).map((r) => r.cssText).join('');
        const style = target.document.createElement('style');
        style.textContent = rules;
        target.document.head.appendChild(style);
      } catch {
        // Folhas de estilo de origem cruzada: recria via <link>.
        if (sheet.href) {
          const link = target.document.createElement('link');
          link.rel = 'stylesheet';
          link.href = sheet.href;
          target.document.head.appendChild(link);
        }
      }
    }
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
