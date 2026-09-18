import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { Role } from '../../models/admin.model';
import { translit } from '../../utils/translit.util';

/** Управление ролями: список, создание, переименование, порядок, удаление. */
@Component({
  selector: 'app-admin-roles',
  templateUrl: './admin-roles.html',
  styleUrl: './admin-roles.scss',
})
export class AdminRolesComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  error = '';
  saveError = '';
  saving = false;

  roles: Role[] = [];

  /** Форма: 0 — новая роль, >0 — редактирование. */
  editingId = 0;
  formOpen = false;
  formTitle = '';
  formCode = '';
  formSort = 0;
  /** Код правили вручную — автоподстановку не трогаем. */
  private codeTouched = false;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.admin.getRoles().subscribe({
      next: (res) => {
        this.roles = res.roles ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Не удалось загрузить роли';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  isSystem(role: Role): boolean {
    return role.is_system === 1 || role.is_system === true;
  }

  /** Системной роли нельзя менять код. */
  get codeLocked(): boolean {
    const role = this.roles.find((r) => r.id === this.editingId);
    return !!role && this.isSystem(role);
  }

  startCreate(): void {
    this.editingId = 0;
    this.formTitle = '';
    this.formCode = '';
    this.codeTouched = false;
    const orders = this.roles.map((r) => Number(r.sort_order));
    this.formSort = orders.length ? Math.max(...orders) + 10 : 10;
    this.formOpen = true;
    this.saveError = '';
    this.cdr.markForCheck();
  }

  startEdit(role: Role): void {
    this.editingId = role.id;
    this.formTitle = role.title;
    this.formCode = role.code;
    this.codeTouched = true;
    this.formSort = Number(role.sort_order);
    this.formOpen = true;
    this.saveError = '';
    this.cdr.markForCheck();
  }

  cancelForm(): void {
    this.formOpen = false;
    this.saveError = '';
    this.cdr.markForCheck();
  }

  onFormTitle(v: string): void {
    this.formTitle = v;
    if (this.editingId === 0 && !this.codeTouched) {
      this.formCode = translit(v);
    }
    this.cdr.markForCheck();
  }

  onFormCode(v: string): void {
    this.formCode = v.toLowerCase();
    this.codeTouched = true;
    this.cdr.markForCheck();
  }

  onFormSort(v: string): void {
    this.formSort = Number(v) || 0;
    this.cdr.markForCheck();
  }

  save(): void {
    if (this.saving) {
      return;
    }
    const title = this.formTitle.trim();
    const code = this.formCode.trim().toLowerCase();
    if (!title) {
      this.saveError = 'Укажите название роли';
      this.cdr.markForCheck();
      return;
    }
    if (!/^[a-z][a-z0-9_\-]{1,63}$/.test(code)) {
      this.saveError = 'Код: латиница, цифры, дефис и подчёркивание, начинается с буквы';
      this.cdr.markForCheck();
      return;
    }

    this.saving = true;
    this.saveError = '';
    this.admin
      .saveRole({ id: this.editingId || undefined, code, title, sort_order: this.formSort })
      .subscribe({
        next: (res) => {
          this.saving = false;
          if (res.ok) {
            this.formOpen = false;
            this.load();
          } else {
            this.saveError = res.error ?? 'Не удалось сохранить роль';
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err?.error?.error ?? 'Не удалось сохранить роль';
          this.cdr.markForCheck();
        },
      });
  }

  remove(role: Role): void {
    if (
      !confirm(
        `Удалить роль «${role.title}»?\n\nОна будет убрана из настроек страниц, ссылок футера и меню шапки.`,
      )
    ) {
      return;
    }
    this.admin.deleteRole(role.id).subscribe({
      next: () => {
        this.load();
      },
      error: (err) => {
        this.error = err?.error?.error ?? 'Не удалось удалить роль';
        this.cdr.markForCheck();
      },
    });
  }
}
