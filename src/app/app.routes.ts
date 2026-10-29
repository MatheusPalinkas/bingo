import { Routes } from '@angular/router';
import { Board } from './pages/board/board';
import { History } from './pages/history/history';

export const routes: Routes = [
  { path: '', component: Board },
  { path: 'historico', component: History },
  { path: '**', redirectTo: '' },
];
