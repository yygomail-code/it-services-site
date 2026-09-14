import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
})
export class AdminLayoutComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  user = this.auth.user;

  ngOnInit(): void {
    if (!this.auth.user()) {
      this.auth.fetchMe().subscribe();
    }
  }

  logout(): void {
    this.auth.logout().subscribe(() => {
      this.router.navigate(['/admin/login']);
    });
  }
}
