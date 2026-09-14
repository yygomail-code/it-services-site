import { Component, inject, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LeadService } from '../../services/lead.service';
import { UtmService } from '../../services/utm.service';
import { LeadPayload, LeadType } from '../../models/lead.model';

@Component({
  selector: 'app-lead-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './lead-form.html',
  styleUrl: './lead-form.scss',
})
export class LeadFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly leadService = inject(LeadService);
  private readonly utmService = inject(UtmService);

  @Input() leadType: LeadType = 'client';
  @Input() service?: string;
  @Input() partnerRole?: string;
  @Input() dealType?: string;
  @Input() submitLabel = 'Отправить заявку';
  @Input() compact = false;

  form!: FormGroup;
  submitted = false;
  sending = false;
  error = '';

  readonly servicesList = [
    'Разработка сайтов',
    'Сопровождение и поддержка сайтов',
    'CRM-системы',
    'Базы данных',
    'Корпоративный софт',
    'Интеграция AI/LLM',
    'AI-ассистенты для бизнеса',
    'Интеграции и API',
    'Telegram/WhatsApp-интеграции',
    'Аудит и ускорение сайтов',
    'Автоматизация документооборота / RPA',
    'Другое',
  ];

  readonly partnerRolesList = [
    { value: 'web-designer', label: 'Веб-дизайнер (UI/UX)' },
    { value: 'marketer', label: 'Маркетолог / таргетолог' },
    { value: 'seo', label: 'SEO-специалист' },
    { value: 'copywriter', label: 'Копирайтер / контент-менеджер' },
    { value: 'studio', label: 'Веб-студия / агентство' },
    { value: 'smm', label: 'SMM-специалист' },
    { value: 'backend-dev', label: 'Бэкенд / мобильный разработчик' },
  ];

  readonly dealTypesList = [
    { value: 'referral', label: 'Реферальный — привожу клиента, получаю комиссию' },
    { value: 'outsource', label: 'Подрядный — продаю проект клиенту, вы — субподрядчик' },
  ];

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^[+0-9()\-\s]{6,20}$/)]],
      telegram: [''],
      service: [this.service ?? ''],
      partner_role: [this.partnerRole ?? ''],
      deal_type: [this.dealType ?? ''],
      message: [''],
    });
  }

  onSubmit(): void {
    if (this.sending) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.sending = true;
    this.error = '';
    const utm = this.utmService.getUtm();
    const payload: LeadPayload = {
      lead_type: this.leadType,
      name: this.form.value.name.trim(),
      phone: this.form.value.phone.trim(),
      telegram: this.form.value.telegram?.trim() || undefined,
      service: this.form.value.service || undefined,
      partner_role: this.leadType === 'partner' ? this.form.value.partner_role || undefined : undefined,
      deal_type: this.leadType === 'partner' ? this.form.value.deal_type || undefined : undefined,
      message: this.form.value.message?.trim() || undefined,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      page: typeof window !== 'undefined' ? window.location.pathname : '',
    };

    this.leadService.submit(payload).subscribe({
      next: () => {
        this.submitted = true;
        this.sending = false;
      },
      error: () => {
        this.error = 'Не удалось отправить. Попробуйте ещё раз или позвоните нам.';
        this.sending = false;
      },
    });
  }
}
