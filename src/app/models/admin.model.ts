export type UserRole = 'client' | 'manager' | 'admin';

export interface User {
  id: number;
  login: string;
  email?: string | null;
  role: UserRole;
  full_name?: string | null;
  active?: number;
  created_at?: string;
  last_login_at?: string | null;
}

export interface Lead {
  id: number;
  lead_id: string;
  lead_type: 'client' | 'partner';
  partner_role?: string | null;
  deal_type?: 'referral' | 'outsource' | null;
  name: string;
  phone: string;
  telegram?: string | null;
  service?: string | null;
  message?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  page?: string | null;
  status: string;
  created_at: string;
}

export interface LeadsResponse {
  leads: Lead[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ContentMap {
  [key: string]: string | null;
}
