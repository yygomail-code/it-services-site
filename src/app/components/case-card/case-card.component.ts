import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PortfolioCase } from '../../models/content.model';

@Component({
  selector: 'app-case-card',
  imports: [RouterLink],
  templateUrl: './case-card.html',
  styleUrl: './case-card.scss',
})
export class CaseCardComponent {
  @Input({ required: true }) case!: PortfolioCase;
}
