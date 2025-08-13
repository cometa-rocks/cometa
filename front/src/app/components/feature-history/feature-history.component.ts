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
import { CommonModule, TitleCasePipe } from '@angular/common';
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
    TitleCasePipe,
  ],
})
export class FeatureHistoryComponent implements OnInit {

  featureId: number;
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
          console.log('loadFeatureHistory - loaded history:', this.history);
          
          // Log the first backup entry to see its structure
          if (this.history.length > 0) {
            console.log('loadFeatureHistory - first backup entry:', this.history[0]);
            console.log('loadFeatureHistory - first backup entry steps:', this.history[0].steps);
          }
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
          //console log of current feature object
          console.log(this.currentFeature);
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
        // If we can't load detailed steps, that's okay - we'll use the basic comparison
        console.warn('Could not load detailed steps for comparison:', err);
      }
    });
  }

  getSelectedBackupChanges(): any {
    if (this.selectedChangesBackupIds.size === 0) return null;
    const selectedBackupId = Array.from(this.selectedChangesBackupIds)[0]; // Get the first selected backup ID
    const selectedEntry = this.history.find(entry => entry.backup_id === selectedBackupId);
    return selectedEntry || null;
  }

  getChangesForSelectedBackup(): any {
    // Only run comparison when we actually have a selected backup for changes
    if (this.selectedChangesBackupIds.size === 0 || !this.currentFeature) {
      return null;
    }
    
    // Don't show changes for the current version (topmost backup)
    if (this.isCurrentVersion(Array.from(this.selectedChangesBackupIds)[0])) {
      return null;
    }
    
    // Return cached result if available
    const selectedBackupId = Array.from(this.selectedChangesBackupIds)[0];
    if (this.cachedChanges.has(selectedBackupId)) {
      return this.cachedChanges.get(selectedBackupId);
    }
    
    const changes = this.compareFeatureVersions();
    this.cachedChanges.set(selectedBackupId, changes);
    return changes;
  }

  isCurrentVersion(backupId: string): boolean {
    // The topmost backup (index 0) is considered the current version
    if (this.history.length > 0) {
      return this.history[0].backup_id === backupId;
    }
    return false;
  }

  compareFeatureVersions(): any {
    if (!this.currentFeature || this.selectedChangesBackupIds.size === 0) return null;
    
    const backupEntry = this.getSelectedBackupChanges();
    if (!backupEntry) return null;

    console.log('compareFeatureVersions - backupEntry:', backupEntry);
    console.log('compareFeatureVersions - backupEntry.steps:', backupEntry.steps);

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

      console.log('compareFeatureVersions - changes:', changes);

      return {
        hasChanges: Object.values(changes).some(change => change === true),
        changes: changes,
        current: this.currentFeature,
        backup: backupEntry
      };
    } catch (error) {
      console.error('compareFeatureVersions - error:', error);
      return {
        hasChanges: false,
        changes: {},
        current: this.currentFeature,
        backup: backupEntry,
        error: 'Error comparing versions'
      };
    }
  }

  hasStepCountChanged(backupEntry: any): boolean {
    // Simple step count comparison
    const currentSteps = this.currentFeature.detailedSteps ? this.currentFeature.detailedSteps.length : 0;
    const backupSteps = this.getBackupStepCount(backupEntry);
    
    console.log('hasStepCountChanged - currentSteps:', currentSteps, 'backupSteps:', backupSteps);
    
    return currentSteps !== backupSteps;
  }

  hasStepContentChanged(backupEntry: any): boolean {
    // For now, just return false - we'll implement step content comparison later
    console.log('hasStepContentChanged - Step content comparison disabled for now');
    return false;
  }

  // Helper method to get backup step count
  getBackupStepCount(backupEntry: any): number {
    const backupSteps = this.getBackupSteps(backupEntry);
    return backupSteps.length;
  }

  // Helper method to get backup steps array
  getBackupSteps(backupEntry: any): any[] {
    console.log('getBackupSteps - backupEntry:', backupEntry);
    
    if (!backupEntry || !backupEntry.steps) {
      console.log('getBackupSteps - No backup entry or steps');
      return [];
    }
    
    const backupSteps = backupEntry.steps;
    console.log('getBackupSteps - backupSteps:', backupSteps);
    
    // The backup steps structure is: backupEntry.steps[0].step_content
    if (backupSteps.length === 1 && backupSteps[0] && backupSteps[0].step_content) {
      const actualSteps = backupSteps[0].step_content;
      console.log('getBackupSteps - extracted actualSteps:', actualSteps);
      return Array.isArray(actualSteps) ? actualSteps : [];
    }
    
    console.log('getBackupSteps - Could not extract steps from backup structure');
    return [];
  }

  hasStepChanged(currentStep: any, backupStep: any, currentStepIndex: number): boolean {
    // This method is no longer needed with our new approach
    return false;
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
        // Use detailed steps count if available, otherwise fall back to basic steps count
        return String(this.currentFeature.detailedSteps ? this.currentFeature.detailedSteps.length : (this.currentFeature.steps || 0));
      } else {
        // This is the backup entry
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
      return this.getBrowsersChangeDescription();
    }
    
    // Handle boolean values - show consistent format
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    // Handle null/undefined - show consistent format
    if (value === null || value === undefined) {
      return 'No'; // Changed from "Not set" to "No" for consistency
    }
    
    // Return as string
    return String(value);
  }

  getStepCountChangeDescription(): string {
    if (!this.currentFeature || this.selectedChangesBackupIds.size === 0) return 'N/A';
    
    const backupEntry = this.getSelectedBackupChanges();
    if (!backupEntry) return 'N/A';
    
    const currentSteps = this.currentFeature.steps || 0;
    const backupSteps = backupEntry.steps_count || 0;
    
    // Return just the step count for display in the comparison
    return String(currentSteps);
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

    const modifiedSteps: number[] = [];
    
    // Compare step by step
    for (let i = 0; i < Math.min(backupEntrySteps.length, currentDetailedSteps.length); i++) {
      const currentStep = currentDetailedSteps[i];
      const backupStep = backupEntrySteps[i];

      if (this.hasStepChanged(currentStep, backupStep, i)) {
        modifiedSteps.push(i + 1); // Step numbers are 1-based for display
      }
    }

    if (modifiedSteps.length === 0) {
      return 'No step content changes detected';
    } else if (modifiedSteps.length === 1) {
      return `Step ${modifiedSteps[0]} was modified`;
    } else {
      return `Steps ${modifiedSteps.join(', ')} were modified`;
    }
  }

  getStepFlagChanges(backupEntry: any): string[] {
    const changes: string[] = [];
    
    if (!backupEntry.steps || !Array.isArray(backupEntry.steps)) {
      return changes;
    }
    
    // This is a placeholder for more detailed step comparison
    // In a real implementation, you would compare individual step properties
    // like enabled status, screenshot flags, compare flags, etc.
    
    return changes;
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

  getBrowsersChangeDescription(): string {
    if (!this.currentFeature || this.selectedChangesBackupIds.size === 0) return 'N/A';
    
    const backupEntry = this.getSelectedBackupChanges();
    if (!backupEntry) return 'N/A';
    
    const currentBrowsers = this.currentFeature.browsers || [];
    const backupBrowsers = backupEntry.browsers || [];
    
    // Helper function to create simplified browser strings
    const createBrowserString = (b: any) => {
      const browser = b.browser || b.browser_name || 'Unknown';
      const version = b.browser_version || b.version || 'latest';
      return `${browser}-${version}`;
    };
    
    // If both have no browsers
    if (currentBrowsers.length === 0 && backupBrowsers.length === 0) {
      return 'No browsers selected';
    }
    
    // If backup has no browsers but current has browsers
    if (backupBrowsers.length === 0 && currentBrowsers.length > 0) {
      const currentConfigs = currentBrowsers.map(createBrowserString).join(', ');
      return `Browsers added: ${currentConfigs}`;
    }
    
    // If current has no browsers but backup has browsers
    if (currentBrowsers.length === 0 && backupBrowsers.length > 0) {
      const backupConfigs = backupBrowsers.map(createBrowserString).join(', ');
      return `Browsers removed: ${backupConfigs}`;
    }
    
    // If both have browsers, check if they're the same
    if (currentBrowsers.length > 0 && backupBrowsers.length > 0) {
      const currentBrowserStrings = currentBrowsers.map(createBrowserString).sort();
      const backupBrowserStrings = backupBrowsers.map(createBrowserString).sort();
      
      // If configurations are the same, no change
      if (JSON.stringify(currentBrowserStrings) === JSON.stringify(backupBrowserStrings)) {
        return 'Browser selection unchanged';
      }
      
      // If they're different, show the change
      const currentConfigs = currentBrowserStrings.join(', ');
      const backupConfigs = backupBrowserStrings.join(', ');
      
      return `Browser selection changed: ${backupConfigs} → ${currentConfigs}`;
    }
    
    return 'Browser configuration error';
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

  getSelectedBackupSteps(): FeatureHistoryStep[] {
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

    console.log('compareFeatureVersionsForBackup - backupEntry:', backupEntry);
    console.log('compareFeatureVersionsForBackup - backupEntry.steps:', backupEntry.steps);

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

      console.log('compareFeatureVersionsForBackup - changes:', changes);

      return {
        hasChanges: Object.values(changes).some(change => change === true),
        changes: changes,
        current: this.currentFeature,
        backup: backupEntry
      };
    } catch (error) {
      console.error('compareFeatureVersionsForBackup - error:', error);
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