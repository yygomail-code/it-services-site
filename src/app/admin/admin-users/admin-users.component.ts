import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { Role, User } from '../../models/admin.model';

/** Пароль без похожих символов (0/O, 1/l/I). */
function generatePassword(length = 12): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#%*';
  const rnd = new Uint32Array(length);
  crypto.getRandomValues(rnd);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[rnd[i] % chars.length];
  }
  return out;
}

interface UserForm {
  login: string;
  password: string;
  role: string;
  active: number;
  last_name: string;
  first_name: string;
  middle_name: string;
  birth_date: string;
  country: string;
  region: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  max_link: string;
  telegram: string;
  whatsapp: string;
  site: string;
  avatar_media_id: number | null;
  admin_comment: string;
}

function emptyForm(): UserForm {
  return {
    login: '',
    password: '',
    role: 'client',
    active: 1,
    last_name: '',
    first_name: '',
    middle_name: '',
    birth_date: '',
    country: '',
    region: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    max_link: '',
    telegram: '',
    whatsapp: '',
    site: '',
    avatar_media_id: null,
    admin_comment: '',
  };
}

@Component({
  selector: 'app-admin-users',
  imports: [FormsModule],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.scss',
})
export class AdminUsersComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly cdr = inject(ChangeDetectorRef);

  users: User[] = [];
  loading = true;
  error = '';

  /** Роли из раздела «Роли». */
  roles: Role[] = [];

  // Форма создания/редактирования
  formOpen = false;
  editingId: number | null = null;
  form: UserForm = emptyForm();
  saving = false;
  saved = false;
  formError = '';
  notified = '';

  // Аватар
  avatarUrl = '';
  uploading = false;
  avatarError = '';

  ngOnInit(): void {
    this.load();
    this.admin.getRoles().subscribe({
      next: (res) => {
        this.roles = res.roles ?? [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.cdr.markForCheck();
      },
    });
  }

  /** Роли для назначения: все, кроме гостя (гость — неавторизованные). */
  get assignableRoles(): Role[] {
    return this.roles.filter((r) => r.code !== 'guest');
  }

  roleTitle(code: string): string {
    return this.roles.find((r) => r.code === code)?.title ?? code;
  }

  isActive(user: User): boolean {
    return Number(user.active) === 1;
  }

  isSystem(user: User): boolean {
    return Number(user.is_system) === 1;
  }

  get editingUser(): User | null {
    return this.users.find((u) => u.id === this.editingId) ?? null;
  }

  /** Системная учётная запись: блокировка, смена роли и удаление недоступны. */
  get formIsSystem(): boolean {
    const user = this.editingUser;
    return !!user && Number(user.is_system) === 1;
  }

  load(): void {
    this.loading = true;
    this.admin.getUsers().subscribe({
      next: (res) => {
        this.users = res.users;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Не удалось загрузить пользователей';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  openCreate(): void {
    this.editingId = null;
    this.form = emptyForm();
    this.avatarUrl = '';
    this.avatarError = '';
    this.formError = '';
    this.notified = '';
    this.saved = false;
    this.formOpen = true;
    this.cdr.markForCheck();
  }

  openEdit(user: User): void {
    this.editingId = user.id;
    this.form = {
      login: user.login,
      password: '',
      role: user.role,
      active: Number(user.active) === 1 ? 1 : 0,
      last_name: user.last_name ?? '',
      first_name: user.first_name ?? '',
      middle_name: user.middle_name ?? '',
      birth_date: user.birth_date ?? '',
      country: user.country ?? '',
      region: user.region ?? '',
      city: user.city ?? '',
      address: user.address ?? '',
      phone: user.phone ?? '',
      email: user.email ?? '',
      max_link: user.max_link ?? '',
      telegram: user.telegram ?? '',
      whatsapp: user.whatsapp ?? '',
      site: user.site ?? '',
      avatar_media_id: user.avatar_media_id ?? null,
      admin_comment: user.admin_comment ?? '',
    };
    this.avatarUrl = user.avatar_url ?? '';
    this.avatarError = '';
    this.formError = '';
    this.notified = '';
    this.saved = false;
    this.formOpen = true;
    this.cdr.markForCheck();
  }

  closeForm(): void {
    this.formOpen = false;
    this.editingId = null;
    this.cdr.markForCheck();
  }

  generatePassword(): void {
    this.form.password = generatePassword();
    this.cdr.markForCheck();
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.uploading = true;
    this.avatarError = '';
    this.admin.uploadMedia(file).subscribe({
      next: (res) => {
        this.uploading = false;
        this.form.avatar_media_id = res.id;
        this.avatarUrl = res.url;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.uploading = false;
        this.avatarError = err.error?.error || 'Не удалось загрузить файл';
        this.cdr.markForCheck();
      },
    });
  }

  removeAvatar(): void {
    this.form.avatar_media_id = null;
    this.avatarUrl = '';
    this.cdr.markForCheck();
  }

  save(): void {
    if (this.saving) {
      return;
    }
    if (!this.form.login.trim()) {
      this.formError = 'Укажите логин';
      this.cdr.markForCheck();
      return;
    }
    if (!this.editingId && this.form.password.length < 6) {
      this.formError = 'Пароль должен быть не менее 6 символов';
      this.cdr.markForCheck();
      return;
    }

    this.saving = true;
    this.formError = '';
    this.notified = '';
    this.saved = false;

    const payload: Record<string, unknown> = {
      login: this.form.login.trim(),
      role: this.form.role,
      active: this.form.active,
      email: this.form.email.trim(),
      last_name: this.form.last_name.trim(),
      first_name: this.form.first_name.trim(),
      middle_name: this.form.middle_name.trim(),
      birth_date: this.form.birth_date,
      country: this.form.country.trim(),
      region: this.form.region.trim(),
      city: this.form.city.trim(),
      address: this.form.address.trim(),
      phone: this.form.phone.trim(),
      max_link: this.form.max_link.trim(),
      telegram: this.form.telegram.trim(),
      whatsapp: this.form.whatsapp.trim(),
      site: this.form.site.trim(),
      avatar_media_id: this.form.avatar_media_id ?? 0,
      admin_comment: this.form.admin_comment.trim(),
    };
    if (this.form.password) {
      payload['password'] = this.form.password;
    }

    const request = this.editingId
      ? this.admin.updateUser(this.editingId, payload as Partial<User>)
      : this.admin.createUser(payload as Partial<User> & { password: string });

    request.subscribe({
      next: (res) => {
        this.saving = false;
        this.saved = true;
        this.form.password = '';
        if (res['notified'] === true && this.form.email.trim()) {
          this.notified = `Уведомление поставлено в отправку на ${this.form.email.trim()}`;
        }
        this.load();
        setTimeout(() => {
          this.saved = false;
          this.cdr.markForCheck();
        }, 3000);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving = false;
        this.formError = err.error?.error || 'Не удалось сохранить пользователя';
        this.cdr.markForCheck();
      },
    });
  }

  deleteUser(user: User): void {
    if (Number(user.is_system) === 1) {
      alert('Системную учётную запись нельзя удалить');
      return;
    }
    if (!confirm(`Удалить пользователя "${user.login}"?`)) {
      return;
    }
    this.admin.deleteUser(user.id).subscribe({
      next: () => {
        this.load();
        this.cdr.markForCheck();
      },
      error: (err) => alert(err.error?.error || 'Не удалось удалить'),
    });
  }
}
