import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { User, UserRole } from '../../models/admin.model';

@Component({
  selector: 'app-admin-users',
  imports: [FormsModule],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.scss',
})
export class AdminUsersComponent implements OnInit {
  private readonly admin = inject(AdminService);

  users: User[] = [];
  loading = true;
  error = '';

  // Форма создания
  showCreate = false;
  newLogin = '';
  newEmail = '';
  newPassword = '';
  newRole: UserRole = 'manager';
  newName = '';
  createError = '';

  // Редактирование
  editingId: number | null = null;
  editRole: UserRole = 'client';
  editActive = true;
  editName = '';
  editPassword = '';
  editError = '';

  readonly roles: Record<string, string> = {
    client: 'Клиент',
    manager: 'Менеджер',
    admin: 'Админ',
  };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.admin.getUsers().subscribe({
      next: (res) => {
        this.users = res.users;
        this.loading = false;
      },
      error: () => {
        this.error = 'Не удалось загрузить пользователей';
        this.loading = false;
      },
    });
  }

  openCreate(): void {
    this.showCreate = true;
    this.createError = '';
    this.newLogin = '';
    this.newEmail = '';
    this.newPassword = '';
    this.newRole = 'manager';
    this.newName = '';
  }

  createUser(): void {
    if (!this.newLogin || !this.newPassword) {
      this.createError = 'Логин и пароль обязательны';
      return;
    }
    this.admin
      .createUser({
        login: this.newLogin,
        email: this.newEmail || undefined,
        password: this.newPassword,
        role: this.newRole,
        full_name: this.newName || undefined,
        active: 1,
      })
      .subscribe({
        next: () => {
          this.showCreate = false;
          this.load();
        },
        error: (err) => {
          this.createError = err.error?.error || 'Не удалось создать пользователя';
        },
      });
  }

  startEdit(user: User): void {
    this.editingId = user.id;
    this.editRole = user.role;
    this.editActive = user.active === 1;
    this.editName = user.full_name || '';
    this.editPassword = '';
    this.editError = '';
  }

  saveEdit(user: User): void {
    this.admin
      .updateUser(user.id, {
        role: this.editRole,
        active: this.editActive ? 1 : 0,
        full_name: this.editName,
        password: this.editPassword || undefined,
      })
      .subscribe({
        next: () => {
          this.editingId = null;
          this.load();
        },
        error: (err) => {
          this.editError = err.error?.error || 'Не удалось сохранить';
        },
      });
  }

  deleteUser(user: User): void {
    if (!confirm(`Удалить пользователя "${user.login}"?`)) {
      return;
    }
    this.admin.deleteUser(user.id).subscribe({
      next: () => this.load(),
      error: (err) => alert(err.error?.error || 'Не удалось удалить'),
    });
  }

  cancelEdit(): void {
    this.editingId = null;
  }
}
