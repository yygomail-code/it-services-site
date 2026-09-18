import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { setPreloadedContent } from './app/services/content.service';

/**
 * Контент из БД загружаем ДО старта приложения: первый рендер на клиенте
 * совпадает с prerender-HTML, поэтому гидратация проходит без расхождений
 * (меню, ссылки футера, контакты и бренд берутся из БД сразу).
 */
async function bootstrap(): Promise<void> {
  try {
    const res = await fetch('/api/content.php', { credentials: 'include' });
    const data = res.ok ? await res.json() : null;
    setPreloadedContent((data?.content as Record<string, string | null> | undefined) ?? {});
  } catch {
    // Не критично — сайт работает со встроенным контентом
    setPreloadedContent({});
  }

  await bootstrapApplication(App, appConfig);
}

bootstrap().catch((err) => console.error(err));
