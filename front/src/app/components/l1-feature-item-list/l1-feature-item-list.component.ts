/**
 * l1-feature-item-list.component.ts
 *
 * Contains the code to control the behaviour of the item list (each feature is a squared item) in the new landing
 *
 * @author dph000
 */
import { Component, OnInit, Input, ChangeDetectorRef, OnDestroy, TrackByFunction } from '@angular/core';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { Observable, switchMap, tap, map, filter, take, Subject, BehaviorSubject } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { observableLast, Subscribe } from 'ngx-amvara-toolbox';
import { NavigationService } from '@services/navigation.service';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { SharedActionsService } from '@services/shared-actions.service';
import { Features } from '@store/actions/features.actions';
import { AddFolderComponent } from '@dialogs/add-folder/add-folder.component';
import { ApiService } from '@services/api.service';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { LogService } from '@services/log.service';
import { FeatureRunningPipe } from '../../pipes/feature-running.pipe';
import { DepartmentNamePipe } from '@pipes/department-name.pipe';
import { BrowserComboTextPipe } from '../../pipes/browser-combo-text.pipe';
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
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
    MatLegacyTooltipModule,
    NgClass,
    MatIconModule,
    StopPropagationDirective,
    MatLegacyProgressSpinnerModule,
    NgSwitch,
    NgSwitchCase,
    MatLegacyButtonModule,
    MatLegacyMenuModule,
    MatDividerModule,
    MatLegacyCheckboxModule,
    TranslateModule,
    AmParsePipe,
    AmDateFormatPipe,
    SecondsToHumanReadablePipe,
    BrowserComboTextPipe,
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
    this.log.msg('1', 'Initializing component...', 'feature-item-list');

    // Initialize cache if not already done
    if (!L1FeatureItemListComponent.cacheInitialized) {
      L1FeatureItemListComponent.initializeCache();
    }

    // Apply cached data if available
    this.applyCachedData();

    // Ensure button is in correct state on initialization
    // Check if feature is currently running and set button state accordingly
    if (this.item.status && (this.item.status === 'running' || this.item.status === 'pending')) {
      this.running = true;
      this.isButtonDisabled = true;
    } else {
      this.running = false;
      this.isButtonDisabled = false;
    }
    
    // Set up safety timeout to re-enable button if stuck
    this.initSafetyTimeout = setTimeout(() => {
      if (this.isButtonDisabled && !this.running && this.isComponentActive) {
        this.forceReenableButton();
      }
    }, 10000); // 10 seconds timeout

    // Set up intersection observer to detect when component is visible
    this.setupIntersectionObserver();

    // Only set up essential observables initially
    this.setupEssentialObservables();
    
    // Defer other observables until component is active
    this.setupDeferredObservables();
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
          
          // Force update of feature status from API to get the real result
          this.forceUpdateFeatureStatus();
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
      // Check if we already have cached data to avoid unnecessary API calls
      if (this.item._hasCachedData && this.item.total && this.item.time && this.item.date) {
        this.log.msg('1', `Using cached data for feature ${this.feature_id}`, 'feature-item-list');
        return;
      }

      // Get the latest feature result directly from the API to ensure we have the most recent data
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
            
            // Ensure button state is correct after updating feature data
            if (!this.running) {
              this.isButtonDisabled = false;
            }
          }
        },
        error: (err) => {
          if (this.isComponentActive) {
            console.error('Error fetching feature results:', err);
          }
        }
      });
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
        if (!running && this.running) {
          // Feature just stopped running, refresh results to get real status
          setTimeout(() => {
            if (this.isComponentActive) {
              this.forceUpdateFeatureStatus();
            }
          }, 1000); // Wait 1 second for the backend to update the results
          
          // Also check for completion after a longer delay
          setTimeout(() => {
            if (this.isComponentActive) {
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
    if (!this.isComponentActive) return;
    
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
    if (!this.isComponentActive) return;
    
    // Dispatch action to update feature data
    this._store.dispatch(new Features.UpdateFeature(this.feature_id));
    
    // Also refresh results directly from API
    setTimeout(() => {
      if (this.isComponentActive) {
        this.refreshFeatureResults();
      }
    }, 500); // Wait 500ms for the store action to complete
  }

  /**
   * Update feature status from the latest result
   */
  private updateFeatureStatusFromResult(result: any) {
    if (!result || !this.isComponentActive) return;
    
    // Update the item with the latest feature result information
    this.item.total = result.total || 0;
    this.item.time = result.execution_time || 0;
    this.item.date = result.result_date || null;
    
    // Update the status with the real result status from the API
    if (result.status) {
      this.item.status = result.status;
    }
    
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
    if (!this.running && (!this.item.status || this.item.status === 'running' || this.item.status === 'pending')) {
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
      const browserType = browser.browser;
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
        const version = browsers[0].browser_version || 'latest';
        tooltipLines.push(`${browserType} ${version}`);
      } else {
        // Multiple versions
        const versions = browsers.map(browser => browser.browser_version || 'latest').join(', ');
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
   * Get tooltip for unique browser showing all versions
   */
  getUniqueBrowserTooltip(browserType: string): string {
    if (!this.item.browsers || this.item.browsers.length === 0) {
      return '';
    }
    
    // Get all browsers of this type
    const browsersOfType = this.item.browsers.filter(browser => browser.browser === browserType);
    
    if (browsersOfType.length === 1) {
      return `${browserType} ${browsersOfType[0].browser_version || ''}`.trim();
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
      // Apply cached data to restore component state
      if (cachedData.featureData) {
        // Use complete feature data if available
        Object.assign(this.item, cachedData.featureData);
      } else {
        // Fallback to individual properties
        this.item.total = cachedData.total;
        this.item.time = cachedData.time;
        this.item.date = cachedData.date;
        this.item.status = cachedData.status;
      }
      
      // Mark that we have cached data
      this.item._hasCachedData = true;
      
      // Ensure button state is correct when applying cached data
      if (!this.running) {
        this.isButtonDisabled = false;
      }
      
      this.log.msg('1', `Applied cached data for feature ${this.feature_id}`, 'feature-item-list');
    }
  }

  // Check if cached data is still valid
  private isCacheValid(cachedData: CachedFeatureData): boolean {
    const now = Date.now();
    const isExpired = (now - cachedData.lastUpdated) > L1FeatureItemListComponent.CACHE_EXPIRATION_TIME;
    const departmentMatches = cachedData.departmentId === this.item.reference?.department_id;
    
    return !isExpired && departmentMatches;
  }

  // Cache the current feature data
  private cacheFeatureData() {
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
  }

  // Static method to initialize the cache system
  static initializeCache() {
    if (this.cacheInitialized) return;
    
    this.cacheInitialized = true;
    
    // Set up periodic cache cleanup
    setInterval(() => {
      this.clearExpiredCache();
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

  // Static trackBy function for *ngFor optimization
  static trackByFeatureId(index: number, item: any): number {
    return item.id || item.feature_id || index;
  }

}

