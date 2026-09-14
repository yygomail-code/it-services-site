import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LeadFormComponent } from '../../components/lead-form/lead-form.component';
import { ContentService } from '../../services/content.service';
import { SeoService } from '../../services/seo.service';
import { PortfolioCase } from '../../models/content.model';

@Component({
  selector: 'app-portfolio-detail',
  imports: [RouterLink, LeadFormComponent],
  templateUrl: './portfolio-detail.html',
  styleUrl: './portfolio-detail.scss',
})
export class PortfolioDetailComponent implements OnInit {
  case?: PortfolioCase;

  constructor(
    private route: ActivatedRoute,
    private content: ContentService,
    private seo: SeoService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      this.case = slug ? this.content.getCase(slug) : undefined;
      if (this.case) {
        this.seo.setSeo({
          title: `${this.case.title} — кейс`,
          description: this.case.shortDescription,
          canonical: `/portfolio/${this.case.slug}`,
        });
      }
    });
  }
}
