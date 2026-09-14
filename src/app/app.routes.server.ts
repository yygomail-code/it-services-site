import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'services',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'services/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: () => import('./data/services.data').then((m) =>
      m.SERVICES.map((s) => ({ slug: s.slug })),
    ),
  },
  {
    path: 'portfolio',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'portfolio/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: () => import('./data/portfolio.data').then((m) =>
      m.CASES.map((c) => ({ slug: c.slug })),
    ),
  },
  {
    path: 'about',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'partners',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'contacts',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'policy',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'terms',
    renderMode: RenderMode.Prerender,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
