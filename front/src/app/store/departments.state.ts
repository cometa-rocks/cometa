import { State, Action, StateContext } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { map, tap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { Departments } from './actions/departments.actions';
import { MatSnackBar } from '@angular/material/snack-bar';
import produce from 'immer';

/**
 * @description Contains the state of departments for Admin and Users
 * @author Alex Barba
 */
@State<Department[]>({
  name: 'departments',
  defaults: [],
})
@Injectable()
export class DepartmentsState {
  constructor(private _api: ApiService, private _snackBar: MatSnackBar) {}

  @Action(Departments.GetAdminDepartments)
  getAdminDepartments({ setState }: StateContext<Department[]>) {
    return this._api.getDepartments().pipe(
      map(json => json.results),
      tap(departments => setState(departments))
    );
  }

  @Action(Departments.AddAdminDepartment)
  setAdminDepartment(
    { setState, getState }: StateContext<Department[]>,
    { department }: Departments.AddAdminDepartment
  ) {
    // Add department only if doesn't exist already
    if (
      !getState().some(dept => dept.department_id === department.department_id)
    ) {
      // Add new department
      setState([...getState(), department]);
    }
  }

  @Action(Departments.UpdateDepartment)
  updateDepartment(
    { setState, getState }: StateContext<Department[]>,
    { departmentId, options }: Departments.UpdateDepartment
  ) {
    setState(
      produce(getState(), (ctx: Department[]) => {
        const index = ctx.findIndex(
          dept => dept.department_id === departmentId
        );
        if (index !== -1) {
          ctx[index] = {
            ...ctx[index],
            ...options,
          };
        }
      })
    );
  }

  @Action(Departments.RemoveAdminDepartment)
  removeAdminDepartment(
    { setState, getState }: StateContext<Department[]>,
    { department_id }: Departments.RemoveAdminDepartment
  ) {
    setState(getState().filter(dept => dept.department_id !== department_id));
  }

  // file upload status actions
  @Action(Departments.FileUploadStatusUknown)
  fileUploadStatusUknown(
    { setState, getState }: StateContext<Department[]>,
    { file }: Departments.FileUploadStatusUknown
  ) {
    this.updateFileStatus(setState, getState, file);
  }

  @Action(Departments.FileUploadStatusProcessing)
  fileUploadStatusProcessing(
    { setState, getState }: StateContext<Department[]>,
    { file }: Departments.FileUploadStatusProcessing
  ) {
    this.updateFileStatus(setState, getState, file);
  }

  @Action(Departments.FileUploadStatusScanning)
  fileUploadStatusScanning(
    { setState, getState }: StateContext<Department[]>,
    { file }: Departments.FileUploadStatusScanning
  ) {
    this.updateFileStatus(setState, getState, file);
  }

  @Action(Departments.FileUploadStatusEncrypting)
  fileUploadStatusEncrypting(
    { setState, getState }: StateContext<Department[]>,
    { file }: Departments.FileUploadStatusEncrypting
  ) {
    this.updateFileStatus(setState, getState, file);
  }

  @Action(Departments.FileUploadStatusDone)
  fileUploadStatusDone(
    { setState, getState }: StateContext<Department[]>,
    { file }: Departments.FileUploadStatusDone
  ) {
    this.updateFileStatus(setState, getState, file);
  }

  @Action(Departments.FileUploadStatusError)
  fileUploadStatusError(
    { setState, getState }: StateContext<Department[]>,
    { file, error }: Departments.FileUploadStatusError
  ) {
    // Handle critical errors that require file removal
    const criticalErrors = ['NOT_DDR_FILE', 'FILE_VIRUS_DETECTED', 'FILE_ALREADY_EXIST'];
    if (error && criticalErrors.includes(error.status)) {
      // Show appropriate error message
      if (error.status === 'NOT_DDR_FILE') {
        this.showDDRValidationError(error);
      } else {
        this.updateFileStatus(setState, getState, file, error);
      }
      // Remove file after delay (shorter for DDR, longer for others)
      const delay = error.status === 'NOT_DDR_FILE' ? 500 : 3000;
      setTimeout(() => this.removeFailedFile(setState, getState, file), delay);
      return;
    }
    
    // For other errors, use the normal flow
    this.updateFileStatus(setState, getState, file, error);
  }

  private updateFileStatus(
    setState,
    getState,
    file: UploadedFile,
    error?: FileUploadError
  ) {
    setState(
      produce(getState(), (ctx: Department[]) => {
        const index = ctx.findIndex(
          dept => dept.department_id == Number(file.department)
        );
        if (error) file.error = error;

        if (index !== -1) {
          // find files of department
          let files = ctx[index].files as UploadedFile[];

          // get current file index in files array
          let tmpFileIndex = files.findIndex(f => f.name === file.name);

          // set file properties received from websocket
          files[tmpFileIndex] = file;

          const payload = { files: files } as any;

          // refresh state
          ctx[index] = {
            ...ctx[index],
            ...payload,
          };
        }
      })
    );
  }

  private removeFailedFile(setState, getState, file: UploadedFile): void {
    setState(
      produce(getState(), (ctx: Department[]) => {
        const departmentIndex = ctx.findIndex(
          dept => dept.department_id == Number(file.department)
        );

        if (departmentIndex !== -1) {
          // Remove the failed file from the department's files array
          const files = ctx[departmentIndex].files as UploadedFile[];
          
          // Remove file by name (most reliable for failed uploads) and any file with matching id
          const filteredFiles = files.filter(f => {
            // Remove if name matches (primary matching for failed uploads)
            if (f.name === file.name) return false;
            // Also remove if id matches and it's not null/undefined
            if (file.id && f.id === file.id) return false;
            // Remove files with "Uploading" status that have the same name (cleanup stuck uploads)
            if (f.status === 'Uploading' && f.name === file.name) return false;
            return true;
          });
          
          ctx[departmentIndex] = {
            ...ctx[departmentIndex],
            files: filteredFiles
          };
        }
      })
    );
  }

  private showDDRValidationError(error: FileUploadError): void {
    const isInvalidFeatureId = error.description?.includes('Invalid feature_id values');
    const message = isInvalidFeatureId
      ? `${error.description} Please ensure all feature_id values are numeric and try uploading again.`
      : 'Data-driven files require a feature_id or feature_name column. Please add the missing column and upload again.';
    
    this._snackBar.open(message, 'OK', {
      duration: isInvalidFeatureId ? 15000 : 12000,
      panelClass: ['file-management-custom-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
}
