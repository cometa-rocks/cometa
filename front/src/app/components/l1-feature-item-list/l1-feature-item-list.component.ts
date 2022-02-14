/**
 * l1-feature-item-list.component.ts
 *
 * Contains the code to control the behaviour of the item list (each feature is a squared item) in the new landing
 *
 * @author dph000
 */
import { Component, OnInit, Input } from '@angular/core';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { Observable, switchMap, tap } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { observableLast, Subscribe } from 'ngx-amvara-toolbox';
import { NavigationService } from '@services/navigation.service';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { SharedActionsService } from '@services/shared-actions.service';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Features } from '@store/actions/features.actions';
import { AddFolderComponent } from '@dialogs/add-folder/add-folder.component';
import { ApiService } from '@services/api.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'cometa-l1-feature-item-list',
  templateUrl: './l1-feature-item-list.component.html',
  styleUrls: ['./l1-feature-item-list.component.scss']
})
export class L1FeatureItemListComponent implements OnInit {

  constructor(
    private _router: NavigationService,
    private _store: Store,
    public _sharedActions: SharedActionsService,
    private _dialog: MatDialog,
    private _api: ApiService,
    private _snackBar: MatSnackBar
  ) { }

  // Receives the item from the parent component
  @Input() item: any;
  @ViewSelectSnapshot(UserState.GetPermission('create_feature')) canCreateFeature: boolean;
  @Input() feature_id: number;

  /**
   * Global variables
   */
  feature$: Observable<Feature>;
  featureRunning$: Observable<boolean>;
  featureStatus$: Observable<string>;
  canEditFeature$: Observable<boolean>;
  canDeleteFeature$: Observable<boolean>;


  // NgOnInit
  ngOnInit() {
    this.feature$ = this._store.select(CustomSelectors.GetFeatureInfo(this.feature_id));
    // Subscribe to the running state comming from NGXS
    this.featureRunning$ = this._store.select(CustomSelectors.GetFeatureRunningStatus(this.feature_id));
    // Subscribe to the status message comming from NGXS
    this.featureStatus$ = this._store.select(CustomSelectors.GetFeatureStatus(this.feature_id));
    this.canEditFeature$ = this._store.select(CustomSelectors.HasPermission('edit_feature', this.feature_id));
    this.canDeleteFeature$ = this._store.select(CustomSelectors.HasPermission('delete_feature', this.feature_id));
  }

  async goLastRun() {
    const feature = await observableLast<Feature>(this.feature$);
    this._router.navigate([
      `/${feature.info.app_name}`,
      feature.info.environment_name,
      feature.info.feature_id,
      'step',
      feature.info.feature_result_id
    ], {
      queryParams: {
        runNow: 1
      }
    });
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

  // Moves the selected folder
  SAmoveFolder(folder: Folder) {
    this._sharedActions.moveFolder(folder);
  }

  // Moves the selected feature
  SAmoveFeature(feature: Feature) {
    this._sharedActions.moveFeature(feature);
  }
}
