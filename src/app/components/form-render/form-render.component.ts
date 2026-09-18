import { Component, Input, OnInit, inject, effect, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormService } from '../../services/form.service';
import { UtmService } from '../../services/utm.service';
import { AuthService } from '../../services/auth.service';
import { Form, FormField, User } from '../../models/admin.model';

/** Сопоставление имени поля формы с полем профиля пользователя. */
const PROFILE_KEYS: Record<string, keyof User> = {
  name: 'full_name',
  full_name: 'full_name',
  fio: 'full_name',
  'фио': 'full_name',
  first_name: 'first_name',
  'имя': 'first_name',
  last_name: 'last_name',
  'фамилия': 'last_name',
  middle_name: 'middle_name',
  'отчество': 'middle_name',
  email: 'email',
  mail: 'email',
  'почта': 'email',
  phone: 'phone',
  tel: 'phone',
  telephone: 'phone',
  'телефон': 'phone',
  city: 'city',
  'город': 'city',
  country: 'country',
  'страна': 'country',
  region: 'region',
  'регион': 'region',
  address: 'address',
  'адрес': 'address',
  telegram: 'telegram',
  'телеграм': 'telegram',
  whatsapp: 'whatsapp',
  'ватсап': 'whatsapp',
  site: 'site',
  'сайт': 'site',
  max: 'max_link',
  'макс': 'max_link',
};

function profileKey(name: string): keyof User | null {
  const key = name.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return PROFILE_KEYS[key] ?? null;
}

@Component({
  selector: 'app-form-render',
  imports: [ReactiveFormsModule],
  templateUrl: './form-render.html',
  styleUrl: './form-render.scss',
})
export class FormRenderComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly formService = inject(FormService);
  private readonly utmService = inject(UtmService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() formId!: number;

  form: Form | null = null;
  formGroup!: FormGroup;
  loading = true;
  error = '';
  submitted = false;
  sending = false;
  submitError = '';

  constructor() {
    // Профиль пользователя приходит асинхронно (проверка сессии в шапке) —
    // подставляем данные, как только он загружен.
    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.applyProfile(user);
      }
    });
  }

  ngOnInit(): void {
    this.formService.getPublicForm(this.formId).subscribe({
      next: (res) => {
        if (res.ok && res.form) {
          this.form = res.form;
          this.buildForm(res.form.fields || []);
        } else {
          this.error = res.error || 'Форма не найдена';
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Не удалось загрузить форму';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private buildForm(fields: FormField[]): void {
    const controls: Record<string, unknown> = {};
    for (const field of fields) {
      const validators = [];
      if (field.required) {
        validators.push(Validators.required);
      }
      if (field.field_type === 'email') {
        validators.push(Validators.email);
      }
      if (field.field_type === 'url') {
        validators.push(Validators.pattern(/^https?:\/\/.+/));
      }
      if (field.field_type === 'phone') {
        validators.push(Validators.pattern(/^[+0-9()\-\s]{6,20}$/));
      }
      controls[field.name] = ['', validators];
    }
    this.formGroup = this.fb.group(controls);
    this.applyProfile(this.auth.user());
  }

  /** Подставляет данные профиля авторизованного пользователя в пустые поля. */
  private applyProfile(user: User | null): void {
    if (!user || !this.formGroup || !this.form) {
      return;
    }
    let filled = false;
    for (const field of this.form.fields ?? []) {
      const key = profileKey(field.name);
      if (!key) {
        continue;
      }
      const value = user[key];
      if (value === null || value === undefined || value === '') {
        continue;
      }
      const control = this.formGroup.get(field.name);
      if (!control || control.value) {
        continue;
      }
      control.setValue(String(value));
      filled = true;
    }
    if (filled) {
      this.cdr.markForCheck();
    }
  }

  onSubmit(): void {
    if (!this.form || this.sending) {
      return;
    }
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }
    this.sending = true;
    this.submitError = '';

    const data: Record<string, string> = {};
    for (const field of this.form.fields || []) {
      const value = this.formGroup.value[field.name];
      if (value !== null && value !== undefined && value !== '') {
        data[field.name] = String(value).trim();
      }
    }

    const page = typeof window !== 'undefined' ? window.location.pathname : '';
    const utm = this.utmService.getUtm();
    this.formService.submit(this.form.id, data, page, utm).subscribe({
      next: (res) => {
        this.sending = false;
        if (res.ok) {
          this.submitted = true;
        } else {
          this.submitError = res.error || 'Не удалось отправить';
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.sending = false;
        this.submitError = 'Не удалось отправить. Попробуйте ещё раз.';
        this.cdr.markForCheck();
      },
    });
  }

  trackField(_index: number, field: FormField): string {
    return field.name;
  }
}
