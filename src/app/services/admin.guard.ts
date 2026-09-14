import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

export const adminAuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.user()) {
    return auth.isManager() ? true : router.createUrlTree(['/admin/login']);
  }

  return auth.fetchMe().pipe(
    map((res) => {
      if (res.user && auth.isManager()) {
        return true;
      }
      return router.createUrlTree(['/admin/login']);
    }),
  );
};

export const adminOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.user()) {
    return auth.isAdmin() ? true : router.createUrlTree(['/admin/leads']);
  }

  return auth.fetchMe().pipe(
    map((res) => {
      if (res.user && auth.isAdmin()) {
        return true;
      }
      return router.createUrlTree(['/admin/leads']);
    }),
  );
};
