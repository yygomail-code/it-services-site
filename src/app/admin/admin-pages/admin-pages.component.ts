import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { Page } from '../../models/admin.model';

@Component({
  selector: 'app-admin-pages',
  imports: [RouterLink],
  templateUrl: './admin-pages.html',
  styleUrl: './admin-pages.scss',
})
export class AdminPagesComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly cdr = inject(ChangeDetectorRef);

  pages: Page[] = [];
  loading = true;
  error = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.admin.getPages().subscribe({
      next: (res) => {
        this.pages = res.pages;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Не удалось загрузить страницы';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  remove(page: Page): void {
    if (!confirm(`Удалить страницу «${page.title}»? Действие необратимо.`)) {
      return;
    }
    this.admin.deletePage(page.id).subscribe({
      next: () => {
        this.pages = this.pages.filter((p) => p.id !== page.id);
        this.cdr.markForCheck();
      },
      error: () => {
        alert('Не удалось удалить страницу');
      },
    });
  }

  trackPage(_index: number, page: Page): number {
    return page.id;
  }
}
