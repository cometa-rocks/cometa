import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Store } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { Features } from '@store/actions/features.actions';
import { FeaturesState } from '@store/features.state';
import { UserState } from '@store/user.state';
import { map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'add-folder',
  templateUrl: './add-folder.component.html',
  styleUrls: ['./add-folder.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddFolderComponent{

  /**
   * These values are now filled in the constructor as they need to initialize before the view
   */
  // @ViewSelectSnapshot(UserState.RetrieveUserDepartments) departments: Department[];
  // List of the user's departments
  departments: Department[];
  // Gets the currently active route
  currentRouteNew: Partial<Folder>[];
  // List of available departments
  availableDepartments: Department[];
  // Sets the selected as default folder department
  selected_department: number;

  constructor(
    private dialogRef: MatDialogRef<AddFolderComponent>,
    @Inject(MAT_DIALOG_DATA) public data: IEditFolder,
    private fb: FormBuilder,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
    private _store: Store
    ) {
      // Gets the currently active route
      this.currentRouteNew = this._store.selectSnapshot(FeaturesState.GetCurrentRouteNew);
      this.departments = this._store.selectSnapshot(UserState.RetrieveUserDepartments);
      this.rForm = this.fb.group({
        name: [this.data.mode === 'edit' ? this.data.folder.name : '', Validators.required]
      });
      // Revision for the department is only required when the user is creating a folder in root route
      if (!this.data.folder?.parent_id) {
        this.rForm.addControl('department', this.fb.control(this.data.mode === 'edit' ? this.data.folder.department : null, this.currentRouteNew .length <= 1 && Validators.required))
      }
      // If the user is currently inside of a department root folder, filter the list to only said department
      if (this.currentRouteNew.length == 1) {
        this.availableDepartments = this.departments.filter(val => val.department_id == this.currentRouteNew[0].department);
      } else {
        this.availableDepartments = this.departments;
      }
      // Gets the currently active route
      let route = this._store.selectSnapshot(FeaturesState.GetCurrentRouteNew);
      // Automatically select the department where the user is currently in or the first available department
      this.selected_department = route.length > 0 ? route[0].department : this.availableDepartments[0].department_id;
  }

  rForm: FormGroup;

  submit(values) {
    if (this.data.mode === 'new') {
      this._api.createFolder(values.name, values.department, this.data.folder.folder_id).pipe(
        switchMap(res => this._store.dispatch( new Features.GetFolders ).pipe(
          map(() => res)
        )),
      ).subscribe(res => {
        if (res.success) {
          this._snackBar.open(`Folder ${values.name} created`, 'OK');
          this.dialogRef.close(true);
        } else if (res.handled) {
          this.dialogRef.close(false);
        } else {
          this._snackBar.open('An error ocurred.', 'OK');
        }
      })
    } else {
      this._api.modifyFolder({
        folder_id: this.data.folder.folder_id,
        name: values.name,
        department: values.department
      }).pipe(
        switchMap(_ => this._store.dispatch( new Features.GetFolders ))
      ).subscribe(_ => {
        this._snackBar.open('Folder modified', 'OK')
        this.dialogRef.close(true);
      })
    }
  }

}