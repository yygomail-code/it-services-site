import { Component, inject, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { PageCanvasComponent } from '../page-canvas/page-canvas.component';
import { AdminRolesPickerComponent } from '../admin-roles-picker/admin-roles-picker.component';
import { Form, PageContent, PageSection, Role } from '../../models/admin.model';
import { normalizePageContent } from '../../utils/page-content.util';

/** Черновик страницы в localStorage (чтобы не потерять правки). */
interface PageDraft {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  status: 'published' | 'draft';
  accessRoles: string[] | null;
  sections: PageContent;
  savedAt: string;
}

@Component({
  selector: 'app-admin-page-edit',
  imports: [RouterLink, PageCanvasComponent, AdminRolesPickerComponent],
  templateUrl: './admin-page-edit.html',
  styleUrl: './admin-page-edit.scss',
})
export class AdminPageEditComponent implements OnInit, OnDestroy {
  private readonly admin = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  pageId: number | null = null;
  loading = true;
  saving = false;
  error = '';
  saved = false;

  slug = '';
  title = '';
  metaTitle = '';
  metaDescription = '';
  status: 'published' | 'draft' = 'draft';
  sections: PageSection[] = [];

  /** Последнее состояние из канваса (для сохранения и черновика). */
  sectionsDraft: PageContent | null = null;
  dirty = false;
  draftAvailable: PageDraft | null = null;

  /** Доступ по ролям: null — всем, [] — никому, список — этим ролям. */
  accessRoles: string[] | null = null;
  /** Роли из раздела «Роли» — для выбора доступа. */
  roles: Role[] = [];
  rolesPickerOpen = false;

  // Доступные формы для вставки
  availableForms: Form[] = [];
  formsLoading = false;

  private draftTimer: number | null = null;

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.loadForms();
    this.admin.getRoles().subscribe({
      next: (res) => {
        this.roles = res.roles ?? [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.roles = [];
        this.cdr.markForCheck();
      },
    });
    if (idParam === 'new' || !idParam) {
      this.loading = false;
      return;
    }
    this.pageId = Number(idParam);
    this.admin.getPage(this.pageId).subscribe({
      next: (res) => {
        const p = res.page;
        this.slug = p.slug;
        this.title = p.title;
        this.metaTitle = p.meta_title ?? '';
        this.metaDescription = p.meta_description ?? '';
        this.status = p.status;
        this.accessRoles = Array.isArray(p.roles) ? [...p.roles] : null;
        this.sections = normalizePageContent(p.content);
        this.loading = false;
        this.loadDraft();
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Не удалось загрузить страницу';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    if (this.draftTimer !== null) {
      window.clearTimeout(this.draftTimer);
    }
    if (this.dirty) {
      this.writeDraft();
    }
  }

  // ---- Черновик ----

  private draftKey(): string {
    return `page-draft-${this.pageId ?? 'new'}`;
  }

  private loadDraft(): void {
    try {
      const raw = localStorage.getItem(this.draftKey());
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as PageDraft;
      if (parsed && typeof parsed.savedAt === 'string' && Array.isArray(parsed.sections)) {
        this.draftAvailable = parsed;
      }
    } catch {
      this.draftAvailable = null;
    }
  }

  draftTimeLabel(): string {
    const savedAt = this.draftAvailable?.savedAt;
    if (!savedAt) {
      return '';
    }
    const date = new Date(savedAt);
    return isNaN(date.getTime()) ? savedAt : date.toLocaleString('ru-RU');
  }

  private scheduleDraft(): void {
    if (this.draftTimer !== null) {
      window.clearTimeout(this.draftTimer);
    }
    this.draftTimer = window.setTimeout(() => {
      this.draftTimer = null;
      if (this.dirty) {
        this.writeDraft();
      }
    }, 1000);
  }

  private writeDraft(): void {
    const draft: PageDraft = {
      slug: this.slug,
      title: this.title,
      metaTitle: this.metaTitle,
      metaDescription: this.metaDescription,
      status: this.status,
      accessRoles: this.accessRoles,
      sections: this.sectionsDraft ?? this.sections,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(this.draftKey(), JSON.stringify(draft));
    } catch {
      // localStorage может быть недоступен — молча пропускаем
    }
  }

  restoreDraft(): void {
    const draft = this.draftAvailable;
    if (!draft) {
      return;
    }
    this.slug = draft.slug;
    this.title = draft.title;
    this.metaTitle = draft.metaTitle;
    this.metaDescription = draft.metaDescription;
    this.status = draft.status;
    this.accessRoles = draft.accessRoles;
    this.sections = normalizePageContent(draft.sections);
    this.sectionsDraft = this.sections;
    this.dirty = true;
    this.draftAvailable = null;
    this.cdr.markForCheck();
  }

  discardDraft(): void {
    try {
      localStorage.removeItem(this.draftKey());
    } catch {
      // игнорируем
    }
    this.draftAvailable = null;
    this.cdr.markForCheck();
  }

  private clearDraft(key: string): void {
    if (this.draftTimer !== null) {
      window.clearTimeout(this.draftTimer);
      this.draftTimer = null;
    }
    try {
      localStorage.removeItem(key);
    } catch {
      // игнорируем
    }
    this.draftAvailable = null;
    this.dirty = false;
  }

  /** Канвас прислал новое состояние страницы. */
  onSectionsChange(sections: PageContent): void {
    this.sectionsDraft = sections;
    this.dirty = true;
    this.scheduleDraft();
    this.cdr.markForCheck();
  }

  loadForms(): void {
    this.formsLoading = true;
    this.admin.getForms().subscribe({
      next: (res) => {
        this.availableForms = res.forms;
        this.formsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.formsLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  // ---- Обработчики полей (без FormsModule) ----
  onTitle(value: string): void {
    this.title = value;
    this.cdr.markForCheck();
  }

  onSlug(value: string): void {
    this.slug = value;
    this.cdr.markForCheck();
  }

  onMetaTitle(value: string): void {
    this.metaTitle = value;
    this.cdr.markForCheck();
  }

  onMetaDescription(value: string): void {
    this.metaDescription = value;
    this.cdr.markForCheck();
  }

  onStatus(value: string): void {
    this.status = value as 'published' | 'draft';
    this.cdr.markForCheck();
  }

  // ---- Доступ по ролям ----
  openRolesPicker(): void {
    this.rolesPickerOpen = true;
    this.cdr.markForCheck();
  }

  applyRoles(codes: string[]): void {
    this.accessRoles = [...codes];
    this.rolesPickerOpen = false;
    this.cdr.markForCheck();
  }

  closeRolesPicker(): void {
    this.rolesPickerOpen = false;
    this.cdr.markForCheck();
  }

  /** Состояние доступа: всем, часть ролей или никому. */
  accessLevel(): 'all' | 'partial' | 'none' {
    const roles = this.accessRoles;
    if (roles === null) {
      return 'all';
    }
    if (roles.length === 0) {
      return 'none';
    }
    if (this.roles.length && roles.length >= this.roles.length) {
      return 'all';
    }
    return 'partial';
  }

  /** Текстовая подпись доступа. */
  accessText(): string {
    const level = this.accessLevel();
    if (level === 'none') {
      return 'Скрыта для всех';
    }
    if (level === 'all') {
      return 'Доступна всем';
    }
    const titles = (this.accessRoles ?? [])
      .map((code) => this.roles.find((r) => r.code === code)?.title ?? code)
      .join(', ');
    return 'Доступна: ' + titles;
  }

  // ---- Сохранение ----
  save(): void {
    if (this.saving) {
      return;
    }
    if (!this.slug.trim() || !this.title.trim()) {
      this.error = 'Укажите адрес страницы (slug) и заголовок';
      return;
    }
    this.saving = true;
    this.saved = false;
    this.error = '';
    const savedKey = this.draftKey();
    const payload = {
      slug: this.slug.trim(),
      title: this.title.trim(),
      meta_title: this.metaTitle.trim() || null,
      meta_description: this.metaDescription.trim() || null,
      status: this.status,
      content: this.sectionsDraft ?? this.sections,
      roles: this.accessRoles ?? null,
    };

    const request = this.pageId
      ? this.admin.updatePage(this.pageId, payload)
      : this.admin.createPage(payload);

    request.subscribe({
      next: (res) => {
        this.saving = false;
        if (res.ok) {
          this.saved = true;
          this.clearDraft(savedKey);
          setTimeout(() => {
            this.saved = false;
            this.cdr.markForCheck();
          }, 2500);
          if (!this.pageId && res['id']) {
            this.pageId = Number(res['id']);
            this.router.navigate(['/admin/pages', this.pageId], { replaceUrl: true });
          }
        } else {
          this.error = res.error ?? 'Не удалось сохранить';
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.error = 'Не удалось сохранить страницу';
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/pages']);
  }
}
