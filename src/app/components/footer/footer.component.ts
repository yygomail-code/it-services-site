import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../services/content.service';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class FooterComponent {
  constructor(public content: ContentService) {}

  get phone(): string {
    return this.content.get('contacts.phone', '8 (938) 026-49-03');
  }

  get phoneHref(): string {
    return 'tel:+79380264903';
  }

  get email(): string {
    return this.content.get('contacts.email', 'hello@example.ru');
  }

  get city(): string {
    return this.content.get('contacts.city', 'Краснодар');
  }
}
