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
        'Свяжитесь со мной по телефону 8 (938) 026-49-03, почте или через форму. Краснодар, работаю удалённо по всей России, возможен выезд к заказчику.',
      canonical: '/contacts',
    });
  }
}
