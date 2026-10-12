import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { HttpProductsApi } from './core/api/http-products-api';
import { ProductsApi } from './core/api/products-api';
import { routes } from './app.routes';
import { DrawingsEffects } from './store/drawings/drawings.effects';
import { drawingsFeature } from './store/drawings/drawings.reducer';
import { DrawingsStorage, LocalStorageDrawings } from './store/drawings/drawings.storage';
import { ProductsEffects } from './store/products/products.effects';
import { productsFeature } from './store/products/products.reducer';
import { QueriesEffects } from './store/queries/queries.effects';
import { queriesFeature } from './store/queries/queries.reducer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideStore(),
    provideState(productsFeature),
    provideState(queriesFeature),
    provideState(drawingsFeature),
    provideEffects(ProductsEffects, QueriesEffects, DrawingsEffects),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() }),
    provideHttpClient(),
    { provide: ProductsApi, useClass: HttpProductsApi },
    { provide: DrawingsStorage, useClass: LocalStorageDrawings },
  ],
};
