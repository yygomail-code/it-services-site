export type LeadType = 'client' | 'partner';

export type DealType = 'referral' | 'outsource';

export type PartnerRole =
  | 'web-designer'
  | 'marketer'
  | 'seo'
  | 'copywriter'
  | 'studio'
  | 'smm'
  | 'backend-dev';

export interface LeadPayload {
  lead_type: LeadType;
  partner_role?: PartnerRole;
  deal_type?: DealType;
  name: string;
  phone: string;
  telegram?: string;
  service?: string;
  message?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  page: string;
}
