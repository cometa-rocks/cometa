/**
 * l1-feature-list.component.ts
 *
 * Contains the code to control the behavior of the features list of the new landing
 *
 * @author: Anand Kushwaha
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { Select, Store } from "@ngxs/store";
import { SharedActionsService } from "@services/shared-actions.service";
import { BehaviorSubject, Observable, switchMap, tap } from "rxjs";
import { MatLegacyTableDataSource as MatTableDataSource } from "@angular/material/legacy-table";
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacyPaginator as MatPaginator } from "@angular/material/legacy-paginator";
import { MatSort } from "@angular/material/sort";
import { Features } from "@store/actions/features.actions";
import { Subscribe } from "ngx-amvara-toolbox";
import { AddFolderComponent } from "@dialogs/add-folder/add-folder.component";
import { ApiService } from "@services/api.service";
import { MatLegacySnackBar as MatSnackBar } from "@angular/material/legacy-snack-bar";
import { ViewSelectSnapshot } from "@ngxs-labs/select-snapshot";
import { UserState } from "@store/user.state";
import { CustomSelectors } from "@others/custom-selectors";
import { Configuration } from "@store/actions/config.actions";
import { LogService } from "@services/log.service";

@Component({
  selector: "list-feature-history",
  templateUrl: "./list-feature-history.component.html",
  styleUrls: ["./list-feature-history.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListFeatureHistoryComponent implements  OnDestroy {

  constructor(
    public dialogRef: MatDialogRef<ListFeatureHistoryComponent>,
    private _store: Store,
    public _sharedActions: SharedActionsService,
    private _dialog: MatDialog,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
    private log: LogService,
    @Inject(MAT_DIALOG_DATA) public $featureHistory: FeatureHistory[]
  ) {}


  ngOnDestroy(): void {
    // throw new Error("Method not implemented.");
  }
  // Initializes the sorting and pagination variables
  @ViewChild(MatSort, { static: false }) sort: MatSort;
  @ViewChild(MatPaginator) paginator: MatPaginator;
  // Checks if the user can create a feature and has a subscription
  @ViewSelectSnapshot(UserState.GetPermission("create_feature"))
  canCreateFeature: boolean;
  @ViewSelectSnapshot(UserState.HasOneActiveSubscription)
  hasSubscription: boolean;
  @Output() closeAdd: EventEmitter<any> = new EventEmitter();
  // Checks which is the currently stored features pagination
  @Select(CustomSelectors.GetConfigProperty("co_features_pagination"))
  featuresPagination$: Observable<string>;
  /**
   * List of columns to be shown on the feature list
   * The format is due to mtx-grid. To see more go to https://ng-matero.github.io/extensions/components/data-grid/overview
   */
  columns = [
    { header: "ID", field: "id", sortable: true },
    { header: "History type", field: "action", sortable: true },
    {
      header: "Name",
      field: "feature_name",
      sortable: true,
      pinned: "left",
      class: "name",
    },
    { header: "Modified By", field: "last_edited_by", sortable: true },
    { header: "Modified Date", field: "last_edited_date", sortable: true },
    { header: "Status", field: "status", sortable: true },
    { header: "Total steps", field: "total", sortable: true },
    { header: "OK", field: "ok", sortable: true },
    { header: "NOK", field: "fails", sortable: true },
    { header: "Last Run Date", field: "last_run", sortable: true},
    { header: "Duration", field: "last_duration", sortable: true, hide: true  },
    { header: "Department", field: "department", sortable: true, hide: true },
    { header: "Application", field: "app", sortable: true, hide: true },
    { header: "Environment", field: "environment", sortable: true, hide: true },
    { header: "Schedule", field: "schedule", sortable: true,  hide: true},
    { header: "Browsers", field: "browsers", sortable: true, hide: true},
    { header: "Options", field: "reference" },
  ];

  // Mtx-grid row selection checkbox options
  multiSelectable = true;
  rowSelectable = true;
  hideRowSelectionCheckbox = true;

  // Mtx-grid column move and hide options
  columnHideable = true;
  columnMovable = true;
  columnHideableChecked: "show" | "hide" = "show";

  // Creates a source for the data
  tableValues = new BehaviorSubject<MatTableDataSource<any>>(
    new MatTableDataSource<any>([])
  );

  ngOnInit() {
    this.log.msg("1", "Initializing component...", "feature-list");

    // Initialize the co_features_pagination variable in the local storage
    this.log.msg("1", "Loading feature pagination...", "feature-list");
    this.featuresPagination$.subscribe((value) =>
      localStorage.setItem("co_features_pagination", value)
    );

    // load column settings
    // this.getSavedColumnSettings();
  }

  /**
   * Global functions
   */

  storePagination(event) {
    this.log.msg(
      "1",
      "Storing feature pagination in local storage...",
      "feature-list",
      event.pageSize
    );
    return this._store.dispatch(
      new Configuration.SetProperty(
        "co_features_pagination",
        event.pageSize,
        true
      )
    );
  }

  /**
   * Saves current sort settings to localStorage
   */
  saveSort(event) {
    // save to localStorage
    this.log.msg(
      "1",
      "Saving chosen sort in localStorage...",
      "feature-list",
      event
    );
    localStorage.setItem("co_feature_table_sort_v2", JSON.stringify(event));
  }

  getSavedSort(key) {
    // load data from localStorage if null or undefined set a default
    const savedSort = JSON.parse(
      localStorage.getItem("co_feature_table_sort_v2") || // get value from localStorage
        '{"active":"date","direction":"desc"}' // if localStorage returns null or undefined set a default value
    );
    // return key value requested
    return savedSort[key];
  }

  /**
   * Saves current column settings to localStorage
   */
  saveColumnSettings(event) {
    this.log.msg("1", "Saving column settings...", "feature-list", event);

    // add missing keys for next reload
    event.forEach((column) => {
      // get default properties for current column
      const defaultProperties = this.columns.find(
        (defaultColumn) => defaultColumn.header == column.label
      );
      // concat current column values with default properties and also add hide property
      Object.assign(column, defaultProperties, { hide: !column.show });
    });
    // save to localStorage
    localStorage.setItem("co_feature_table_columns_v2", JSON.stringify(event));

    // refresh columns
    this.columns = event;
  }

  getSavedColumnSettings() {
    this.log.msg("1", "Getting saved column settings...", "feature-list");

    // check if co_feature_table_columns_v2 exists in localStorage if so import it into columns else use default
    this.columns =
      JSON.parse(localStorage.getItem("co_feature_table_columns_v2")) || // get value from localStorage
      this.columns; // if localStorage returns null or undefined set a default value
  }


  // Closes the add feature / folder menu
  closeAddButtons() {
    this.closeAdd.emit(null);
  }


  deleteFeatureHistory(){
    
  }

}
