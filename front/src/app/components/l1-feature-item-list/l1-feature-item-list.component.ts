/**
 * l1-feature-item-list.component.ts
 *
 * Contains the code to control the behaviour of the item list (each feature is a squared item) in the new landing
 *
 * @author dph000
 */
import { Component, OnInit, Input, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { Observable, switchMap, tap, map, filter, take, Subject } from 'rxjs';
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
  finder: boolean = false;
  running: boolean = false;
  isButtonDisabled: boolean = false;
  running$: Observable<boolean>;
  private lastClickTime: number = 0;
  private readonly CLICK_DEBOUNCE_TIME: number = 1000; // 1 second debounce time

  /**
   * Global variables
   */
  feature$: Observable<Feature>;
  featureRunning$: Observable<boolean>;
  featureStatus$: Observable<string>;
  canEditFeature$: Observable<boolean>;
  canDeleteFeature$: Observable<boolean>;
  isAnyFeatureRunning$: Observable<boolean>;
  departmentFolders$: Observable<Folder[]>;
  isStarred$: Observable<boolean>;
  lastFeatureResult$: Observable<FeatureResult>;
  

  // NgOnInit
  ngOnInit() {
    this.log.msg('1', 'Initializing component...', 'feature-item-list');

    // Set up intersection observer to detect when component is visible
    this.setupIntersectionObserver();

    // Only set up essential observables initially
    this.setupEssentialObservables();
    
    // Defer other observables until component is active
    this.setupDeferredObservables();
  }

  private setupEssentialObservables() {
    // Essential observables that are always needed
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

    // Subscribe to the status message coming from NGXS with optimization
    this.featureStatus$ = this._store.select(
      CustomSelectors.GetFeatureStatus(this.feature_id)
    ).pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
      filter(() => this.isComponentActive), // Only process if component is active
      tap(status => {
        // Only update when feature actually completes and we haven't already processed it
        if ((status === 'Feature completed' || status === 'completed' || status === 'success' || status === 'failed' || status === 'canceled' || status === 'stopped') && 
            this.item.status !== status) {
          // Update local status to prevent repeated processing
          this.item.status = status;
          
          // Only dispatch update if we don't have the latest data
          if (!this.item.total || !this.item.time || !this.item.date) {
            this._store.dispatch(new Features.UpdateFeature(this.feature_id));
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
      })
    );

    // Subscribe to feature updates to refresh the item data with optimization
    this.feature$.pipe(
      distinctUntilChanged(),
      take(1), // Only take the first emission to avoid repeated API calls
      filter(() => this.isComponentActive) // Only execute if component is active
    ).subscribe(feature => {
      // Get the latest feature result directly from the API to ensure we have the most recent data
      this._api.getFeatureResultsByFeatureId(this.feature_id, {
        archived: false,
        page: 1,
        size: 1,
      }).subscribe({
        next: (response: any) => {
          if (response && response.results && response.results.length > 0 && this.isComponentActive) {
            const latestResult = response.results[0];
            
            // Update the item with the latest feature result information
            this.item.total = latestResult.total || 0;
            this.item.time = latestResult.execution_time || 0;
            this.item.date = latestResult.result_date || null;
            
            this.cdr.detectChanges();
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
      })
    );

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
    this.isAnyFeatureRunning$ = this._sharedActions.folderRunningStates.asObservable().pipe(
      map(runningStates => runningStates.get(this.item.id) || false),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.departmentFolders$ = this._store.select(CustomSelectors.GetDepartmentFolders()).pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this._sharedActions.filterState$.pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    ).subscribe(isActive => {
      this.finder = isActive;
    });

    this.isStarred$ = this.starredService.isStarred(this.feature_id).pipe(
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  ngOnDestroy() {
    this.isComponentActive = false;
    this.destroy$.next();
    this.destroy$.complete();
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

    // Prevent clicks when button is disabled and feature is not running
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

    this.isButtonDisabled = true;
    this.cdr.detectChanges();

    try {
      await this._sharedActions.run(this.item.id);
    } catch (error) {
      this.isButtonDisabled = false;
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

}

