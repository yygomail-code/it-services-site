import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ServiceCardComponent } from '../service-card/service-card.component';
import { PublicServicesService } from '../../services/public-services.service';
import { Service } from '../../models/admin.model';

/** Сетка услуг (блок «Услуги» на страницах): карточки из каталога модуля. */
@Component({
  selector: 'app-services-grid',
  imports: [ServiceCardComponent],
  templateUrl: './services-grid.component.html',
  styleUrl: './services-grid.component.scss',
})
export class ServicesGridComponent implements OnInit {
  private readonly api = inject(PublicServicesService);
  private readonly cdr = inject(ChangeDetectorRef);

  services: Service[] = [];
  loading = true;

  ngOnInit(): void {
    this.api.getCatalog({ per_page: 50, kind: 'service' }).subscribe((res) => {
      this.services = res?.items ?? [];
      this.loading = false;
      this.cdr.markForCheck();
    });
  }
}
