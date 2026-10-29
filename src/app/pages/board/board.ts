import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { BingoService } from '../../services/bingo';
import { ThemeService } from '../../services/theme';
import { readStorage, writeStorage, STORAGE_KEYS } from '../../services/storage';
import { BingoBall, BingoLetter } from '../../models/game.model';

interface CardSize {
  w: number;
  h: number;
}

type CardId = 'last' | 'current' | 'panel';

@Component({
  selector: 'app-board',
  imports: [RouterLink],
  templateUrl: './board.html',
  styleUrl: './board.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Board implements AfterViewInit, OnDestroy {
  private readonly bingo = inject(BingoService);
  private readonly themeService = inject(ThemeService);

  readonly theme = this.themeService.theme;

  readonly letters: BingoLetter[] = ['B', 'I', 'N', 'G', 'O'];

  /**
   * false: letras no topo, números descendo nas colunas (5 colunas x 15 linhas).
   * true (padrão): letras na lateral, números na horizontal (5 linhas x 15 colunas).
   */
  readonly horizontal = signal(true);

  // ----- Redimensionamento dos cards -----------------------------------

  /** Tamanhos personalizados por card (apenas quando o usuário redimensiona). */
  readonly sizes = signal<Partial<Record<CardId, CardSize>>>(this.loadSizes());

  private resizeObserver: ResizeObserver | null = null;

  /** Elementos redimensionáveis registrados, por card. */
  private readonly elements = new Map<CardId, HTMLElement>();

  /** Suspende a persistência do observer durante o reset programático. */
  private suppressResizeSave = false;

  /** Cards cuja notificação inicial do observer já foi ignorada. */
  private readonly observed = new Set<CardId>();

  readonly lastCard = viewChild<ElementRef<HTMLElement>>('lastCard');
  readonly currentCard = viewChild<ElementRef<HTMLElement>>('currentCard');

  // ----- Pop-out (Document Picture-in-Picture) -------------------------
  readonly panelContent = viewChild<ElementRef<HTMLElement>>('panelContent');
  readonly panelAnchor = viewChild<ElementRef<HTMLElement>>('panelAnchor');
  readonly poppedOut = signal(false);

  private pipWindow: Window | null = null;
  private pipCloseHandler: (() => void) | null = null;

  readonly game = this.bingo.currentGame;

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

  readonly lines = computed<{ letter: BingoLetter; balls: BingoBall[] }[]>(() =>
    this.letters.map((letter, c) => {
      const balls: BingoBall[] = [];
      for (let i = 0; i < 15; i++) {
        balls.push(this.bingo.toBall(c * 15 + i + 1));
      }
      return { letter, balls };
    }),
  );

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

  ngAfterViewInit(): void {
    const last = this.lastCard()?.nativeElement;
    const current = this.currentCard()?.nativeElement;
    const panel = this.panelAnchor()?.nativeElement;
    if (last) this.registerResizable('last', last);
    if (current) this.registerResizable('current', current);
    if (panel) this.registerResizable('panel', panel);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.teardownPip();
  }

  // ----- Domínio do bingo ----------------------------------------------
  isDrawn(n: number): boolean {
    return this.drawnSet().has(n);
  }

  isCurrent(n: number): boolean {
    return this.currentBall()?.number === n;
  }

  onBallClick(ball: BingoBall): void {
    const game = this.game() ?? this.bingo.startNewGame();
    this.bingo.toggleNumber(game.id, ball.number);
  }

  toggleOrientation(): void {
    this.horizontal.update((v) => !v);
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  newGame(): void {
    this.bingo.startNewGame();
  }

  finishGame(): void {
    const game = this.game();
    if (game) this.bingo.finishGame(game.id);
  }

  // ----- Redimensionar cards -------------------------------------------
  styleFor(id: CardId): Record<string, string> {
    const size = this.sizes()[id];
    if (!size) return {};
    return { width: `${size.w}px`, height: `${size.h}px` };
  }

  /** Observa redimensionamentos e salva o tamanho de forma confiável. */
  private registerResizable(id: CardId, el: HTMLElement): void {
    if (!('ResizeObserver' in window)) return;
    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver((entries) => {
        if (this.suppressResizeSave) return;
        let changed = false;
        const next = { ...this.sizes() };
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          const cardId = target.dataset['card'] as CardId | undefined;
          if (!cardId) continue;

          // Ignora a primeira notificação (tamanho natural inicial).
          if (!this.observed.has(cardId)) {
            this.observed.add(cardId);
            continue;
          }

          const w = Math.round(entry.contentRect.width);
          const h = Math.round(entry.contentRect.height);
          const cur = next[cardId];
          if (!cur || cur.w !== w || cur.h !== h) {
            next[cardId] = { w, h };
            changed = true;
          }
        }
        if (changed) {
          this.sizes.set(next);
          this.persistSizes();
        }
      });
    }
    el.dataset['card'] = id;
    this.elements.set(id, el);
    this.resizeObserver.observe(el);
  }

  resetLayout(): void {
    // Evita que o observer re-salve os tamanhos enquanto limpamos.
    this.suppressResizeSave = true;

    // O CSS `resize` grava width/height inline no elemento; é preciso apagá-los.
    for (const el of this.elements.values()) {
      el.style.removeProperty('width');
      el.style.removeProperty('height');
    }

    this.sizes.set({});
    this.persistSizes();

    // Reativa a persistência após o ciclo atual de layout (quando o observer
    // já disparou com os tamanhos naturais restaurados).
    setTimeout(() => (this.suppressResizeSave = false), 50);
  }

  private loadSizes(): Partial<Record<CardId, CardSize>> {
    const parsed = readStorage<Partial<Record<CardId, CardSize>>>(STORAGE_KEYS.cardSizes, {});
    const result: Partial<Record<CardId, CardSize>> = {};
    for (const id of ['last', 'current', 'panel'] as CardId[]) {
      const size = parsed[id];
      if (this.isValidSize(size)) result[id] = size;
    }
    return result;
  }

  private isValidSize(size: unknown): size is CardSize {
    if (!size || typeof size !== 'object') return false;
    const s = size as Record<string, unknown>;
    return (
      ['w', 'h'].every((k) => typeof s[k] === 'number' && Number.isFinite(s[k])) &&
      (s['w'] as number) > 0 &&
      (s['h'] as number) > 0
    );
  }

  private persistSizes(): void {
    writeStorage(STORAGE_KEYS.cardSizes, this.sizes());
  }

  // ----- Pop-out -------------------------------------------------------
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
      alert(
        'Seu navegador não suporta destacar o painel em janela flutuante. Use o Chrome/Edge mais recente.',
      );
      return;
    }

    try {
      // A tipagem da API ainda não está nos tipos padrão do DOM.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pip: Window = await (window as any).documentPictureInPicture.requestWindow({
        width: 1000,
        height: 700,
      });
      this.pipWindow = pip;

      this.copyStyles(pip);
      pip.document.title = 'Painel BINGO';
      pip.document.body.classList.add('pip-body');
      pip.document.body.append(content);
      this.poppedOut.set(true);

      this.pipCloseHandler = () => this.restorePanel();
      pip.addEventListener('pagehide', this.pipCloseHandler);
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
    this.teardownPip();
    this.poppedOut.set(false);
  }

  private teardownPip(): void {
    if (this.pipWindow && this.pipCloseHandler) {
      this.pipWindow.removeEventListener('pagehide', this.pipCloseHandler);
    }
    this.pipCloseHandler = null;
    this.pipWindow = null;
  }

  private copyStyles(target: Window): void {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules)
          .map((r) => r.cssText)
          .join('');
        const style = target.document.createElement('style');
        style.textContent = rules;
        target.document.head.appendChild(style);
      } catch {
        if (sheet.href) {
          const link = target.document.createElement('link');
          link.rel = 'stylesheet';
          link.href = sheet.href;
          target.document.head.appendChild(link);
        }
      }
    }
  }
}
