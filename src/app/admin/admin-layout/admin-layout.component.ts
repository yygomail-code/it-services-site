import { Component, inject, OnInit, OnDestroy, signal, ChangeDetectorRef, effect } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ContentService } from '../../services/content.service';
import { UiSettingsService } from '../../services/ui-settings.service';
import { brandMark } from '../../utils/footer.util';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ui = inject(UiSettingsService);
  private readonly content = inject(ContentService);
  private readonly cdr = inject(ChangeDetectorRef);
  private uiSub?: Subscription;

  user = this.auth.user;
  collapsed = signal(false);

  constructor() {
    // Бренд приходит после загрузки контента и обновляется при сохранении настроек
    effect(() => {
      if (this.content.ready()) {
        this.content.revision();
        this.cdr.markForCheck();
      }
    });
  }

  ngOnInit(): void {
    this.collapsed.set(this.ui.get('admin.sidebarCollapsed', false));
    this.uiSub = this.ui.watch().subscribe(() => {
      this.collapsed.set(this.ui.get('admin.sidebarCollapsed', false));
      this.cdr.markForCheck();
    });
    if (!this.auth.user()) {
      this.auth.fetchMe().subscribe();
    }
  }

  /** Единый бренд сайта для шапки админки. */
  get brandName(): string {
    return this.content.getBrand().name;
  }

  get brandLogo(): string {
    return this.content.getBrand().logo;
  }

  get brandMark(): string {
    const brand = this.content.getBrand();
    return brandMark(brand.mark, brand.name);
  }

  ngOnDestroy(): void {
    this.uiSub?.unsubscribe();
  }

  toggleSidebar(): void {
    this.ui.set('admin.sidebarCollapsed', !this.collapsed());
  }

  logout(): void {
    this.auth.logout().subscribe(() => {
      this.router.navigate(['/admin/login']);
    });
  }
}
