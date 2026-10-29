import { Routes } from '@angular/router';
import { Board } from './pages/board/board';
import { History } from './pages/history/history';
import { Download } from './pages/download/download';

export const routes: Routes = [
  { path: '', component: Board },
  { path: 'historico', component: History },
  { path: 'download', component: Download },
  { path: '**', redirectTo: '' },
];
