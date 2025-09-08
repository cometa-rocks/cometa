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
   * Formats execution time for display
   */
  formatTime(value: string | number): string {
    console.log('[formatTime] Input value:', value, 'Type:', typeof value);
    
    if (!value) {
      console.log('[formatTime] Value is falsy, returning 0');
      return '0';
    }
    
    const ms = typeof value === 'string' ? parseFloat(value) : value;
    console.log('[formatTime] Parsed ms:', ms);
    
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    console.log('[formatTime] Calculated - hours:', hours, 'minutes:', minutes, 'seconds:', seconds);

    let result;
    if (hours > 0) {
      result = `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      result = `${minutes}m ${seconds}s`;
    } else {
      result = `${seconds}s`;
    }
    
    console.log('[formatTime] Final result:', result);
    return result;
  }
}