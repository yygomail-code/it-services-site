import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LeadFormComponent } from '../../components/lead-form/lead-form.component';
import { ContentService } from '../../services/content.service';
import { SeoService } from '../../services/seo.service';
import { Service } from '../../models/content.model';

@Component({
  selector: 'app-service-detail',
  imports: [RouterLink, LeadFormComponent],
  templateUrl: './service-detail.html',
  styleUrl: './service-detail.scss',
})
export class ServiceDetailComponent implements OnInit {
  service?: Service;

  constructor(
    private route: ActivatedRoute,
    private content: ContentService,
    private seo: SeoService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      this.service = slug ? this.content.getService(slug) : undefined;
      if (this.service) {
        this.seo.setSeo({
          title: `${this.service.title} — ИТ-услуги`,
          description: this.service.description,
          canonical: `/services/${this.service.slug}`,
        });
        this.seo.setServiceJsonLd(this.service);
        this.seo.setFaqJsonLd(this.service.faq);
      }
    });
  }
}
