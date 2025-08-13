/**
 * l1-feature-item-list.component.ts
 *
 * Contains the code to control the behaviour of the item list (each feature is a squared item) in the new landing
 *
 * @author dph000
 * 
 * FIXES APPLIED FOR STEP DUPLICATION ISSUE:
 * 
 * 1. IMPLEMENTED DATA VALIDATION:
 *    - Added hasValidFeatureData() method to check if feature already has valid data
 *    - Added isCachedDataReasonable() method to validate cached data before applying
 *    - Added data corruption detection in updateFeatureStatusFromResult()
 * 
 * 2. PREVENTED UNNECESSARY API CALLS:
 *    - Modified setupHeavyObservables() to skip API calls when valid data exists
 *    - Added throttling to prevent rapid successive API calls (5 second minimum interval)
 *    - Only make API calls when feature is running or when data is actually needed
 * 
 * 3. IMPROVED CACHE MANAGEMENT:
 *    - Added clearCorruptedCache() method to remove corrupted data from cache
 *    - Enhanced cache validation before storing and retrieving data
 *    - Added forceCacheCleanup() method for manual cache maintenance
 * 
 * 4. REAL-TIME DATA CORRECTION:
 *    - Added detectAndCorrectDuplicatedData() method to fix corrupted data on initialization
 *    - Added forceDataRefresh() method to clean cache and force fresh data when problems detected
 *    - Implemented automatic correction of excessive step counts (>1000) and execution times (>3600s)
 * 
 * 5. ENHANCED ERROR HANDLING:
 *    - Added comprehensive logging for all data operations
 *    - Implemented graceful fallbacks when data corruption is detected
 *    - Added safety checks throughout the data flow
 * 
 * 6. IMPROVED MOBILE AND TABLET BROWSER SUPPORT:
 *    - Added BrowserIconPipe to properly display mobile/tablet browser icons
 *    - Enhanced getUniqueBrowsersEnhanced() method for better mobile device handling
 *    - Added isMobileOrTablet() and getDeviceInfo() methods for device detection
 *    - Improved tooltips to show device information for mobile browsers
 *    - Enhanced CSS styles for consistent mobile browser icon display
 * 
 * 7. ENHANCED BROWSER VERSION CHECKING:
 *    - Improved shouldDisableRunButton() method to properly detect outdated browsers
 *    - Added isLocalBrowserOutdated() method for local Chrome version checking
 *    - Added isCloudBrowserOutdated() method for cloud browser validation
 *    - Added checkBrowserVersions() method for detailed browser status logging
 *    - Added getBrowserStatusInfo() method for comprehensive browser status tooltips
 *    - Enhanced browser loading and refresh mechanisms
 *    - Better handling of local vs cloud browser differences
 *    - Integrated both BrowserstackState and BrowsersState for complete browser coverage
 *    - Fixed issue where local browsers (like Chrome 85) were not being detected as outdated
 * 
 * These changes prevent the duplication of steps by ensuring that:
 * - Only valid, reasonable data is stored and displayed
 * - API calls are minimized and only made when necessary
 * - Corrupted or duplicated data is automatically detected and corrected
 * - Cache system maintains data integrity
 * - Mobile and tablet browsers are properly displayed with correct icons
 * - Outdated browser versions are properly detected and buttons disabled accordingly
 */
import { Component, OnInit, Input, ChangeDetectorRef, OnDestroy, TrackByFunction } from '@angular/core';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { BrowsersState } from '@store/browsers.state';
import { BrowserstackState } from '@store/browserstack.state';
import { Browserstack } from '@store/actions/browserstack.actions';
import { Browsers } from '@store/actions/browsers.actions';
import { Observable, switchMap, tap, map, filter, take, Subject, BehaviorSubject } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { observableLast, Subscribe } from 'ngx-amvara-toolbox';
import { NavigationService } from '@services/navigation.service';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { SharedActionsService } from '@services/shared-actions.service';
import { Features } from '@store/actions/features.actions';
import { AddFolderComponent } from '@dialogs/add-folder/add-folder.component';
import { ApiService } from '@services/api.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LogService } from '@services/log.service';
import { FeatureRunningPipe } from '../../pipes/feature-running.pipe';
import { DepartmentNamePipe } from '@pipes/department-name.pipe';
import { BrowserComboTextPipe } from '../../pipes/browser-combo-text.pipe';
import { BrowserIconPipe } from '@pipes/browser-icon.pipe';
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LetDirective } from '../../directives/ng-let.directive';
import {
  NgIf,
  NgFor,
  NgClass,
  NgSwitch,
  NgSwitchCase,
  AsyncPipe,
  LowerCasePipe,
} from '@angular/common';
import { StarredService } from '@services/starred.service';
import { shareReplay, distinctUntilChanged, debounceTime } from 'rxjs/operators';


@Component({
  selector: 'cometa-l1-feature-item-list',
  templateUrl: './l1-feature-item-list.component.html',
  styleUrls: ['./l1-feature-item-list.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    LetDirective,
    MatTooltipModule,
    NgClass,
    MatIconModule,
    StopPropagationDirective,
    MatProgressSpinnerModule,
    NgSwitch,
    NgSwitchCase,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatCheckboxModule,
    TranslateModule,
    AmParsePipe,
    AmDateFormatPipe,
    SecondsToHumanReadablePipe,
    BrowserComboTextPipe,
    BrowserIconPipe,
    DepartmentNamePipe,
    FeatureRunningPipe,
    AsyncPipe,
    LowerCasePipe,
  ],
})
export class L1FeatureItemListComponent implements OnInit, OnDestroy {
  // Static cache properties for shared caching across all instances
  static featureDataCache = new Map<number, CachedFeatureData>();
  static readonly CACHE_EXPIRATION_TIME = 10 * 60 * 1000; // 10 minutes
  static cacheInitialized = false;

  constructor(
    private _router: NavigationService,
    private _store: Store,
    public _sharedActions: SharedActionsService,
    private _dialog: MatDialog,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
    private log: LogService,
    private cdr: ChangeDetectorRef,
    private starredService: StarredService,
  ) {}

  // Receives the item from the parent component
  @Input() item: any;
  @ViewSelectSnapshot(UserState.GetPermission('create_feature'))
  canCreateFeature: boolean;
  @Input() feature_id: number;
  folderName: string | null = null;
  private hasHandledMouseOver = false;
  private hasHandledMouseOverFolder = false;
  private destroy$ = new Subject<void>();
  private isComponentActive = true; // Track if component is active
  private safetyTimeout: any; // Safety timeout for button re-enabling
  private initSafetyTimeout: any; // Initialization safety timeout
  finder: boolean = false;
  running: boolean = false;
  isButtonDisabled: boolean = false;
  running$: Observable<boolean>;
  private lastClickTime: number = 0;
  private readonly CLICK_DEBOUNCE_TIME: number = 1000; // 1 second debounce time

  // Observable properties
  feature$: Observable<Feature>;
  featureRunning$: Observable<boolean>;
  featureStatus$: Observable<string>;
  canEditFeature$: Observable<boolean>;
  canDeleteFeature$: Observable<boolean>;
  isAnyFeatureRunning$: Observable<boolean>;
  departmentFolders$: Observable<Folder[]>;
  isStarred$: Observable<boolean>;
  lastFeatureResult$: Observable<FeatureResult | IResult>;

  ngOnInit() {
    // Initialize cache if not already done
    if (!L1FeatureItemListComponent.cacheInitialized) {
      L1FeatureItemListComponent.initializeCache();
    }

    // Detect and correct any duplicated data first
    this.detectAndCorrectDuplicatedData();

    // Only apply cached data if we don't already have valid data
    // This prevents overwriting valid data with potentially stale cached data
    if (!this.item.total || !this.item.time || !this.item.date) {
      this.applyCachedData();
    } else {
      // If we have valid data, cache it for future use
      this.cacheFeatureData();
    }

    // Ensure browsers are loaded for button state checking
    this.ensureBrowsersLoaded();

    // Check browser versions after a short delay to ensure browsers are loaded
    setTimeout(() => {
      this.checkBrowserVersions();
      this.debugBrowserInfo(); // Add debug info
    }, 2000);

    // Setup observables
    this.setupEssentialObservables();
    this.setupDeferredObservables();
    
    // Setup intersection observer for lazy loading
    this.setupIntersectionObserver();

    // Set initial button state
    this.isButtonDisabled = false;
    this.running = false;

    // DEBUG: Check item.type
    console.log('DEBUG - item:', this.item);
    console.log('DEBUG - item.type:', this.item?.type);
  }

  private setupEssentialObservables() {
    // Essential observables that are always needed
    this.departmentFolders$ = this._store.select(
      CustomSelectors.GetDepartmentFolders()
    ).pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
      distinctUntilChanged()
    );
  }

  private setupDeferredObservables() {
    // Only set up heavy observables when component becomes active
    this.destroy$.subscribe(() => {
      // Clean up any existing subscriptions
    });

    // Watch for component activation to set up heavy observables
    const activationCheck = setInterval(() => {
      if (this.isComponentActive && !this.heavyObservablesSetup) {
        this.setupHeavyObservables();
        clearInterval(activationCheck);
      }
    }, 1000);

    // Clean up interval on destroy
    this.destroy$.subscribe(() => {
      clearInterval(activationCheck);
    });
  }

  private heavyObservablesSetup = false;

  private setupHeavyObservables() {
    if (this.heavyObservablesSetup) return;
    
    this.log.msg('1', `Setting up heavy observables for feature ${this.feature_id}`, 'feature-item-list');
    this.heavyObservablesSetup = true;

    // Define feature$ observable first
    this.feature$ = this._store.select(
      CustomSelectors.GetFeatureInfo(this.feature_id)
    ).pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
      distinctUntilChanged()
    );

    // Basic feature status without heavy processing
    this.featureStatus$ = this._store.select(
      CustomSelectors.GetFeatureStatus(this.feature_id)
    ).pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // Subscribe to the status message coming from NGXS with optimization
    this.featureStatus$.pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
      filter(() => this.isComponentActive), // Only process if component is active
      tap(status => {
        // Only handle execution status updates, not final result status
        // Final status should come from the API results, not from this observable
        if (status && ['running', 'pending', 'executing'].includes(status.toLowerCase())) {
          // Update running state for execution status
          this.running = true;
          this.isButtonDisabled = true;
        } else if (status && ['completed', 'stopped'].includes(status.toLowerCase())) {
          // When execution completes, trigger API call to get real result status
          this.isButtonDisabled = false;
          this.running = false;
          
          // Only refresh if we don't have valid data to prevent duplication
          if (!this.hasValidFeatureData()) {
            this.forceUpdateFeatureStatus();
          }
        }
        
        // Additional check: if status indicates feature is not running, ensure button is enabled
        if (status && !['running', 'pending', 'executing'].includes(status.toLowerCase()) && this.isButtonDisabled) {
          this.isButtonDisabled = false;
          this.running = false;
          this.cdr.detectChanges();
        }
      })
    ).subscribe();

    // Subscribe to feature updates to refresh the item data with optimization
    this.feature$.pipe(
      distinctUntilChanged(),
      take(1), // Only take the first emission to avoid repeated API calls
      filter(() => this.isComponentActive) // Only execute if component is active
    ).subscribe(feature => {
      // Use smart data refresh to determine if refresh is needed
      if (!this.smartDataRefresh()) {
        return;
      }

      // Only make API call if we don't have valid data and the feature is not running
      if (!this.running && !this.hasValidFeatureData()) {
        this.log.msg('1', `Feature ${this.feature_id} needs data refresh, making API call`, 'feature-item-list');
        this.refreshFeatureResults();
      }
    });

    // Optimize feature running status with proper stream management
    this.featureRunning$ = this._store.select(
      CustomSelectors.GetFeatureRunningStatus(this.feature_id)
    ).pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
      filter(() => this.isComponentActive), // Only process if component is active
      tap(running => {
        // Only update if the running state actually changed
        if (this.running !== running) {
          this.running = running;
          
          // Re-enable button when feature stops running
          if (!running) {
            this.isButtonDisabled = false;
          }
          
          // Only trigger change detection if component is visible
          if (this.isComponentActive) {
            // Debounce change detection to prevent rapid updates
            setTimeout(() => {
              if (this.isComponentActive) {
                this.cdr.detectChanges();
              }
            }, 100);
          }
        }
        
        // Additional safety check: if feature is not running, ensure button is enabled
        if (!running && this.isButtonDisabled) {
          this.isButtonDisabled = false;
        }
        
        // When feature stops running, refresh the results to get the real status
        // Only if we don't already have valid data to prevent duplication
        if (!running && this.running && !this.hasValidFeatureData()) {
          // Use smart data refresh to determine if refresh is needed
          if (!this.smartDataRefresh()) {
            return;
          }
          
          // Feature just stopped running, refresh results to get real status
          setTimeout(() => {
            if (this.isComponentActive && !this.hasValidFeatureData()) {
              this.forceUpdateFeatureStatus();
            }
          }, 1000); // Wait 1 second for the backend to update the results
          
          // Also check for completion after a longer delay
          setTimeout(() => {
            if (this.isComponentActive && !this.hasValidFeatureData()) {
              this.checkAndUpdateFeatureCompletion();
            }
          }, 3000); // Wait 3 seconds for backend to fully update
        }
      })
    );
    
    // Subscribe to the featureRunning$ observable to activate it
    this.featureRunning$.subscribe();
    
    // Safety timeout: if button is disabled for more than 30 seconds, force re-enable it
    this.safetyTimeout = setTimeout(() => {
      if (this.isButtonDisabled && !this.running && this.isComponentActive) {
        this.forceReenableButton();
      }
    }, 30000);

    // Optimize permission selectors
    this.canEditFeature$ = this._store.select(
      CustomSelectors.HasPermission('edit_feature', this.feature_id)
    ).pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    
    this.canDeleteFeature$ = this._store.select(
      CustomSelectors.HasPermission('delete_feature', this.feature_id)
    ).pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // Optimize other observables
    this.isAnyFeatureRunning$ = new BehaviorSubject<boolean>(false).asObservable();

    // Set up filter state subscription with safety check
    if (this._sharedActions && this._sharedActions.filterState$) {
      this._sharedActions.filterState$.pipe(
        distinctUntilChanged(),
        shareReplay({ bufferSize: 1, refCount: true })
      ).subscribe(isActive => {
        this.finder = isActive;
      });
    }

    this.isStarred$ = this.starredService.isStarred(this.feature_id).pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.lastFeatureResult$ = this._store.select(CustomSelectors.GetFeatureResults(this.feature_id)).pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  ngOnDestroy() {
    this.isComponentActive = false;
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clear any pending timeouts
    if (this.safetyTimeout) {
      clearTimeout(this.safetyTimeout);
    }
    if (this.initSafetyTimeout) {
      clearTimeout(this.initSafetyTimeout);
    }
  }

  /**
   * Check if the feature already has valid data to prevent unnecessary API calls
   */
  private hasValidFeatureData(): boolean {
    // Check if we have all the required data fields
    const hasRequiredData = this.item.total && 
                           this.item.total > 0 && 
                           this.item.time && 
                           this.item.time > 0 && 
                           this.item.date;
    
    // Check if we have cached data
    const hasCachedData = this.item._hasCachedData;
    
    // Check if the data seems reasonable (not duplicated or corrupted)
    const hasReasonableData = this.item.total <= 1000 && // Reasonable step count
                              this.item.time <= 3600; // Reasonable execution time (1 hour max)
    
    return hasRequiredData && hasCachedData && hasReasonableData;
  }

  /**
   * Check if there are perceptible data changes that warrant a reload
   * This prevents unnecessary API calls when data hasn't meaningfully changed
   */
  private hasPerceptibleDataChanges(newData: any): boolean {
    if (!newData) return false;
    
    // Check if we have existing data to compare against
    if (!this.item.total && !this.item.time && !this.item.date) {
      // No existing data, so any new data is perceptible
      return true;
    }
    
    // Define thresholds for what constitutes a "perceptible" change
    const TOTAL_STEPS_THRESHOLD = 1; // 1 step difference is perceptible
    const EXECUTION_TIME_THRESHOLD = 1; // 1 second difference is perceptible
    const STATUS_CHANGE_THRESHOLD = true; // Any status change is perceptible
    const DATE_CHANGE_THRESHOLD = 60; // 1 minute difference is perceptible (in seconds)
    
    let hasPerceptibleChanges = false;
    
    // Check total steps change
    if (newData.total !== undefined && this.item.total !== undefined) {
      const stepDifference = Math.abs(newData.total - this.item.total);
      if (stepDifference >= TOTAL_STEPS_THRESHOLD) {
        this.log.msg('1', `Feature ${this.feature_id} has perceptible step change: ${this.item.total} -> ${newData.total} (diff: ${stepDifference})`, 'feature-item-list');
        hasPerceptibleChanges = true;
      }
    }
    
    // Check execution time change
    if (newData.execution_time !== undefined && this.item.time !== undefined) {
      const timeDifference = Math.abs(newData.execution_time - this.item.time);
      if (timeDifference >= EXECUTION_TIME_THRESHOLD) {
        this.log.msg('1', `Feature ${this.feature_id} has perceptible time change: ${this.item.time} -> ${newData.execution_time} (diff: ${timeDifference}s)`, 'feature-item-list');
        hasPerceptibleChanges = true;
      }
    }
    
    // Check status change
    if (newData.status && this.item.status && newData.status !== this.item.status) {
      this.log.msg('1', `Feature ${this.feature_id} has perceptible status change: ${this.item.status} -> ${newData.status}`, 'feature-item-list');
      hasPerceptibleChanges = true;
    }
    
    // Check date change (only if dates are significantly different)
    if (newData.result_date && this.item.date) {
      const currentDate = new Date(this.item.date).getTime();
      const newDate = new Date(newData.result_date).getTime();
      const dateDifference = Math.abs(newDate - currentDate) / 1000; // Convert to seconds
      
      if (dateDifference >= DATE_CHANGE_THRESHOLD) {
        this.log.msg('1', `Feature ${this.feature_id} has perceptible date change: ${this.item.date} -> ${newData.result_date} (diff: ${Math.round(dateDifference)}s)`, 'feature-item-list');
        hasPerceptibleChanges = true;
      }
    }
    
    // Check if new data has values we don't have (always perceptible)
    if (newData.total && !this.item.total) {
      this.log.msg('1', `Feature ${this.feature_id} has new total steps data: ${newData.total}`, 'feature-item-list');
      hasPerceptibleChanges = true;
    }
    
    if (newData.execution_time && !this.item.time) {
      this.log.msg('1', `Feature ${this.feature_id} has new execution time data: ${newData.execution_time}`, 'feature-item-list');
      hasPerceptibleChanges = true;
    }
    
    if (newData.result_date && !this.item.date) {
      this.log.msg('1', `Feature ${this.feature_id} has new result date data: ${newData.result_date}`, 'feature-item-list');
      hasPerceptibleChanges = true;
    }
    
    if (!hasPerceptibleChanges) {
      this.log.msg('1', `Feature ${this.feature_id} has no perceptible data changes, skipping reload`, 'feature-item-list');
    }
    
    return hasPerceptibleChanges;
  }

  /**
   * Force re-enable button - useful for debugging or edge cases
   */
  forceReenableButton() {
    this.isButtonDisabled = false;
    this.running = false;
    this.cdr.detectChanges();
  }

  /**
   * Refresh feature results from API to get the real status
   */
  private refreshFeatureResults() {
    // Use smart data refresh to determine if refresh is needed
    if (!this.smartDataRefresh()) {
      return;
    }
    
    // Mark the time of this API call
    this.item._lastApiCall = Date.now();
    this.item._lastDataCheck = Date.now();
    
    this._api.getFeatureResultsByFeatureId(this.feature_id, {
      archived: false,
      page: 1,
      size: 1,
    }).subscribe({
      next: (response: any) => {
        if (response && response.results && response.results.length > 0 && this.isComponentActive) {
          const latestResult = response.results[0];
          
          // Use the new method to update feature status from result
          this.updateFeatureStatusFromResult(latestResult);
        }
      },
      error: (err) => {
        if (this.isComponentActive) {
          console.error('Error refreshing feature results:', err);
        }
      }
    });
  }

  /**
   * Force update feature status from API
   */
  private forceUpdateFeatureStatus() {
    // Use smart data refresh to determine if update is needed
    if (!this.smartDataRefresh()) {
      return;
    }
    
    // Mark the time of this API call
    this.item._lastApiCall = Date.now();
    this.item._lastDataCheck = Date.now();
    
    // Dispatch action to update feature data
    this._store.dispatch(new Features.UpdateFeature(this.feature_id));
    
    // Only refresh results from API if we don't have valid data
    if (!this.hasValidFeatureData()) {
      setTimeout(() => {
        if (this.isComponentActive && !this.hasValidFeatureData()) {
          this.refreshFeatureResults();
        }
      }, 500); // Wait 500ms for the store action to complete
    }
  }

  /**
   * Update feature status from the latest result
   */
  private updateFeatureStatusFromResult(result: any) {
    if (!result || !this.isComponentActive) return;
    
    // Check if there are perceptible data changes before updating
    if (!this.hasPerceptibleDataChanges(result)) {
      this.log.msg('1', `Feature ${this.feature_id} has no perceptible changes, skipping update`, 'feature-item-list');
      return;
    }
    
    // Validate that the result data is reasonable to prevent duplication
    if (result.total && (result.total <= 0 || result.total > 1000)) {
      this.log.msg('1', `Feature ${this.feature_id} has unreasonable total steps: ${result.total}, skipping update`, 'feature-item-list');
      return;
    }
    
    if (result.execution_time && (result.execution_time < 0 || result.execution_time > 3600)) {
      this.log.msg('1', `Feature ${this.feature_id} has unreasonable execution time: ${result.execution_time}, skipping update`, 'feature-item-list');
      return;
    }
    
    // Check if the new data is actually different from current data
    const hasChanges = (result.total !== undefined && this.item.total !== result.total) ||
                       (result.execution_time !== undefined && this.item.time !== result.execution_time) ||
                       (result.result_date !== undefined && this.item.date !== result.result_date) ||
                       (result.status && this.item.status !== result.status);
    
    if (!hasChanges) {
      this.log.msg('1', `Feature ${this.feature_id} data unchanged, skipping update`, 'feature-item-list');
      return;
    }
    
    // Update the item with the latest feature result information
    // Only update if the value is different to prevent duplication
    if (result.total !== undefined && this.item.total !== result.total) {
      this.item.total = result.total;
      this.log.msg('1', `Feature ${this.feature_id} total steps updated: ${result.total}`, 'feature-item-list');
    }
    if (result.execution_time !== undefined && this.item.time !== result.execution_time) {
      this.item.time = result.execution_time;
      this.log.msg('1', `Feature ${this.feature_id} execution time updated: ${result.execution_time}`, 'feature-item-list');
    }
    if (result.result_date !== undefined && this.item.date !== result.result_date) {
      this.item.date = result.result_date;
      this.log.msg('1', `Feature ${this.feature_id} result date updated: ${result.result_date}`, 'feature-item-list');
    }
    
    // Update the status with the real result status from the API
    if (result.status && this.item.status !== result.status) {
      this.item.status = result.status;
      this.log.msg('1', `Feature ${this.feature_id} status updated: ${result.status}`, 'feature-item-list');
    }
    
    // Mark that we have valid data
    this.item._hasCachedData = true;
    
    // Cache the updated data
    this.cacheFeatureData();
    
    // Trigger change detection
    this.cdr.detectChanges();
  }

  /**
   * Check if feature has completed and update status accordingly
   */
  private checkAndUpdateFeatureCompletion() {
    if (!this.isComponentActive) return;
    
    // If feature is not running and we don't have a status, try to get it
    // Only if we don't already have valid data to prevent duplication
    if (!this.running && !this.hasValidFeatureData() && 
        (!this.item.status || this.item.status === 'running' || this.item.status === 'pending')) {
      this.forceUpdateFeatureStatus();
    }
  }

  /**
   * Force refresh feature status when needed
   */
  public refreshFeatureStatus() {
    if (!this.isComponentActive) return;
    
    this.forceUpdateFeatureStatus();
  }

  private setupIntersectionObserver() {
    // Only set up observer if IntersectionObserver is supported
    if ('IntersectionObserver' in window) {
      let activationTimeout: any;
      let deactivationTimeout: any;
      
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              // Clear any pending deactivation
              if (deactivationTimeout) {
                clearTimeout(deactivationTimeout);
                deactivationTimeout = null;
              }
              
              // Activate component after a short delay to prevent rapid toggling
              if (!this.isComponentActive) {
                activationTimeout = setTimeout(() => {
                  if (this.isComponentActive === false) {
                    this.isComponentActive = true;
                    this.log.msg('1', `Component ${this.feature_id} activated`, 'feature-item-list');
                    
                    // Set up deferred observables when component becomes active
                    this.setupDeferredObservables();
                  }
                }, 200);
              }
            } else {
              // Clear any pending activation
              if (activationTimeout) {
                clearTimeout(activationTimeout);
                activationTimeout = null;
              }
              
              // Deactivate component after a delay to prevent rapid toggling
              if (this.isComponentActive) {
                deactivationTimeout = setTimeout(() => {
                  if (this.isComponentActive === true) {
                    this.isComponentActive = false;
                    this.log.msg('1', `Component ${this.feature_id} deactivated`, 'feature-item-list');
                  }
                }, 500);
              }
            }
          });
        },
        { 
          threshold: 0.1, // Trigger when 10% of component is visible
          rootMargin: '50px' // Add margin to prevent edge cases
        }
      );

      // Observe the component element
      const element = document.querySelector(`[data-feature-id="${this.feature_id}"]`);
      if (element) {
        observer.observe(element);
      }

      // Clean up observer and timeouts on destroy
      this.destroy$.subscribe(() => {
        if (activationTimeout) clearTimeout(activationTimeout);
        if (deactivationTimeout) clearTimeout(deactivationTimeout);
        observer.disconnect();
      });
    }
  }

  async goLastRun() {
    const feature = await observableLast<Feature>(this.feature$);
    this._router.navigate(
      [
        `/${feature.info.app_name}`,
        feature.info.environment_name,
        feature.info.feature_id,
        'step',
        feature.info.feature_result_id,
      ],
      {
        queryParams: {
          runNow: 1,
        },
      }
    );
  }

  /**
   * Folder control functions
   */

  // Go to the clicked folder
  goFolder(route: Folder[]) {
    this.log.msg('1', 'Opening folder...', 'feature-item-list', route);
    // dispach the route of clicked folder
    this._store.dispatch(new Features.SetFolderRoute(route));

    // get absolute path of current route, including department
    const currentRoute = this._store.snapshot().features.currentRouteNew;

    // add clicked folder's id hierarchy to url params
    this._sharedActions.set_url_folder_params(currentRoute);
  }

  // Modify the clicked folder
  modify(folder: Folder) {
    this._dialog.open(AddFolderComponent, {
      autoFocus: true,
      data: {
        mode: 'edit',
        folder: folder,
        featureId: this.item.id
      } as IEditFolder,
    });
  }

  // Delete the clicked folder
  @Subscribe()
  delete(folder: Folder) {
    this.log.msg('1', 'Deleting folder...', 'feature-item-list', folder);
    return this._api.removeFolder(folder.folder_id).pipe(
      switchMap(_ => this._store.dispatch(new Features.GetFolders())),
      tap(_ => this._snackBar.open(`Folder ${folder.name} removed`, 'OK'))
    );
  }

  // Moves the selected folder
  SAmoveFolder(folder: Folder) {
    this.log.msg('1', 'Moving folder...', 'feature-item-list', folder);
    this._sharedActions.moveFolder(folder);
  }

  // Moves the selected feature
  SAmoveFeature(feature: Feature) {
    this.log.msg('1', 'Moving feature...', 'feature-item-list', feature);
    this._sharedActions.moveFeature(feature);
  }

  handleMouseOver(event: MouseEvent): void {
    if (this.hasHandledMouseOver) {
      return;
    }
    this.hasHandledMouseOver = true;
    this.featuresGoToFolder(this.item.id, '', false);
  }

  handleMouseOverFolder(event: MouseEvent): void {
    if (this.hasHandledMouseOverFolder) {
      return;
    }
    this.hasHandledMouseOverFolder = true;
    this.folderGoToFolder(this.item.id, false);
  }

  folderGoToFolder(folder_id: number, folderNameBoolean: boolean){
    this.departmentFolders$.subscribe(
      alldepartments => {
        const { result, folderName, foldersToOpen } = this.findFolderAndNavigate(alldepartments, folder_id, '', folderNameBoolean);

        if (result && folderNameBoolean) {
          this.openFolderInLocalStorage(foldersToOpen);
          const url = `/new/${result}`;
          this._router.navigate([url]);
        }
      },
      error => {
        console.error("Error obtaining Departments:", error);
       }
    );
  }

  findFolderAndNavigate(departments: any[], folder_id: number, path: string, folderNameBoolean): { result: string | null, folderName: string | null, foldersToOpen: string[] } {
    for (const department of departments) {
      for (const folder of department.folders) {

        if (folder.folder_id === folder_id) {
          const finalFolderName = folderNameBoolean ? folder.name : department.name;
          if(!folderNameBoolean){
            this.folderName = department.name;
          }
          return { result: `:${department.folder_id}`, folderName: finalFolderName,  foldersToOpen: [department.name, folder.name] };
        }

        const { result, folderName, foldersToOpen } = this.processFolder(folder, folder_id, path, folder.name, department.folder_id);
        if (result) {
          return { result, folderName, foldersToOpen: [this.item.department, ...foldersToOpen] };
        }
      }
    }
    return { result: null, folderName: null, foldersToOpen: [] };
  }

  processFolder(folder: any, folder_id: number, path: string, parentFolderName: string, department_id: number ): { result: string | null, folderName: string | null, foldersToOpen: string[] } {

    if (folder.folder_id === folder_id) {
      this.folderName = parentFolderName;
      return { result: `${path}:${folder.folder_id}`, folderName: parentFolderName,foldersToOpen: [folder.name]  };
    }

    for (const subfolder of folder.folders) {
      const resultPath = `${path}:${folder.folder_id}`;
      const { result, folderName, foldersToOpen } = this.processFolder(subfolder, folder_id, resultPath, folder.name, department_id);
      if (result) {
        return { result, folderName, foldersToOpen: [folder.name, ...foldersToOpen] };
      }
    }
    return { result: null, folderName: null, foldersToOpen: []  };
  }


  goToDomain(department_id: number) {
    department_id = this.item.reference.department_id;
    const url = `/new/${department_id}`;
    this._router.navigate([url]);
  }


  featuresGoToFolder(feature_id: number, path = '', folderNameBoolean: boolean): void {
    const department_id = this.item.reference.department_id;
    path += `:${department_id}`;

    this.departmentFolders$.subscribe(
      alldepartments => {
        const { result, folderName, foldersToOpen } = this.findAndNavigate(alldepartments, feature_id, path);
        if (result && folderNameBoolean) {
          this.openFolderInLocalStorage(foldersToOpen);
          const url = `/new/${result}`;
          this._router.navigate([url]);
        }
      },
      error => {
        console.error("Error obtaining Departments:", error);
      }
    );
  }

  findAndNavigate(departments: any[], feature_id: number, path: string): { result: string | null, folderName: string | null, foldersToOpen: string[] } {
    for (const department of departments) {
      for (const subfolder of department.folders) {
        const { result, folderName, foldersToOpen } = this.processSubfolder(subfolder, feature_id, path, subfolder.name);
        if (result) {
          return { result, folderName, foldersToOpen: [this.item.department, ...foldersToOpen] };
        }
      }
    }
    return { result: null, folderName: null, foldersToOpen: [] };
  }

  processSubfolder(folder: any, feature_id: number, path: string, feature_directory: string): { result: string | null, folderName: string | null, foldersToOpen: string[] } {

    if (folder.features.includes(feature_id)) {
      return { result: `${path}:${folder.folder_id}`, folderName: feature_directory,foldersToOpen: [folder.name] };
    }

    for (const subfolder of folder.folders) {
      const { result, folderName, foldersToOpen } = this.processSubfolder(subfolder, feature_id, path + `:${folder.folder_id}`, subfolder.name);
      if (result) {
        this.folderName = folderName;
        return { result, folderName, foldersToOpen: [folder.name, ...foldersToOpen] };
      }
    }
    return { result: null, folderName: null, foldersToOpen: [] };
  }

  openFolderInLocalStorage(foldersToOpen: string[]): void {
    const storedState = JSON.parse(localStorage.getItem('co_folderState')) || {};
    let stateUpdated = false;

    foldersToOpen.forEach(folder => {
      if (!storedState[folder]?.open) {
        storedState[folder] = { open: true };
        stateUpdated = true;
      }
    });

    if (stateUpdated) {
      localStorage.setItem('co_folderState', JSON.stringify(storedState));
    }
  }

  hovering = false;

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this._snackBar.open('ID copied to clipboard!', 'OK', { duration: 2000 });
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }

  async onRunClick() {
    // Prevent execution when browsers are outdated
    if (this.shouldDisableRunButton()) {
      this.log.msg('1', `Feature ${this.feature_id} run blocked due to outdated browsers`, 'feature-item-list');
      return;
    }

    const now = Date.now();
    const timeSinceLastClick = now - this.lastClickTime;

    // Prevent rapid clicks
    if (timeSinceLastClick < this.CLICK_DEBOUNCE_TIME) {
      return;
    }

    // Update the last click time
    this.lastClickTime = now;

    // Prevent clicks when button is disabled and feature is not running
    if (this.isButtonDisabled && !this.running) {
      return;
    }

    // Check if feature has browsers selected
    if (!this.item.browsers || this.item.browsers.length === 0) {
      this._snackBar.open("This feature doesn't have browsers selected.", 'OK');
      return;
    }

    // Disable button and show running state
    this.isButtonDisabled = true;
    this.cdr.detectChanges();

    try {
      await this._sharedActions.run(this.item.id);
      
      // The button will be re-enabled by the featureRunning$ observable
      // when the feature status changes to not running
    } catch (error) {
      // Re-enable button on error
      this.isButtonDisabled = false;
      this.running = false;
      this.cdr.detectChanges();
    }
  }

  toggleStarred(event: Event): void {
    event.stopPropagation();
    this.starredService.toggleStarred(this.feature_id);
    this.starredService.starredChanges$.pipe(
      filter(event => event?.featureId === this.feature_id),
      take(1)
    ).subscribe(event => {
      this._snackBar.open(
        event?.action === 'add' 
          ? `Feature ${this.item.id} (${this.item.name}) added to favorites` 
          : `Feature ${this.item.id} (${this.item.name}) removed from favorites`,
        'OK',
        { duration: 2000 }
      );
    });
  }

  /**
   * Clean cache and force data refresh when problems are detected
   */
  public forceDataRefresh(): void {
    this.log.msg('1', `Feature ${this.feature_id} forcing data refresh due to detected problems`, 'feature-item-list');
    
    // Clear any corrupted cache for this feature
    L1FeatureItemListComponent.featureDataCache.delete(this.feature_id);
    
    // Mark that we need fresh data
    this.item._needsDataRefresh = true;
    this.item._hasCachedData = false;
    
    // Clear corrupted values
    if (this.item.total > 1000) this.item.total = 0;
    if (this.item.time > 3600) this.item.time = 0;
    
    // Force update from API
    this.forceUpdateFeatureStatus();
  }

  /**
   * Force change detection to ensure UI updates
   */
  public forceUIUpdate(): void {
    this.cdr.detectChanges();
    this.log.msg('1', `Feature ${this.feature_id} UI update forced`, 'feature-item-list');
  }

  /**
   * Get enhanced tooltip for browser with mobile/tablet information
   */
  getEnhancedBrowserTooltip(browser: any): string {
    let tooltip = '';
    
    // Check if it's a mobile or tablet browser
    if (this.isMobileOrTablet(browser)) {
      const deviceInfo = this.getDeviceInfo(browser);
      const os = browser.os || browser.browser;
      const version = browser.browser_version || 'latest';
      
      if (deviceInfo) {
        tooltip = `${deviceInfo} (${os}) ${version}`;
      } else {
        tooltip = `${os} ${version}`;
      }
      
      // Add mobile emulation info if available
      if (browser.mobile_emulation) {
        tooltip += ' (Emulated)';
      } else if (browser.real_mobile) {
        tooltip += ' (Real Device)';
      }
    } else {
      // Regular browser
      tooltip = this.getUniqueBrowserTooltip(browser.browser);
    }
    
    return tooltip;
  }

  /**
   * Check if a browser is mobile or tablet
   */
  isMobileOrTablet(browser: any): boolean {
    return browser.mobile_emulation || 
           browser.real_mobile || 
           browser.device || 
           (browser.os && ['android', 'ios'].includes(browser.os.toLowerCase()));
  }

  /**
   * Get device information for mobile/tablet browsers
   */
  getDeviceInfo(browser: any): string {
    if (browser.device) {
      return browser.device;
    }
    
    if (browser.mobile_emulation) {
      if (browser.os === 'ios') {
        return browser.device || 'iPhone';
      } else if (browser.os === 'android') {
        return browser.device || 'Android';
      }
    }
    
    if (browser.real_mobile) {
      return 'Mobile Device';
    }
    
    return '';
  }

  /**
   * Get email notification tooltip text
   */
  getEmailTooltip(): string {
    let tooltip = 'Email notifications enabled. Recipients: ';
    
    if (this.item.reference?.email_address && this.item.reference.email_address.length > 0) {
      tooltip += this.item.reference.email_address.join(', ');
    }
    
    if (this.item.reference?.email_cc_address && this.item.reference.email_cc_address.length > 0) {
      tooltip += ` (CC: ${this.item.reference.email_cc_address.join(', ')})`;
    }
    
    if (this.item.reference?.email_bcc_address && this.item.reference.email_bcc_address.length > 0) {
      tooltip += ` (BCC: ${this.item.reference.email_bcc_address.join(', ')})`;
    }
    
    return tooltip;
  }

  /**
   * Get Telegram notification tooltip text
   */
  getTelegramTooltip(): string {
    let tooltip = 'Telegram notifications enabled';
    
    if (this.item.reference?.telegram_options?.override_chat_ids) {
      tooltip += `. Custom chat IDs: ${this.item.reference.telegram_options.override_chat_ids}`;
    } else {
      tooltip += '. Using department settings';
    }
    
    return tooltip;
  }

  /**
   * Get network login tooltip text
   */
  getNetworkLoginTooltip(): string {
    // Removed console.log to prevent excessive logging
    return 'Network logging enabled. This feature will record network responses and analyze vulnerable headers.';
  }

  /**
   * Get generate dataset tooltip text
   */
  getGenerateDatasetTooltip(): string {
    return 'Dataset generation enabled for this feature';
  }

  /**
   * Get browsers tooltip text
   */
  getBrowsersTooltip(): string {
    if (!this.item.browsers || this.item.browsers.length === 0) {
      return 'No browsers selected';
    }
    
    // Group browsers by type
    const browsersByType = new Map<string, any[]>();
    
    this.item.browsers.forEach(browser => {
      let browserType = browser.browser;
      
      // For mobile emulation, use OS as the type
      if (browser.mobile_emulation) {
        browserType = browser.os || browser.browser;
      }
      
      if (!browsersByType.has(browserType)) {
        browsersByType.set(browserType, []);
      }
      browsersByType.get(browserType)!.push(browser);
    });
    
    // Build organized tooltip text
    const tooltipLines: string[] = [];
    
    browsersByType.forEach((browsers, browserType) => {
      if (browsers.length === 1) {
        // Single version
        const browser = browsers[0];
        let version = browser.browser_version || 'latest';
        
        // For mobile emulation, show device info if available
        if (browser.mobile_emulation && browser.device) {
          version = `${browser.device} ${version}`;
        }
        
        tooltipLines.push(`${browserType} ${version}`);
      } else {
        // Multiple versions
        const versions = browsers.map(browser => {
          let version = browser.browser_version || 'latest';
          
          // For mobile emulation, show device info if available
          if (browser.mobile_emulation && browser.device) {
            version = `${browser.device} ${version}`;
          }
          
          return version;
        }).join(', ');
        
        tooltipLines.push(`${browserType} (${versions})`);
      }
    });
    
    return tooltipLines.join('\n');
  }

  /**
   * Get unique browser types (grouped by browser name to avoid duplicates)
   */
  getUniqueBrowsers(): any[] {
    if (!this.item.browsers || this.item.browsers.length === 0) {
      return [];
    }
    
    // Group browsers by browser type and return unique ones
    const uniqueBrowsers = new Map<string, any>();
    
    this.item.browsers.forEach(browser => {
      const browserType = browser.browser;
      if (!uniqueBrowsers.has(browserType)) {
        uniqueBrowsers.set(browserType, browser);
      }
    });
    
    return Array.from(uniqueBrowsers.values());
  }

  /**
   * Get unique browser types with better mobile/tablet support
   */
  getUniqueBrowsersEnhanced(): any[] {
    if (!this.item.browsers || this.item.browsers.length === 0) {
      return [];
    }
    
    // Group browsers by browser type and return unique ones
    const uniqueBrowsers = new Map<string, any>();
    
    this.item.browsers.forEach(browser => {
      // For mobile emulation, use OS as the key
      let key = browser.browser;
      if (browser.mobile_emulation) {
        key = browser.os || browser.browser;
      }
      
      if (!uniqueBrowsers.has(key)) {
        uniqueBrowsers.set(key, browser);
      }
    });
    
    return Array.from(uniqueBrowsers.values());
  }

  /**
   * Get tooltip for unique browser showing all versions
   */
  getUniqueBrowserTooltip(browserType: string): string {
    if (!this.item.browsers || this.item.browsers.length === 0) {
      return '';
    }
    
    // Get all browsers of this type
    const browsersOfType = this.item.browsers.filter(browser => {
      // For mobile emulation, check both browser and OS
      if (browser.mobile_emulation) {
        return browser.os === browserType || browser.browser === browserType;
      }
      return browser.browser === browserType;
    });
    
    if (browsersOfType.length === 1) {
      const browser = browsersOfType[0];
      if (browser.mobile_emulation) {
        return `${browser.os || browser.browser} ${browser.browser_version || ''}`.trim();
      }
      return `${browserType} ${browser.browser_version || ''}`.trim();
    } else {
      // Multiple versions of the same browser
      const versions = browsersOfType.map(browser => browser.browser_version || 'latest').join(', ');
      return `${browserType} (${versions})`;
    }
  }

  // Track function for browser icons to optimize rendering
  trackBrowser(index: number, browser: any): string {
    return browser.browser + browser.browser_version + browser.os + browser.os_version;
  }

  // Apply cached data if available and valid
  private applyCachedData() {
    const cachedData = L1FeatureItemListComponent.featureDataCache.get(this.feature_id);
    
    if (cachedData && this.isCacheValid(cachedData)) {
      // Validate cached data before applying to prevent duplication
      if (this.isCachedDataReasonable(cachedData)) {
        // Apply cached data to restore component state
        if (cachedData.featureData) {
          // Only apply cached data if we don't already have the same values
          // This prevents duplication of data
          if (!this.item.total || this.item.total !== cachedData.featureData.total) {
            this.item.total = cachedData.featureData.total;
          }
          if (!this.item.time || this.item.time !== cachedData.featureData.time) {
            this.item.time = cachedData.featureData.time;
          }
          if (!this.item.date || this.item.date !== cachedData.featureData.date) {
            this.item.date = cachedData.featureData.date;
          }
          if (!this.item.status || this.item.status !== cachedData.featureData.status) {
            this.item.status = cachedData.featureData.status;
          }
        } else {
          // Fallback to individual properties with duplication check
          if (!this.item.total || this.item.total !== cachedData.total) {
            this.item.total = cachedData.total;
          }
          if (!this.item.time || this.item.time !== cachedData.time) {
            this.item.time = cachedData.time;
          }
          if (!this.item.date || this.item.date !== cachedData.date) {
            this.item.date = cachedData.date;
          }
          if (!this.item.status || this.item.status !== cachedData.status) {
            this.item.status = cachedData.status;
          }
        }
        
        // Mark that we have cached data
        this.item._hasCachedData = true;
        
        // Ensure button state is correct when applying cached data
        if (!this.running) {
          this.isButtonDisabled = false;
        }
        
        this.log.msg('1', `Applied cached data for feature ${this.feature_id}`, 'feature-item-list');
      } else {
        this.log.msg('1', `Cached data for feature ${this.feature_id} appears corrupted, skipping application`, 'feature-item-list');
        // Clear corrupted cache entry
        L1FeatureItemListComponent.featureDataCache.delete(this.feature_id);
      }
    }
  }

  // Check if cached data is still valid
  private isCacheValid(cachedData: CachedFeatureData): boolean {
    const now = Date.now();
    const isExpired = (now - cachedData.lastUpdated) > L1FeatureItemListComponent.CACHE_EXPIRATION_TIME;
    const departmentMatches = cachedData.departmentId === this.item.reference?.department_id;
    
    return !isExpired && departmentMatches;
  }

  // Check if cached data is reasonable to prevent applying corrupted data
  private isCachedDataReasonable(cachedData: CachedFeatureData): boolean {
    // Check if the cached data has reasonable values
    const total = cachedData.total || cachedData.featureData?.total;
    const time = cachedData.time || cachedData.featureData?.time;
    
    // Validate total steps (should be positive and reasonable)
    if (total !== undefined && (total <= 0 || total > 1000)) {
      return false;
    }
    
    // Validate execution time (should be positive and reasonable)
    if (time !== undefined && (time < 0 || time > 3600)) {
      return false;
    }
    
    // Check if we have at least some basic data
    const hasBasicData = total || time || cachedData.date || cachedData.status;
    
    return hasBasicData;
  }

  // Cache the current feature data
  private cacheFeatureData() {
    // Don't cache if we don't have valid data or if data seems duplicated
    if (!this.hasValidFeatureData()) {
      this.log.msg('1', `Feature ${this.feature_id} has invalid data, skipping cache`, 'feature-item-list');
      return;
    }
    
    // Check if we're already caching the same data
    const existingCache = L1FeatureItemListComponent.featureDataCache.get(this.feature_id);
    if (existingCache && 
        existingCache.total === this.item.total && 
        existingCache.time === this.item.time && 
        existingCache.date === this.item.date) {
      this.log.msg('1', `Feature ${this.feature_id} data unchanged, skipping cache update`, 'feature-item-list');
      return;
    }
    
    // Validate data before caching to prevent corrupted data
    if (this.item.total <= 0 || this.item.total > 1000 || 
        this.item.time < 0 || this.item.time > 3600) {
      this.log.msg('1', `Feature ${this.feature_id} has corrupted data, skipping cache`, 'feature-item-list');
      return;
    }
    
    const cacheData: CachedFeatureData = {
      total: this.item.total || 0,
      time: this.item.time || 0,
      date: this.item.date || null,
      status: this.item.status || '',
      lastUpdated: Date.now(),
      departmentId: this.item.reference?.department_id || 0,
      featureData: { ...this.item } // Store complete item data
    };
    
    L1FeatureItemListComponent.featureDataCache.set(this.feature_id, cacheData);
    this.log.msg('1', `Cached feature data for feature ${this.feature_id}`, 'feature-item-list');
  }

  // Static method to initialize the cache system
  static initializeCache() {
    if (this.cacheInitialized) return;
    
    this.cacheInitialized = true;
    
    // Set up periodic cache cleanup
    setInterval(() => {
      this.clearExpiredCache();
      this.clearCorruptedCache(); // Also clean corrupted data
    }, 60000); // Clean up every minute
  }

  // Static method to clear expired cache entries
  static clearExpiredCache() {
    const now = Date.now();
    const expiredKeys: number[] = [];
    
    this.featureDataCache.forEach((data, key) => {
      if ((now - data.lastUpdated) > this.CACHE_EXPIRATION_TIME) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => {
      this.featureDataCache.delete(key);
    });
  }

  // Static method to clear corrupted cache entries
  static clearCorruptedCache() {
    const corruptedKeys: number[] = [];
    
    this.featureDataCache.forEach((data, key) => {
      // Check for corrupted data
      const total = data.total || data.featureData?.total;
      const time = data.time || data.featureData?.time;
      
      if ((total !== undefined && (total <= 0 || total > 1000)) ||
          (time !== undefined && (time < 0 || time > 3600))) {
        corruptedKeys.push(key);
      }
    });
    
    corruptedKeys.forEach(key => {
      this.featureDataCache.delete(key);
    });
    
    if (corruptedKeys.length > 0) {
      console.warn(`Cleared ${corruptedKeys.length} corrupted cache entries`);
    }
  }

  // Static method to clear cache for a specific department
  static clearCacheForDepartment(departmentId: number) {
    const keysToDelete: number[] = [];
    
    this.featureDataCache.forEach((data, key) => {
      if (data.departmentId === departmentId) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.featureDataCache.delete(key);
    });
  }

  // Static method to clear all cache
  static clearAllCache() {
    this.featureDataCache.clear();
  }

  // Static method to force cleanup of all cache types
  static forceCacheCleanup() {
    this.clearExpiredCache();
    this.clearCorruptedCache();
    console.log('Forced cache cleanup completed');
  }

  // Static trackBy function for *ngFor optimization
  static trackByFeatureId(index: number, item: any): number {
    return item.id || item.feature_id || index;
  }

  /**
   * Ensure browsers are loaded in the store
   */
  private ensureBrowsersLoaded(): void {
    const availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
    const localBrowsers = this._store.selectSnapshot(BrowsersState.getBrowserJsons) as any[];
    
    if (!availableBrowsers || availableBrowsers.length === 0) {
      try {
        this._store.dispatch(new Browserstack.GetBrowserstack());
        this.log.msg('1', `Feature ${this.feature_id} dispatched browserstack refresh`, 'feature-item-list');
      } catch (error) {
        this.log.msg('1', `Feature ${this.feature_id} error dispatching browserstack refresh: ${error}`, 'feature-item-list');
      }
    }
    
    if (!localBrowsers || localBrowsers.length === 0) {
      try {
        this._store.dispatch(new Browsers.GetBrowsers());
        this.log.msg('1', `Feature ${this.feature_id} dispatched local browsers refresh`, 'feature-item-list');
      } catch (error) {
        this.log.msg('1', `Feature ${this.feature_id} error dispatching local browsers refresh: ${error}`, 'feature-item-list');
      }
    }
  }

  /**
   * Force refresh browser information
   */
  public forceRefreshBrowsers(): void {
    try {
      this._store.dispatch(new Browserstack.GetBrowserstack());
      this._store.dispatch(new Browsers.GetBrowsers());
      this.log.msg('1', `Feature ${this.feature_id} forced browser refresh (both browserstack and local)`, 'feature-item-list');
      
      // Force change detection to update the button state
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 1000); // Wait for browsers to load
    } catch (error) {
      this.log.msg('1', `Feature ${this.feature_id} error forcing browser refresh: ${error}`, 'feature-item-list');
    }
  }

  /**
   * Check if the run button should be disabled due to browser version issues
   */
  public shouldDisableRunButton(): boolean {
    // Check if the feature has browsers configured
    if (!this.item?.browsers || this.item.browsers.length === 0) {
      this.log.msg('1', `Feature ${this.feature_id} no browsers configured, button enabled`, 'feature-item-list');
      return false;
    }

    // Throttle browser checks to prevent excessive execution
    if (this.item._lastBrowserCheck && (Date.now() - this.item._lastBrowserCheck) < 5000) {
      // Return cached result if checked recently
      return this.item._browserCheckResult || false;
    }

    // Ensure browsers are loaded
    this.ensureBrowsersLoaded();

    // Get the available browsers from both BrowserstackState and BrowsersState
    const availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
    const localBrowsers = this._store.selectSnapshot(BrowsersState.getBrowserJsons) as any[];
    
    // If still no browsers, return false (button will be enabled - allow running)
    if ((!availableBrowsers || availableBrowsers.length === 0) && (!localBrowsers || localBrowsers.length === 0)) {
      this.log.msg('1', `Feature ${this.feature_id} no available browsers, button enabled`, 'feature-item-list');
      return false;
    }

    // Combine both browser sources
    const allAvailableBrowsers = [...(availableBrowsers || []), ...(localBrowsers || [])];
    
    // Check if any of the selected browsers have outdated versions
    const hasOutdatedBrowser = this.item.browsers.some((selectedBrowser: any, index: number) => {
      this.log.msg('1', `Feature ${this.feature_id} checking browser ${index + 1}: ${selectedBrowser.browser} ${selectedBrowser.browser_version}`, 'feature-item-list');
      
      // For local browsers, we need to handle them differently
      if (this.isLocalBrowser(selectedBrowser)) {
        this.log.msg('1', `Feature ${this.feature_id} browser ${index + 1} detected as local`, 'feature-item-list');
        const isOutdated = this.isLocalBrowserOutdated(selectedBrowser, allAvailableBrowsers);
        this.log.msg('1', `Feature ${this.feature_id} browser ${index + 1} local outdated: ${isOutdated}`, 'feature-item-list');
        return isOutdated;
      }
      
      // For cloud browsers, use exact matching
      this.log.msg('1', `Feature ${this.feature_id} browser ${index + 1} detected as cloud`, 'feature-item-list');
      const isOutdated = this.isCloudBrowserOutdated(selectedBrowser, allAvailableBrowsers);
      this.log.msg('1', `Feature ${this.feature_id} browser ${index + 1} cloud outdated: ${isOutdated}`, 'feature-item-list');
      return isOutdated;
    });

    this.log.msg('1', `Feature ${this.feature_id} has outdated browsers: ${hasOutdatedBrowser}`, 'feature-item-list');
    
    // Cache the result and timestamp to prevent excessive checks
    this.item._lastBrowserCheck = Date.now();
    this.item._browserCheckResult = hasOutdatedBrowser;
    
    // Return true ONLY if there are outdated browsers (this will disable the button)
    return hasOutdatedBrowser;
  }

  /**
   * Check if a browser is local (not cloud-based)
   */
  private isLocalBrowser(browser: any): boolean {
    // Check multiple indicators for local browsers
    return browser.cloud === 'local' || 
           browser.cloud === undefined || 
           browser.cloud === null ||
           browser.os === 'OS X' ||
           browser.os === 'Windows' ||
           browser.os === 'Linux' ||
           (browser.browser === 'chrome' && !browser.os_version) ||
           (browser.browser === 'firefox' && !browser.os_version);
  }

  /**
   * Debug method to log browser information
   */
  private debugBrowserInfo(): void {
    if (!this.item?.browsers) {
      this.log.msg('1', `Feature ${this.feature_id} no browsers configured`, 'feature-item-list');
      return;
    }

    this.log.msg('1', `Feature ${this.feature_id} browser debug info:`, 'feature-item-list');
    
    this.item.browsers.forEach((browser: any, index: number) => {
      this.log.msg('1', `  Browser ${index + 1}: ${JSON.stringify(browser)}`, 'feature-item-list');
      this.log.msg('1', `  Is local: ${this.isLocalBrowser(browser)}`, 'feature-item-list');
    });

    const availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
    const localBrowsers = this._store.selectSnapshot(BrowsersState.getBrowserJsons) as any[];
    
    if (availableBrowsers && availableBrowsers.length > 0) {
      const chromeBrowsers = availableBrowsers.filter(b => b.browser === 'chrome');
      this.log.msg('1', `Available Browserstack Chrome browsers: ${chromeBrowsers.length}`, 'feature-item-list');
      chromeBrowsers.slice(0, 5).forEach(browser => {
        this.log.msg('1', `  Chrome ${browser.browser_version} (${browser.cloud || 'unknown'})`, 'feature-item-list');
      });
    } else {
      this.log.msg('1', 'No Browserstack browsers found', 'feature-item-list');
    }
    
    if (localBrowsers && localBrowsers.length > 0) {
      const chromeBrowsers = localBrowsers.filter(b => b.browser === 'chrome');
      this.log.msg('1', `Available Local Chrome browsers: ${chromeBrowsers.length}`, 'feature-item-list');
      chromeBrowsers.slice(0, 5).forEach(browser => {
        this.log.msg('1', `  Chrome ${browser.browser_version} (local)`, 'feature-item-list');
      });
    } else {
      this.log.msg('1', 'No local browsers found', 'feature-item-list');
    }
  }

  /**
   * Check if a local browser is outdated
   */
  private isLocalBrowserOutdated(selectedBrowser: any, availableBrowsers: any[]): boolean {
    // For local Chrome browsers, we need to check version compatibility
    if (selectedBrowser.browser === 'chrome') {
      // Get all available Chrome versions (both local and cloud)
      const chromeBrowsers = availableBrowsers.filter(browser => 
        browser.browser === 'chrome'
      );
      
      if (chromeBrowsers.length === 0) {
        this.log.msg('1', `Feature ${this.feature_id} no Chrome browsers available for comparison`, 'feature-item-list');
        return false; // Can't determine, allow running
      }
      
      // Extract version numbers and convert to integers for comparison
      const availableVersions = chromeBrowsers.map(browser => {
        const version = browser.browser_version;
        if (version === 'latest') return 999; // Latest is always highest
        // Fix: Don't add extra zeros, just get the version number
        return parseInt(version, 10) || 0;
      }).sort((a, b) => b - a); // Sort descending
      
      const selectedVersion = selectedBrowser.browser_version;
      if (selectedVersion === 'latest') {
        this.log.msg('1', `Feature ${this.feature_id} Chrome version is 'latest', never outdated`, 'feature-item-list');
        return false; // Latest is never outdated
      }
      
      // Fix: Don't add extra zeros, just get the version number
      const selectedVersionNum = parseInt(selectedVersion, 10) || 0;
      
      // Check if selected version is significantly outdated (more than 5 versions behind)
      const highestAvailable = availableVersions[0];
      
      // Log the comparison for debugging
      this.log.msg('1', `Feature ${this.feature_id} Chrome version check: selected=${selectedVersionNum}, highest=${highestAvailable}, difference=${highestAvailable - selectedVersionNum}`, 'feature-item-list');
      
      // For Chrome, be more strict - if it's more than 3 versions behind, consider it outdated
      if (highestAvailable - selectedVersionNum > 3) {
        this.log.msg('1', `Feature ${this.feature_id} has outdated Chrome version: ${selectedVersion} (latest available: ${highestAvailable})`, 'feature-item-list');
        return true;
      }
      
      this.log.msg('1', `Feature ${this.feature_id} Chrome version ${selectedVersion} is up to date`, 'feature-item-list');
      return false;
    }
    
    // For other local browsers, use exact matching
    return this.isCloudBrowserOutdated(selectedBrowser, availableBrowsers);
  }

  /**
   * Check if a cloud browser is outdated
   */
  private isCloudBrowserOutdated(selectedBrowser: any, availableBrowsers: any[]): boolean {
    // Find matching available browser by OS, OS version, browser type, and browser version
    const matchingAvailableBrowser = availableBrowsers.find((availableBrowser: any) => {
      const osMatch = availableBrowser.os === selectedBrowser.os;
      const osVersionMatch = availableBrowser.os_version === selectedBrowser.os_version;
      const browserMatch = availableBrowser.browser === selectedBrowser.browser;
      const browserVersionMatch = availableBrowser.browser_version === selectedBrowser.browser_version;
      
      return osMatch && osVersionMatch && browserMatch && browserVersionMatch;
    });

    // If no matching browser is found, it means the version is outdated/not available
    if (!matchingAvailableBrowser) {
      this.log.msg('1', `Feature ${this.feature_id} has outdated browser: ${selectedBrowser.browser} ${selectedBrowser.browser_version}`, 'feature-item-list');
      return true;
    }
    
    return false;
  }

  /**
   * Get simple browser status info for a specific browser
   */
  public getSimpleBrowserStatusInfo(browser: any): string {
    if (!browser) return '';
    
    // Ensure browsers are loaded
    this.ensureBrowsersLoaded();
    
    // Get the available browsers from both BrowserstackState and BrowsersState
    const availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
    const localBrowsers = this._store.selectSnapshot(BrowsersState.getBrowserJsons) as any[];
    
    // If no browsers available, can't determine
    if ((!availableBrowsers || availableBrowsers.length === 0) && (!localBrowsers || localBrowsers.length === 0)) {
      return 'Browser info not available';
    }
    
    // Combine both browser sources
    const allAvailableBrowsers = [...(availableBrowsers || []), ...(localBrowsers || [])];
    
    if (this.isLocalBrowser(browser) && browser.browser === 'chrome') {
      // Check local Chrome version
      const chromeBrowsers = allAvailableBrowsers.filter(available => 
        available.browser === 'chrome'
      );
      
      if (chromeBrowsers.length > 0) {
        const availableVersions = chromeBrowsers.map(available => {
          const version = available.browser_version;
          if (version === 'latest') return 999;
          // Fix: Don't add extra zeros, just get the version number
          return parseInt(version, 10) || 0;
        }).sort((a, b) => b - a);
        
        const selectedVersion = browser.browser_version;
        if (selectedVersion !== 'latest') {
          // Fix: Don't add extra zeros, just get the version number
          const selectedVersionNum = parseInt(selectedVersion, 10) || 0;
          const highestAvailable = availableVersions[0];
          
          if (highestAvailable - selectedVersionNum > 3) {
            return `⚠️ Chrome ${selectedVersion} outdated\n\nLatest available: ${highestAvailable}`;
          }
        }
      }
    } else {
      // Check cloud browser
      const matchingBrowser = allAvailableBrowsers.find(available => 
        available.os === browser.os &&
        available.os_version === browser.os_version &&
        available.browser === browser.browser &&
        available.browser_version === browser.browser_version
      );
      
      if (!matchingBrowser) {
        return `⚠️ ${browser.browser} ${browser.browser_version}\n\nNot available in current browser list`;
      }
    }
    
    return '';
  }

  /**
   * Get detailed browser status information for outdated browsers only
   */
  getBrowserStatusInfo(): string {
    if (!this.item?.browsers || this.item.browsers.length === 0) {
      return 'No browsers configured';
    }

    const availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
    const localBrowsers = this._store.selectSnapshot(BrowsersState.getBrowserJsons) as any[];
    const allAvailableBrowsers = [...(availableBrowsers || []), ...(localBrowsers || [])];
    
    if (allAvailableBrowsers.length === 0) {
      return 'Browser information not available';
    }

    const statusInfo: string[] = [];
    statusInfo.push('⚠️ BROWSER VERSION ISSUE DETECTED');
    statusInfo.push('Run button is disabled due to outdated browsers:');
    statusInfo.push('');
    
    // Only show information for browsers that are actually outdated
    const outdatedBrowsers = this.item.browsers.filter(browser => this.isSpecificBrowserOutdated(browser));
    
    if (outdatedBrowsers.length === 0) {
      return 'No outdated browsers found';
    }
    
    outdatedBrowsers.forEach((browser: any, index: number) => {
      let status = 'OUTDATED';
      let details = '';
      
      if (this.isLocalBrowser(browser) && browser.browser === 'chrome') {
        // Check local Chrome version
        const chromeBrowsers = allAvailableBrowsers.filter(available => 
          available.browser === 'chrome'
        );
        
        if (chromeBrowsers.length > 0) {
          const availableVersions = chromeBrowsers.map(available => {
            const version = available.browser_version;
            if (version === 'latest') return 999;
            // Fix: Don't add extra zeros, just get the version number
            return parseInt(version, 10) || 0;
          }).sort((a, b) => b - a);
          
          const selectedVersion = browser.browser_version;
          if (selectedVersion !== 'latest') {
            const selectedVersionNum = parseInt(selectedVersion, 10) || 0;
            const highestAvailable = availableVersions[0];
            details = `(latest available: ${highestAvailable})`;
          }
        }
      } else {
        // Check cloud browser
        const matchingBrowser = allAvailableBrowsers.find(available => 
          available.os === browser.os &&
          available.os_version === browser.os_version &&
          available.browser === browser.browser &&
          available.browser_version === browser.browser_version
        );
        
        if (!matchingBrowser) {
          details = '(not available in current browser list)';
        }
      }
      
      statusInfo.push(`• ${browser.browser} ${browser.browser_version}: ${status} ${details}`.trim());
    });
    
    statusInfo.push('');
    statusInfo.push('To fix this issue:');
    statusInfo.push('1. Edit the feature');
    statusInfo.push('2. Update this browser version');
    statusInfo.push('3. Save the feature');
    
    return statusInfo.join('\n');
  }

  /**
   * Check browser versions and log any issues
   */
  private checkBrowserVersions(): void {
    if (!this.item?.browsers || this.item.browsers.length === 0) {
      return;
    }

    const availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
    const localBrowsers = this._store.selectSnapshot(BrowsersState.getBrowserJsons) as any[];
    const allAvailableBrowsers = [...(availableBrowsers || []), ...(localBrowsers || [])];
    
    if (allAvailableBrowsers.length === 0) {
      this.log.msg('1', `Feature ${this.feature_id} no browsers available for version check`, 'feature-item-list');
      return;
    }

    this.item.browsers.forEach((browser: any, index: number) => {
      if (this.isLocalBrowser(browser) && browser.browser === 'chrome') {
        // Check local Chrome version
        const chromeBrowsers = allAvailableBrowsers.filter(available => 
          available.browser === 'chrome'
        );
        
        if (chromeBrowsers.length > 0) {
          const availableVersions = chromeBrowsers.map(available => {
            const version = available.browser_version;
            if (version === 'latest') return 999;
            return parseInt(version.replace(/[^\d]/g, ''), 10) || 0;
          }).sort((a, b) => b - a);
          
          const selectedVersion = browser.browser_version;
          if (selectedVersion !== 'latest') {
            const selectedVersionNum = parseInt(selectedVersion.replace(/[^\d]/g, ''), 10) || 0;
            const highestAvailable = availableVersions[0];
            
            if (highestAvailable - selectedVersionNum > 3) {
              this.log.msg('1', `Feature ${this.feature_id} browser ${index + 1}: Chrome ${selectedVersion} is outdated (latest: ${highestAvailable})`, 'feature-item-list');
            } else {
              this.log.msg('1', `Feature ${this.feature_id} browser ${index + 1}: Chrome ${selectedVersion} is up to date`, 'feature-item-list');
            }
          } else {
            this.log.msg('1', `Feature ${this.feature_id} browser ${index + 1}: Chrome latest is always up to date`, 'feature-item-list');
          }
        }
      } else {
        // Check cloud browser
        const matchingBrowser = allAvailableBrowsers.find(available => 
          available.os === browser.os &&
          available.os_version === browser.os_version &&
          available.browser === browser.browser &&
          available.browser_version === browser.browser_version
        );
        
        if (!matchingBrowser) {
          this.log.msg('1', `Feature ${this.feature_id} browser ${index + 1}: ${browser.browser} ${browser.browser_version} not found in available browsers`, 'feature-item-list');
        } else {
          this.log.msg('1', `Feature ${this.feature_id} browser ${index + 1}: ${browser.browser} ${browser.browser_version} is available`, 'feature-item-list');
        }
      }
    });
  }

  /**
   * Detect and correct duplicated data in real-time
   */
  private detectAndCorrectDuplicatedData(): void {
    // Check for obvious data duplication
    if (this.item.total && this.item.total > 1000) {
      this.log.msg('1', `Feature ${this.feature_id} has excessive total steps (${this.item.total}), attempting correction`, 'feature-item-list');
      
      // Try to get the correct data from the store first
      const storeFeature = this._store.selectSnapshot(CustomSelectors.GetFeatureInfo(this.feature_id));
      if (storeFeature && storeFeature.info && storeFeature.info.total && 
          storeFeature.info.total > 0 && storeFeature.info.total <= 1000) {
        this.item.total = storeFeature.info.total;
        this.log.msg('1', `Feature ${this.feature_id} total steps corrected from store: ${this.item.total}`, 'feature-item-list');
      } else {
        // If store doesn't have valid data, clear the corrupted value
        this.item.total = 0;
        this.log.msg('1', `Feature ${this.feature_id} total steps cleared due to corruption`, 'feature-item-list');
      }
    }
    
    // Check for execution time anomalies
    if (this.item.time && this.item.time > 3600) {
      this.log.msg('1', `Feature ${this.feature_id} has excessive execution time (${this.item.time}), attempting correction`, 'feature-item-list');
      
      // Try to get the correct data from the store first
      const storeFeature = this._store.selectSnapshot(CustomSelectors.GetFeatureInfo(this.feature_id));
      if (storeFeature && storeFeature.info && storeFeature.info.execution_time && 
          storeFeature.info.execution_time > 0 && storeFeature.info.execution_time <= 3600) {
        this.item.time = storeFeature.info.execution_time;
        this.log.msg('1', `Feature ${this.feature_id} execution time corrected from store: ${this.item.time}`, 'feature-item-list');
      } else {
        // If store doesn't have valid data, clear the corrupted value
        this.item.time = 0;
        this.log.msg('1', `Feature ${this.feature_id} execution time cleared due to corruption`, 'feature-item-list');
      }
    }
    
    // Mark that we need to refresh data if we had to correct values
    if (this.item.total === 0 || this.item.time === 0) {
      this.item._needsDataRefresh = true;
    }
  }

  /**
   * Clear browser check cache to force re-evaluation
   */
  public clearBrowserCheckCache(): void {
    if (this.item) {
      delete this.item._lastBrowserCheck;
      delete this.item._browserCheckResult;
      this.log.msg('1', `Feature ${this.feature_id} browser check cache cleared`, 'feature-item-list');
    }
  }

  /**
   * Check if a specific browser is outdated
   */
  public isSpecificBrowserOutdated(browser: any): boolean {
    if (!browser) return false;
    
    // Ensure browsers are loaded
    this.ensureBrowsersLoaded();
    
    // Get the available browsers from both BrowserstackState and BrowsersState
    const availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
    const localBrowsers = this._store.selectSnapshot(BrowsersState.getBrowserJsons) as any[];
    
    // If no browsers available, can't determine
    if ((!availableBrowsers || availableBrowsers.length === 0) && (!localBrowsers || localBrowsers.length === 0)) {
      return false;
    }
    
    // Combine both browser sources
    const allAvailableBrowsers = [...(availableBrowsers || []), ...(localBrowsers || [])];
    
    // For local browsers, we need to handle them differently
    if (this.isLocalBrowser(browser)) {
      return this.isLocalBrowserOutdated(browser, allAvailableBrowsers);
    }
    
    // For cloud browsers, use exact matching
    return this.isCloudBrowserOutdated(browser, allAvailableBrowsers);
  }

  /**
   * Check if cached data is still fresh enough to avoid reloading
   * This prevents unnecessary API calls when data is still recent
   */
  private isCachedDataFresh(): boolean {
    if (!this.item._lastDataCheck) return false;
    
    const now = Date.now();
    const timeSinceLastCheck = now - this.item._lastDataCheck;
    
    // Define freshness thresholds based on feature status
    let freshnessThreshold = 60000; // Default: 1 minute
    
    if (this.running) {
      // If feature is running, data is fresh for longer (5 minutes)
      freshnessThreshold = 300000;
    } else if (this.item.status === 'Success' || this.item.status === 'Failed') {
      // If feature has completed, data is fresh for longer (10 minutes)
      freshnessThreshold = 600000;
    } else if (this.item.status === 'running' || this.item.status === 'pending') {
      // If feature is in progress, data is fresh for shorter (30 seconds)
      freshnessThreshold = 30000;
    }
    
    const isFresh = timeSinceLastCheck < freshnessThreshold;
    
    if (isFresh) {
      this.log.msg('1', `Feature ${this.feature_id} cached data is fresh (${Math.round(timeSinceLastCheck / 1000)}s old, threshold: ${Math.round(freshnessThreshold / 1000)}s)`, 'feature-item-list');
    } else {
      this.log.msg('1', `Feature ${this.feature_id} cached data is stale (${Math.round(timeSinceLastCheck / 1000)}s old, threshold: ${Math.round(freshnessThreshold / 1000)}s)`, 'feature-item-list');
    }
    
    return isFresh;
  }

  /**
   * Smart data refresh that only updates when necessary
   * This method combines all the optimization logic
   */
  private smartDataRefresh(): boolean {
    // Log optimization status for debugging
    this.logOptimizationStatus();
    
    // Check if component is active
    if (!this.isComponentActive) {
      this.log.msg('1', `Feature ${this.feature_id} component not active, skipping refresh`, 'feature-item-list');
      return false;
    }
    
    // Check if we should skip data reload based on feature state
    if (this.shouldSkipDataReload()) {
      return false;
    }
    
    // Check if we're making too many API calls
    if (this.item._lastApiCall && (Date.now() - this.item._lastApiCall) < 5000) {
      this.log.msg('1', `Feature ${this.feature_id} API call throttled, skipping refresh`, 'feature-item-list');
      return false;
    }
    
    // Check API call frequency optimization
    if (!this.optimizeApiCallFrequency()) {
      return false;
    }
    
    // All checks passed, allow refresh
    this.log.msg('1', `Feature ${this.feature_id} refresh allowed, proceeding with update`, 'feature-item-list');
    return true;
  }

  /**
   * Enhanced cache management to prevent unnecessary reloads
   * This method provides additional optimization based on feature state
   */
  private shouldSkipDataReload(): boolean {
    // Skip if feature is running and we have recent data
    if (this.running && this.item._lastDataCheck && (Date.now() - this.item._lastDataCheck) < 60000) {
      this.log.msg('1', `Feature ${this.feature_id} is running with recent data, skipping reload`, 'feature-item-list');
      return true;
    }
    
    // Skip if feature has completed and we have valid data
    if ((this.item.status === 'Success' || this.item.status === 'Failed') && this.hasValidFeatureData()) {
      this.log.msg('1', `Feature ${this.feature_id} has completed with valid data, skipping reload`, 'feature-item-list');
      return true;
    }
    
    // Skip if we have cached data that's still fresh
    if (this.isCachedDataFresh()) {
      return true;
    }
    
    return false;
  }

  /**
   * Performance monitoring and optimization
   * This method tracks API call frequency and optimizes accordingly
   */
  private optimizeApiCallFrequency(): boolean {
    const now = Date.now();
    
    // Initialize tracking if not exists
    if (!this.item._apiCallCount) {
      this.item._apiCallCount = 0;
      this.item._apiCallWindowStart = now;
    }
    
    // Reset counter if window has passed (5 minutes)
    if (now - this.item._apiCallWindowStart > 300000) {
      this.item._apiCallCount = 0;
      this.item._apiCallWindowStart = now;
    }
    
    // Increment counter
    this.item._apiCallCount++;
    
    // If we're making too many calls in the window, throttle
    if (this.item._apiCallCount > 10) { // Max 10 calls per 5 minutes
      this.log.msg('1', `Feature ${this.feature_id} API call frequency too high (${this.item._apiCallCount} calls), throttling`, 'feature-item-list');
      return false;
    }
    
    return true;
  }

  /**
   * Comprehensive optimization status logging
   * This method provides detailed information about why a refresh was allowed or denied
   */
  private logOptimizationStatus(): void {
    const now = Date.now();
    const timeSinceLastCheck = this.item._lastDataCheck ? now - this.item._lastDataCheck : 'never';
    const timeSinceLastApiCall = this.item._lastApiCall ? now - this.item._lastApiCall : 'never';
    const apiCallCount = this.item._apiCallCount || 0;
    
    this.log.msg('1', `Feature ${this.feature_id} optimization status:`, 'feature-item-list');
    this.log.msg('1', `  - Component active: ${this.isComponentActive}`, 'feature-item-list');
    this.log.msg('1', `  - Has valid data: ${this.hasValidFeatureData()}`, 'feature-item-list');
    this.log.msg('1', `  - Cached data fresh: ${this.isCachedDataFresh()}`, 'feature-item-list');
    this.log.msg('1', `  - Should skip reload: ${this.shouldSkipDataReload()}`, 'feature-item-list');
    this.log.msg('1', `  - Time since last check: ${typeof timeSinceLastCheck === 'number' ? Math.round(timeSinceLastCheck / 1000) + 's' : timeSinceLastCheck}`, 'feature-item-list');
    this.log.msg('1', `  - Time since last API call: ${typeof timeSinceLastApiCall === 'number' ? Math.round(timeSinceLastApiCall / 1000) + 's' : timeSinceLastApiCall}`, 'feature-item-list');
    this.log.msg('1', `  - API call count in window: ${apiCallCount}`, 'feature-item-list');
    this.log.msg('1', `  - Feature running: ${this.running}`, 'feature-item-list');
    this.log.msg('1', `  - Feature status: ${this.item.status}`, 'feature-item-list');
  }

  /**
   * Get optimization summary for this feature
   * This method provides a quick overview of the optimization status
   */
  public getOptimizationSummary(): string {
    const now = Date.now();
    const timeSinceLastCheck = this.item._lastDataCheck ? Math.round((now - this.item._lastDataCheck) / 1000) : 0;
    const timeSinceLastApiCall = this.item._lastApiCall ? Math.round((now - this.item._lastApiCall) / 1000) : 0;
    const apiCallCount = this.item._apiCallCount || 0;
    
    let summary = `Feature ${this.feature_id} Optimization Summary:\n`;
    summary += `• Data freshness: ${timeSinceLastCheck}s ago\n`;
    summary += `• Last API call: ${timeSinceLastApiCall}s ago\n`;
    summary += `• API calls in window: ${apiCallCount}/10\n`;
    summary += `• Feature status: ${this.item.status}\n`;
    summary += `• Running: ${this.running}\n`;
    summary += `• Has valid data: ${this.hasValidFeatureData()}\n`;
    summary += `• Cache fresh: ${this.isCachedDataFresh()}\n`;
    
    return summary;
  }

}

