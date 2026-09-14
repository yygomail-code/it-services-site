import { Injectable } from '@angular/core';
import { SERVICES } from '../data/services.data';
import { CASES } from '../data/portfolio.data';
import { PARTNER_ROLES } from '../data/partners.data';
import { PartnerRoleInfo, PortfolioCase, Service } from '../models/content.model';

@Injectable({ providedIn: 'root' })
export class ContentService {
  getServices(): Service[] {
    return SERVICES;
  }

  getService(slug: string): Service | undefined {
    return SERVICES.find((s) => s.slug === slug);
  }

  getCases(): PortfolioCase[] {
    return CASES;
  }

  getCase(slug: string): PortfolioCase | undefined {
    return CASES.find((c) => c.slug === slug);
  }

  getPartnerRoles(): PartnerRoleInfo[] {
    return PARTNER_ROLES;
  }
}
