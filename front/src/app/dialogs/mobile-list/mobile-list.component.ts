import { Subscribe } from 'ngx-amvara-toolbox';
import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Output,
  EventEmitter,
  OnInit,
  Input,
  ViewChild,
  Inject,
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
import { BehaviorSubject, map, Observable, Subject, takeUntil } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
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
import { Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { LogService } from '@services/log.service';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { timeStamp } from 'console';
import { Key } from 'readline';
import { ModifyEmulatorDialogComponent } from '@dialogs/mobile-list/modify-emulator-dialog/modify-emulator-dialog.component';
import { ConfigState } from '@store/config.state';
import { MatBadgeModule } from '@angular/material/badge';


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
  ],
})
export class MobileListComponent implements OnInit {
  constructor(
    private _dialog: MatDialog,
    private _api: ApiService,
    private _cdr: ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private snack: MatSnackBar,
    private _store: Store,
    private logger: LogService
  ) {
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
  selectedDepartment: { id: number, name: string } = {
    id: null,
    name: '',
  };

  departments$: Department[] = [];
  destroy$ = new Subject<void>();
  departments: Department[] = [];
  apkFiles: any[] = [];
  configValueBoolean: boolean = false;
  isLoading = true;

  // Preselected department
  preselectDepartment: number;

  ngOnInit(): void {

    this.departments = this.user.departments;

    this.isDialog = this.data?.department_id ? true : false;

    // console.log("department_id: " , this.data?.department_id)

    // console.log("runningMobiles: " , this.runningMobiles)

    // console.log("mobiles: " , this.mobiles)

    if(!this.isDialog ){
      if (this.user && this.user.departments) {

        // User preselect department
        this.preselectDepartment = this.user.settings?.preselectDepartment;

        this.logger.msg("1", "CO-User:", "mobile-list", this.user);

        let selected = this.departments.find(department => department.department_id === this.preselectDepartment);

        // Si no hay preselectDepartment o no se encuentra, tomar el primero de la lista
        if (!selected && this.departments.length > 0) {
          selected = this.departments[0];
        }

        if (selected) {
          this.selectedDepartment = { id: selected.department_id, name: selected.department_name };
          this._cdr.detectChanges();
          this.logger.msg("1", "CO-selectedDepartment:", "mobile-list", this.selectedDepartment);
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
    })

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
        // this.logger.msg("1", "CO-depID:", "mobiles", mobiles);
        // Assign the received data to the `mobile` variable
        this.mobiles = mobiles;
        // console.log(" this.mobiles <><><>: ", this.mobiles)
        // department_id is received only when component is opened as dialog
        this.isDialog = this.data?.department_id ? true : false;

        // If proxy object, use this Json stringify to avoid proxy objects
        this._store.select(UserState.RetrieveUserDepartments).pipe(
          map(departments => JSON.parse(JSON.stringify(departments)))
        ).subscribe(departments => {
          this.departments = departments;
          this.departments.forEach(department => {
            const depData = JSON.parse(JSON.stringify(department));
            this.apkFiles = depData.files.filter(file => file.name.endsWith('.apk'));
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
                    this.apkFiles = depData.files.filter(file => file.name.endsWith('.apk'));
                  })
                }

                if (container.department_id === this.selectedDepartment.id) {
                  this.sharedMobileContainers.push(container);
                }



              } else if (this.user.user_id == container.created_by) {
                this.runningMobiles.push(container);
              }
            }
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
  }

  getSharedMobileContainers() {
    this.sharedMobileContainers = this.runningMobiles.filter(
      container =>
        container.shared &&
        container.created_by !== this.user.user_id &&
        container.department_id === this.selectedDepartment.id
    );
    // this._cdr.detectChanges();
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
    const mobile = this.mobiles.find(m => m.mobile_id === mobile_id);
    let body = {
      image: mobile_id,
      service_type: 'Emulator',
      department_id: this.data.department_id || this.selectedDepartment?.id,
      shared: mobile.isShared === true ? true : false,
      selected_apk_file_id: mobile.selectedAPKFileID,
    };

    // Call the API service on component initialization
    this._api.startMobile(body).subscribe(
      (container: Container) => {
        // Update the service status to Running
        container.service_status = 'Running';

        // Add the container to the runningMobiles list
        this.runningMobiles.push(container);

        // Show success snackbar
        this.snack.open('Mobile started successfully', 'OK');

        // Trigger change detection
        this._cdr.detectChanges();
      },
      error => {
        // Handle any errors
        console.error('An error occurred while starting the mobile', error);

        // Show error snackbar
        this.snack.open('Error while starting the mobile', 'OK');
      }
    );
  }

  // This method stops the mobile container using ID
  terminateMobile(container: Container): void {
    this._dialog
      .open(AreYouSureDialog, {
        data: {
          title: 'translate:you_sure.mobile_title',
          description: 'translate:you_sure.mobile_description',
        } as AreYouSureData,
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
          this._api.terminateMobile(container.id).subscribe(
            (response: any) => {
              if (response.success) {
                this.snack.open(`Mobile stopped successfully`, 'OK');
                this.runningMobiles = this.runningMobiles.filter(
                  runningContainer => runningContainer.id !== container.id
                );

                const mobile = this.mobiles.find(m => m.mobile_id === container.image);
                if (mobile) {
                  mobile.selectedAPKFileID = null;
                }

                this.selectedApps[container.service_id] = null;

                // Remove from localStorage if stopped successfully
                const updatedContainerIds = terminatingContainerIds.filter(id => id !== container.id);
                localStorage.setItem('terminatingContainers', JSON.stringify(updatedContainerIds));

                container.service_status = 'Stopped';
              } else {
                console.error('An error occurred while stopping the mobile', response.message);
                this.snack.open(`Error while stopping the Mobile`, 'OK');
                container.service_status = 'Error';
              }
              container.isTerminating = false;
              this._cdr.detectChanges();
            },
            error => {
              container.isTerminating = false;
              console.error('An error occurred while stopping the mobile', error);

              // Remove from localStorage if there was an error
              const updatedContainerIds = terminatingContainerIds.filter(id => id !== container.id);
              localStorage.setItem('terminatingContainers', JSON.stringify(updatedContainerIds));

              container.service_status = 'Error';
            }
          );
        } else {
          container.isTerminating = false;
        }
      });
  }

  // This method restarts the mobile container using ID
  restartMobile(container: Container): void {
    let body = {
      action: 'restart'
    };
    container.service_status = 'Restarting';


    // Call the API service on component initialization
    this._api.updateMobile(container.id, body).subscribe(
      (response: any) => {
        if (response.success) {
          container.isPaused = false;
          container.service_status = 'Running';
          this.snack.open(`Mobile restarted successfully`, 'OK');
          container = response.containerservice;
          this._cdr.detectChanges();
        } else {
          console.error(
            `Failed to restart mobile container with ID: ${container.id}. Reason: ${response.message}`
          );
          this.snack.open(`Error restarting the mobile container`, 'OK');
          container.service_status = 'Error';
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
      }
    );
  }

  // This method pauses the mobile container using ID
  pauseMobile(container: Container): void {
    let body = {
      action: 'stop'
    };
    container.service_status = 'Stopping';

    // Call the API service on component initialization
    this._api.updateMobile(container.id, body).subscribe(
      (response: any) => {
        if (response.success) {
          container.isPaused = true;
          container.service_status = 'Stopped';
          this.snack.open(`Mobile paused successfully`, 'OK');
          container = response.containerservice;
          this._cdr.detectChanges();
        } else {
          console.error(
            'An error occurred while stopping the mobile',
            response.message
          );
          this.snack.open(`Error while stopping the Mobile`, 'OK');
          container.service_status = 'Error';
        }
      },
      error => {
        // Handle any errors
        console.error(
          'An error occurred while fetching the mobile list',
          error
        );
        container.service_status = 'Error';
      }
    );
  }

  handleMobileState(container: Container): void {
    if (container.service_status === 'Running') {
      this.pauseMobile(container);
    } else if (container.service_status === 'Stopped') {
      this.restartMobile(container);
    } else if (container.service_status === 'Stopping' || container.service_status === 'Restarting') {
      return;
    }
  }


  inspectMobile(container: Container, mobile: IMobile): void {
    if (this.stopGoToUrl(container)) return;
    let host = window.location.hostname;
    let capabilities = encodeURIComponent(JSON.stringify(mobile.capabilities));
    let complete_url = `/mobile/inspector?host=${host}&port=443&path=/emulator/${container.id}/&ssl=true&autoStart=true&capabilities=${capabilities}`;
    window.open(complete_url, '_blank');
  }

  noVNCMobile(container: Container): void {
    // FIXME this connection needs to be fixed, to improve security over emulators
    if (this.stopGoToUrl(container)) return;
    let complete_url = `/live-session/vnc.html?autoconnect=true&path=mobile/${container.service_id}`;
    window.open(complete_url, '_blank');
  }

  // access or not to novnc or inspect
  stopGoToUrl(container: Container) {
    if (container.service_status === 'Stopped' || container.service_status === 'Stopping' || container.service_status === 'Restarting') {
      return true;
    }
    return false;
  }

  // Check the running containers filtered by deprtament
  isThisMobileContainerRunning(mobile_id): Container | null {
    console.log("Shared containers by department", this.sharedMobileContainers)
    // this.mobiles.filter(m => m.department_id === this.selectedDepartment?.id);
    for (let container of this.runningMobiles) {
      console.log("Container", container)
      if (container.image == mobile_id && container.department_id == this.selectedDepartment.id) {
        return container;
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

    if (!this.selectedDepartment || !this.selectedDepartment.id) {
      this.selectionsDisabled = false;
      return;
    }

    this.apkFiles = [];
    this.departments.forEach(department => {
      if(department.department_id == this.selectedDepartment.id) {
        const depData = JSON.parse(JSON.stringify(department));
        this.apkFiles = depData.files.filter(file => file.name.endsWith('.apk'));
      }
    })

    this.departmentChecked[this.selectedDepartment.id] = true;
    this.selectionsDisabled = true;
  }

  openModifyEmulatorDialog(mobile: IMobile, runningContainer: Container) {

    let uploadedApksList = this.departments
    .filter(department => department.department_id === this.selectedDepartment?.id)
    .map(department => department.files || [])
    .reduce((acc, files) => acc.concat(files), []);

    let departmentName = this.departments.filter(
      department => department.department_id === this.selectedDepartment?.id)
      .map(department => department.department_name || []);

    this._dialog
      .open(ModifyEmulatorDialogComponent, {
        data: {
          department_name: departmentName,
          department_id: this.selectedDepartment.id,
          uploadedAPKsList: uploadedApksList,
          mobile,
          runningContainer
        },
        panelClass: 'mobile-emulator-panel-dialog',
      })
      .afterClosed()
      .subscribe(result => {
        if (result?.updatedContainer) {
          runningContainer.shared = result.updatedContainer.shared;
          this._cdr.detectChanges();
        }
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

}
