import { Routes } from '@angular/router';

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
    path: '**',
    redirectTo: '',
  },
];
