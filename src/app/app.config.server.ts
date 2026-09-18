import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { API_BASE } from './services/api.config';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      // Адрес API на время сборки: контент из БД попадает в prerender-HTML.
      // Переопределяется переменной окружения PRERENDER_API_BASE.
      provide: API_BASE,
      useValue: process.env['PRERENDER_API_BASE'] ?? 'http://127.0.0.1:8090',
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
