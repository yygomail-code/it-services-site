import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  form!: FormGroup;
  error = '';
  loading = false;

  ngOnInit(): void {
    this.form = this.fb.group({
      login: ['', Validators.required],
      password: ['', Validators.required],
    });

    this.auth.fetchMe().subscribe((res) => {
      if (res.user) {
        this.redirect(res.user.role);
      }
    });
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
    this.auth.login(this.form.value.login, this.form.value.password).subscribe({
      next: (res) => {
        if (res.user) {
          this.redirect(res.user.role);
        } else {
          this.error = res.error || 'Ошибка входа';
          this.loading = false;
        }
      },
      error: (err) => {
        this.error = err.error?.error || 'Ошибка входа';
        this.loading = false;
      },
    });
  }

  private redirect(role: string): void {
    if (role === 'manager' || role === 'admin') {
      this.router.navigate(['/admin/leads']);
    } else {
      this.router.navigate(['/profile']);
    }
  }
}
