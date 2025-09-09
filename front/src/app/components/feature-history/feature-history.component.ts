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
import { Component, OnInit, Inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '@services/api.service';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { LogService } from '@services/log.service';

@Component({
  selector: 'cometa-feature-history',
  templateUrl: './feature-history.component.html',
  styleUrls: ['./feature-history.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    TitleCasePipe,
  ],
})
export class FeatureHistoryComponent implements OnInit {

  featureId: number;
  departmentId: number;
  history: FeatureHistoryEntry[] = [];
  loading: boolean = false;
  error: string | null = null;
  selectedBackupIds: Set<string> = new Set(); // Track multiple open step expansions
  selectedChangesBackupIds: Set<string> = new Set(); // Track multiple open change expansions
  currentFeature: any = null;
  loadingChanges: boolean = false;
  cachedChanges: Map<string, any> = new Map(); // Cache for comparison results by backup ID

  constructor(
    private _api: ApiService,
    @Inject(MAT_DIALOG_DATA) public data: { featureId: number, departmentId: number },
    private dialogRef: MatDialogRef<FeatureHistoryComponent>,
    private log: LogService,
    
  ) {
    this.featureId = data.featureId;
    this.departmentId = data.departmentId;
  }

  ngOnInit(): void {
    if (this.featureId) {
      this.log.msg('1', 'Loading feature history for feature ID', 'feature-history');
      this.loadFeatureHistory();
    } else {
    }
  }

  loadFeatureHistory(): void {
    this.loading = true;
    this.error = null;

    // Use existing ApiService to call the backend
    this._api.getFeatureHistory(this.featureId, this.departmentId).subscribe({
      next: (response: FeatureHistoryResponse) => {
        if (response.success) {
          this.history = response.history;
        } else {
          this.error = response.error || 'Failed to load feature history';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error loading feature history';
        this.loading = false;
      }
    });
  }

  showSteps(backupId: string): void {
    if (this.selectedBackupIds.has(backupId)) {
      // If clicking the same backup, hide it
      this.selectedBackupIds.delete(backupId);
    } else {
      // Show the selected backup's steps
      this.selectedBackupIds.add(backupId);
    }
  }

  showChanges(backupId: string): void {
    if (this.selectedChangesBackupIds.has(backupId)) {
      // If clicking the same backup, hide it
      this.selectedChangesBackupIds.delete(backupId);
      this.cachedChanges.delete(backupId); // Clear cache when hiding
    } else {
      // Show the selected backup's changes
      this.selectedChangesBackupIds.add(backupId);
      this.cachedChanges.delete(backupId); // Clear cache when switching to new backup
      this.loadCurrentFeature();
    }
  }

  loadCurrentFeature(): void {
    if (!this.currentFeature) {
      this.loadingChanges = true;
      this._api.getFeature(this.featureId).subscribe({
        next: (feature) => {
          this.currentFeature = feature;
          this.cachedChanges.clear(); // Clear cache when feature changes
          this.loadingChanges = false;
          
          // Also fetch the detailed steps for proper comparison
          this.loadCurrentFeatureSteps();
        },
        error: (err) => {
          this.loadingChanges = false;
        }
        
      });
    }
  }

  loadCurrentFeatureSteps(): void {
    // Fetch the detailed steps for the current feature
    this._api.getFeatureSteps(this.featureId).subscribe({
      next: (steps) => {
        if (this.currentFeature) {
          this.currentFeature.detailedSteps = steps;
          this.cachedChanges.clear(); // Clear cache when steps change
        }
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  getSelectedBackupChanges(): any {
    if (this.selectedChangesBackupIds.size === 0) return null;
    const selectedBackupId = Array.from(this.selectedChangesBackupIds)[0]; // Get the first selected backup ID
    const selectedEntry = this.history.find(entry => entry.backup_id === selectedBackupId);
    return selectedEntry || null;
  }



  isCurrentVersion(backupId: string): boolean {
    // The topmost backup (index 0) is considered the current version
    if (this.history.length > 0) {
      return this.history[0].backup_id === backupId;
    }
    return false;
  }



  hasStepCountChanged(backupEntry: any): boolean {
    // Simple step count comparison
    const currentSteps = this.currentFeature.steps || 0;
    const backupSteps = backupEntry.steps_count || 0;
        
    return currentSteps !== backupSteps;
  }

  hasStepContentChanged(backupEntry: any): boolean {
    // For now, just return false - we'll implement step content comparison later
    return false;
  }



  // Helper method to get backup steps array
  getBackupSteps(backupEntry: any): any[] {    
    if (!backupEntry || !backupEntry.steps) {
      return [];
    }
    
    const backupSteps = backupEntry.steps;    
    // With new unified structure, steps are directly in backupEntry.steps
    if (Array.isArray(backupSteps)) {
      return backupSteps;
    }

    return [];
  }



  hasScheduleChanged(backupEntry: any): boolean {
    const currentSchedule = this.currentFeature.schedule;
    const backupSchedule = backupEntry.schedule;
    
    // Check if schedule was activated/deactivated or content changed
    // Handle the case where one is undefined and the other is empty string
    const currentHasSchedule = currentSchedule && currentSchedule.trim() !== '';
    const backupHasSchedule = backupSchedule && backupSchedule.trim() !== '';
    
    // If both have no schedule, no change
    if (!currentHasSchedule && !backupHasSchedule) {
      return false;
    }
    
    // If one has a schedule and the other doesn't, that's a change
    if (currentHasSchedule !== backupHasSchedule) {
      return true;
    }
    
    // Check if schedule content changed (only if both have schedules)
    if (currentHasSchedule && backupHasSchedule && currentSchedule !== backupSchedule) {
      return true;
    }
    
    return false;
  }

  hasBrowsersChanged(backupEntry: any): boolean {
    const currentBrowsers = this.currentFeature.browsers || [];
    const backupBrowsers = backupEntry.browsers || [];
    
    // If both have no browsers, no change
    if (currentBrowsers.length === 0 && backupBrowsers.length === 0) {
      return false;
    }
    
    // If one has browsers and the other doesn't, that's a change
    if (currentBrowsers.length === 0 && backupBrowsers.length > 0) {
      return true;
    }
    
    if (backupBrowsers.length === 0 && currentBrowsers.length > 0) {
      return true;
    }
    
    // If both have browsers, compare the actual configurations
    if (currentBrowsers.length > 0 && backupBrowsers.length > 0) {
      // Create simplified browser strings for comparison
      const currentBrowserStrings = currentBrowsers.map((b: any) => {
        const browser = b.browser || b.browser_name || 'Unknown';
        const version = b.browser_version || b.version || 'latest';
        return `${browser}-${version}`;
      }).sort();
      
      const backupBrowserStrings = backupBrowsers.map((b: any) => {
        const browser = b.browser || b.browser_name || 'Unknown';
        const version = b.browser_version || b.version || 'latest';
        return `${browser}-${version}`;
      }).sort();
      
      // Compare the simplified strings
      return JSON.stringify(currentBrowserStrings) !== JSON.stringify(backupBrowserStrings);
    }
    
    // If we get here, the counts are different
    return true;
  }

  getChangeValue(obj: any, key: string): string {
    if (!obj) return 'N/A';
    
    let value = obj[key];
    
    // Handle special cases for the new change types
    if (key === 'step_count_changed') {
      // For step count, return the appropriate value based on which object we're displaying
      if (obj === this.currentFeature) {
        // Use the same value as the UI button (from backend)
        return String(this.currentFeature.steps || 0);
      } else {
        // This is the backup entry - use the same value as the UI button (from backend)
        return String(obj.steps_count || 0);
      }
    }
    
    if (key === 'step_content_changed') {
      return this.getStepContentChangeDescription();
    }
    
    if (key === 'schedule_changed') {
      return this.getScheduleChangeDescription();
    }
    
    if (key === 'browsers_changed') {
      // For browsers, return a clean list of browsers
      const browsers = obj.browsers || [];
      if (browsers.length === 0) {
        return 'No browsers selected';
      }
      
      // Create simplified browser strings
      const browserStrings = browsers.map((b: any) => {
        const browser = b.browser || b.browser_name || 'Unknown';
        const version = b.browser_version || b.version || 'latest';
        return `${browser}-${version}`;
      });
      
      return browserStrings.join(', ');
    }
    
    // Handle boolean values - show consistent format
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    // Handle null/undefined - show consistent format
    if (value === null || value === undefined) {
      return 'No';
    }
    
    // Return as string
    return String(value);
  }



  getStepContentChangeDescription(): string {
    if (!this.currentFeature || this.selectedChangesBackupIds.size === 0) return 'N/A';
    
    const backupEntry = this.getSelectedBackupChanges();
    if (!backupEntry) return 'N/A';
    
    const backupEntrySteps = backupEntry.steps || [];
    const currentDetailedSteps = this.currentFeature.detailedSteps || [];

    if (backupEntrySteps.length === 0) {
      return 'No step data available for comparison';
    }

    if (currentDetailedSteps.length === 0) {
      return 'Step content comparison not available (detailed steps not loaded)';
    }

    // Simple comparison: if step counts are different, content changed
    if (backupEntrySteps.length !== currentDetailedSteps.length) {
      return `Step count changed from ${backupEntrySteps.length} to ${currentDetailedSteps.length}`;
    }

    return 'No step content changes detected';
  }

  getScheduleChangeDescription(): string {
    if (!this.currentFeature || this.selectedChangesBackupIds.size === 0) return 'N/A';
    
    const backupEntry = this.getSelectedBackupChanges();
    if (!backupEntry) return 'N/A';
    
    const currentSchedule = this.currentFeature.schedule;
    const backupSchedule = backupEntry.schedule;
    
    // Check if schedule was activated/deactivated or content changed
    const currentHasSchedule = currentSchedule && currentSchedule.trim() !== '';
    const backupHasSchedule = backupSchedule && backupSchedule.trim() !== '';
    
    // If both have no schedule, no change
    if (!currentHasSchedule && !backupHasSchedule) {
      return 'No schedule changes';
    }
    
    // If one has a schedule and the other doesn't, that's a change
    if (currentHasSchedule !== backupHasSchedule) {
      if (backupHasSchedule && !currentHasSchedule) {
        return 'Schedule deactivated';
      } else {
        return 'Schedule activated';
      }
    }
    
    // Check if schedule content changed (only if both have schedules)
    if (currentHasSchedule && backupHasSchedule && currentSchedule !== backupSchedule) {
      return 'Schedule content changed';
    }
    
    return 'No schedule changes';
  }







  getChangeLabel(key: string): string {
    const labels: { [key: string]: string } = {
      feature_name: 'Feature Name',
      description: 'Description',
      step_count_changed: 'Total Steps',
      step_content_changed: 'Step Content',
      schedule_changed: 'Schedule',
      browsers_changed: 'Browser Selection',
      send_mail: 'Send Email',
      send_mail_on_error: 'Send Email on Error',
      network_logging: 'Network Logging',
      generate_dataset: 'Generate Dataset',
      continue_on_failure: 'Continue on Failure',
      send_telegram_notification: 'Telegram Notifications'
    };
    
    return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  getSelectedBackupSteps(): any[] {
    if (this.selectedBackupIds.size === 0) return [];
    const selectedBackupId = Array.from(this.selectedBackupIds)[0]; // Get the first selected backup ID
    const selectedEntry = this.history.find(entry => entry.backup_id === selectedBackupId);
    return selectedEntry ? selectedEntry.steps : [];
  }

  formatJsonContent(content: any): string {
    try {
      return JSON.stringify(content, null, 2);
    } catch (error) {
      return String(content);
    }
  }

  formatStep(step: any): string {
    try {
      // With the new unified backup structure, steps are directly in the backup data
      if (!step) {
        return 'No step data';
      }

      // If step is an array, it contains individual step objects
      if (Array.isArray(step)) {
        if (step.length === 0) {
          return 'No steps found';
        }
        
        // Return a summary of the steps
        return `${step.length} steps`;
      }

      // If step is an object with step properties (individual step)
      if (typeof step === 'object' && step.step_keyword && step.step_content) {
        const keyword = step.step_keyword || '';
        const content = step.step_content || '';
        
        if (keyword && content) {
          return `${keyword} ${content}`;
        } else if (keyword) {
          return keyword;
        } else if (content) {
          return content;
        }
      }

      // If step is an object, it might contain step_content array (legacy format)
      if (typeof step === 'object' && step.step_content && Array.isArray(step.step_content)) {
        return `${step.step_content.length} steps`;
      }
      
      return 'Invalid step data';
    } catch (error) {
      console.error('Error in formatStep:', error);
      return 'Error formatting step';
    }
  }

  getStepFlags(step: any): { label: string; value: boolean; color: string }[] {
    try {
      // With new unified structure, step is the actual step data
      if (!step || typeof step !== 'object') {
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
        .filter(flag => step[flag.key] === flag.showWhen)
        .map(flag => ({ label: flag.label, value: true, color: flag.color }));
    } catch (error) {
      console.error('Error in getStepFlags:', error);
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
      console.error('Error in getIndividualStepFlags:', error);
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

  // Helper method to parse backup timestamp format
  parseBackupTimestamp(timestamp: string): Date {
    try {      
      if (!timestamp) {
        return new Date();
      }
      
      // Try different timestamp formats
      let parsedDate: Date;
      
      // Format 1: ISO string (e.g., "2025-09-01T12:26:01.123Z")
      if (timestamp.includes('T') && (timestamp.includes('Z') || timestamp.includes('+') || timestamp.includes('-'))) {
        parsedDate = new Date(timestamp);
      }
      // Format 2: "2025-08-12 11:37:42" (space separated)
      else if (timestamp.includes(' ') && timestamp.includes(':')) {
        parsedDate = new Date(timestamp);
      }
      // Format 3: "2025-09-01_12-26-01" (YYYY-MM-DD_HH-MM-SS format)
      else if (timestamp.includes('_') && timestamp.includes('-')) {
        // Convert "2025-09-01_12-26-01" to "2025-09-01 12:26:01"
        const normalizedTimestamp = timestamp.replace('_', ' ');
        
        // Try the normalized format first
        parsedDate = new Date(normalizedTimestamp);
        
        // If that fails, try manual parsing
        if (isNaN(parsedDate.getTime())) {
          const parts = timestamp.split('_');
          if (parts.length === 2) {
            const datePart = parts[0]; // "2025-09-01"
            const timePart = parts[1]; // "12-26-01"
            const timeNormalized = timePart.replace(/-/g, ':'); // "12:26:01"
            const fullTimestamp = `${datePart} ${timeNormalized}`; // "2025-09-01 12:26:01"
            parsedDate = new Date(fullTimestamp);
          }
        }
      }
      // Format 4: Unix timestamp (number)
      else if (!isNaN(Number(timestamp))) {
        parsedDate = new Date(Number(timestamp));
      }
      // Format 5: Try as regular date string
      else {
        parsedDate = new Date(timestamp);
      }
      
      // Validate the parsed date
      if (isNaN(parsedDate.getTime())) {
        throw new Error('Invalid date format');
      }
      
      return parsedDate;
    } catch (error) {
      console.error('Error parsing timestamp:', error);
      console.error('Original timestamp:', timestamp);
      // Fallback: return current date
      return new Date();
    }
  }

  formatDate(timestamp: string): string {
    try {
      // Parse the backup timestamp format and convert to local timezone
      const localDate = this.parseBackupTimestamp(timestamp);
      
      // Get current date for comparison
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const backupDate = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate());
      
      // Format based on how recent the backup is
      if (backupDate.getTime() === today.getTime()) {
        // Today: show time only
        return `Today at ${localDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else if (backupDate.getTime() === yesterday.getTime()) {
        // Yesterday: show "Yesterday at time"
        return `Yesterday at ${localDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else if (now.getTime() - localDate.getTime() < 7 * 24 * 60 * 60 * 1000) {
        // Within a week: show day name and time
        return `${localDate.toLocaleDateString([], { weekday: 'long' })} at ${localDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else {
        // Older: show full date and time
        return localDate.toLocaleDateString([], { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        }) + ' at ' + localDate.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
    } catch (error) {
      console.error('Error in formatDate:', error);
      console.error('Original timestamp:', timestamp);
      // Fallback: return a simple formatted string
      return timestamp || 'Unknown date';
    }
  }

  getRelativeTime(timestamp: string): string {
    try {
      const now = new Date();
      // Parse the backup timestamp format and convert to local timezone
      const localDate = this.parseBackupTimestamp(timestamp);
      const diffInSeconds = Math.floor((now.getTime() - localDate.getTime()) / 1000);
      
      if (diffInSeconds < 60) return 'just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
      return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
    } catch (error) {
      console.error('Error in getRelativeTime:', error);
      console.error('Original timestamp:', timestamp);
      return 'unknown time'; // Fallback if parsing fails
    }
  }

  // Helper method to check if a specific backup has steps expanded
  isStepsExpanded(backupId: string): boolean {
    return this.selectedBackupIds.has(backupId);
  }

  // Helper method to check if a specific backup has changes expanded
  isChangesExpanded(backupId: string): boolean {
    return this.selectedChangesBackupIds.has(backupId);
  }

  // Helper method to get changes for a specific backup ID
  getChangesForBackup(backupId: string): any {
    if (!this.currentFeature) return null;
    
    // Don't show changes for the current version (topmost backup)
    if (this.isCurrentVersion(backupId)) {
      return null;
    }
    
    // Return cached result if available
    if (this.cachedChanges.has(backupId)) {
      return this.cachedChanges.get(backupId);
    }
    
    // Get the backup entry for this specific backup ID
    const backupEntry = this.history.find(entry => entry.backup_id === backupId);
    if (!backupEntry) return null;
    
    const changes = this.compareFeatureVersionsForBackup(backupEntry);
    this.cachedChanges.set(backupId, changes);
    return changes;
  }

  // Compare feature versions for a specific backup entry
  compareFeatureVersionsForBackup(backupEntry: any): any {
    if (!this.currentFeature || !backupEntry) return null;

    try {
      // Helper function to safely compare boolean values
      const compareBoolean = (current: any, backup: any, field: string) => {
        // Convert both values to boolean for comparison
        const currentVal = Boolean(current);
        const backupVal = Boolean(backup);
        
        // If both are false (or undefined/null which become false), it's not a change
        if (!currentVal && !backupVal) {
          return false;
        }
        
        // Otherwise, compare their boolean values
        return currentVal !== backupVal;
      };

      const changes = {
        feature_name: this.currentFeature.feature_name !== backupEntry.feature_name,
        description: this.currentFeature.description !== backupEntry.description,
        step_count_changed: this.hasStepCountChanged(backupEntry),
        step_content_changed: this.hasStepContentChanged(backupEntry),
        schedule_changed: this.hasScheduleChanged(backupEntry),
        browsers_changed: this.hasBrowsersChanged(backupEntry),
        send_mail: compareBoolean(this.currentFeature.send_mail, backupEntry.send_mail, 'send_mail'),
        send_mail_on_error: compareBoolean(this.currentFeature.send_mail_on_error, backupEntry.send_mail_on_error, 'send_mail_on_error'),
        network_logging: compareBoolean(this.currentFeature.network_logging, backupEntry.network_logging, 'network_logging'),
        generate_dataset: compareBoolean(this.currentFeature.generate_dataset, backupEntry.generate_dataset, 'generate_dataset'),
        continue_on_failure: compareBoolean(this.currentFeature.continue_on_failure, backupEntry.continue_on_failure, 'continue_on_failure'),
        send_telegram_notification: compareBoolean(this.currentFeature.send_telegram_notification, backupEntry.send_telegram_notification, 'send_telegram_notification')
      };

      return {
        hasChanges: Object.values(changes).some(change => change === true),
        changes: changes,
        current: this.currentFeature,
        backup: backupEntry
      };
    } catch (error) {
      console.error(error);
      return {
        hasChanges: false,
        changes: {},
        current: this.currentFeature,
        backup: backupEntry,
        error: 'Error comparing versions'
      };
    }
  }
}