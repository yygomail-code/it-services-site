import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Service } from '../../models/admin.model';
import { servicePriceLabel } from '../../services/public-services.service';

@Component({
  selector: 'app-service-card',
  imports: [RouterLink],
  templateUrl: './service-card.html',
  styleUrl: './service-card.scss',
})
export class ServiceCardComponent {
  @Input({ required: true }) service!: Service;

  /** Раздел карточки: товары живут в /products, услуги — в /services. */
  sectionPath(): string {
    return this.service.kind === 'product' ? '/products' : '/services';
  }

  priceLabel(): string {
    return servicePriceLabel(this.service);
  }
}
