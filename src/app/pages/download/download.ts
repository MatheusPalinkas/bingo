import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-download',
  imports: [RouterLink],
  templateUrl: './download.html',
  styleUrl: './download.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Download {
  /**
   * URL do instalador resolvida a partir do <base href> do documento.
   * O arquivo fica em `public/Bingo-Setup.exe`, que o Angular copia para a
   * raiz do site no build (ex.: /bingo/Bingo-Setup.exe no GitHub Pages).
   */
  readonly installerUrl = this.resolveFromBase('Bingo-Setup.exe');

  private resolveFromBase(relative: string): string {
    if (typeof document === 'undefined') return relative;
    const base = document.querySelector('base')?.getAttribute('href') ?? '/';
    try {
      return new URL(relative, new URL(base, location.origin)).href;
    } catch {
      return relative;
    }
  }
}

