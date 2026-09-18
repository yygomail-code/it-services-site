import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../services/seo.service';

/** Страница 404: неизвестный адрес вместо молчаливого редиректа на главную. */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.setSeo({
      title: 'Страница не найдена — ИТ-услуги',
      description: 'Такой страницы нет или она перемещена. Перейдите в каталог услуг, товаров или напишите мне.',
      canonical: '/404',
      noindex: true,
    });
  }
}
