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
  
  // Store expanded state for all file rows
  expandedFileIds: Set<number> = new Set<number>();
  
  // Properties from DataDrivenExecution component
  @ViewSelectSnapshot(UserState.RetrieveUserDepartments)
  userDepartments$: Observable<Department[]>;
  @Select(DepartmentsState) departments$: Observable<Department[]>;
  @Select(FeaturesState.GetFeaturesWithinFolder) features$: Observable<
    ReturnType<typeof FeaturesState.GetFeaturesWithinFolder>
  >;
  @ViewSelectSnapshot(ConfigState) config$!: Config;
  @ViewSelectSnapshot(UserState) user!: UserInfo;

  department_id: number;
  department: Department;
  file_data: Record<string, any> = {};
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
  
  // Add properties for inline editing
  editingCell: { fileId: number, rowIndex: number, columnField: string } | null = null;
  editValue: any = null;
  originalCellValue: any = null; // To store cell value on edit start
  @ViewChild('editInput') editInput: ElementRef;
  @ViewChild('dynamicEditableCellTpl') dynamicEditableCellTpl: TemplateRef<any>;

  // Properties for Save/Cancel All
  original_file_data: Record<number, any[]> = {}; // Store original data per file
  isDirty: Record<number, boolean> = {}; // Track dirty state per file

  // File columns definition
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
            this.showDataChecks(row) && this.dataDrivenExecutable(row),
        },
        {
          type: 'icon',
          text: 'cloud_download',
          icon: 'cloud_download',
          tooltip: 'Download file',
          click: (result: UploadedFile) => {
            this.onDownloadFile(result);
          },
          iif: row => row.status === 'Done' && !row.is_removed,
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
          this.cdRef.detectChanges();
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
                panelClass: ['data-driven-custom-snackbar']
              });
            }
          },
          error: (err) => {
            this.log.msg('2', 'Error loading live steps for this run', 'API', err);
            this._snackBar.open('Error loading live steps for this run', 'OK', {
              duration: 5000,
              panelClass: ['data-driven-custom-snackbar']
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

  updateData(e: PageEvent, row?: any) {
    if (row) {
      // Update file data grid pagination
      row = this.file_data[row.id];
      row.params.page = e.pageIndex;
      row.params.size = e.pageSize;
      this.getFileData(row);
      
      // Store in localStorage for file grid
      localStorage.setItem('co_file_page_size', e.pageSize.toString());
    } else {
      // Update results grid pagination
    this.query.page = e.pageIndex;
    this.query.size = e.pageSize;
    this.getResults();

      // Store in localStorage for results grid
    localStorage.setItem('co_results_page_size', e.pageSize.toString());
    }
  }

  updateResultsPagination(e: PageEvent) {
    this.query.page = e.pageIndex;
    this.query.size = e.pageSize;
    this.getResults();

    localStorage.setItem('co_results_page_size', e.pageSize.toString());
  }
  
  updateFilePagination(e: PageEvent, row: any) {
    this.log.msg('4', 'UpdateFilePagination Event:', 'Pagination', {e, row});
    
    // First check if row is passed directly
    if (row && row.id && this.file_data[row.id]) {
      // Row is directly passed and valid
      const fileData = this.file_data[row.id];
      fileData.params.page = e.pageIndex;
      fileData.params.size = e.pageSize;
      this.getFileData(fileData);
      
      // Store in localStorage for file grid
      localStorage.setItem('co_file_page_size', e.pageSize.toString());
      return;
    }
    
    // If row is not directly passed, try to get it from the event
    if (e && e['rowData'] && e['rowData'].id) {
      const rowId = e['rowData'].id;
      if (this.file_data[rowId]) {
        const fileData = this.file_data[rowId];
        fileData.params.page = e.pageIndex;
        fileData.params.size = e.pageSize;
        this.getFileData(fileData);
        
        // Store in localStorage for file grid
        localStorage.setItem('co_file_page_size', e.pageSize.toString());
        return;
      }
    }
    
    // If we get here, we couldn't find a valid row
    this.log.msg('2', 'Invalid row parameter in updateFilePagination', 'Pagination', {row, e});
    
    // As a fallback, at least save the page size preference
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
    
    // Load saved expanded file IDs
    const savedExpandedFileIds = localStorage.getItem('dd_expanded_file_ids');
    if (savedExpandedFileIds) {
      try {
        const fileIds = JSON.parse(savedExpandedFileIds);
        if (Array.isArray(fileIds)) {
          this.expandedFileIds = new Set(fileIds);
        }
      } catch (e) {
        this.log.msg('2', 'Error parsing saved expanded file IDs', 'LocalStorage', e);
      }
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
                this.generateFileData();
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
                    this.generateFileData();
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

          this.generateFileData();
          
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

  onUploadFile(ev) {
    let formData: FormData = new FormData();
    let files = ev.target.files;

    if (!this.department || !this.department.department_id) {
      this._snackBar.open(
        'Please select a department before uploading files',
        'OK',
        { 
          duration: 15000,
          panelClass: ['data-driven-custom-snackbar'] 
        }
      );
      return;
    }

    for (let file of files) {
      formData.append('files', file);
    }

    let detpid = this.department.department_id.toString();
    formData.append('department_id', detpid);
    this.fileUpload.startUpload(files, formData, this.department as any, this.user);
  }

  onDeleteFile(file: UploadedFile) {
    const dialogRef = this._dialog.open(SureRemoveFileComponent, {
      disableClose: true,
      data: { fileName: file.name },
    });

    dialogRef
      .afterClosed()
      .pipe(filter(result => result === true)) // Only proceed if confirmed
      .subscribe(() => {
    this.fileUpload.deleteFile(file.id).subscribe(res => {
          if (res.success) {
            this.fileUpload.updateFileState(file, this.department as any);
            this._snackBar.open(`File "${file.name}" deleted successfully.`, 'OK', { 
              duration: 15000,
              panelClass: ['data-driven-custom-snackbar'] 
            });
            this.cdRef.markForCheck(); // Ensure UI updates
          }
        });
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

  generateFileData() {
    this.file_data = {};
    
    if (this.department && this.department.files) {
      this.department.files.forEach((file: UploadedFile) => {
        if (!file.is_removed) {
          this.file_data[file.id] = {
            id: file.id,
            file_data: [],
            columns: [],
            params: {
              page: 0,
              size: 10,
            },
            total: 0,
            isLoading: false,
            showPagination: false,
            fetched: false,
            // Store if file should be expanded based on saved state
            expanded: this.expandedFileIds.has(file.id)
          };
          
          // If this file is marked for auto-expansion, pre-fetch its data
          if (this.expandedFileIds.has(file.id)) {
            this.log.msg('4', `Auto-expanding file ID: ${file.id}`, 'FileData');
            // Use setTimeout to ensure UI is rendered before fetching data
            setTimeout(() => {
              this.getFileData(this.file_data[file.id]);
            }, 100);
          }
        }
      });
    }
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
               panelClass: ['data-driven-custom-snackbar'] 
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
              panelClass: ['data-driven-custom-snackbar'] 
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
              panelClass: ['data-driven-custom-snackbar']
              }
            );
        },
      });
  }

  expand(event) {
    const rowId = event.data && event.data.id;
    if (!rowId) {
      this.log.msg('3', 'Missing data or ID in row', 'Expand', event);
      return;
    }

    if (event.expanded) {
      this.log.msg('4', `Expanding row with ID: ${rowId}`, 'Expand', event.data);
      
      // Track this file as expanded
      this.expandedFileIds.add(rowId);
      this.log.msg('4', 'Expanded files:', 'Expand', Array.from(this.expandedFileIds));
      
      // Save expanded file IDs to localStorage
      this.saveExpandedFileIds();
        
      // Initialize the file_data entry if it doesn't exist
      if (!this.file_data[rowId]) {
        this.log.msg('4', `Initializing file_data for ID: ${rowId}`, 'Expand');
        this.file_data[rowId] = {
          id: rowId,
          file_data: [],
          columns: [],
          params: {
            page: 0,
            size: 10,
          },
          total: 0,
          isLoading: false,
          showPagination: false,
          fetched: false
        };
      } else {
        this.log.msg('4', `File data already exists for ID: ${rowId}`, 'Expand', this.file_data[rowId]);
      }
      
      const row = this.file_data[rowId];
      if (!row.fetched) {
        // fetch data
        this.log.msg('4', `Fetching data for ID: ${rowId}`, 'Expand');
        this.getFileData(row);
      } else {
        this.log.msg('4', `Data already fetched for ID: ${rowId}`, 'Expand', row);
      }
    } else {
      // Log collapsing event
      this.log.msg('4', `Collapsing row with ID: ${rowId}`, 'Expand');
      // Remove from expanded files tracking
      this.expandedFileIds.delete(rowId);
      this.log.msg('4', 'Expanded files after collapse:', 'Expand', Array.from(this.expandedFileIds));
      
      // Save expanded file IDs to localStorage
      this.saveExpandedFileIds();
    }
  }
  
  /**
   * Save expanded file IDs to localStorage
   */
  private saveExpandedFileIds(): void {
    localStorage.setItem('dd_expanded_file_ids', JSON.stringify(Array.from(this.expandedFileIds)));
  }

  getFileData(row) {
    this.log.msg('4', `Starting data fetch for file ID: ${row.id}`, 'FileData');
    row.isLoading = true;
    this._http
      .get(`/backend/api/data_driven/file/${row.id}`, {
        params: new InterceptorParams(
          {
            skipInterceptor: true,
          },
          {
            size: row.params.size,
            page: row.params.page + 1,
          }
        ),
      })
      .pipe(
        finalize(() => {
          row.isLoading = false;
          row.fetched = true;
          this.log.msg('4', `Fetch completed for file ID: ${row.id}`, 'FileData');
          this.cdRef.detectChanges();
        })
      )
      .subscribe({
        next: (res: any) => {
          try {
            res = typeof res === 'string' ? JSON.parse(res) : res;
          } catch (e) {
            this.log.msg('2', `Error parsing response for file ID: ${row.id}`, 'FileData', e);
            row.file_data = [];
            row.total = 0;
            row.showPagination = false;
            return;
          }
          
          const fetchedData = res.results ? res.results.map(d => d.data) : [];
          this.log.msg('4', `Fetched ${fetchedData.length} rows for file ID: ${row.id}`, 'FileData', { sample: fetchedData.length > 0 ? fetchedData[0] : 'No data'});
                     
          row.file_data = _.cloneDeep(fetchedData); // Use deep clone for working copy
          this.original_file_data[row.id] = _.cloneDeep(fetchedData); // Store deep clone of original
          this.isDirty[row.id] = false; // Reset dirty state on fetch
          row.total = res.count || 0;
          row.showPagination = row.total > 0 ? true : false;

          // Create a common data context for all columns in this file
          const fileContext = {
            fileId: row.id,
            fileRowId: row.id, // Add a separate property to make debugging easier
            fileName: res.file_name || `File #${row.id}`
          };

          // Use the ordered columns from the API response if available
          if (res.columns_ordered && Array.isArray(res.columns_ordered)) {
            this.log.msg('4', `Using ordered columns from API for file ID: ${row.id}`, 'FileData', res.columns_ordered);
            row.columns = res.columns_ordered.map(key => ({
              header: key,
              field: key,
              cellTemplate: this.dynamicEditableCellTpl,
              // Add custom data with dedicated file context
              customData: fileContext
            }));
          } else if (row.file_data.length > 0) {
            // Fallback to potentially unordered keys from the first row (existing behavior)
            const d = row.file_data[0];
            const keys = Object.keys(d);
            this.log.msg('4', `Using keys from first row for file ID: ${row.id}`, 'FileData', keys);
            row.columns = keys.map(key => ({ 
                header: key,
                field: key,
                cellTemplate: this.dynamicEditableCellTpl,
                // Add custom data with dedicated file context
                customData: fileContext
            }));
          } else {
             this.log.msg('3', `No data/columns for file ID: ${row.id}`, 'FileData');
             row.columns = [];
          }
          // Ensure change detection runs after columns are set
          this.cdRef.detectChanges(); 
        },
        error: (err) => {
          this.log.msg('2', `Error fetching data for file ID: ${row.id}`, 'FileData', err);
          
          if (err.status >= 400 && err.status < 500 && err.error) {
            try {
              const error = typeof err.error === 'string' ? JSON.parse(err.error) : err.error;
              row.file_data = [{ status: err.status, error: error }];
              row.total = 1;
              row.columns = [
                { header: 'Status Code', field: 'status' },
                { header: 'Error', field: 'error.error' },
              ];
              row.showPagination = false;
            } catch(e) {
              row.file_data = [];
              row.total = 0;
              row.columns = [];
              row.showPagination = false;
            }
          } else {
            row.file_data = [];
            row.total = 0;
            row.columns = [];
            row.showPagination = false;
          }
          // Reset states in case of error
          delete this.original_file_data[row.id];
          delete this.isDirty[row.id];
          this.cdRef.detectChanges(); 
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
              panelClass: ['data-driven-custom-snackbar']
            });
            this.cdRef.markForCheck(); // Ensure UI updates
          },
          error: err => {
            // Handle error
            this._snackBar.open("Error deleting data-driven test result", "OK", {
              duration: 5000,
              panelClass: ['data-driven-custom-snackbar']
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
    // Save any final state before component is destroyed
    this.saveExpandedFileIds();
    
    // Unsubscribe from all subscriptions
    if (this.focusSubscription) {
      this.focusSubscription.unsubscribe();
    }
    if (this.actionsSubscription) {
      this.actionsSubscription.unsubscribe();
    }
  }

  // --- Inline Editing Methods ---

  /**
   * Check if the current cell is being edited.
   * @param fileId The ID of the file (from the outer grid row).
   * @param rowIndex The index of the data row within the inner grid's current page.
   * @param columnField The field name of the column.
   * @returns True if the cell is being edited, false otherwise.
   */
  isEditing(fileId: number, rowIndex: number, columnField: string): boolean {
    // We'll still log detailed debug info but only when truly needed
    const isLoggingNeeded = this.editingCell && (
      fileId === this.editingCell.fileId || 
      rowIndex === this.editingCell.rowIndex
    );
    
    // Look at the customData from the column definition to get the correct file ID
    const isEditing = (
      this.editingCell?.fileId === fileId &&
      this.editingCell?.rowIndex === rowIndex &&
      this.editingCell?.columnField === columnField
    );
    
    if (isLoggingNeeded) {
      this.log.msg('4', `Edit Check - File:${fileId}, Row:${rowIndex}, Col:${columnField}, Editing:${isEditing}`, 'Edit', { currentEditingCell: this.editingCell });
    }
    
    return isEditing;
  }

  /**
   * Starts editing a specific cell.
   * @param fileId The ID of the file (from the outer grid row).
   * @param rowIndex The index of the data row within the inner grid's current page.
   * @param columnField The field name of the column.
   * @param currentValue The current value of the cell.
   */
  startEdit(fileId: number, rowIndex: number, columnField: string, currentValue: any): void {
    this.log.msg('4', `Start Edit - File:${fileId}, Row:${rowIndex}, Col:${columnField}`, 'Edit', { value: currentValue, fileExists: !!this.file_data[fileId], rowExists: !!this.file_data[fileId]?.file_data?.[rowIndex] });

    // Validate that we're working with a file that has data
    if (!this.file_data[fileId] || !this.file_data[fileId].file_data || !this.file_data[fileId].file_data[rowIndex]) {
      this.log.msg('2', `Start Edit ERROR - Invalid file/row data for fileId:${fileId}, rowIndex:${rowIndex}`, 'Edit');
      
      // Try to find an alternative file ID that has data
      const filesWithData = Object.keys(this.file_data)
        .filter(id => this.file_data[Number(id)]?.file_data?.length > 0)
        .map(Number);
        
      this.log.msg('4', 'Start Edit - Available files with data:', 'Edit', filesWithData);
      
      if (filesWithData.length > 0 && filesWithData[0] !== fileId) {
        const correctFileId = filesWithData[0];
        this.log.msg('3', `Start Edit - File ID mismatch! Using correct file ID:${correctFileId} instead of ${fileId}`, 'Edit');
        fileId = correctFileId;
      } else {
        this.log.msg('2', 'Start Edit - Cannot find valid file data. Aborting edit.', 'Edit');
        return;
      }
    }
    
    if (this.editingCell) {
      // If already editing, save the previous cell first
      this.log.msg('4', 'Start Edit - Already editing another cell. Saving first:', 'Edit', this.editingCell);
      this.saveEdit(this.editingCell.fileId, this.editingCell.rowIndex, this.editingCell.columnField);
    }

    this.editingCell = { fileId, rowIndex, columnField };
    this.editValue = currentValue;
    this.originalCellValue = currentValue; // Store original value
    this.log.msg('4', 'Start Edit - New editing cell:', 'Edit', { editingCell: this.editingCell, originalValue: this.originalCellValue });
    this.cdRef.detectChanges();

    setTimeout(() => {
      this.editInput?.nativeElement.focus();
    }, 0);
  }

  /**
   * Saves the edited value and exits edit mode.
   * @param fileId The ID of the file (from the outer grid row).
   * @param rowIndex The index of the data row within the inner grid's current page.
   * @param columnField The field name of the column.
   */
  saveEdit(fileId: number, rowIndex: number, columnField: string): void {
    if (!this.isEditing(fileId, rowIndex, columnField)) {
      this.log.msg('4', `Save Edit - Not currently editing cell. File:${fileId}, Row:${rowIndex}, Col:${columnField}`, 'Edit');
      return;
    }

    this.log.msg('4', `Save Edit - Saving edit for File:${fileId}, Row:${rowIndex}, Col:${columnField}`, 'Edit', { currentValue: this.editValue, originalValue: this.originalCellValue });

    // Validate file data exists and file ID is correct
    if (!this.file_data[fileId] || !this.file_data[fileId].file_data) {
      this.log.msg('2', `Save Edit ERROR - Invalid file data for fileId:${fileId}`, 'Edit');
      
      // Try to find an alternative file ID that has data
      const filesWithData = Object.keys(this.file_data)
        .filter(id => this.file_data[Number(id)]?.file_data?.length > 0)
        .map(Number);
        
      this.log.msg('4', 'Save Edit - Available files with data:', 'Edit', filesWithData);
      
      if (filesWithData.length > 0 && filesWithData[0] !== fileId) {
        const correctFileId = filesWithData[0];
        this.log.msg('3', `Save Edit - File ID mismatch! Using correct file ID:${correctFileId} instead of ${fileId}`, 'Edit');
        fileId = correctFileId;
      } else {
        this.log.msg('2', 'Save Edit - Cannot find valid file data. Aborting save.', 'Edit');
        this.editingCell = null;
        this.editValue = null;
        this.originalCellValue = null;
        this.cdRef.detectChanges();
        return;
      }
    }
    
    // Also validate row exists
    if (!this.file_data[fileId].file_data[rowIndex]) {
      this.log.msg('2', `Save Edit ERROR - Row ${rowIndex} does not exist in file_data for fileId ${fileId}`, 'Edit');
      this.log.msg('4', 'Save Edit - Available rows:', 'Edit', this.file_data[fileId].file_data.length);
      
      if (this.file_data[fileId].file_data.length > 0 && rowIndex >= this.file_data[fileId].file_data.length) {
        rowIndex = 0; // Fallback to first row if row index is invalid
        this.log.msg('3', 'Save Edit - Invalid row index! Using first row instead.', 'Edit');
      } else {
        this.log.msg('2', 'Save Edit - Cannot find valid row. Aborting save.', 'Edit');
        this.editingCell = null;
        this.editValue = null;
        this.originalCellValue = null;
        this.cdRef.detectChanges();
        return;
      }
    }

    // Now save the edit
    const fileDataRecord = this.file_data[fileId];
    if (fileDataRecord && fileDataRecord.file_data && fileDataRecord.file_data[rowIndex]) {
      if (this.editValue !== this.originalCellValue) {
        const oldValue = fileDataRecord.file_data[rowIndex][columnField];
        fileDataRecord.file_data[rowIndex][columnField] = this.editValue;
        this.isDirty[fileId] = true; // Mark as dirty
        this.log.msg('4', `Save Edit - Marked dirty: File:${fileId}, Row:${rowIndex}, Col:${columnField}`, 'Edit', { from: oldValue, to: this.editValue });
      } else {
        this.log.msg('4', `Save Edit - No change, value unchanged: ${this.editValue}`, 'Edit');
      }
    } else {
      this.log.msg('2', 'Save Edit ERROR - File record undefined or invalid after validation checks!', 'Edit');
    }

    this.editingCell = null;
    this.editValue = null;
    this.originalCellValue = null;
    this.cdRef.detectChanges();
  }

  /**
   * Cancels the current edit without saving.
   */
  cancelEdit(): void {
    if (this.editingCell) {
      // Optionally, revert the single cell being cancelled, 
      // but cancelAllChanges will handle full revert anyway.
      // Let's keep it simple and just exit edit mode.
       this.log.msg('4', 'Cancel single cell edit', 'Edit');
    }
    this.editingCell = null;
    this.editValue = null;
    this.originalCellValue = null;
    this.cdRef.detectChanges();
  }


  /**
   * Saves all changes for a specific file to the backend.
   * @param fileId The ID of the file to save.
   */
  saveAllChanges(fileId: number): void {
    if (!this.isDirty[fileId]) {
      this.log.msg('4', `No changes to save for fileId: ${fileId}`, 'Edit');
      return;
    }

    const fileRecord = this.file_data[fileId];
    const dataToSave = fileRecord?.file_data;

    if (!fileRecord || !dataToSave) {
      this.log.msg('2', `Could not find data or record to save for fileId: ${fileId}`, 'Edit');
      return;
    }

    this.log.msg('4', `Saving changes for fileId: ${fileId}`, 'Edit', dataToSave);
    
    // Show loading indicator
    fileRecord.isLoading = true;
    this.cdRef.detectChanges();
    
    // Use the API service method instead of direct HTTP call
    this._api.updateDataDrivenFile(fileId, dataToSave)
      .subscribe({
        next: (response: any) => {
          this.log.msg('4', `Save successful for fileId: ${fileId}`, 'API', response);
          
          try {
            // Parse the response if it's a string
            const result = typeof response === 'string' ? JSON.parse(response) : response;
            
            if (result.success) {
              // Update the original data to reflect saved state
              this.original_file_data[fileId] = _.cloneDeep(dataToSave);
              this.isDirty[fileId] = false; // Reset dirty flag
              this._snackBar.open('Changes saved successfully!', 'OK', { 
                duration: 3000,
                panelClass: ['data-driven-custom-snackbar']
              });
            } else {
              // Handle error in success response
              const errorMessage = result.error || 'Unknown error occurred during save.';
              this._snackBar.open(`Error: ${errorMessage}`, 'OK', { 
                duration: 5000,
                panelClass: ['data-driven-custom-snackbar']
              });
            }
          } catch (e) {
            // Handle parsing error
            this.log.msg('2', 'Error parsing save response', 'API', e);
            this._snackBar.open('Error saving changes: Invalid response from server.', 'OK', { 
              duration: 5000,
              panelClass: ['data-driven-custom-snackbar']
            });
          }
        },
        error: (err) => {
          this.log.msg('2', `Save error for fileId: ${fileId}`, 'API', err);
          
          // Format detailed error message
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
          
          this._snackBar.open(`Failed to save changes: ${errorDetail}`, 'OK', {
            duration: 5000,
            panelClass: ['data-driven-custom-snackbar']
          });
        },
        complete: () => {
          fileRecord.isLoading = false;
          this.cdRef.detectChanges();
        }
      });
  }

  /**
   * Cancels all changes made to a specific file's data since last save/load.
   * @param fileId The ID of the file to revert.
   */
  cancelAllChanges(fileId: number): void {
    this.log.msg('4', `Cancelling changes for fileId: ${fileId}`, 'Edit');
    if (this.original_file_data[fileId]) {
      // Revert working copy to original using deep clone
      this.file_data[fileId].file_data = _.cloneDeep(this.original_file_data[fileId]);
      this.isDirty[fileId] = false; // Reset dirty flag
      this.editingCell = null; // Ensure we exit any active cell edit
      this.editValue = null;
      this.originalCellValue = null;
      this.cdRef.detectChanges();
      this._snackBar.open('Changes cancelled.', 'OK', {
        duration: 3000,
        panelClass: ['data-driven-custom-snackbar']
       });
    } else {
      this.log.msg('3', `Could not find original data to cancel changes for fileId: ${fileId}`, 'Edit');
    }
  }

  /**
   * Download a file
   * @param file The file to download
   */
  onDownloadFile(file: UploadedFile) {
    // return if file is still uploading
    if (file.status.toLowerCase() !== 'done') {
      return;
    }

    const downloading = this._snackBar.open(
      'Generating file to download, please be patient.',
      'OK',
      { duration: 10000, panelClass: ['data-driven-custom-snackbar'] }
    );

    this.fileUpload.downloadFile(file.id).subscribe({
      next: res => {
        // Handle case where res.body could be null
        if (!res.body) {
          downloading.dismiss();
          this._snackBar.open('Download failed: Empty response', 'OK', {
             duration: 5000,
             panelClass: ['data-driven-custom-snackbar']
             });
          return;
        }
        
        const blob = new Blob([this.base64ToArrayBuffer(res.body)], {
          type: file.mime || 'application/octet-stream', // Provide fallback mime type
        });
        this.fileUpload.downloadFileBlob(blob, file);
        downloading.dismiss();
      },
      error: err => {
        downloading.dismiss();
        if (err.error) {
          try {
            const errors = typeof err.error === 'string' ? JSON.parse(err.error) : err.error;
            this._snackBar.open(errors.error || 'Download failed', 'OK', {
               duration: 5000,
               panelClass: ['data-driven-custom-snackbar']
               });
          } catch {
            this._snackBar.open('Download failed', 'OK', {
               duration: 5000,
               panelClass: ['data-driven-custom-snackbar']
               });
          }
        } else {
          this._snackBar.open('Download failed', 'OK', {
             duration: 5000,
             panelClass: ['data-driven-custom-snackbar']
             });
        }
      },
    });
  }

  /**
   * Convert base64 string to array buffer
   * Used for file download
   */
  base64ToArrayBuffer(data: string) {
    const byteArray = atob(data);
    const uint = new Uint8Array(byteArray.length);
    for (let i = 0; i < byteArray.length; i++) {
      let ascii = byteArray.charCodeAt(i);
      uint[i] = ascii;
    }
    return uint;
  }
}
