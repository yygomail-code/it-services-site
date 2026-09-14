import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LeadPayload } from '../models/lead.model';

@Injectable({ providedIn: 'root' })
export class LeadService {
  private readonly endpoint = '/api/lead.php';

  constructor(private http: HttpClient) {}

  submit(payload: LeadPayload): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(this.endpoint, payload);
  }
}
