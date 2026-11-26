
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SubmitConcernData {
  category: string;
  subject: string;
  description: string;
}

export interface SubmitConcernResponse {
  message: string;
  trackingCode: string;
  status: string;
  submittedAt: string;
}

export interface StatusHistory {
  status: string;
  date: string;
  note: string;
}

export interface TrackedConcern {
  trackingCode: string;
  category: string;
  subject: string;
  description: string;
  submittedAt: string;
  status: string;
  adminResponse: string;
  statusHistory: StatusHistory[];
}

export interface AdminConcern {
  trackingCode: string;
  category: string;
  subject: string;
  description: string;
  submittedAt: string;
  status: string;
  adminResponse: string;
}

export interface ReportConcern {
  trackingCode: string;
  category: string;
  subject: string;
  submittedAt: string;
  status: string;
}

export interface ReportSummary {
  statusCounts: { status: string; count: number }[];
  categoryCounts: { name: string; count: number }[];
  recentConcerns: ReportConcern[];
}

export interface UpdateConcernData {
  status: string;
  adminResponse: string;
}

export interface UpdateConcernResponse {
  message: string;
  trackingCode: string;
  status: string;
  adminResponse: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConcernService {

  private apiUrl = 'https://localhost:7239/api/concerns';
  constructor(private http: HttpClient) {}

  // SUBMIT CONCERN
  submitConcern(
    concern: SubmitConcernData
  ): Observable<SubmitConcernResponse> {
    return this.http.post<SubmitConcernResponse>(
      this.apiUrl,
      concern
    );
  }

  // GET ALL CONCERNS FOR ADMIN
  getAllConcerns(): Observable<AdminConcern[]> {
    return this.http.get<AdminConcern[]>(
      this.apiUrl
    );
  }

  getReportSummary(): Observable<ReportSummary> {
    return this.http.get<ReportSummary>(
      `${this.apiUrl}/report-summary`
    );
  }

  // UPDATE CONCERN STATUS AND ADMIN RESPONSE
  updateConcern(
    trackingCode: string,
    data: UpdateConcernData
  ): Observable<UpdateConcernResponse> {
    const code = encodeURIComponent(
      trackingCode.trim().toUpperCase()
    );

    return this.http.put<UpdateConcernResponse>(
      `${this.apiUrl}/${code}`,
      data
    );
  }

  // TRACK CONCERN
  getConcernByTrackingCode(
    trackingCode: string
  ): Observable<TrackedConcern> {
    const code = encodeURIComponent(
      trackingCode.trim().toUpperCase()
    );

    return this.http.get<TrackedConcern>(
      `${this.apiUrl}/${code}`
    );
  }
}
