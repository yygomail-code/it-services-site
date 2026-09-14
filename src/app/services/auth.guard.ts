import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

/** Требует авторизации любого пользователя (клиент/менеджер/админ). */
export const authRequiredGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.user()) {
    return true;
  }

  return auth.fetchMe().pipe(
    map((res) => (res.user ? true : router.createUrlTree(['/login']))),
  );
};
