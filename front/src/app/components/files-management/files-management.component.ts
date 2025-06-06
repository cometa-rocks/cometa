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
  ChangeDetectorRef
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
import { finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SureRemoveFileComponent } from '@dialogs/sure-remove-file/sure-remove-file.component';
import { MatSnackBar } from '@angular/material/snack-bar';

// Common Angular imports
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatDividerModule } from '@angular/material/divider';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { MatInputModule } from '@angular/material/input';

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
interface UploadedFile {
  id: number;
  name: string;
  size?: number;
  status: "Done" | "Unknown" | "Processing" | "Scanning" | "Encrypting" | "DataDriven" | "Error";
  is_removed?: boolean;
  uploaded_by?: {
    name: string;
  };
  created_on?: string;
  extras?: {
    ddr?: {
      'data-driven-ready'?: boolean;
    };
  };
  mime?: string;
  type?: string;
  file_type?: string;
}

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
    MatLegacyMenuModule,
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
  
  // View children for templates
  @ViewChild('editInput') editInput: ElementRef;
  @ViewChild('dynamicEditableCellTpl') dynamicEditableCellTpl: TemplateRef<any>;
  @ViewChild('actionsColumnTpl') actionsColumnTpl: TemplateRef<any>;
  
  // Component properties
  isLoadingFiles: boolean = false;
  expandedFileIds: Set<number> = new Set<number>();
  file_data: Record<string, any> = {};
  showRemovedFiles: boolean = false;
  
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
  
  ngOnInit(): void {
    // Initialize displayFiles from department.files but respect the showRemovedFiles setting
    this.updateDisplayFiles();
    
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
            text: 'delete',
            icon: 'delete',
            tooltip: 'Delete file',
            color: 'warn',
            click: (result: UploadedFile) => {
              this.log.msg('4', `Delete button clicked for file: ${result.id}`, 'Click');
              this.onDeleteFile(result);
            },
            iif: row => !row.is_removed,
          }
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

      }
    });
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
      
      // Fetch data with new pagination
      this.getFileData(file);
    } else {
      this.log.msg('3', 'Pagination event without valid file reference', 'Pagination');
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
    let savedSheet = null;
    if (isExcel) {
      savedSheet = localStorage.getItem(`co_excel_sheet_${fileId}`);
      this.log.msg('4', `Looking for saved sheet for file ${fileId}: ${savedSheet || 'none found'}`, 'GetData');
    }
    
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
      this.log.msg('4', `Using sheet parameter for Excel file ${fileId}: ${params.sheet}`, 'GetData');
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
            let results = [];
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
              (results.length > 0 && results[0] && results[0].data ? results.map(d => d.data) : results) : 
              [];
            
            this.log.msg('4', `Fetched data for file ${fileId}: count=${fetchedData.length}`, 'GetData');
              
            if (fetchedData.length > 0) {
              const columns: MtxGridColumn[] = [];
              
              // Add actions column as the first column
              columns.unshift({
                header: 'Actions',
                field: 'actions',
                width: '80px',
                cellTemplate: this.actionsColumnTpl,
                class: `file-${fileId}`
              });
              
              // For CSV files, typically the first row has the column names
              const firstRow = fetchedData[0];
              
              // Use the ordered columns from the API response if available, 
              // otherwise extract them from the first data row
              const columnKeys = resp && resp.columns_ordered && Array.isArray(resp.columns_ordered) ? 
                resp.columns_ordered : 
                (firstRow ? Object.keys(firstRow) : []);
                
              this.log.msg('4', `Column keys for file ${fileId}: ${columnKeys.join(', ')}`, 'GetData');
              
              columnKeys.forEach(key => {
                columns.push({
                  header: key,
                  field: key,
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
              
              this.file_data[fileId] = {
                ...this.file_data[fileId],
                columns: [],
                file_data: [],
                total: 0,
                isLoading: false,
                showPagination: false,
                fileId: fileId, // Ensure file ID is stored
                sheets: this.file_data[fileId].sheets
              };
            }
          } catch (e) {
            this.log.msg('2', `Error processing response for file ${fileId}`, 'GetData', e);
            this.file_data[fileId].file_data = [];
            this.file_data[fileId].total = 0;
            this.file_data[fileId].showPagination = false;
            this.file_data[fileId].isLoading = false;
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
    // Finish any existing edit first
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
        this.file_data[fileId].file_data[rowIndex][columnField] = this.editValue;
        
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
  
  saveAllChanges(fileId: number): void {
    if (!this.isDirty[fileId] || !this.file_data[fileId]) return;

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
          this.log.msg('4', `Using first available sheet: ${params.sheet}`, 'SaveChanges');
        }
      }
    } else {
      this.log.msg('4', `Saving changes to non-Excel file ${fileId}`, 'SaveChanges');
    }
    
    // If we only have a subset of data due to pagination, retrieve all data for the current sheet
    if (this.file_data[fileId].showPagination && this.file_data[fileId].total > this.file_data[fileId].file_data.length) {
      this.log.msg('4', `File has pagination with total ${this.file_data[fileId].total} rows but only ${this.file_data[fileId].file_data.length} loaded. Retrieving full data...`, 'SaveChanges');
      
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
            let allData = [];
            
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
              (allData.length > 0 && allData[0] && allData[0].data ? allData.map(d => d.data) : allData) : 
              [];
            
            // Apply the edits from the current data to the full data set
            const editedData = this.file_data[fileId].file_data;
            const currentPageParams = this.file_data[fileId].params;
            
            // If there are no rows to update, just save what we have (unlikely)
            if (allFetchedData.length === 0 || editedData.length === 0) {
              this.log.msg('3', 'No complete data retrieved or no edited data. Saving current data only.', 'SaveChanges');
              this._saveFileData(fileId, editedData, params);
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
            this.log.msg('4', `Retrieved all ${fullDatasetWithEdits.length} rows, applied edits from page ${pageIndex}, and saving.`, 'SaveChanges');
            this._saveFileData(fileId, fullDatasetWithEdits, params);
          },
          error: (error) => {
            this.log.msg('2', 'Error retrieving complete data, saving only current page', 'SaveChanges', error);
            // Fall back to saving just the current data
            this._saveFileData(fileId, this.file_data[fileId].file_data, params);
          }
        });
    } else {
      // No pagination or all data already loaded, save as is
      this._saveFileData(fileId, this.file_data[fileId].file_data, params);
    }
  }
  
  // Helper method to perform the actual save operation
  private _saveFileData(fileId: number, data: any[], params: any): void {
    // Clone and clean the data to avoid modifying the original
    const dataToSave = JSON.parse(JSON.stringify(data)).map(row => {
      // Create a new object without UI-specific fields
      const cleanRow = {...row};
      
      // Remove Excel UI fields
      delete cleanRow.rowNumber;
      delete cleanRow._rowIndex;
      
      return cleanRow;
    });
    
    // Use the API service's updateDataDrivenFile method
    this._api.updateDataDrivenFile(fileId, dataToSave, params)
      .subscribe({
        next: (response) => {
          this._snackBar.open('File data updated successfully', 'Close', {
            duration: 3000,
            panelClass: ['file-management-custom-snackbar']
          });
          
          // Update original data
          this.original_file_data[fileId] = JSON.parse(JSON.stringify(this.file_data[fileId].file_data));
          this.isDirty[fileId] = false;
          this.file_data[fileId].isLoading = false;
          this.cdRef.markForCheck();
        },
        error: (error) => {
          this.log.msg('2', 'Error updating file data', 'SaveChanges', error);
          this._snackBar.open('Error updating file data', 'Close', {
            duration: 5000,
            panelClass: ['file-management-custom-snackbar']
          });
          this.file_data[fileId].isLoading = false;
          this.cdRef.markForCheck();
        }
      });
  }
  
  cancelAllChanges(fileId: number): void {
    if (!this.isDirty[fileId] || !this.original_file_data[fileId]) return;
    
    // Reset to original data
    this.file_data[fileId].file_data = JSON.parse(JSON.stringify(this.original_file_data[fileId]));
    this.isDirty[fileId] = false;
    this.cdRef.markForCheck();
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
            this.log.msg('4', `Execute button clicked with file: ${file.id}`, 'Button');
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
            this.log.msg('4', `Download button clicked with file: ${file.id}`, 'Button');
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
            this.log.msg('4', `Delete button clicked with file: ${file.id}`, 'Button');
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
      });
    }
    
    // --- Status Column Logic (New) ---
    const statusColumn = this.fileColumns.find(col => col.field === 'status');
    if (statusColumn) {
      this.log.msg('4', 'Updating status column formatter and class for custom columns', 'Init');
      // Apply formatter for deleted status
      statusColumn.formatter = (rowData: UploadedFile) => {
        if (rowData.is_removed) {
          // Use HTML directly to apply the class to the text
          return `<span class="status-deleted">Deleted</span>`;
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
    
    // Skip the first column (Actions column)
    for (let i = 1; i < columns.length; i++) {
      const column = columns[i];
      if (column.field) {
        emptyRow[column.field] = '';
      }
    }
    
    // Create a new array with the new row inserted
    const newFileData = [...this.file_data[fileId].file_data];
    newFileData.splice(rowIndex, 0, emptyRow);
    
    // Update with the new array reference
    this.file_data[fileId].file_data = newFileData;
    
    // Mark as dirty
    this.isDirty[fileId] = true;
    
    // Force UI update
    this.file_data = {...this.file_data};
    this.cdRef.detectChanges();
    
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
    
    // Skip the first column (Actions column)
    for (let i = 1; i < columns.length; i++) {
      const column = columns[i];
      if (column.field) {
        emptyRow[column.field] = '';
      }
    }
    
    // Create a new array with the new row inserted
    const newFileData = [...this.file_data[fileId].file_data];
    newFileData.splice(rowIndex + 1, 0, emptyRow);
    
    // Update with the new array reference
    this.file_data[fileId].file_data = newFileData;
    
    // Mark as dirty
    this.isDirty[fileId] = true;
    
    // Force UI update
    this.file_data = {...this.file_data};
    this.cdRef.detectChanges();
    
    this.log.msg('4', `Added row below index ${rowIndex} in file ${fileId}`, 'AddRow');
  }
  
  deleteRow(fileId: number, rowIndex: number): void {
    if (!this.file_data[fileId] || !this.file_data[fileId].file_data) {
      this.log.msg('2', 'Cannot delete row, file data not found', 'DeleteRow');
      return;
    }
    
    // Don't delete if it's the last row
    if (this.file_data[fileId].file_data.length <= 1) {
      this._snackBar.open('Cannot delete the last row', 'Close', {
        duration: 3000,
        panelClass: ['file-management-custom-snackbar']
      });
      return;
    }
    
    // Create a new array without the deleted row
    const newFileData = [...this.file_data[fileId].file_data];
    newFileData.splice(rowIndex, 1);
    
    // Update with the new array reference
    this.file_data[fileId].file_data = newFileData;
    
    // Mark as dirty
    this.isDirty[fileId] = true;
    
    // Force UI update
    this.file_data = {...this.file_data};
    this.cdRef.detectChanges();
    
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
    
    // Get editable columns (exclude actions column)
    const allColumns = fileData.columns;
    const editableColumns = allColumns.filter(col => col.field !== 'actions');
    
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
        file.name.toLowerCase().includes(searchTermLower)
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
        
        // Trigger change detection
        this.cdRef.markForCheck();
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
      
      // Update the current sheet
      this.file_data[fileId].sheets.current = sheetName;
      
      // Save selected sheet to localStorage
      localStorage.setItem(`co_excel_sheet_${fileId}`, sheetName);
      this.log.msg('4', `Saved current sheet '${sheetName}' to localStorage for file ${fileId}`, 'Sheets');
      
      // If there are unsaved changes, warn the user
      if (this.isDirty[fileId]) {
        this._snackBar.open('Warning: You have unsaved changes that will be lost when switching sheets', 'Dismiss', {
          duration: 5000,
          panelClass: ['file-management-custom-snackbar']
        });
      }
      
      // Find the original file to reload data
      const file = this.department?.files?.find(f => f.id === fileId);
      if (file) {
        // Reset pagination to first page when switching sheets
        if (this.file_data[fileId].params) {
          this.file_data[fileId].params.page = 0;
        }
        
        // Reload the file data with the new sheet
        this.getFileData(file);
      } else {
        this.log.msg('2', `Cannot find original file with ID ${fileId} to reload sheet data`, 'Sheets');
      }
    } else {
      this.log.msg('4', `Already on sheet '${sheetName}' for file ${fileId}, no need to switch`, 'Sheets');
    }
  }

  // Add helper to check if a file has multiple sheets
  hasMultipleSheets(fileId: number): boolean {
    return this.file_data[fileId]?.sheets?.names?.length > 1;
  }

  // Add helper to get sheet names for a file
  getSheetNames(fileId: number): string[] {
    return this.file_data[fileId]?.sheets?.names || [];
  }

  // Add helper to get current sheet for a file
  getCurrentSheet(fileId: number): string {
    return this.file_data[fileId]?.sheets?.current || '';
  }
  
  // Clear file error message
  clearFileError(fileId: number): void {
    if (this.file_data[fileId]) {
      delete this.file_data[fileId].error;
      this.cdRef.markForCheck();
    }
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
    
    // Add row number column as the first column (before actions column)
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
    
    // Add row number column as first column (before actions)
    columns.unshift(rowNumberColumn);
    
    // Update column headers to include Excel-style column letters (A, B, C, etc.)
    // Skip row number column (index 0) and actions column (index 1)
    for (let i = 2; i < columns.length; i++) {
      const colIndex = i - 1; // Adjust for the row number column
      const excelColName = this.getExcelColumnName(colIndex);
      // Keep the original header but prefix with the Excel column letter
      if (columns[i].header) {
        columns[i].header = `${excelColName}: ${columns[i].header}`;
      } else {
        columns[i].header = excelColName;
      }
    }
    
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
} 