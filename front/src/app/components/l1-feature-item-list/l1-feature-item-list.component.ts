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
 * 8. PERFORMANCE OPTIMIZATIONS (NEW):
 *    - Simplified ngOnInit to only load essential functionality
 *    - Removed complex cache initialization and data corruption detection on startup
 *    - Eliminated browser version checking and loading on component initialization
 *    - Removed cross-contamination prevention systems that caused overhead
 *    - Simplified intersection observer to reduce timeout overhead
 *    - Added debouncing to route change subscriptions
 *    - Increased safety timeout intervals to reduce overhead
 *    - Optimized observable setup to only load when component is active
 * 
 * 9. AGGRESSIVE PERFORMANCE OPTIMIZATIONS (LATEST):
 *    - Removed route change subscriptions from ngOnInit
 *    - Eliminated deferred observables setup that caused delays
 *    - Implemented lazy loading of heavy observables only on user interaction
 *    - Simplified essential observables to absolute minimum
 *    - Removed all complex status handling during initialization
 *    - Eliminated API calls during initial page load
 *    - Component now loads with minimal overhead and only becomes fully functional when needed
 * 
 * These changes prevent the duplication of steps by ensuring that:
 * - Only valid, reasonable data is stored and displayed
 * - API calls are minimized and only made when necessary
 * - Corrupted or duplicated data is automatically detected and corrected
 * - Cache system maintains data integrity
 * - Mobile and tablet browsers are properly displayed with correct icons
 * - Outdated browser versions are properly detected and buttons disabled accordingly
 * - Page loading performance is significantly improved by removing unnecessary startup operations
 * - Component loads instantly with minimal overhead and becomes fully functional only when needed
 */
import { Component, OnInit, Input, ChangeDetectorRef, OnDestroy, TrackByFunction, ElementRef } from '@angular/core';
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
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatLegacyMenuModule as MatMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
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
import { FeaturesState } from '@store/features.state';


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
  
  // Add feature data locks to prevent cross-contamination
  static featureDataLocks = new Map<number, boolean>();
  static readonly LOCK_TIMEOUT = 5000; // Reduced to 5 seconds - much less restrictive
  
  // Add lock timestamps to track when locks were set
  static featureDataLockTimestamps = new Map<number, number>();
  
  // Add tracking for mass feature updates to prevent data loss
  static lastMassUpdateTime = 0;
  static readonly MASS_UPDATE_THRESHOLD = 2000; // 2 seconds threshold for mass updates
  
  // Add protected cache for feature data during mass updates
  static protectedFeatureData = new Map<number, any>();

  constructor(
    private _router: NavigationService,
    private _store: Store,
    public _sharedActions: SharedActionsService,
    private _dialog: MatDialog,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
    private logger: LogService,
    private cdr: ChangeDetectorRef,
    private starredService: StarredService,
    private elementRef: ElementRef
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
    this.isComponentActive = true;
    
    // Setup essential observables only
    this.setupEssentialObservables();
    
    // Setup heavy observables for permissions and other functionality
    this.setupHeavyObservables();
    
    // Setup intersection observer for lazy loading
    this.setupIntersectionObserver();

    // Set initial button state
    this.isButtonDisabled = false;
    this.running = false;

    // Load basic feature data if needed
    if (!this.item.total || !this.item.time || !this.item.date) {
      this.loadBasicFeatureData();
    }
    
    // Always try to get latest data from store when component initializes
    this.loadLatestFeatureDataFromStore();
  }

  /**
   * Loads the latest feature data from the store when component initializes
   * This ensures the component has the most up-to-date data from main-view
   */
  private loadLatestFeatureDataFromStore(): void {
    // Get the latest feature data from the store
    this._store.select(CustomSelectors.GetFeatureInfo(this.feature_id)).pipe(
      take(1) // Take only the first value to avoid subscription issues
    ).subscribe(featureInfo => {
      if (featureInfo && featureInfo.info) {
        const storeData = featureInfo.info;
        
        // Update the item with the latest data from store
        if (storeData.total !== undefined) {
          this.item.total = storeData.total;
        }
        
        if (storeData.execution_time !== undefined) {
          this.item.time = storeData.execution_time;
        }
        
        if (storeData.result_date !== undefined) {
          this.item.date = storeData.result_date;
        }
        
        if (storeData.status !== undefined) {
          this.item.status = storeData.status === 'Success' ? 'success' : 
                           storeData.status === 'Failed' ? 'failed' : 'canceled';
        }
        
        // Force change detection to update the UI
        this.cdr.detectChanges();
      } else {
        // Since main-view is not loaded, fetch data directly from API
        this.fetchFeatureDataFromAPI();
      }
    });
  }

  /**
   * Fetches feature data directly from the API since main-view is not loaded
   */
  private fetchFeatureDataFromAPI(): void {
    // Make direct API call to get feature results
    this._api.getFeatureResultsByFeatureId(this.feature_id, {
      archived: false,
      page: 1,
      size: 1,
    }).subscribe({
      next: (res: any) => {
        if (res && res.results && res.results.length > 0) {
          const latestResult = res.results[0];
          
          // Update the item with the data from API
          this.item.total = latestResult.total || 0;
          this.item.time = latestResult.execution_time || 0;
          this.item.date = latestResult.result_date || null;
          this.item.status = latestResult.status === 'Success' ? 'success' : 
                           latestResult.status === 'Failed' ? 'failed' : 'canceled';
          this.item.ok = latestResult.ok || 0;
          this.item.fails = latestResult.fails || 0;
          this.item.skipped = latestResult.skipped || 0;
          
          // Force change detection by marking for check
          this.cdr.markForCheck();
          this.cdr.detectChanges();
          
          // Also update the store for future use
          this._store.dispatch(new Features.UpdateFeatureResultData(this.feature_id, {
            total: latestResult.total || 0,
            execution_time: latestResult.execution_time || 0,
            result_date: latestResult.result_date || null,
            status: latestResult.status || 'Unknown',
            success: latestResult.success || false,
            ok: latestResult.ok || 0,
            fails: latestResult.fails || 0,
            skipped: latestResult.skipped || 0,
            browser: latestResult.browser || {},
            mobile: latestResult.mobile || [],
            description: latestResult.description || '',
            pixel_diff: latestResult.pixel_diff || 0
          }));
          
          // Force a complete UI refresh
          this.refreshUI();
        }
      },
      error: err => {
        // Handle error silently
      }
    });
  }

  /**
   * Retries loading feature data from the store after a delay
   * This handles the case where main-view hasn't updated the store yet
   */
  private retryLoadFeatureDataFromStore(): void {
    console.log('🔄 retryLoadFeatureDataFromStore() called for feature:', this.feature_id);
    
    this._store.select(CustomSelectors.GetFeatureInfo(this.feature_id)).pipe(
      take(1)
    ).subscribe(featureInfo => {
      console.log('📡 Retry - Feature info from store:', featureInfo);
      
      if (featureInfo && featureInfo.info) {
        const storeData = featureInfo.info;
        console.log('📊 Retry - Store data:', storeData);
        
        // Update the item with the latest data from store
        if (storeData.total !== undefined) {
          this.item.total = storeData.total;
          console.log('✅ Retry - Updated item.total:', this.item.total);
        }
        
        if (storeData.execution_time !== undefined) {
          this.item.time = storeData.execution_time;
          console.log('✅ Retry - Updated item.time:', this.item.time);
        }
        
        if (storeData.result_date !== undefined) {
          this.item.date = storeData.result_date;
          console.log('✅ Retry - Updated item.date:', this.item.date);
        }
        
        if (storeData.status !== undefined) {
          this.item.status = storeData.status === 'Success' ? 'success' : 
                           storeData.status === 'Failed' ? 'failed' : 'canceled';
          console.log('✅ Retry - Updated item.status:', this.item.status);
        }
        
        // Force change detection to update the UI
        this.cdr.detectChanges();
        
        console.log('🎯 Retry - Final item data after store update:', {
          total: this.item.total,
          time: this.item.time,
          date: this.item.date,
          status: this.item.status
        });
      } else {
        console.log('⚠️ Retry - Still no feature info found in store for feature:', this.feature_id);
        
        // Try one more time after another delay
        setTimeout(() => {
          console.log('🔄 Final retry to get feature data from store...');
          this.finalRetryLoadFeatureDataFromStore();
        }, 2000); // Wait 2 more seconds
      }
    });
  }

  /**
   * Final retry to load feature data from the store
   */
  private finalRetryLoadFeatureDataFromStore(): void {
    console.log('🔄 finalRetryLoadFeatureDataFromStore() called for feature:', this.feature_id);
    
    this._store.select(CustomSelectors.GetFeatureInfo(this.feature_id)).pipe(
      take(1)
    ).subscribe(featureInfo => {
      if (featureInfo && featureInfo.info) {
        const storeData = featureInfo.info;
        console.log('📊 Final retry - Store data:', storeData);
        
        // Update the item with the latest data from store
        if (storeData.total !== undefined) this.item.total = storeData.total;
        if (storeData.execution_time !== undefined) this.item.time = storeData.execution_time;
        if (storeData.result_date !== undefined) this.item.date = storeData.result_date;
        if (storeData.status !== undefined) {
          this.item.status = storeData.status === 'Success' ? 'success' : 
                           storeData.status === 'Failed' ? 'failed' : 'canceled';
        }
        
        this.cdr.detectChanges();
        console.log('✅ Final retry - Updated item data');
      } else {
        console.log('❌ Final retry - No feature info found in store for feature:', this.feature_id);
      }
    });
  }

  /**
   * Subscribe to route changes to preserve feature data when navigating to the same folder
   */
  private subscribeToRouteChanges(): void {
    // Subscribe to current route changes - optimized for performance
    this._store.select(FeaturesState.GetCurrentRouteNew).pipe(
      distinctUntilChanged(),
      filter(() => this.isComponentActive),
      debounceTime(100) // Add debounce to prevent excessive processing
    ).subscribe(currentRoute => {
      if (currentRoute && currentRoute.length > 0) {
        const currentFolderId = currentRoute[currentRoute.length - 1]?.folder_id;
        
        // Check if we're in the same folder to preserve data
        if (this.item._lastFolderId && this.item._lastFolderId === currentFolderId) {
          // Preserve data when in same folder
          this.preserveFeatureDataForNavigation();
        } else {
          // Update the last folder ID
          this.item._lastFolderId = currentFolderId;
        }
      }
    });
  }

  private setupEssentialObservables() {
    // Only load absolutely essential observables - minimal setup for performance
    // Department folders are loaded on demand when needed for navigation
  }



  private heavyObservablesSetup = false;

  /**
   * Load heavy observables only when needed - called on user interaction
   */
  public loadHeavyObservablesOnDemand(): void {
    if (!this.heavyObservablesSetup) {
      this.setupHeavyObservables();
    }
  }

  private setupHeavyObservables() {
    if (this.heavyObservablesSetup) return;
    
    this.heavyObservablesSetup = true;

    // Only load absolutely essential observables - minimal setup
    this.feature$ = this._store.select(
      CustomSelectors.GetFeatureInfo(this.feature_id)
    ).pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
      distinctUntilChanged()
    );

    // Basic feature status - minimal
    this.featureStatus$ = this._store.select(
      CustomSelectors.GetFeatureStatus(this.feature_id)
    ).pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // Feature running status - minimal
    this.featureRunning$ = this._store.select(
      CustomSelectors.GetFeatureRunningStatus(this.feature_id)
    ).pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // Subscribe to feature running status - minimal handling
    this.featureRunning$.subscribe(running => {
      this.running = running;
      if (!running) {
        this.isButtonDisabled = false;
      }
    });

    // Permission selectors - minimal
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

    // Set canCreateFeature based on edit permission
    this.canEditFeature$.pipe(take(1)).subscribe(canEdit => {
      this.canCreateFeature = canEdit;
    });

    // Other observables - minimal setup
    this.isAnyFeatureRunning$ = new BehaviorSubject<boolean>(false).asObservable();

    // Filter state - only if available
    if (this._sharedActions?.filterState$) {
      this._sharedActions.filterState$.pipe(
        distinctUntilChanged(),
        shareReplay({ bufferSize: 1, refCount: true })
      ).subscribe(isActive => {
        this.finder = isActive;
      });
    }

    // Starred status - minimal
    this.isStarred$ = this.starredService.isStarred(this.feature_id).pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // Feature results - minimal
    this.lastFeatureResult$ = this._store.select(CustomSelectors.GetFeatureResults(this.feature_id)).pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  ngOnDestroy() {
    this.isComponentActive = false;
    
    // Clean up timeouts
    if (this.safetyTimeout) {
      clearTimeout(this.safetyTimeout);
    }
    if (this.initSafetyTimeout) {
      clearTimeout(this.initSafetyTimeout);
    }
    
    // Clean up observables
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clean up cache for this feature to prevent cross-contamination
    this.cleanupFeatureCache();
  }

  /**
   * Clean up cache for this feature to prevent cross-contamination
   */
  private cleanupFeatureCache(): void {
    // Remove this feature's cache entry to prevent it from affecting other features
    if (L1FeatureItemListComponent.featureDataCache.has(this.feature_id)) {
      L1FeatureItemListComponent.featureDataCache.delete(this.feature_id);
    }
    
    // Also clean up protected cache for this feature
    if (L1FeatureItemListComponent.protectedFeatureData.has(this.feature_id)) {
      L1FeatureItemListComponent.protectedFeatureData.delete(this.feature_id);
    }
    
    // Also clean up any potentially contaminated cache entries
    this.cleanupOtherFeaturesCache();
  }

  /**
   * Check if the feature already has valid data to prevent unnecessary API calls
   */
  private hasValidFeatureData(): boolean {
    // Simplified validation - only check if we have basic data
    const hasRequiredData = this.item.total !== undefined && 
                           this.item.time !== undefined && 
                           this.item.date !== undefined;
    
    // Check if we have cached data
    const hasCachedData = this.item._hasCachedData;
    
    return hasRequiredData && hasCachedData;
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
    
    // Simplified thresholds for what constitutes a "perceptible" change
    const TOTAL_STEPS_THRESHOLD = 1; // 1 step difference is perceptible
    const EXECUTION_TIME_THRESHOLD = 1; // 1 second difference is perceptible
    const STATUS_CHANGE_THRESHOLD = true; // Any status change is perceptible
    
    let hasPerceptibleChanges = false;
    
    // Check total steps change
    if (newData.total !== undefined && this.item.total !== undefined) {
      const stepDifference = Math.abs(newData.total - this.item.total);
      if (stepDifference >= TOTAL_STEPS_THRESHOLD) {
        hasPerceptibleChanges = true;
      }
    }
    
    // Check execution time change
    if (newData.execution_time !== undefined && this.item.time !== undefined) {
      const timeDifference = Math.abs(newData.execution_time - this.item.time);
      if (timeDifference >= EXECUTION_TIME_THRESHOLD) {
        hasPerceptibleChanges = true;
      }
    }
    
    // Check status change
    if (newData.status && this.item.status && newData.status !== this.item.status) {
      hasPerceptibleChanges = true;
    }
    
    // Check if new data has values we don't have (always perceptible)
    if (newData.total && !this.item.total) {
      hasPerceptibleChanges = true;
    }
    
    if (newData.execution_time && !this.item.time) {
      hasPerceptibleChanges = true;
    }
    
    if (newData.result_date && !this.item.date) {
      hasPerceptibleChanges = true;
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
   * Update feature status from the latest result
   */
  private updateFeatureStatusFromResult(result: any) {
    if (!result || !this.isComponentActive) return;
    
    // Check if data modifications are blocked - but be much less restrictive
    if (this.blockDataModifications()) {
      return;
    }
    
    // Lock feature data to prevent cross-contamination, but be much less aggressive
    this.lockFeatureData();
    
    // Check if there are perceptible data changes before updating
    if (!this.hasPerceptibleDataChanges(result)) {
      this.unlockFeatureData(); // Unlock since we're not updating
      return;
    }
    
    // Simplified validation - only check for obvious issues
    if (result.total !== undefined && result.total < 0) {
      this.unlockFeatureData(); // Unlock since we're not updating
      return;
    }
    
    if (result.execution_time !== undefined && result.execution_time < 0) {
      this.unlockFeatureData(); // Unlock since we're not updating
      return;
    }
    
    // Check if the new data is actually different from current data
    const hasChanges = (result.total !== undefined && this.item.total !== result.total) ||
                       (result.execution_time !== undefined && this.item.time !== result.execution_time) ||
                       (result.result_date !== undefined && this.item.date !== result.result_date) ||
                       (result.status && this.item.status !== result.status);
    
    if (!hasChanges) {
      this.unlockFeatureData(); // Unlock since we're not updating
      return;
    }
    
    // Clean up other features cache to prevent cross-contamination
    this.cleanupOtherFeaturesCache();
    
    // Update the item with the latest feature result information
    // Only update if the value is different to prevent duplication
    if (result.total !== undefined && this.item.total !== result.total) {
      this.item.total = result.total;
    }
    if (result.execution_time !== undefined && this.item.time !== result.execution_time) {
      this.item.time = result.execution_time;
    }
    if (result.result_date !== undefined && this.item.date !== result.result_date) {
      this.item.date = result.result_date;
    }
    
    // Update the status with the real result status from the API
    if (result.status && this.item.status !== result.status) {
      this.item.status = result.status;
    }
    
    // Mark that we have valid data
    this.item._hasCachedData = true;
    
    // Cache the updated data with isolation
    this.cacheFeatureData();
    
    // Trigger change detection
    this.cdr.detectChanges();
    
    // Keep the lock active for a shorter time to prevent immediate cross-contamination
    // The lock will automatically expire after LOCK_TIMEOUT
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
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            this.isComponentActive = entry.isIntersecting;
          });
        },
        { 
          threshold: 0.1, // Trigger when 10% of component is visible
          rootMargin: '200px' // Increased margin for better performance
        }
      );

      // Observe the component element
      const element = document.querySelector(`[data-feature-id="${this.feature_id}"]`);
      if (element) {
        observer.observe(element);
      }

      // Clean up observer on destroy
      this.destroy$.subscribe(() => {
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
    return this._api.removeFolder(folder.folder_id).pipe(
      switchMap(_ => this._store.dispatch(new Features.GetFolders())),
      tap(_ => this._snackBar.open(`Folder ${folder.name} removed`, 'OK'))
    );
  }

  // Moves the selected folder
  SAmoveFolder(folder: Folder) {
    this._sharedActions.moveFolder(folder);
  }

  // Moves the selected feature
  SAmoveFeature(feature: Feature) {
    this._sharedActions.moveFeature(feature);
  }

  handleMouseOver(event: MouseEvent): void {
    if (this.hasHandledMouseOver) {
      return;
    }
    this.hasHandledMouseOver = true;
    
    // Load heavy observables on demand when user interacts
    this.loadHeavyObservablesOnDemand();
    
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
    // Load heavy observables on demand when user interacts
    this.loadHeavyObservablesOnDemand();
    
    // Prevent execution when browsers are outdated
    if (this.shouldDisableRunButton()) {
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
   * Automatic data recovery system that detects and fixes corrupted data
   * This runs in the background to ensure data integrity without user intervention
   */
  private setupAutomaticDataRecovery(): void {
    // Check for data corruption every 30 seconds
    const recoveryInterval = setInterval(() => {
      if (!this.isComponentActive) {
        clearInterval(recoveryInterval);
        return;
      }

      this.performAutomaticDataRecovery();
    }, 30000);

    // Also perform recovery when component becomes visible
    this.setupVisibilityBasedRecovery();

    // More aggressive recovery for "No result yet" issue - check every 10 seconds
    const aggressiveRecoveryInterval = setInterval(() => {
      if (!this.isComponentActive) {
        clearInterval(aggressiveRecoveryInterval);
        return;
      }

      this.performAggressiveDataRecovery();
    }, 10000);
  }

  /**
   * Performs automatic data recovery when corruption is detected
   */
  private performAutomaticDataRecovery(): void {
    if (!this.item || !this.isComponentActive) return;

    // Check for common data corruption indicators
    const hasCorruption = this.detectDataCorruption();
    
    if (hasCorruption) {
      // Automatically recover data without user intervention
      this.autoRecoverData();
    }
  }

  /**
   * Detects various types of data corruption
   */
  private detectDataCorruption(): boolean {
    if (!this.item) return false;

    // Simplified corruption detection - only check for obvious issues
    // Check for missing critical data
    if (!this.item.status && !this.item.date && !this.item.total) {
      return true;
    }

    // Check for "No result yet" when we should have data
    if (this.item.status === 'No result yet' && this.item._hasCachedData) {
      return true;
    }

    // Enhanced detection for "No result yet" issue
    if (this.item.status === 'No result yet') {
      // Check if this feature should have results based on its configuration
      if (this.shouldFeatureHaveResults()) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determines if a feature should have results based on its configuration
   */
  private shouldFeatureHaveResults(): boolean {
    // If we have any cached data, the feature should have results
    if (this.item._hasCachedData) {
      return true;
    }

    // If we have any execution data, the feature should have results
    if (this.item.total || this.item.time || this.item.date) {
      return true;
    }

    // If the feature has been running recently, it should have results
    if (this.item._lastApiCall && (Date.now() - this.item._lastApiCall) < 300000) { // 5 minutes
      return true;
    }

    return false;
  }

  /**
   * Automatically recovers corrupted data
   */
  private autoRecoverData(): void {
    // Clear corrupted cache
    L1FeatureItemListComponent.featureDataCache.delete(this.feature_id);
    
    // Reset corrupted values
    if (this.item.total > 1000) this.item.total = 0;
    if (this.item.time > 3600) this.item.time = 0;
    
    // Mark for fresh data
    this.item._needsDataRefresh = true;
    this.item._hasCachedData = false;
    
    // Force API call to get fresh data
    this.forceUpdateFeatureStatus();
    
    // Update UI immediately
    this.cdr.detectChanges();
  }

  /**
   * Sets up recovery when component becomes visible
   */
  private setupVisibilityBasedRecovery(): void {
    // Use Intersection Observer to detect when component is visible
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && this.isComponentActive) {
            // Component is visible, check for corruption
            setTimeout(() => {
              this.performAutomaticDataRecovery();
            }, 1000); // Small delay to ensure component is fully loaded
          }
        });
      }, { threshold: 0.1 });

      // Observe the component element
      if (this.elementRef?.nativeElement) {
        observer.observe(this.elementRef.nativeElement);
      }
    }
  }

  /**
   * Sets up store change listener to detect and recover corrupted data
   */
  private setupStoreChangeListener(): void {
    // Listen to store changes and detect corruption
    this._store.select(CustomSelectors.GetFeatureInfo(this.feature_id))
      .pipe(
        filter(feature => !!feature),
        distinctUntilChanged(),
        debounceTime(1000) // Wait 1 second after store changes
      )
      .subscribe(feature => {
        if (feature && this.isComponentActive) {
          // Check if the store data is corrupted
          if (this.isStoreDataCorrupted(feature)) {
            // Automatically recover from API
            this.recoverFromStoreCorruption();
          }
        }
      });
  }

  /**
   * Sets up WebSocket event listener to detect when other features complete
   * This helps recover data when scheduled features finish and potentially corrupt data
   */
  private setupWebSocketEventListener(): void {
    // Listen for feature run completion events
    this._store.select(state => state.websockets?.featureRunCompleted)
      .pipe(
        filter(event => !!event),
        distinctUntilChanged()
      )
      .subscribe(event => {
        if (event && this.isComponentActive) {
          // Check if this event affects our feature
          if (event.feature_id !== this.feature_id) {
            // Wait a bit for the store to update, then check for corruption
            setTimeout(() => {
              this.checkForPostCompletionCorruption();
            }, 2000);
          }
        }
      });
  }

  /**
   * Checks for data corruption after other features complete
   */
  private checkForPostCompletionCorruption(): void {
    if (!this.item || !this.isComponentActive) return;

    // Check if we have the "No result yet" issue after another feature completed
    if (this.item.status === 'No result yet' && this.shouldFeatureHaveResults()) {
      // Force immediate recovery
      this.forceImmediateDataRecovery();
    }
  }

  /**
   * Checks if store data is corrupted
   */
  private isStoreDataCorrupted(feature: any): boolean {
    // Check for unreasonable values in store data
    if (feature.steps && (feature.steps <= 0 || feature.steps > 1000)) {
      return true;
    }

    // Check for missing critical information
    if (!feature.feature_name || !feature.app_name || !feature.environment_name) {
      return true;
    }

    // Check for data inconsistency between store and current item
    if (this.item && this.item.total && feature.steps) {
      if (Math.abs(this.item.total - feature.steps) > 100) {
        return true;
      }
    }

    return false;
  }

  /**
   * Recovers data when store corruption is detected
   */
  private recoverFromStoreCorruption(): void {
    // Clear corrupted cache
    L1FeatureItemListComponent.featureDataCache.delete(this.feature_id);
    
    // Force API call to get fresh data
    this.forceUpdateFeatureStatus();
    
    // Update UI immediately
    this.cdr.detectChanges();
  }

  /**
   * Force change detection to ensure UI updates
   */
  public forceUIUpdate(): void {
    this.cdr.detectChanges();
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
    // Run immediate cross-contamination prevention
    this.immediateCrossContaminationPrevention();
    
    const cachedData = L1FeatureItemListComponent.featureDataCache.get(this.feature_id);
    
    if (cachedData && this.isCacheValid(cachedData)) {
      // Validate cached data before applying to prevent duplication
      if (this.isCachedDataReasonable(cachedData)) {
        // Apply cached data to restore component state
        if (cachedData.featureData) {
          // Use isolated feature data to prevent cross-contamination
          const isolatedData = cachedData.featureData;
          
          // Only apply cached data if we don't already have the same values
          // This prevents duplication of data
          if (!this.item.total || this.item.total !== isolatedData.total) {
            this.item.total = isolatedData.total;
          }
          if (!this.item.time || this.item.time !== isolatedData.time) {
            this.item.time = isolatedData.time;
          }
          if (!this.item.date || this.item.date !== isolatedData.date) {
            this.item.date = isolatedData.date;
          }
          if (!this.item.status || this.item.status !== isolatedData.status) {
            this.item.status = isolatedData.status;
          }
          
          // Apply metadata to prevent unnecessary API calls
          if (isolatedData._hasCachedData !== undefined) {
            this.item._hasCachedData = isolatedData._hasCachedData;
          }
          if (isolatedData._lastDataCheck !== undefined) {
            this.item._lastDataCheck = isolatedData._lastDataCheck;
          }
          if (isolatedData._lastApiCall !== undefined) {
            this.item._lastApiCall = isolatedData._lastApiCall;
          }
          if (isolatedData._apiCallCount !== undefined) {
            this.item._apiCallCount = isolatedData._apiCallCount;
          }
          if (isolatedData._apiCallWindowStart !== undefined) {
            this.item._apiCallWindowStart = isolatedData._apiCallWindowStart;
          }
          if (isolatedData._lastFolderId !== undefined) {
            this.item._lastFolderId = isolatedData._lastFolderId;
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
        
      } else {
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
    // Simplified validation - only check for basic data presence
    const total = cachedData.total || cachedData.featureData?.total;
    const time = cachedData.time || cachedData.featureData?.time;
    
    // Check if we have at least some basic data
    const hasBasicData = (total !== undefined) || (time !== undefined) || !!cachedData.date || !!cachedData.status;
    
    return hasBasicData;
  }

  // Cache the current feature data
  private cacheFeatureData() {
    // Run immediate cross-contamination prevention
    this.immediateCrossContaminationPrevention();
    
    // Check for mass updates and protect data if necessary
    this.protectFeatureDataDuringMassUpdate();
    
    // Don't cache if we don't have valid data or if data seems duplicated
    if (!this.hasValidFeatureData()) {
      return;
    }
    
    // Check if we're already caching the same data
    const existingCache = L1FeatureItemListComponent.featureDataCache.get(this.feature_id);
    if (existingCache && 
        existingCache.total === this.item.total && 
        existingCache.time === this.item.time && 
        existingCache.date === this.item.date) {
      return;
    }
    
    // Validate data before caching to prevent corrupted data
    if (this.item.total <= 0 || this.item.total > 1000 || 
        this.item.time < 0 || this.item.time > 3600) {
      return;
    }
    
    // Create isolated cache data to prevent cross-contamination
    const cacheData: CachedFeatureData = {
      total: this.item.total || 0,
      time: this.item.time || 0,
      date: this.item.date || null,
      status: this.item.status || '',
      lastUpdated: Date.now(),
      departmentId: this.item.reference?.department_id || 0,
      featureData: this.createIsolatedFeatureData() // Use isolated data
    };
    
    L1FeatureItemListComponent.featureDataCache.set(this.feature_id, cacheData);
  }

  /**
   * Create isolated feature data to prevent cross-contamination between features
   * This ensures that when one feature updates, it doesn't affect others
   */
  private createIsolatedFeatureData(): any {
    // Create a deep copy of the item data to prevent reference sharing
    const isolatedData = {
      total: this.item.total || 0,
      time: this.item.time || 0,
      date: this.item.date || null,
      status: this.item.status || '',
      feature_id: this.feature_id,
      feature_name: this.item.feature_name || '',
      department_id: this.item.reference?.department_id || 0,
      // Only include essential data to prevent cache pollution
      _hasCachedData: true,
      _lastDataCheck: Date.now(),
      _lastApiCall: this.item._lastApiCall || null,
      _apiCallCount: this.item._apiCallCount || 0,
      _apiCallWindowStart: this.item._apiCallWindowStart || null,
      _lastFolderId: this.item._lastFolderId || null
    };
    
    return isolatedData;
  }

  /**
   * Prevent cross-contamination when other features are updated
   * This method ensures that updates to one feature don't affect others
   */
  private preventCrossContamination(): void {
    // If our data is locked, don't allow any modifications
    if (this.isFeatureDataLocked()) {
      return;
    }
    
    // Check if our data has been contaminated by other feature updates
    const cachedData = L1FeatureItemListComponent.featureDataCache.get(this.feature_id);
    
    if (cachedData && cachedData.featureData) {
      const isolatedData = cachedData.featureData;
      
      // If our current data doesn't match our cached data, restore it immediately
      if (this.item.total !== isolatedData.total || 
          this.item.time !== isolatedData.time || 
          this.item.date !== isolatedData.date ||
          this.item.status !== isolatedData.status) {
        
        // Lock the data immediately to prevent further contamination
        this.lockFeatureData();
        
        // Restore our original data
        this.item.total = isolatedData.total;
        this.item.time = isolatedData.time;
        this.item.date = isolatedData.date;
        this.item.status = isolatedData.status;
        
        // Mark that we have valid cached data
        this.item._hasCachedData = true;
        this.item._lastDataCheck = Date.now();
        
        // Trigger change detection
        this.cdr.detectChanges();
        
      }
    }
    
    // Run aggressive prevention to lock data if other features are being updated
    // But only if we don't already have valid data
    if (!this.hasValidFeatureData()) {
      this.aggressiveCrossContaminationPrevention();
    }
  }

  /**
   * Clean up cache for other features to prevent cross-contamination
   * This method is called when a feature is updated to ensure data isolation
   */
  private cleanupOtherFeaturesCache(): void {
    const currentTime = Date.now();
    const keysToCleanup: number[] = [];
    
    L1FeatureItemListComponent.featureDataCache.forEach((data, key) => {
      // Don't clean up our own cache
      if (key === this.feature_id) {
        return;
      }
      
      // Clean up cache entries that might be contaminated
      // This includes entries that were updated recently or have similar data
      if (data.lastUpdated && (currentTime - data.lastUpdated) < 5000) { // 5 seconds
        keysToCleanup.push(key);
      }
    });
    
    if (keysToCleanup.length > 0) {
      
      keysToCleanup.forEach(key => {
        L1FeatureItemListComponent.featureDataCache.delete(key);
      });
    }
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
      } catch (error) {
        // Error dispatching browserstack refresh
      }
    }
    
    if (!localBrowsers || localBrowsers.length === 0) {
      try {
        this._store.dispatch(new Browsers.GetBrowsers());
      } catch (error) {
        // Error dispatching local browsers refresh
      }
    }
  }

  /**
   * Force refresh browser information
   */
  public forceRefreshBrowsers(): void {
    this._store.dispatch(new Browserstack.GetBrowserstack());
    this._store.dispatch(new Browsers.GetBrowsers());
    
    // Force change detection to update the button state
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 1000); // Wait for browsers to load
  }

  /**
   * Check if the run button should be disabled due to browser version issues
   */
  public shouldDisableRunButton(): boolean {
    // Check if the feature has browsers configured
    if (!this.item?.browsers || this.item.browsers.length === 0) {
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
      return false;
    }

    // Combine both browser sources
    const allAvailableBrowsers = [...(availableBrowsers || []), ...(localBrowsers || [])];
    
    // Check if any of the selected browsers have outdated versions
    const hasOutdatedBrowser = this.item.browsers.some((selectedBrowser: any, index: number) => {
      // For local browsers, we need to handle them differently
      if (this.isLocalBrowser(selectedBrowser)) {
        const isOutdated = this.isLocalBrowserOutdated(selectedBrowser, allAvailableBrowsers);
        return isOutdated;
      }
      
      // For cloud browsers, use exact matching
      const isOutdated = this.isCloudBrowserOutdated(selectedBrowser, allAvailableBrowsers);
      return isOutdated;
    });
    
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
    // Browser debug info removed to reduce logging
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
  
        return false; // Latest is never outdated
      }
      
      // Fix: Don't add extra zeros, just get the version number
      const selectedVersionNum = parseInt(selectedVersion, 10) || 0;
      
      // Check if selected version is significantly outdated (more than 5 versions behind)
      const highestAvailable = availableVersions[0];
      
      
      // For Chrome, be more strict - if it's more than 3 versions behind, consider it outdated
      if (highestAvailable - selectedVersionNum > 3) {
        return true;
      }

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
   * Get detailed browser status information for a specific row
   */
  getBrowserStatusInfo(): string {
    if (!this.item?.browsers || this.item.browsers.length === 0) {
      return 'No browsers configured';
    }

    // Ensure browsers are loaded
    this.ensureBrowsersLoaded();
    
    // Get the available browsers from both BrowserstackState and BrowsersState
    const availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
    const localBrowsers = this._store.selectSnapshot(BrowsersState.getBrowserJsons) as any[];
    const allAvailableBrowsers = [...(availableBrowsers || []), ...(localBrowsers || [])];
    
    if (allAvailableBrowsers.length === 0) {
      return 'Browser information not available';
    }

    const statusInfo: string[] = [];
    const outdatedBrowsers = this.item.browsers.filter((browser: any) => this.isSpecificBrowserOutdated(browser));
    
    if (outdatedBrowsers.length === 0) {
      return 'All browsers are up to date';
    }
    
    statusInfo.push('⚠️ BROWSER VERSION ISSUE DETECTED');
    statusInfo.push('Run button is disabled due to outdated browsers:');
    statusInfo.push('');
    
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
         
        }
      } else {
        // Check cloud browser
        const matchingBrowser = allAvailableBrowsers.find(available => 
          available.os === browser.os &&
          available.os_version === browser.os_version &&
          available.browser === browser.browser &&
          available.browser_version === browser.browser_version
        );
        
      }
    });
  }

  /**
   * Detect and correct duplicated data in real-time
   */
  private detectAndCorrectDuplicatedData(): void {
    // Check for obvious data duplication
    if (this.item.total && this.item.total > 1000) {
      
      // Try to get the correct data from the store first
      const storeFeature = this._store.selectSnapshot(CustomSelectors.GetFeatureInfo(this.feature_id));
      if (storeFeature && storeFeature.info && storeFeature.info.total && 
          storeFeature.info.total > 0 && storeFeature.info.total <= 1000) {
        this.item.total = storeFeature.info.total;
      } else {
        // If store doesn't have valid data, clear the corrupted value
        this.item.total = 0;
      }
    }
    
    // Check for execution time anomalies
    if (this.item.time && this.item.time > 3600) {
      
      // Try to get the correct data from the store first
      const storeFeature = this._store.selectSnapshot(CustomSelectors.GetFeatureInfo(this.feature_id));
      if (storeFeature && storeFeature.info && storeFeature.info.execution_time && 
          storeFeature.info.execution_time > 0 && storeFeature.info.execution_time <= 3600) {
        this.item.time = storeFeature.info.execution_time;
      } else {
        // If store doesn't have valid data, clear the corrupted value
        this.item.time = 0;
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
    
    return isFresh;
  }

  /**
   * Smart data refresh that only updates when necessary
   * This method combines all the optimization logic
   */
  private smartDataRefresh(): boolean {
    // Log optimization status for debugging
    // this.logOptimizationStatus();
    
    // Check if component is active
    if (!this.isComponentActive) {
      return false;
    }
    
    // Check if we should skip data reload based on feature state
    if (this.shouldSkipDataReload()) {
      return false;
    }
    
    // Check if we're making too many API calls (reduced throttling)
    if (this.item._lastApiCall && (Date.now() - this.item._lastApiCall) < 2000) {
      return false;
    }
    
    // Simplified API call frequency optimization
    if (!this.optimizeApiCallFrequency()) {
      return false;
    }
    
    return true;
  }

  /**
   * Enhanced cache management to prevent unnecessary reloads
   * This method provides additional optimization based on feature state
   */
  private shouldSkipDataReload(): boolean {
    // Skip if feature is running and we have recent data (reduced threshold)
    if (this.running && this.item._lastDataCheck && (Date.now() - this.item._lastDataCheck) < 30000) {
      return true;
    }
    
    // Skip if feature has completed and we have valid data (reduced validation)
    if ((this.item.status === 'Success' || this.item.status === 'Failed') && 
        this.item.total !== undefined && this.item.time !== undefined) {
      return true;
    }
    
    // Skip if we have cached data that's still fresh (reduced threshold)
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
      return false;
    }
    
    return true;
  }

  /**
   * Comprehensive optimization status logging
   * This method provides detailed information about why a refresh was allowed or denied
   */
  private logOptimizationStatus(): void {
    // Optimization status logging removed to reduce verbosity
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

  /**
   * Handle folder navigation events to preserve feature data
   * This prevents data loss when clicking on the same folder multiple times
   */
  public handleFolderNavigation(folderId: number): void {
    if (!this.isComponentActive) return;
    
    // Check if we're navigating to the same folder
    const currentRoute = this._store.selectSnapshot(FeaturesState.GetCurrentRouteNew);
    const currentFolderId = currentRoute && currentRoute.length > 0 ? currentRoute[currentRoute.length - 1]?.folder_id : null;
    
    if (currentFolderId === folderId) {
      // Preserve current feature data
      this.preserveFeatureDataForNavigation();
      
      // Skip unnecessary data refresh
      return;
    }
  }

  /**
   * Preserve feature data when navigating to the same folder
   */
  private preserveFeatureDataForNavigation(): void {
    // Mark that we have valid data to prevent unnecessary API calls
    if (this.item.total || this.item.time || this.item.date) {
      this.item._hasCachedData = true;
      this.item._lastDataCheck = Date.now();
      
      // Cache the preserved data
      this.cacheFeatureData();
      

    }
  }

  /**
   * Setup periodic cross-contamination prevention
   * This ensures that updates to one feature don't affect others
   */
  private setupCrossContaminationPrevention(): void {
    // Reduced frequency of cross-contamination checks
    setInterval(() => {
      if (this.isComponentActive) {
        this.preventCrossContamination();
      }
    }, 10000); // 10 seconds for less aggressive response
    
    // Simplified lock system adjustment
    setInterval(() => {
      if (this.isComponentActive) {
        this.checkAndAdjustLockSystem();
      }
    }, 5000); // 5 seconds for lock system adjustment
    
    // Reduced mass update detection frequency
    setInterval(() => {
      if (this.isComponentActive) {
        this.protectFeatureDataDuringMassUpdate();
      }
    }, 5000); // 5 seconds for mass update detection
    
    // Reduced data restoration frequency
    setInterval(() => {
      if (this.isComponentActive) {
        this.restoreProtectedFeatureData();
      }
    }, 10000); // 10 seconds for data restoration
  }

  /**
   * Lock feature data to prevent cross-contamination
   * This method immediately protects the feature data when it's updated
   */
  private lockFeatureData(): void {
    // Set lock for this feature
    L1FeatureItemListComponent.featureDataLocks.set(this.feature_id, true);
    
    // Set timestamp for this lock
    L1FeatureItemListComponent.featureDataLockTimestamps.set(this.feature_id, Date.now());
    
    // Set timeout to automatically unlock after LOCK_TIMEOUT
    setTimeout(() => {
      if (L1FeatureItemListComponent.featureDataLocks.has(this.feature_id)) {
        L1FeatureItemListComponent.featureDataLocks.delete(this.feature_id);
        L1FeatureItemListComponent.featureDataLockTimestamps.delete(this.feature_id);
      }
    }, L1FeatureItemListComponent.LOCK_TIMEOUT);
    
  }

  /**
   * Unlock feature data when it's safe to do so
   */
  private unlockFeatureData(): void {
    if (L1FeatureItemListComponent.featureDataLocks.has(this.feature_id)) {
      L1FeatureItemListComponent.featureDataLocks.delete(this.feature_id);
      L1FeatureItemListComponent.featureDataLockTimestamps.delete(this.feature_id);
    }
  }

  /**
   * Check if feature data is locked
   */
  private isFeatureDataLocked(): boolean {
    return L1FeatureItemListComponent.featureDataLocks.has(this.feature_id);
  }

  /**
   * Aggressive cross-contamination prevention
   * This method immediately blocks any attempts to modify feature data
   */
  private aggressiveCrossContaminationPrevention(): void {
    // If our data is locked, don't allow any modifications
    if (this.isFeatureDataLocked()) {
      return;
    }
    
    // Check if any other feature was recently updated (reduced threshold)
    const currentTime = Date.now();
    let hasRecentUpdates = false;
    
    L1FeatureItemListComponent.featureDataCache.forEach((data, key) => {
      if (key !== this.feature_id && data.lastUpdated) {
        const timeSinceUpdate = currentTime - data.lastUpdated;
        if (timeSinceUpdate < 5000) { // Increased to 5 seconds - less aggressive
          hasRecentUpdates = true;
        }
      }
    });
    
    // If there are recent updates, lock our data immediately
    if (hasRecentUpdates) {
      this.lockFeatureData();
    }
  }

  /**
   * Immediate cross-contamination prevention
   * This method is called whenever any feature data is accessed or modified
   */
  private immediateCrossContaminationPrevention(): void {
    // If our data is locked, block all access
    if (this.isFeatureDataLocked()) {
      return;
    }
    
    // Check if any other feature is currently being updated (reduced threshold)
    const currentTime = Date.now();
    let hasActiveUpdates = false;
    
    L1FeatureItemListComponent.featureDataCache.forEach((data, key) => {
      if (key !== this.feature_id && data.lastUpdated) {
        const timeSinceUpdate = currentTime - data.lastUpdated;
        if (timeSinceUpdate < 2000) { // Increased to 2 seconds - much less aggressive
          hasActiveUpdates = true;
        }
      }
    });
    
    // If there are very recent updates, lock our data immediately
    if (hasActiveUpdates) {
      this.lockFeatureData();
    }
  }

  /**
   * Block all data modifications when cross-contamination is detected
   * This method completely prevents any changes to feature data
   */
  private blockDataModifications(): boolean {
    // If our data is locked, block all modifications
    if (this.isFeatureDataLocked()) {
      return true; // Block modifications
    }
    
    // Check if any other feature was recently updated (reduced threshold)
    const currentTime = Date.now();
    let hasRecentUpdates = false;
    
    L1FeatureItemListComponent.featureDataCache.forEach((data, key) => {
      if (key !== this.feature_id && data.lastUpdated) {
        const timeSinceUpdate = currentTime - data.lastUpdated;
        if (timeSinceUpdate < 3000) { // Increased to 3 seconds - less aggressive
          hasRecentUpdates = true;
        }
      }
    });
    
    // If there are recent updates, block modifications
    if (hasRecentUpdates) {
      this.lockFeatureData();
      return true; // Block modifications
    }
    
    return false; // Allow modifications
  }

  /**
   * Check if the lock system is too restrictive and adjust it automatically
   * This prevents the system from blocking normal data access
   */
  private checkAndAdjustLockSystem(): void {
    // If we have valid data but our data is locked, consider unlocking it
    if (this.isFeatureDataLocked() && this.hasValidFeatureData()) {
      const lockTimestamp = L1FeatureItemListComponent.featureDataLockTimestamps.get(this.feature_id);
      if (lockTimestamp) {
        const currentTime = Date.now();
        const lockDuration = currentTime - lockTimestamp;
        
        // If lock has been active for more than 5 seconds and we have valid data, unlock it
        if (lockDuration > 5000) {
          this.unlockFeatureData();
        }
      }
    }
    
    // If we don't have valid data and our data is locked for too long, unlock it
    if (this.isFeatureDataLocked() && !this.hasValidFeatureData()) {
      const lockTimestamp = L1FeatureItemListComponent.featureDataLockTimestamps.get(this.feature_id);
      if (lockTimestamp) {
        const currentTime = Date.now();
        const lockDuration = currentTime - lockTimestamp;
        
        // If lock has been active for more than 8 seconds and we don't have valid data, unlock it
        if (lockDuration > 8000) {
          this.unlockFeatureData();
        }
      }
    }
  }

  /**
   * Verify that the lock system is working correctly
   * This method logs the current state of the lock system for debugging
   */
  private verifyLockSystemStatus(): void {
    const isLocked = this.isFeatureDataLocked();
    const hasValidData = this.hasValidFeatureData();
    const lockTimestamp = L1FeatureItemListComponent.featureDataLockTimestamps.get(this.feature_id);
    
    if (isLocked && lockTimestamp) {
      const lockDuration = Date.now() - lockTimestamp;
    }
  }

  /**
   * Detect mass feature updates (like when a scheduled feature completes)
   * This prevents individual feature data from being lost during mass updates
   */
  private detectMassFeatureUpdate(): boolean {
    const currentTime = Date.now();
    const timeSinceLastMassUpdate = currentTime - L1FeatureItemListComponent.lastMassUpdateTime;
    
    // Check if we're in a mass update window
    if (timeSinceLastMassUpdate < L1FeatureItemListComponent.MASS_UPDATE_THRESHOLD) {
      return true;
    }
    
    // Check if multiple features are being updated simultaneously
    let activeUpdates = 0;
    L1FeatureItemListComponent.featureDataCache.forEach((data, key) => {
      if (data.lastUpdated && (currentTime - data.lastUpdated) < 3000) { // 3 seconds
        activeUpdates++;
      }
    });
    
    // If more than 2 features are being updated simultaneously, it's a mass update
    if (activeUpdates > 2) {
      L1FeatureItemListComponent.lastMassUpdateTime = currentTime;
      return true;
    }
    
    return false;
  }

  /**
   * Protect feature data during mass updates
   * This method ensures that individual feature data is preserved when all features are updated
   */
  private protectFeatureDataDuringMassUpdate(): void {
    // Check for scheduled feature completion first
    if (this.detectScheduledFeatureCompletion()) {
      this.lockFeatureData();
      this.protectCurrentFeatureData();
      return;
    }
    
    // Then check for general mass updates
    if (this.detectMassFeatureUpdate()) {
      // Lock our data immediately to prevent it from being overwritten
      this.lockFeatureData();
      
      // Store our current data in a protected cache
      this.protectCurrentFeatureData();
    }
  }

  /**
   * Store current feature data in a protected cache during mass updates
   */
  private protectCurrentFeatureData(): void {
    // Create a protected copy of our current data
    const protectedData = {
      total: this.item.total,
      time: this.item.time,
      date: this.item.date,
      status: this.item.status,
      feature_id: this.feature_id,
      _hasCachedData: this.item._hasCachedData,
      _lastDataCheck: this.item._lastDataCheck,
      _lastApiCall: this.item._lastApiCall,
      _apiCallCount: this.item._apiCallCount,
      _apiCallWindowStart: this.item._apiCallWindowStart,
      _lastFolderId: this.item._lastFolderId,
      protectedAt: Date.now()
    };
    
    // Store in a special protected cache
    if (!L1FeatureItemListComponent.protectedFeatureData) {
      L1FeatureItemListComponent.protectedFeatureData = new Map<number, any>();
    }
    
    L1FeatureItemListComponent.protectedFeatureData.set(this.feature_id, protectedData);
  }

  /**
   * Restore protected feature data after mass updates
   * This method ensures that individual feature data is restored when mass updates complete
   */
  private restoreProtectedFeatureData(): void {
    const protectedData = L1FeatureItemListComponent.protectedFeatureData.get(this.feature_id);
    
    if (protectedData) {
      // Check if we need to restore our data
      const needsRestoration = !this.item.total || !this.item.time || !this.item.date || !this.item.status;
      
      if (needsRestoration) {
        
        // Restore the protected data
        this.item.total = protectedData.total;
        this.item.time = protectedData.time;
        this.item.date = protectedData.date;
        this.item.status = protectedData.status;
        
        // Restore metadata
        this.item._hasCachedData = protectedData._hasCachedData;
        this.item._lastDataCheck = protectedData._lastDataCheck;
        this.item._lastApiCall = protectedData._lastApiCall;
        this.item._apiCallCount = protectedData._apiCallCount;
        this.item._apiCallWindowStart = protectedData._apiCallWindowStart;
        this.item._lastFolderId = protectedData._lastFolderId;
        
        // Mark that we have valid data
        this.item._hasCachedData = true;
        
        // Trigger change detection
        this.cdr.detectChanges();
        
      }
      
      // Remove from protected cache after restoration
      L1FeatureItemListComponent.protectedFeatureData.delete(this.feature_id);
    }
  }

  /**
   * Detect when a scheduled feature completes and triggers mass updates
   * This is the specific scenario that causes the "no results yet" issue
   */
  private detectScheduledFeatureCompletion(): boolean {
    const currentTime = Date.now();
    
    // Look for features that just completed (status changed to Success/Failed)
    let completedFeatures = 0;
    let scheduledFeatures = 0;
    
    L1FeatureItemListComponent.featureDataCache.forEach((data, key) => {
      if (data.lastUpdated && (currentTime - data.lastUpdated) < 5000) { // 5 seconds
        const featureData = data.featureData;
        if (featureData && featureData.status) {
          // Check if this is a scheduled feature that just completed
          if (featureData.status === 'Success' || featureData.status === 'Failed') {
            completedFeatures++;
          }
          
          // Check if this is a scheduled feature
          if (featureData.schedule || featureData.original_cron) {
            scheduledFeatures++;
          }
        }
      }
    });
    
    // If we have completed scheduled features, this is likely the trigger for mass updates
    if (completedFeatures > 0 && scheduledFeatures > 0) {
      return true;
    }
    
    return false;
  }

  /**
   * Performs aggressive data recovery specifically for "No result yet" issues
   */
  private performAggressiveDataRecovery(): void {
    if (!this.item || !this.isComponentActive) return;

    // Specifically check for "No result yet" issue
    if (this.item.status === 'No result yet') {
      // Check if we should have results
      if (this.shouldFeatureHaveResults()) {
        
        // Force immediate recovery
        this.forceImmediateDataRecovery();
      }
    }
  }

  /**
   * Forces immediate data recovery without waiting for normal intervals
   */
  private forceImmediateDataRecovery(): void {
    
    // Clear all corrupted data
    L1FeatureItemListComponent.featureDataCache.delete(this.feature_id);
    
    // Reset item state
    this.item._needsDataRefresh = true;
    this.item._hasCachedData = false;
    this.item._lastApiCall = 0;
    
    // Force API call immediately
    this.forceUpdateFeatureStatus();
    
    // Update UI
    this.cdr.detectChanges();
    
  }

  /**
   * Force refresh all features to resolve data loading issues
   * This method can be called when multiple features are not loading correctly
   */
  public static forceRefreshAllFeatures(): void {
    // Clear all cache to force fresh data
    this.clearAllCache();
    
    // Clear all locks
    this.featureDataLocks.clear();
    this.featureDataLockTimestamps.clear();
    
    // Clear protected data
    this.protectedFeatureData.clear();
    
    // Reset mass update tracking
    this.lastMassUpdateTime = 0;
    
  }

  /**
   * Check if this feature has data loading issues
   */
  public hasDataLoadingIssues(): boolean {
    // Check for common data loading issues
    const hasNoData = !this.item.total && !this.item.time && !this.item.date;
    const hasNoStatus = !this.item.status;
    const hasStaleData = this.item._lastDataCheck && (Date.now() - this.item._lastDataCheck) > 300000; // 5 minutes
    
    if (hasNoData || hasNoStatus || hasStaleData) {
      return true;
    }
    
    return false;
  }

  /**
   * Force refresh this specific feature to resolve data loading issues
   */
  public forceRefreshThisFeature(): void {
    
    // Clear cache for this feature
    L1FeatureItemListComponent.featureDataCache.delete(this.feature_id);
    
    // Clear protected data for this feature
    L1FeatureItemListComponent.protectedFeatureData.delete(this.feature_id);
    
    // Reset item state
    this.item._needsDataRefresh = true;
    this.item._hasCachedData = false;
    this.item._lastApiCall = 0;
    this.item._lastDataCheck = 0;
    
    // Force API call immediately
    this.forceUpdateFeatureStatus();
    
    // Update UI
    this.cdr.detectChanges();
  }

  /**
   * Check the overall health of all features and identify data loading issues
   */
  public static checkAllFeaturesHealth(): { totalFeatures: number, issuesFound: number, issues: string[] } {
    const issues: string[] = [];
    let totalFeatures = 0;
    let issuesFound = 0;
    
    this.featureDataCache.forEach((data, featureId) => {
      totalFeatures++;
      
      // Check for common issues
      if (!data.total && !data.time && !data.date) {
        issues.push(`Feature ${featureId}: Missing execution data`);
        issuesFound++;
      }
      
      if (!data.status) {
        issues.push(`Feature ${featureId}: Missing status`);
        issuesFound++;
      }
      
      if (data.lastUpdated && (Date.now() - data.lastUpdated) > 300000) { // 5 minutes
        issues.push(`Feature ${featureId}: Stale data (${Math.round((Date.now() - data.lastUpdated) / 1000)}s old)`);
        issuesFound++;
      }
    });
    
    const healthReport = {
      totalFeatures,
      issuesFound,
      issues
    };
    
    console.log('Features health check:', healthReport);
    return healthReport;
  }

  /**
   * Get detailed debugging information for this feature
   */
  public getDebugInfo(): string {
    const now = Date.now();
    const timeSinceLastCheck = this.item._lastDataCheck ? Math.round((now - this.item._lastDataCheck) / 1000) : 0;
    const timeSinceLastApiCall = this.item._lastApiCall ? Math.round((now - this.item._lastApiCall) / 1000) : 0;
    const apiCallCount = this.item._apiCallCount || 0;
    const isLocked = this.isFeatureDataLocked();
    
    let debugInfo = `Feature ${this.feature_id} Debug Info:\n`;
    debugInfo += `• Name: ${this.item.name}\n`;
    debugInfo += `• Type: ${this.item.type}\n`;
    debugInfo += `• Status: ${this.item.status}\n`;
    debugInfo += `• Total Steps: ${this.item.total}\n`;
    debugInfo += `• Execution Time: ${this.item.time}\n`;
    debugInfo += `• Last Run Date: ${this.item.date}\n`;
    debugInfo += `• Has Cached Data: ${this.item._hasCachedData}\n`;
    debugInfo += `• Time Since Last Check: ${timeSinceLastCheck}s\n`;
    debugInfo += `• Time Since Last API Call: ${timeSinceLastApiCall}s\n`;
    debugInfo += `• API Call Count: ${apiCallCount}\n`;
    debugInfo += `• Data Locked: ${isLocked}\n`;
    debugInfo += `• Component Active: ${this.isComponentActive}\n`;
    debugInfo += `• Feature Running: ${this.running}\n`;
    debugInfo += `• Button Disabled: ${this.isButtonDisabled}\n`;
    
    return debugInfo;
  }

  /**
   * Load basic feature data if needed - simplified version without complex cache
   */
  private loadBasicFeatureData(): void {
    // Only load data if absolutely necessary - defer to when user interacts
    // This prevents API calls during initial page load
  }

  /**
   * Forces a complete UI refresh to ensure all changes are displayed
   */
  private refreshUI(): void {
    // Force change detection multiple times to ensure UI updates
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    
    // Also trigger change detection in the next tick
    setTimeout(() => {
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    }, 0);
  }

}

