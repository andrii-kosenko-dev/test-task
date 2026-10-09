import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { FixtureProductsApi } from './core/api/fixture-products-api';
import { ProductsApi } from './core/api/products-api';
import { routes } from './app.routes';
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
    provideEffects(ProductsEffects, QueriesEffects),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() }),
    // Swap for the real HTTP implementation once the backend exists.
    { provide: ProductsApi, useClass: FixtureProductsApi },
  ],
};
