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
} from '@angular/core';
import { Select, Store } from '@ngxs/store';
import { SharedActionsService } from '@services/shared-actions.service';
import { BehaviorSubject, Observable, switchMap, tap } from 'rxjs';
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
export class L1FeatureListComponent implements OnInit {
  constructor(
    private _store: Store,
    public _sharedActions: SharedActionsService,
    private _dialog: MatDialog,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
    private log: LogService
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

  /**
   * Default list of columns incase not saved in localstorage
   * List of columns to be shown on the feature list
   * The format is due to mtx-grid. To see more go to https://ng-matero.github.io/extensions/components/data-grid/overview
   */
  columns = [
    { header: 'Type / Run', field: 'orderType', sortable: true },
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
    { header: 'Options', field: 'reference' },
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

  ngOnInit() {
    this.log.msg('1', 'Inicializing component...', 'feature-list');

    // Initialize the co_features_pagination variable in the local storage
    this.log.msg('1', 'Loading feature pagination...', 'feature-list');
    this.featuresPagination$.subscribe(value =>
      localStorage.setItem('co_features_pagination', value)
    );

    // load column settings
    this.getSavedColumnSettings();
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
    return this._store.dispatch(new Features.NewAddFolderRoute(folder));
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
}
