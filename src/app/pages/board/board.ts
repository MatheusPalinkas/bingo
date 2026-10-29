import {
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
import { BingoBall, BingoLetter } from '../../models/game.model';

/** API exposta pelo preload do Electron (quando rodando no desktop). */
interface ElectronAPI {
  isElectron: boolean;
  openPanelWindow(): Promise<void>;
  closePanelWindow(): Promise<void>;
  onPanelClosed(callback: () => void): () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

@Component({
  selector: 'app-board',
  imports: [RouterLink],
  templateUrl: './board.html',
  styleUrl: './board.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Board implements OnDestroy {
  private readonly bingo = inject(BingoService);
  private readonly themeService = inject(ThemeService);

  readonly theme = this.themeService.theme;

  readonly letters: BingoLetter[] = ['B', 'I', 'N', 'G', 'O'];

  // ----- Pop-out (painel destacado) ------------------------------------
  readonly panelContent = viewChild<ElementRef<HTMLElement>>('panelContent');
  readonly panelAnchor = viewChild<ElementRef<HTMLElement>>('panelAnchor');
  readonly poppedOut = signal(false);

  /** true quando esta janela é o painel destacado (modo somente-painel). */
  readonly panelMode = signal(this.readPanelMode());

  private pipWindow: Window | null = null;
  private pipCloseHandler: (() => void) | null = null;
  private electronPanelCleanup: (() => void) | null = null;

  readonly game = this.bingo.currentGame;

  /** Linhas do painel: uma por letra (B I N G O), cada uma com 15 bolas. */
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

  ngOnDestroy(): void {
    this.teardownPip();
    this.electronPanelCleanup?.();
  }

  private readPanelMode(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return new URLSearchParams(window.location.search).get('mode') === 'panel';
    } catch {
      return false;
    }
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

  // ----- Pop-out -------------------------------------------------------
  private get electron(): ElectronAPI | undefined {
    return typeof window !== 'undefined' ? window.electronAPI : undefined;
  }

  get canPopOut(): boolean {
    if (typeof window === 'undefined') return false;
    return !!this.electron || 'documentPictureInPicture' in window;
  }

  async popOutPanel(): Promise<void> {
    if (this.poppedOut()) {
      this.closePopOut();
      return;
    }

    // No Electron, abrimos uma segunda janela nativa (o PiP do navegador não
    // funciona de forma confiável aqui).
    if (this.electron) {
      await this.electron.openPanelWindow();
      this.poppedOut.set(true);
      // Quando a janela do painel for fechada, volta ao estado normal.
      this.electronPanelCleanup = this.electron.onPanelClosed(() => {
        this.poppedOut.set(false);
        this.electronPanelCleanup?.();
        this.electronPanelCleanup = null;
      });
      return;
    }

    const content = this.panelContent()?.nativeElement;
    if (!content) return;

    if (!('documentPictureInPicture' in window)) {
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
    if (this.electron) {
      this.electron.closePanelWindow();
      this.poppedOut.set(false);
      this.electronPanelCleanup?.();
      this.electronPanelCleanup = null;
      return;
    }
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
