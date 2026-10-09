import { Routes } from '@angular/router';
import { SearchPage } from './features/search-page/search-page';

export const routes: Routes = [
  { path: '', component: SearchPage, title: 'Product Search' },
  { path: '**', redirectTo: '' },
];
