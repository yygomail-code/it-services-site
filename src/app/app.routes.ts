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
    loadComponent: () =>
      import('./pages/services-catalog/services-catalog.component').then((m) => m.ServicesCatalogComponent),
  },
  {
    path: 'services/:slug',
    loadComponent: () => import('./pages/service-page/service-page.component').then((m) => m.ServicePageComponent),
  },
  {
    path: 'products',
    data: { kind: 'product' },
    loadComponent: () =>
      import('./pages/services-catalog/services-catalog.component').then((m) => m.ServicesCatalogComponent),
  },
  {
    path: 'products/:slug',
    data: { kind: 'product' },
    loadComponent: () => import('./pages/service-page/service-page.component').then((m) => m.ServicePageComponent),
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
    data: { slug: 'about', canonical: '/about' },
    loadComponent: () => import('./pages/page-dynamic/page-dynamic.component').then((m) => m.PageDynamicComponent),
  },
  {
    path: 'partners',
    data: { slug: 'partners', canonical: '/partners' },
    loadComponent: () => import('./pages/page-dynamic/page-dynamic.component').then((m) => m.PageDynamicComponent),
  },
  {
    path: 'contacts',
    data: { slug: 'contacts', canonical: '/contacts' },
    loadComponent: () => import('./pages/page-dynamic/page-dynamic.component').then((m) => m.PageDynamicComponent),
  },
  {
    path: 'policy',
    data: { slug: 'policy', canonical: '/policy' },
    loadComponent: () => import('./pages/page-dynamic/page-dynamic.component').then((m) => m.PageDynamicComponent),
  },
  {
    path: 'terms',
    data: { slug: 'terms', canonical: '/terms' },
    loadComponent: () => import('./pages/page-dynamic/page-dynamic.component').then((m) => m.PageDynamicComponent),
  },
  {
    path: 'cookie-policy',
    data: { slug: 'cookie-policy', canonical: '/cookie-policy' },
    loadComponent: () => import('./pages/page-dynamic/page-dynamic.component').then((m) => m.PageDynamicComponent),
  },
  {
    path: 'pages/:slug',
    loadComponent: () => import('./pages/page-dynamic/page-dynamic.component').then((m) => m.PageDynamicComponent),
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
        path: 'services',
        loadComponent: () =>
          import('./admin/admin-services/admin-services.component').then((m) => m.AdminServicesComponent),
      },
      {
        path: 'services/:id',
        loadComponent: () =>
          import('./admin/admin-service-edit/admin-service-edit.component').then((m) => m.AdminServiceEditComponent),
      },
      {
        path: 'service-categories',
        loadComponent: () =>
          import('./admin/admin-service-categories/admin-service-categories.component').then(
            (m) => m.AdminServiceCategoriesComponent,
          ),
      },
      {
        path: 'service-templates',
        loadComponent: () =>
          import('./admin/admin-service-templates/admin-service-templates.component').then(
            (m) => m.AdminServiceTemplatesComponent,
          ),
      },
      {
        path: 'pages',
        canActivate: [adminOnlyGuard],
        loadComponent: () => import('./admin/admin-pages/admin-pages.component').then((m) => m.AdminPagesComponent),
      },
      {
        path: 'pages/:id',
        canActivate: [adminOnlyGuard],
        loadComponent: () => import('./admin/admin-page-edit/admin-page-edit.component').then((m) => m.AdminPageEditComponent),
      },
      {
        path: 'media',
        canActivate: [adminOnlyGuard],
        loadComponent: () => import('./admin/admin-media/admin-media.component').then((m) => m.AdminMediaComponent),
      },
      {
        path: 'forms',
        canActivate: [adminOnlyGuard],
        loadComponent: () => import('./admin/admin-forms/admin-forms.component').then((m) => m.AdminFormsComponent),
      },
      {
        path: 'forms/:id',
        canActivate: [adminOnlyGuard],
        loadComponent: () => import('./admin/admin-form-edit/admin-form-edit.component').then((m) => m.AdminFormEditComponent),
      },
      {
        path: 'header',
        canActivate: [adminOnlyGuard],
        loadComponent: () => import('./admin/admin-header/admin-header.component').then((m) => m.AdminHeaderComponent),
      },
      {
        path: 'footer',
        canActivate: [adminOnlyGuard],
        loadComponent: () => import('./admin/admin-footer/admin-footer.component').then((m) => m.AdminFooterComponent),
      },
      {
        path: 'brand',
        canActivate: [adminOnlyGuard],
        loadComponent: () => import('./admin/admin-brand/admin-brand.component').then((m) => m.AdminBrandComponent),
      },
      {
        path: 'footer-bottom',
        canActivate: [adminOnlyGuard],
        loadComponent: () => import('./admin/admin-footer-bottom/admin-footer-bottom.component').then((m) => m.AdminFooterBottomComponent),
      },
      {
        path: 'users',
        canActivate: [adminOnlyGuard],
        loadComponent: () => import('./admin/admin-users/admin-users.component').then((m) => m.AdminUsersComponent),
      },
      {
        path: 'roles',
        canActivate: [adminOnlyGuard],
        loadComponent: () => import('./admin/admin-roles/admin-roles.component').then((m) => m.AdminRolesComponent),
      },
      {
        path: 'mail',
        canActivate: [adminOnlyGuard],
        loadComponent: () => import('./admin/admin-mail/admin-mail.component').then((m) => m.AdminMailComponent),
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
    loadComponent: () => import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
