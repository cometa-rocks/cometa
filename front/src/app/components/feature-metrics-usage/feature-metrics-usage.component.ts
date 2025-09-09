import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { Select, Store } from '@ngxs/store';
import { SharedActionsService } from '@services/shared-actions.service';

import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { ApiService } from '@services/api.service';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';

import { LogService } from '@services/log.service';

import { StarredService } from '@services/starred.service';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NgIf, AsyncPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'cometa-feature-metrics-usage',
  templateUrl: './feature-metrics-usage.component.html',    
  styleUrls: ['./feature-metrics-usage.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    NgIf,
    AsyncPipe,
    DecimalPipe
  ],
})
export class FeatureMetricsUsageComponent implements OnInit {
  statistics: any = null;
  loading = false;
  error: string | null = null;

  constructor(
    private _api: ApiService,
    private log: LogService,
    private changeDetectorRef: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.log.msg('feature-metrics-usage.component.ts','FeatureMetricsUsageComponent initialized','','');
    this.loadUsageStatistics();
  }

  loadUsageStatistics() {
    this.loading = true;
    this.error = null;
    
    console.log('[FeatureMetricsUsageComponent] Calling /cometausage/ endpoint...');
    
    this._api.getUsageStatistics().subscribe({
      next: (data) => {
        console.log('[FeatureMetricsUsageComponent] Received data from API:', data);
        this.statistics = data;
        this.loading = false;
        this.changeDetectorRef.detectChanges();
      },
      error: (err) => {
        console.error('[FeatureMetricsUsageComponent] Error calling API:', err);
        this.error = err.message || 'Error loading usage statistics';
        this.loading = false;
      }
    });
  }

  /**
   * Formats a large number with commas
   */
  formatNumber(value: string | number): string {
    console.log('[formatNumber] Input value:', value, 'Type:', typeof value);
    
    if (!value) {
      console.log('[formatNumber] Value is falsy, returning 0');
      return '0';
    }
    
    const num = typeof value === 'string' ? parseFloat(value) : value;
    console.log('[formatNumber] Parsed number:', num, 'isNaN:', isNaN(num));
    
    const result = isNaN(num) ? '0' : num.toLocaleString();
    console.log('[formatNumber] Final result:', result);
    
    return result;
  }

   /**
   * Converts hours to days and hours
   */
   formatHoursToDays(hours: string | number): string {
    if (!hours) return '0d 0h';
    const h = typeof hours === 'string' ? parseFloat(hours) : hours;
    if (isNaN(h)) return '0d 0h';
    
    const days = Math.floor(h / 24);
    const remainingHours = Math.floor(h % 24);
    
    return `${days}d ${remainingHours}h`;
  }

  /**
   * Converts minutes to hours and minutes
   */
  formatMinutesToHours(minutes: string | number): string {
    if (!minutes) return '0h 0m';
    const m = typeof minutes === 'string' ? parseFloat(minutes) : minutes;
    if (isNaN(m)) return '0h 0m';
    
    const hours = Math.floor(m / 60);
    const remainingMinutes = Math.floor(m % 60);
    
    return `${hours}h ${remainingMinutes}m`;
  }

  /**
   * Converts seconds to minutes and seconds
   */
  formatSecondsToMinutes(seconds: string | number): string {
    if (!seconds) return '0m 0s';
    const s = typeof seconds === 'string' ? parseFloat(seconds) : seconds;
    if (isNaN(s)) return '0m 0s';
    
    const minutes = Math.floor(s / 60);
    const remainingSeconds = Math.floor(s % 60);
    
    return `${minutes}m ${remainingSeconds}s`;
  }

   /**
   * Converts milliseconds to seconds
   */
   formatMillisecondsToSeconds(ms: string | number): string {
    if (!ms) return '0s';
    const milliseconds = typeof ms === 'string' ? parseFloat(ms) : ms;
    if (isNaN(milliseconds)) return '0s';
    
    const seconds = Math.floor(milliseconds / 1000);
    return `${seconds}s`;
  }

}