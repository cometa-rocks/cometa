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
  selectedBackupId: string | null = null;

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

  showSteps(backupId: string): void {
    if (this.selectedBackupId === backupId) {
      // If clicking the same backup, hide it
      this.selectedBackupId = null;
    } else {
      // Show the selected backup's steps
      this.selectedBackupId = backupId;
    }
  }

  getSelectedBackupSteps(): FeatureHistoryStep[] {
    if (!this.selectedBackupId) return [];
    const selectedEntry = this.history.find(entry => entry.backup_id === this.selectedBackupId);
    return selectedEntry ? selectedEntry.steps : [];
  }

  formatJsonContent(content: any): string {
    try {
      return JSON.stringify(content, null, 2);
    } catch (error) {
      return String(content);
    }
  }

  formatStep(step: FeatureHistoryStep): string {
    try {
      const stepData = step.step_content;
      
      if (!stepData) {
        return 'No step data';
      }

      // If stepData is an array, we need to handle multiple steps
      if (Array.isArray(stepData)) {
        if (stepData.length === 0) {
          return 'No steps found';
        }
        
        // Return a clear summary with backup ID and step count
        const filename = step.step_file || 'Unknown file';
        return `Backup: ${filename} - ${stepData.length} steps`;
      }

      // Handle single step object (fallback)
      if (typeof stepData === 'object') {
        const keyword = stepData.step_keyword || '';
        const content = stepData.step_content || '';
        
        if (keyword && content) {
          return `${keyword} - ${content}`;
        } else if (keyword) {
          return keyword;
        } else if (content) {
          return content;
        }
      }
      
      return 'Invalid step data';
    } catch (error) {
      console.error('Error formatting step:', error);
      return 'Error formatting step';
    }
  }

  getStepFlags(step: FeatureHistoryStep): { label: string; value: boolean; color: string }[] {
    try {
      const stepData = step.step_content;
      
      if (!stepData || typeof stepData !== 'object') {
        return [];
      }

      const flags = [
        { key: 'enabled', label: 'Enabled', color: 'primary', showWhen: true },
        { key: 'enabled', label: 'Disabled', color: 'disabled', showWhen: false },
        { key: 'screenshot', label: 'Screenshot', color: 'accent', showWhen: true },
        { key: 'compare', label: 'Compare', color: 'warn', showWhen: true },
        { key: 'continue_on_failure', label: 'Continue on Failure', color: 'warn', showWhen: true },
        { key: 'selected', label: 'Selected', color: 'primary', showWhen: true }
      ];

      return flags
        .filter(flag => stepData[flag.key] === flag.showWhen)
        .map(flag => ({ label: flag.label, value: true, color: flag.color }));
    } catch (error) {
      console.error('Error getting step flags:', error);
      return [];
    }
  }

  getIndividualStepFlags(individualStep: any): { label: string; value: boolean; color: string }[] {
    try {
      if (!individualStep || typeof individualStep !== 'object') {
        return [];
      }

      const flags = [
        { key: 'enabled', label: 'Enabled', color: 'primary', showWhen: true },
        { key: 'enabled', label: 'Disabled', color: 'disabled', showWhen: false },
        { key: 'screenshot', label: 'Screenshot', color: 'accent', showWhen: true },
        { key: 'compare', label: 'Compare', color: 'warn', showWhen: true },
        { key: 'continue_on_failure', label: 'Continue on Failure', color: 'warn', showWhen: true },
        { key: 'selected', label: 'Selected', color: 'primary', showWhen: true }
      ];

      return flags
        .filter(flag => individualStep[flag.key] === flag.showWhen)
        .map(flag => ({ label: flag.label, value: true, color: flag.color }));
    } catch (error) {
      console.error('Error getting individual step flags:', error);
      return [];
    }
  }

  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  getFlagIcon(flagLabel: string): string {
    switch (flagLabel) {
      case 'Enabled': return 'check_circle';
      case 'Screenshot': return 'photo_camera';
      case 'Compare': return 'compare';
      case 'Continue on Failure': return 'error_outline';
      case 'Selected': return 'star';
      default: return 'info';
    }
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