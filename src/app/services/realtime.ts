import { Injectable, NgZone, OnDestroy } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel
} from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';

export interface ConcernChangedEvent {
  trackingCode: string;
  status: string;
}

/**
 * SignalR connection to the API's /hubs/concerns hub.
 * The URL is relative so it goes through the Angular dev proxy
 * (proxy.conf.json) and works from localhost and LAN devices alike.
 */
@Injectable({
  providedIn: 'root'
})
export class RealtimeService implements OnDestroy {

  private readonly hubUrl = '/hubs/concerns';

  private connection: HubConnection;
  private startPromise: Promise<void> | null = null;

  private readonly watchedCodes = new Set<string>();

  private readonly concernsChangedSubject = new Subject<ConcernChangedEvent>();
  private readonly concernUpdatedSubject = new Subject<ConcernChangedEvent>();

  /** Any concern was submitted or updated (used by admin pages). */
  readonly concernsChanged$: Observable<ConcernChangedEvent> =
    this.concernsChangedSubject.asObservable();

  /** A watched concern (see watchConcern) was updated. */
  readonly concernUpdated$: Observable<ConcernChangedEvent> =
    this.concernUpdatedSubject.asObservable();

  constructor(private zone: NgZone) {
    this.connection = new HubConnectionBuilder()
      .withUrl(this.hubUrl)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    this.connection.on('ConcernsChanged', (event: ConcernChangedEvent) =>
      this.zone.run(() => this.concernsChangedSubject.next(event))
    );

    this.connection.on('ConcernUpdated', (event: ConcernChangedEvent) =>
      this.zone.run(() => this.concernUpdatedSubject.next(event))
    );

    // Group membership is lost on reconnect, so re-join watched concerns.
    this.connection.onreconnected(() => {
      this.watchedCodes.forEach(code =>
        this.connection.invoke('WatchConcern', code).catch(() => {})
      );
    });
  }

  /** Start the connection (safe to call multiple times). */
  connect(): Promise<void> {
    if (this.connection.state === HubConnectionState.Connected) {
      return Promise.resolve();
    }

    if (!this.startPromise) {
      this.startPromise = this.connection.start()
        .catch(error => {
          console.error('SIGNALR CONNECTION ERROR:', error);
          throw error;
        })
        .finally(() => {
          this.startPromise = null;
        });
    }

    return this.startPromise;
  }

  async watchConcern(trackingCode: string): Promise<void> {
    const code = trackingCode.trim().toUpperCase();
    if (!code) return;

    this.watchedCodes.add(code);

    try {
      await this.connect();
      await this.connection.invoke('WatchConcern', code);
    } catch {
      // Live updates are optional; the page still works without them.
    }
  }

  async unwatchConcern(trackingCode: string): Promise<void> {
    const code = trackingCode.trim().toUpperCase();
    if (!this.watchedCodes.delete(code)) return;

    if (this.connection.state === HubConnectionState.Connected) {
      await this.connection.invoke('UnwatchConcern', code).catch(() => {});
    }
  }

  ngOnDestroy(): void {
    this.connection.stop();
  }
}
