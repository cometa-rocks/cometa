/**
 * l1-feature-list.component.ts
 *
 * Contains the code to control the behaviour of the features list of the new landing
 *
 * @author: dph000
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { Select, Store } from '@ngxs/store';
import { SharedActionsService } from '@services/shared-actions.service';
import { BehaviorSubject, Observable, switchMap, tap } from 'rxjs';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Features } from '@store/actions/features.actions';
import { Subscribe } from 'ngx-amvara-toolbox';
import { AddFolderComponent } from '@dialogs/add-folder/add-folder.component';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '@services/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { UserState } from '@store/user.state';
import { CustomSelectors } from '@others/custom-selectors';
import { Configuration } from '@store/actions/config.actions';

@Component({
  selector: 'cometa-l1-feature-list',
  templateUrl: './l1-feature-list.component.html',
  styleUrls: ['./l1-feature-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class L1FeatureListComponent implements OnInit{

  constructor(
    private _store: Store,
    public _sharedActions: SharedActionsService,
    private _dialog: MatDialog,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
  ) { }

  @Input() data$: any; // Contains the new structure of the features / folders
  // Initializes the sorting and pagination variables
  @ViewChild(MatSort, {static: false}) sort: MatSort;
  @ViewChild(MatPaginator) paginator: MatPaginator;
  // Checks if the user can create a feature and has a subscription
  @ViewSelectSnapshot(UserState.GetPermission('create_feature')) canCreateFeature: boolean;
  @ViewSelectSnapshot(UserState.HasOneActiveSubscription) hasSubscription: boolean;
  @Output() closeAdd: EventEmitter<any> = new EventEmitter();
  // Checks which is the currently stored features pagination
  @Select(CustomSelectors.GetConfigProperty('co_features_pagination')) featuresPagination$: Observable<string>;

  /**
   * Global variables
   */

  /**
   * Default list of columns incase not saved in localstorage
   * List of columns to be shown on the feature list
   * The format is due to mtx-grid. To see more go to https://ng-matero.github.io/extensions/components/data-grid/overview
   */
  columns = [
    {header: 'Type / Run', field: 'orderType', sortable: true},
    {header: 'ID', field: 'id', sortable: true},
    {header: 'Name', field: 'name', sortable: true, pinned: 'left', class: 'name'},
    {header: 'Status', field: 'status', sortable: true},
    {header: 'Last run', field: 'date', sortable: true},
    {header: 'Last duration', field: 'time', sortable: true},
    {header: 'Last steps', field: 'total', sortable: true},
    {header: 'Department', field: 'department', sortable: true},
    {header: 'Application', field: 'app', sortable: true},
    {header: 'Environment', field: 'environment', sortable: true},
    {header: 'Browsers', field: 'browsers', sortable: true},
    {header: 'Schedule', field: 'schedule', sortable: true},
    {header: 'Options', field: 'reference'}
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
  tableValues = new BehaviorSubject<MatTableDataSource<any>>(new MatTableDataSource<any>([]));

  // NgOnInit
  ngOnInit() {
    // Initialize the co_features_pagination variable in the local storage
    this.featuresPagination$.subscribe(value => localStorage.setItem('co_features_pagination', value));

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
   @Dispatch()
   storePagination(event) {
   return new Configuration.SetProperty('co_features_pagination', event.pageSize, true);
   }

  /**
   * Saves current sort settings to localstorage
   * @author Arslan Sohail Bano
   * @date 2021-12-27
   * @param event Looks something like this: {"active":"date","direction":"desc"}
   */
   saveSort(event) {
     // save to localstorage
     localStorage.setItem("co_feature_table_sort_v2", JSON.stringify(event));
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
      localStorage.getItem('co_feature_table_sort_v2') // get value from localstorage
    || 
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
  saveColumnSettings(event){
    // add missing keys for next reload
    event.forEach(column => {
      // get default properties for current column
      const defaultProperties = this.columns.find(defaultColumn => defaultColumn.header == column.label);
      // concat current column values with default properties and also add hide property
      Object.assign(column, defaultProperties, {'hide': !column.show});
    });
    // save to localstorage
    localStorage.setItem("co_feature_table_columns_v2", JSON.stringify(event));

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
    // check if co_feature_table_columns_v2 exists in localstorage if so import it into columns else use default
    this.columns = JSON.parse( localStorage.getItem('co_feature_table_columns_v2') ) // get value from localstorage
    || 
    this.columns; // if localstorage returns null or undefined set a default value
  }

  // Checks whether the clicked row is a feature or a folder and opens it
  openContent(row:any) {
    switch(row.type) {
      case 'feature':
        this._sharedActions.goToFeature(row.id);
        break;
      case 'folder':
        this.setFolder(row.route);

        // #3414 -------------------------------------------------start
        // path to currently displayed folder
        const currentRoute = this._store.snapshot().features.currentRouteNew;

        // change browser url, add folder id as params
        this._sharedActions.set_url_folder_params(currentRoute);
        // #3414 ---------------------------------------------------end

        // close add feature or folder menu
        this.closeAddButtons();
        break;
      default:
        break
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
    this._store.dispatch(new Features.SetFolderRoute(route));
  }

  // Go to the clicked folder
  @Dispatch()
  goFolder(folder: Folder) {
    return new Features.NewAddFolderRoute(folder);
  }

  // Modify the clicked folder
  modify(folder: Folder) {
    this._dialog.open(AddFolderComponent, {
      autoFocus: true,
      data: {
        mode: 'edit',
        folder: folder
      } as IEditFolder
    })
  }

  // Delete the clicked folder
  @Subscribe()
  delete(folder: Folder) {
    return this._api.removeFolder(folder.folder_id).pipe(
      switchMap(_ => this._store.dispatch( new Features.GetFolders )),
      tap(_ => this._snackBar.open(`Folder ${folder.name} removed`, 'OK'))
    );
  }

  /**
   * Shared Actions functions
   */

  // Opens a menu to create a new feature
  SAopenCreateFeature() {
    this._sharedActions.openEditFeature();
  }

  // Runs the clicked feature
  SArunFeature(id: number) {
    this._sharedActions.run(id);
  }

  // Edits the schedule of the clicked feature
  SAeditSchedule(id: number) {
    this._sharedActions.editSchedule(id);
  }

  // Opens the menu to edit the clicked feature
  SAopenEditFeature(id: number, mode) {
    this._sharedActions.openEditFeature(id, mode);
  }

  // Moves the selected feature
  SAmoveFeature(feature: Feature) {
    this._sharedActions.moveFeature(feature);
  }

  // Handles the settings of the clicked feature
  SAhandleSetting(id: number, mode, event) {
    this._sharedActions.handleSetting(id, mode, event);
  }

  SAdeleteFeature(id: number) {
    this._sharedActions.deleteFeature(id);
  }

  // Moves the selected folder
  SAmoveFolder(folder: Folder) {
    this._sharedActions.moveFolder(folder);
  }
}
