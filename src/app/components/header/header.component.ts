import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);

  menuOpen = false;
  user = this.auth.user;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.auth.fetchMe().subscribe();
    }
  }

  get profileLink(): string {
    const role = this.user()?.role;
    return role === 'manager' || role === 'admin' ? '/admin' : '/profile';
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }
}
