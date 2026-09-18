import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectorRef, inject } from '@angular/core';
import { Role } from '../../models/admin.model';

/** Модальное окно выбора ролей, которым видна ссылка. */
@Component({
  selector: 'app-admin-roles-picker',
  templateUrl: './admin-roles-picker.html',
  styleUrl: './admin-roles-picker.scss',
  host: { '(document:keydown.escape)': 'close()' },
})
export class AdminRolesPickerComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() roles: Role[] = [];
  /** Текущий выбор: null — все роли (видна всем). */
  @Input() selected: string[] | null = null;
  @Output() readonly applied = new EventEmitter<string[]>();
  @Output() readonly closed = new EventEmitter<void>();

  chosen: string[] = [];

  ngOnInit(): void {
    // Коды удалённых ролей не показываем и не сохраняем
    const known = new Set(this.roles.map((r) => r.code));
    this.chosen = this.selected
      ? this.selected.filter((code) => known.has(code))
      : this.roles.map((r) => r.code);
  }

  isChecked(code: string): boolean {
    return this.chosen.includes(code);
  }

  toggle(code: string, on: boolean): void {
    if (on) {
      if (!this.chosen.includes(code)) {
        this.chosen = [...this.chosen, code];
      }
    } else {
      this.chosen = this.chosen.filter((c) => c !== code);
    }
    this.cdr.markForCheck();
  }

  selectAll(): void {
    this.chosen = this.roles.map((r) => r.code);
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.chosen = [];
    this.cdr.markForCheck();
  }

  apply(): void {
    this.applied.emit([...this.chosen]);
  }

  close(): void {
    this.closed.emit();
  }
}
