import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { Form } from '../../models/admin.model';

@Component({
  selector: 'app-admin-forms',
  imports: [RouterLink],
  templateUrl: './admin-forms.html',
  styleUrl: './admin-forms.scss',
})
export class AdminFormsComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly cdr = inject(ChangeDetectorRef);

  forms: Form[] = [];
  loading = true;
  error = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.admin.getForms().subscribe({
      next: (res) => {
        this.forms = res.forms;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Не удалось загрузить формы';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  remove(form: Form): void {
    if (!confirm(`Удалить форму «${form.title}»? Все собранные данные будут удалены.`)) {
      return;
    }
    this.admin.deleteForm(form.id).subscribe({
      next: () => {
        this.forms = this.forms.filter((f) => f.id !== form.id);
        this.cdr.markForCheck();
      },
      error: () => {
        alert('Не удалось удалить форму');
      },
    });
  }

  trackForm(_index: number, form: Form): number {
    return form.id;
  }
}
