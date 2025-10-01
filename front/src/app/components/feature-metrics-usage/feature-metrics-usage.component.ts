import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
} from '@angular/core';
import { ApiService } from '@services/api.service';
import { LogService } from '@services/log.service';
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
    
    this.log.msg('feature-metrics-usage.component.ts','Calling /cometausage/ endpoint...','','');
    
    this._api.getUsageStatistics().subscribe({
      next: (data) => {
        this.log.msg('feature-metrics-usage.component.ts','Received data from API','',JSON.stringify(data));
        
        // Test with zero values
        // data.total_number_features = "0";
        // data.total_tests_executed = "0";
        // data.average_execution_time_ms = "0";
        // data.average_execution_time_s = "0";
        // data.total_execution_time_ms = "0";
        // data.total_execution_time_s = "0";
        // data.total_execution_time_m = "0";
        // data.total_execution_time_h = "0";

        this.statistics = data;
        console.log('Statistics', this.statistics);
        this.loading = false;
        this.changeDetectorRef.detectChanges();
      },
      error: (err) => {
        this.log.msg('feature-metrics-usage.component.ts','Error calling API','',JSON.stringify(err));
        this.error = err.message || 'Error loading usage statistics';
        this.loading = false;
      }
    });
  }

  // Hide zero/empty metrics in UI
  isNonZero(value: string | number | null | undefined): boolean {
    if (value === null || value === undefined) return false;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return !isNaN(num as number) && (num as number) > 0;
  }

  // True if at least one value is > 0
  anyNonZero(...values: Array<string | number | null | undefined>): boolean {
    return values.some(v => this.isNonZero(v));
  }

  // Returns true if any metric contains a non-zero value
  hasAnyData(): boolean {
    const s = this.statistics || {};
    return this.anyNonZero(
      s.average_execution_time_ms,
      s.average_execution_time_s,
      s.total_execution_time_ms,
      s.total_execution_time_s,
      s.total_execution_time_m,
      s.total_execution_time_h,
      s.total_tests_executed,
      s.total_number_features
    );
  }

  /**
   * Formats a large number with commas
   */
  formatNumber(value: string | number): string {
    this.log.msg('formatNumber','Input value','',`${value} (${typeof value})`);
    
    if (!value) {
      this.log.msg('formatNumber','Value is falsy, returning 0','','');
      return '0';
    }
    
    const num = typeof value === 'string' ? parseFloat(value) : value;
    this.log.msg('formatNumber','Parsed number','',`${num} (isNaN: ${isNaN(num)})`);
    
    const result = isNaN(num) ? '0' : num.toLocaleString();
    this.log.msg('formatNumber','Final result','',result);
    
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