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
    private dialogRef: MatDialogRef<FeatureHistoryComponent>,
    private log: LogService
  ) {
    this.featureId = data;
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

  // Consolidated comparison method that handles both use cases
  compareFeatureVersions(backupEntry?: any): any {
    // If no backupEntry provided, get it from selectedChangesBackupIds
    let targetBackupEntry = backupEntry;
    
    if (!targetBackupEntry) {
      if (!this.currentFeature || this.selectedChangesBackupIds.size === 0) return null;
      targetBackupEntry = this.getSelectedBackupChanges();
      if (!targetBackupEntry) return null;
    } else {
      if (!this.currentFeature || !targetBackupEntry) return null;
    }

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
        feature_name: this.currentFeature.feature_name !== targetBackupEntry.feature_name,
        description: this.currentFeature.description !== targetBackupEntry.description,
        step_count_changed: this.hasStepCountChanged(targetBackupEntry),
        step_content_changed: this.hasStepContentChanged(targetBackupEntry),
        schedule_changed: this.hasScheduleChanged(targetBackupEntry),
        browsers_changed: this.hasBrowsersChanged(targetBackupEntry),
        send_mail: compareBoolean(this.currentFeature.send_mail, targetBackupEntry.send_mail, 'send_mail'),
        send_mail_on_error: compareBoolean(this.currentFeature.send_mail_on_error, targetBackupEntry.send_mail_on_error, 'send_mail_on_error'),
        network_logging: compareBoolean(this.currentFeature.network_logging, targetBackupEntry.network_logging, 'network_logging'),
        generate_dataset: compareBoolean(this.currentFeature.generate_dataset, targetBackupEntry.generate_dataset, 'generate_dataset'),
        continue_on_failure: compareBoolean(this.currentFeature.continue_on_failure, targetBackupEntry.continue_on_failure, 'continue_on_failure'),
        send_telegram_notification: compareBoolean(this.currentFeature.send_telegram_notification, targetBackupEntry.send_telegram_notification, 'send_telegram_notification')
      };

      return {
        hasChanges: Object.values(changes).some(change => change === true),
        changes: changes,
        current: this.currentFeature,
        backup: targetBackupEntry
      };
    } catch (error) {
      console.error(error);
      return {
        hasChanges: false,
        changes: {},
        current: this.currentFeature,
        backup: targetBackupEntry,
        error: 'Error comparing versions'
      };
    }
  }

  // Update step counting to reflect consolidated view
  getBackupStepCount(backupEntry: any): number {
    const backupSteps = this.getBackupSteps(backupEntry);
    const consolidatedSteps = this.consolidateSubfeatureSteps(backupSteps, this.featureId);
    return consolidatedSteps.length;
  }

  // Helper method to get backup steps array
  getBackupSteps(backupEntry: any): any[] {    
    if (!backupEntry || !backupEntry.steps) {
      return [];
    }
    
    const backupSteps = backupEntry.steps;    
    // The backup steps structure is: backupEntry.steps[0].step_content
    if (backupSteps.length === 1 && backupSteps[0] && backupSteps[0].step_content) {
      const actualSteps = backupSteps[0].step_content;

      return Array.isArray(actualSteps) ? actualSteps : [];
    }

    return [];
  }

  // Update the step count change detection to use consolidated steps
  hasStepCountChanged(backupEntry: any): boolean {
    // Use consolidated step count for comparison
    const currentSteps = this.currentFeature.detailedSteps ? this.currentFeature.detailedSteps.length : 0;
    const backupSteps = this.getBackupStepCount(backupEntry);
        
    return currentSteps !== backupSteps;
  }

  hasStepContentChanged(backupEntry: any): boolean {
    // For now, just return false - we'll implement step content comparison later
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
        // For current feature, we need to count normal steps + subfeatures, not detailedSteps.length
        // Since we don't have the backup structure for current feature, we'll use the steps property
        // which should represent the configured step count
        return String(this.currentFeature.steps || 0);
      } else {
        // This is the backup entry - use consolidated step count
        const backupId = obj.backup_id;
        if (backupId) {
          return String(this.getConsolidatedStepCount(backupId));
        }
        // Fallback to original steps_count if no backup_id
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
      // For browsers, return a clean list of browsers without verbose descriptions
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
      return 'No'; // Changed from "Not set" to "No" for consistency
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

    const modifiedSteps: number[] = [];
    
    for (let i = 0; i < Math.min(backupEntrySteps.length, currentDetailedSteps.length); i++) {
      modifiedSteps.push(i + 1); // Step numbers are 1-based for display
    }

    if (modifiedSteps.length === 0) {
      return 'No step content changes detected';
    } else if (modifiedSteps.length === 1) {
      return `Step ${modifiedSteps[0]} was modified`;
    } else {
      return `Steps ${modifiedSteps.join(', ')} were modified`;
    }
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

  // Add new method to consolidate subfeature steps
  consolidateSubfeatureSteps(steps: FeatureHistoryStep[], parentFeatureId: number): any[] {
    if (!steps || !Array.isArray(steps)) return [];
    
    const consolidatedSteps: any[] = [];
    let currentSubfeatureGroup: any[] = [];
    let currentSubfeatureId: number | null = null;
    
    for (const step of steps) {
      if (step.step_content && Array.isArray(step.step_content)) {
        // Process individual steps within the step content
        const individualSteps = step.step_content;
        const consolidatedIndividualSteps: any[] = [];
        let subfeatureSteps: any[] = [];
        
        for (const individualStep of individualSteps) {
          // Type assertion to access belongs_to property
          const stepData = individualStep as any;
          
          if (stepData.belongs_to && stepData.belongs_to !== parentFeatureId) {
            // This is a subfeature step
            if (subfeatureSteps.length === 0 || (subfeatureSteps[0] as any).belongs_to !== stepData.belongs_to) {
              // Start new subfeature group
              if (subfeatureSteps.length > 0) {
                // Add previous subfeature group as consolidated step
                const consolidatedStep = this.createConsolidatedSubfeatureStep(subfeatureSteps);
                if (consolidatedStep) {
                  consolidatedIndividualSteps.push(consolidatedStep);
                }
                subfeatureSteps = [];
              }
            }
            subfeatureSteps.push(individualStep);
            currentSubfeatureId = stepData.belongs_to;
          } else {
            // This is a normal step
            if (subfeatureSteps.length > 0) {
              // Add previous subfeature group as consolidated step
              const consolidatedStep = this.createConsolidatedSubfeatureStep(subfeatureSteps);
              if (consolidatedStep) {
                consolidatedIndividualSteps.push(consolidatedStep);
              }
              subfeatureSteps = [];
            }
            consolidatedIndividualSteps.push(individualStep);
          }
        }
        
        // Handle any remaining subfeature steps
        if (subfeatureSteps.length > 0) {
          const consolidatedStep = this.createConsolidatedSubfeatureStep(subfeatureSteps);
          if (consolidatedStep) {
            consolidatedIndividualSteps.push(consolidatedStep);
          }
        }
        
        // Create new step with consolidated content
        const consolidatedStep = {
          ...step,
          step_content: consolidatedIndividualSteps
        };
        consolidatedSteps.push(consolidatedStep);
      } else {
        // Direct step object - check if it has belongs_to property
        const stepData = step as any;
        if (stepData.belongs_to && stepData.belongs_to !== parentFeatureId) {
          // This is a subfeature step
          if (currentSubfeatureGroup.length === 0 || (currentSubfeatureGroup[0] as any).belongs_to !== stepData.belongs_to) {
            // Start new subfeature group
            if (currentSubfeatureGroup.length > 0) {
              // Add previous subfeature group as consolidated step
              const consolidatedStep = this.createConsolidatedSubfeatureStep(currentSubfeatureGroup);
              if (consolidatedStep) {
                consolidatedSteps.push(consolidatedStep);
              }
              currentSubfeatureGroup = [];
            }
          }
          currentSubfeatureGroup.push(step);
          currentSubfeatureId = stepData.belongs_to;
        } else {
          // This is a normal step
          if (currentSubfeatureGroup.length > 0) {
            // Add previous subfeature group as consolidated step
            const consolidatedStep = this.createConsolidatedSubfeatureStep(currentSubfeatureGroup);
            if (consolidatedStep) {
              consolidatedSteps.push(consolidatedStep);
            }
            currentSubfeatureGroup = [];
          }
          consolidatedSteps.push(step);
        }
      }
    }
    
    // Handle any remaining subfeature group
    if (currentSubfeatureGroup.length > 0) {
      const consolidatedStep = this.createConsolidatedSubfeatureStep(currentSubfeatureGroup);
      if (consolidatedStep) {
        consolidatedSteps.push(consolidatedStep);
      }
    }
    
    return consolidatedSteps;
  }

  // Helper method to create a consolidated subfeature step
  private createConsolidatedSubfeatureStep(subfeatureSteps: any[]): any {
    if (subfeatureSteps.length === 0) return null;
    
    const firstStep = subfeatureSteps[0];
    const featureId = firstStep.belongs_to;
    
    // Create a consolidated step that represents the subfeature
    return {
      ...firstStep,
      step_content: `Run feature with id "${featureId}" before continuing`,
      step_action: `Run feature with id "${featureId}" before continuing`,
      step_keyword: 'Given',
      step_type: 'subfeature',
      enabled: subfeatureSteps.every(step => step.enabled),
      screenshot: subfeatureSteps.some(step => step.screenshot),
      compare: subfeatureSteps.some(step => step.compare),
      continue_on_failure: subfeatureSteps.some(step => step.continue_on_failure),
      timeout: Math.max(...subfeatureSteps.map(step => step.timeout || 60)),
      selected: subfeatureSteps.some(step => step.selected),
      belongs_to: this.featureId, // Mark as belonging to current feature
      subfeature_id: featureId,
      subfeature_steps_count: subfeatureSteps.length,
      is_consolidated: true
    };
  }

  // Override the existing method to use consolidated steps
  getSelectedBackupSteps(): FeatureHistoryStep[] {
    if (this.selectedBackupIds.size === 0) return [];
    const selectedBackupId = Array.from(this.selectedBackupIds)[0];
    const selectedEntry = this.history.find(entry => entry.backup_id === selectedBackupId);
    
    if (selectedEntry && selectedEntry.steps) {
      // Consolidate subfeature steps before returning
      return this.consolidateSubfeatureSteps(selectedEntry.steps, this.featureId);
    }
    
    return [];
  }

  // Method to get consolidated steps for a specific backup ID (used by template)
  getConsolidatedStepsForBackup(backupId: string): any[] {
    const backupEntry = this.history.find(entry => entry.backup_id === backupId);
    if (backupEntry && backupEntry.steps) {
      const consolidated = this.consolidateSubfeatureSteps(backupEntry.steps, this.featureId);
      return consolidated;
    }
    return [];
  }

  // Method to get consolidated step count for a specific backup ID (used by template)
  getConsolidatedStepCount(backupId: string): number {
    const backupEntry = this.history.find(entry => entry.backup_id === backupId);
    if (!backupEntry || !backupEntry.steps) return 0;
    
    // Get the actual steps from the backup
    const backupSteps = this.getBackupSteps(backupEntry);
    if (backupSteps.length === 0) return 0;
    
    let normalStepCount = 0;
    let subfeatureCount = 0;
    const seenSubfeatures = new Set<number>();
    
    // Count normal steps and unique subfeatures
    for (const step of backupSteps) {
      if (step.belongs_to === this.featureId || !step.belongs_to) {
        // This is a normal step (belongs to current feature or no belongs_to)
        normalStepCount++;
      } else {
        // This is a subfeature step
        if (!seenSubfeatures.has(step.belongs_to)) {
          subfeatureCount++;
          seenSubfeatures.add(step.belongs_to);
        }
      }
    }
    
    const totalCount = normalStepCount + subfeatureCount;
    return totalCount;
  }

  // Enhanced step formatting for consolidated subfeature steps
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
        
        // Check if this contains consolidated subfeature steps
        const hasConsolidatedSteps = stepData.some(s => s.is_consolidated);
        if (hasConsolidatedSteps) {
          const normalSteps = stepData.filter(s => !s.is_consolidated).length;
          const subfeatureSteps = stepData.filter(s => s.is_consolidated).length;
          return `Backup: ${step.step_file || 'Unknown file'} - ${normalSteps} steps + ${subfeatureSteps} subfeatures`;
        }
        
        // Return a clear summary with backup ID and step count
        const filename = step.step_file || 'Unknown file';
        return `Backup: ${filename} - ${stepData.length} steps`;
      }

      // Handle single step object
      if (typeof stepData === 'object') {
        if (stepData.step_type === 'subfeature') {
          return `${stepData.step_content}`;
        }
        
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

  formatIndividualStep(individualStep: any): string {
    return `${individualStep.step_content}`;  
  }

  // Enhanced step flags for consolidated steps
  getIndividualStepFlags(individualStep: any): { label: string; value: boolean; color: string }[] {
    try {
      if (!individualStep || typeof individualStep !== 'object') {
        return [];
      }

      // Special handling for consolidated subfeature steps
      if (individualStep.is_consolidated) {
        const flags = [
          { key: 'screenshot', label: 'Screenshot', color: 'accent', showWhen: true },
          { key: 'compare', label: 'Compare', color: 'warn', showWhen: true },
          { key: 'continue_on_failure', label: 'Continue on Failure', color: 'warn', showWhen: true },
          { key: 'selected', label: 'Selected', color: 'primary', showWhen: true }
        ];

        const result = [];
                
        // Add other flags that are true
        for (const flag of flags) {
          if (individualStep[flag.key] === flag.showWhen) {
            result.push({ label: flag.label, value: true, color: flag.color });
          }
        }
        
        return result;
      }

      // Original logic for normal steps
      const flags = [
        { key: 'screenshot', label: 'Screenshot', color: 'accent', showWhen: true },
        { key: 'compare', label: 'Compare', color: 'warn', showWhen: true },
        { key: 'continue_on_failure', label: 'Continue on Failure', color: 'warn', showWhen: true },
        { key: 'selected', label: 'Selected', color: 'primary', showWhen: true }
      ];

      const result = [];
      
      
      // Add other flags that are true
      for (const flag of flags) {
        if (individualStep[flag.key] === flag.showWhen) {
          result.push({ label: flag.label, value: true, color: flag.color });
        }
      }
      
      return result;
    } catch (error) {
      return [];
    }
  }

  getStepFlags(step: FeatureHistoryStep): { label: string; value: boolean; color: string }[] {
    try {
      const stepData = step.step_content;
      
      if (!stepData || typeof stepData !== 'object') {
        return [];
      }

      const flags = [
        { key: 'screenshot', label: 'Screenshot', color: 'accent', showWhen: true },
        { key: 'compare', label: 'Compare', color: 'warn', showWhen: true },
        { key: 'continue_on_failure', label: 'Continue on Failure', color: 'warn', showWhen: true },
        { key: 'selected', label: 'Selected', color: 'primary', showWhen: true }
      ];

      const result = [];
      
      // Always add enabled/disabled status first
      if (stepData.enabled === true) {
        result.push({ label: 'Enabled', value: true, color: 'primary' });
      } else if (stepData.enabled === false) {
        result.push({ label: 'Disabled', value: true, color: 'disabled' });
      }
      
      // Add other flags that are true
      for (const flag of flags) {
        if (stepData[flag.key] === flag.showWhen) {
          result.push({ label: flag.label, value: true, color: flag.color });
        }
      }
      
      return result;
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
      case 'Disabled': return 'cancel';
      case 'Screenshot': return 'photo_camera';
      case 'Compare': return 'compare';
      case 'Continue on Failure': return 'error_outline';
      case 'Selected': return 'star';
      default: return 'info';
    }
  }

  // Helper method to parse backup filename timestamp format (YYYY-MM-DD_HH-MM-SS)
  parseBackupTimestamp(timestamp: string): Date {
    try {
      // Handle the format: "2025-08-12 11:37:42" (from backup filename)
      // Replace underscore with space to make it parseable
      const normalizedTimestamp = timestamp.replace('_', ' ');
      
      // Parse as UTC and convert to local timezone
      const utcDate = new Date(normalizedTimestamp + ' UTC');
      
      // Validate the parsed date
      if (isNaN(utcDate.getTime())) {
        throw new Error('Invalid date format');
      }
      
      return utcDate;
    } catch (error) {
      console.error(error);
      // Fallback: try to parse as regular date
      return new Date(timestamp);
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
      console.error(error);
      return timestamp; // Fallback to original timestamp if parsing fails
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
      console.error(error);
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
    
    const changes = this.compareFeatureVersions(backupEntry); 
    this.cachedChanges.set(backupId, changes);
    return changes;
  }
}