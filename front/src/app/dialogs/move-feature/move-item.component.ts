// # ######################################## #
// # Changelog:
// # 2022-05-26 TONY ADDED - move feature dialog. Local reference: 1.1  ticket: #3460
// # ######################################## #

import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Store } from '@ngxs/store';
import { FeaturesState } from '@store/features.state';
import { ApiService } from '@services/api.service';
import { Observable, NEVER } from 'rxjs';
import { ConfigService } from '@services/config.service';
import { CustomSelectors } from '@others/custom-selectors';
import { AreYouSureData, AreYouSureDialog } from '@dialogs/are-you-sure/are-you-sure.component';

@Component({
  selector: 'cometa-move-item',
  templateUrl: './move-item.component.html',
  styleUrls: ['./move-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MoveItemDialog {

  homeFolder$: Observable<Folder>;

  previousFolderId: number;

  originFolder: Partial<Folder>;

  constructor(
    private dialogRef: MatDialogRef<MoveItemDialog>,
    @Inject(MAT_DIALOG_DATA) public data: IMoveData,
    public _config: ConfigService,
    private _store: Store,
    private _api: ApiService,
    private dialog: MatDialog
  ) {
    // If statement that decides which data to send to the backend (see backend's views.py:1883 for more info about old_folder and new_folder)
    // Move a feature
    if (this.data.type === 'feature') {
      // Get the current route
      let currentRoute = this._store.selectSnapshot(FeaturesState.GetSelectionFolders);
      let homeFolder: Partial<Folder> = {department: this.data.feature?.department_id, folder_id: 0, name: 'HOME', type: 'department'}
      this.originFolder = currentRoute[0] || homeFolder;
      // Assign a 0 value to the old_folder variable
      this.previousFolderId = 0;
      if (currentRoute.length > 0) {
        const routeType = currentRoute[currentRoute.length - 1];
        this.originFolder = routeType;
        // Get which folder to send and where
        this.previousFolderId = ['department', 'home'].includes(routeType.type) ? 0 : routeType.folder_id;
        this._config.selectedFolderId.next({type: routeType.type, id: this.previousFolderId, name: '', department: this.data.feature.department_id});
      } else {
        this._config.selectedFolderId.next({type: 'home', id: 0, name: 'home', department: this.data.feature.department_id});
      }
      // Move a folder
    } else {
      // Get which folder to send and where
      this.previousFolderId = this.data.folder.current_folder_id;
      this._config.selectedFolderId.next({type: 'folder', id: this.previousFolderId, name: '', department: this.data.feature?.department_id});
    }
    this.homeFolder$ = this._store.select(CustomSelectors.GetDepartmentFoldersNew());
  }

  /**
   * Checks if the clicked folder is the same as the current location
   * @author dph000
   * @created 21/11/11
   * @lastModified 21/11/11
   */
  checkFolder() {
    let selectedFolder = this._config.selectedFolderId.getValue();

    if (selectedFolder.id === this.originFolder?.folder_id) {
      return true;
    }
    if (this.data.type === 'folder' && this.data.folder?.folder_id === selectedFolder.id) {
      return true;
    }
    return false;
  }

  changeFolder() {
    let req: Observable<any>;
    const folderData = this._config.selectedFolderId.getValue();
    if (['department', 'home'].includes(folderData.type)) {
      folderData.id = 0;
    }
    switch (this.data.type) {
      case 'feature':
        // Copy data
        let newFeature = this.data.feature;
        // Change the department data if the testcase is being moved to another department
        if (folderData.type === 'department') {
          newFeature.department_id = folderData.department;
          newFeature.department_name = folderData.name;
        }

        // Removes useless variables in the patch
        delete newFeature.created_by;
        delete newFeature.last_edited;
        delete newFeature.info;
        delete newFeature.steps;

        // changelog reference: 1.1, ticket #3460 -------------------------------------------------------------------- start
        // reason of implementation: unaccessible environment variables
        // testcase: If user moves a feature that uses environment variables from deparment 'X' to department 'Y'
        // the feature in question will no longer have access to the content of department 'X's environment variables
        // causing the test to fail, unless department 'Y' also has environment variables that the feature uses
        // for this reason we implement are you sure dialog, to advert user about possible consequences of this action

        // if destination's department is not the same as origin's department
        if(folderData.department !== this.originFolder.department) {
          // open dialog
          this.dialog.open(AreYouSureDialog, {
            data: {
              title: 'translate:you_sure.move_feature_title',
              description: 'translate:you_sure.move_feature'
            } as AreYouSureData
          }).afterClosed().subscribe(move => {
            if(move) {
              // if user clicks on 'yes' in dialog, move will be set to true
              // Patch and move the testcase
              req = this._api.patchFeatureV2(newFeature.feature_id, newFeature, this.previousFolderId, folderData.id || 0, folderData.department);

              // close folder picker dialog
              this.closedialogRef(req);
            }
          });
        } else {
          // if user attempts to move feature in the same department, then just move it without 'are you sure' dialog
          // Patch and move the testcase
          req = this._api.patchFeatureV2(newFeature.feature_id, newFeature, this.previousFolderId, folderData.id || 0, folderData.department);

          // close folder picker dialog
          this.closedialogRef(req);
        }
        // changelog reference: 1.1, ticket #3460 -------------------------------------------------------------------- end
        break;

      case 'folder':
        // save payload to an object
        let payload = {
          folder_id: this.data.folder.folder_id,
          parent_id: folderData.id || null
        } as any;
        // check if folderData is of type department if so send department value as well
        if (folderData.type == 'department') payload.department = folderData.department;
        req = this._api.modifyFolder(payload)
        this.closedialogRef(req);
        break;
      default:
        req = NEVER;
        this.closedialogRef(req);
    }
  }

  closedialogRef(req: Observable<any>) {
    req.subscribe(_ => {
      // Commented as it forces two requests to folders api
      // this._store.dispatch( new Features.GetFolders );
      this.dialogRef.close();
    });
  }
}
