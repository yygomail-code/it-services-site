import { DealType } from './lead.model';

export interface Service {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  longDescription: string;
  icon: string;
  image?: string;
  features: string[];
  priceFrom?: string;
  faq: { q: string; a: string }[];
}

export interface PortfolioCase {
  slug: string;
  title: string;
  category: string;
  shortDescription: string;
  description: string;
  image?: string;
  tags: string[];
  result?: string;
  link?: string;
}

export interface PartnerRoleInfo {
  id: string;
  title: string;
  description: string;
  benefits: string[];
  dealType: DealType;
  cta: string;
}
