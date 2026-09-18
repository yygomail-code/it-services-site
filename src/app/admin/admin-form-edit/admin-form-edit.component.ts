import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { Form, FormField, FormFieldType, FormSubmission } from '../../models/admin.model';

interface FieldDraft {
  field_type: FormFieldType;
  label: string;
  name: string;
  placeholder: string;
  optionsText: string;
  required: boolean;
}

@Component({
  selector: 'app-admin-form-edit',
  imports: [RouterLink, FormsModule],
  templateUrl: './admin-form-edit.html',
  styleUrl: './admin-form-edit.scss',
})
export class AdminFormEditComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  formId: number | null = null;
  loading = true;
  saving = false;
  error = '';
  saved = false;

  title = '';
  description = '';
  submitLabel = 'Отправить';
  successMessage = 'Спасибо! Заявка отправлена.';
  createLead = false;

  fields: FieldDraft[] = [];

  // Отправки
  submissions: FormSubmission[] = [];
  showSubmissions = false;
  submissionsLoading = false;

  readonly fieldTypes: { value: FormFieldType; label: string }[] = [
    { value: 'text', label: 'Текст' },
    { value: 'email', label: 'E-mail' },
    { value: 'phone', label: 'Телефон' },
    { value: 'url', label: 'Ссылка (URL)' },
    { value: 'textarea', label: 'Текст (многострочный)' },
    { value: 'select', label: 'Выпадающий список' },
  ];

  typeLabel(type: FormFieldType): string {
    return this.fieldTypes.find((t) => t.value === type)?.label ?? type;
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam === 'new' || !idParam) {
      this.loading = false;
      return;
    }
    this.formId = Number(idParam);
    this.admin.getForm(this.formId).subscribe({
      next: (res) => {
        const f = res.form;
        this.title = f.title;
        this.description = f.description ?? '';
        this.submitLabel = f.submit_label;
        this.successMessage = f.success_message;
        this.createLead = !!f.create_lead;
        this.fields = (f.fields || []).map((field) => ({
          field_type: field.field_type,
          label: field.label,
          name: field.name,
          placeholder: field.placeholder ?? '',
          optionsText: (field.options || []).join('\n'),
          required: !!field.required,
        }));
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

  addField(): void {
    const index = this.fields.length + 1;
    this.fields.push({
      field_type: 'text',
      label: '',
      name: `field_${index}`,
      placeholder: '',
      optionsText: '',
      required: false,
    });
    this.cdr.markForCheck();
  }

  removeField(index: number): void {
    this.fields.splice(index, 1);
    this.cdr.markForCheck();
  }

  moveField(index: number, dir: -1 | 1): void {
    const target = index + dir;
    if (target < 0 || target >= this.fields.length) {
      return;
    }
    const tmp = this.fields[index];
    this.fields[index] = this.fields[target];
    this.fields[target] = tmp;
    this.cdr.markForCheck();
  }

  onFieldChange(index: number, field: FieldDraft, key: keyof FieldDraft, value: string | boolean): void {
    switch (key) {
      case 'field_type':
        field.field_type = value as FormFieldType;
        break;
      case 'label':
        field.label = String(value);
        // Авто-имя из названия, если пользователь ещё не задал своё
        if (field.name.startsWith('field_')) {
          const slug = String(value).toLowerCase().replace(/[^a-z0-9а-яё\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 32);
          if (slug) {
            field.name = slug;
          }
        }
        break;
      case 'name':
        field.name = String(value);
        break;
      case 'placeholder':
        field.placeholder = String(value);
        break;
      case 'optionsText':
        field.optionsText = String(value);
        break;
      case 'required':
        field.required = Boolean(value);
        break;
    }
    this.cdr.markForCheck();
  }

  trackField(_index: number): number {
    return _index;
  }

  save(): void {
    if (this.saving) {
      return;
    }
    if (!this.title.trim()) {
      this.error = 'Укажите название формы';
      return;
    }
    const validFields = this.fields.filter((f) => f.label.trim() && f.name.trim());
    if (validFields.length === 0) {
      this.error = 'Добавьте хотя бы одно поле с названием';
      return;
    }
    const payload = {
      title: this.title.trim(),
      description: this.description.trim() || null,
      submit_label: this.submitLabel.trim() || 'Отправить',
      success_message: this.successMessage.trim() || 'Спасибо! Заявка отправлена.',
      create_lead: this.createLead ? 1 : 0,
      fields: validFields.map((f) => ({
        field_type: f.field_type,
        label: f.label.trim(),
        name: f.name.trim(),
        placeholder: f.placeholder.trim() || null,
        options: f.optionsText.split('\n').map((s) => s.trim()).filter(Boolean),
        required: f.required ? 1 : 0,
      })),
    };

    this.saving = true;
    this.error = '';
    this.saved = false;

    const request = this.formId
      ? this.admin.updateForm(this.formId, payload)
      : this.admin.createForm(payload);

    request.subscribe({
      next: (res) => {
        this.saving = false;
        if (res.ok) {
          this.saved = true;
          setTimeout(() => {
            this.saved = false;
            this.cdr.markForCheck();
          }, 2500);
          if (!this.formId && res['id']) {
            this.formId = Number(res['id']);
            this.router.navigate(['/admin/forms', this.formId], { replaceUrl: true });
          }
        } else {
          this.error = res.error ?? 'Не удалось сохранить';
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.error = 'Не удалось сохранить форму';
        this.cdr.markForCheck();
      },
    });
  }

  /** Переключить показ отправок: открыть список или вернуться к форме. */
  toggleSubmissions(): void {
    if (this.showSubmissions) {
      this.showSubmissions = false;
      this.cdr.markForCheck();
      return;
    }
    this.loadSubmissions();
  }

  loadSubmissions(): void {
    if (!this.formId) {
      return;
    }
    this.showSubmissions = true;
    this.submissionsLoading = true;
    this.admin.getFormSubmissions(this.formId).subscribe({
      next: (res) => {
        this.submissions = res.submissions;
        this.submissionsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.submissionsLoading = false;
        this.error = 'Не удалось загрузить отправки';
        this.cdr.markForCheck();
      },
    });
  }

  formatDate(d: string): string {
    return d ? d.replace('T', ' ').slice(0, 19) : '';
  }

  submissionKeys(s: FormSubmission): string[] {
    return Object.keys(s.data || {});
  }
}
