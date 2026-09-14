import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  imports: [],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class ProfileComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  user = this.auth.user;

  ngOnInit(): void {
    if (!this.auth.user()) {
      this.auth.fetchMe().subscribe({
        next: (res) => {
          if (!res.user) {
            this.router.navigate(['/login']);
          }
        },
      });
    }
  }

  logout(): void {
    this.auth.logout().subscribe(() => {
      this.router.navigate(['/']);
    });
  }
}
