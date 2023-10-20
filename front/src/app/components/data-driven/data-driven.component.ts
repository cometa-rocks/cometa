import { Component, OnInit } from "@angular/core";
import { Select, Store } from "@ngxs/store";
import { Observable } from "rxjs";
import { FeaturesState } from "@store/features.state";
import { CommonModule } from "@angular/common";
import { SharedModule } from "@modules/shared.module";
import { ViewSelectSnapshot } from "@ngxs-labs/select-snapshot";
import { ConfigState } from "@store/config.state";
import { FileUploadService } from "@services/file-upload.service";
import { UserState } from "@store/user.state";
import { MatSnackBar } from "@angular/material/snack-bar";
import { ApplicationsState } from "@store/applications.state";
import { EnvironmentsState } from "@store/environments.state";

@Component({
  selector: "cometa-data-driven",
  imports: [CommonModule, SharedModule],
  templateUrl: "./data-driven.component.html",
  styleUrls: ["./data-driven.component.scss"],
  standalone: true,
})
export class DataDrivenComponent implements OnInit {
  displayedColumns: string[] = [
    "name",
    "mime",
    "size",
    "uploaded_by.name",
    "created_on",
    "actions",
  ];

  departments$ = this._store.selectSnapshot(UserState.RetrieveUserDepartments);
  applications$ = this._store.selectSnapshot(ApplicationsState);
  environments$ = this._store.selectSnapshot(EnvironmentsState);

  @Select(FeaturesState.GetFeaturesWithinFolder) features$: Observable<
    ReturnType<typeof FeaturesState.GetFeaturesWithinFolder>
  >;
  @ViewSelectSnapshot(ConfigState) config$!: Config;
  @ViewSelectSnapshot(UserState) user!: UserInfo;

  department: Department;
  application: Application;
  environment: Environment;

  constructor(
    private fileUpload: FileUploadService,
    private _store: Store,
    private _snackBar: MatSnackBar
  ) {
   
  }

  ngOnInit() {
    this.fillDropdownsOnInit(); // TODO: Change mode based on the edit or new.
  }

  onUploadFile(ev) {
    let formData: FormData = new FormData();
    let files = ev.target.files;

    for (let file of files) {
      formData.append("files", file);
    }

    let detpid = this.department.department_id.toString();
    formData.append("department_id", detpid);

    this.fileUpload.startUpload(files, formData, this.department, this.user);
  }

  onDeleteFile(file: UploadedFile) {
    this.fileUpload.deleteFile(file.id).subscribe((res) => {
      if (res.success) this.fileUpload.updateFileState(file, this.department);
    });
  }

  onRestoreFile(file: UploadedFile) {
    let formData: FormData = new FormData();
    formData.append("restore", String(file.is_removed));

    this.fileUpload.restoreFile(file.id, formData).subscribe((res) => {
      if (res.success) this.fileUpload.updateFileState(file, this.department);
    });
  }

  onDownloadFile(file: UploadedFile) {
    // return if file is still uploading
    if (file.status.toLocaleLowerCase() != "done") {
      return;
    }

    const downloading = this._snackBar.open(
      "Generating file to download, please be patient.",
      "OK",
      { duration: 10000 }
    );

    this.fileUpload.downloadFile(file.id).subscribe({
      next: (res) => {
        const blob = new Blob([this.base64ToArrayBuffer(res.body)], {
          type: file.mime,
        });
        this.fileUpload.downloadFileBlob(blob, file);
        downloading.dismiss();
      },
      error: (err) => {
        if (err.error) {
          const errors = JSON.parse(err.error);
          this._snackBar.open(errors.error, "OK");
        }
      },
    });
  }

  base64ToArrayBuffer(data: string) {
    const byteArray = atob(data);
    const uint = new Uint8Array(byteArray.length);
    for (let i = 0; i < byteArray.length; i++) {
      let ascii = byteArray.charCodeAt(i);
      uint[i] = ascii;
    }
    return uint;
  }

  fillDropdownsOnInit(mode: string = 'new') {
    switch(mode) {
      case 'new':
        this.preSelectedOrDefaultOptions();
        break;
      case 'edit':
        // TODO: Get data from the data-driven object
        break;
      default:
        break;
    }
  }
  
  preSelectedOrDefaultOptions() {
    const { 
      preselectDepartment,
      preselectApplication,
      preselectEnvironment
    } = this.user.settings;
    
    const department: Department = this.departments$.find(d => d.department_id == preselectDepartment) || this.departments$[0];
    const application: Application = this.applications$.find(a => a.app_id == preselectApplication) || this.applications$[0]
    const environment: Environment = this.environments$.find(e => e.environment_id == preselectEnvironment) || this.environments$[0]

    this.department = department;
    this.application = application;
    this.environment = environment;
  }
}
