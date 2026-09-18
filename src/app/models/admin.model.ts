/** Роль пользователя (управляемый список в разделе «Роли»). */
export interface Role {
  id: number;
  code: string;
  title: string;
  sort_order: number;
  /** Системная роль (гость): не назначается пользователям и не удаляется. */
  is_system: boolean | number;
}

export interface User {
  id: number;
  login: string;
  email?: string | null;
  role: string;
  full_name?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  birth_date?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  max_link?: string | null;
  telegram?: string | null;
  whatsapp?: string | null;
  site?: string | null;
  avatar_media_id?: number | null;
  avatar_url?: string | null;
  admin_comment?: string | null;
  active: boolean | number;
  is_system?: boolean | number;
  created_at?: string;
  last_login_at?: string | null;
}

export interface Lead {
  id: number;
  lead_id: string;
  lead_type: 'client' | 'partner';
  partner_role?: string | null;
  deal_type?: 'referral' | 'outsource' | null;
  name: string;
  phone: string;
  telegram?: string | null;
  service?: string | null;
  message?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  page?: string | null;
  status: string;
  created_at: string;
}

export interface LeadsResponse {
  leads: Lead[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ContentMap {
  [key: string]: string | null;
}

export type TextAlign = 'left' | 'center' | 'right';

export type PageBlock =
  | { type: 'text'; text: string; align?: TextAlign; fontSize?: string; fontFamily?: string }
  | { type: 'heading'; text: string; level: 'h1' | 'h2' | 'h3' | 'h4'; align?: TextAlign; fontSize?: string; fontFamily?: string }
  | { type: 'image'; url: string; alt?: string; caption?: string; align?: TextAlign; width?: string }
  | { type: 'gallery'; images: string[]; columns?: number }
  | { type: 'form'; formId: number; width?: string }
  | { type: 'button'; text: string; url: string; style: 'primary' | 'outline' | 'ghost'; align?: TextAlign; target?: '_self' | '_blank' }
  | { type: 'divider' }
  | { type: 'quote'; text: string; author?: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'html'; html: string }
  /** Каталог услуг сайта (карточки из данных). */
  | { type: 'services' }
  /** Каталог кейсов: limit — сколько показать (0 — все), filters — фильтр по категориям. */
  | { type: 'cases'; limit?: number; filters?: boolean };

export type PageSectionGap = 'none' | 'small' | 'normal' | 'large';
export type PageSectionBg = 'default' | 'light' | 'dark' | 'accent' | 'hero';

export interface PageColumn {
  id: string;
  blocks: PageBlock[];
}

export interface PageSection {
  id: string;
  columns: 1 | 2 | 3 | 4;
  gap: PageSectionGap;
  background: PageSectionBg;
  align: 'top' | 'middle' | 'bottom';
  cols: PageColumn[];
  /** Веса колонок для соотношения ширин (1–100, по числу колонок). Не задано — равные. */
  widths?: number[];
}

export type PageContent = PageSection[];

export type FormFieldType = 'text' | 'email' | 'phone' | 'url' | 'textarea' | 'select';

export interface FormField {
  id?: number;
  field_type: FormFieldType;
  label: string;
  name: string;
  placeholder?: string | null;
  options?: string[];
  required: boolean | number;
  sort_order?: number;
}

export interface Form {
  id: number;
  form_number: number;
  title: string;
  description?: string | null;
  submit_label: string;
  success_message: string;
  create_lead?: boolean | number;
  fields?: FormField[];
  fields_count?: number;
  submissions_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface FormSubmission {
  id: number;
  form_id: number;
  data: Record<string, string>;
  page?: string | null;
  created_at: string;
}

/** Назначение почтового сервиса. */
/** Письмо в очереди отправки (раздел «Почта»). */
export interface EmailQueueItem {
  id: number;
  to_email: string;
  subject: string;
  purpose: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  max_attempts: number;
  last_error?: string | null;
  next_attempt_at?: string | null;
  sent_at?: string | null;
  created_at?: string;
}
export type MailPurpose = 'leads' | 'registration' | 'actions' | 'purchases' | 'other';

/** Сервис отправки почты (раздел «Почта»). */
export interface MailService {
  id: number;
  name: string;
  provider: string;
  host: string;
  port: number;
  encryption: 'ssl' | 'tls' | 'none';
  username: string;
  from_email: string;
  from_name?: string | null;
  purpose: MailPurpose;
  active: number;
  /** Пароль не отдаётся API — только признак, что он задан. */
  has_password?: boolean;
  last_check_at?: string | null;
  last_check_ok?: number | null;
  last_check_error?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Пресет почтового сервиса (Яндекс, Mail.ru, Google, свой). */
export interface MailPreset {
  label: string;
  host: string;
  port: number;
  encryption: 'ssl' | 'tls' | 'none';
  hint: string;
}

export interface Page {
  id: number;
  slug: string;
  title: string;
  meta_title?: string | null;
  meta_description?: string | null;
  content?: PageSection[] | PageBlock[] | null;
  status: 'published' | 'draft';
  /** Доступ по ролям: null/не задано — всем, [] — никому, список — этим ролям. */
  roles?: string[] | null;
  /** Публичный ответ: страница есть, но доступ закрыт (контент не отдан). */
  restricted?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Группа услуг (категория). */
export interface ServiceCategory {
  id: number;
  parent_id?: number | null;
  /** Тип группы: null — для всех, 'service' — только услуги, 'product' — только товары. */
  kind?: 'service' | 'product' | null;
  title: string;
  slug: string;
  sort_order: number;
  active: boolean | number;
  services_count?: number;
}

/** Медиа в галерее услуги. */
export interface ServiceMediaItem {
  id?: number;
  media_id?: number | null;
  url: string;
  is_cover?: boolean | number;
}

/** Поле шаблона карточки: показывать и в каком порядке. */
export interface CardTemplateField {
  key: string;
  on: boolean | number;
}

/** Шаблон карточки услуги/товара (вариант вёрстки). */
export interface CardTemplate {
  id: number;
  name: string;
  kind: 'service' | 'product';
  fields: CardTemplateField[];
  is_default?: boolean | number;
}

export type ServiceKind = 'service' | 'product';
export type ServicePaymentMethod = 'cash' | 'card' | 'transfer' | 'sbp';

/** Услуга или товар. */
export interface Service {
  id: number;
  slug: string;
  kind: ServiceKind;
  title: string;
  short_description?: string;
  full_description?: string;
  price?: number | null;
  price_prefix?: 'none' | 'from';
  price_note?: string | null;
  icon?: string | null;
  unit?: 'piece' | 'time';
  duration_min?: number;
  buffer_before_min?: number;
  buffer_after_min?: number;
  category_id?: number | null;
  category_title?: string | null;
  category_slug?: string | null;
  template_id?: number | null;
  address?: string | null;
  map_lat?: number | null;
  map_lng?: number | null;
  booking_enabled?: boolean;
  shop_enabled?: boolean;
  comments_enabled?: boolean;
  rating_enabled?: boolean;
  auto_confirm?: boolean;
  prepay?: boolean;
  postpay?: boolean;
  payment_methods?: string[];
  roles?: string[] | null;
  active?: boolean;
  sort_order?: number;
  rating_avg?: number;
  rating_count?: number;
  comments_count?: number;
  cover?: string | null;
  media?: ServiceMediaItem[];
  template?: CardTemplate | null;
  meta_title?: string | null;
  meta_description?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Настройки раздела «Услуги» на сайте. */
export interface ServiceSection {
  enabled: boolean;
  roles: string[] | null;
}

/** Имена разделов модуля: «Услуги» и «Товары». */
export type ServiceSectionName = 'services' | 'products';

/** Настройки обоих разделов модуля. */
export interface ServiceSections {
  services: ServiceSection;
  products: ServiceSection;
}

/** Цель ссылки для меню/футера: раздел, группа или позиция каталога. */
export interface LinkTarget {
  /** Группа списка: «Разделы», «Группы услуг», «Услуги», «Товары»… */
  group: string;
  label: string;
  url: string;
}

export interface MediaItem {
  id: number;
  file_name: string;
  title?: string | null;
  description?: string | null;
  url: string;
  mime: string;
  size: number;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
  uploaded_by?: number | null;
  uploaded_by_login?: string | null;
  uploaded_by_name?: string | null;
  used_as_avatar?: string | null;
  created_at?: string;
}

export interface FooterLink {
  label: string;
  url: string;
  /** Крупнее: увеличенный размер шрифта. */
  large?: boolean | number;
  /** Дополнительный отступ сверху. */
  gap?: boolean | number;
  /**
   * Роли, которым видна ссылка (коды из раздела «Роли»).
   * null/не задано — видна всем (старые записи), [] — скрыта для всех.
   */
  roles?: string[] | null;
}

/** Пункт меню в шапке сайта. */
export interface HeaderMenuItem {
  label: string;
  url: string;
  /** Роли, которым виден пункт (как у ссылок футера). */
  roles?: string[] | null;
}

/** Кнопка в шапке сайта. */
export interface HeaderCta {
  label: string;
  url: string;
  /** Роли, которым видна кнопка. */
  roles?: string[] | null;
}

/** Настройки шапки сайта (ключ header.config). */
export interface HeaderConfig {
  /** Подпись рядом с названием (логотип и название — в разделе «Бренд»). */
  subtitle: string;
  /** Крупнее: увеличенный размер подписи. */
  subtitle_large?: boolean | number;
  /** Пункты меню. */
  menu: HeaderMenuItem[];
  /** Кнопка справа; null — не задана. */
  cta: HeaderCta | null;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

/** Поля контактной информации из раздела «Контакты». */
export type FooterContactField =
  | 'phone'
  | 'email'
  | 'city'
  | 'address'
  | 'max'
  | 'telegram'
  | 'whatsapp'
  | 'viber'
  | 'vk';

/** Контакт, выбранный для показа в футере (значение берётся из раздела «Контакты»). */
export interface FooterContactItem {
  field: FooterContactField;
  show: boolean | number;
  /** Показывать иконку у этого контакта. */
  icon: boolean | number;
  /** Крупнее: увеличенный размер шрифта. */
  large: boolean | number;
  /** Дополнительный отступ сверху. */
  gap: boolean | number;
}

/** Блок контактов: показывается, если есть хотя бы один включённый контакт с заполненным значением. */
export interface FooterContacts {
  items: FooterContactItem[];
}

/** Строка блока «Описание» в футере: подпись, примечание. */
export type FooterAboutRowKey = 'subtitle' | 'note';

export interface FooterAboutRow {
  /** Крупнее: увеличенный размер шрифта. */
  large: boolean | number;
  /** Дополнительный отступ сверху. */
  gap: boolean | number;
}

/** Описание в футере: подпись и примечание (у каждой секции свои). */
export interface FooterAbout {
  subtitle: string;
  note: string;
  /** Настройки строк: крупнее/отступ сверху. */
  rows?: Partial<Record<FooterAboutRowKey, FooterAboutRow>>;
}

/** Единый бренд сайта: логотип, название, метка (используется в футере, шапке, админке). */
export interface Brand {
  name: string;
  mark: string;
  logo: string;
}

/** Нижняя строка сайта (копирайт). */
export interface FooterCopyright {
  text: string;
  /** Крупнее: увеличенный размер шрифта. */
  large?: boolean | number;
}

export interface FooterConfig {
  about: FooterAbout;
  columns: FooterColumn[];
  contacts: FooterContacts;
  /** null — копирайт ещё не настраивали (на сайте показывается встроенный текст). */
  copyright: FooterCopyright | null;
  bottom_links: FooterLink[];
}
