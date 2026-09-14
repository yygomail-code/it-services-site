import { Component, inject, OnInit } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { Lead } from '../../models/admin.model';

@Component({
  selector: 'app-admin-leads',
  templateUrl: './admin-leads.html',
  styleUrl: './admin-leads.scss',
})
export class AdminLeadsComponent implements OnInit {
  private readonly admin = inject(AdminService);

  leads: Lead[] = [];
  total = 0;
  pages = 1;
  page = 1;
  limit = 25;

  statusFilter = 'all';
  typeFilter = 'all';
  search = '';

  stats: Record<string, number> = {};
  totalCount = 0;

  loading = true;
  error = '';

  expandedId: number | null = null;

  readonly statusLabels: Record<string, string> = {
    new: 'Новый',
    in_progress: 'В работе',
    closed: 'Закрыт',
    rejected: 'Отклонён',
  };

  readonly typeLabels: Record<string, string> = {
    client: 'Клиент',
    partner: 'Партнёр',
  };

  ngOnInit(): void {
    this.load();
    this.loadStats();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.admin
      .getLeads({
        page: this.page,
        limit: this.limit,
        status: this.statusFilter,
        lead_type: this.typeFilter,
        q: this.search,
      })
      .subscribe({
        next: (res) => {
          this.leads = res.leads;
          this.total = res.total;
          this.pages = res.pages;
          this.loading = false;
        },
        error: () => {
          this.error = 'Не удалось загрузить лиды';
          this.loading = false;
        },
      });
  }

  loadStats(): void {
    this.admin.getLeadsStats().subscribe({
      next: (res) => {
        this.stats = res.stats;
        this.totalCount = res.total;
      },
      error: () => {},
    });
  }

  setStatus(status: string): void {
    this.statusFilter = status;
    this.page = 1;
    this.load();
  }

  setType(type: string): void {
    this.typeFilter = type;
    this.page = 1;
    this.load();
  }

  onSearch(value: string): void {
    this.search = value;
    this.page = 1;
    this.load();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.pages) {
      return;
    }
    this.page = p;
    this.load();
  }

  toggle(id: number): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  changeStatus(lead: Lead, status: string): void {
    this.admin.updateLead(lead.id, { status }).subscribe({
      next: () => {
        lead.status = status;
        this.loadStats();
      },
      error: () => {
        alert('Не удалось обновить статус');
      },
    });
  }

  deleteLead(lead: Lead): void {
    if (!confirm(`Удалить лид "${lead.name}"?`)) {
      return;
    }
    this.admin.deleteLead(lead.id).subscribe({
      next: () => {
        this.leads = this.leads.filter((l) => l.id !== lead.id);
        this.loadStats();
      },
      error: () => {
        alert('Не удалось удалить лид');
      },
    });
  }
}
