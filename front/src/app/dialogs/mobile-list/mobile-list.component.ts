import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
  Inject,
  OnDestroy,
} from '@angular/core';

import {
  MatLegacyDialog as MatDialog,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { BrowserFavouritedPipe } from '@pipes/browser-favourited.pipe';
import { PlatformSortPipe } from '@pipes/platform-sort.pipe';
import { catchError, map, Observable, Subject, throwError, BehaviorSubject, Subscription } from 'rxjs';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { MobileIconPipe } from '@pipes/mobile-icon.pipe';
import { BrowserComboTextPipe } from '../../pipes/browser-combo-text.pipe';
import { VersionSortPipe } from '@pipes/version-sort.pipe';
import { TranslateNamePipe } from '@pipes/translate-name.pipe';
import { CheckBrowserExistsPipe } from '@pipes/check-browser-exists.pipe';
import { CheckSelectedBrowserPipe } from '@pipes/check-selected-browser.pipe';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { LetDirective } from '../../directives/ng-let.directive';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { ContextMenuModule } from '@perfectmemory/ngx-contextmenu';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyOptionModule } from '@angular/material/legacy-core';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import {
  NgIf,
  NgFor,
  NgClass,
  AsyncPipe,
  TitleCasePipe,
  KeyValuePipe,
} from '@angular/common';
import { ApiService } from '@services/api.service';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { UserState } from '@store/user.state';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { DraggableWindowModule } from '@modules/draggable-window.module'
import { AreYouSureData, AreYouSureDialog } from '@dialogs/are-you-sure/are-you-sure.component';
import { Select, Store } from '@ngxs/store';
import { LogService } from '@services/log.service';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ModifyEmulatorDialogComponent } from '@dialogs/mobile-list/modify-emulator-dialog/modify-emulator-dialog.component';
import { ConfigState } from '@store/config.state';
import { MatBadgeModule } from '@angular/material/badge';
import { MatRippleModule } from '@angular/material/core';
import { MaxEmulatorDialogComponent } from '@dialogs/mobile-list/max-emulator-dialog/max-emulator-dialog';
import { FeaturesState } from '@store/features.state';
import {
  UntypedFormControl,
  UntypedFormGroup,
  Validators,
  UntypedFormBuilder,
} from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { interval } from 'rxjs';
import { Departments } from '@store/actions/departments.actions';
import { Configuration } from '@store/actions/config.actions';
import { CustomSelectors } from '@others/custom-selectors';
import { MtxGridModule } from '@ng-matero/extensions/grid';


/**
 * MobileListComponent
 * @description Component used to select the browser/s used for testing
 * @author Anand Kushwaha
 * @emits Array of BrowserstackBrowser, see interfaces.d.ts
 * @example <cometa-browser-selection origin="browserstack" (selectionChange)="handleChange($event)"></cometa-browser-selection>
 */
@UntilDestroy()
@Component({
  selector: 'mobile-list',
  templateUrl: './mobile-list.component.html',
  styleUrls: ['./mobile-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // providers: [BrowserFavouritedPipe, PlatformSortPipe],
  standalone: true,
  imports: [
    NgIf,
    MatLegacyFormFieldModule,
    MatLegacySelectModule,
    ReactiveFormsModule,
    NgFor,
    MatLegacyOptionModule,
    MatLegacyInputModule,
    StopPropagationDirective,
    NgClass,
    MatLegacyTooltipModule,
    ContextMenuModule,
    MatLegacyCheckboxModule,
    MatLegacyButtonModule,
    MatIconModule,
    LetDirective,
    MatLegacyProgressSpinnerModule,
    AsyncPipe,
    TitleCasePipe,
    KeyValuePipe,
    PlatformSortPipe,
    MobileIconPipe,
    CheckSelectedBrowserPipe,
    CheckBrowserExistsPipe,
    TranslateNamePipe,
    VersionSortPipe,
    BrowserFavouritedPipe,
    BrowserComboTextPipe,
    SortByPipe,
    TranslateModule,
    MatLegacyDialogModule,
    MatSlideToggleModule,
    MatDividerModule,
    DraggableWindowModule,
    FormsModule,
    MatMenuModule,
    MatButtonToggleModule,
    MatBadgeModule,
    MatRippleModule,
    MtxGridModule,
  ],
})
export class MobileListComponent implements OnInit, OnDestroy {
  featureForm: UntypedFormGroup;
  private destroy$ = new Subject<void>();
  private updateInterval = 2000; // 2 seconds - reduced from 5 seconds for faster updates
  private intervalSubscription: Subscription;
  private containersSubscription: Subscription;
  
  // Menu state management to prevent auto-updates from closing open menus
  private openMenusCount = 0;
  private menuUpdatePaused = false;

  // Double click prevention properties
  private isStartingMobile = false;
  private isTerminatingMobile = false;
  private isInspectingMobile = false;
  private isNoVNCMobile = false;
  private clickTimeout = 2000; // 2 seconds timeout

  // View state management
  @ViewSelectSnapshot(CustomSelectors.GetConfigProperty('mobileView.with'))
  mobileViewWith: 'tiles' | 'list';

  // Temporary debug property
  mobileViewWithLocal: 'tiles' | 'list' = 'list'; // Changed to 'list' for testing

  // Debug getter for template
  get debugCondition() {
    const result = this.mobileViewWithLocal === 'list';
    return result;
  }

  // Force update method
  forceUpdate() {
    this._cdr.markForCheck();
    this._cdr.detectChanges();
  }

  constructor(
    private _dialog: MatDialog,
    private _api: ApiService,
    private _cdr: ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private snack: MatSnackBar,
    private _store: Store,
    private logger: LogService,
    private _fb: UntypedFormBuilder,
  ) {
    this.featureForm = this._fb.group({
      department_name: ['', Validators.required],
    });
  }
  @ViewSelectSnapshot(UserState) user!: UserInfo;
  @ViewSelectSnapshot(ConfigState) config$!: Config;

  // Declare the variable where the API result will be assigned
  mobiles: IMobile[] = [];
  runningMobiles: Container[] = [];
  sharedMobileContainers: Container[] = [];
  isIconActive: { [key: string]: boolean } = {};
  showDetails: { [key: string]: boolean} = {};
  sharedDetails: { [key: string]: boolean} = {};
  isDialog: boolean = false;
  selectedApps: { [mobileId: string]: string | null } = {};

  // No dialog
  departmentChecked: { [key: string]: boolean } = {};
  buttonEnabledState = false;
  selectionsDisabled: boolean = false;
  selectedDepartment: { id: number | null, name: string } = {
    id: null,
    name: '',
  };

  departments$: Department[] = [];
  departments: Department[] = [];
  apkFiles: any[] = [];
  configValueBoolean: boolean = false;
  isLoading = true;

  // Preselected department
  preselectDepartment: number;

  // Table columns configuration for mobile devices
  mobileTableColumns = [
    { header: 'Options', field: 'options' },
    { header: 'Actions', field: 'actions' },
    { header: 'Mobile Name', field: 'mobile_image_name', sortable: true },
    { header: 'Mobile Code', field: 'hostname', sortable: true },
    { header: 'Number installed Apps', field: 'installedApps', sortable: true },
    { header: 'Shared', field: 'shared', sortable: true },
    { header: 'Status', field: 'status', sortable: true },
    { header: 'Device Name', field: 'deviceName', sortable: true, hide: true },
    { header: 'Android Version', field: 'android_version', sortable: true, hide: true },
    { header: 'API Level', field: 'api_level', sortable: true, hide: true },
    { header: 'Architecture', field: 'architecture', sortable: true, hide: true },
  ];

  // Column configuration for shared mobile devices (without Shared column)
  sharedMobileTableColumns = [
    { header: 'Options', field: 'options' },
    { header: 'Actions', field: 'actions' },
    { header: 'Mobile Name', field: 'mobile_image_name', sortable: true },
    { header: 'Mobile Code', field: 'hostname', sortable: true },
    { header: 'Number installed Apps', field: 'installedApps', sortable: true },
    { header: 'Device Name', field: 'deviceName', sortable: true, hide: true },
    { header: 'Android Version', field: 'android_version', sortable: true, hide: true },
    { header: 'Architecture', field: 'architecture', sortable: true, hide: true },
    { header: 'API Level', field: 'api_level', sortable: true },
    { header: 'Status', field: 'status', sortable: true },
  ];

  // Mtx-grid configuration
  multiSelectable = false;
  rowSelectable = false;
  hideRowSelectionCheckbox = true;
  columnHideable = true;
  columnMovable = true;
  columnHideableChecked: 'show' | 'hide' = 'show';

  ngOnInit(): void {

    this.cleanupSubscriptions();
    this.resetComponentState(); // Use the new reset method instead of cleanupMobileState
    this.departments = this.user.departments;
    this.isDialog = this.data?.department_id ? true : false;
    
    // Load saved column settings
    this.getSavedMobileColumnSettings();
    this.getSavedSharedMobileColumnSettings();
    


    // Initialize view from localStorage or default to tiles
    const savedView = localStorage.getItem('mobileView.with');

    
    if (savedView && ['tiles', 'list'].includes(savedView)) {
      // Use the store to set the view instead of direct assignment
      this._store.dispatch([
        new Configuration.SetProperty('mobileView.with', savedView as 'tiles' | 'list', true),
      ]);
      this.mobileViewWithLocal = savedView as 'tiles' | 'list';

    } else {
      // Set default view through store
      this._store.dispatch([
        new Configuration.SetProperty('mobileView.with', 'tiles', true),
      ]);
      localStorage.setItem('mobileView.with', 'tiles');
      this.mobileViewWithLocal = 'tiles';

    }
    


    if(!this.isDialog ){
      if (this.user && this.user.departments) {
        // Use getPreselectedDepartment to get the department from localStorage or user settings
        const preselectedDept = this.getPreselectedDepartment();
        if (preselectedDept) {
          this.selectedDepartment = preselectedDept;
          // Trigger department selection to load APK files and set up the department
          this.onDepartmentSelect(null);
          this._cdr.detectChanges();
        }
      }
    }
    else{
      let selected = this.departments.find(department => department.department_id === this.data.department_id);
      this.selectedDepartment = { id: selected.department_id, name: selected.department_name };
    }

    this._api.getCometaConfigurations().subscribe(res => {
      const config_feature_mobile = res.find((item: any) => item.configuration_name === 'COMETA_FEATURE_MOBILE_TEST_ENABLED');
      if (config_feature_mobile) {
        this.configValueBoolean = !!JSON.parse(config_feature_mobile.configuration_value.toLowerCase());
      }
      this.isLoading = false;
    });

    const terminatingContainerIds = JSON.parse(localStorage.getItem('terminatingContainers') || '[]');
    terminatingContainerIds.forEach((containerId: number) => {
      const container = this.runningMobiles.find(c => c.id === containerId);
      if (container) {
        container.isTerminating = true;
      }
    });

    // Call the API service on component initialization
    this._api.getMobileList().subscribe(
      (mobiles: IMobile[]) => {
        // Assign the received data to the `mobile` variable
        this.mobiles = mobiles;
        // Clear table data cache when mobiles data changes
        this.clearTableDataCache();
        // department_id is received only when component is opened as dialog
        this.isDialog = this.data?.department_id ? true : false;

        // If proxy object, use this Json stringify to avoid proxy objects
        this._store.select(UserState.RetrieveUserDepartments).pipe(
          map(departments => JSON.parse(JSON.stringify(departments)))
        ).subscribe(departments => {
          this.departments = departments;
          
          // If we don't have a selected department yet, try to get the preselected one
          if (!this.selectedDepartment.id && !this.isDialog) {
            const preselectedDept = this.getPreselectedDepartment();
            if (preselectedDept) {
              this.selectedDepartment = preselectedDept;
              // Trigger change detection to update the UI
              this._cdr.detectChanges();
            }
          }
          
          this.departments.forEach(department => {
            const depData = JSON.parse(JSON.stringify(department));
            this.apkFiles = depData.files.filter(file => file.name.endsWith('.apk') && !file.is_removed);
          })
        });

        // Call the API service on component initialization
        this._api.getContainersList().subscribe(
          (containers: Container[]) => {

            for (let container of containers) {

              if (container.isTerminating) {
                this.showSpinnerFor(container.id);
              }

              if (container.shared && this.user.user_id != container.created_by) {
                container.image = this.mobiles.find( m => m.mobile_id === container.image);

                if(this.isDialog){
                  container.apk_file = this.data.uploadedAPKsList.find(
                    m => m.mobile_id === container.apk_file
                  );
                }
                else{
                  this.departments.forEach(department => {
                    const depData = JSON.parse(JSON.stringify(department));
                    this.apkFiles = depData.files.filter(file => file.name.endsWith('.apk') && !file.is_removed);
                  })
                }

                if (this.selectedDepartment && this.selectedDepartment.id && container.department_id === this.selectedDepartment.id) {
                  this.sharedMobileContainers.push(container);
                }

              } else if (this.user.user_id == container.created_by) {
                this.runningMobiles.push(container);
              }
            }
            // Clear table data cache when containers data changes
            this.clearTableDataCache();
            this._cdr.detectChanges();
          },
          error => {
            // Handle any errors
            console.error(
              'An error occurred while fetching the containers list',
              error
            );
          }
        );
        this._cdr.detectChanges();
      },
      error => {
        // Handle any errors
        console.error(
          'An error occurred while fetching the mobile list',
          error
        );
      }
    );

    if(!this.isDialog){
      const preselectedDept = this.getPreselectedDepartment();
      if (preselectedDept) {
        this.selectedDepartment = preselectedDept;
      }
    }

    // Configurar la actualización periódica de la lista
    this.intervalSubscription = interval(this.updateInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // if (!this.isFirstLoad) {
          this.loadSharedContainers();
        // }
      });

  }

  private cleanupSubscriptions() {
    if (this.intervalSubscription) {
      this.intervalSubscription.unsubscribe();
    }
    if (this.containersSubscription) {
      this.containersSubscription.unsubscribe();
    }
    this.sharedMobileContainers = [];
  }

  private cleanupMobileState() {
    // Clean up mobile state to prevent stale data
    this.runningMobiles = [];
    this.sharedMobileContainers = [];
    this.selectedApps = {};
    this.isIconActive = {};
    this.showDetails = {};
    this.sharedDetails = {};
    this.clearTableDataCache();
  }

  ngOnDestroy(): void {
    this.cleanupSubscriptions();
    

    
    // Clear shared status timeout
    if (this.sharedStatusUpdateTimeout) {
      clearTimeout(this.sharedStatusUpdateTimeout);
    }
    
    this.destroy$.next();
    this.destroy$.complete();
  }

  showSpinnerFor(containerId: number): void {
    const container = this.runningMobiles.find(c => c.id === containerId);
    if (container) {
      container.isTerminating = true;
    }
  }

  updateAPKSelection(event: any, mobile: IMobile): void {
    mobile.selectedAPKFileID = event.value;
  }

  // This method starts the mobile container
  startMobile(mobile_id): void {
    // Prevent double click
    if (this.isStartingMobile) {
      return;
    }

    this.isStartingMobile = true;
    
    // Reset the flag after timeout
    setTimeout(() => {
      this.isStartingMobile = false;
    }, this.clickTimeout);

    let serviceStatusCount = this.runningMobiles.filter(container => container.service_status === 'Running').length;

    if (serviceStatusCount >= 3) {
      this.openMaxEmulatorDialog();
      this.isStartingMobile = false; // Reset flag immediately for max emulator dialog
    }
    else{
      const mobile = this.mobiles.find(m => m.mobile_id === mobile_id);
      
      // Check if there's already a container for this mobile and clean it up
      const existingContainer = this.runningMobiles.find(c => c.image === mobile_id);
      if (existingContainer) {

        this.runningMobiles = this.runningMobiles.filter(c => c.id !== existingContainer.id);
      }
      
      let body = {
        image: mobile_id,
        service_type: 'Emulator',
        department_id: this.data.department_id || this.selectedDepartment?.id || null,
        shared: mobile.isShared === true ? true : false,
        selected_apk_file_id: null, // Always start with null to avoid conflicts
      };

      // Clear any cached data before starting new container
      this.clearTableDataCache();

      // Call the API service on component initialization
      this._api.startMobile(body).subscribe(
        (container: Container) => {
          // Update the service status to Running
          container.service_status = 'Running';

          // Add the container to the runningMobiles list
          this.runningMobiles.push(container);

          // Clear any cached data after adding new container
          this.clearTableDataCache();

          // Show success snackbar
          this.snack.open('Mobile started successfully', 'OK');

          // Trigger change detection
          this._cdr.detectChanges();
          
          // Reset the flag after successful start
          this.isStartingMobile = false;
        },
        error => {
          // Handle any errors
          console.error('An error occurred while starting the mobile', error);

          // Check if it's a specific error and provide better feedback
          let errorMessage = 'Error while starting the mobile';
          if (error.status === 500) {
            errorMessage = 'Server error: Please try again in a moment';
          } else if (error.status === 0) {
            errorMessage = 'Network error: Unable to connect to server';
          } else if (error.error && error.error.message) {
            errorMessage = error.error.message;
          }
          
          // Show error snackbar
          this.snack.open(errorMessage, 'OK');
          
          // Clear cache on error as well
          this.clearTableDataCache();
          this._cdr.detectChanges();
          
          // Reset the flag after error
          this.isStartingMobile = false;
        }
      );
    }
  }

  // Check if container is in a valid state for operations
  private isContainerInValidState(container: Container): boolean {
    return container && 
           container.service_status !== 'Stopping' && 
           container.service_status !== 'Restarting' &&
           !container.isTerminating;
  }

  // This method stops the mobile container using ID
  terminateMobile(container: Container): void {
    // Prevent double click
    if (this.isTerminatingMobile) {
      return;
    }

    this.isTerminatingMobile = true;
    
    // Reset the flag after timeout
    setTimeout(() => {
      this.isTerminatingMobile = false;
    }, this.clickTimeout);

    this._dialog
      .open(AreYouSureDialog, {
        data: {
          title: 'translate:you_sure.mobile_title',
          description: 'translate:you_sure.mobile_description',
        } as AreYouSureData,
        autoFocus: true,
      })
      .afterClosed()
      .subscribe((exit: boolean) => {
        if (exit) {
          container.isTerminating = true;
          container.service_status = 'Stopping';

          // Save the container in localStorage
          const terminatingContainerIds = JSON.parse(localStorage.getItem('terminatingContainers') || '[]');
          if (!terminatingContainerIds.includes(container.id)) {
            terminatingContainerIds.push(container.id);
            localStorage.setItem('terminatingContainers', JSON.stringify(terminatingContainerIds));
          }

          this._cdr.detectChanges();
          
          // First, stop the container
          this._api.terminateMobile(container.id).subscribe(
            (response: any) => {
              if (response.success) {
                this.snack.open(`Mobile stopped successfully`, 'OK');
                
                // Complete cleanup of the container from local state
                this.runningMobiles = this.runningMobiles.filter(
                  runningContainer => runningContainer.id !== container.id
                );

                // Reset mobile APK selection
                const mobile = this.mobiles.find(m => m.mobile_id === container.image);
                if (mobile) {
                  mobile.selectedAPKFileID = null;
                }

                // Clean up selected apps
                this.selectedApps[container.service_id] = null;

                // Remove from localStorage if stopped successfully
                const updatedContainerIds = terminatingContainerIds.filter(id => id !== container.id);
                localStorage.setItem('terminatingContainers', JSON.stringify(updatedContainerIds));

                container.service_status = 'Stopped';
                
                // Clear cache after successful termination
                this.clearTableDataCache();
                
                // Force immediate refresh of container list to ensure clean state
                this.loadSharedContainers();
                
              } else {
                console.error('An error occurred while stopping the mobile', response.message);
                this.snack.open(`Error while stopping the Mobile`, 'OK');
                container.service_status = 'Error';
              }
              container.isTerminating = false;
              this._cdr.detectChanges();
              
              // Reset the flag after termination process
              this.isTerminatingMobile = false;
            },
            error => {
              container.isTerminating = false;
              console.error('An error occurred while stopping the mobile', error);

              // Remove from localStorage if there was an error
              const updatedContainerIds = terminatingContainerIds.filter(id => id !== container.id);
              localStorage.setItem('terminatingContainers', JSON.stringify(updatedContainerIds));

              container.service_status = 'Error';
              
              // Clear cache on error as well
              this.clearTableDataCache();
              this._cdr.detectChanges();
              
              // Reset the flag after error
              this.isTerminatingMobile = false;
            }
          );
        } else {
          container.isTerminating = false;
          // Reset the flag if user cancels
          this.isTerminatingMobile = false;
        }
      });
  }

  // This method restarts the mobile container using ID
  restartMobile(container: Container): void {
    let body = {
      action: 'restart'
    };
    container.service_status = 'Restarting';

    // Only clear cache if we're in table view to show immediate status change
    if (this.mobileViewWithLocal === 'list') {
      this.clearTableDataCache();
      this._cdr.detectChanges();
    }

    // Call the API service on component initialization
    this._api.updateMobile(container.id, body).subscribe(
      (response: any) => {
        if (response.success) {
          container.isPaused = false;
          container.service_status = 'Running';
          this.snack.open(`Mobile restarted successfully`, 'OK');
          container = response.containerservice;
          
          // Refresh container data to get updated APK information
          this.refreshContainerData(container.id);
          
          // Only clear cache if we're in table view
          if (this.mobileViewWithLocal === 'list') {
            this.clearTableDataCache();
            this._cdr.detectChanges();
          }
        } else {
          console.error(
            `Failed to restart mobile container with ID: ${container.id}. Reason: ${response.message}`
          );
          this.snack.open(`Error restarting the mobile container`, 'OK');
          container.service_status = 'Error';
          this._cdr.detectChanges();
        }
      },
      error => {
        // Enhanced error handling for API call
        console.error(
          `Network or server error occurred while attempting to restart mobile container with ID: ${container.id}.`,
          error
        );
        this.snack.open(`Network error while restarting mobile`, 'OK');
        container.service_status = 'Error';
        this._cdr.detectChanges();
      }
    );
  }

  // Refresh container data to get updated APK information
  private refreshContainerData(containerId: number): void {
    this._api.getContainersList().subscribe(
      (containers: Container[]) => {
        const updatedContainer = containers.find(c => c.id === containerId);
        if (updatedContainer) {
          // Update the container in runningMobiles
          const existingContainer = this.runningMobiles.find(c => c.id === containerId);
          if (existingContainer) {
            existingContainer.apk_file = updatedContainer.apk_file;
            existingContainer.service_status = updatedContainer.service_status;
            existingContainer.hostname = updatedContainer.hostname;
            this._cdr.detectChanges();
          }
        }
      },
      error => {
        console.error('Error refreshing container data:', error);
      }
    );
  }

  // This method pauses the mobile container using ID
  pauseMobile(container: Container): void {
    let body = {
      action: 'stop'
    };
    container.service_status = 'Pausing';

    // Only clear cache if we're in table view to show immediate status change
    if (this.mobileViewWithLocal === 'list') {
      this.clearTableDataCache();
      this._cdr.detectChanges();
    }

    // Call the API service on component initialization
    this._api.updateMobile(container.id, body).subscribe(
      (response: any) => {
        if (response.success) {
          container.isPaused = true;
          container.service_status = 'Stopped';
          this.snack.open(`Mobile paused successfully`, 'OK');
          container = response.containerservice;
          // Only clear cache if we're in table view
          if (this.mobileViewWithLocal === 'list') {
            this.clearTableDataCache();
            this._cdr.detectChanges();
          }
        } else {
          console.error(
            'An error occurred while stopping the mobile',
            response.message
          );
          this.snack.open(`Error while stopping the Mobile`, 'OK');
          container.service_status = 'Error';
          this._cdr.detectChanges();
        }
      },
      error => {
        // Handle any errors
        console.error(
          'An error occurred while fetching the mobile list',
          error
        );
        container.service_status = 'Error';
        this._cdr.detectChanges();
      }
    );
  }

  handleMobileState(container: Container): void {
    if (container.service_status === 'Running') {
      this.pauseMobile(container);
    } else if (container.service_status === 'Stopped') {
      this.restartMobile(container);
    } else if (container.service_status === 'Pausing' || container.service_status === 'Restarting') {
      return;
    }
  }


  inspectMobile(container: Container, mobile: IMobile): void {
    // Prevent double click
    if (this.isInspectingMobile) {
      return;
    }

    this.isInspectingMobile = true;
    
    // Reset the flag after timeout
    setTimeout(() => {
      this.isInspectingMobile = false;
    }, this.clickTimeout);

    if (this.stopGoToUrl(container)) {
      this.isInspectingMobile = false;
      return;
    }
    
    let host = window.location.hostname;
    let capabilities = encodeURIComponent(JSON.stringify(mobile.capabilities));
    let complete_url = `/mobile/inspector?host=${host}&port=443&path=/emulator/${container.id}/&ssl=true&autoStart=true&capabilities=${capabilities}`;
    window.open(complete_url, '_blank');
  }

  noVNCMobile(container: Container): void {
    // Prevent double click
    if (this.isNoVNCMobile) {
      return;
    }

    this.isNoVNCMobile = true;
    
    // Reset the flag after timeout
    setTimeout(() => {
      this.isNoVNCMobile = false;
    }, this.clickTimeout);

    // FIXME this connection needs to be fixed, to improve security over emulators
    if (this.stopGoToUrl(container)) {
      this.isNoVNCMobile = false;
      return;
    }
    
    let complete_url = `/live-session/vnc.html?autoconnect=true&path=mobile/${container.service_id}`;
    window.open(complete_url, '_blank');
  }

  // access or not to novnc or inspect
  stopGoToUrl(container: Container) {
    if (container.service_status === 'Stopped' || container.service_status === 'Pausing' || container.service_status === 'Restarting') {
      return true;
    }
    return false;
  }

  // Check the running containers filtered by deprtament
  isThisMobileContainerRunning(mobile_id): Container | null {
    // this.mobiles.filter(m => m.department_id === this.selectedDepartment?.id);
    if (!this.selectedDepartment || !this.selectedDepartment.id) {
      return null;
    }
    
    for (let container of this.runningMobiles) {
      if (container.image == mobile_id && container.department_id == this.selectedDepartment?.id) {
        // Additional check to ensure container is actually running
        if (container.service_status === 'Running' || container.service_status === 'Stopped') {
          return container;
        }
      }
    }
    return null;
  }

  importClipboard(androidVersion: string) {
    navigator.clipboard.writeText(androidVersion).then(() => {
    this.isIconActive[androidVersion] = true;
    this._cdr.detectChanges();
    setTimeout(() => {
      this.isIconActive[androidVersion] = false;
      this._cdr.detectChanges();
    }, 400);
    this.snack.open('Text copied to clipboard', 'Close');
    }).catch(err => {
      console.error('Error copying: ', err);
      this.snack.open('Error copying text', 'Close');
    });
  }

  toggleSharedDetails(containerId) {
    if(containerId){
      this.sharedDetails[containerId] = !this.sharedDetails[containerId];
    }
  }

// ####################################
// # NO DIALOG                        #
// ####################################


  onDepartmentSelect($event){
    // No necesitamos cargar aquí porque el intervalo ya lo hará
    if (!this.selectedDepartment || !this.selectedDepartment.id) {
      this.selectionsDisabled = false;
      return;
    }

    // Save the selected department to localStorage for persistence
    localStorage.setItem('co_last_dpt', this.selectedDepartment.name);
    FeaturesState.static_setSelectedDepartment(this.selectedDepartment.id);

    this.apkFiles = [];
    this.departments.forEach(department => {
      if(department.department_id == this.selectedDepartment.id) {
        const depData = JSON.parse(JSON.stringify(department));
        this.apkFiles = depData.files.filter(file => file.name.endsWith('.apk') && !file.is_removed);
      }
    })

    this.departmentChecked[this.selectedDepartment.id] = true;
    this.selectionsDisabled = true;

    // Immediately clear shared containers and force UI update
    this.sharedMobileContainers = [];
    this.clearTableDataCache();
    this._cdr.detectChanges();

    // Then load shared containers for the new department
    this.loadSharedContainers();
    
    // Load shared containers for the newly selected department
    this.loadSharedContainers();
    
    // Trigger change detection to update the UI
    this._cdr.detectChanges();

  }

  openModifyEmulatorDialog(mobile: IMobile, runningContainer: Container) {
    // Refresca los departamentos antes de abrir el diálogo
    this._store.dispatch(new Departments.GetAdminDepartments()).subscribe(() => {
      // Busca el departamento actualizado en el store
      const department = this._store.selectSnapshot<any[]>(state => state.departments)
        .find(dep => dep.department_id === this.selectedDepartment?.id);

      let uploadedApksList = (department?.files || [])
        .filter(file => 
          (file.name?.toLowerCase().endsWith('.apk') || file.mime === 'application/vnd.android.package-archive') &&
          !file.is_removed
        );

      // (Opcional) deduplicate by name
      // const seen = new Map();
      // uploadedApksList.forEach(apk => seen.set(apk.name, apk));
      // uploadedApksList = Array.from(seen.values());

      let departmentName = department?.department_name || '';

      this._dialog
        .open(ModifyEmulatorDialogComponent, {
          data: {
            department_name: departmentName,
            department_id: department?.department_id,
            uploadedAPKsList: uploadedApksList,
            mobile,
            runningContainer
          },
          panelClass: 'mobile-emulator-panel-dialog',
          disableClose: false,
        })
        .afterClosed()
        .subscribe(result => {
          if (result?.updatedContainer) {
            runningContainer.shared = result.updatedContainer.shared;
            runningContainer.apk_file = result.updatedContainer.apk_file;
            this._cdr.detectChanges();
          }
        });
    });
  }

  preventToggle(event: any, mobileShared: boolean) {
    if (mobileShared) {
      event.source.checked = true;
    }
    else{
      event.source.checked = false;
    }
  }

  loadSharedContainers() {
    // Skip update if menus are open to prevent menu closure
    if (this.menuUpdatePaused) {
      this.logger.msg('4', 'Skipping container update - menus are open', 'MenuState');
      return;
    }

    // Limpiar la lista actual antes de cargar nuevos contenedores
    this.sharedMobileContainers = [];

    // Cancelar la suscripción anterior si existe
    if (this.containersSubscription) {
      this.containersSubscription.unsubscribe();
    }

    // Only load shared containers if we have a selected department
    if (!this.selectedDepartment || !this.selectedDepartment.id) {
      return;
    }

    this.containersSubscription = this._api.getContainersList().subscribe((containers: Container[]) => {
      // Clear shared containers first to prevent any duplication
      this.sharedMobileContainers = [];
      
      // Actualizar contenedores compartidos
      const currentSharedContainers = containers.filter(container =>
        container.shared &&
        container.department_id === this.selectedDepartment.id &&
        container.created_by !== this.user.user_id
      );

      // Check if shared containers data has actually changed
      const sharedContainersChanged = this.hasSharedContainersChanged(currentSharedContainers);

      // Asignar los nuevos contenedores compartidos
      this.sharedMobileContainers = currentSharedContainers;
      
      // Asignar la imagen correspondiente a cada contenedor de forma segura
      this.sharedMobileContainers.forEach(container => {
        const foundImage = this.mobiles.find(m => m.mobile_id === container.image);
        if (foundImage) {
          container.image = foundImage;
        }
      });

      // Actualizar contenedores propios (runningMobiles)
      const currentRunningContainers = containers.filter(container =>
        container.created_by === this.user.user_id
      );

      // Check if running containers data has actually changed
      const runningContainersChanged = this.hasRunningContainersChanged(currentRunningContainers);

      // Actualizar el estado de los contenedores existentes
      this.runningMobiles.forEach(existingContainer => {
        const updatedContainer = currentRunningContainers.find(c => c.id === existingContainer.id);
        if (updatedContainer) {
          // Actualizar propiedades importantes manteniendo referencias
          existingContainer.service_status = updatedContainer.service_status;
          existingContainer.isPaused = updatedContainer.isPaused;
          existingContainer.shared = updatedContainer.shared;
          existingContainer.apk_file = updatedContainer.apk_file;
          existingContainer.hostname = updatedContainer.hostname;
          // Mantener isTerminating si ya estaba establecido
          if (!existingContainer.isTerminating) {
            existingContainer.isTerminating = updatedContainer.isTerminating;
          }
        }
      });

      // Always clear cache and force updates for shared containers to ensure immediate visibility
      // This is especially important when shared containers are terminated by other users
      this.clearTableDataCache();
      this._cdr.detectChanges();
    });
  }

  /**
   * Check if shared containers data has changed
   */
  private hasSharedContainersChanged(newSharedContainers: Container[]): boolean {
    if (this.sharedMobileContainers.length !== newSharedContainers.length) {
      return true;
    }

    // Create hash of current shared containers
    const currentHash = this.sharedMobileContainers.map(container => ({
      id: container.id,
      status: container.service_status,
      hostname: container.hostname,
      isTerminating: container.isTerminating,
      apk_count: (container.apk_file && Array.isArray(container.apk_file)) ? container.apk_file.length : 0,
      created_by_name: container.created_by_name
    }));

    // Create hash of new shared containers
    const newHash = newSharedContainers.map(container => ({
      id: container.id,
      status: container.service_status,
      hostname: container.hostname,
      isTerminating: container.isTerminating,
      apk_count: (container.apk_file && Array.isArray(container.apk_file)) ? container.apk_file.length : 0,
      created_by_name: container.created_by_name
    }));

    return JSON.stringify(currentHash) !== JSON.stringify(newHash);
  }

  /**
   * Check if running containers data has changed
   */
  private hasRunningContainersChanged(newRunningContainers: Container[]): boolean {
    if (this.runningMobiles.length !== newRunningContainers.length) {
      return true;
    }

    // Create hash of current running containers
    const currentHash = this.runningMobiles.map(container => ({
      id: container.id,
      status: container.service_status,
      hostname: container.hostname,
      shared: container.shared,
      isTerminating: container.isTerminating,
      apk_count: (container.apk_file && Array.isArray(container.apk_file)) ? container.apk_file.length : 0
    }));

    // Create hash of new running containers
    const newHash = newRunningContainers.map(container => ({
      id: container.id,
      status: container.service_status,
      hostname: container.hostname,
      shared: container.shared,
      isTerminating: container.isTerminating,
      apk_count: (container.apk_file && Array.isArray(container.apk_file)) ? container.apk_file.length : 0
    }));

    // Compare hashes to detect real changes
    const currentHashString = JSON.stringify(currentHash);
    const newHashString = JSON.stringify(newHash);
    
    const hasChanged = currentHashString !== newHashString;
    
    // Debug logging for shared status changes
    if (hasChanged) {
      const currentShared = currentHash.filter(c => c.shared).length;
      const newShared = newHash.filter(c => c.shared).length;
      if (currentShared !== newShared) {
      }
    }
    
    return hasChanged;
  }

  onDepartmentChange() {
    //When switching options in the dropdown, we update the UI and call FutureState to sort by the new option.
    for (const department of this.user.departments) {
      if(department.department_name == this.selectedDepartment.name){
        localStorage.setItem('co_last_dpt',this.selectedDepartment.name)
        FeaturesState.static_setSelectedDepartment(department.department_id)
        //refresh UI
      }
    }
    this._cdr.detectChanges();
  }

  // Dialog max emulators
  openMaxEmulatorDialog(): void {
    const runningEmulators = this.runningMobiles;
    const departments = this.departments;

    const emulatorsByDepartment = runningEmulators.reduce((acc, emulator) => {
      const departmentId = emulator.department_id;
      if (!acc[departmentId]) {
        acc[departmentId] = [];
      }
      acc[departmentId].push(emulator);
      return acc;
    }, {});

    this._dialog.open(MaxEmulatorDialogComponent, {
      data: {
        departments: departments,
        emulatorsByDepartment: emulatorsByDepartment
      },
      panelClass: 'max-emulator-dialog'
    });
  }

  getPreselectedDepartment(): { name: string, id: number } | null {
    // 1. Get the last selected department from localStorage
    const lastDept = localStorage.getItem('co_last_dpt');

    // 2. Get the user's settings for preselecting a department
    const userSettingsPreselectedDpt = this.user.settings?.preselectDepartment;

    // 3. If there is a department in localStorage, find it in the department list
    if (lastDept) {
        const selected = this.departments.find(dept => dept.department_name === lastDept);
        if (selected) {
            this.selectedDepartment = {
                id: selected.department_id,
                name: selected.department_name
            };
            FeaturesState.static_setSelectedDepartment(this.selectedDepartment.id);
            return this.selectedDepartment;
        }
    }

    // 4. If no department is found in localStorage, use the one preselected in user settings
    if (userSettingsPreselectedDpt) {
        const selected = this.departments.find(dept => dept.department_id === userSettingsPreselectedDpt);
        if (selected) {
            this.selectedDepartment = {
                id: selected.department_id,
                name: selected.department_name
            };
            FeaturesState.static_setSelectedDepartment(this.selectedDepartment.id);
            return this.selectedDepartment;
        }
    }

    // 5. If no valid preselection is found, choose the first department in the list
    if (this.departments.length > 0) {
        this.selectedDepartment = {
          id: this.departments[0].department_id,
          name: this.departments[0].department_name
        };
        FeaturesState.static_setSelectedDepartment(this.selectedDepartment.id);
        return this.selectedDepartment;
    }

    return null;
  }

  compareDepartments(d1: any, d2: any): boolean {
    return d1 && d2 ? d1.id === d2.id : d1 === d2;
  }

  // #########################################
  // # BOTH DIALOG AND NOT DIALOG            #
  // #########################################

  // Add debounce mechanism for shared status updates
  private sharedStatusUpdateInProgress = false;
  private sharedStatusUpdateTimeout: any = null;

  updateSharedStatus(isShared: any, mobile: IMobile, container): Observable<any> {
    // Prevent multiple concurrent updates
    if (this.sharedStatusUpdateInProgress) {

      return new Observable(observer => {
        observer.next(container);
        observer.complete();
      });
    }

    // Clear any pending timeout
    if (this.sharedStatusUpdateTimeout) {
      clearTimeout(this.sharedStatusUpdateTimeout);
    }

    // Set flag to prevent concurrent updates
    this.sharedStatusUpdateInProgress = true;

    let updateData = { shared: isShared.checked };
    return this._api.updateMobile(container.id, updateData).pipe(
      map((response: any) => {
        if (response?.containerservice) {
          // Only update if the shared status actually changed
          const previousSharedStatus = container.shared;
          container.shared = response.containerservice.shared;
          
          // Only show snack and trigger updates if status actually changed
          if (previousSharedStatus !== container.shared) {
            this.snack.open(
              `Mobile ${isShared.checked ? 'shared' : 'unshared'} with other users in this department`,
              'OK'
            );
            
            // Always clear cache and force updates for shared status changes
            // This ensures immediate visibility in both tiles and list views
            this.clearTableDataCache();
            this._cdr.detectChanges();
            
            // Force immediate update of shared containers
            this.loadSharedContainers();
          }
          
          // Reset flag after successful update
          this.sharedStatusUpdateInProgress = false;
          return container;
        } else {
          this.snack.open(response.message, 'OK');
          this.sharedStatusUpdateInProgress = false;
          throw new Error(response.message);
        }
      }),
      catchError(error => {
        // Reset flag on error
        this.sharedStatusUpdateInProgress = false;
        return throwError(error);
      })
    );
  }

  // Función trackBy para evitar renderizados innecesarios
  trackByContainerId(index: number, container: Container): number {
    return container.id;
  }

  // Enhanced trackBy function for shared containers to prevent duplication
  trackBySharedContainerId(index: number, container: Container): string {
    // Use a combination of container ID and created_by to ensure uniqueness
    return `${container.id}_${container.created_by}_${container.department_id}`;
  }

  // Check if container has installed APKs
  hasInstalledApks(container: Container): boolean {
    return container?.apk_file && Array.isArray(container.apk_file) && container.apk_file.length > 0;
  }

  // Get tooltip text for installed APKs
  getApkTooltipText(container: Container): string {
    if (!this.hasInstalledApks(container)) {
      return '';
    }

    // Get APK names from the departments files
    const apkNames: string[] = [];
    // Ensure apk_file is always an array
    const apkFileArray = Array.isArray(container.apk_file) ? container.apk_file : (container.apk_file ? [container.apk_file] : []);
    
    this.departments.forEach(department => {
      const depData = JSON.parse(JSON.stringify(department));
      const departmentApks = depData.files.filter(file => file.name.endsWith('.apk') && !file.is_removed);
      
      apkFileArray.forEach(apkId => {
        const apk = departmentApks.find(file => file.id === apkId);
        if (apk) {
          apkNames.push(apk.name);
        }
      });
    });

    if (apkNames.length === 0) {
      return 'No APK names found';
    }

    return `Installed Apps:\n${apkNames.map((name, index) => `${index + 1}. ${name}`).join('\n\n')}`;
  }

  /**
   * Clears the table data cache
   */
  private clearTableDataCache() {
    this._mobileTableDataCache = [];
    this._sharedMobileTableDataCache = [];
    this._mobileTableDataHash = '';
    this._sharedMobileTableDataHash = '';
  }

  /**
   * Called when a menu opens - pauses auto-updates to prevent menu closure
   */
  onMenuOpened() {
    this.openMenusCount++;
    this.menuUpdatePaused = true;
    this.logger.msg('4', `Menu opened. Open menus: ${this.openMenusCount}`, 'MenuState');
  }

  /**
   * Called when a menu closes - resumes auto-updates if no menus are open
   */
  onMenuClosed() {
    this.openMenusCount = Math.max(0, this.openMenusCount - 1);
    if (this.openMenusCount === 0) {
      this.menuUpdatePaused = false;
      this.logger.msg('4', 'All menus closed. Resuming auto-updates and triggering immediate update', 'MenuState');
      
      // Trigger immediate update when all menus are closed
      setTimeout(() => {
        this.loadSharedContainers();
      }, 100); // Small delay to ensure menu is fully closed
    } else {
      this.logger.msg('4', `Menu closed. Remaining open menus: ${this.openMenusCount}`, 'MenuState');
    }
  }

  /**
   * Changes the type of view of the mobile list (tiles / list)
   */
  setView(type: string, view: 'tiles' | 'list') {

    
    this.logger.msg('1', 'Changing mobile list view type to...', 'mobile-list', view);
    localStorage.setItem('mobileView.with', view);
    this.mobileViewWithLocal = view;
    
    // Clear shared containers immediately to prevent duplication issues
    this.sharedMobileContainers = [];
    
    // Clear all caches when switching views to ensure fresh data
    this.clearTableDataCache();
    
    // Force immediate change detection
    this._cdr.detectChanges();
    
    // Force comprehensive change detection
    setTimeout(() => {
      this.forceUpdate();
    }, 0);
    
    return this._store.dispatch([
      new Configuration.SetProperty(`mobileView.${type}`, view, true),
    ]);
  }

  // Cache for table data to prevent infinite loops
  private _mobileTableDataCache: any[] = [];
  private _mobileTableDataHash: string = '';

  /**
   * Prepares mobile data for table view with caching based on data changes
   */
  getMobileTableData(): any[] {
    // Create a hash of current data to detect changes
    const currentDataHash = this.createMobileDataHash();
    
    // Return cached data if data hasn't changed
    if (this._mobileTableDataCache.length > 0 && this._mobileTableDataHash === currentDataHash) {
      return this._mobileTableDataCache;
    }
    
    // Update cache when data has changed
    this._mobileTableDataCache = this.mobiles.map(mobile => {
      const runningContainer = this.isThisMobileContainerRunning(mobile.mobile_id);
      const isRunning = runningContainer?.service_status === 'Running';
      
      return {
        ...mobile,
        deviceName: mobile.mobile_json?.deviceName || 'N/A',
        android_version: mobile.mobile_json?.android_version || 'N/A',
        api_level: mobile.mobile_json?.api_level || 'N/A',
        architecture: mobile.mobile_json?.architecture || 'N/A',
        status: runningContainer ? runningContainer.service_status : 'Not Started',
        hostname: runningContainer?.hostname || 'Click Start to see device code',
        installedApps: (runningContainer?.apk_file && Array.isArray(runningContainer.apk_file)) ? runningContainer.apk_file.length : 0,
        shared: runningContainer?.shared || false,
        runningContainer: runningContainer,
        isRunning: isRunning,
        isTerminating: runningContainer?.isTerminating || false
      };
    });
    
    this._mobileTableDataHash = currentDataHash;
    return this._mobileTableDataCache;
  }

  /**
   * Creates a hash of mobile data to detect changes
   */
  private createMobileDataHash(): string {
    const dataToHash = this.mobiles.map(mobile => {
      const runningContainer = this.isThisMobileContainerRunning(mobile.mobile_id);
      return {
        mobile_id: mobile.mobile_id,
        status: runningContainer?.service_status || 'Not Started',
        hostname: runningContainer?.hostname || '',
        shared: runningContainer?.shared || false,
        isTerminating: runningContainer?.isTerminating || false,
        apk_count: (runningContainer?.apk_file && Array.isArray(runningContainer.apk_file)) ? runningContainer.apk_file.length : 0
      };
    });
    
    return JSON.stringify(dataToHash);
  }

  // Cache for shared table data to prevent infinite loops
  private _sharedMobileTableDataCache: any[] = [];
  private _sharedMobileTableDataHash: string = '';

  /**
   * Prepares shared mobile data for table view with caching based on data changes
   */
  getSharedMobileTableData(): any[] {
    // Create a hash of current shared data to detect changes
    const currentSharedDataHash = this.createSharedMobileDataHash();
    
    // Return cached data if data hasn't changed
    if (this._sharedMobileTableDataCache.length > 0 && this._sharedMobileTableDataHash === currentSharedDataHash) {
      return this._sharedMobileTableDataCache;
    }
    
    // Update cache when data has changed
    this._sharedMobileTableDataCache = this.sharedMobileContainers.map(container => {
      const isRunning = container.service_status === 'Running';
      
      return {
        ...container.image,
        deviceName: container.image?.mobile_json?.deviceName || 'N/A',
        android_version: container.image?.mobile_json?.android_version || 'N/A',
        api_level: container.image?.mobile_json?.api_level || 'N/A',
        architecture: container.image?.mobile_json?.architecture || 'N/A',
        status: container.service_status,
        hostname: container.hostname || 'N/A',
        installedApps: (container.apk_file && Array.isArray(container.apk_file)) ? container.apk_file.length : 0,
        shared: container.shared || false,
        runningContainer: container,
        isRunning: isRunning,
        isTerminating: container.isTerminating || false,
        created_by_name: container.created_by_name,
        isShared: true
      };
    });
    
    this._sharedMobileTableDataHash = currentSharedDataHash;
    return this._sharedMobileTableDataCache;
  }

  /**
   * Creates a hash of shared mobile data to detect changes
   */
  private createSharedMobileDataHash(): string {
    const dataToHash = this.sharedMobileContainers.map(container => {
      return {
        container_id: container.id,
        status: container.service_status || 'Not Started',
        hostname: container.hostname || '',
        isTerminating: container.isTerminating || false,
        apk_count: (container.apk_file && Array.isArray(container.apk_file)) ? container.apk_file.length : 0,
        created_by_name: container.created_by_name || ''
      };
    });
    
    return JSON.stringify(dataToHash);
  }

  /**
   * Saves mobile table column settings to localStorage
   * @param event Column change event from mtx-grid
   */
  saveMobileColumnSettings(event: any[]) {
    this.logger.msg('1', 'Saving mobile table column settings...', 'mobile-list', event);

    // Add missing keys for next reload
    event.forEach(column => {
      // Get default properties for current column
      const defaultProperties = this.mobileTableColumns.find(
        defaultColumn => defaultColumn.header === column.label
      );
      // Concat current column values with default properties and also add hide property
      Object.assign(column, defaultProperties, { hide: !column.show });
    });
    
    // Save to localStorage
    localStorage.setItem('co_mobile_table_columns', JSON.stringify(event));

    // Refresh columns
    this.mobileTableColumns = event;
    
    // Clear cache to force table refresh
    this.clearTableDataCache();
    this._cdr.detectChanges();
  }

  /**
   * Saves shared mobile table column settings to localStorage
   * @param event Column change event from mtx-grid
   */
  saveSharedMobileColumnSettings(event: any[]) {
    this.logger.msg('1', 'Saving shared mobile table column settings...', 'mobile-list', event);

    // Add missing keys for next reload
    event.forEach(column => {
      // Get default properties for current column
      const defaultProperties = this.sharedMobileTableColumns.find(
        defaultColumn => defaultColumn.header === column.label
      );
      // Concat current column values with default properties and also add hide property
      Object.assign(column, defaultProperties, { hide: !column.show });
    });
    
    // Save to localStorage
    localStorage.setItem('co_shared_mobile_table_columns', JSON.stringify(event));

    // Refresh columns
    this.sharedMobileTableColumns = event;
    
    // Clear cache to force table refresh
    this.clearTableDataCache();
    this._cdr.detectChanges();
  }

  /**
   * Gets saved mobile table column settings from localStorage or uses default
   */
  getSavedMobileColumnSettings() {
    this.logger.msg('1', 'Getting saved mobile table column settings...', 'mobile-list');

    // Check if co_mobile_table_columns exists in localStorage, if so import it into columns else use default
    const savedColumns = JSON.parse(localStorage.getItem('co_mobile_table_columns'));
    if (savedColumns) {
      this.mobileTableColumns = savedColumns;
    }
  }

  /**
   * Gets saved shared mobile table column settings from localStorage or uses default
   */
  getSavedSharedMobileColumnSettings() {
    this.logger.msg('1', 'Getting saved shared mobile table column settings...', 'mobile-list');

    // Check if co_shared_mobile_table_columns exists in localStorage, if so import it into columns else use default
    const savedColumns = JSON.parse(localStorage.getItem('co_shared_mobile_table_columns'));
    if (savedColumns) {
      this.sharedMobileTableColumns = savedColumns;
    }
  }

  /**
   * Completely resets the component state to prevent duplication issues
   */
  private resetComponentState(): void {
    this.logger.msg('1', 'Resetting component state to prevent duplication issues', 'mobile-list');
    
    // Clear all containers
    this.sharedMobileContainers = [];
    this.runningMobiles = [];
    
    // Clear all caches
    this.clearTableDataCache();
    
    // Clear all state objects
    this.selectedApps = {};
    this.isIconActive = {};
    this.showDetails = {};
    this.sharedDetails = {};
    
    // Force change detection
    this._cdr.detectChanges();
  }

  /**
   * Handles clicks on disabled view options
   * @param viewType The type of view that was clicked
   */
  handleDisabledViewClick(viewType: string): void {
    if (viewType === 'tree') {
      this.snack.open('Tree view is not available in this modality', 'OK', { duration: 3000 });
    }
  }

}
