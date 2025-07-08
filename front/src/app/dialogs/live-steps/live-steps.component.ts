import {
  Component,
  Inject,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import {
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { ApiService } from '@services/api.service';
import { Store, Actions, ofActionCompleted, ofActionDispatched, ofActionSuccessful } from '@ngxs/store';
import { Subscribe } from 'app/custom-decorators';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import {
  distinctUntilKeyChanged,
  filter,
  map,
  shareReplay,
  tap,
  debounceTime,
} from 'rxjs/operators';
import {
  MatLegacyCheckboxChange as MatCheckboxChange,
  MatLegacyCheckboxModule,
} from '@angular/material/legacy-checkbox';
import { Observable, Subscription, Subject } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { WebSockets } from '@store/actions/results.actions';
import { StepDefinitions } from '@store/actions/step_definitions.actions';
import { DataDriven } from '@store/actions/datadriven.actions';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { getBrowserKey } from '@services/tools';
import { TranslateModule } from '@ngx-translate/core';
import { TestDurationPipe } from '../../pipes/test-duration.pipe';
import { BrowserComboTextPipe } from '../../pipes/browser-combo-text.pipe';
import { StoreSelectorPipe } from '../../pipes/store-selector.pipe';
import { BrowserResultStatusPipe } from '@pipes/browser-result-status.pipe';
import { BrowserIconPipe } from '@pipes/browser-icon.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { LiveStepComponent } from './live-step/live-step.component';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatIconModule } from '@angular/material/icon';
import { LetDirective } from '../../directives/ng-let.directive';
import { MatLegacyTabsModule } from '@angular/material/legacy-tabs';
import {
  NgIf,
  NgFor,
  NgSwitch,
  NgSwitchCase,
  NgTemplateOutlet,
  NgSwitchDefault,
  AsyncPipe,
  KeyValuePipe,
} from '@angular/common';

import { DraggableWindowModule } from '@modules/draggable-window.module';
import { color } from 'highcharts';
import { LogService } from '@services/log.service';
import { MatSelectModule } from '@angular/material/select';
import { MatBadgeModule } from '@angular/material/badge';

// Enhanced data interface for backward compatibility
interface LiveStepsDialogData {
  // Legacy single feature mode (maintains exact compatibility)
  feature_id?: number;
  
  // New DDT mode
  ddt_run_id?: number;
  ddt_features?: Array<{
    feature_id: number;
    feature_name: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    current_step?: string;
  }>;
  file_name?: string;
  
  // Mode detection
  mode: 'single-feature' | 'data-driven';
}

// Backward compatibility: still accepts plain number
type LiveStepsData = number | LiveStepsDialogData;

interface DDTFeature {
  feature_id: number;
  feature_name: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  current_step: string | null;
  running: boolean;
  success: boolean;
  date_time: string | null;
  execution_time: number;
}

@UntilDestroy()
@Component({
  selector: 'live-steps',
  templateUrl: './live-steps.component.html',
  styleUrls: ['./live-steps.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgIf,
    MatLegacyDialogModule,
    MatLegacyTabsModule,
    LetDirective,
    NgFor,
    MatIconModule,
    MatLegacyTooltipModule,
    NgSwitch,
    NgSwitchCase,
    MatLegacyProgressSpinnerModule,
    NgTemplateOutlet,
    NgSwitchDefault,
    LiveStepComponent,
    MatLegacyCheckboxModule,
    MatLegacyButtonModule,
    AsyncPipe,
    KeyValuePipe,
    AmParsePipe,
    BrowserIconPipe,
    BrowserResultStatusPipe,
    StoreSelectorPipe,
    BrowserComboTextPipe,
    TestDurationPipe,
    TranslateModule,
    DraggableWindowModule,
    MatSelectModule,
    MatBadgeModule
  ],
})
export class LiveStepsComponent implements OnInit, OnDestroy {
  // Legacy properties for backward compatibility
  results$: Observable<IResult>;
  lastFeatureRunID: any;
  status$: Observable<string>;
  feature$: Observable<Feature>;
  steps$: Observable<FeatureStep[]>;
  isLoading: boolean = false;
  canStop: boolean = false;

  // New properties for DDT mode
  public mode: 'single-feature' | 'data-driven' = 'single-feature';
  public currentFeatureId: number;
  public ddtRunId?: number;
  public ddtFeatures: DDTFeature[] = [];
  public fileName?: string;
  public showOverview: boolean = false;
  
  // Subscriptions for cleanup
  private webSocketSubscription?: Subscription;
  private featureSwitchTrigger = new Subject<void>();

  // Controls auto scroll
  autoScroll = localStorage.getItem('live_steps_auto_scroll') === 'true';

  constructor(
    private dialogRef: MatDialogRef<LiveStepsComponent>,
    @Inject(MAT_DIALOG_DATA) public data: LiveStepsData,
    private _store: Store,
    private _actions$: Actions,
    private _api: ApiService,
    private _snack: MatSnackBar,
    private logger: LogService,
    private snack: MatSnackBar,
    private _cdr: ChangeDetectorRef
  ) {
    // Initialize based on data type for backward compatibility
    this.initializeFromData();
  }

  private initializeFromData() {
    // BACKWARD COMPATIBILITY: Handle legacy number input
    if (typeof this.data === 'number') {
      this.mode = 'single-feature';
      this.currentFeatureId = this.data;
      this.feature_id = this.data; // Maintain legacy property
    } 
    // NEW: Handle enhanced object input
    else if (this.data.mode === 'single-feature') {
      this.mode = 'single-feature';
      this.currentFeatureId = this.data.feature_id!;
      this.feature_id = this.data.feature_id!; // Maintain legacy property
    }
    // NEW: Handle DDT mode
    else if (this.data.mode === 'data-driven') {
      this.mode = 'data-driven';
      this.ddtRunId = this.data.ddt_run_id!;
      // Convert simplified features to full DDTFeature objects
      this.ddtFeatures = (this.data.ddt_features || []).map(f => ({
        feature_id: f.feature_id,
        feature_name: f.feature_name,
        status: f.status,
        current_step: f.current_step || null,
        running: f.status === 'running',
        success: f.status === 'completed',
        date_time: null,
        execution_time: 0
      }));
      this.fileName = this.data.file_name;
      
      // Set current feature to first available or running feature
      if (this.ddtFeatures.length > 0) {
        const runningFeature = this.ddtFeatures.find(f => f.status === 'running');
        this.currentFeatureId = runningFeature ? runningFeature.feature_id : this.ddtFeatures[0].feature_id;
        this.feature_id = this.currentFeatureId; // Maintain legacy property
      }
    }

    // Setup legacy observables if we have a feature ID
    if (this.currentFeatureId) {
      this.setupLegacyObservables();
    }
  }

  private setupLegacyObservables() {
    this.status$ = this._store.select(
      CustomSelectors.GetFeatureStatus(this.currentFeatureId)
    );
    this.feature$ = this._store.select(
      CustomSelectors.GetFeatureInfo(this.currentFeatureId)
    );
    this.results$ = this._store.select(
      CustomSelectors.GetFeatureResults(this.currentFeatureId)
    );
    this.lastFeatureRunID = CustomSelectors.GetLastFeatureRunID(
      this.currentFeatureId
    );
  }

  // Add backward compatibility property
  public feature_id: number;

  // Cleanup old or unused runs info on close
  ngOnDestroy() {
    this.cleanupSubscriptions();
    if (this.feature_id) {
      this._store.dispatch(new WebSockets.CleanupFeatureResults(this.feature_id));
    }
  }

  private cleanupSubscriptions() {
    if (this.webSocketSubscription) {
      this.webSocketSubscription.unsubscribe();
    }
    this.featureSwitchTrigger.complete();
  }

  trackBrowserFn(index: any, item: any) {
    return item.key;
  }

  trackStepFn(index: any, item: any) {
    return item.id;
  }

  trackFeatureFn(index: any, item: any) {
    return item.feature_id;
  }

  mobiles = {}
  configuration_value_boolean: boolean = false;
  docker_kubernetes_name: string = ''

  disabledStatuses = [
    'Queued',
    'Feature Queued',
    'Initializing feature',
  ];
  

  ngOnInit() {
    // Initializing component in DDT mode
    
    this.loadConfigurations();
    
    if (this.mode === 'data-driven') {
      this.setupDataDrivenMode();
    } else {
      this.setupSingleFeatureMode();
    }
  }

  private loadConfigurations() {
    this._api.getCometaConfigurations().subscribe(res => {
      const config_feature_mobile = res.find((item: any) => item.configuration_name === 'COMETA_FEATURE_MOBILE_TEST_ENABLED');
      const config_docker_kubernetes_name = res.find((item: any) => item.configuration_name === 'COMETA_DEPLOYMENT_ENVIRONMENT');

      if (config_feature_mobile) {
        this.configuration_value_boolean = config_feature_mobile.configuration_value === 'True';
      } else {
        this.snack.open('COMETA_FEATURE_MOBILE_TEST_ENABLED configuration not found.', 'Close', { duration: 3000 });
      }

      if (config_docker_kubernetes_name) {
        this.docker_kubernetes_name = config_docker_kubernetes_name.configuration_value;
      } else {
        this.snack.open('COMETA_DEPLOYMENT_ENVIRONMENT configuration not found.', 'Close', { duration: 3000 });
      }
    });
  }

  private setupSingleFeatureMode() {
    this.setupFeatureSubscriptions();
    this.setupAutoScroll();
  }

  private setupDataDrivenMode() {
    // Setup pure WebSocket routing for real-time DDT updates
    this.setupDDTWebSocketRouting();
    
    // Setup debounced feature switching
    this.setupFeatureSwitchTrigger();

    // Setup subscriptions for current feature
    this.setupFeatureSubscriptions();
    this.setupAutoScroll();
    
    // Initial feature switch check
    this.featureSwitchTrigger.next();
  }

  private setupFeatureSubscriptions() {
    if (!this.currentFeatureId) return;

    // Grab the steps of the feature
    this.steps$ = this._store
      .select(
        CustomSelectors.GetFeatureSteps(this.currentFeatureId, 'edit', false, true)
      )
      .pipe(
        // CustomSelectors.GetFeatureSteps is taxing
        // Therefore we need to share the result among all subscribers
        shareReplay({ bufferSize: 1, refCount: true })
      );
    
    this._store.dispatch(
      new StepDefinitions.GetStepsForFeature(this.currentFeatureId)
    );

    // Setup status monitoring
    this.status$.subscribe(status => {
      this.canStop = !this.disabledStatuses.includes(status);
      this._cdr.markForCheck();
    });
  }

  private setupAutoScroll() {
    // Scroll handler
    this._actions$
      .pipe(
        untilDestroyed(this), // Stop emitting events after LiveSteps is closed
        // Filter only by NGXS actions which trigger step index changing
        ofActionCompleted(WebSockets.StepStarted, WebSockets.StepFinished),
        map(event => event.action),
        // Enhanced filtering for both single feature and DDT modes
        filter(action => action.feature_id === this.currentFeatureId),
        distinctUntilKeyChanged('step_index'),
        // Switch current observable to scroll option value
        filter(_ => !!this.autoScroll)
        // Then filter stream by truthy values
      )
      .subscribe(action => {
        this.handleAutoScroll(action);
      });

      this.status$.subscribe(status => {
        this.canStop = !this.disabledStatuses.includes(status);
        this._cdr.markForCheck();
      });

  }

  live(feature_result_id: any) {
    let url;
    let window_name

    if(this.docker_kubernetes_name == "docker"){
      url = `/live-session/vnc.html?autoconnect=true&path=feature_result_id/${feature_result_id}`;
    }
    else if(this.docker_kubernetes_name == "kubernetes"){
      url = `/live-session/vnc.html?autoconnect=true&path=feature_result_id/${feature_result_id}&deployment=kubernetes`;
    }
    window_name = `cometa_vnc_${feature_result_id}`;
    window.open(url, window_name).focus();
  }

  noVNCMobile(selectedMobile: any) {
    let complete_url = `/live-session/vnc.html?autoconnect=true&path=mobile/${selectedMobile}`;
    window.open(complete_url, '_blank').focus();
  }


  showLiveIcon(browser: any) {
    // get data from browser
    const data = browser.value;
    // check if browser is not running on local cloud
    // if so we don't have access to live session
    if (data.browser_info.cloud != 'local') return false;
    // array of status on which not to show the live icon
    const notToShowOn = ['Queued', 'Initializing', 'Timeout', 'Completed'];
    return !notToShowOn.includes(data.status);
  }

  handleScrollChange({ checked }: MatCheckboxChange) {
    this.autoScroll = checked;
    localStorage.setItem('live_steps_auto_scroll', checked.toString());
  }

  updateMobile(data: any) {
    this.mobiles[data.feature_run_id] = data.mobiles_info;
  }

  // DDT-specific methods (polling methods removed - using pure WebSocket routing)


  // Enhanced stop test for DDT support
  stopTest() {
    this.isLoading = true;
    
    if (this.mode === 'data-driven' && this.ddtRunId) {
      // Stop entire DDT run - need to implement this API method
      this._api.stopDataDrivenTest(this.ddtRunId).subscribe(
        response => {
          this.isLoading = false;
          if (response.success) {
            this._snack.open('Data-driven test execution stopped', 'OK');
            this.dialogRef.close();
          } else {
            this._snack.open('Error stopping data-driven test execution', 'OK');
          }
        },
        error => {
          this.isLoading = false;
          this._snack.open('Error stopping data-driven test execution', 'OK');
        }
      );
    } else {
      // Stop single feature (original logic)
      this._api.stopRunningTask(this.feature_id).subscribe(
        response => {
          this.isLoading = false;
          if (response.success) {
            this._snack.open('Feature execution stopped', 'OK');
            this.dialogRef.close();
            // Get last runId
            const runId = this._store.selectSnapshot<number>(
              this.lastFeatureRunID
            );
            // Tell the store the run has finished with stopped event
            this._store.dispatch(
              new WebSockets.StoppedFeature(this.feature_id, runId)
            );
          } else {
            this._snack.open('Error stopping feature execution', 'OK');
          }
        },
        error => {
          this.isLoading = false;
          this._snack.open('Error stopping feature execution', 'OK');
        }
      );
    }
  }

  // DDT utility methods
  toggleOverview() {
    this.showOverview = !this.showOverview;
    this._cdr.markForCheck();
  }

  getFeatureStatusIcon(status: string): string {
    switch (status) {
      case 'running': return 'play_circle';
      case 'completed': return 'check_circle';
      case 'failed': return 'error';
      case 'queued': return 'schedule';
      default: return 'help';
    }
  }

  getFeatureStatusClass(status: string): string {
    switch (status) {
      case 'running': return 'status-running';
      case 'completed': return 'status-completed';
      case 'failed': return 'status-failed';
      case 'queued': return 'status-queued';
      default: return '';
    }
  }

  getCurrentFeatureName(): string {
    if (this.mode === 'single-feature') {
      return ''; // Will be filled by template binding
    } else {
      const currentFeature = this.ddtFeatures.find(f => f.feature_id === this.currentFeatureId);
      return currentFeature ? currentFeature.feature_name : 'Unknown Feature';
    }
  }

  getCompletedFeaturesCount(): number {
    return this.ddtFeatures.filter(f => f.status === 'completed').length;
  }

  getTotalFeaturesCount(): number {
    return this.ddtFeatures.length;
  }

  // ========================================
  // Enhanced WebSocket Routing for DDT
  // ========================================

  /**
   * Setup enhanced WebSocket routing for Data-Driven Tests.
   * Listens to both DDT-specific messages and regular feature WebSocket events.
   */
  private setupDDTWebSocketRouting() {
    if (!this.ddtRunId) return;

          // Setting up enhanced WebSocket routing for DDT run

    // Subscribe to DDT status updates (overall run progress)
    const ddtStatusSubscription = this._actions$
      .pipe(
        untilDestroyed(this),
        ofActionSuccessful(DataDriven.StatusUpdate),
        filter(action => action.run_id === this.ddtRunId)
      )
      .subscribe(action => {
        // DDT status update received
        this.handleDDTStatusUpdate(action);
        // When DDT is running, trigger feature switch check
        if (action.running) {
          this.featureSwitchTrigger.next();
        }
      });

    // Subscribe to regular feature WebSocket events (step-level tracking)
    const featureEventsSubscription = this._actions$
      .pipe(
        untilDestroyed(this),
        ofActionCompleted(
          WebSockets.StepStarted, 
          WebSockets.StepFinished,
          WebSockets.FeatureStarted,
          WebSockets.FeatureFinished
        ),
        filter(event => this.isDDTRelatedMessage(event.action))
      )
      .subscribe(event => {
        // Received feature WebSocket event for DDT
        this.handleFeatureWebSocketEvent(event.action);
      });

    // Combine both subscriptions for cleanup
    this.webSocketSubscription = new Subscription();
    this.webSocketSubscription.add(ddtStatusSubscription);
    this.webSocketSubscription.add(featureEventsSubscription);
  }

  /**
   * Check if a WebSocket message is related to our DDT run.
   * Uses intelligent filtering based on feature IDs and timing.
   */
  private isDDTRelatedMessage(action: any): boolean {
    // Primary check: Is this feature part of our DDT features list?
    if (this.ddtFeatures.some(f => f.feature_id === action.feature_id)) {
      return true;
    }

    // Secondary check: Is this the currently executing feature?
    if (action.feature_id === this.currentFeatureId) {
      return true;
    }

    // Tertiary check: DDT context in message (if backend sends it)
    if (action.ddt_run_id === this.ddtRunId) {
      return true;
    }

    return false;
  }

  /**
   * Handle DDT status updates (overall run progress).
   */
  private handleDDTStatusUpdate(action: DataDriven.StatusUpdate) {
    // Update overall DDT progress (handled by parent component)
    // Here we can add DDT-specific logic if needed
    // DDT run progress updated
  }

  /**
   * Setup debounced feature switching trigger to prevent too frequent API calls.
   */
  private setupFeatureSwitchTrigger() {
    this.featureSwitchTrigger
      .pipe(
        untilDestroyed(this),
        debounceTime(2000) // Wait 2 seconds after last trigger
      )
      .subscribe(() => {
        this.checkAndSwitchToCurrentFeature();
      });
  }

  /**
   * Check which feature is currently running and switch to it if different.
   */
  private checkAndSwitchToCurrentFeature() {
    if (!this.ddtRunId) return;

    this._api.getDDTCurrentlyRunningFeature(this.ddtRunId).subscribe(
      response => {
        if (response.success && response.current_feature) {
          const runningFeatureId = response.current_feature.feature_id;
          if (runningFeatureId !== this.currentFeatureId) {
            // Auto-switching to running feature
            this.switchToFeature(runningFeatureId);
          }
        }
      },
      error => {
        // Error checking current feature
      }
    );
  }

  /**
   * Handle regular feature WebSocket events for DDT features.
   * Automatically switches to the active feature.
   */
  private handleFeatureWebSocketEvent(action: any) {
    const actionFeatureId = action.feature_id;

    // Auto-switch to the feature that's currently active
    if (action.constructor.name === 'FeatureStarted' || action.constructor.name === 'StepStarted') {
      if (actionFeatureId !== this.currentFeatureId) {
        // Auto-switching to active feature
        this.switchToFeature(actionFeatureId);
      }
    }

    // Update feature status in DDT features list
    if (action.constructor.name === 'FeatureStarted') {
      this.updateDDTFeatureStatus(actionFeatureId, 'running');
    } else if (action.constructor.name === 'FeatureFinished') {
      const newStatus = action.success ? 'completed' : 'failed';
      this.updateDDTFeatureStatus(actionFeatureId, newStatus);
    }
  }

  /**
   * Update the status of a feature in the DDT features list.
   */
  private updateDDTFeatureStatus(featureId: number, status: 'queued' | 'running' | 'completed' | 'failed') {
    const featureIndex = this.ddtFeatures.findIndex(f => f.feature_id === featureId);
    if (featureIndex !== -1) {
      this.ddtFeatures[featureIndex] = {
        ...this.ddtFeatures[featureIndex],
        status: status,
        running: status === 'running',
        success: status === 'completed'
      };
      this._cdr.markForCheck();
      // Updated feature status in DDT
    }
  }

  /**
   * Enhanced switchToFeature method with DDT support.
   */
  private switchToFeature(newFeatureId: number) {
    if (this.currentFeatureId !== newFeatureId) {
      // Switching between DDT features
      this.currentFeatureId = newFeatureId;
      this.feature_id = newFeatureId; // Update legacy property
      
      // Update DDT features list status
      this.updateDDTFeatureStatus(newFeatureId, 'running');
      
      this.setupLegacyObservables();
      this.setupFeatureSubscriptions();
      this._cdr.markForCheck();
    }
  }

  /**
   * Handle auto-scroll functionality for step navigation.
   */
  private handleAutoScroll(action: any) {
    const index = action.step_index;
    const browser = getBrowserKey(action.browser_info);
    const steps = document.querySelector(
      `.steps-container[browser="${browser}"]`
    );
    if (steps) {
      // Browser result of current WebSocket is visible
      let runningElement = steps.querySelectorAll('cometa-live-step');
      if (runningElement.length > 0) {
        // Current view has steps visible
        if (runningElement[index]) {
          // Running step exists
          runningElement[index].scrollIntoView({
            block: 'center',
            behavior: 'smooth',
          });
        }
      }
    }
  }

}
