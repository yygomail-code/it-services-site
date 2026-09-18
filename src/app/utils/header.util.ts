import { HeaderCta, HeaderMenuItem } from '../models/admin.model';

/** Подпись у логотипа по умолчанию (до настройки в разделе «Хеадер»). */
export const DEFAULT_HEADER_SUBTITLE = 'разработка и сопровождение сайтов';

/** Меню по умолчанию (до настройки в разделе «Хеадер»). */
export const DEFAULT_HEADER_MENU: HeaderMenuItem[] = [
  { label: 'Главная', url: '/' },
  { label: 'Услуги', url: '/services' },
  { label: 'Портфолио', url: '/portfolio' },
  { label: 'Обо мне', url: '/about' },
  { label: 'Сотрудничество', url: '/partners' },
  { label: 'Контакты', url: '/contacts' },
];

/** Кнопка в шапке по умолчанию (до настройки в разделе «Хеадер»). */
export const DEFAULT_HEADER_CTA: HeaderCta = { label: 'Обсудить проект', url: '/contacts' };
