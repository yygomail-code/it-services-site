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
    getPrerenderParams: async () => {
      const base = process.env['PRERENDER_API_BASE'] ?? 'http://127.0.0.1:8090';
      try {
        const res = await fetch(`${base}/api/services.php?action=catalog&kind=service&per_page=50`);
        const json = (await res.json()) as { ok?: boolean; items?: Array<{ slug?: string }> };
        return (json.items ?? [])
          .map((item) => item.slug)
          .filter((slug): slug is string => !!slug)
          .map((slug) => ({ slug }));
      } catch {
        return [];
      }
    },
  },
  {
    path: 'products',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'products/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => {
      const base = process.env['PRERENDER_API_BASE'] ?? 'http://127.0.0.1:8090';
      try {
        const res = await fetch(`${base}/api/services.php?action=catalog&kind=product&per_page=50`);
        const json = (await res.json()) as { ok?: boolean; items?: Array<{ slug?: string }> };
        return (json.items ?? [])
          .map((item) => item.slug)
          .filter((slug): slug is string => !!slug)
          .map((slug) => ({ slug }));
      } catch {
        return [];
      }
    },
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
    path: 'cookie-policy',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'pages/:slug',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/login',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'login',
    renderMode: RenderMode.Client,
  },
  {
    path: 'profile',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
