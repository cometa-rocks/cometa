/**
 * feature-history.component.ts
 *
 * Component containing the feature history page
 *
 * @date 11-08-25
 *
 * @lastModification 11-08-25
 *
 * @author: Nico
 */
import { Component, OnInit, Input, Inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '@services/api.service';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';

@Component({
  selector: 'cometa-feature-history',
  templateUrl: './feature-history.component.html',
  styleUrls: ['./feature-history.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatListModule,
    MatCardModule,
    MatChipsModule,
  ],
})
export class FeatureHistoryComponent implements OnInit {

  featureId: number;
  history: FeatureHistoryEntry[] = [];
  loading: boolean = false;
  error: string | null = null;

  constructor(
    private _api: ApiService,
    @Inject(MAT_DIALOG_DATA) public data: number,
    private dialogRef: MatDialogRef<FeatureHistoryComponent>
  ) {
    this.featureId = data;
  }

  ngOnInit(): void {
    if (this.featureId) {
      this.loadFeatureHistory();
    } else {
    }
  }

  loadFeatureHistory(): void {
    this.loading = true;
    this.error = null;

    // Use your existing ApiService to call the backend
    this._api.getFeatureHistory(this.featureId).subscribe({
      next: (response: FeatureHistoryResponse) => {
        if (response.success) {
          this.history = response.history;
        } else {
          this.error = response.error || 'Failed to load feature history';
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('HTTP error:', err);
        this.error = 'Error loading feature history';
        this.loading = false;
      }
    });
  }

  formatDate(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
  }

  getRelativeTime(timestamp: string): string {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  }
}