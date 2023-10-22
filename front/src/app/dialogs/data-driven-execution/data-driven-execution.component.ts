import { ChangeDetectorRef, Component, HostListener, OnInit } from "@angular/core";
import { Select } from "@ngxs/store";
import { Observable } from "rxjs";
import { FeaturesState } from "@store/features.state";
import { ViewSelectSnapshot } from "@ngxs-labs/select-snapshot";
import { ConfigState } from "@store/config.state";
import { FileUploadService } from "@services/file-upload.service";
import { UserState } from "@store/user.state";
import { MatSnackBar } from "@angular/material/snack-bar";
import { KEY_CODES } from "@others/enums";
import { MtxGridColumn } from "@ng-matero/extensions/grid";
import { HttpClient } from "@angular/common/http";
import { InterceptorParams } from "ngx-network-error";
import { DataDrivenTestExecuted } from "./data-driven-executed/data-driven-executed.component";
import { DepartmentsState } from "@store/departments.state";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";

@Component({
  selector: "data-driven-execution",
  templateUrl: "./data-driven-execution.component.html",
  styleUrls: ["./data-driven-execution.component.scss"],
})
export class DataDrivenExecution implements OnInit {
  columns: MtxGridColumn[] = [
    {header: 'Status', field: 'status', showExpand: true, class: (row: UploadedFile, col: MtxGridColumn) => {
      if (row && row.status !== 'Done') return 'no-expand';
      else return '';
    }},
    {header: 'File Name', field: 'name', sortable: true, class: 'name'},
    {header: 'Size', field: 'size', sortable: true},
    {header: 'Uploaded By', field: 'uploaded_by.name', sortable: true},
    {header: 'Uploaded On', field: 'created_on', sortable: true},
    {
      header: 'Options',
      field: 'options',
      // pinned: 'right',
      right: '0px',
      type: 'button',
      buttons: [
        {
          type: 'icon',
          text: 'play_circle_fill',
          icon: 'play_circle_fill',
          tooltip: 'Execute this file',
          color: 'primary',
          click: (result: UploadedFile) => {
            this.execute_data_driven(result, this)
          },
        },
        {
          type: 'icon',
          text: 'delete',
          icon: 'delete',
          tooltip: 'Delete result',
          color: 'warn',
          click: (result: UploadedFile) => {
            this.onDeleteFile(result);
          },
        }
      ]
    }
  ];

  @Select(DepartmentsState) departments$: Observable<Department[]>;

  @Select(FeaturesState.GetFeaturesWithinFolder) features$: Observable<
    ReturnType<typeof FeaturesState.GetFeaturesWithinFolder>
  >;
  @ViewSelectSnapshot(ConfigState) config$!: Config;
  @ViewSelectSnapshot(UserState) user!: UserInfo;

  department: Department;

  constructor(
    private fileUpload: FileUploadService,
    private _snackBar: MatSnackBar,
    private _http: HttpClient,
    private cdRef: ChangeDetectorRef,
    private _dialog: MatDialog,
    public dialogRef: MatDialogRef<DataDrivenExecution>,
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
    } = this.user.settings;
    
    this.departments$.subscribe(deps => {
      this.department = deps.find(d => d.department_id == (this.department ? this.department.department_id : preselectDepartment)) || deps[0];
    });
  }

  // Handle keyboard keys
  @HostListener('document:keydown', ['$event']) handleKeyboardEvent(event: KeyboardEvent) {
    // only execute switch case if child dialog is closed
    switch (event.keyCode) {
      case KEY_CODES.ESCAPE:
        this.dialogRef.close();
    }
  }

  closeDialog() {
    this.dialogRef.close();
  }

  execute_data_driven(file: UploadedFile, parent) {
    this._http.post('/backend/exec_data_driven/', {
      file_id: file.id
    }, {
      params: new InterceptorParams({
        skipInterceptor: true,
      })
    }).subscribe({
      next(res: any) {
        res = JSON.parse(res)
        if (res.success) {
          parent._dialog.open(DataDrivenTestExecuted, {
            minWidth: '500px',
            panelClass: 'edit-feature-panel',
            data: {
              run_id: res.run_id,
              file_name: file.name
            }
          });
          parent.dialogRef.close();
        }

      },
      error(err) {
        if (err.status >= 400 && err.status < 500) {
          const error = JSON.parse(err.error);
          parent._snackBar.open(`Error: ${error.error}. Please review the data and try again.`, 'OK', {
            duration: 30000
          });
        } 
      }
    })
  }

  getFileData(row) {
    row.isLoading = true;
    this._http.get(`/backend/api/data_driven/file/${row.id}`, {
      params: new InterceptorParams({
        skipInterceptor: true,
      }, {
        size: row.params.size,
        page: row.params.page + 1
      })
    }).subscribe({
      next: (res: any) => {
        res = JSON.parse(res);
        row.file_data = res.results.map(d => d.data)
        row.total = res.count
        row.showPagination = row.total > 0 ? true : false

        // generate headers for the data
        if (row.file_data.length > 0) {
          const d = row.file_data[0]
          const keys = Object.keys(d)

          row.columns = []
          keys.forEach(key => {
            row.columns.push({
              header: key, field: key
            })
          })
        }
      },
      error: (err) => {
        if (err.status >= 400 && err.status < 500) {
          const error = JSON.parse(err.error)
          row.file_data = [{'status': err.status, 'error': error}]
          row.total = 1;
          row.columns = [
            {header: 'Status Code', field: 'status'},
            {header: 'Error', field: 'error.error'}
          ]
          row.showPagination = false;
        }
      },
      complete: () => {
        row.isLoading = false
        this.cdRef.detectChanges();
      }
    })
  }

  updateData(e, row) {
    row.params.page = e.pageIndex;
    row.params.size = e.pageSize;
    this.getFileData(row);
  }

  expand(event) {
    if (event.expanded) {
      const row = event.data;
      if (!row.file_data) {
        // set some params
        row.params = {
          page: 0,
          size: 10
        }
        // fetch data
        this.getFileData(row)
      }
    }
  }
}
