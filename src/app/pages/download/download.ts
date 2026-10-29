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
   * URL do instalador resolvida a partir do <base href> do documento,
   * garantindo o caminho correto tanto local quanto no GitHub Pages
   * (/bingo/downloads/...). O arquivo é publicado pelo workflow de deploy.
   */
  readonly installerUrl = this.resolveFromBase('downloads/Bingo-Setup.exe');

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

