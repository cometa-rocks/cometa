/**
 * File upload service based on websockets
 * File upload template, allows multiple file upload
 * Websocket service returns resoponses for one file at a time, if user uploads more than 1 file and we render response from websockets,
 * template will not render both file, but first the first one and then second one
 * In order to prevent above said behaviour, when user uploads varios files we dispatch temporari files into department state which are then updated one by one, depending on the response from websocket
 * To observe how to files are updated, check 'department.state.ts > updateFileStatus()'
 * Each file will be avaliable for download, once websocket communication for this certain file has been finished
 * File will not be uploaded if backend side detects that it already exists or is malicious
**/


import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Store } from '@ngxs/store';
import { Departments } from '@store/actions/departments.actions';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})

export class FileUploadService {  
  constructor(private _store: Store, private _api: ApiService, private _snack: MatSnackBar) { }

  startUpload(files: File[], formData: FormData, department: Department, user) {
    this.setTempFiles([...files], department, user);

    // starts websocket comunication for each uploaded file
    this._api.uploadFiles(formData).subscribe();
  }

  // temporarilty inserts uploaded files into department state, temporary files contain information received from file input event
  private setTempFiles(files: File[], department: Department, user) {
    const payload = {
      files: [
        ...this.getTempFilesInfo(files, user),
        ...department.files
      ]
    } as any;

    // dispatches temporary files into department state
    this._store.dispatch( new Departments.UpdateDepartment(department.department_id, payload) );
  }

  // gets information of file input for each file
  private getTempFilesInfo(files: File[], user) {
    const uploadedFiles: UploadedFile[] = [];

    files.forEach(file => {
      // for each file, generates object and pushed it into array
      uploadedFiles.push(this.getTempFileObject(file, user));
    })

    return uploadedFiles;
  }

  // sets up temporary file object
  private getTempFileObject(file: File, user) {
    const uploadedFile = <UploadedFile> {};
    const { name, size, type } = file;

      uploadedFile.name = name;
      uploadedFile.size = size;
      uploadedFile.mime = type;
      uploadedFile.is_removed = false;
      uploadedFile.uploaded_by = {
        name: user.name
      }
      uploadedFile.created_on = new Date().toJSON();
      uploadedFile.status = 'Unknown';

    return uploadedFile;
  }

  // constantly observes if specific department contains any file with property 'error', if so:  informs user with snackbar, removes file and actualizes department's state
  validateFileUploadStatus(department: Department) {
    department.files.forEach((file: UploadedFile) => {
      if (file.error) {
        this.informAndRemoveFile(file, department);
      }
    });
  }

  // Opens informative snackbar when file user intends to upload could be uploaded because of duplication or potential virus
  private informAndRemoveFile(file: UploadedFile, department: Department) {
    let snack = this._snack.open(file.error.description, 'OK', { duration: 10000 });

    // removes invalid file from department state if snackbar is dissmissed because of timeout or click event on another component of the body
    snack.afterDismissed().subscribe(() => {
      this.removeFile(file, department)
    });
    
    // removes invalid file from department state if snackbar is dissmised because of action click event
    snack.onAction().subscribe(() => {
      this.removeFile(file, department)
    });
  }

  // removes recieved file from recieved department's files array and actualises the department state
  removeFile(file: UploadedFile, department: Department) {
    const files = department.files.filter((f: UploadedFile) => f.name != file.name)

    const payload = {
      files: [
        ...files
      ]
    } as any;

    // dispatches new files array that does not contain invalid file into department state
    this._store.dispatch( new Departments.UpdateDepartment(department.department_id, payload) );
  }

  updateFileState(file: UploadedFile, department: Department) {
    const files = department.files.filter((f: UploadedFile) => f.id != file.id)

    const updatedfile = { ...file, is_removed: !file.is_removed };

    const payload = {
      files: [
        ...files,
        updatedfile
      ]
    } as any;

    this._store.dispatch( new Departments.UpdateDepartment(department.department_id, payload) );
  }

  downloadFileBlob(blob: Blob, file: UploadedFile) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = file.name;
    link.click();
  }


  deleteFile(file_id: number) {
    return this._api.deleteFile(file_id);
  }

  restoreFile(file_id: number, formData: FormData) {
    return this._api.updateFile(file_id, formData);
  }

  downloadFile(file_id: number) {
    return this._api.downloadFile(file_id);
  }
}