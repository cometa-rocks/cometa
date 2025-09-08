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
  ) {}

  ngOnInit() {
    this.log.msg('feature-metrics-usage.component.ts','FeatureMetricsUsageComponent initialized','','');
    this.loadUsageStatistics();
  }

  private loadUsageStatistics() {
    this.loading = true;
    this.error = null;
    
    console.log('[FeatureMetricsUsageComponent] Calling /cometausage/ endpoint...');
    
    this._api.getUsageStatistics().subscribe({
      next: (data) => {
        console.log('[FeatureMetricsUsageComponent] Received data from API:', data);
        this.statistics = data;
        this.loading = false;
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
    if (!value) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '0' : num.toLocaleString();
  }

  /**
   * Formats execution time for display
   */
  formatTime(value: string | number): string {
    if (!value) return '0';
    const ms = typeof value === 'string' ? parseFloat(value) : value;
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
}