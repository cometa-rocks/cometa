import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  OnInit, 
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ViewChild, 
  ElementRef, 
  TemplateRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { PageEvent } from '@angular/material/paginator';
import { MatSelectChange } from '@angular/material/select';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { ApiService } from '@services/api.service';
import { FileUploadService } from '@services/file-upload.service';
import { InputFocusService } from '@services/inputFocus.service';
import { LogService } from '@services/log.service';
import { Subscription, Subject } from 'rxjs';
import { finalize, debounceTime, distinctUntilChanged, take } from 'rxjs/operators';
import { SureRemoveFileComponent } from '@dialogs/sure-remove-file/sure-remove-file.component';
import { MatSnackBar } from '@angular/material/snack-bar';

// Common Angular imports
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { MatInputModule } from '@angular/material/input';
import { ContextMenuModule } from '@perfectmemory/ngx-contextmenu';

// Directives
import { StopPropagationDirective } from '@directives/stop-propagation.directive';
import { LetDirective } from '@directives/ng-let.directive';

// Pipes
import { AvailableFilesPipe } from '@pipes/available-files.pipe';
import { HumanizeBytesPipe } from '@pipes/humanize-bytes.pipe';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { LoadingSpinnerComponent } from '@components/loading-spinner/loading-spinner.component';

// Interfaces

// Add interface for sheet information
interface FileSheetInfo {
  names: string[];
  current: string;
}

interface Department {
  department_id: number;
  department_name: string;
  files: UploadedFile[];
  selected?: boolean;
}

// Define interface for the Department used by FileUploadService
interface FileUploadDepartment {
  department_id: number;
  department_name: string;
  files: any[];
}

// Add import for AddColumnNameDialogComponent
import { AddColumnNameDialogComponent } from '@dialogs/add-column-name/add-column-name.component';
import { EditSchedule } from '@dialogs/edit-schedule/edit-schedule.component';

@Component({
  selector: 'app-files-management',
  templateUrl: './files-management.component.html',
  styleUrls: ['./files-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MtxGridModule,
    MatIconModule,
    MatLegacyButtonModule,
    MatDividerModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslateModule,
    StopPropagationDirective,
    LetDirective,
    AvailableFilesPipe,
    HumanizeBytesPipe,
    SortByPipe,
    AmParsePipe,
    AmDateFormatPipe,
    LoadingSpinnerComponent,
    MatInputModule,
    ContextMenuModule,
    AddColumnNameDialogComponent,
  ]
})
export class FilesManagementComponent implements OnInit, OnDestroy, OnChanges {
  // Input properties
  @Input() department: Department;
  @Input() isExpanded: boolean = true;
  @Input() showPagination: boolean = true;
  @Input() fileColumns: MtxGridColumn[] = [];
  @Input() showPanel: boolean = true;
  @Input() file_type: string = 'normal';
  
  // Output events
  @Output() fileUploaded = new EventEmitter<UploadedFile[]>();
  @Output() fileDeleted = new EventEmitter<UploadedFile>();
  @Output() fileDownloaded = new EventEmitter<UploadedFile>();
  @Output() fileExecute = new EventEmitter<UploadedFile>();
  @Output() panelToggled = new EventEmitter<boolean>();
  @Output() paginationChanged = new EventEmitter<{event: PageEvent, file?: UploadedFile}>();
  @Output() searchFocusChange = new EventEmitter<boolean>();
  @Output() scheduleDataUpdated = new EventEmitter<{fileId: number, hasCron: boolean, cronExpression?: string}>();
  
  // View children for templates
  @ViewChild('editInput') editInput: ElementRef;

  @ViewChild('dynamicEditableCellTpl') dynamicEditableCellTpl: TemplateRef<any>;
  
  @ViewChild('cellContextMenu') cellContextMenu: any;

  
  // Component properties
  isLoadingFiles: boolean = false;
  expandedFileIds: Set<number> = new Set<number>();
  file_data: Record<string, any> = {};
  showRemovedFiles: boolean = false;
  deletingFileIds: Set<number> = new Set<number>(); // Track files being deleted
  
  // Static storage for deleted file IDs that persists across component instances
  private static globalDeletedFileIds: Set<number> = new Set<number>();
  
  // Editing properties
  editingCell: { fileId: number, rowIndex: number, columnField: string } | null = null;
  editValue: any = null;
  originalCellValue: any = null;
  original_file_data: Record<number, any[]> = {};
  isDirty: Record<number, boolean> = {};
  
  // Local copy of files for display
  displayFiles: UploadedFile[] = [];
  
  // Properties for file search
  fileSearchTerm: string = '';
  searchInputFocused: boolean = false;
  private allCurrentlyRelevantFiles: UploadedFile[] = [];
  private searchTerms = new Subject<string>();
  
  private focusSubscription: Subscription;
  private searchSubscription: Subscription;

  contextMenuFileId: number | null = null;
  contextMenuRowIndex: number | null = null;
  contextMenuColumnField: string | null = null;
  contextMenuOpen: boolean = false;
  
  // Keep original column definitions for cancel operation
  private original_columns: Record<number, MtxGridColumn[]> = {};
  
  // Debouncing for save operations to prevent spam
  private saveDebounceTimers: Record<number, any> = {};
  
  // Track which files have schedules for conditional icon coloring
  fileScheduleStatus: { [fileId: number]: boolean } = {};
  
  // Track files currently being processed to avoid duplicate API calls
  schedulingInProgress: Set<number> = new Set();
  
  // Store cron expressions for files with schedules
  fileScheduleCronExpressions: { [fileId: number]: string } = {};
  
  constructor(
    private cdRef: ChangeDetectorRef,
    private _http: HttpClient,
    public _dialog: MatDialog,
    private _api: ApiService,
    private fileUpload: FileUploadService,
    private inputFocusService: InputFocusService,
    private _snackBar: MatSnackBar,
    private log: LogService
  ) {}

  // Handle ESC key when context menu is open
  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(event: KeyboardEvent): void {
    // Check if context menu is actually visible in DOM (more reliable than our state tracking)
    const contextMenuElement = document.querySelector('.ngx-contextmenu') as HTMLElement;
    const isContextMenuVisible = contextMenuElement && contextMenuElement.style.display !== 'none';
    
    // Use DOM check as the primary indicator, with fallback to our state tracking
    if ((isContextMenuVisible || this.contextMenuOpen) && this.cellContextMenu) {
      // Close context menu and prevent event propagation
      this.cellContextMenu.hide();
      this.contextMenuOpen = false;
      event.stopPropagation();
      event.preventDefault();
    }
  }

  // Context menu event handlers
  onContextMenuShow(): void {
    this.contextMenuOpen = true;
  }

  onContextMenuHide(): void {
    this.contextMenuOpen = false;
  }
  
  ngOnInit(): void {
    // Sync deletingFileIds with the global static storage
    this.deletingFileIds = new Set(FilesManagementComponent.globalDeletedFileIds);
    
    // Initialize displayFiles from department.files but respect the showRemovedFiles setting
    this.updateDisplayFiles();
    
    // Check schedule status for all files if file_type is datadriven
    if (this.file_type === 'datadriven' && this.displayFiles.length > 0) {
      // Give the grid time to render before checking schedules
      setTimeout(() => {
        this.checkAllFileSchedules();
      }, 100);
    }
    
    // Subscribe to input focus events
    this.focusSubscription = this.inputFocusService.inputFocus$.subscribe((inputFocused) => {
      // Cancel edit if user clicks outside and an edit is in progress
      if (!inputFocused && this.editingCell) {
        this.saveEdit(
          this.editingCell.fileId,
          this.editingCell.rowIndex,
          this.editingCell.columnField
        );
      }
    });
    
    // Set up debounced search
    this.searchSubscription = this.searchTerms.pipe(
      debounceTime(250), // Wait 250ms after last keystroke
      distinctUntilChanged() // Only emit if value changed
    ).subscribe(() => {
      this._applySearchFilter();
    });
    
    // Initialize default file columns if none provided
    if (!this.fileColumns || this.fileColumns.length === 0) {
      this.initializeFileColumns();
    } else {
      
      // Make sure action buttons use our methods
      this.ensureActionButtonsUseComponentMethods();
      
      // Only allow expansion for CSV or Excel files
      const statusColumn = this.fileColumns.find(col => col.field === 'status');
      if (statusColumn) {
        statusColumn.showExpand = true;
        statusColumn.class = (rowData: UploadedFile, colDef?: MtxGridColumn) => {
          if (rowData?.status !== 'Done' || rowData?.is_removed) {
            return 'no-expand';
          }
          const name = (rowData?.name ?? '').toLowerCase();
          const extOk = name.endsWith('.csv') || name.endsWith('.xls') || name.endsWith('.xlsx');
          return this.showDataChecks(rowData) && extOk ? '' : 'no-expand';
        };
      }
    }

    this.loadColumnVisibilitySettings();

    // Load saved expanded file IDs from localStorage
    const savedIds = localStorage.getItem('co_expanded_file_ids');
    if (savedIds) {
      try {
        const parsedIds = JSON.parse(savedIds);
        if (Array.isArray(parsedIds)) {
          this.expandedFileIds = new Set(parsedIds);
          this.log.msg('4', `Loaded expanded file IDs from localStorage: ${parsedIds.length}`, 'Init');

          
          // Save the expanded file IDs back to localStorage to ensure consistency
          this.saveExpandedFileIds();
          
          // Initialize file data for each expanded file
          if (this.displayFiles && this.displayFiles.length > 0) {
            // Use setTimeout to ensure this runs after the component is fully initialized
            setTimeout(() => {
              Array.from(this.expandedFileIds).forEach(fileId => {
                const file = this.displayFiles.find(f => f.id === fileId);
                if (file) {
                  this.log.msg('4', `Auto-loading data for expanded file: ${fileId}`, 'Init');
                  this.getFileData(file);
                }
              });
            }, 0);
          }
        }
      } catch (error) {
        this.log.msg('2', 'Failed to parse saved expanded file IDs', 'Init', error);
      }
    }

    // Log initial state
    this.log.msg('4', 'Files management component initialized', 'Init');
  }
  
  ngOnDestroy(): void {
    if (this.focusSubscription) {
      this.focusSubscription.unsubscribe();
    }
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
    
    // Clean up debounce timers to prevent memory leaks
    Object.values(this.saveDebounceTimers).forEach(timer => {
      if (timer) {
        clearTimeout(timer);
      }
    });
    this.saveDebounceTimers = {};
    
    // Clear any remaining fullDatasets to free memory
    Object.keys(this.file_data).forEach(fileId => {
      this._clearFullDataset(Number(fileId));
    });
    
    // Note: We don't clear deletingFileIds here since it syncs with the static globalDeletedFileIds
  }
  
  // Initialize default file columns
  private initializeFileColumns(): void {
    if (this.fileColumns && this.fileColumns.length > 0) {
      // User has provided custom columns, use those
      this.log.msg('4', 'Using custom file columns provided by parent', 'Init');
      return;
    }
    
    this.log.msg('4', 'Initializing default file columns', 'Init');
    this.fileColumns = [
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
        formatter: (rowData: UploadedFile) => {
          if (rowData.is_removed) {
            // Use HTML directly to apply the class to the text
            return `<span class="status-deleted">Deleted</span>`;
          }
          // Only show error details if the actual status is 'Error'
          // This prevents stale error data from showing when status is 'Done'
          if (rowData.status === 'Error' && rowData.error) {
            // For DDR-specific errors, show a more user-friendly message
            if (rowData.error.status === 'NOT_DDR_FILE') {
              return `<span class="status-error" title="${rowData.error.description}">Error: Not DDR Ready</span>`;
            }
            // For other errors, show the error status or a generic message
            return `<span class="status-error" title="${rowData.error.description || 'Upload failed'}">Error: ${rowData.error.status || 'Upload Failed'}</span>`;
          }
          return rowData.status;
        },
        class: (rowData: UploadedFile, colDef?: MtxGridColumn) => {
          if (rowData.is_removed) {
            return 'status-deleted-cell'; // Class for the cell itself
          }
          // Existing logic for expandability for non-deleted files
          const name = (rowData?.name ?? '').toLowerCase();
          const extOk = name.endsWith('.csv') || name.endsWith('.xls') || name.endsWith('.xlsx');
          return this.showDataChecks(rowData) && extOk ? '' : 'no-expand';
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
              this.log.msg('4', `Execute button clicked for file: ${result.id}`, 'Click');
              this.fileExecute.emit(result);
            },
            iif: row => this.showDataChecks(row) && this.dataDrivenExecutable(row) && !row.is_removed,
          },
          {
            type: 'icon',
            text: 'cloud_download',
            icon: 'cloud_download',
            tooltip: 'Download file',
            click: (result: UploadedFile) => {
              this.log.msg('4', `Download button clicked for file: ${result.id}`, 'Click');
              this.onDownloadFile(result);
            },
            iif: row => row.status === 'Done' && !row.is_removed,
          },
          {
            type: 'icon',
            text: 'schedule',
            icon: 'schedule',
            tooltip: 'Schedule data-driven test',
            // No default color – the icon will be gray unless .has-schedule-icon is added dynamically
            click: (result: UploadedFile) => {
              this.openScheduleDialog(result);
            },
            iif: row => this.showDataChecks(row) && this.dataDrivenExecutable(row) && !row.is_removed,
          },
          {
            type: 'icon',
            text: 'delete',
            icon: 'delete',
            tooltip: 'Delete file',
            color: 'warn',
            click: (result: UploadedFile) => {
              this.log.msg('4', `Delete button clicked for file: ${result.id}`, 'Click');
              this.onDeleteFile(result);
            },
            iif: row => !row.is_removed,
          },
        ]
      }
    ];
  }
  
  // Event handlers
  togglePanel(state: boolean): void {
    this.panelToggled.emit(state);
  }
  
  onUploadFile(event: any): void {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }

    // Validate file name lengths to avoid backend path truncation errors
    const MAX_NAME_LENGTH = 220;
    const filesArray: File[] = Array.from(event.target.files);
    const overlong = filesArray.filter(f => f.name.length > MAX_NAME_LENGTH);
    if (overlong.length > 0) {
      this._snackBar.open(
        `File name too long. Max ${MAX_NAME_LENGTH} characters allowed.`,
        'OK',
        {
          duration: 5000,
          panelClass: ['file-management-custom-snackbar']
        }
      );

      event.target.value = '';
      return;
    }
    
    // Check for data-driven file type restrictions
    if (this.file_type === 'datadriven') {
      const invalidFiles = filesArray.filter(file => {
        const name = file.name.toLowerCase();
        return !(name.endsWith('.csv') || name.endsWith('.xls') || name.endsWith('.xlsx'));
      });
      
      if (invalidFiles.length > 0) {
        const invalidFileNames = invalidFiles.map(f => f.name).join(', ');
        this._snackBar.open(
          `Invalid file type(s) for data-driven uploads. Only CSV or Excel files (.csv, .xls, .xlsx) are allowed: ${invalidFileNames}`,
          'OK',
          {
            duration: 10000,
            panelClass: ['file-management-custom-snackbar']
          }
        );
        
        event.target.value = '';
        return;
      }
    }
    
    // Check for duplicate files
    if (this.department && this.department.files) {
      const existingFilenames = this.department.files
        .filter(f => !f.is_removed)
        .map(f => f.name.toLowerCase());
      
      const duplicates = filesArray.filter(f => 
        existingFilenames.includes(f.name.toLowerCase())
      );
      
      if (duplicates.length > 0) {
        const message = duplicates.length === 1 
          ? `File "${duplicates[0].name}" already exists.` 
          : `${duplicates.length} files already exist.`;
          
        this._snackBar.open(message, 'OK', {
          duration: 5000,
          panelClass: ['file-management-custom-snackbar']
        });
        
        // If all files are duplicates, clear the input and return
        if (duplicates.length === filesArray.length) {
          event.target.value = '';
          return;
        }
      }
    }
    
    this.isLoadingFiles = true;
    this.cdRef.markForCheck();
    
    // Create form data
    let formData: FormData = new FormData();
    let files = event.target.files;
    
    for (let file of files) {
      formData.append('files', file);
    }
    
    formData.append('department_id', this.department.department_id.toString());
    formData.append('file_type', this.file_type);
    
    // Create a compatible department object with department_name
    const compatibleDepartment = {
      department_id: this.department.department_id,
      department_name: this.department.department_name || '',
      files: this.department.files || []
    };
    
    // Use type assertion to bypass TypeScript's type checking
    this.fileUpload.startUpload(files, formData, compatibleDepartment as any, {name: 'User'});
    
    // Simply emit an empty array after a short delay to simulate completion
    setTimeout(() => {
      this.isLoadingFiles = false;
      this.fileUploaded.emit([]);
      event.target.value = '';
      this.cdRef.markForCheck();
    }, 500);
  }
  
  onDeleteFile(file: UploadedFile): void {
    this.log.msg('4', `Delete file clicked: ${file.id}`, 'Delete');
    
    // Prevent duplicate delete attempts
    if (file.id && !this.deletingFileIds.has(file.id)) {
      this.deletingFileIds.add(file.id);
      FilesManagementComponent.globalDeletedFileIds.add(file.id); // Add to global storage
      
      const dialogRef = this._dialog.open(SureRemoveFileComponent, {
        data: {
          file: file
        },
        disableClose: true
      });
      
      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.log.msg('4', `Delete confirmed for file: ${file.id}`, 'Delete');
          
          // Update local state instead of department directly
          if (this.displayFiles && this.displayFiles.length) {
            this.displayFiles = this.displayFiles.filter(f => f.id !== file.id);
            
            // Force change detection to update the UI
            this.cdRef.markForCheck();
          }
          
          // Also remove any expanded state for this file
          this.expandedFileIds.delete(file.id);
          delete this.file_data[file.id];
          delete this.original_file_data[file.id];
          delete this.isDirty[file.id];
          this.saveExpandedFileIds();
          
          // Emit the event to the parent component to handle the deletion
          this.fileDeleted.emit(file);
          
          // Keep the file ID in deletingFileIds to prevent re-deletion attempts
        } else {
          // User cancelled, remove from deletingFileIds
          if (file.id) {
            this.deletingFileIds.delete(file.id);
            FilesManagementComponent.globalDeletedFileIds.delete(file.id); // Remove from global storage
          }
        }
      });
    } else {
      this.log.msg('3', `File ${file.id} is already being deleted or was deleted, ignoring duplicate request`, 'Delete');
    }
  }
  
  onDownloadFile(file: UploadedFile): void {
    this.log.msg('4', `Download file clicked: ${file.id}`, 'Download');
    
    // First emit the event - parent component should handle the download
    this.fileDownloaded.emit(file);
  }
  
  updateFilePagination(event: PageEvent, file?: UploadedFile): void {
    this.log.msg('4', `Pagination event: ${event.pageIndex}/${event.pageSize}, File: ${file?.id}`, 'Pagination');
    
    // Always emit the pagination event
    this.paginationChanged.emit({ event, file });
    
    // If we have a file and it's in our file_data, update pagination and fetch data
    if (file && file.id && this.file_data[file.id]) {
      const fileId = file.id;
      this.log.msg('4', `Updating pagination for file ID: ${fileId}`, 'Pagination');
      
      if (!this.file_data[fileId].params) {
        this.file_data[fileId].params = {};
      }
      
      this.file_data[fileId].params.page = event.pageIndex;
      this.file_data[fileId].params.size = event.pageSize;
      
      // Check if the file has unsaved changes
      if (this.isDirty[fileId]) {
        // Check if we need to fetch complete dataset first
        if (!this.file_data[fileId].fullDataset) {
          const hasAllData = !this.file_data[fileId].showPagination || 
                           (this.file_data[fileId].total === this.file_data[fileId].file_data.length);
          
          if (!hasAllData && this.file_data[fileId].showPagination) {
            this._fetchCompleteDatasetForDirtyFile(fileId, file);
            return; // Exit early, _fetchCompleteDatasetForDirtyFile will handle pagination
          }
        }
        
        // Implement client-side pagination for dirty data
        this._applyClientSidePagination(fileId);
      } else {
        // Fetch fresh data from server only if no unsaved changes
        this.getFileData(file);
      }
    }
  }
  
  // Expansion handling
  expand(event: any): void {
    this.log.msg('4', `Expansion event received`, 'Expand');
    
    // Check if data exists in the event (previously was rowData)
    if (!event || !event.data) {
      this.log.msg('2', 'Expansion event missing data', 'Expand', event);
      return;
    }
    
    const fileId = event.data.id;
    
    // Additional safeguard for invalid file ID
    if (fileId === undefined || fileId === null) {
      this.log.msg('2', 'Expansion event data missing id', 'Expand', event.data);
      return;
    }
    
    if (event.expanded) {
      this.log.msg('4', `Expanding file ID: ${fileId}`, 'Expand');
      this.expandedFileIds.add(fileId);
      
      // Load file data if it's not already loaded
      if (!this.file_data[fileId] || !this.file_data[fileId].file_data) {
        this.getFileData(event.data);
      }
    } else {
      this.log.msg('4', `Collapsing file ID: ${fileId}`, 'Expand');
      this.expandedFileIds.delete(fileId);
    }
    
    this.saveExpandedFileIds();
  }
  
  private saveExpandedFileIds(): void {
    localStorage.setItem('co_expanded_file_ids', JSON.stringify(Array.from(this.expandedFileIds)));
  }
  
  getFileData(file: UploadedFile): void {
    if (!file || !file.id) {
      this.log.msg('2', 'Invalid file object or missing file ID', 'GetData', file);
      return;
    }
    
    const fileId = file.id;
    const isExcel = this.isExcelFile(file.name);
    
    // Try to get the saved sheet for Excel files
    let savedSheet: string | null = null;
    if (isExcel) {
      savedSheet = localStorage.getItem(`co_excel_sheet_${fileId}`);
      this.log.msg('4', `Looking for saved sheet for file ${fileId}: ${savedSheet || 'none found'}`, 'GetData');
    }
    
    // Check if a specific sheet was requested via the file object
    const requestedSheet = (file as any).selectedSheet;
    if (requestedSheet) {
      savedSheet = requestedSheet;
      this.log.msg('4', `Using requested sheet: ${requestedSheet}`, 'GetData');
    }
    
    // Store previous data temporarily for smoother transitions
    const previousData = this.file_data[fileId]?.file_data || [];
    const previousTotal = this.file_data[fileId]?.total || 0;
    
    if (!this.file_data[fileId]) {
      this.file_data[fileId] = { 
        isLoading: true,
        file_data: [],
        total: 0,
        params: {
          page: 0,
          size: 10
        },
        showPagination: true,
        fileId: fileId, // Store file ID directly at creation time
        sheets: {
          names: [],
          current: isExcel && savedSheet ? savedSheet : ''
        }
      };
    } else {
      this.file_data[fileId].isLoading = true;
      this.file_data[fileId].fileId = fileId; // Ensure fileId is set
      
      // Keep previous data visible during loading for better UX
      if (previousData.length > 0) {
        this.file_data[fileId].file_data = previousData;
        this.file_data[fileId].total = previousTotal;
      }
      
      // Make sure we preserve any saved sheet preference
      if (isExcel && savedSheet && (!this.file_data[fileId].sheets || !this.file_data[fileId].sheets.current)) {
        if (!this.file_data[fileId].sheets) {
          this.file_data[fileId].sheets = { names: [], current: savedSheet };
        } else {
          this.file_data[fileId].sheets.current = savedSheet;
        }
      }
    }
    
    this.log.msg('4', `Getting data for file ID: ${fileId}, File name: ${file.name}`, 'GetData');
    this.cdRef.markForCheck();
    
    // Add sheet parameter to the request if this is an Excel file and a sheet is selected
    const params: any = {
      size: this.file_data[fileId].params.size,
      page: this.file_data[fileId].params.page + 1,
    };
    
    // If this is an Excel file and we have a selected sheet, include it in the request
    if (isExcel && this.file_data[fileId].sheets && this.file_data[fileId].sheets.current) {
      params.sheet = this.file_data[fileId].sheets.current;
    }
    
    const apiUrl = `/api/data_driven/file/${file.id}`;
    this.log.msg('4', `Fetching file data from ${apiUrl} with params: ${JSON.stringify(params)}`, 'GetData');
    
    this._http
      .get(apiUrl, { params })
      .pipe(
        finalize(() => {
          this.file_data[fileId].isLoading = false;
          this.cdRef.markForCheck();
        })
      )
      .subscribe({
        next: (resp: any) => {
          this.log.msg('4', `Received response for file ID ${fileId}`, 'GetData');
          
          try {
            // If response is a string, try to parse it as JSON
            if (typeof resp === 'string') {
              try {
                resp = JSON.parse(resp);
                this.log.msg('4', `Parsed JSON response for file ${fileId}`, 'GetData');
              } catch (parseError) {
                this.log.msg('2', `Failed to parse response as JSON for file ${fileId}`, 'GetData', parseError);
              }
            }
            
            // Debug the response structure
            this.log.msg('4', `Response structure for file ${fileId}: hasResults=${resp && !!resp.results}, hasData=${resp && !!resp.data}`, 'GetData');
            
            // Store sheet names if available
            if (resp && resp.sheet_names && Array.isArray(resp.sheet_names) && resp.sheet_names.length > 0) {
              this.log.msg('4', `Excel sheet names found for file ${fileId}: ${resp.sheet_names.join(', ')}`, 'GetData');
              
              this.file_data[fileId].sheets = {
                names: resp.sheet_names,
                // If no current sheet is set, default to the first one
                current: this.file_data[fileId].sheets.current || resp.sheet_names[0]
              };
            }
            
            // For direct CSV API response that might provide 'data' instead of 'results'
            let results: any[] = [];
            if (resp) {
              if (Array.isArray(resp)) {
                results = resp; // Case when API returns a direct array
                this.log.msg('4', `API returned direct array for file ${fileId}`, 'GetData');
              } else if (resp.results && Array.isArray(resp.results)) {
                results = resp.results;
                this.log.msg('4', `Using results array for file ${fileId}`, 'GetData');
              } else if (resp.data && Array.isArray(resp.data)) {
                results = resp.data;
                this.log.msg('4', `Using data array for file ${fileId}`, 'GetData');
              }
            }
            
            const fetchedData = Array.isArray(results) ? 
              (results.length > 0 && results[0] && results[0].data ? results.map((d: any) => d.data) : results) : 
              [];
            
            this.log.msg('4', `Fetched data for file ${fileId}: count=${fetchedData.length}`, 'GetData');
              
            if (fetchedData.length > 0) {
              const columns: MtxGridColumn[] = [];
              
              // For CSV files, typically the first row has the column names
              const firstRow = fetchedData[0];
              
              // Use the ordered columns from the API response if available, 
              // otherwise extract them from the first data row
              const columnKeys = resp && resp.columns_ordered && Array.isArray(resp.columns_ordered) ? 
                resp.columns_ordered : 
                (firstRow ? Object.keys(firstRow) : []);
                
              // Get the column headers mapping if available
              const columnHeaders = resp && resp.column_headers ? resp.column_headers : {};
                
              this.log.msg('4', `Column keys for file ${fileId}: ${columnKeys.join(', ')}`, 'GetData');
              
              columnKeys.forEach(key => {
                // Use the cleaned header for display, but keep the original field name for data integrity
                // The column_headers mapping provides cleaned display names
                const displayHeader = columnHeaders[key] || key;
                
                columns.push({
                  header: displayHeader,  // Use cleaned header for display
                  field: key,             // Use original field name for data access
                  sortable: true,
                  cellTemplate: this.dynamicEditableCellTpl,
                  // Store file ID in a class instead of custom property
                  class: `file-${fileId}`
                });
              });
              
              // Apply Excel-style row numbers and column letters
              this.processFileDataForExcel(fileId, fetchedData, columns);
              
              this.file_data[fileId] = {
                ...this.file_data[fileId],
                columns: columns,
                file_data: fetchedData,
                total: resp && resp.count ? resp.count : fetchedData.length,
                isLoading: false,
                showPagination: (resp && resp.count ? resp.count : fetchedData.length) > 10,
                fileId: fileId, // Ensure file ID is stored in the data object
                sheets: this.file_data[fileId].sheets
              };
              
              // Store original data for comparison
              this.original_file_data[fileId] = JSON.parse(JSON.stringify(fetchedData));
              this.isDirty[fileId] = false;
              
              this.log.msg('4', `Updated file_data for file ${fileId}`, 'GetData');
              
              this.loadNestedColumnVisibilitySettings(fileId);
            } else {
              this.log.msg('3', `No data found for file ${fileId}`, 'GetData');
              
              // For Excel files, create a default empty grid structure that users can interact with
              if (this.isExcelFile(file.name)) {
                // Create default columns (A, B, C, D)
                const defaultColumns: MtxGridColumn[] = [
                  {
                    field: 'rowNumber',
                    header: '#',
                    width: '60px',
                    resizable: false,
                    sortable: false,
                    formatter: (rowData: any) => {
                      return rowData.rowNumber || 1;
                    }
                  }
                ];
                
                // Add default data columns A, B, C, D
                const defaultDataColumns = ['A', 'B', 'C', 'D'];
                defaultDataColumns.forEach(colName => {
                  defaultColumns.push({
                    field: colName,
                    header: colName,
                    resizable: true,
                    sortable: true,
                    cellTemplate: this.dynamicEditableCellTpl,
                    class: `file-${fileId}`
                  });
                });
                
                // Create one empty row with default structure
                const emptyRow = { rowNumber: 1 };
                defaultDataColumns.forEach(colName => {
                  emptyRow[colName] = '';
                });
                
                this.file_data[fileId] = {
                  ...this.file_data[fileId],
                  columns: defaultColumns,
                  file_data: [emptyRow],
                  total: 1,
                  isLoading: false,
                  showPagination: false,
                  fileId: fileId,
                  sheets: this.file_data[fileId].sheets
                };
                
                // Don't mark as dirty - this is just the initial empty state
                this.isDirty[fileId] = false;
                
                // Store this as the original data
                this.original_file_data[fileId] = JSON.parse(JSON.stringify([emptyRow]));
                
                this.log.msg('4', `Created default empty grid for Excel file ${fileId}`, 'GetData');
              } else {
                // For non-Excel files, keep the original behavior
                this.file_data[fileId] = {
                  ...this.file_data[fileId],
                  columns: [],
                  file_data: [],
                  total: 0,
                  isLoading: false,
                  showPagination: false,
                  fileId: fileId,
                  sheets: this.file_data[fileId].sheets
                };
              }
            }
          } catch (e) {
            this.log.msg('2', `Error processing response for file ${fileId}`, 'GetData', e);
            
            // For Excel files, provide default empty grid even on error
            if (this.isExcelFile(file.name)) {
              // Create default columns (A, B, C, D)
              const defaultColumns: MtxGridColumn[] = [
                {
                  field: 'rowNumber',
                  header: '#',
                  width: '60px',
                  resizable: false,
                  sortable: false,
                  formatter: (rowData: any) => {
                    return rowData.rowNumber || 1;
                  }
                }
              ];
              
              // Add default data columns A, B, C, D
              const defaultDataColumns = ['A', 'B', 'C', 'D'];
              defaultDataColumns.forEach(colName => {
                defaultColumns.push({
                  field: colName,
                  header: colName,
                  resizable: true,
                  sortable: true,
                  cellTemplate: this.dynamicEditableCellTpl,
                  class: `file-${fileId}`
                });
              });
              
              // Create one empty row with default structure
              const emptyRow = { rowNumber: 1 };
              defaultDataColumns.forEach(colName => {
                emptyRow[colName] = '';
              });
              
              this.file_data[fileId].columns = defaultColumns;
              this.file_data[fileId].file_data = [emptyRow];
              this.file_data[fileId].total = 1;
              this.file_data[fileId].showPagination = false;
              this.file_data[fileId].isLoading = false;
              
              // Don't mark as dirty - this is just the initial empty state after error
              this.isDirty[fileId] = false;
              this.original_file_data[fileId] = JSON.parse(JSON.stringify([emptyRow]));
              
              this.log.msg('4', `Created default empty grid for Excel file ${fileId} after error`, 'GetData');
            } else {
              this.file_data[fileId].file_data = [];
              this.file_data[fileId].total = 0;
              this.file_data[fileId].showPagination = false;
              this.file_data[fileId].isLoading = false;
            }
          }
          
          this.cdRef.markForCheck();
        },
        error: (error) => {
          this.log.msg('2', `Error fetching file data for file ${fileId}`, 'GetData', error);
          this.file_data[fileId].isLoading = false;
          this.cdRef.markForCheck();
        }
      });
  }
  
  // Inline editing functionality
  isEditing(fileId: number, rowIndex: number, columnField: string): boolean {
    return this.editingCell !== null &&
           this.editingCell.fileId === fileId &&
           this.editingCell.rowIndex === rowIndex &&
           this.editingCell.columnField === columnField;
  }
  
  startEdit(fileId: number, rowIndex: number, columnField: string, currentValue: any): void {
    // Finish any existing cell edit first
    if (this.editingCell) {
      this.saveEdit(
        this.editingCell.fileId,
        this.editingCell.rowIndex,
        this.editingCell.columnField
      );
    }
    
    this.editingCell = { fileId, rowIndex, columnField };
    this.editValue = currentValue;
    this.originalCellValue = currentValue;
    
    this.cdRef.markForCheck();
    
    // Focus the input element
    setTimeout(() => {
      if (this.editInput && this.editInput.nativeElement) {
        this.editInput.nativeElement.focus();
      }
    });
  }
  
  saveEdit(fileId: number, rowIndex: number, columnField: string): void {
    if (!this.editingCell) return;
    
    if (this.file_data[fileId] && this.file_data[fileId].file_data && 
        this.file_data[fileId].file_data[rowIndex]) {
      
      const oldValue = this.file_data[fileId].file_data[rowIndex][columnField];
      
      // Update the value if it changed
      if (this.editValue !== null && this.editValue !== oldValue) {
        // Update the visible data
        this.file_data[fileId].file_data[rowIndex][columnField] = this.editValue;
        
        // If we have a fullDataset, also update that
        if (this.file_data[fileId].fullDataset) {
          // Calculate the actual index in the full dataset
          const pageIndex = this.file_data[fileId].params?.page || 0;
          const pageSize = this.file_data[fileId].params?.size || 10;
          const actualIndex = (pageIndex * pageSize) + rowIndex;
          
          if (this.file_data[fileId].fullDataset[actualIndex]) {
            this.file_data[fileId].fullDataset[actualIndex][columnField] = this.editValue;
          }
        } else {
          // First time making this file dirty, store the full dataset
          // Only create fullDataset if we have all the data (not paginated) or if total matches current data length
          const hasAllData = !this.file_data[fileId].showPagination || 
                           (this.file_data[fileId].total === this.file_data[fileId].file_data.length);
          
          if (hasAllData) {
            this.file_data[fileId].fullDataset = [...this.file_data[fileId].file_data];
            this.file_data[fileId].total = this.file_data[fileId].file_data.length;
          } else {
            // We don't create fullDataset here because we don't have complete data
            // The pagination logic will need to handle this case
          }
        }
        
        // Check if the file data is dirty by comparing with original
        this.isDirty[fileId] = JSON.stringify(this.file_data[fileId].file_data) !== 
                              JSON.stringify(this.original_file_data[fileId]);
      }
    }
    
    this.editingCell = null;
    this.editValue = null;
    this.cdRef.markForCheck();
  }
  
  cancelEdit(): void {
    this.editingCell = null;
    this.editValue = null;
    this.cdRef.markForCheck();
  }
  
  saveAllChanges(fileId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isDirty[fileId] || !this.file_data[fileId]) {
        resolve();
        return;
      }

      // Debounce save operations to prevent spam clicking
      if (this.saveDebounceTimers[fileId]) {
        clearTimeout(this.saveDebounceTimers[fileId]);
      }
      
      // If already loading, don't start another save operation
      if (this.file_data[fileId].isLoading) {
        this.log.msg('3', `Save operation already in progress for file ${fileId}`, 'SaveChanges');
        resolve(); // Resolve immediately if already saving
        return;
      }

      this.file_data[fileId].isLoading = true;
      this.cdRef.markForCheck();
      
      // Get the file from department data to check file type
      const file = this.department?.files?.find(f => f.id === fileId);
      if (!file) {
        this._snackBar.open('Error: Could not find file information', 'Close', {
          duration: 5000,
          panelClass: ['file-management-custom-snackbar']
        });
        this.file_data[fileId].isLoading = false;
        this.cdRef.markForCheck();
        reject(new Error('Could not find file information'));
        return;
      }
      
      // Check if this is an Excel file and has a current sheet selected
      const isExcel = this.isExcelFile(file.name);
      const currentSheet = isExcel ? this.getCurrentSheet(fileId) : null;
      
      // Validate the current sheet
      if (isExcel) {
        const sheetNames = this.getSheetNames(fileId);
        
        if (currentSheet && sheetNames.includes(currentSheet)) {
          this.log.msg('4', `Saving changes to Excel file ${fileId}, sheet: ${currentSheet}`, 'SaveChanges');
        } else if (sheetNames.length > 0) {
          // If no valid sheet is selected but we have sheets, use the first one
          const firstSheet = sheetNames[0];
          this.log.msg('3', `Excel file ${fileId} has invalid or missing sheet selection. Using first sheet: ${firstSheet}`, 'SaveChanges');
          this.file_data[fileId].sheets.current = firstSheet;
          localStorage.setItem(`co_excel_sheet_${fileId}`, firstSheet);
        } else {
          this.log.msg('2', `Excel file ${fileId} has no sheet names available`, 'SaveChanges');
        }
      }
      
      // Create request parameters with optional sheet parameter
      let params: any = {};
      if (isExcel) {
        if (currentSheet) {
          params.sheet = currentSheet;
          this.log.msg('4', `Adding sheet parameter for Excel file: sheet=${params.sheet}`, 'SaveChanges');
        } else {
          this.log.msg('3', `Excel file ${fileId} but no current sheet found, using default sheet`, 'SaveChanges');
          // If it's an Excel file but no sheet is selected, we might still want to 
          // send a sheet parameter if we know the available sheets
          const sheetNames = this.getSheetNames(fileId);
          if (sheetNames && sheetNames.length > 0) {
            params.sheet = sheetNames[0]; // Use first sheet as default
          }
        }
      }
      
      // If we only have a subset of data due to pagination, retrieve all data for the current sheet
      if (this.file_data[fileId].showPagination && this.file_data[fileId].total > this.file_data[fileId].file_data.length) {
        
        // Create temp params to get all data for this sheet/file
        const retrieveParams = { ...params };
        retrieveParams.page = 1;
        retrieveParams.size = this.file_data[fileId].total; // Request all rows
        
        // Temporarily fetch all data for this sheet
        this._http.get(`/api/data_driven/file/${fileId}`, { params: retrieveParams })
          .pipe(
            finalize(() => {
              this.file_data[fileId].isLoading = false;
              this.cdRef.markForCheck();
            })
          )
          .subscribe({
            next: (resp: any) => {
              let allData: any[] = [];
              
              if (resp) {
                if (Array.isArray(resp)) {
                  allData = resp;
                } else if (resp.results && Array.isArray(resp.results)) {
                  allData = resp.results;
                } else if (resp.data && Array.isArray(resp.data)) {
                  allData = resp.data;
                }
              }
              
              const allFetchedData = Array.isArray(allData) ? 
                (allData.length > 0 && allData[0] && allData[0].data ? allData.map((d: any) => d.data) : allData) : 
                [];
              
              // Apply the edits from the current data to the full data set
              const editedData = this.file_data[fileId].fullDataset || this.file_data[fileId].file_data;
              const currentPageParams = this.file_data[fileId].params;
              
              // If there are no rows to update, just save what we have (unlikely)
              if (allFetchedData.length === 0 || editedData.length === 0) {
                this._saveFileData(fileId, editedData, params)
                  .then(() => resolve())
                  .catch((error) => reject(error));
                return;
              }
              
              // Calculate start index based on current page and page size
              const pageSize = currentPageParams.size;
              const pageIndex = currentPageParams.page; 
              const startIdx = pageIndex * pageSize;
              
              this.log.msg('4', `Current page ${pageIndex}, page size ${pageSize}, starting at index ${startIdx}`, 'SaveChanges');
              
              // Create a copy of the full dataset to modify
              const fullDatasetWithEdits = [...allFetchedData];
              
              // Apply edits from current view to the full dataset
              for (let i = 0; i < editedData.length; i++) {
                const editedRowIndex = startIdx + i;
                
                // Only apply if we're within bounds of the full dataset
                if (editedRowIndex < fullDatasetWithEdits.length) {
                  const originalRow = fullDatasetWithEdits[editedRowIndex];
                  const editedRow = editedData[i];
                  
                  // Get all keys from both objects to ensure we don't miss any
                  const allKeys = new Set([
                    ...Object.keys(originalRow || {}), 
                    ...Object.keys(editedRow || {})
                  ]);
                  
                  // Apply edited values to the original row
                  allKeys.forEach(key => {
                    if (editedRow && key in editedRow) {
                      // Only update if the edited row has this key
                      originalRow[key] = editedRow[key];
                    }
                  });
                  
                  this.log.msg('4', `Applied edits to row ${editedRowIndex}`, 'SaveChanges');
                }
              }
              
              // Now save the complete dataset with edits applied
              this._saveFileData(fileId, fullDatasetWithEdits, params)
                .then(() => resolve())
                .catch((error) => reject(error));
            },
            error: (error) => {
              // Fall back to saving just the current data
              this._saveFileData(fileId, this.file_data[fileId].file_data, params)
                .then(() => resolve())
                .catch((saveError) => reject(saveError));
            }
          });
      } else {
        // No pagination or all data already loaded, save as is
        // If we have a fullDataset (dirty file with client-side pagination), save that instead
        const dataToSave = this.file_data[fileId].fullDataset || this.file_data[fileId].file_data;
        this._saveFileData(fileId, dataToSave, params)
          .then(() => resolve())
          .catch((error) => reject(error));
      }
    });
  }
  
  // Helper method to perform the actual save operation
  private _saveFileData(fileId: number, data: any[], params: any): Promise<void> {
    return new Promise((resolve, reject) => {
      // Validate input data
      if (!Array.isArray(data) || data.length === 0) {
        this.log.msg('2', `Invalid data provided for saving file ${fileId}`, 'SaveData');
        this._resetFileToConsistentState(fileId, new Error('Invalid data'));
        reject(new Error('Invalid data'));
        return;
      }
      
      // Clone and clean the data to avoid modifying the original
      const dataToSave = this._cloneAndCleanData(data);
      
      // Get the current column order from the file data (excluding special columns)
      const currentColumns = this.file_data[fileId]?.columns || [];
      const dataColumns = currentColumns.filter(col => col.field !== 'rowNumber');
      const columnOrder = dataColumns.map(col => col.header || col.field); // Use headers for column order
      
      // Include column order in the request data
      const requestData = {
        data: dataToSave,
        column_order: columnOrder
      };
      
      // Use the API service's updateDataDrivenFile method with the enhanced request data
      this._api.updateDataDrivenFile(fileId, requestData, params)
        .subscribe({
          next: (response) => {
            this._snackBar.open('File data updated successfully', 'Close', {
              duration: 3000,
              panelClass: ['file-management-custom-snackbar']
            });
            
            // Clear dirty state and full dataset since we're refreshing from server
            this.isDirty[fileId] = false;
            this._clearFullDataset(fileId);
            
            // Find the original file to refresh the data
            const file = this.department?.files?.find(f => f.id === fileId);
            if (file) {
              // Refresh the file data from server to ensure we have the latest state
              this.getFileData(file);
            } else {
              // If we can't find the original file, just mark as not loading
              this.file_data[fileId].isLoading = false;
              this.log.msg('2', `Cannot find original file with ID ${fileId} to refresh data after save`, 'SaveData');
              this.cdRef.markForCheck();
            }
            
            resolve();
          },
          error: (error) => {
            this.log.msg('2', `Error saving file data for file ${fileId}`, 'SaveData', error);
            
            // Reset to consistent state on error
            this._resetFileToConsistentState(fileId, error);
            
            this._snackBar.open('Error updating file data. Changes have been reverted.', 'Close', {
              duration: 5000,
              panelClass: ['file-management-custom-snackbar']
            });
            
            reject(error);
          }
        });
    });
  }
  
  cancelAllChanges(fileId: number): void {
    if (!this.isDirty[fileId]) return;

    // Cancel any active editing
    if (this.editingCell && this.editingCell.fileId === fileId) {
      this.cancelEdit();
    }
 
    // Revert rows if snapshot exists
    if (this.original_file_data[fileId]) {
      this.file_data[fileId].file_data = JSON.parse(JSON.stringify(this.original_file_data[fileId]));
    }

    // Clear any fullDataset (client-side pagination data)
    this._clearFullDataset(fileId);
 
    // Revert columns if snapshot exists
    if (this.original_columns[fileId]) {
      // Deep copy to avoid side-effects, but filter out any actions columns
      const originalColumns = this.original_columns[fileId]
        .filter(col => col.field !== 'actions')
        .map(col => ({ 
          ...col
        }));
      
      // Force grid to re-render by clearing and resetting columns (same as rename)
      this.file_data[fileId].columns = [];
      this.cdRef.detectChanges();
      
      // Set the original columns back after a micro-task
      setTimeout(() => {
        this.file_data[fileId].columns = originalColumns;
        this.file_data = { ...this.file_data };
        this.cdRef.detectChanges();
      }, 0);
    } else {
      // If no column snapshot, just refresh the reference
      this.file_data = { ...this.file_data };
      this.cdRef.markForCheck();
    }
 
    this.isDirty[fileId] = false;
  }
  
  // Utility functions
  extractFileIdFromClass(className: string | undefined): number {
    if (!className) return 0;
    
    // Check if it's a string that matches our pattern
    if (typeof className === 'string' && className.startsWith('file-')) {
      const parts = className.split('-');
      if (parts.length > 1) {
        const fileId = Number(parts[1]);
        return isNaN(fileId) ? 0 : fileId;
      }
    }
    
    this.log.msg('3', 'Could not extract file ID from class', 'Utility', className);
    return 0;
  }

  getRowClass(row: any): string {
    return row.is_removed ? 'removed-file-row' : '';
  }

  hasRemovedFiles(files: any[]): boolean {
    return files?.some(file => file.is_removed) || false;
  }
  
  getRemovedFilesCount(files: any[]): number {
    return files?.filter(file => file.is_removed)?.length || 0;
  }

  base64ToArrayBuffer(data: string): ArrayBuffer {
    const binaryString = window.atob(data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
  
  showDataChecks(row: UploadedFile): boolean {
    if (!row) return false;
    return (
      row.status === 'Done' &&
      !row.is_removed
    );
  }
  
  dataDrivenExecutable(row: UploadedFile): boolean {
    if (!row) return false;
    return (
      row.status === 'Done' &&
      !row.is_removed &&
      row.extras !== undefined &&
      row.extras.ddr !== undefined &&
      row.extras.ddr['data-driven-ready'] === true
    );
  }

  // Make sure action buttons and status column in parent-provided columns use our logic
  private ensureActionButtonsUseComponentMethods(): void {
    // Find options column if it exists
    const optionsColumn = this.fileColumns.find(column => column.field === 'options' && column.type === 'button');
    
    if (optionsColumn && optionsColumn.buttons && Array.isArray(optionsColumn.buttons)) {
      this.log.msg('4', 'Updating button handlers in options column', 'Init');
      
      // Loop through buttons and fix handlers
      optionsColumn.buttons.forEach(button => {
        // Handle execute button
        if (button.icon === 'play_circle_fill' || button.text === 'play_circle_fill') {
          this.log.msg('4', 'Found execute button, ensuring correct handler', 'Init');
          const originalClick = button.click;
          button.click = (file: UploadedFile) => {
            this.fileExecute.emit(file);
          };
          
          // Ensure the button is not shown for removed files
          if (button.iif) {
            const originalIif = button.iif;
            button.iif = (row: UploadedFile) => {
              return originalIif(row) && !row.is_removed;
            };
          } else {
            button.iif = (row: UploadedFile) => {
              return this.showDataChecks(row) && this.dataDrivenExecutable(row) && !row.is_removed;
            };
          }
        }
        
        // Handle download button
        if (button.icon === 'cloud_download' || button.text === 'cloud_download') {
          this.log.msg('4', 'Found download button, ensuring correct handler', 'Init');
          const originalClick = button.click;
          button.click = (file: UploadedFile) => {
            this.onDownloadFile(file);
          };
          
          // Ensure the button is not shown for removed files
          if (button.iif) {
            const originalIif = button.iif;
            button.iif = (row: UploadedFile) => {
              return originalIif(row) && !row.is_removed;
            };
          } else {
            button.iif = (row: UploadedFile) => {
              return row.status === 'Done' && !row.is_removed;
            };
          }
        }
        
        // Handle delete button
        if (button.icon === 'delete' || button.text === 'delete') {
          this.log.msg('4', 'Found delete button, ensuring correct handler', 'Init');
          const originalClick = button.click;
          button.click = (file: UploadedFile) => {
            this.onDeleteFile(file);
          };
          
          // Ensure the button is not shown for removed files
          if (button.iif) {
            const originalIif = button.iif;
            button.iif = (row: UploadedFile) => {
              return originalIif(row) && !row.is_removed;
            };
          } else {
            button.iif = (row: UploadedFile) => !row.is_removed;
          }
        }
        
        // Handle schedule button
        if (button.icon === 'schedule' || button.text === 'schedule') {
          this.log.msg('4', 'Found schedule button, ensuring correct handler', 'Init');
          const originalClick = button.click;
          button.click = (file: UploadedFile) => {
            // Always use our own handler to ensure we can update colors
            this.openScheduleDialog(file);
          };
          // Remove default color so icon is gray unless CSS class applies
          if (button.color) {
            delete (button as any).color;
          }
        }
      });
    }
    
    // --- Status Column Logic (New) ---
    const statusColumn = this.fileColumns.find(col => col.field === 'status');
    if (statusColumn) {
      this.log.msg('4', 'Updating status column formatter and class for custom columns', 'Init');
      // Apply formatter for deleted status and uploading status
      statusColumn.formatter = (rowData: UploadedFile) => {
        if (rowData.is_removed) {
          // Use HTML directly to apply the class to the text
          return `<span class="status-deleted">Deleted</span>`;
        }
        if (rowData.status === 'Uploading') {
          // Show a spinner with uploading text for better UX
          return `<span class="status-uploading"><i class="material-icons status-spinner">autorenew</i> Uploading...</span>`;
        }
        if (rowData.status === 'Scanning') {
          // Show a spinner with scanning text
          return `<span class="status-scanning"><i class="material-icons status-spinner">autorenew</i> Scanning...</span>`;
        }
        if (rowData.status === 'Encrypting') {
          // Show a spinner with encrypting text
          return `<span class="status-encrypting"><i class="material-icons status-spinner">autorenew</i> Encrypting...</span>`;
        }
        return rowData.status;
      };
      
      // Apply class for deleted status and expandability
      statusColumn.class = (rowData: UploadedFile, colDef?: MtxGridColumn) => {
        if (rowData.is_removed) {
          return 'status-deleted-cell'; // Class for the cell itself
        }
        if (rowData?.status !== 'Done') {
          return 'no-expand';
        }
        // Check expandability for non-deleted files (similar to initializeFileColumns)
        const name = (rowData?.name ?? '').toLowerCase();
        const extOk = name.endsWith('.csv') || name.endsWith('.xls') || name.endsWith('.xlsx');
        // Use showDataChecks to determine if the row *could* be expandable
        const canExpand = this.showDataChecks(rowData) && extOk;
        return canExpand ? '' : 'no-expand'; // Apply no-expand if needed
      };
      
      // Ensure showExpand is true if it wasn't explicitly set to false by parent
      if (statusColumn.showExpand !== false) {
        statusColumn.showExpand = true;
      }
    }
  }

  // Update displayFiles when department changes
  ngOnChanges(changes: SimpleChanges): void {
    if (changes.department) {
      // When department changes, update internal lists and re-apply search
      this._updateInternalFileLists();
      
      // Check schedule status for new department files if datadriven
      if (this.file_type === 'datadriven' && this.displayFiles.length > 0) {
        setTimeout(() => {
          this.checkAllFileSchedules();
        }, 100);
      }
    }
    // Ensure columns are initialized or updated if they change
    if (changes.fileColumns && !changes.fileColumns.firstChange) {
        if (!this.fileColumns || this.fileColumns.length === 0) {
            this.initializeFileColumns();
        } else {
            this.ensureActionButtonsUseComponentMethods();
             const statusColumn = this.fileColumns.find(col => col.field === 'status');
            if (statusColumn) {
                statusColumn.showExpand = true;
                statusColumn.class = (rowData: UploadedFile, colDef?: MtxGridColumn) => {
                    if (rowData.status !== 'Done' || rowData.is_removed) {
                        return 'no-expand';
                    }
                    const name = (rowData?.name ?? '').toLowerCase();
                    const extOk = name.endsWith('.csv') || name.endsWith('.xls') || name.endsWith('.xlsx');
                    return this.showDataChecks(rowData) && extOk ? '' : 'no-expand';
                };
            }
        }
        this.loadColumnVisibilitySettings(); // Reload column settings if columns input changes
    }
  }

  // Row actions methods
  addRowAbove(fileId: number, rowIndex: number): void {
    if (!this.file_data[fileId] || !this.file_data[fileId].file_data) {
      this.log.msg('2', 'Cannot add row, file data not found', 'AddRow');
      return;
    }
    
    // Create an empty row matching the structure of existing rows
    const emptyRow = {};
    const columns = this.file_data[fileId].columns || [];
    
    // Skip the first column (Row Number column)
    for (let i = 1; i < columns.length; i++) {
      const column = columns[i];
      if (column.field) {
        emptyRow[column.field] = '';
      }
    }
    
    // If we have a fullDataset (dirty file), work with that and the visible data
    if (this.file_data[fileId].fullDataset) {
      // Calculate the actual index in the full dataset
      const pageIndex = this.file_data[fileId].params?.page || 0;
      const pageSize = this.file_data[fileId].params?.size || 10;
      const actualIndex = (pageIndex * pageSize) + rowIndex;
      
      // Add to full dataset
      const newFullData = [...this.file_data[fileId].fullDataset];
      newFullData.splice(actualIndex, 0, emptyRow);
      this.file_data[fileId].fullDataset = newFullData;
      this.file_data[fileId].total = newFullData.length;
      
      // Re-apply pagination to update visible data
      this._applyClientSidePagination(fileId);
    } else {
      // Standard behavior - either not dirty yet, or not paginated
      const newFileData = [...this.file_data[fileId].file_data];
      newFileData.splice(rowIndex, 0, emptyRow);
      this.file_data[fileId].file_data = newFileData;
      
             // Update total if not paginated
       if (!this.file_data[fileId].showPagination) {
         this.file_data[fileId].total = newFileData.length;
       } else {
         // For paginated files, we need to increment the total count
         this.file_data[fileId].total = (this.file_data[fileId].total || 0) + 1;
       }
      
      // Refresh row numbers for Excel-style display
      this._refreshRowNumbers(fileId);
      
      // Force UI update
      this.file_data = {...this.file_data};
      this.cdRef.detectChanges();
    }
    
    // Mark as dirty
    this.isDirty[fileId] = true;
    
    this.log.msg('4', `Added row above index ${rowIndex} in file ${fileId}`, 'AddRow');
  }
  
  addRowBelow(fileId: number, rowIndex: number): void {
    if (!this.file_data[fileId] || !this.file_data[fileId].file_data) {
      this.log.msg('2', 'Cannot add row, file data not found', 'AddRow');
      return;
    }
    
    // Create an empty row matching the structure of existing rows
    const emptyRow = {};
    const columns = this.file_data[fileId].columns || [];
    
    // Skip the first column (Row Number column)
    for (let i = 1; i < columns.length; i++) {
      const column = columns[i];
      if (column.field) {
        emptyRow[column.field] = '';
      }
    }
    
    // If we have a fullDataset (dirty file), work with that and the visible data
    if (this.file_data[fileId].fullDataset) {
      // Calculate the actual index in the full dataset
      const pageIndex = this.file_data[fileId].params?.page || 0;
      const pageSize = this.file_data[fileId].params?.size || 10;
      const actualIndex = (pageIndex * pageSize) + rowIndex + 1;
      
      // Add to full dataset
      const newFullData = [...this.file_data[fileId].fullDataset];
      newFullData.splice(actualIndex, 0, emptyRow);
      this.file_data[fileId].fullDataset = newFullData;
      this.file_data[fileId].total = newFullData.length;
      
      // Re-apply pagination to update visible data
      this._applyClientSidePagination(fileId);
    } else {
      // Standard behavior - either not dirty yet, or not paginated
      const newFileData = [...this.file_data[fileId].file_data];
      newFileData.splice(rowIndex + 1, 0, emptyRow);
      this.file_data[fileId].file_data = newFileData;
      
      // Update total count
      if (!this.file_data[fileId].showPagination) {
        this.file_data[fileId].total = newFileData.length;
      } else {
        // For paginated files, increment the total count
        this.file_data[fileId].total = (this.file_data[fileId].total || 0) + 1;
      }
      
      // Refresh row numbers for Excel-style display
      this._refreshRowNumbers(fileId);
      
      // Force UI update
      this.file_data = {...this.file_data};
      this.cdRef.detectChanges();
    }
    
    // Mark as dirty
    this.isDirty[fileId] = true;
    
    this.log.msg('4', `Added row below index ${rowIndex} in file ${fileId}`, 'AddRow');
  }

  cloneRow(fileId: number, rowIndex: number): void {
    if (!this.file_data[fileId] || !this.file_data[fileId].file_data) {
      this.log.msg('2', 'Cannot clone row, file data not found', 'CloneRow');
      return;
    }
    
    // Get the source row to clone
    const sourceRow = this.file_data[fileId].file_data[rowIndex];
    if (!sourceRow) {
      this.log.msg('2', 'Cannot clone row, source row not found', 'CloneRow');
      return;
    }
    
    // Create a deep copy of the source row (excluding rowNumber and _rowIndex)
    const clonedRow = {};
    Object.keys(sourceRow).forEach(key => {
      if (key !== 'rowNumber' && key !== '_rowIndex') {
        clonedRow[key] = sourceRow[key];
      }
    });
    
    // If we have a fullDataset (dirty file), work with that and the visible data
    if (this.file_data[fileId].fullDataset) {
      // Calculate the actual index in the full dataset
      const pageIndex = this.file_data[fileId].params?.page || 0;
      const pageSize = this.file_data[fileId].params?.size || 10;
      const actualIndex = (pageIndex * pageSize) + rowIndex + 1;
      
      // Add to full dataset
      const newFullData = [...this.file_data[fileId].fullDataset];
      newFullData.splice(actualIndex, 0, clonedRow);
      this.file_data[fileId].fullDataset = newFullData;
      this.file_data[fileId].total = newFullData.length;
      
      // Re-apply pagination to update visible data
      this._applyClientSidePagination(fileId);
    } else {
      // Standard behavior - either not dirty yet, or not paginated
      const newFileData = [...this.file_data[fileId].file_data];
      newFileData.splice(rowIndex + 1, 0, clonedRow);
      this.file_data[fileId].file_data = newFileData;
      
      // Update total count
      if (!this.file_data[fileId].showPagination) {
        this.file_data[fileId].total = newFileData.length;
      } else {
        // For paginated files, increment the total count
        this.file_data[fileId].total = (this.file_data[fileId].total || 0) + 1;
      }
      
      // Refresh row numbers for Excel-style display
      this._refreshRowNumbers(fileId);
      
      // Force UI update
      this.file_data = {...this.file_data};
      this.cdRef.detectChanges();
    }
    
    // Mark as dirty
    this.isDirty[fileId] = true;
    
    this.log.msg('4', `Cloned row at index ${rowIndex} in file ${fileId}`, 'CloneRow');
  }
  
  deleteRow(fileId: number, rowIndex: number): void {
    if (!this.file_data[fileId] || !this.file_data[fileId].file_data) {
      this.log.msg('2', 'Cannot delete row, file data not found', 'DeleteRow');
      return;
    }
    
    // Check total row count (use fullDataset if available, otherwise current data)
    const totalRows = this.file_data[fileId].fullDataset ? 
      this.file_data[fileId].fullDataset.length : 
      this.file_data[fileId].file_data.length;
    
    // Don't delete if it's the last row
    if (totalRows <= 1) {
      this._snackBar.open('Cannot delete the last row', 'Close', {
        duration: 3000,
        panelClass: ['file-management-custom-snackbar']
      });
      return;
    }
    
    // If we have a fullDataset (dirty file), work with that and the visible data
    if (this.file_data[fileId].fullDataset) {
      // Calculate the actual index in the full dataset
      const pageIndex = this.file_data[fileId].params?.page || 0;
      const pageSize = this.file_data[fileId].params?.size || 10;
      const actualIndex = (pageIndex * pageSize) + rowIndex;
      
      // Remove from full dataset
      const newFullData = [...this.file_data[fileId].fullDataset];
      newFullData.splice(actualIndex, 1);
      this.file_data[fileId].fullDataset = newFullData;
      this.file_data[fileId].total = newFullData.length;
      
      // Re-apply pagination to update visible data
      this._applyClientSidePagination(fileId);
    } else {
      // Standard behavior - either not dirty yet, or not paginated
      const newFileData = [...this.file_data[fileId].file_data];
      newFileData.splice(rowIndex, 1);
      this.file_data[fileId].file_data = newFileData;
      
      // Update total count
      if (!this.file_data[fileId].showPagination) {
        this.file_data[fileId].total = newFileData.length;
      } else {
        // For paginated files, decrement the total count
        this.file_data[fileId].total = Math.max(0, (this.file_data[fileId].total || 0) - 1);
      }
      
      // Refresh row numbers for Excel-style display
      this._refreshRowNumbers(fileId);
      
      // Force UI update
      this.file_data = {...this.file_data};
      this.cdRef.detectChanges();
    }
    
    // Mark as dirty
    this.isDirty[fileId] = true;
    
    this.log.msg('4', `Deleted row at index ${rowIndex} from file ${fileId}`, 'DeleteRow');
  }

  /**
   * Handles all keydown events on the input field
   * @param event The keyboard event
   * @param fileId The file ID
   * @param rowIndex The current row index
   * @param columnField The current column field name
   */
  handleKeyDown(event: KeyboardEvent, fileId: number, rowIndex: number, columnField: string): void {
    // Only act on Tab key
    if (event.key === 'Tab') {
      this.log.msg('4', `Tab navigation: ${event.shiftKey ? 'backward' : 'forward'} from (${rowIndex}, ${columnField})`, 'Tab');
      
      // Call the moveToNextCell method for navigation
      this.moveToNextCell(fileId, rowIndex, columnField, event);
    }
  }

  /**
   * Moves to the next cell when pressing tab
   * @param fileId The file ID
   * @param rowIndex The current row index
   * @param columnField The current column field name
   * @param event The keyboard event
   */
  moveToNextCell(fileId: number, rowIndex: number, columnField: string, event: KeyboardEvent): void {
    // Prevent default tab behavior
    event.preventDefault();
    
    // First save the current edit
    this.saveEdit(fileId, rowIndex, columnField);
    
    // Get the columns and data for this file
    const fileData = this.file_data[fileId];
    if (!fileData || !fileData.columns || !fileData.file_data) {
      this.log.msg('2', 'Cannot navigate between cells, file data not found', 'Tab');
      return;
    }
    
    // Get editable columns (exclude row number column)
    const allColumns = fileData.columns;
    const editableColumns = allColumns.filter(col => col.field !== 'rowNumber');
    
    // Find the current editable column index
    let currentEditableColIndex = editableColumns.findIndex(col => col.field === columnField);
    
    if (currentEditableColIndex === -1) {
      this.log.msg('2', `Column field ${columnField} not found in editable columns`, 'Tab');
      return;
    }
    
    // Calculate the next editable column index based on direction
    let nextEditableColIndex;
    let nextRowIndex = rowIndex;
    
    if (event.shiftKey) {
      // Move backward (SHIFT+TAB)
      this.log.msg('4', 'SHIFT+TAB - Moving backward', 'Tab');
      nextEditableColIndex = currentEditableColIndex - 1;
      
      // If we're at the first editable column, move to the last editable column of the previous row
      if (nextEditableColIndex < 0) {
        nextRowIndex = rowIndex - 1;
        
        // If we're at the first row, wrap to the last row
        if (nextRowIndex < 0) {
          nextRowIndex = fileData.file_data.length - 1;
        }
        
        nextEditableColIndex = editableColumns.length - 1;
      }
    } else {
      // Move forward (TAB)
      this.log.msg('4', 'TAB - Moving forward', 'Tab');
      nextEditableColIndex = currentEditableColIndex + 1;
      
      // If we're at the last editable column, move to the first editable column of the next row
      if (nextEditableColIndex >= editableColumns.length) {
        nextRowIndex = rowIndex + 1;
        
        // If we're at the last row, wrap to the first row
        if (nextRowIndex >= fileData.file_data.length) {
          nextRowIndex = 0;
        }
        
        nextEditableColIndex = 0;
      }
    }
    
    // Get the next column to edit
    const nextColumn = editableColumns[nextEditableColIndex];
    if (!nextColumn) {
      this.log.msg('2', 'Next column not found', 'Tab');
      return;
    }
    
    this.log.msg('4', `Next cell to edit: (${nextRowIndex}, ${nextColumn.field})`, 'Tab');
    
    // Ensure we have data for the next row
    if (nextRowIndex < 0 || nextRowIndex >= fileData.file_data.length) {
      this.log.msg('2', 'Next row is out of bounds', 'Tab');
      return;
    }
    
    // Start editing the next cell after a short delay to allow DOM to update
    setTimeout(() => {
      const cellValue = fileData.file_data[nextRowIndex][nextColumn.field];
      this.startEdit(fileId, nextRowIndex, nextColumn.field, cellValue);
    }, 10);
  }

  toggleShowRemovedFiles(): void {
    this.showRemovedFiles = !this.showRemovedFiles;
    this._updateInternalFileLists(); // Update lists and re-apply search
  }
  
  private updateDisplayFiles(): void {
    this._updateInternalFileLists();
  }

  // New methods for search functionality
  private _updateInternalFileLists(): void {
    if (!this.department || !this.department.files) {
      this.allCurrentlyRelevantFiles = [];
    } else {
      
      // First filter by removal status
      let filteredFiles = this.showRemovedFiles 
        ? [...this.department.files]
        : this.department.files.filter(file => !file.is_removed);
      
      // Also filter out files that are in the deletingFileIds (globally deleted)
      if (!this.showRemovedFiles && this.deletingFileIds.size > 0) {
        filteredFiles = filteredFiles.filter(file => !this.deletingFileIds.has(file.id));
      }
      
      
      // Then filter by file_type if specified
      if (this.file_type) {
        filteredFiles = filteredFiles.filter(file => 
          // Handle existing files that might not have file_type property
          !file.file_type || file.file_type === this.file_type
        );
      }
      
      this.allCurrentlyRelevantFiles = filteredFiles;
    }
    this._applySearchFilter();
  }

  private _applySearchFilter(): void {
    if (!this.fileSearchTerm) {
      this.displayFiles = [...this.allCurrentlyRelevantFiles];
    } else {
      const searchTermLower = this.fileSearchTerm.toLowerCase();
      this.displayFiles = this.allCurrentlyRelevantFiles.filter(file =>
        file.name.toLowerCase().includes(searchTermLower) || file.uploadPath.toLowerCase().includes(searchTermLower)
        || file.id.toString().includes(searchTermLower) || file.uploaded_by?.name.toLowerCase().includes(searchTermLower)
      );
    }
    this.cdRef.markForCheck();
  }

  onSearchTermChange(): void {
    this.searchTerms.next(this.fileSearchTerm);
  }

  clearFileSearch(): void {
    this.fileSearchTerm = '';
    this._applySearchFilter();
  }

  onSearchInputFocus(): void {
    this.searchInputFocused = true;
    this.searchFocusChange.emit(true);
  }

  onSearchInputBlur(): void {
    this.searchInputFocused = false;
    this.searchFocusChange.emit(false);
  }
  
  // Method to save column visibility settings for the main grid
  saveColumnVisibilitySettings(event: any): void {
    this.log.msg('4', 'Saving column visibility settings to localStorage', 'ColumnVisibility');
    
    // Store column visibility state
    if (event && Array.isArray(event)) {
      localStorage.setItem('co_file_columns_selection', JSON.stringify(event));
        event.forEach(eventColumn => {
        // Find the corresponding column in fileColumns
        const column = this.fileColumns.find(col => col.field === eventColumn.field);
        if (column) {
          // Update the hide property based on the event
          column.hide = !eventColumn.show;
        }
      });
      
      this.cdRef.markForCheck();
    }
  }

  loadColumnVisibilitySettings(): void {
    this.log.msg('4', 'Loading column visibility settings from localStorage', 'ColumnVisibility');
    
    // Get saved column settings
    const savedColumns = localStorage.getItem('co_file_columns_selection');
    if (savedColumns) {
      try {
        const columnSettings = JSON.parse(savedColumns);
        
        // Apply saved column visibility to current fileColumns
        if (Array.isArray(columnSettings) && this.fileColumns && this.fileColumns.length > 0) {
          columnSettings.forEach(savedColumn => {
            // Find the corresponding column in fileColumns
            const column = this.fileColumns.find(col => col.field === savedColumn.field);
            if (column) {
              column.hide = !savedColumn.show;
            }
          });
          
          this.log.msg('4', 'Applied saved column visibility settings', 'ColumnVisibility');
        }
      } catch (error) {
        this.log.msg('2', 'Failed to parse saved column visibility settings', 'ColumnVisibility', error);
      }
    } else {
      this.log.msg('4', 'No saved column visibility settings found', 'ColumnVisibility');
    }
  }

  saveNestedColumnVisibilitySettings(event: any, fileId: number): void {
    this.log.msg('4', `Saving nested column visibility settings for file ${fileId} to localStorage`, 'ColumnVisibility');
    
    // Store column visibility state for this specific file
    if (event && Array.isArray(event) && fileId) {
      // Save columns with visibility settings using file-specific key
      localStorage.setItem(`co_file_data_columns_${fileId}`, JSON.stringify(event));
      
      // Update file_data column settings with new visibility
      if (this.file_data[fileId] && this.file_data[fileId].columns) {
        event.forEach(eventColumn => {
          // Find the corresponding column in file_data columns
          const column = this.file_data[fileId].columns.find(col => col.field === eventColumn.field);
          if (column) {
            // Update the hide property based on the event
            column.hide = !eventColumn.show;
          }
        });
        
        // Refresh reference for change detection
        this.file_data[fileId].columns = [...this.file_data[fileId].columns];
      }
    }
  }

  loadNestedColumnVisibilitySettings(fileId: number): void {
    this.log.msg('4', `Loading nested column visibility settings for file ${fileId} from localStorage`, 'ColumnVisibility');
    
    // Get saved column settings for this specific file
    const savedColumns = localStorage.getItem(`co_file_data_columns_${fileId}`);
    if (savedColumns && this.file_data[fileId] && this.file_data[fileId].columns) {
      try {
        const columnSettings = JSON.parse(savedColumns);
        
        // Apply saved column visibility to current file_data columns
        if (Array.isArray(columnSettings)) {
          columnSettings.forEach(savedColumn => {
            // Find the corresponding column in file_data columns
            const column = this.file_data[fileId].columns.find(col => col.field === savedColumn.field);
            if (column) {
              // Apply the visibility setting
              column.hide = !savedColumn.show;
            }
          });
          
          this.log.msg('4', `Applied saved nested column visibility settings for file ${fileId}`, 'ColumnVisibility');
        }
      } catch (error) {
        this.log.msg('2', `Failed to parse saved nested column visibility settings for file ${fileId}`, 'ColumnVisibility', error);
      }
    }
  }

  // Add method to check if a file is an Excel file
  isExcelFile(filename: string): boolean {
    if (!filename) return false;
    const lowerName = filename.toLowerCase();
    return lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx');
  }

  // Update the switchSheet method to save the selected sheet to localStorage
  switchSheet(fileId: number, sheetName: string): void {
    if (!this.file_data[fileId] || !this.file_data[fileId].sheets) {
      this.log.msg('2', `Cannot switch sheet, file data or sheets not found for file ${fileId}`, 'Sheets');
      return;
    }

    // Only switch if it's a different sheet
    if (this.file_data[fileId].sheets.current !== sheetName) {
      this.log.msg('4', `Switching sheet for file ${fileId} from ${this.file_data[fileId].sheets.current} to ${sheetName}`, 'Sheets');
      
      // Show loading state immediately for better UX
      this.file_data[fileId].isLoading = true;
      this.cdRef.detectChanges();
      
      // Store current page size to preserve it when switching
      const currentPageSize = this.file_data[fileId].params?.size || 10;
      
      // Update the current sheet
      this.file_data[fileId].sheets.current = sheetName;
      
      // Save selected sheet to localStorage
      localStorage.setItem(`co_excel_sheet_${fileId}`, sheetName);
      this.log.msg('4', `Saved current sheet '${sheetName}' to localStorage for file ${fileId}`, 'Sheets');
      
      // If there are unsaved changes, show a confirmation dialog
      if (this.isDirty[fileId]) {
        const snackBarRef = this._snackBar.open(
          'You have unsaved changes. Do you want to save them before switching sheets?', 
          'Save Changes', 
          {
            duration: 8000,
            panelClass: ['file-management-custom-snackbar']
          }
        );
        
        // Handle user's choice
        snackBarRef.onAction().subscribe(() => {
          // Save changes before switching
          this.saveAllChanges(fileId).then(() => {
            this.proceedWithSheetSwitch(fileId, sheetName, currentPageSize);
          }).catch((error) => {
            this.log.msg('2', `Failed to save changes before sheet switch: ${error}`, 'Sheets');
            // Still proceed with sheet switch even if save failed
            this.proceedWithSheetSwitch(fileId, sheetName, currentPageSize);
          });
        });
        
        // If user dismisses without saving, proceed with sheet switch
        snackBarRef.afterDismissed().subscribe((dismissedWithAction) => {
          if (!dismissedWithAction.dismissedByAction) {
            this.proceedWithSheetSwitch(fileId, sheetName, currentPageSize);
          }
        });
      } else {
        // No unsaved changes, proceed directly
        this.proceedWithSheetSwitch(fileId, sheetName, currentPageSize);
      }
    } else {
      this.log.msg('4', `Already on sheet '${sheetName}' for file ${fileId}, no need to switch`, 'Sheets');
    }
  }
  
  // New helper method to handle the actual sheet switch
  private proceedWithSheetSwitch(fileId: number, sheetName: string, preservedPageSize: number): void {
    // Find the original file to reload data
    const file = this.department?.files?.find(f => f.id === fileId);
    if (file) {
      // Preserve pagination settings for better UX
      if (this.file_data[fileId].params) {
        this.file_data[fileId].params.page = 0; // Reset to first page
        this.file_data[fileId].params.size = preservedPageSize; // Preserve page size
      }
      
      // Create a copy of the file object to avoid modifying the store directly
      // This prevents the "Cannot add property selectedSheet, object is not extensible" error
      const fileCopy = { ...file, selectedSheet: sheetName };
      
      // Reload the file data with the new sheet
      this.getFileData(fileCopy);
    } else {
      this.log.msg('2', `Cannot find original file with ID ${fileId} to reload sheet data`, 'Sheets');
      // Remove loading state if we can't proceed
      this.file_data[fileId].isLoading = false;
      this.cdRef.detectChanges();
    }
  }
  

  // Add helper to get sheet names for a file
  getSheetNames(fileId: number): string[] {
    // If sheet names are loaded, return them
    if (this.file_data[fileId]?.sheets?.names?.length > 0) {
      return this.file_data[fileId].sheets.names;
    }
    // Otherwise return a default sheet name so the UI is always visible
    return ['Sheet1'];
  }

  // Add helper to get current sheet for a file
  getCurrentSheet(fileId: number): string {
    return this.file_data[fileId]?.sheets?.current || 'Sheet1';
  }
  
  // Clear file error message
  clearFileError(fileId: number): void {
    if (this.file_data[fileId]) {
      delete this.file_data[fileId].error;
      this.cdRef.markForCheck();
    }
  }
  
  // Get dynamic loading message based on context
  getLoadingMessage(fileId: number): string {
    if (!this.file_data[fileId]) {
      return 'Loading file data...';
    }
    
    const fileData = this.file_data[fileId];
    
    // Check if we're switching sheets
    if (fileData.sheets && fileData.sheets.current) {
      return `Loading sheet "${fileData.sheets.current}"...`;
    }
    
    // Check if we're saving
    if (this.isDirty[fileId] && fileData.isLoading) {
      return 'Saving changes...';
    }
    
    // Default message
    return 'Loading file data...';
  }

  // Helper function to convert number to Excel-style column letter (1=A, 26=Z, 27=AA, etc.)
  private getExcelColumnName(index: number): string {
    let columnName = '';
    while (index > 0) {
      const modulo = (index - 1) % 26;
      columnName = String.fromCharCode(65 + modulo) + columnName;
      index = Math.floor((index - modulo) / 26);
    }
    return columnName;
  }

  // Process file data and add Excel-style row numbers and column letters
  private processFileDataForExcel(fileId: number, fetchedData: any[], columns: MtxGridColumn[]): void {
    if (!fetchedData || !columns) return;
    
    this.log.msg('4', `Adding Excel-style row numbers and column letters for file ${fileId}`, 'Excel');
    
    // Add row number column as the first column
    const rowNumberColumn: MtxGridColumn = {
      header: '#',
      field: 'rowNumber',
      width: '60px',
      sortable: false,
      formatter: (rowData: any, colDef?: MtxGridColumn) => {
        // For paginated data, we need to account for the current page
        const pageIndex = this.file_data[fileId]?.params?.page || 0;
        const pageSize = this.file_data[fileId]?.params?.size || 10;
        const startRowNumber = pageIndex * pageSize;
        
        // Return 1-based row number adjusted for pagination
        // Use rowData._rowIndex which we set below instead of the rowIndex parameter
        const rowIndex = rowData._rowIndex !== undefined ? 
          (rowData._rowIndex - startRowNumber) : 
          (this.file_data[fileId]?.data?.indexOf(rowData) || 0);
        
        return `${startRowNumber + rowIndex + 1}`;
      },
      class: 'excel-row-number'
    };
    
    // Add row number column as first column
    columns.unshift(rowNumberColumn);
    
    // Add row numbers to the data
    const pageIndex = this.file_data[fileId]?.params?.page || 0;
    const pageSize = this.file_data[fileId]?.params?.size || 10;
    const startRowNumber = pageIndex * pageSize;
    
    fetchedData.forEach((row, idx) => {
      // Store both display row number (1-based) and actual row index for reference
      row.rowNumber = startRowNumber + idx + 1; // 1-based row numbers like Excel
      row._rowIndex = startRowNumber + idx; // 0-based index for internal reference
    });
  }

  addColumnLeft(): void {
    if (this.contextMenuFileId == null || !this.contextMenuColumnField) return;
    this.promptAndAddColumn(this.contextMenuFileId, this.contextMenuColumnField, 'left');
  }

  addColumnRight(): void {
    if (this.contextMenuFileId == null || !this.contextMenuColumnField) return;
    this.promptAndAddColumn(this.contextMenuFileId, this.contextMenuColumnField, 'right');
  }

  /** Opens a dialog to ask for the new column name and then adds the column */
  private promptAndAddColumn(fileId: number, referenceField: string, position: 'left' | 'right'): void {
    const dialogRef = this._dialog.open(AddColumnNameDialogComponent, {
      width: '320px',
      data: { title: 'Add Column', placeholder: 'Column Name' },
      panelClass: 'no-resize-dialog'
    });

    dialogRef.afterClosed().pipe(take(1)).subscribe((name: string | undefined) => {
      if (name && name.trim()) {
        this._addColumn(fileId, referenceField, position, name.trim());
      }
    });
  }

  private _addColumn(fileId: number, referenceField: string, position: 'left' | 'right', name: string): void {
    const fileDatum = this.file_data[fileId];
    if (!fileDatum || !fileDatum.columns) {
      this.log.msg('2', 'Cannot add column – file data missing', 'AddColumn');
      return;
    }

    // Sanitize and validate column name
    const sanitizedName = this._sanitizeColumnName(name);
    if (!sanitizedName) {
      this._snackBar.open('Invalid column name. Use only letters, numbers, spaces, and basic punctuation.', 'Close', {
        duration: 5000,
        panelClass: ['file-management-custom-snackbar']
      });
      return;
    }

    // Snapshot columns before modification (once)
    if (!this.original_columns[fileId]) {
      this.original_columns[fileId] = fileDatum.columns
        .filter(col => col.field !== 'actions')
        .map(col => ({ ...col }));
    }

    const refIndex = fileDatum.columns.findIndex(c => c.field === referenceField);
    if (refIndex === -1) {
      this.log.msg('2', 'Reference column not found', 'AddColumn', referenceField);
      return;
    }

    const insertIndex = position === 'left' ? refIndex : refIndex + 1;

    // Create field name using backend logic (lowercase with underscores)
    // but keep the original name as the display header
    let baseName = sanitizedName.toLowerCase().replace(/\s+/g, '_');
    if (!baseName) {
      baseName = 'new_column';
    }
    let uniqueField = baseName;
    let suffix = 1;
    while (fileDatum.columns.some(col => col.field === uniqueField)) {
      uniqueField = `${baseName}_${suffix++}`;
    }

    // Use the processed name as both header and field for consistency in the UI
    const newColumn: MtxGridColumn = {
      header: uniqueField,  // Use processed name as header for consistent UI display
      field: uniqueField,   // Use processed name as field for data consistency
      sortable: true,
      cellTemplate: this.dynamicEditableCellTpl,
      class: `file-${fileId}`
    };

    fileDatum.columns.splice(insertIndex, 0, newColumn);
    fileDatum.columns = [...fileDatum.columns];

    // add property to each row
    fileDatum.file_data.forEach(row => {
      row[uniqueField] = '';
    });

    this.isDirty[fileId] = true;
    this.log.msg('4', `Added column '${name}' (field: '${uniqueField}') ${position} of ${referenceField} in file ${fileId}`, 'AddColumn');
    this.cdRef.markForCheck();
  }

  // Add helper method to refresh row numbers for Excel-style display
  private _refreshRowNumbers(fileId: number): void {
    if (!this.file_data[fileId] || !this.file_data[fileId].file_data) {
      this.log.msg('2', 'Cannot refresh row numbers, file data not found', 'RefreshRowNumbers');
      return;
    }
    
    const pageIndex = this.file_data[fileId].params?.page || 0;
    const pageSize = this.file_data[fileId].params?.size || 10;
    const startRowNumber = pageIndex * pageSize;
    
    this.file_data[fileId].file_data.forEach((row, idx) => {
      row.rowNumber = startRowNumber + idx + 1; // 1-based row numbers like Excel
      row._rowIndex = startRowNumber + idx; // 0-based index for internal reference
    });
  }

  /**
   * Applies client-side pagination when the file has dirty changes.
   * This avoids losing changes by paginating the local dataset instead of fetching from server.
   */
  private _applyClientSidePagination(fileId: number): void {
    if (!this.file_data[fileId] || !this.file_data[fileId].file_data) {
      return;
    }

    const pageIndex = this.file_data[fileId].params?.page || 0;
    const pageSize = this.file_data[fileId].params?.size || 10;
    
    
    // For dirty files, we need to store the full dataset separately and paginate it client-side
    // First, check if we have the full dataset stored
    if (!this.file_data[fileId].fullDataset) {
      
      // Check if we have all the data or just a paginated subset
      const hasAllData = !this.file_data[fileId].showPagination || 
                       (this.file_data[fileId].total === this.file_data[fileId].file_data.length);
      
      if (hasAllData) {
        // We have all the data, safe to create fullDataset
        this.file_data[fileId].fullDataset = [...this.file_data[fileId].file_data];
        this.file_data[fileId].total = this.file_data[fileId].file_data.length;
      } else {
        // We only have partial data due to pagination, can't implement client-side pagination properly
        // Fall back to keeping the existing behavior but warn about potential data loss
        
        // For now, we'll create fullDataset from current data, but this might lose changes on other pages
        this.file_data[fileId].fullDataset = [...this.file_data[fileId].file_data];
        // Don't update total since we know we don't have complete data
      }
    }
    
    const fullData = this.file_data[fileId].fullDataset;
    const startIndex = pageIndex * pageSize;
    const endIndex = startIndex + pageSize;
    
    
    // Slice the full dataset for the current page
    const paginatedData = fullData.slice(startIndex, endIndex);
    
    
    // Update the displayed data
    this.file_data[fileId].file_data = paginatedData;
    
    // Refresh row numbers for the paginated data
    this._refreshRowNumbers(fileId);
    
    // Force UI update
    this.file_data = {...this.file_data};
    this.cdRef.detectChanges();
    
  }

  /**
   * Fetches the complete dataset for a dirty file to enable proper client-side pagination.
   * This merges the current changes with the complete server data.
   */
  private _fetchCompleteDatasetForDirtyFile(fileId: number, file: UploadedFile): void {
    if (!this.file_data[fileId]) {
      return;
    }

    const isExcel = this.isExcelFile(file.name);
    const currentSheet = isExcel ? this.getCurrentSheet(fileId) : null;
    
    // Create params to get ALL data for this sheet/file
    const params: any = {
      page: 1,
      size: this.file_data[fileId].total || 1000, // Request all rows
    };
    
    if (isExcel && currentSheet) {
      params.sheet = currentSheet;
    }
    
    
    // Set loading state
    this.file_data[fileId].isLoading = true;
    this.cdRef.markForCheck();
    
    this._http.get(`/api/data_driven/file/${fileId}`, { params })
      .pipe(
        finalize(() => {
          this.file_data[fileId].isLoading = false;
          this.cdRef.markForCheck();
        })
      )
      .subscribe({
        next: (resp: any) => {
          let allData: any[] = [];
          if (resp) {
            if (Array.isArray(resp)) {
              allData = resp;
            } else if (resp.results && Array.isArray(resp.results)) {
              allData = resp.results;
            } else if (resp.data && Array.isArray(resp.data)) {
              allData = resp.data;
            }
          }
          
          const completeData = Array.isArray(allData) ? 
            (allData.length > 0 && allData[0] && allData[0].data ? allData.map((d: any) => d.data) : allData) : 
            [];
          
          // Now we need to merge the changes from the current dirty data into the complete dataset
          this._mergeChangesIntoCompleteDataset(fileId, completeData);
          
          // Now apply pagination with the complete dataset
          this._applyClientSidePagination(fileId);
        },
        error: (error) => {
          this.log.msg('2', 'Error fetching complete dataset for dirty file', 'FetchComplete', error);
          
          // Fall back to basic client-side pagination with limited data
          this._applyClientSidePagination(fileId);
        }
      });
  }

  /**
   * Merges the current dirty changes into the complete dataset fetched from server.
   */
  private _mergeChangesIntoCompleteDataset(fileId: number, completeData: any[]): void {
    const currentPageParams = this.file_data[fileId].params;
    const pageIndex = currentPageParams.page || 0;
    const pageSize = currentPageParams.size || 10;
    const startIdx = pageIndex * pageSize;
    
    // Create a copy of the complete dataset to modify
    const mergedData = [...completeData];
    
    // Apply changes from the current dirty data to the corresponding rows in complete dataset
    const dirtyData = this.file_data[fileId].file_data;
    
    for (let i = 0; i < dirtyData.length; i++) {
      const mergedRowIndex = startIdx + i;
      
      // Only apply if we're within bounds of the complete dataset
      if (mergedRowIndex < mergedData.length) {
        const originalRow = mergedData[mergedRowIndex];
        const dirtyRow = dirtyData[i];
        
        // Merge the dirty row data into the original row
        const allKeys = new Set([
          ...Object.keys(originalRow || {}), 
          ...Object.keys(dirtyRow || {})
        ]);
        
        allKeys.forEach(key => {
          // Skip UI-specific fields
          if (key !== 'rowNumber' && key !== '_rowIndex' && dirtyRow && key in dirtyRow) {
            originalRow[key] = dirtyRow[key];
          }
        });
      } else {
        // This is a new row added beyond the original dataset
        const newRow = {...dirtyData[i]};
        // Remove UI-specific fields
        delete newRow.rowNumber;
        delete newRow._rowIndex;
        mergedData.push(newRow);
      }
    }
    
    // Store the merged dataset as our fullDataset
    this.file_data[fileId].fullDataset = mergedData;
    this.file_data[fileId].total = mergedData.length;
  }

  /** Context menu wrapper to add a row above the selected row */
  addRowAboveContext(): void {
    if (this.contextMenuFileId == null || this.contextMenuRowIndex == null) return;
    this.addRowAbove(this.contextMenuFileId, this.contextMenuRowIndex);
  }

  /** Context menu wrapper to add a row below the selected row */
  addRowBelowContext(): void {
    if (this.contextMenuFileId == null || this.contextMenuRowIndex == null) return;
    this.addRowBelow(this.contextMenuFileId, this.contextMenuRowIndex);
  }

  /** Context menu wrapper to clone the selected row */
  cloneRowContext(): void {
    if (this.contextMenuFileId == null || this.contextMenuRowIndex == null) return;
    this.cloneRow(this.contextMenuFileId, this.contextMenuRowIndex);
  }

  /** Context menu wrapper to delete the selected row */
  deleteRowContext(): void {
    if (this.contextMenuFileId == null || this.contextMenuRowIndex == null) return;
    this.deleteRow(this.contextMenuFileId, this.contextMenuRowIndex);
  }

  /** Context menu wrapper to rename the selected column */
  renameColumnContext(): void {
    if (this.contextMenuFileId == null || !this.contextMenuColumnField) return;
    this._renameColumn(this.contextMenuFileId, this.contextMenuColumnField);
  }

  /** Context menu wrapper to delete the selected column */
  deleteColumnContext(): void {
    if (this.contextMenuFileId == null || !this.contextMenuColumnField) return;
    this._deleteColumn(this.contextMenuFileId, this.contextMenuColumnField);
  }

  /**
   * Deletes a column from the file data and grid definition, with safety checks.
   * @param fileId      The ID of the file whose column should be removed
   * @param field       The field name (column key) to remove
   */
  private _deleteColumn(fileId: number, field: string): void {
    const fileDatum = this.file_data[fileId];
    if (!fileDatum || !fileDatum.columns) {
      this.log.msg('2', 'Cannot delete column – file data missing', 'DeleteColumn');
      return;
    }

    // Prevent deleting special columns
    if (field === 'rowNumber') {
      this._snackBar.open('Cannot delete row number column', 'Close', {
        duration: 3000,
        panelClass: ['file-management-custom-snackbar']
      });
      return;
    }

    // Don't delete if it would leave zero data columns (excluding rowNumber)
    const dataColumns = fileDatum.columns.filter(col => col.field !== 'rowNumber');
    if (dataColumns.length <= 1) {
      this._snackBar.open('Cannot delete the last column', 'Close', {
        duration: 3000,
        panelClass: ['file-management-custom-snackbar']
      });
      return;
    }

    // Snapshot columns before modification (once)
    if (!this.original_columns[fileId]) {
      this.original_columns[fileId] = fileDatum.columns
        .filter(col => col.field !== 'actions')
        .map(col => ({ ...col }));
    }

    // Remove column definition
    const colIndex = fileDatum.columns.findIndex(c => c.field === field);
    if (colIndex === -1) {
      this.log.msg('2', 'Column not found for deletion', 'DeleteColumn', field);
      return;
    }
    fileDatum.columns.splice(colIndex, 1);
    fileDatum.columns = [...fileDatum.columns];

    // Remove property from each row
    fileDatum.file_data.forEach(row => {
      delete row[field];
    });

    this.isDirty[fileId] = true;
    this.log.msg('4', `Deleted column '${field}' from file ${fileId}`, 'DeleteColumn');
    this.cdRef.markForCheck();
  }

  /**
   * Safely clones and cleans data for saving, preserving types where possible
   * @param data The data array to clone and clean
   * @returns Cleaned data array
   */
  private _cloneAndCleanData(data: any[]): any[] {
    try {
      return data.map(row => {
        if (!row || typeof row !== 'object') {
          return {};
        }
        
        // Create a clean object without UI-specific fields
        const cleanRow: any = {};
        
        for (const [key, value] of Object.entries(row)) {
          // Skip UI-specific fields
          if (key === 'rowNumber' || key === '_rowIndex') {
            continue;
          }
          
          // Preserve data types where possible
          if (value === null || value === undefined) {
            cleanRow[key] = value;
          } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            cleanRow[key] = value;
          } else {
            // For complex types, convert to string for safety
            cleanRow[key] = String(value);
          }
        }
        
        return cleanRow;
      });
    } catch (error) {
      this.log.msg('2', 'Failed to clone and clean data, using fallback method', 'SaveData', error);
      // Fallback to simple JSON clone if anything goes wrong
      return JSON.parse(JSON.stringify(data)).map(row => {
        const cleanRow = {...row};
        delete cleanRow.rowNumber;
        delete cleanRow._rowIndex;
        return cleanRow;
      });
    }
  }

  /**
   * Resets file to consistent state after an error
   * @param fileId The file ID to reset
   * @param error The error that occurred
   */
  private _resetFileToConsistentState(fileId: number, error: any): void {
    if (!this.file_data[fileId]) return;
    
    // Stop loading state
    this.file_data[fileId].isLoading = false;
    
    // Clear dirty state and revert to original data if available
    if (this.original_file_data[fileId]) {
      this.file_data[fileId].file_data = JSON.parse(JSON.stringify(this.original_file_data[fileId]));
      this.isDirty[fileId] = false;
    }
    
    // Clear any client-side pagination data
    this._clearFullDataset(fileId);
    
    // Cancel any active editing
    if (this.editingCell && this.editingCell.fileId === fileId) {
      this.cancelEdit();
    }
    
    // Force UI update
    this.cdRef.markForCheck();
    
    this.log.msg('4', `Reset file ${fileId} to consistent state after error`, 'ErrorRecovery');
  }

  /**
   * Safely clears fullDataset and resets memory usage
   * @param fileId The file ID to clear dataset for
   */
  private _clearFullDataset(fileId: number): void {
    if (this.file_data[fileId]?.fullDataset) {
      // Log memory usage for debugging large files
      const datasetSize = this.file_data[fileId].fullDataset.length;
      if (datasetSize > 1000) {
        this.log.msg('4', `Clearing large fullDataset with ${datasetSize} rows for file ${fileId}`, 'Memory');
      }
      
      // Clear the dataset and reset total
      delete this.file_data[fileId].fullDataset;
      this.file_data[fileId].total = this.file_data[fileId].file_data.length;
      
      // Force garbage collection hint (modern browsers)
      if (datasetSize > 5000) {
        try {
          // TypeScript-safe way to access gc() if available
          const anyWindow = window as any;
          if (typeof anyWindow.gc === 'function') {
            anyWindow.gc();
          }
        } catch (e) {
          // gc() is only available in development or with special flags
        }
      }
    }
  }

  /**
   * Sanitizes column names to prevent injection attacks and ensure compatibility
   * @param name The column name to sanitize
   * @returns Sanitized name or empty string if invalid
   */
  private _sanitizeColumnName(name: string): string {
    if (!name || typeof name !== 'string') return '';
    
    // Remove potentially dangerous characters while preserving readability
    // Allow: letters, numbers, spaces, hyphens, underscores, periods, parentheses
    const sanitized = name.replace(/[^a-zA-Z0-9\s\-_().]/g, '').trim();
    
    // Ensure it's not empty and not too long
    if (!sanitized || sanitized.length === 0 || sanitized.length > 50) {
      return '';
    }
    
    // Ensure it doesn't start with a number or special character
    if (!/^[a-zA-Z]/.test(sanitized)) {
      return '';
    }
    
    return sanitized;
  }

  /**
   * Renames a column by updating its header while keeping the same field key
   * @param fileId The ID of the file whose column should be renamed
   * @param field The field name (column key) to rename
   */
  private _renameColumn(fileId: number, field: string): void {
    const fileDatum = this.file_data[fileId];
    if (!fileDatum || !fileDatum.columns) {
      this.log.msg('2', 'Cannot rename column – file data missing', 'RenameColumn');
      return;
    }

    // Prevent renaming special columns
    if (field === 'rowNumber') {
      this._snackBar.open('Cannot rename row number column', 'Close', {
        duration: 3000,
        panelClass: ['file-management-custom-snackbar']
      });
      return;
    }

    // Find the column to rename
    const columnIndex = fileDatum.columns.findIndex(c => c.field === field);
    if (columnIndex === -1) {
      this.log.msg('2', 'Column not found for renaming', 'RenameColumn', field);
      return;
    }

    // Capture snapshot BEFORE modification (once)
    if (!this.original_columns[fileId]) {
      this.original_columns[fileId] = fileDatum.columns
        .filter(col => col.field !== 'actions')
        .map(col => ({ ...col }));
    }

    const currentColumn = fileDatum.columns[columnIndex];
    const currentHeader = currentColumn.header || field;

    // Open dialog with current header name pre-filled
    const dialogRef = this._dialog.open(AddColumnNameDialogComponent, {
      width: '320px',
      data: { 
        title: 'Rename Column', 
        placeholder: 'Column Name',
        currentValue: currentHeader 
      },
      panelClass: 'no-resize-dialog'
    });

    dialogRef.afterClosed().pipe(take(1)).subscribe((newName: string | undefined) => {
      if (newName && newName.trim() && newName.trim() !== currentHeader) {
        const trimmedName = newName.trim();
        
        // Sanitize and validate column name
        const sanitizedName = this._sanitizeColumnName(trimmedName);
        if (!sanitizedName) {
          this._snackBar.open('Invalid column name. Use only letters, numbers, spaces, and basic punctuation.', 'Close', {
            duration: 5000,
            panelClass: ['file-management-custom-snackbar']
          });
          return;
        }
        
        // Convert the new header to a field name (same logic as backend)
        const newFieldName = sanitizedName.toLowerCase().replace(/\s+/g, '_');
        
        // Check if the new field name conflicts with existing fields
        const existingFields = fileDatum.columns.map(col => col.field);
        if (existingFields.includes(newFieldName) && newFieldName !== field) {
          this._snackBar.open(`Column name conflicts with existing field: ${newFieldName}`, 'Close', {
            duration: 5000,
            panelClass: ['file-management-custom-snackbar']
          });
          return;
        }
        
        // Update column definition with new header and field
        const oldColumn = fileDatum.columns[columnIndex];
        fileDatum.columns[columnIndex] = {
          ...oldColumn,
          header: trimmedName,
          field: newFieldName
        };
        
        // Atomic update: prepare all changes first, then apply them all at once
        try {
          // Validate that we can perform the operation on all datasets
          const datasetsToUpdate: any[][] = [fileDatum.file_data];
          if (fileDatum.fullDataset) {
            datasetsToUpdate.push(fileDatum.fullDataset);
          }
          
          // Pre-validate all rows have the field
          for (const dataset of datasetsToUpdate) {
            for (const row of dataset) {
              if (!row.hasOwnProperty(field)) {
                throw new Error(`Field ${field} not found in all rows`);
              }
            }
          }
          
          // If validation passed, perform atomic update
          for (const dataset of datasetsToUpdate) {
            for (const row of dataset) {
              row[newFieldName] = row[field];
              delete row[field];
            }
          }
          
        } catch (error) {
          this.log.msg('2', `Failed to rename column ${field}: ${error}`, 'RenameColumn');
          this._snackBar.open('Failed to rename column. Please try again.', 'Close', {
            duration: 5000,
            panelClass: ['file-management-custom-snackbar']
          });
          return;
        }

        // Efficiently update grid with minimal re-renders
        const updatedColumns = [...fileDatum.columns];
        
        // Use a single update instead of multiple forced renders
        this.file_data[fileId] = {
          ...fileDatum,
          columns: updatedColumns
        };
        
        // Single change detection cycle
        this.cdRef.markForCheck();

        this.isDirty[fileId] = true;
        this.log.msg('4', `Renamed column '${field}' to '${trimmedName}' (field: '${newFieldName}') in file ${fileId}`, 'RenameColumn');
      }
    });
  }

  // Open schedule dialog for a given file
  openScheduleDialog(file: UploadedFile): void {
    const dialogRef = this._dialog.open(EditSchedule, {
      panelClass: EditSchedule.panelClass,
      data: { fileId: file.id }
    });
    
    // Re-check schedule status after dialog closes
    dialogRef.afterClosed().subscribe(() => {
      if (file.id) {
        this.checkFileScheduleStatus(file.id, () => {
          // Update the icon color immediately
          this.updateColumnClasses();
        });
      }
    });
  }
  
  /**
   * Check schedule status for all files using bulk API call
   * Optimized to make single API call instead of individual requests
   */
  private checkAllFileSchedules() {
    if (!this.displayFiles || this.displayFiles.length === 0) {
      return;
    }
    
    // Filter files that need checking (avoid duplicate calls)
    const filesToCheck = this.displayFiles.filter(file => 
      file.id && 
      this.fileScheduleStatus[file.id] === undefined && 
      !this.schedulingInProgress.has(file.id)
    );
    
    if (filesToCheck.length === 0) {
      this.updateColumnClasses();
      return;
    }
    
    
    // Mark files as being processed to avoid duplicate requests
    const fileIds = filesToCheck.map(file => file.id).filter(id => id !== undefined) as number[];
    fileIds.forEach(fileId => {
      this.schedulingInProgress.add(fileId);
    });
    
    // Make single bulk API call
    this.processBulkScheduleCheck(fileIds);
  }
  
  /**
   * Process schedule checks using bulk API call
   */
  private processBulkScheduleCheck(fileIds: number[]) {
    if (fileIds.length === 0) {
      return;
    }
    
    this._api.getBulkFileSchedules(fileIds).subscribe({
      next: (response) => {
        // Mark all files as no longer in progress
        fileIds.forEach(fileId => {
          this.schedulingInProgress.delete(fileId);
        });
        
        if (response.success && response.schedules) {
          // Process each file's schedule data
          Object.entries(response.schedules).forEach(([fileIdStr, scheduleData]) => {
            const fileId = parseInt(fileIdStr);
            const schedule = scheduleData.schedule;
            const scheduleNotEmpty = schedule && schedule.trim() !== '';
            
            if (scheduleNotEmpty) {
              this.fileScheduleStatus[fileId] = true;
              this.fileScheduleCronExpressions[fileId] = schedule;
              
              // Attach the cron expression directly to the file object
              const fileInDisplay = this.displayFiles?.find(f => f.id === fileId);
              if (fileInDisplay) {
                (fileInDisplay as any).schedule = schedule;
              }
              const fileInDepartment = this.department?.files?.find(f => f.id === fileId);
              if (fileInDepartment) {
                (fileInDepartment as any).schedule = schedule;
              }
              
              
              // Emit the schedule data to parent component
              this.scheduleDataUpdated.emit({
                fileId: fileId,
                hasCron: true,
                cronExpression: schedule
              });
            } else {
              this.fileScheduleStatus[fileId] = false;
              delete this.fileScheduleCronExpressions[fileId];
              
              // Clear any previous schedule value on the file objects
              const fileInDisplay = this.displayFiles?.find(f => f.id === fileId);
              if (fileInDisplay && (fileInDisplay as any).schedule !== undefined) {
                delete (fileInDisplay as any).schedule;
              }
              const fileInDepartment = this.department?.files?.find(f => f.id === fileId);
              if (fileInDepartment && (fileInDepartment as any).schedule !== undefined) {
                delete (fileInDepartment as any).schedule;
              }
              
              
              // Emit that this file has no schedule
              this.scheduleDataUpdated.emit({
                fileId: fileId,
                hasCron: false
              });
            }
          });
          
          
          // Force MTX-Grid to refresh by recreating the displayFiles array
          this.displayFiles = [...this.displayFiles];
          
          // Trigger change detection so the grid updates
          this.cdRef.markForCheck();
          this.cdRef.detectChanges(); // Force immediate change detection
          
          // Update column classes with a longer delay to ensure DOM is ready
          setTimeout(() => {
            this.updateColumnClasses();
          }, 500);
        } else {
          this.log.msg('2', 'Failed to get schedules in bulk check', 'Schedule', response.error);
          // Mark all files as not having schedules if the call failed
          fileIds.forEach(fileId => {
            this.fileScheduleStatus[fileId] = false;
          });
        }
      },
      error: (error: any) => {
        // Mark all files as no longer in progress
        fileIds.forEach(fileId => {
          this.schedulingInProgress.delete(fileId);
        });
        
        this.log.msg('2', 'Error in bulk schedule check', 'Schedule', error);
        // Mark all files as not having schedules if the call failed
        fileIds.forEach(fileId => {
          this.fileScheduleStatus[fileId] = false;
        });
      }
    });
  }
  
  /**
   * Check schedule status for a single file
   */
  private checkFileScheduleStatus(fileId: number, onComplete?: () => void): void {
    this._api.getFileSchedule(fileId).subscribe({
      next: (response: any) => {
        // Mark as no longer in progress
        this.schedulingInProgress.delete(fileId);
        
        let parsedResponse = response;
        if (typeof response === 'string') {
          try {
            parsedResponse = JSON.parse(response);
          } catch (e) {
            this.log.msg('2', `Failed to parse schedule response for file ${fileId}`, 'Schedule', e);
            if (onComplete) onComplete();
            return;
          }
        }
        
        const hasSuccess = parsedResponse.success;
        const schedule = parsedResponse.schedule;
        const scheduleNotEmpty = schedule && schedule.trim() !== '';
        
        if (hasSuccess && schedule && scheduleNotEmpty) {
          this.fileScheduleStatus[fileId] = true;
          this.fileScheduleCronExpressions[fileId] = schedule;

          // NEW: attach the cron expression directly to the file object so the grid can display it via the "schedule" field
          const fileInDisplay = this.displayFiles?.find(f => f.id === fileId);
          if (fileInDisplay) {
            // @ts-ignore – extend the UploadedFile object at runtime
            (fileInDisplay as any).schedule = schedule;
          }
          const fileInDepartment = this.department?.files?.find(f => f.id === fileId);
          if (fileInDepartment) {
            // @ts-ignore – extend the UploadedFile object at runtime
            (fileInDepartment as any).schedule = schedule;
          }

          
          // Emit the schedule data to parent component
          this.scheduleDataUpdated.emit({
            fileId: fileId,
            hasCron: true,
            cronExpression: schedule
          });
        } else {
          this.fileScheduleStatus[fileId] = false;
          delete this.fileScheduleCronExpressions[fileId];

          // Ensure we clear any previous schedule value on the file objects
          const fileInDisplay = this.displayFiles?.find(f => f.id === fileId);
          if (fileInDisplay && (fileInDisplay as any).schedule !== undefined) {
            delete (fileInDisplay as any).schedule;
          }
          const fileInDepartment = this.department?.files?.find(f => f.id === fileId);
          if (fileInDepartment && (fileInDepartment as any).schedule !== undefined) {
            delete (fileInDepartment as any).schedule;
          }

          
          // Emit that this file has no schedule
          this.scheduleDataUpdated.emit({
            fileId: fileId,
            hasCron: false
          });
        }
        
        // Force MTX-Grid to refresh by recreating the displayFiles array
        this.displayFiles = [...this.displayFiles];
        
        // Trigger change detection so the grid updates when we modify file rows
        this.cdRef.markForCheck();
        
        if (onComplete) onComplete();
      },
      error: (error) => {
        // Mark as no longer in progress
        this.schedulingInProgress.delete(fileId);
        
        this.log.msg('2', `Error checking schedule for file ${fileId}`, 'Schedule', error);
        this.fileScheduleStatus[fileId] = false;
        if (onComplete) onComplete();
      }
    });
  }
  
  /**
   * Update column classes to apply schedule styling
   */
  private updateColumnClasses() {
    // Simple DOM manipulation approach
    setTimeout(() => {
      this.log.msg('4', 'Starting updateColumnClasses', 'DOM');
      
      // Find all schedule buttons in the grid using multiple selectors
      const scheduleButtons = document.querySelectorAll(
        'button[mattooltip*="Schedule"], button[mattooltip*="schedule"], ' +
        'button[ng-reflect-message*="Schedule"], button[ng-reflect-message*="schedule"]'
      );
      this.log.msg('4', `Found ${scheduleButtons.length} schedule buttons`, 'DOM');
      
      scheduleButtons.forEach((button) => {
        // Find the parent row to get the file ID
        const row = button.closest('tr');
        if (row) {
          // Get file ID from the row data
          const cells = row.querySelectorAll('td');
          if (cells.length > 0) {
            // First cell usually contains the ID
            const fileId = parseInt(cells[0].textContent?.trim() || '0');
            
            if (fileId && this.fileScheduleStatus[fileId] !== undefined) {
              const hasSchedule = this.fileScheduleStatus[fileId];
              const icon = button.querySelector('.mat-icon');
              
              if (icon) {
                if (hasSchedule) {
                  // Add blue color for files with schedules
                  icon.classList.add('has-schedule-icon');
                  this.log.msg('4', `File ${fileId} - Added blue color`, 'DOM');
                } else {
                  // Remove blue color for files without schedules
                  icon.classList.remove('has-schedule-icon');
                  this.log.msg('4', `File ${fileId} - Removed blue color`, 'DOM');
                }
              }
            }
          }
        }
      });
    }, 100); // Small delay to ensure DOM is rendered
  }
  
} 