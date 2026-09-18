import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.scss',
})
export class AdminLoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  error = '';
  loading = false;

  ngOnInit(): void {
    this.form = this.fb.group({
      login: ['', Validators.required],
      password: ['', Validators.required],
    });

    // Если уже авторизован — сразу в админку
    this.auth.fetchMe().subscribe((res) => {
      if (res.user && (res.user.role === 'manager' || res.user.role === 'admin')) {
        this.router.navigate(['/admin/leads']);
      }
      this.cdr.markForCheck();
    });
    // Гарантированно получаем CSRF до первой отправки
    this.auth.ensureCsrf().subscribe();
  }

  submit(): void {
    if (this.loading) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();
    this.auth.login(this.form.value.login, this.form.value.password).subscribe({
      next: (res) => {
        if (res.user) {
          this.router.navigate(['/admin/leads']);
        } else {
          this.error = res.error || 'Ошибка входа';
          this.loading = false;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.error?.error || 'Ошибка входа';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }
}
