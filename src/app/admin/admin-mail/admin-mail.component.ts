import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { EmailQueueItem, MailPreset, MailPurpose, MailService } from '../../models/admin.model';
import { AdminService } from '../../services/admin.service';

/** Сервисы отправки почты: SMTP-подключения (Яндекс, Mail.ru, Google, свой). */
@Component({
  selector: 'app-admin-mail',
  templateUrl: './admin-mail.html',
  styleUrl: './admin-mail.scss',
})
export class AdminMailComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  error = '';
  services: MailService[] = [];
  presets: Record<string, MailPreset> = {};
  purposes: Record<string, string> = {};

  formOpen = false;
  editingId: number | null = null;
  saving = false;
  saveError = '';

  testing = false;
  testMessage = '';

  // Очередь писем
  queue: EmailQueueItem[] = [];
  queueCounts: Record<string, number> = {};
  queueLoading = false;
  queueMessage = '';
  queueError = '';

  // Запуск по расписанию (cron по ссылке)
  cronHasKey = false;
  cronLink: string | null = null;
  cronMessage = '';
  cronError = '';
  cronCopied = false;

  name = '';
  provider = 'yandex';
  host = '';
  port = 465;
  encryption: 'ssl' | 'tls' | 'none' = 'ssl';
  username = '';
  password = '';
  fromEmail = '';
  fromName = '';
  purpose: MailPurpose = 'leads';
  active = true;

  ngOnInit(): void {
    this.load();
    this.loadQueue();
    this.loadCronLink();
  }

  // ---- Запуск по расписанию ----
  loadCronLink(): void {
    this.admin.getCronLink().subscribe({
      next: (res) => {
        this.cronHasKey = res.has_key;
        this.cronLink = res.link;
        this.cdr.markForCheck();
      },
      error: () => {
        this.cdr.markForCheck();
      },
    });
  }

  /** Сгенерировать или перегенерировать ссылку запуска. */
  generateCronLink(): void {
    const question = this.cronHasKey
      ? 'Перегенерировать ссылку? Старая ссылка перестанет работать.'
      : 'Сгенерировать ссылку для запуска отправки писем по расписанию?';
    if (!confirm(question)) {
      return;
    }
    this.cronMessage = '';
    this.cronError = '';
    this.admin.generateCronLink().subscribe({
      next: (res) => {
        this.cronHasKey = res.has_key ?? true;
        this.cronLink = res.link ?? null;
        this.cronMessage = 'Ссылка готова — скопируйте её в cron хостинга.';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.cronError = err?.error?.error ?? 'Не удалось сгенерировать ссылку';
        this.cdr.markForCheck();
      },
    });
  }

  /** Отключить запуск по ссылке (старая ссылка перестанет работать). */
  removeCronLink(): void {
    if (!confirm('Отключить запуск по ссылке? Ссылка перестанет работать.')) {
      return;
    }
    this.cronMessage = '';
    this.cronError = '';
    this.admin.deleteCronLink().subscribe({
      next: () => {
        this.cronHasKey = false;
        this.cronLink = null;
        this.cronMessage = 'Запуск по ссылке отключён.';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.cronError = err?.error?.error ?? 'Не удалось отключить ссылку';
        this.cdr.markForCheck();
      },
    });
  }

  /** Скопировать ссылку в буфер обмена. */
  copyCronLink(input: HTMLInputElement): void {
    if (!this.cronLink) {
      return;
    }
    const done = (): void => {
      this.cronCopied = true;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.cronCopied = false;
        this.cdr.markForCheck();
      }, 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(this.cronLink).then(done).catch(() => {
        input.select();
        document.execCommand('copy');
        done();
      });
    } else {
      input.select();
      document.execCommand('copy');
      done();
    }
  }

  loadQueue(): void {
    this.queueLoading = true;
    this.admin.getEmailQueue().subscribe({
      next: (res) => {
        this.queue = res.queue ?? [];
        this.queueCounts = res.counts ?? {};
        this.queueLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.queueLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  /** Обработать очередь сейчас (кнопка в разделе «Очередь писем»). */
  processQueue(): void {
    this.queueMessage = '';
    this.queueError = '';
    this.admin.processEmailQueue().subscribe({
      next: (res) => {
        this.queueMessage = `Обработано: отправлено ${res.sent ?? 0}, ошибок ${res.failed ?? 0}, осталось в очереди ${res.left ?? 0}`;
        this.loadQueue();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.queueError = err.error?.error || 'Не удалось обработать очередь';
        this.cdr.markForCheck();
      },
    });
  }

  /** Повторить отправку письма вручную. */
  retryQueueItem(item: EmailQueueItem): void {
    this.queueMessage = '';
    this.queueError = '';
    this.admin.retryEmailQueueItem(item.id).subscribe({
      next: (res) => {
        this.queueMessage = res.sent
          ? 'Письмо отправлено'
          : 'Письмо не ушло — осталось в очереди, попробуем ещё раз автоматически';
        this.loadQueue();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.queueError = err.error?.error || 'Не удалось повторить отправку';
        this.cdr.markForCheck();
      },
    });
  }

  queueStatusLabel(status: string): string {
    if (status === 'sent') {
      return 'Отправлено';
    }
    if (status === 'failed') {
      return 'Не отправлено';
    }
    return 'В очереди';
  }

  load(): void {
    this.loading = true;
    this.admin.getMailServices().subscribe({
      next: (res) => {
        this.services = res.services ?? [];
        this.presets = res.presets ?? {};
        this.purposes = res.purposes ?? {};
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Не удалось загрузить сервисы';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  get presetList(): Array<{ code: string; preset: MailPreset }> {
    return Object.entries(this.presets).map(([code, preset]) => ({ code, preset }));
  }

  get purposeList(): Array<{ code: string; label: string }> {
    return Object.entries(this.purposes).map(([code, label]) => ({ code, label }));
  }

  /** У редактируемого сервиса уже задан пароль (в API он не приходит). */
  get hasPassword(): boolean {
    return !!this.services.find((s) => s.id === this.editingId)?.has_password;
  }

  get currentHint(): string {
    return this.presets[this.provider]?.hint ?? '';
  }

  providerLabel(code: string): string {
    return this.presets[code]?.label ?? code;
  }

  purposeLabel(code: string): string {
    return this.purposes[code] ?? code;
  }

  // ---- Форма ----
  startCreate(): void {
    this.editingId = null;
    this.name = '';
    this.provider = 'yandex';
    this.username = '';
    this.password = '';
    this.fromEmail = '';
    this.fromName = '';
    this.purpose = 'leads';
    this.active = true;
    this.saveError = '';
    this.applyPreset('yandex');
    this.formOpen = true;
    this.cdr.markForCheck();
  }

  startEdit(service: MailService): void {
    this.editingId = service.id;
    this.name = service.name;
    this.provider = service.provider;
    this.host = service.host;
    this.port = service.port;
    this.encryption = service.encryption;
    this.username = service.username;
    this.password = '';
    this.fromEmail = service.from_email;
    this.fromName = service.from_name ?? '';
    this.purpose = service.purpose;
    this.active = !!service.active;
    this.saveError = '';
    this.formOpen = true;
    this.cdr.markForCheck();
  }

  cancelForm(): void {
    this.formOpen = false;
    this.cdr.markForCheck();
  }

  onProvider(value: string): void {
    this.provider = value;
    this.applyPreset(value);
    this.cdr.markForCheck();
  }

  /** Подставляет параметры соединения выбранного сервиса. */
  private applyPreset(code: string): void {
    const preset = this.presets[code];
    if (!preset || code === 'custom') {
      return;
    }
    this.host = preset.host;
    this.port = preset.port;
    this.encryption = preset.encryption;
  }

  onName(v: string): void {
    this.name = v;
    this.cdr.markForCheck();
  }

  onHost(v: string): void {
    this.host = v;
    this.cdr.markForCheck();
  }

  onPort(v: string): void {
    this.port = Number(v) || 0;
    this.cdr.markForCheck();
  }

  onEncryption(v: string): void {
    this.encryption = v as 'ssl' | 'tls' | 'none';
    this.cdr.markForCheck();
  }

  onUsername(v: string): void {
    this.username = v;
    this.cdr.markForCheck();
  }

  onPassword(v: string): void {
    this.password = v;
    this.cdr.markForCheck();
  }

  onFromEmail(v: string): void {
    this.fromEmail = v;
    this.cdr.markForCheck();
  }

  onFromName(v: string): void {
    this.fromName = v;
    this.cdr.markForCheck();
  }

  onPurpose(v: string): void {
    this.purpose = v as MailPurpose;
    this.cdr.markForCheck();
  }

  onActive(v: boolean): void {
    this.active = v;
    this.cdr.markForCheck();
  }

  // ---- Сохранение / удаление / проверка ----
  save(): void {
    if (this.saving) {
      return;
    }
    this.saving = true;
    this.saveError = '';
    this.admin
      .saveMailService({
        id: this.editingId ?? undefined,
        name: this.name.trim(),
        provider: this.provider,
        host: this.host.trim(),
        port: this.port,
        encryption: this.encryption,
        username: this.username.trim(),
        password: this.password,
        from_email: this.fromEmail.trim(),
        from_name: this.fromName.trim() || null,
        purpose: this.purpose,
        active: this.active ? 1 : 0,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.formOpen = false;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err?.error?.error ?? 'Не удалось сохранить сервис';
          this.cdr.markForCheck();
        },
      });
  }

  remove(service: MailService): void {
    if (!confirm(`Удалить сервис «${service.name}»?`)) {
      return;
    }
    this.admin.deleteMailService(service.id).subscribe({
      next: () => this.load(),
      error: (err) => {
        this.error = err?.error?.error ?? 'Не удалось удалить сервис';
        this.cdr.markForCheck();
      },
    });
  }

  /** Тестовое письмо: проверяем подключение и отправку. */
  test(service: MailService): void {
    const to = prompt('Куда отправить тестовое письмо?', service.from_email);
    if (to === null) {
      return;
    }
    this.testing = true;
    this.testMessage = '';
    this.admin.testMailService(service.id, to.trim()).subscribe({
      next: (res) => {
        this.testing = false;
        this.testMessage = 'Письмо отправлено на ' + (res.sent_to ?? to);
        this.load();
      },
      error: (err) => {
        this.testing = false;
        this.testMessage = err?.error?.error ?? 'Не удалось отправить письмо';
        this.load();
      },
    });
  }
}
