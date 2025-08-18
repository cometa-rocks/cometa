/**
 * l1-feature-list.component.ts
 *
 * Contains the code to control the behaviour of the features list of the new landing
 *
 * @author: dph000
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
  ChangeDetectorRef,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { Select, Store } from '@ngxs/store';
import { SharedActionsService } from '@services/shared-actions.service';
import { BehaviorSubject, Observable, switchMap, tap, filter, take, map } from 'rxjs';
import { MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { MatLegacyPaginator as MatPaginator } from '@angular/material/legacy-paginator';
import { MatSort } from '@angular/material/sort';
import { Features } from '@store/actions/features.actions';
import { Subscribe } from 'ngx-amvara-toolbox';
import { AddFolderComponent } from '@dialogs/add-folder/add-folder.component';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { ApiService } from '@services/api.service';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { UserState } from '@store/user.state';
import { CustomSelectors } from '@others/custom-selectors';
import { Configuration } from '@store/actions/config.actions';
import { LogService } from '@services/log.service';
import { FeatureRunningPipe } from '../../pipes/feature-running.pipe';
import { DepartmentNamePipe } from '@pipes/department-name.pipe';
import { HasPermissionPipe } from '../../pipes/has-permission.pipe';
import { BrowserComboTextPipe } from '../../pipes/browser-combo-text.pipe';
import { LoadingPipe } from '@pipes/loading.pipe';
import { BrowserIconPipe } from '@pipes/browser-icon.pipe';
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatIconModule } from '@angular/material/icon';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import {
  NgIf,
  NgClass,
  NgSwitch,
  NgSwitchCase,
  NgSwitchDefault,
  NgFor,
  AsyncPipe,
  LowerCasePipe,
} from '@angular/common';
import { MtxGridModule } from '@ng-matero/extensions/grid';
import { LetDirective } from '../../directives/ng-let.directive';
import { StarredService } from '@services/starred.service';
import { Router } from '@angular/router';
import { BrowserstackState } from '@store/browserstack.state';
import { BrowsersState } from '@store/browsers.state';
import { Browserstack } from '@store/actions/browserstack.actions';
import { Browsers } from '@store/actions/browsers.actions';


@Component({
  selector: 'cometa-l1-feature-list',
  templateUrl: './l1-feature-list.component.html',
  styleUrls: ['./l1-feature-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    LetDirective,
    MtxGridModule,
    NgIf,
    MatLegacyProgressSpinnerModule,
    MatLegacyButtonModule,
    StopPropagationDirective,
    MatIconModule,
    MatLegacyTooltipModule,
    NgClass,
    NgSwitch,
    NgSwitchCase,
    NgSwitchDefault,
    NgFor,
    MatLegacyCheckboxModule,
    MatLegacyMenuModule,
    MatDividerModule,
    AsyncPipe,
    LowerCasePipe,
    TranslateModule,
    AmParsePipe,
    AmDateFormatPipe,
    SecondsToHumanReadablePipe,
    BrowserIconPipe,
    LoadingPipe,
    BrowserComboTextPipe,
    HasPermissionPipe,
    DepartmentNamePipe,
    FeatureRunningPipe,
  ],
})
export class L1FeatureListComponent implements OnInit, OnChanges {
  constructor(
    private _store: Store,
    public _sharedActions: SharedActionsService,
    private _dialog: MatDialog,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
    private log: LogService,
    private _starred: StarredService,
    private _router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  @Input() data$: any; // Contains the new structure of the features / folders
  // Initializes the sorting and pagination variables
  @ViewChild(MatSort, { static: false }) sort: MatSort;
  @ViewChild(MatPaginator) paginator: MatPaginator;
  // Checks if the user can create a feature and has a subscription
  @ViewSelectSnapshot(UserState.GetPermission('create_feature'))
  canCreateFeature: boolean;
  @ViewSelectSnapshot(UserState.HasOneActiveSubscription)
  hasSubscription: boolean;
  @Output() closeAdd: EventEmitter<any> = new EventEmitter();
  // Checks which is the currently stored features pagination
  @Select(CustomSelectors.GetConfigProperty('co_features_pagination'))
  featuresPagination$: Observable<string>;

  /**
   * Global variables
   */
  finder = this._store.selectSnapshot<boolean>(
    CustomSelectors.GetConfigProperty('openedSearch')
  );

  /**
   * Default list of columns incase not saved in localstorage
   * List of columns to be shown on the feature list
   * The format is due to mtx-grid. To see more go to https://ng-matero.github.io/extensions/components/data-grid/overview
   */
  columns = [
    { header: 'Options', field: 'reference' },
    { header: 'Type / Run', field: 'orderType', sortable: true },
    { header: 'Starred', field: 'starred', sortable: true },
    { header: 'ID', field: 'id', sortable: true },
    {
      header: 'Name',
      field: 'name',
      sortable: true,
      pinned: 'left',
      class: 'name',
    },
    { header: 'Status', field: 'status', sortable: true },
    { header: 'Last run', field: 'date', sortable: true },
    { header: 'Last duration', field: 'time', sortable: true },
    { header: 'Last steps', field: 'total', sortable: true },

    // #3427 -------------------------------------------------------- start
    // hide department, application, environment and show successfull and files steps cuantity
    { header: 'OK', field: 'ok', sortable: true },
    { header: 'NOK', field: 'fails', sortable: true },
    // #3427 ---------------------------------------------------------- end

    // #3427 -------------------------------------------------------- start
    // by default these columns will not be shown
    { header: 'Department', field: 'department', sortable: true, hide: true },
    { header: 'Application', field: 'app', sortable: true, hide: true },
    { header: 'Environment', field: 'environment', sortable: true, hide: true },
    // #3427 -------------------------------------------------------- start

    { header: 'Browsers', field: 'browsers', sortable: true },
    { header: 'Schedule', field: 'schedule', sortable: true },
  ];

  // Mtx-grid row selection checkbox options
  multiSelectable = true;
  rowSelectable = true;
  hideRowSelectionCheckbox = true;

  // Mtx-grid column move and hide options
  columnHideable = true;
  columnMovable = true;
  columnHideableChecked: 'show' | 'hide' = 'show';

  // Creates a source for the data
  tableValues = new BehaviorSubject<MatTableDataSource<any>>(
    new MatTableDataSource<any>([])
  );

  isAnyFeatureRunning$: Observable<boolean>;
  public isAnyFeatureRunningMap: Map<number, Observable<boolean>> = new Map();

  isStarred$: Observable<boolean>;
  public isStarredMap: Map<number, Observable<boolean>> = new Map();

  // Menu state
  isMenuOpen: boolean = false;
  folderName: string | null = null;
  private hasHandledMouseOver = false;
  private hasHandledMouseOverFolder = false;

  // Map to store feature locations
  private featureLocations: Map<number, { isInDepartment: boolean, departmentId: number }> = new Map();

  ngOnInit() {
    this.log.msg('1', 'Initializing component...', 'feature-list');

    // Initialize the co_features_pagination variable in the local storage
    this.log.msg('1', 'Loading feature pagination...', 'feature-list');
    this.featuresPagination$.subscribe(value =>
      localStorage.setItem('co_features_pagination', value)
    );

    // Subscribe to filter state
    this._sharedActions.filterState$.subscribe(isActive => {
      this.finder = isActive;
    });

    // load column settings
    this.getSavedColumnSettings();

    // Initialize feature locations
    this.initializeFeatureLocations();

    // Update feature data with latest information from API
    if (this.data$ && this.data$.rows) {
      this.data$.rows.forEach(row => {
        if (row.type === 'feature') {
          this.updateFeatureDataFromAPI(row);
        }
      });
    }

    // Subscribe to feature status changes to refresh data when features complete
    if (this.data$ && this.data$.rows) {
      this.data$.rows.forEach(row => {
        if (row.type === 'feature') {
          // Subscribe to feature status changes
          this._store.select(CustomSelectors.GetFeatureStatus(row.id)).subscribe(status => {
            if (status === 'Feature completed' || status === 'completed' || status === 'success' || status === 'failed' || status === 'canceled' || status === 'stopped') {
              // Update the specific feature data when it completes
              this.updateFeatureDataFromAPI(row);
              // Also dispatch UpdateFeature to refresh the store
              this._store.dispatch(new Features.UpdateFeature(row.id));
            }
          });
        }
      });
    }

    this.data$.rows.forEach(row => {
      const folderId = row.reference.folder_id;
  
      const isRunning$ = this._sharedActions.folderRunningStates.asObservable().pipe(
        map(runningStates => runningStates.get(folderId) || false)
      );
  
      this.isAnyFeatureRunningMap.set(folderId, isRunning$);

      // Initialize isStarred$ for each row
      if (row.type === 'feature') {
        this.isStarredMap.set(row.id, this._starred.isStarred(row.id));
      }
    });

    // Ensure browsers are loaded for browser version checking
    this.ensureBrowsersLoaded();

    // Check browser versions after a short delay to ensure browsers are loaded
    setTimeout(() => {
      this.checkBrowserVersions();
    }, 2000);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data$']) {
      this.log.msg('1', 'Data input changed, updating feature information...', 'feature-list');
      
      // First update status from store (faster)
      this.updateStatusFromStore();
      
      // Then refresh execution data from API
      setTimeout(() => {
        this.refreshAllFeatureData();
      }, 100); // Small delay to ensure status is updated first
    }
  }

  /**
   * Force update status from store for all features
   */
  private updateStatusFromStore(): void {
    this.log.msg('1', 'Updating status from store for all features...', 'feature-list');
    
    if (this.data$ && this.data$.rows) {
      this.data$.rows.forEach(row => {
        if (row.type === 'feature' && row.id) {
          this._store.select(CustomSelectors.GetFeatureStatus(row.id)).pipe(
            take(1)
          ).subscribe(storeStatus => {
            if (storeStatus && storeStatus !== row.status) {
              this.log.msg('1', `Updating status for feature ${row.id}: ${row.status} -> ${storeStatus}`, 'feature-list');
              row.status = storeStatus;
              this.cdr.detectChanges();
            }
          });
        }
      });
    }
  }

  /**
   * Refresh execution data for all features when view changes
   */
  private refreshAllFeatureData(): void {
    this.log.msg('1', 'View changed, refreshing all feature execution data...', 'feature-list');
    
    if (this.data$ && this.data$.rows) {
      this.data$.rows.forEach(row => {
        if (row.type === 'feature') {
          this.log.msg('1', `Refreshing data for feature ${row.id}`, 'feature-list');
          this.updateFeatureDataFromAPI(row);
        }
      });
    }
  }

  // Update feature data with latest information from API
  private updateFeatureDataFromAPI(row: any) {
    if (row.type === 'feature' && row.id) {
      this.log.msg('1', `Updating feature data for ${row.id}`, 'feature-list');
      
      // First, get the current status from the store
      this._store.select(CustomSelectors.GetFeatureStatus(row.id)).pipe(
        take(1) // Take only the first value to avoid subscription issues
      ).subscribe(storeStatus => {
        this.log.msg('1', `Store status for feature ${row.id}: ${storeStatus}`, 'feature-list');
        
        // Update the status from the store
        if (storeStatus) {
          row.status = storeStatus;
          this.log.msg('1', `Updated row status from store: ${row.status}`, 'feature-list');
        }
      });
      
      this._api.getFeatureResultsByFeatureId(row.id, {
        archived: false,
        page: 1,
        size: 1,
      }).subscribe({
        next: (response: any) => {
          this.log.msg('1', `API response for feature ${row.id}:`, 'feature-list');
          this.log.msg('1', `Response: ${JSON.stringify(response)}`, 'feature-list');
          
          if (response && response.results && response.results.length > 0) {
            const latestResult = response.results[0];
            this.log.msg('1', `Latest result for feature ${row.id}:`, 'feature-list');
            this.log.msg('1', `Result date: ${latestResult.result_date}`, 'feature-list');
            this.log.msg('1', `Execution time: ${latestResult.execution_time}`, 'feature-list');
            this.log.msg('1', `Total: ${latestResult.total}`, 'feature-list');
            this.log.msg('1', `OK: ${latestResult.ok}`, 'feature-list');
            
            // Update the row with the latest feature result information
            row.date = latestResult.result_date || null;
            row.time = latestResult.execution_time || 0;
            row.total = latestResult.total || 0;
            row.ok = latestResult.ok || 0;
            row.fails = (latestResult.total || 0) - (latestResult.ok || 0);
            
            // Also update status from the API result if available
            if (latestResult.status) {
              row.status = latestResult.status;
              this.log.msg('1', `Updated status from API result: ${row.status}`, 'feature-list');
            }
            
            this.log.msg('1', `Updated row data for feature ${row.id}:`, 'feature-list');
            this.log.msg('1', `Row status: ${row.status}`, 'feature-list');
            this.log.msg('1', `Row date: ${row.date}`, 'feature-list');
            this.log.msg('1', `Row time: ${row.time}`, 'feature-list');
            this.log.msg('1', `Row total: ${row.total}`, 'feature-list');
            
            // Force change detection to update the table view
            this.cdr.detectChanges();
          } else {
            this.log.msg('1', `No results found for feature ${row.id}, clearing execution data`, 'feature-list');
            
            // Clear execution data if no results found
            row.date = null;
            row.time = 0;
            row.total = 0;
            row.ok = 0;
            row.fails = 0;
            
            // Don't clear status here, keep it from the store if available
            
            // Force change detection to update the table view
            this.cdr.detectChanges();
          }
        },
        error: (err) => {
          this.log.msg('1', `Error fetching feature results for ${row.id}: ${err}`, 'feature-list');
          console.error('Error fetching feature results for table:', err);
          
          // Clear execution data on error to avoid showing stale data
          row.date = null;
          row.time = 0;
          row.total = 0;
          row.ok = 0;
          row.fails = 0;
          
          // Don't clear status here, keep it from the store if available
          
          // Force change detection to update the table view
          this.cdr.detectChanges();
        }
      });
    }
  }

  
  /**
   * Public method to refresh all feature execution data
   * Can be called from parent components when needed
   */
  public refreshFeatureData(): void {
    this.log.msg('1', 'Manual refresh of feature execution data requested', 'feature-list');
    this.refreshAllFeatureData();
  }

  // Public method to refresh table data (can be called from parent components)
  public refreshTableData() {
    this.refreshAllFeatureData();
  }

  /**
   * Get unique browser types for a row (grouped by browser name to avoid duplicates)
   */
  getUniqueBrowsersForRow(row: any): any[] {
    if (!row.browsers || row.browsers.length === 0) {
      return [];
    }
    
    // Group browsers by browser type and return unique ones
    const uniqueBrowsers = new Map<string, any>();
    
    row.browsers.forEach(browser => {
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
  getUniqueBrowserTooltipForRow(row: any, browserType: string): string {
    if (!row.browsers || row.browsers.length === 0) {
      return '';
    }
    
    // Get all browsers of this type
    const browsersOfType = row.browsers.filter(browser => browser.browser === browserType);
    
    if (browsersOfType.length === 1) {
      return `${browserType} ${browsersOfType[0].browser_version || ''}`.trim();
    } else {
      // Multiple versions of the same browser
      const versions = browsersOfType.map(browser => browser.browser_version || 'latest').join(', ');
      return `${browserType} (${versions})`;
    }
  }

  /**
   * Get organized browsers tooltip text for a row
   */
  getBrowsersTooltipForRow(row: any): string {
    if (!row.browsers || row.browsers.length === 0) {
      return 'No browsers selected';
    }
    
    // Group browsers by type
    const browsersByType = new Map<string, any[]>();
    
    row.browsers.forEach(browser => {
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

  private initializeFeatureLocations() {
    this._store.select(CustomSelectors.GetDepartmentFolders()).subscribe(
      departments => {
        departments.forEach(department => {
          // Check features directly in department
          if (department.features) {
            department.features.forEach(featureId => {
              this.featureLocations.set(featureId, { 
                isInDepartment: true, 
                departmentId: department.folder_id 
              });
            });
          }

          // Check features in folders
          if (department.folders) {
            this.checkFeaturesInFolders(department.folders, department.folder_id);
          }
        });
      }
    );
  }

  private checkFeaturesInFolders(folders: any[], departmentId: number) {
    folders.forEach(folder => {
      if (folder.features) {
        folder.features.forEach(featureId => {
          this.featureLocations.set(featureId, { 
            isInDepartment: false, 
            departmentId: departmentId 
          });
        });
      }
      if (folder.folders) {
        this.checkFeaturesInFolders(folder.folders, departmentId);
      }
    });
  }

  isFeatureInDepartment(featureId: number): boolean {
    const currentRow = this.data$.rows.find(row => row.id === featureId);
    if (!currentRow?.reference?.department_id) {
      return false;
    }

    const departmentId = currentRow.reference.department_id;
    const departments = this._store.selectSnapshot(CustomSelectors.GetDepartmentFolders());
    const department = departments.find(d => d.folder_id === departmentId);

    if (!department) {
      return false;
    }

    // If the feature is directly in the department's features
    const isInDepartment = department.features?.includes(featureId);

    // If the feature is not in the department's features, check if it's in any folder
    if (!isInDepartment) {
      const isInFolder = this.checkFeatureInFolders(department.folders, featureId);
      return !isInFolder; // If it's in a folder, it's not in the department
    }

    return isInDepartment;
  }

  private checkFeatureInFolders(folders: any[], featureId: number): boolean {
    if (!folders) return false;
    
    for (const folder of folders) {
      if (folder.features?.includes(featureId)) {
        return true;
      }
      if (folder.folders) {
        const foundInSubfolder = this.checkFeatureInFolders(folder.folders, featureId);
        if (foundInSubfolder) return true;
      }
    }
    return false;
  }

  getFeatureDepartmentId(featureId: number): number | undefined {
    return this.featureLocations.get(featureId)?.departmentId;
  }

  /**
   * Global functions
   */

  /**
   * Stores the features page size on change
   * @returns new Configuration of co_features_pagination
   * @author dph000
   * @date 15-10-21
   * @lastModification 15-10-21
   */
  storePagination(event) {
    this.log.msg(
      '1',
      'Storing feature pagination in localstorage...',
      'feature-list',
      event.pageSize
    );
    return this._store.dispatch(
      new Configuration.SetProperty(
        'co_features_pagination',
        event.pageSize,
        true
      )
    );
  }

  /**
   * Saves current sort settings to localstorage
   * @author Arslan Sohail Bano
   * @date 2021-12-27
   * @param event Looks something like this: {"active":"date","direction":"desc"}
   */
  saveSort(event) {
    // save to localstorage
    this.log.msg(
      '1',
      'Saving chosen sort in localstorage...',
      'feature-list',
      event
    );
    localStorage.setItem('co_feature_table_sort_v2', JSON.stringify(event));
  }

  /**
   * Gets the key from already saved sort value from localstorage or
   * a default value if localstorage return null or undefined.
   * @author Arslan Sohail Bano
   * @date 2021-12-27
   * @param key can be 'active' (Field Name) or 'direction' (Sort)
   * @returns Field Name or Sort Direction depending on the key value
   */
  getSavedSort(key) {
    // load data from localstorage if null or undefined set a default
    const savedSort = JSON.parse(
      localStorage.getItem('co_feature_table_sort_v2') || // get value from localstorage
        '{"active":"date","direction":"desc"}' // if localstorage returns null or undefined set a default value
    );
    // return key value requested
    return savedSort[key];
  }

  /**
   * Saves current column settings to localstorage
   * @author Arslan Sohail Bano
   * @date 2021-12-28
   * @param event Looks something like this: [{label: "Type / Run", field: "orderType", show: false, header: "Type / Run", hide: true}, ...]
   */
  saveColumnSettings(event) {
    this.log.msg('1', 'Saving column settings...', 'feature-list', event);

    // add missing keys for next reload
    event.forEach(column => {
      // get default properties for current column
      const defaultProperties = this.columns.find(
        defaultColumn => defaultColumn.header == column.label
      );
      // concat current column values with default properties and also add hide property
      Object.assign(column, defaultProperties, { hide: !column.show });
    });
    // save to localstorage
    localStorage.setItem('co_feature_table_columns_v2', JSON.stringify(event));

    // refresh columns
    this.columns = event;
  }

  /**
   * Gets column settings from localstorage or
   * a default value if localstorage return null or undefined.
   * @author Arslan Sohail Bano
   * @date 2021-12-28
   */
  getSavedColumnSettings() {
    this.log.msg('1', 'Getting saved column settings...', 'feature-list');

    // check if co_feature_table_columns_v2 exists in localstorage if so import it into columns else use default
    this.columns =
      JSON.parse(localStorage.getItem('co_feature_table_columns_v2')) || // get value from localstorage
      this.columns; // if localstorage returns null or undefined set a default value
  }

  // Checks whether the clicked row is a feature or a folder and opens it
  openContent(row: any) {
    switch (row.type) {
      case 'feature':
        this.log.msg('1', 'opening feature with id...', 'feature-list', row.id);
        this._sharedActions.goToFeature(row.id);
        break;
      case 'folder':
        this.log.msg('1', 'opening folder with id...', 'feature-list', row.id);
        this.setFolder(row.route);

        // #3414 -------------------------------------------------start
        // path to currently displayed folder
        const currentRoute = this._store.snapshot().features.currentRouteNew;

        // change browser url, add folder id hierarchy as params
        this._sharedActions.set_url_folder_params(currentRoute);
        // #3414 ---------------------------------------------------end

        // close add feature or folder menu
        this.closeAddButtons();
        break;
      default:
        break;
    }
  }

  // Closes the add feature / folder menu
  closeAddButtons() {
    this.closeAdd.emit(null);
  }

  /**
   * Folder control functions
   */

  // Go to the clicked route
  setFolder(route: Folder[]) {
    this.log.msg('1', 'Redirecting to route...', 'feature-list', route);
    this._store.dispatch(new Features.SetFolderRoute(route));
  }

  // Go to the clicked folder
  goFolder(folder: Folder) {
    this.log.msg('1', 'Opening folder...', 'feature-list', folder);
    this._store.dispatch(new Features.SetFolderRoute([folder]));

    // get absolute path of current route, including department
    const currentRoute = this._store.snapshot().features.currentRouteNew;

    // add clicked folder's id hierarchy to url params
    this._sharedActions.set_url_folder_params(currentRoute);
  }

  // Modify the clicked folder
  modify(folder: Folder) {
    this.log.msg('1', 'Modifying folder...', 'feature-list', folder);
    this._dialog.open(AddFolderComponent, {
      autoFocus: true,
      data: {
        mode: 'edit',
        folder: folder,
      } as IEditFolder,
    });
  }

  // Delete the clicked folder
  @Subscribe()
  delete(folder: Folder) {
    this.log.msg('1', 'Deleting folder...', 'feature-list', folder);
    return this._api.removeFolder(folder.folder_id).pipe(
      switchMap(_ => this._store.dispatch(new Features.GetFolders())),
      tap(_ => this._snackBar.open(`Folder ${folder.name} removed`, 'OK'))
    );
  }

  /**
   * Shared Actions functions
   */

  // Opens a menu to create a new feature
  SAopenCreateFeature() {
    this.log.msg('1', 'Opening create feature menu...', 'feature-list');
    this._sharedActions.openEditFeature();
  }

  // Runs the clicked feature
  SArunFeature(id: number) {
    this.log.msg('1', 'Running feature with id...', 'feature-list', id);
    this._sharedActions.run(id);
  }

  // Edits the schedule of the clicked feature
  SAeditSchedule(id: number) {
    this.log.msg(
      '1',
      'Editing shedule of feature with id...',
      'feature-list',
      id
    );
    this._sharedActions.editSchedule(id);
  }

  // Opens the menu to edit the clicked feature
  SAopenEditFeature(id: number, mode) {
    this.log.msg('1', 'Editing feature with id...', 'feature-list', id);
    this._sharedActions.openEditFeature(id, mode);
  }

  // Moves the selected feature
  SAmoveFeature(feature: Feature) {
    this.log.msg('1', 'Moving feature...', 'feature-list', feature);
    this._sharedActions.moveFeature(feature);
  }

  // Handles the settings of the clicked feature
  SAhandleSetting(id: number, mode, event) {
    this.log.msg(
      '1',
      'Handling setting of feature width id...',
      'feature-list',
      id
    );
    this._sharedActions.handleSetting(id, mode, event);
  }

  SAdeleteFeature(id: number) {
    this.log.msg('1', 'Deleting feature width id...', 'feature-list', id);
    this._sharedActions.deleteFeature(id);
  }

  // Moves the selected folder
  SAmoveFolder(folder: Folder) {
    this.log.msg('1', 'Moving folder...', 'feature-recent-list', folder);
    this._sharedActions.moveFolder(folder);
  }

  toggleStarred(event: Event, featureId: number, featureName: string): void {
    event.stopPropagation();
    this._sharedActions.toggleStarred(event, featureId, featureName);
  }

  /**
   * Navigate to domain
   * @param departmentId The department ID to navigate to
   */
  goToDomain(departmentId: number) {
    this.log.msg('1', 'Navigating to domain...', 'feature-list');
    const url = `/new/${departmentId}`;
    this._router.navigate([url]);
  }

  /**
   * Navigate to folder
   * @param feature_id The feature ID
   * @param path The path to navigate to
   * @param isFeature Whether this is a feature or folder
   */
  featuresGoToFolder(feature_id: number, path = '', isFeature: boolean): void {
    if (!this.finder) {
      return;
    }
    
    if (isFeature) {
      // Get the department ID from the current row
      const currentRow = this.data$.rows.find(row => row.id === feature_id);
      const department_id = currentRow?.reference?.department_id;
      
      if (!department_id) {
        return;
      }

      // For features, use the complete path from findAndNavigate
      this._store.select(CustomSelectors.GetDepartmentFolders()).subscribe(
        alldepartments => {
          const { result, folderName, foldersToOpen } = this.findAndNavigate(alldepartments, feature_id, '');
          if (result) {
            this.openFolderInLocalStorage(foldersToOpen);
            const url = `/new/${result}`;
            this._router.navigate([url]);
          } else {
            // If not found in any folder, navigate directly to the department
            const url = `/new/:${department_id}`;
            this._router.navigate([url]);
          }
        },
        error => {
          console.error("Error obtaining Departments:", error);
        }
      );
    } else {
      // For folders, use the same logic as in l1-feature-item-list
      this._store.select(CustomSelectors.GetDepartmentFolders()).subscribe(
        alldepartments => {
          const { result, folderName, foldersToOpen } = this.findFolderAndNavigate(alldepartments, feature_id, '', true);
          if (result) {
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
  }

  findAndNavigate(departments: any[], feature_id: number, path: string): { result: string | null, folderName: string | null, foldersToOpen: string[] } {
    for (const department of departments) {
      // First check if the feature is in the department's features
      if (department.features && department.features.includes(feature_id)) {
        return { 
          result: `:${department.folder_id}`, 
          folderName: department.name, 
          foldersToOpen: [department.name] 
        };
      }
      // Then check in department's folders
      if (department.folders) {
        for (const subfolder of department.folders) {
          // If the feature is directly in this folder
          if (subfolder.features && subfolder.features.includes(feature_id)) {
            return {
              result: `:${department.folder_id}:${subfolder.folder_id}`,
              folderName: subfolder.name,
              foldersToOpen: [department.name, subfolder.name]
            };
          }
          // If not, search in subfolders
          const { result, folderName, foldersToOpen } = this.processSubfolder(subfolder, feature_id, `:${department.folder_id}`, subfolder.name);
          if (result) {
            return { result, folderName, foldersToOpen: [department.name, ...foldersToOpen] };
          }
        }
      }
    }
    return { result: null, folderName: null, foldersToOpen: [] };
  }

  /**
   * Navigate to folder
   * @param folderId The folder ID
   * @param folderNameBoolean Whether to show folder name
   */
  folderGoToFolder(folderId: number, folderNameBoolean: boolean) {
    
    if (!this.finder) {
      return;
    }

    this._store.select(CustomSelectors.GetDepartmentFolders()).subscribe(
      alldepartments => {
        const { result, folderName, foldersToOpen } = this.findFolderAndNavigate(alldepartments, folderId, '', folderNameBoolean);
        
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

  findFolderAndNavigate(departments: any[], folder_id: number, path: string, folderNameBoolean: boolean): { result: string | null, folderName: string | null, foldersToOpen: string[] } {
    for (const department of departments) {
      for (const folder of department.folders) {
        if (folder.folder_id === folder_id) {
          const finalFolderName = folderNameBoolean ? folder.name : department.name;
          if(!folderNameBoolean){
            this.folderName = department.name;
          }
          return { 
            result: `:${department.folder_id}:${folder.folder_id}`, 
            folderName: finalFolderName,  
            foldersToOpen: [department.name, folder.name] 
          };
        }

        const { result, folderName, foldersToOpen } = this.processFolder(folder, folder_id, `:${department.folder_id}`, folder.name, department.folder_id);
        if (result) {
          return { result, folderName, foldersToOpen: [department.name, ...foldersToOpen] };
        }
      }
    }
    return { result: null, folderName: null, foldersToOpen: [] };
  }

  processFolder(folder: any, folder_id: number, path: string, parentFolderName: string, department_id: number): { result: string | null, folderName: string | null, foldersToOpen: string[] } {
 
    if (folder.folder_id === folder_id) {
      this.folderName = parentFolderName;
      return { 
        result: `${path}:${folder.folder_id}`, 
        folderName: parentFolderName,
        foldersToOpen: [folder.name] 
      };
    }

    for (const subfolder of folder.folders) {
      const resultPath = `${path}:${folder.folder_id}`;
      const { result, folderName, foldersToOpen } = this.processFolder(subfolder, folder_id, resultPath, folder.name, department_id);
      if (result) {
        return { result, folderName, foldersToOpen: [folder.name, ...foldersToOpen] };
      }
    }
    return { result: null, folderName: null, foldersToOpen: [] };
  }

  processSubfolder(folder: any, feature_id: number, path: string, feature_directory: string): { result: string | null, folderName: string | null, foldersToOpen: string[] } {
    
    // Check if this folder contains the feature
    if (folder.features && folder.features.includes(feature_id)) {
      return { 
        result: `${path}:${folder.folder_id}`, 
        folderName: feature_directory,
        foldersToOpen: [folder.name] 
      };
    }

    // Check subfolders
    if (folder.folders) {

      for (const subfolder of folder.folders) {
        // If the feature is directly in this subfolder
        if (subfolder.features && subfolder.features.includes(feature_id)) {

          return {
            result: `${path}:${folder.folder_id}:${subfolder.folder_id}`,
            folderName: subfolder.name,
            foldersToOpen: [folder.name, subfolder.name]
          };
        }
        // If not, continue searching in deeper subfolders
        const { result, folderName, foldersToOpen } = this.processSubfolder(
          subfolder, 
          feature_id, 
          `${path}:${folder.folder_id}`, 
          subfolder.name
        );
        if (result) {
          return { result, folderName, foldersToOpen: [folder.name, ...foldersToOpen] };
        }
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

  /**
   * Handle mouse over event for path navigation
   * @param event The mouse event
   */
  handleMouseOver(event: MouseEvent, row: any): void {
    if (this.hasHandledMouseOver) {
      return;
    }
    this.hasHandledMouseOver = true;
    this.featuresGoToFolder(row.id, '', false);
  }

  handleMouseOverFolder(event: MouseEvent, row: any): void {
    if (this.hasHandledMouseOverFolder) {
      return;
    }
    this.hasHandledMouseOverFolder = true;
    this.folderGoToFolder(row.id, false);
  }

  /**
   * Ensure browsers are loaded for browser version checking
   */
  private ensureBrowsersLoaded(): void {
    // Dispatch actions to load browsers if not already loaded
    const browserstackBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks);
    const localBrowsers = this._store.selectSnapshot(BrowsersState.getBrowserJsons);
    
          if (!browserstackBrowsers || browserstackBrowsers.length === 0) {
        this._store.dispatch(new Browserstack.GetBrowserstack());
      }
    
    if (!localBrowsers || localBrowsers.length === 0) {
      this._store.dispatch(new Browsers.GetBrowsers());
    }
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
        this.log.msg('1', `Feature ${selectedBrowser.id || 'unknown'} no Chrome browsers available for comparison`, 'feature-list');
        return false; // Can't determine, allow running
      }
      
      // Extract version numbers and convert to integers for comparison
      const availableVersions = chromeBrowsers.map(browser => {
        const version = browser.browser_version;
        if (version === 'latest') return 999; // Latest is always highest
        return parseInt(version, 10) || 0;
      }).sort((a, b) => b - a); // Sort descending
      
      const selectedVersion = selectedBrowser.browser_version;
      if (selectedVersion === 'latest') {
        this.log.msg('1', `Feature ${selectedBrowser.id || 'unknown'} Chrome version is 'latest', never outdated`, 'feature-list');
        return false; // Latest is never outdated
      }
      
      const selectedVersionNum = parseInt(selectedVersion, 10) || 0;
      
      // Check if selected version is significantly outdated (more than 3 versions behind)
      const highestAvailable = availableVersions[0];
      
      // Log the comparison for debugging
      this.log.msg('1', `Feature ${selectedBrowser.id || 'unknown'} Chrome version check: selected=${selectedVersionNum}, highest=${highestAvailable}, difference=${highestAvailable - selectedVersionNum}`, 'feature-list');
      
      // For Chrome, be more strict - if it's more than 3 versions behind, consider it outdated
      if (highestAvailable - selectedVersionNum > 3) {
        this.log.msg('1', `Feature ${selectedBrowser.id || 'unknown'} has outdated Chrome version: ${selectedVersion} (latest available: ${highestAvailable})`, 'feature-list');
        return true;
      }
      
      this.log.msg('1', `Feature ${selectedBrowser.id || 'unknown'} Chrome version ${selectedVersion} is up to date`, 'feature-list');
      return false;
    }
    
    // For other local browsers, use exact matching
    return this.isCloudBrowserOutdated(selectedBrowser, availableBrowsers);
  }

  /**
   * Check if a cloud browser is outdated by comparing with available browsers
   */
  private isCloudBrowserOutdated(selectedBrowser: any, availableBrowsers: any[]): boolean {
    // If the browser version is 'latest', it's never outdated
    if (selectedBrowser.browser_version === 'latest') {
      return false;
    }
    
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
      this.log.msg('1', `Feature ${selectedBrowser.id || 'unknown'} has outdated browser: ${selectedBrowser.browser} ${selectedBrowser.browser_version}`, 'feature-list');
      return true;
    }
    
    return false;
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
   * Get simple browser status information for outdated browsers
   */
  public getSimpleBrowserStatusInfo(browser: any): string {
    if (!browser) return '';
    
    // Ensure browsers are loaded
    this.ensureBrowsersLoaded();
    
    // Get the available browsers from both BrowserstackState and BrowsersState
    const availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
    const localBrowsers = this._store.selectSnapshot(BrowsersState.getBrowserJsons) as any[];
    const allAvailableBrowsers = [...(availableBrowsers || []), ...(localBrowsers || [])];
    
    if (allAvailableBrowsers.length === 0) {
      return '';
    }
    
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
        // Special handling for 'latest' versions - they should always be considered available
        if (browser.browser_version === 'latest') {
          return ''; // Latest versions don't show warnings
        }
        return `⚠️ ${browser.browser} ${browser.browser_version}\n\nNot available in current browser list`;
      }
    }
    
    return '';
  }

  /**
   * Check if the run button should be disabled due to browser version issues
   */
  public shouldDisableRunButton(row: any): boolean {
    // Check if the row is a feature and has browsers configured
    if (row.type !== 'feature' || !row.browsers || row.browsers.length === 0) {
      return false;
    }

    // Throttle browser checks to prevent excessive execution
    if (row._lastBrowserCheck && (Date.now() - row._lastBrowserCheck) < 5000) {
      // Return cached result if checked recently
      return row._browserCheckResult || false;
    }

    // Ensure browsers are loaded
    this.ensureBrowsersLoaded();

    // Get the available browsers from both BrowserstackState and BrowsersState
    const availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
    const localBrowsers = this._store.selectSnapshot(BrowsersState.getBrowserJsons) as any[];
    
    // If still no browsers, return false (button will be enabled - allow running)
    if ((!availableBrowsers || availableBrowsers.length === 0) && (!localBrowsers || localBrowsers.length === 0)) {
      this.log.msg('1', `Feature ${row.id} no available browsers, button enabled`, 'feature-list');
      return false;
    }

    // Combine both browser sources
    const allAvailableBrowsers = [...(availableBrowsers || []), ...(localBrowsers || [])];
    
    // Check if any of the selected browsers have outdated versions
    const hasOutdatedBrowser = row.browsers.some((selectedBrowser: any, index: number) => {
      this.log.msg('1', `Feature ${row.id} checking browser ${index + 1}: ${selectedBrowser.browser} ${selectedBrowser.browser_version}`, 'feature-list');
      
      // For local browsers, we need to handle them differently
      if (this.isLocalBrowser(selectedBrowser)) {
        this.log.msg('1', `Feature ${row.id} browser ${index + 1} detected as local`, 'feature-list');
        const isOutdated = this.isLocalBrowserOutdated(selectedBrowser, allAvailableBrowsers);
        this.log.msg('1', `Feature ${row.id} browser ${index + 1} local outdated: ${isOutdated}`, 'feature-list');
        return isOutdated;
      }
      
      // For cloud browsers, use exact matching
      this.log.msg('1', `Feature ${row.id} browser ${index + 1} detected as cloud`, 'feature-list');
      const isOutdated = this.isCloudBrowserOutdated(selectedBrowser, allAvailableBrowsers);
      this.log.msg('1', `Feature ${row.id} browser ${index + 1} cloud outdated: ${isOutdated}`, 'feature-list');
      return isOutdated;
    });

    this.log.msg('1', `Feature ${row.id} has outdated browsers: ${hasOutdatedBrowser}`, 'feature-list');
    
    // Cache the result and timestamp to prevent excessive checks
    row._lastBrowserCheck = Date.now();
    row._browserCheckResult = hasOutdatedBrowser;
    
    // Return true ONLY if there are outdated browsers (this will disable the button)
    return hasOutdatedBrowser;
  }

  /**
   * Get detailed browser status information for a specific row
   */
  public getRowBrowserStatusInfo(row: any): string {
    if (row.type !== 'feature' || !row.browsers || row.browsers.length === 0) {
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
    const outdatedBrowsers = row.browsers.filter((browser: any) => this.isSpecificBrowserOutdated(browser));
    
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
   * Check browser versions and log status
   */
  private checkBrowserVersions(): void {
    // Ensure browsers are loaded
    this.ensureBrowsersLoaded();
    
    // Get the available browsers from both BrowserstackState and BrowsersState
    const availableBrowsers = this._store.selectSnapshot(BrowserstackState.getBrowserstacks) as any[];
    const localBrowsers = this._store.selectSnapshot(BrowsersState.getBrowserJsons) as any[];
    const allAvailableBrowsers = [...(availableBrowsers || []), ...(localBrowsers || [])];
    
    if (allAvailableBrowsers.length === 0) {
      this.log.msg('1', 'No browsers available for version checking', 'feature-list');
      return;
    }
    
    this.log.msg('1', `Browser version check: ${allAvailableBrowsers.length} browsers available`, 'feature-list');
  }

  /**
   * Track browser changes for ngFor optimization
   */
  trackBrowser(index: number, browser: any): any {
    return browser.browser + browser.browser_version + (browser.os || '') + (browser.os_version || '');
  }

  /**
   * Ensures the folder object has the correct structure for runAllFeatures
   * This prevents the error 500 when running all features in a folder
   */
  private getFolderForRunAll(folderRef: any): any {
    // Ensure the folder object has the required properties
    if (!folderRef) {
      return null;
    }

    // Check if the folder has the features property
    if (!folderRef.features || !Array.isArray(folderRef.features)) {
      return null;
    }

    // Return a properly structured folder object
    return {
      folder_id: folderRef.folder_id,
      features: folderRef.features,
      department_id: folderRef.department_id,
      name: folderRef.name
    };
  }

  // Mtx-grid column move and hide options
}