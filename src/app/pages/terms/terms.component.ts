import { Component, OnInit } from '@angular/core';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-terms',
  templateUrl: './terms.html',
  styleUrl: './terms.scss',
})
export class TermsComponent implements OnInit {
  constructor(private seo: SeoService) {}

  ngOnInit(): void {
    this.seo.setSeo({
      title: 'Пользовательское соглашение',
      description:
        'Пользовательское соглашение — правила использования сайта, условия оказания услуг, ответственность сторон.',
      canonical: '/terms',
    });
  }
}
