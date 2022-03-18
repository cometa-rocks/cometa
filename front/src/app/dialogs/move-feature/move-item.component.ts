import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Store } from '@ngxs/store';
import { FeaturesState } from '@store/features.state';
import { ApiService } from '@services/api.service';
import { Observable, NEVER } from 'rxjs';
import { ConfigService } from '@services/config.service';
import { CustomSelectors } from '@others/custom-selectors';

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
    private _api: ApiService
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
        // Patch and move the testcase
        req = this._api.patchFeatureV2(newFeature.feature_id, newFeature, this.previousFolderId, folderData.id || 0, folderData.department);
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
        break;
      default:
        req = NEVER;
    }
    req.subscribe(_ => {
      // Commented as it forces two requests to folders api
      // this._store.dispatch( new Features.GetFolders );
      this.dialogRef.close();
    });
  }

}
