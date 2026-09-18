import { HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { ApplicationRef, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

/**
 * Приложение работает без Zone.js (zoneless). В этом режиме изменения обычных
 * свойств компонентов после HTTP-ответа не запускают change detection
 * автоматически. Этот интерцептор отложенно (после микрозадач) запускает цикл
 * обновления после каждого ответа/ошибки API, не блокируя поток ответа.
 */
export function appTickInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
  const appRef = inject(ApplicationRef);
  const schedule = () => setTimeout(() => appRef.tick(), 0);
  return next(req).pipe(
    tap({
      next: () => schedule(),
      error: () => schedule(),
    }),
  );
}
