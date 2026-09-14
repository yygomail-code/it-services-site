import { Component, OnInit } from '@angular/core';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-policy',
  templateUrl: './policy.html',
  styleUrl: './policy.scss',
})
export class PolicyComponent implements OnInit {
  constructor(private seo: SeoService) {}

  ngOnInit(): void {
    this.seo.setSeo({
      title: 'Политика конфиденциальности',
      description: 'Политика конфиденциальности и обработки персональных данных на сайте.',
      canonical: '/policy',
    });
  }
}
