import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ServiceCardComponent } from '../../components/service-card/service-card.component';
import { ContentService } from '../../services/content.service';
import { SeoService } from '../../services/seo.service';
import { Service } from '../../models/content.model';

@Component({
  selector: 'app-services',
  imports: [RouterLink, ServiceCardComponent],
  templateUrl: './services.html',
  styleUrl: './services.scss',
})
export class ServicesComponent implements OnInit {
  services: Service[] = [];

  constructor(
    private content: ContentService,
    private seo: SeoService,
  ) {}

  ngOnInit(): void {
    this.services = this.content.getServices();
    this.seo.setSeo({
      title: 'Услуги — разработка сайтов, CRM, БД, автоматизация',
      description:
        'Полный список услуг: разработка и поддержка сайтов, внедрение CRM, базы данных, корпоративный софт, интеграции AI, ускорение сайтов. Удалённо и с выездом.',
      canonical: '/services',
    });
  }
}
