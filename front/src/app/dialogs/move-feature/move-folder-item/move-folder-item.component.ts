import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { ApiService } from '@services/api.service';
import { Store } from '@ngxs/store';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { EnterValueComponent } from '@dialogs/enter-value/enter-value.component';
import { filter, map, switchMap, tap } from 'rxjs/operators';
import { Subscribe } from 'app/custom-decorators';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { ConfigService } from '@services/config.service';
import { Features } from '@store/actions/features.actions';
import { AddFolderComponent } from '@dialogs/add-folder/add-folder.component';

@Component({
  selector: 'cometa-move-folder-item',
  templateUrl: './move-folder-item.component.html',
  styleUrls: ['./move-folder-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MoveFolderItemComponent {

  constructor(
    public _config: ConfigService,
    private _api: ApiService,
    private _store: Store,
    private _dialog: MatDialog,
    private _snackBar: MatSnackBar
  ) { }

  extended$ = this._config.openedFolders.pipe(
    map(folders => folders.includes(this.folder.folder_id) || this.folder.folder_id === null)
  );

  @Input() child: number;

  @Input() folder: Folder;

  selectFolder() {
    let openedFolders = this._config.openedFolders.getValue();
    // Check if the folder is expanded
    if (!openedFolders.includes(this.folder.folder_id)) {
      // Add it to the opened folders, expanding it
      openedFolders.push(this.folder.folder_id);
    // Save the expansion status
      this._config.openedFolders.next(openedFolders);
    }
    // Select the clicked folder if it isn't the home folder
    if (this.folder.type != 'home') {
      this._config.selectedFolderId.next({type: this.folder.type, id: this.folder.folder_id, name: this.folder.name, department: this.folder.department});
    }
  }

  /**
   * When clicked on the arrow, expand or hide the items without selecting
   * @author dph000
   * @created 21/11/11
   * @lastModified 21/11/11
   */
  expandControl() {
    let openedFolders = this._config.openedFolders.getValue();
    // Check if the folder is expanded
    if (openedFolders.includes(this.folder.folder_id)) {
      // Remove it from the opened folders, closing it
      openedFolders = openedFolders.filter(folder_id => folder_id !== this.folder.folder_id);
    } else {
      // Add it to the opened folders, expanding it
      openedFolders.push(this.folder.folder_id);
    }
    // Save the expansion status
    this._config.openedFolders.next(openedFolders);
  }

  @Subscribe()
  createFolder() {
    return this._dialog.open(EnterValueComponent, {
      autoFocus: true,
      data: {
        word: 'Folder'
      }
    })
    .afterClosed()
    .pipe(
      switchMap(res => this._api.createFolder(res.value, this.folder.folder_id).pipe(
        map(() => res)
      )),
      switchMap(res => this._store.dispatch( new Features.GetFolders ).pipe(
        map(() => res)
      )),
      tap(folder => {
        const openedFolders = this._config.openedFolders.getValue();
        openedFolders.push(this.folder.folder_id);
        this._config.openedFolders.next(openedFolders);
        this._snackBar.open(`Folder ${folder.value} created`, 'OK');
      })
    );
  }

  modifyFolder() {
    return this._dialog.open(AddFolderComponent, {
      autoFocus: true,
      data: {
        mode: 'edit',
        folder: this.folder
      } as IEditFolder
    })
    .afterClosed()
    .pipe(
      filter((res: boolean) => !!res),
      switchMap(_ => this._store.dispatch( new Features.GetFolders )),
    ).subscribe(_ => {
      const openedFolders = this._config.openedFolders.getValue();
      openedFolders.push(this.folder.folder_id);
      this._config.openedFolders.next(openedFolders);
      this._snackBar.open(`Folder modified successfully`, 'OK');
    })
  }

  @Subscribe()
  deleteFolder() {
    return this._api.removeFolder(this.folder.folder_id).pipe(
      switchMap(_ => this._store.dispatch( new Features.GetFolders )),
      tap(_ => this._snackBar.open(`Folder ${this.folder.name} removed`, 'OK'))
    );
  }

}
