import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import { SocketService } from './socket.service';

export interface BrowserUseLogEntry {
  message: string;
  level: 'critical' | 'progress' | 'detail';
  step_index: number;  // Changed from step_counter to step_index
  timestamp: string;
  feature_id: number;
  feature_result_id: number;
}

@Injectable({
  providedIn: 'root'
})
export class BrowserUseLogService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private logsSubject = new BehaviorSubject<BrowserUseLogEntry[]>([]);

  // Public observable for components
  public logs$: Observable<BrowserUseLogEntry[]> = this.logsSubject.asObservable();

  constructor(private socketService: SocketService) {
    this.initializeWebSocketListener();
  }

  private initializeWebSocketListener(): void {
    // Initialize socket connection if not already done
    if (!this.socketService.socket) {
      this.socketService.Init();
    }

    // Subscribe to browser-use logs from SocketService
    this.socketService.browserUseLog$
      .pipe(
        filter((logData: any) => logData && logData.message)
      )
      .subscribe((logData: any) => {
        this.addLog({
          message: logData.message,
          level: logData.log_level,
          step_index: logData.step_index || 0,  // Use step_index from backend
          timestamp: logData.timestamp,
          feature_id: logData.feature_id,
          feature_result_id: logData.feature_result_id
        });
      });
  }

  private addLog(entry: BrowserUseLogEntry): void {
    const currentLogs = this.logsSubject.value;
    // Keep only last 100 logs for performance
    const updatedLogs = [...currentLogs, entry].slice(-100);
    this.logsSubject.next(updatedLogs);
  }

  public clearLogs(): void {
    this.logsSubject.next([]);
  }

  public getLogsForFeature(featureId: number): Observable<BrowserUseLogEntry[]> {
    return this.logs$.pipe(
      map(logs => logs.filter(log => log.feature_id === featureId))
    );
  }

  public getLogsForFeatureResult(featureResultId: number): Observable<BrowserUseLogEntry[]> {
    return this.logs$.pipe(
      map(logs => logs.filter(log => log.feature_result_id === featureResultId))
    );
  }

  public getLogsForStep(featureResultId: number, stepIndex: number): Observable<BrowserUseLogEntry[]> {
    return this.logs$.pipe(
      map(logs => logs.filter(log =>
        log.feature_result_id === featureResultId &&
        log.step_index === stepIndex
      ))
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}