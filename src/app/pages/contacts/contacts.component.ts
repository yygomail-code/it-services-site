import { Component, OnInit } from '@angular/core';
import { LeadFormComponent } from '../../components/lead-form/lead-form.component';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-contacts',
  imports: [LeadFormComponent],
  templateUrl: './contacts.html',
  styleUrl: './contacts.scss',
})
export class ContactsComponent implements OnInit {
  constructor(private seo: SeoService) {}

  ngOnInit(): void {
    this.seo.setSeo({
      title: 'Контакты — связаться со мной по сайтам, CRM и автоматизации',
      description:
        'Свяжитесь со мной по телефону, почте или через форму. Работаю удалённо по всей России, возможен выезд к заказчику. Отвечаю ежедневно.',
      canonical: '/contacts',
    });
  }
}
