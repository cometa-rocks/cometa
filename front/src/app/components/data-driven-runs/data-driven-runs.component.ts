import { HttpClient } from '@angular/common/http';
import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  TemplateRef,
} from '@angular/core';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { PageEvent } from '@angular/material/paginator';
import { Router } from '@angular/router';
import { DataDrivenExecution } from '@dialogs/data-driven-execution/data-driven-execution.component';
import { DataDrivenTestStop } from '@dialogs/data-driven-execution/data-driven-stop/data-driven-stop.component';
import { DataDrivenTestExecuted } from '@dialogs/data-driven-execution/data-driven-executed/data-driven-executed.component';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { ApiService } from '@services/api.service';
import { SharedActionsService } from '@services/shared-actions.service';
import { FileUploadService } from '@services/file-upload.service';
import { InterceptorParams } from 'ngx-network-error';
import { PixelDifferencePipe } from '@pipes/pixel-difference.pipe';
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatDividerModule } from '@angular/material/divider';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { NgIf, NgFor } from '@angular/common';
import { LetDirective } from '../../directives/ng-let.directive';
import { HostListener } from '@angular/core';
import { KEY_CODES } from '@others/enums';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { InputFocusService } from '@services/inputFocus.service';
import { Subscription } from 'rxjs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Select, Store, Actions, ofActionSuccessful } from '@ngxs/store';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { Observable } from 'rxjs';
import { UserState } from '@store/user.state';
import { ConfigState } from '@store/config.state';
import { DepartmentsState } from '@store/departments.state';
import { FeaturesState } from '@store/features.state';
import { DataDriven } from '@store/actions/datadriven.actions';
import { AvailableFilesPipe } from '@pipes/available-files.pipe';
import { HumanizeBytesPipe } from '@pipes/humanize-bytes.pipe';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { finalize, take, filter } from 'rxjs/operators';
import { SureRemoveFileComponent } from '@dialogs/sure-remove-file/sure-remove-file.component';
import { SureRemoveRunComponent } from '@dialogs/sure-remove-run/sure-remove-run.component';
import { MatSelectChange } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LoadingSpinnerComponent } from '@components/loading-spinner/loading-spinner.component';
import { LiveStepsComponent } from '@dialogs/live-steps/live-steps.component';
import { CommonModule } from '@angular/common';
import * as _ from 'lodash';
import { LogService } from '@services/log.service';
import { FilesManagementComponent } from '@components/files-management/files-management.component';

// Add interfaces to fix type errors
interface Department {
  department_id: number;
  department_name: string;
  files: UploadedFile[];
  selected?: boolean;
}

interface UploadedFile {
  id: number;
  name: string;
  status: "Done" | "Unknown" | "Processing" | "Scanning" | "Encrypting" | "DataDriven" | "Error";
  is_removed?: boolean;
  extras?: {
    ddr?: {
      'data-driven-ready'?: boolean;
    };
  };
  mime?: string;
  type?: string;
}

interface DataDrivenRun {
  run_id: number;
  status: string;
  running: boolean;
}

interface Config {
  toggles: {
    hideInformation?: boolean;
    hideUploadedFiles?: boolean;
  };
}

interface UserInfo {
  name: string;
  settings?: {
    preselectDepartment?: number;
  };
}

@Component({
  selector: 'cometa-data-driven-runs',
  templateUrl: './data-driven-runs.component.html',
  styleUrls: ['./data-driven-runs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MtxGridModule,
    LetDirective,
    NgIf,
    NgFor,
    StopPropagationDirective,
    MatLegacyMenuModule,
    MatDividerModule,
    MatLegacyButtonModule,
    AmParsePipe,
    AmDateFormatPipe,
    SecondsToHumanReadablePipe,
    PixelDifferencePipe,
    MatTooltipModule,
    TranslateModule,
    MatExpansionModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    AvailableFilesPipe,
    HumanizeBytesPipe,
    SortByPipe,
    MatProgressSpinnerModule,
    LoadingSpinnerComponent,
    CommonModule,
    FilesManagementComponent,
  ],
})
export class DataDrivenRunsComponent implements OnInit, OnDestroy {
  
  // Add accordion config property
  panelConfig = {
    informationPanel: true,
    executePanel: true,
    resultsPanel: true,
    filtersPanel: false
  };
  
  // Properties from DataDrivenExecution component
  @ViewSelectSnapshot(UserState.RetrieveUserDepartments)
  userDepartments$: Observable<Department[]>;
  @Select(DepartmentsState) departments$: Observable<Department[]>;
  @Select(FeaturesState.GetFeaturesWithinFolder) features$: Observable<
    ReturnType<typeof FeaturesState.GetFeaturesWithinFolder>
  >;
  @ViewSelectSnapshot(ConfigState) config$!: Config;
  @ViewSelectSnapshot(UserState) user!: UserInfo;

  department_id?: number;
  department: Department;
  selected_file_id: number | null = (() => {
    const savedFileId = localStorage.getItem('co_selected_file_id');
    const savedFilterType = localStorage.getItem('co_filter_type');
    return (savedFilterType === 'specific_file' && savedFileId) ? 
      parseInt(savedFileId, 10) : null;
  })();
  active_files_only: boolean = localStorage.getItem('co_filter_type') === 'active_only';
  filterType = localStorage.getItem('co_filter_type') || 'active_only';
  displayFilterValue: any = (() => {
    const savedFilterType = localStorage.getItem('co_filter_type');
    const savedFileId = localStorage.getItem('co_selected_file_id');
    return (savedFilterType === 'specific_file' && savedFileId) ? 
      ['specific_file', parseInt(savedFileId, 10)] : 
      (savedFilterType || 'active_only');
  })();
  
  // File columns definition for files-management component
  fileColumns: MtxGridColumn[] = [
    {
      header: 'ID',
      field: 'id',
      sortable: true,
      class: 'name' 
    },
    {
      header: 'Status',
      field: 'status',
      showExpand: true,
      class: (rowData: UploadedFile, colDef?: MtxGridColumn) => {
        return this.showDataChecks(rowData) ? '' : 'no-expand';
      },
    },
    { header: 'File Name', field: 'name', sortable: true, class: 'name' },
    { header: 'Type', field: 'type', sortable: true, hide: true },
    { header: 'MIME Type', field: 'mime', sortable: true, hide: true },
    { header: 'Size', field: 'size', sortable: true },
    { header: 'Uploaded By', field: 'uploaded_by.name', sortable: true },
    { header: 'Uploaded On', field: 'created_on', sortable: true },
    {
      header: 'Options',
      field: 'options',
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
            this.execute_data_driven(result, this);
          },
          iif: row =>
            this.showDataChecks(row) && this.dataDrivenExecutable(row) && !row.is_removed,
        },
        {
          type: 'icon',
          text: 'cloud_download',
          icon: 'cloud_download',
          tooltip: 'Download file',
          click: (result: UploadedFile) => {
            this.onFileDownloaded(result);
          },
          iif: row => row.status === 'Done' && !row.is_removed,
        },
        {
          type: 'icon',
          text: 'delete',
          icon: 'delete',
          tooltip: 'Delete file',
          color: 'warn',
          click: (result: UploadedFile) => {
            this.onFileDeleted(result);
          },
          iif: row => !row.is_removed,
        },
      ],
    },
  ];
  
  constructor(
    public _sharedActions: SharedActionsService,
    private cdRef: ChangeDetectorRef,
    private _router: Router,
    private _http: HttpClient,
    public _dialog: MatDialog,
    private _api: ApiService,
    private buttonDataDrivenTest: ElementRef,
    private inputFocusService: InputFocusService,
    private fileUpload: FileUploadService,
    private _snackBar: MatSnackBar,
    private _store: Store,
    private actions$: Actions,
    private log: LogService
  ) {

    this.focusSubscription = this.inputFocusService.inputFocus$.subscribe((inputFocused) => {
      this.inputFocus = inputFocused;
    });
    
    // Subscribe to department changes to keep local department object up-to-date
    this.departments$.subscribe(departments => {
      if (this.department_id !== undefined && this.department_id !== null && departments && departments.length > 0) {
        const currentSelectedDept = departments.find(d => d.department_id === this.department_id);
        if (currentSelectedDept) {
          // Update the local department reference ONLY if it exists in the new list
          this.department = currentSelectedDept;
          this.cdRef.markForCheck();
        }
      }
    });

    // Subscribe to DataDriven Status Updates from WebSocket
    this.actionsSubscription = this.actions$
      .pipe(ofActionSuccessful(DataDriven.StatusUpdate)) // Listen for the specific action type
      .subscribe((action: DataDriven.StatusUpdate) => {
        this.updateRunStatusFromAction(action);
      });
  }


  columns: MtxGridColumn[] = [
    { 
      header: 'Status', 
      field: 'status', 
      sortable: true,
      formatter: (data: any) => {
        // If running is true, always show "Running" regardless of status field
        if (data.running) {
          return 'Running';
        }
        // Return status if it exists, otherwise return 'Failed' as fallback
        return data.status || 'Failed';
      } 
    },
    { header: 'File Name', field: 'file.name', sortable: true, class: 'name' },
    {
      header: 'Execution Date',
      field: 'date_time',
      sortable: true,
      width: '190px',
      sortProp: { start: 'desc', id: 'date_time' },
    },
    { header: 'Total', field: 'total', sortable: true },
    { header: 'OK', field: 'ok', sortable: true },
    { header: 'NOK', field: 'fails', sortable: true },
    { header: 'Skipped', field: 'skipped' },
    { header: 'Duration', field: 'execution_time', sortable: true },
    { header: 'Pixel Diff', field: 'pixel_diff', sortable: true },
    {
      header: 'Options',
      field: 'options',
      // pinned: 'right',
      right: '0px',
      type: 'button',
      width: '130px',
      buttons: [
        {
          type: 'icon',
          icon: 'visibility',
          tooltip: 'View Run Details',
          click: (row: DataDrivenRun) => {
            this.openContent(row);
          },
          iif: (row: DataDrivenRun) => !!row.running,
        },
        {
          type: 'icon',
          text: 'Stop',
          icon: 'stop',
          tooltip: 'Stop Execution',
          color: 'warn',
          click: (result: DataDrivenRun) => {
            this.stop_data_driven(result, this);
          },
          iif: (result: any) => !!result.running,
        },
        {
          type: 'icon',
          text: 'delete',
          icon: 'delete',
          tooltip: 'Delete result',
          color: 'warn',
          click: (result: DataDrivenRun) => {
            this.onDeleteRun(result);
          },
        },
      ],
    },
  ];

  results: DataDrivenRun[] = [];
  total = 0;
  isLoading = true;
  isLoadingFiles = true;
  showPagination = true;
  latestFeatureResultId: number = 0;
  inputFocus = false;
  focusSubscription: Subscription;
  private actionsSubscription: Subscription;
  private pendingUpdates: { [runId: number]: DataDriven.StatusUpdate } = {};


  query = {
    page: 0,
    size: 10,
  };

  get params() {
    const p = { ...this.query };
    p.page += 1;
    return p;
  }

  openContent(run: DataDrivenRun) {
    if (run.running) {
      // For running tests, we need to get the feature_id associated with this run
      this._http.get(`/backend/api/data_driven/results/${run.run_id}/`)
        .subscribe({
          next: (response: any) => {
            if (response && response.results && response.results.length > 0) {
              const featureResult = response.results[0];
              const featureId = featureResult.feature_id;
              
              // Now open LiveStepsComponent with the feature_id
              this._dialog.open(LiveStepsComponent, {
                disableClose: false,
                panelClass: 'live-steps-panel',
                width: '95vw',
                maxWidth: '95vw',
                height: '95vh',
                maxHeight: '95vh',
                data: featureId
              });
            } else {
              this._snackBar.open('No feature results found for this run', 'OK', {
                duration: 5000,
                panelClass: ['file-management-custom-snackbar']
              });
            }
          },
          error: (err) => {
            this.log.msg('2', 'Error loading live steps for this run', 'API', err);
            this._snackBar.open('Error loading live steps for this run', 'OK', {
              duration: 5000,
              panelClass: ['file-management-custom-snackbar']
            });
          }
        });
    } else {
      // For completed tests, navigate to the details page
      this._router.navigate(['data-driven', run.run_id]);
    }
  }

  getResults() {
    this.isLoading = true;
    this.cdRef.markForCheck();

    // Prepare parameters, including department_id if it exists
    const requestParams = { ...this.params };
    if (this.department_id !== undefined && this.department_id !== null) {
      requestParams['department_id'] = this.department_id;
    }
    
    // Apply filter parameters based on filterType
    if (this.filterType === 'specific_file' && this.selected_file_id !== null) {
      requestParams['file_id'] = this.selected_file_id;
    } else if (this.filterType === 'active_only') {
      requestParams['active_files_only'] = 'true';
    }
    // For 'all_with_deleted', no additional parameters needed

    this._http
      .get(`/backend/api/data_driven/`, {
        params: requestParams,
      })
      .subscribe({
        next: (res: any) => {
          // Fix any inconsistent states in the API response
          if (res.results && Array.isArray(res.results)) {
            res.results = res.results.map(run => {
              // If running is true, ensure status is "Running"
              if (run.running && (!run.status || run.status !== 'Running')) {
                return { ...run, status: 'Running' };
              }
              
              // If status is empty, set a default fallback status
              if (!run.status) {
                return { ...run, status: run.running ? 'Running' : 'Failed' };
              }
              
              return run;
            });
          }
          
          this.results = res.results;
          this.total = res.count;
          this.showPagination = this.total > 0 ? true : false;

          // Process any pending WebSocket updates that arrived before this HTTP response
          let updatesApplied = false;
          
          // Create a new copy of results to work with
          let newResults = [...this.results];
          
          // Apply any pending updates
          Object.keys(this.pendingUpdates).forEach(runIdStr => {
            const runId = Number(runIdStr);
            const pendingAction = this.pendingUpdates[runId]; // Get pending action
            const runIndex = newResults.findIndex(run => run.run_id === runId);

            if (runIndex !== -1) {
              // Create a new object with the pending update applied
              const updatedRun = this.applyUpdate(newResults[runIndex], pendingAction);
              
              // Replace the run in our new array
              newResults = [
                ...newResults.slice(0, runIndex),
                updatedRun,
                ...newResults.slice(runIndex + 1)
              ];
              
              // Mark that an update was applied and remove from pending
              delete this.pendingUpdates[runId];
              updatesApplied = true;
            }
          });

          // Only update results if we made changes
          if (updatesApplied) {
            this.results = newResults;
          }
          
          // Always trigger change detection
          this.cdRef.detectChanges();
        },
        error: (err) => {
          this.log.msg('2', 'Error fetching data-driven runs', 'API', err);
          this.isLoading = false;
          this.cdRef.markForCheck();
        },
        complete: () => {
          this.isLoading = false;
          this.cdRef.markForCheck();
        }
      });
  }

  openNewDataDrivenRun() {
    this._dialog.open(DataDrivenExecution, {
      disableClose: true,
      autoFocus: false,
      panelClass: 'edit-feature-panel',
      data: {},
    });
  }

  updateData(e: PageEvent) {
    // Only keep results pagination, remove file data handling
    this.query.page = e.pageIndex;
    this.query.size = e.pageSize;
    this.getResults();

      // Store in localStorage for results grid
    localStorage.setItem('co_results_page_size', e.pageSize.toString());
  }
  
  updateFilePagination(e: PageEvent, row: any) {
    // This functionality is now handled by the files-management component
    this.log.msg('4', 'File pagination is now handled by files-management component', 'Pagination');
    // Store preference in localStorage
    localStorage.setItem('co_file_page_size', e.pageSize.toString());
  }

  /**
   * Toggle panel expansion state and store in localStorage
   * @param panel The panel identifier
   * @param state The new state
   */
  togglePanel(panel: string, state: boolean) {
    if (this.panelConfig[panel] !== state) {
      this.panelConfig[panel] = state;
      localStorage.setItem(`dd_panel_${panel}`, state ? 'true' : 'false');
      this.log.msg('4', `Saved panel state: ${panel} = ${state}`, 'LocalStorage');
    }
  }

  ngOnInit(): void {
    // Load saved page size
    const storedPageSize = localStorage.getItem('co_results_page_size');
    this.query.size = storedPageSize ? parseInt(storedPageSize, 10) : 10;

    // Load saved department ID first
    const savedDepartmentId = localStorage.getItem('co_selected_department_id');
    if (savedDepartmentId) {
        this.department_id = parseInt(savedDepartmentId, 10);
        this.log.msg('4', `Loaded department ID from localStorage: ${this.department_id}`, 'Init');
    } else {
        this.log.msg('4', 'No department ID found in localStorage.', 'Init');
    }

    // Load saved panel states
    const savedInformationPanel = localStorage.getItem('dd_panel_informationPanel');
    const savedExecutePanel = localStorage.getItem('dd_panel_executePanel');
    const savedResultsPanel = localStorage.getItem('dd_panel_resultsPanel');
    const savedFiltersPanel = localStorage.getItem('dd_panel_filtersPanel');
    
    if (savedInformationPanel !== null) {
      this.panelConfig.informationPanel = savedInformationPanel === 'true';
    }
    
    if (savedExecutePanel !== null) {
      this.panelConfig.executePanel = savedExecutePanel === 'true';
    }
    
    if (savedResultsPanel !== null) {
      this.panelConfig.resultsPanel = savedResultsPanel === 'true';
    }
    
    if (savedFiltersPanel !== null) {
      this.panelConfig.filtersPanel = savedFiltersPanel === 'true';
    }
    
    // Load saved filter preferences
    const savedFilterType = localStorage.getItem('co_filter_type');
    if (savedFilterType && ['all_with_deleted', 'active_only', 'specific_file'].includes(savedFilterType)) {
      this.filterType = savedFilterType as any;
      
      // Set active_files_only for backward compatibility
      this.active_files_only = (savedFilterType === 'active_only');
      
      // Initialize display value
      if (savedFilterType === 'specific_file') {
        const savedFileId = localStorage.getItem('co_selected_file_id');
        if (savedFileId) {
          const fileIdNum = parseInt(savedFileId, 10);
          this.selected_file_id = fileIdNum;
          this.displayFilterValue = ['specific_file', fileIdNum];
        } else {
          // If no file ID but filter type is specific_file, reset to default
          this.filterType = 'all_with_deleted';
          this.displayFilterValue = 'all_with_deleted';
        }
      } else {
        this.displayFilterValue = savedFilterType;
      }
    }
    
    // Ensure isLoadingFiles is true during initialization
    this.isLoadingFiles = true;
    this.cdRef.markForCheck();
    
    this.fillDropdownsOnInit(); // Initialize data-driven execution panel
    
    // Subscribe to departments to update loading state
    this.departments$.pipe(take(1)).subscribe({
      next: () => {
        setTimeout(() => {
          this.isLoadingFiles = false;
          this.cdRef.markForCheck();
        }, 300); // Small delay for better UX
      },
      error: () => {
        this.isLoadingFiles = false;
        this.cdRef.markForCheck();
      }
    });
  }

  // Stop data driven test
  stop_data_driven(result, parent) {
    let run_id = result.run_id;
    this._http.post<any>(`/backend/stop_data_driven/${run_id}/`, {}).subscribe({
      next(res: any) {
        if (res.success) {
          result.running = false;
          parent._dialog.open(DataDrivenTestStop, {
            data: {
              run_id: res.run_id,
              test_count: res.tasks,
            },
          });
        }
      },
      error(err) {
        if (err.status >= 400 && err.status < 500) {
          const error = JSON.parse(err.error);
          parent._snackBar.open(
            `Error: ${error.error}. Please try again.`,
            'OK',
            {
              duration: 30000,
            }
          );
        }
      },
    });
  }

  // Shortcut (T, S) Data Driven Test button
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {

    const columnsShow = document.querySelector(".mtx-grid-column-menu-body");

    const overviewDiv = document.querySelector(".mat-mdc-dialog-surface");

    if (!this.inputFocus){
      switch (event.keyCode) {
        case KEY_CODES.T:
          // Observe if the class of div its available
          if (overviewDiv == null) {
            if(columnsShow != null){
              this.buttonDataDrivenTest.nativeElement.querySelector('.mat-mdc-button-touch-target').click();
            }
            this.buttonDataDrivenTest.nativeElement.querySelector('.mdc-button__label').click();
          }
          break;
        case KEY_CODES.S:
          if(overviewDiv == null) {
            this.buttonDataDrivenTest.nativeElement.querySelector('.mat-mdc-button-touch-target').click();
          }
          break;
      }
    }
  }

  fillDropdownsOnInit(mode: string = 'new') {
    this.log.msg('4', `Mode: ${mode}`, 'Init');
    switch (mode) {
      case 'new':
        this.preSelectedOrDefaultOptions();
        break;
      default:
        break;
    }
  }

  preSelectedOrDefaultOptions() {
    // Check if department_id was loaded from localStorage
    if (this.department_id !== undefined && this.department_id !== null) {
        this.departments$.pipe(take(1)).subscribe(departments => {
            const foundDept = departments?.find(d => d.department_id === this.department_id);
            if (foundDept) {
                this.department = foundDept;
                this.log.msg('4', `Found department from localStorage ID: ${this.department_id}`, 'Init');
                // File-related code is now handled by files-management component
                this.getResults();
                this.isLoadingFiles = false;
                this.cdRef.detectChanges();
            } else {
                // Saved ID is invalid, clear it and proceed to default logic
                this.log.msg('3', `Department ID ${this.department_id} from localStorage not found in current departments. Resetting.`, 'Init');
                this.department_id = null; // Reset to trigger default logic below
                localStorage.removeItem('co_selected_department_id');
                this.preSelectedOrDefaultOptions(); // Re-run default logic
            }
        });
    } else {
        // No department_id from localStorage, apply default logic
        this.departments$.pipe(take(1)).subscribe(departments => { // Use take(1) to prevent memory leaks
            if (departments && departments.length > 0) {
                let defaultDept = departments.find(d => d.selected === true);
                if (!defaultDept) {
                    // Fallback to user setting or first department if no default found
                    const { preselectDepartment } = this.user?.settings || {};
                    defaultDept = departments.find(d => d.department_id == preselectDepartment) || departments[0];
                }

                if (defaultDept) {
                    this.department = defaultDept;
                    this.department_id = defaultDept.department_id;
                    // Save the determined default/preselected department ID
                    localStorage.setItem('co_selected_department_id', this.department_id.toString());
                    this.log.msg('4', `Set and saved default department ID: ${this.department_id}`, 'Init');
                    // File-related code is now handled by files-management component
                    this.getResults();
                    this.isLoadingFiles = false;
                    this.cdRef.detectChanges();
                } else {
                    this.isLoadingFiles = false; // No departments available
                    this.log.msg('3', 'No departments found to select a default.', 'Init');
                }
            } else {
                this.isLoadingFiles = false; // No departments available
                this.log.msg('3', 'Department list is empty or undefined.', 'Init');
            }
        });
    }
}

  changeDepartment() {
    this.isLoading = true;
    this.isLoadingFiles = true;
    this.cdRef.markForCheck();
    
    this.departments$.pipe(take(1)).subscribe({
      next: departments => {
      if (departments && departments.length > 0) {
        const selectedDept = departments.find(d => d.department_id === this.department_id);
        if (selectedDept) {
          this.department = selectedDept;
            
          // Save the newly selected department ID to local storage
          localStorage.setItem('co_selected_department_id', this.department_id.toString());
          this.log.msg('4', `Saved selected department ID: ${this.department_id}`, 'Department');

            // File data is now handled by files-management component
          
          // Preserve filter type, only reset specific file selection
          if (this.filterType === 'specific_file') {
            // When switching departments, revert to general filter view
            this.filterType = localStorage.getItem('co_filter_type_previous') || 'active_only';
            this.displayFilterValue = this.filterType;
            this.selected_file_id = null;
            localStorage.removeItem('co_selected_file_id');
          }
          
          // Save current filter type to localStorage
          localStorage.setItem('co_filter_type', this.filterType);
          
          setTimeout(() => {
            this.isLoading = false;
            this.isLoadingFiles = false;
            this.getResults();
            this.cdRef.detectChanges();
          }, 0);
        } else {
          this.isLoading = false;
          this.isLoadingFiles = false;
          this.cdRef.markForCheck();
        }
      } else {
        this.isLoading = false;
        this.isLoadingFiles = false;
        this.cdRef.markForCheck();
      }
      },
      error: () => {
        this.isLoading = false;
        this.isLoadingFiles = false;
        this.cdRef.markForCheck();
      }
    });
  }

  showDataChecks(row: UploadedFile) {
    if (row && row.status === 'Done') {
      return true;
    }
    return false;
  }

  dataDrivenExecutable(row: UploadedFile) {
    if (
      row &&
      row.extras &&
      row.extras.ddr &&
      row.extras.ddr['data-driven-ready']
    )
      return true;
    return false;
  }

  execute_data_driven(file: UploadedFile, parent) {
    this._http
      .post(
        '/backend/exec_data_driven/',
        {
          file_id: file.id,
        },
        {
          params: new InterceptorParams({
            skipInterceptor: true,
          }),
        }
      )
      .subscribe({
        next: (res: any) => {
          try {
          res = JSON.parse(res);
          } catch (e) {
             parent._snackBar.open('Error starting execution: Invalid response from server.', 'OK', { 
               duration: 10000,
               panelClass: ['file-management-custom-snackbar'] 
             });
             return; 
          }

          if (res.success) {
            const runId = res.run_id;
            const runIndex = parent.results.findIndex(run => run.run_id === runId);
            
            if (runIndex !== -1) {
              // Update existing run
              parent.results = [
                ...parent.results.slice(0, runIndex),
                { ...parent.results[runIndex], running: true, status: 'Running' },
                ...parent.results.slice(runIndex + 1)
              ];
            }
            
            parent.cdRef.markForCheck();
            
            parent._dialog.open(DataDrivenTestExecuted, {
              data: {
                run_id: res.run_id,
                file_name: file.name,
              },
            });
            parent.getResults();
          } else {
            // Handle failure from backend (e.g., feature validation failed)
            const errorMessage = res.error || 'Unknown error occurred during execution start.';
            parent._snackBar.open(`Error: ${errorMessage}`, 'OK', { 
              duration: 15000,
              panelClass: ['file-management-custom-snackbar'] 
            });
          }
        },
        error(err) {
          // Handle HTTP errors (e.g., 500 internal server error)
          let errorDetail = 'An unexpected server error occurred.';
          if (err.status >= 400 && err.status < 500 && err.error) {
            // Try to parse client-side errors
            try {
              const error = typeof err.error === 'string' ? JSON.parse(err.error) : err.error;
              errorDetail = error.error || JSON.stringify(error); 
            } catch(e) {
               errorDetail = err.error; // Use raw error if parsing fails
            }
          } else if (err.message) {
              errorDetail = err.message;
          }
            parent._snackBar.open(
            `Execution failed: ${errorDetail}`,
              'OK',
              {
              duration: 15000,
              panelClass: ['file-management-custom-snackbar']
              }
            );
        },
      });
  }

  setResultStatus(row, status) {
    this._http
      .post(`/backend/api/data_driven/status/${row.run_id}/`, {
        status: status,
      })
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            row.status = status || res.status;
            this.cdRef.detectChanges();
          }
        },
        error: (err) => {
          this.log.msg('2', 'Error setting result status', 'API', err);
        },
      });
  }

  // Add method to handle the action payload
  private updateRunStatusFromAction(action: DataDriven.StatusUpdate) {
    if (!this.results) {
      // If results array doesn't even exist yet, definitely queue the update
      this.pendingUpdates[action.run_id] = action;
      return;
    }

    const runIndex = this.results.findIndex(run => run.run_id === action.run_id);
    if (runIndex !== -1) {
      // Run found - Apply update by replacing the object and creating a new array reference
      const updatedRun = this.applyUpdate(this.results[runIndex], action); // Get the new object
      
      // Create a new array with the updated item replaced
      this.results = [
        ...this.results.slice(0, runIndex),
        updatedRun,
        ...this.results.slice(runIndex + 1)
      ];
      
      // Force change detection for OnPush strategy
      this.cdRef.markForCheck();
    } else {
      // Run not found - Queue the update
      this.pendingUpdates[action.run_id] = action;
    }
  }

  // Helper method to apply the update logic and return a new object
  private applyUpdate(run: DataDrivenRun, action: DataDriven.StatusUpdate): DataDrivenRun {
    // Always use the action's status if provided, otherwise use running state to determine status
    const newStatus = action.status || (action.running ? 'Running' : run.status);
    const newRunning = action.running;

    // Return a new object clone with updated properties
    return {
      ...run, // Clone existing properties
      running: newRunning,
      status: newStatus,
      // Update metrics if provided in the action
      ...(action.total !== undefined ? { total: action.total } : {}),
      ...(action.ok !== undefined ? { ok: action.ok } : {}),
      ...(action.fails !== undefined ? { fails: action.fails } : {}),
      ...(action.skipped !== undefined ? { skipped: action.skipped } : {}),
      ...(action.execution_time !== undefined ? { execution_time: action.execution_time } : {}),
      ...(action.pixel_diff !== undefined ? { pixel_diff: action.pixel_diff } : {})
    };
  }

  // Add a new method to handle deletion with confirmation
  onDeleteRun(run: DataDrivenRun) {
    const dialogRef = this._dialog.open(SureRemoveRunComponent, {
      disableClose: true
    });

    dialogRef
      .afterClosed()
      .pipe(filter(result => result === true)) // Only proceed if confirmed
      .subscribe(() => {
        this._api.deleteDataDrivenTest(run.run_id).subscribe({
          next: _ => {
            // Remove the deleted run from the results array
            this.results = this.results.filter(r => r.run_id !== run.run_id);
            this.total--;
            // Show confirmation snackbar
            this._snackBar.open("Data-driven test result deleted successfully", "OK", {
              duration: 5000,
              panelClass: ['file-management-custom-snackbar']
            });
            this.cdRef.markForCheck(); // Ensure UI updates
          },
          error: err => {
            // Handle error
            this._snackBar.open("Error deleting data-driven test result", "OK", {
              duration: 5000,
              panelClass: ['file-management-custom-snackbar']
            });
          }
        });
      });
  }

  // Update setFilterType to check if department and files exist before triggering updates
  setFilterType(type: 'all_with_deleted' | 'active_only' | 'specific_file', fileId: number | null = null) {
    // Only proceed if there's a change in filter settings
    const isNewType = this.filterType !== type;
    const isNewFileId = type === 'specific_file' && this.selected_file_id !== fileId;
    
    if (!isNewType && !isNewFileId) {
      this.log.msg('4', `No change in filter settings. Type: ${type}, FileId: ${fileId}`, 'Filter');
      return;
    }
    
    // Save the previous filter type before changing to a new type
    // This will be used when switching from specific_file back to a general filter
    if (isNewType && this.filterType !== 'specific_file') {
      localStorage.setItem('co_filter_type_previous', this.filterType);
      this.log.msg('4', `Saved previous filter type: ${this.filterType}`, 'Filter');
    }
    
    this.filterType = type;
    
    this.query.page = 0;
    
    if (type === 'specific_file') {
      this.selected_file_id = fileId;
      // Set the display value for the dropdown
      this.displayFilterValue = ['specific_file', fileId];
    } else {
      this.selected_file_id = null;
      // Set string display value
      this.displayFilterValue = type;
    }
    
    this.active_files_only = (type === 'active_only');
    
    if (this.department_id) {
      this.getResults();
    }
    
    // Save filter preferences to localStorage
    localStorage.setItem('co_filter_type', this.filterType);
    if (this.selected_file_id !== null) {
      localStorage.setItem('co_selected_file_id', this.selected_file_id.toString());
      this.log.msg('4', `Saved specific file ID: ${this.selected_file_id}`, 'Filter');
    } else {
      localStorage.removeItem('co_selected_file_id');
      this.log.msg('4', 'Removed specific file ID from storage', 'Filter');
    }
    
    if (!this.isLoading) {
      this.cdRef.detectChanges();
    }
  }

  // Update onFileSelectionChange to use setFilterType
  onFileSelectionChange() {
    if (this.selected_file_id !== null) {
      this.setFilterType('specific_file', this.selected_file_id);
    }
  }

  // Add a new method to handle filter selection changes
  onFilterSelectionChange(event: MatSelectChange): void {
    const value = event.value;
    
    if (Array.isArray(value) && value[0] === 'specific_file') {
      // Extract file ID from the array value
      const fileId = value[1];
      this.setFilterType('specific_file', fileId);
      this.displayFilterValue = value;
    } else {
      // Direct value like 'all_with_deleted' or 'active_only'
      this.setFilterType(value);
      this.displayFilterValue = value;
    }
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    if (this.focusSubscription) {
      this.focusSubscription.unsubscribe();
    }
    if (this.actionsSubscription) {
      this.actionsSubscription.unsubscribe();
    }
  }

  // Event handler methods for the file management events
  onFilesUploaded(files: UploadedFile[]): void {
    // Reload results to get updated files
    this.getResults();
  }

  onFileDeleted(file: UploadedFile): void {
    this.log.msg('4', `Processing file deletion for ${file.name} (ID: ${file.id})`, 'Delete');
    
    // Call FileUploadService to delete the file (which uses ApiService internally)
    this.fileUpload.deleteFile(file.id).subscribe({
      next: (response) => {
        if (response && response.success) {
          this.log.msg('4', `File deleted successfully: ${file.name}`, 'Delete');
          
          // Update the department's file list
          if (this.department && this.department.files) {
            const fileIndex = this.department.files.findIndex(f => f.id === file.id);
            if (fileIndex > -1) {
              // Mark as removed
              this.department.files[fileIndex].is_removed = true;
              this.cdRef.markForCheck();
              
              // Show success message
              this._snackBar.open(`File "${file.name}" deleted successfully`, 'OK', { 
                duration: 5000,
                panelClass: ['file-management-custom-snackbar']
              });
              
              // Reload results
              this.getResults();
            }
          }
        } else {
          this._snackBar.open('Error deleting file', 'OK', { 
            duration: 5000,
            panelClass: ['file-management-custom-snackbar']
            });
          }
        },
      error: (error) => {
        this.log.msg('2', `Error deleting file: ${file.name}`, 'Delete', error);
        this._snackBar.open('Error deleting file', 'OK', { 
          duration: 5000,
          panelClass: ['file-management-custom-snackbar']
        });
        }
      });
  }

  onFileDownloaded(file: UploadedFile): void {
    this.log.msg('4', `Processing file download for ${file.name} (ID: ${file.id})`, 'Download');
    
    // Check if file is ready
    if (file.status.toLowerCase() !== 'done') {
      this._snackBar.open('File is not ready for download', 'Close', {
        duration: 3000,
        panelClass: ['file-management-custom-snackbar']
      });
      return;
    }

    const downloading = this._snackBar.open(
      'Generating file to download, please be patient.',
      'OK',
      { duration: 10000,
        panelClass: ['file-management-custom-snackbar']
      }
    );

    // Use fileUpload service to download the file
    this.fileUpload.downloadFile(file.id).subscribe({
      next: (res: any) => {
          downloading.dismiss();
        
        // Check if we have a response body
        if (!res.body) {
          this._snackBar.open('Download failed: Empty response', 'OK', {
            duration: 5000,
            panelClass: ['file-management-custom-snackbar']
             });
          return;
        }
        
        try {
          // Create a blob from the base64 response
        const blob = new Blob([this.base64ToArrayBuffer(res.body)], {
            type: file.mime || 'application/octet-stream'
        });
          
          // Use the fileUpload service to handle the download
        this.fileUpload.downloadFileBlob(blob, file);
        } catch (error) {
          this.log.msg('2', `Error processing download response for ${file.name}`, 'Download', error);
          this._snackBar.open('Error processing download', 'Close', {
            duration: 5000,
            panelClass: ['file-management-custom-snackbar']
          });
        }
      },
      error: (error) => {
        downloading.dismiss();
        this.log.msg('2', `Download error for ${file.name}`, 'Download', error);
        this._snackBar.open('Error downloading file', 'Close', {
          duration: 5000,
          panelClass: ['file-management-custom-snackbar']
        });
      }
    });
  }

  onFileExecute(file: UploadedFile): void {
    // Execute the file
    this.execute_data_driven(file, this);
  }

  // Handler method for files-management panel toggle events
  onFilePanelToggled(isExpanded: boolean): void {
    this.panelConfig.executePanel = isExpanded;
    localStorage.setItem('dd_panel_executePanel', isExpanded ? 'true' : 'false');
  }

  // Handler method for files-management pagination events
  onFilePaginationChanged(event: {event: PageEvent, file?: UploadedFile}): void {
    this.log.msg('4', 'File pagination is now handled by files-management component', 'Pagination');
  }

  onDownloadFile(file: UploadedFile): void {
    // Delegate to the event handler method
    this.onFileDownloaded(file);
  }

  onDeleteFile(file: UploadedFile): void {
    this.onFileDeleted(file);
  }

  base64ToArrayBuffer(data: string): ArrayBuffer {
    const binaryString = window.atob(data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
