import { Routes } from '@angular/router';
import { adminAuthGuard, adminOnlyGuard } from './services/admin.guard';
import { authRequiredGuard } from './services/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'services',
    loadComponent: () => import('./pages/services/services.component').then((m) => m.ServicesComponent),
  },
  {
    path: 'services/:slug',
    loadComponent: () => import('./pages/service-detail/service-detail.component').then((m) => m.ServiceDetailComponent),
  },
  {
    path: 'portfolio',
    loadComponent: () => import('./pages/portfolio/portfolio.component').then((m) => m.PortfolioComponent),
  },
  {
    path: 'portfolio/:slug',
    loadComponent: () => import('./pages/portfolio-detail/portfolio-detail.component').then((m) => m.PortfolioDetailComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component').then((m) => m.AboutComponent),
  },
  {
    path: 'partners',
    loadComponent: () => import('./pages/partners/partners.component').then((m) => m.PartnersComponent),
  },
  {
    path: 'contacts',
    loadComponent: () => import('./pages/contacts/contacts.component').then((m) => m.ContactsComponent),
  },
  {
    path: 'policy',
    loadComponent: () => import('./pages/policy/policy.component').then((m) => m.PolicyComponent),
  },
  {
    path: 'terms',
    loadComponent: () => import('./pages/terms/terms.component').then((m) => m.TermsComponent),
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./admin/admin-login/admin-login.component').then((m) => m.AdminLoginComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'profile',
    canActivate: [authRequiredGuard],
    loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'admin',
    canActivate: [adminAuthGuard],
    loadComponent: () => import('./admin/admin-layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: 'leads',
        loadComponent: () => import('./admin/admin-leads/admin-leads.component').then((m) => m.AdminLeadsComponent),
      },
      {
        path: 'content',
        canActivate: [adminOnlyGuard],
        loadComponent: () => import('./admin/admin-content/admin-content.component').then((m) => m.AdminContentComponent),
      },
      {
        path: 'users',
        canActivate: [adminOnlyGuard],
        loadComponent: () => import('./admin/admin-users/admin-users.component').then((m) => m.AdminUsersComponent),
      },
      {
        path: 'settings',
        canActivate: [adminOnlyGuard],
        loadComponent: () => import('./admin/admin-settings/admin-settings.component').then((m) => m.AdminSettingsComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'leads' },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
