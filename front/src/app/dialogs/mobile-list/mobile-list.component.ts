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
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserFavouritedPipe } from '@pipes/browser-favourited.pipe';
import { PlatformSortPipe } from '@pipes/platform-sort.pipe';
import { BehaviorSubject, Observable } from 'rxjs';
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
    MatDividerModule
  ],
})
export class MobileListComponent implements OnInit {
  constructor(
    private _api: ApiService,
    private _cdr: ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) { }
  @ViewSelectSnapshot(UserState) user!: UserInfo;

  // Declare the variable where the API result will be assigned
  mobiles: IMobile[] = [];
  runningMobiles: Container[] = [];
  isLoading$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  sharedMobileContainers: Container[] = [];
  // userInformation = UserState.get

  ngOnInit(): void {

    // Call the API service on component initialization
    this._api.getMobileList().subscribe(
      (mobiles: IMobile[]) => {
        // Assign the received data to the `mobile` variable
        this.mobiles = mobiles;

        console.log(this.runningMobiles);

        // Call the API service on component initialization
        this._api.getContainersList().subscribe(
          (containers: Container[]) => {
            for (let container of containers) {
              if (container.shared && this.user.user_id != container.created_by) {
                container.image = this.mobiles.find(
                  m => m.mobile_id === container.image
                );
                container.apk_file = this.data.uploadedAPKsList.find(
                  m => m.mobile_id === container.apk_file
                );
                this.sharedMobileContainers.push(container);
              } else {
                this.runningMobiles.push(container);
              }
            }
            console.log(this.runningMobiles);
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

    console.log(this.mobiles);

    this.isLoading$.subscribe(bool => {
      console.log('Boolean: ', bool);
    });
  }

  updateSharedStatus(isShared: boolean, mobile: IMobile, container): void {
    console.log(this.runningMobiles);
    mobile.isShared = isShared;
  
    let updateData = { shared: mobile.isShared };
    console.log('Stopping container: ', container);
    
    this.isLoading$.next(true);
  
    this._api.updateMobile(container.id, updateData).subscribe(
      (updated_container: Container) => {
        container = updated_container;
        console.log('Mobile container updated: ', container.id);
        console.log(this.runningMobiles);
        this.isLoading$.next(false);
        this._cdr.detectChanges();
      },
      error => {
        this.isLoading$.next(false);
        console.error('An error occurred while fetching the mobile list', error);
      }
    );
  }
  

  updateAPKSelection(event: any, mobile: IMobile): void {
    mobile.selectedAPKFileID = event.value;
  }

  installAPK(mobile: IMobile, container): void {
    let updateData = { apk_file: mobile.selectedAPKFileID };
    this.isLoading$.next(true);
    this._api.updateMobile(container.id, updateData).subscribe(
      (updated_container: Container) => {
        container = updated_container;
        this.isLoading$.next(false);
        this._cdr.detectChanges();
      },
      error => {
        this.isLoading$.next(false);
        // Handle any errors
        console.error(
          'An error occurred while fetching the mobile list',
          error
        );
      }
    );
  }

  // This method starts the mobile container
  startMobile(mobile_id): void {
    const mobile = this.mobiles.find(m => m.mobile_id === mobile_id);
    this.isLoading$.next(true);
    let body = {
      image: mobile_id,
      service_type: 'Emulator',
      department_id: this.data.department_id,
      shared: mobile.isShared === true ? true : false,
      selected_apk_file_id: mobile.selectedAPKFileID,
    };
    console.log(body);
    // Call the API service on component initialization
    this._api.startMobile(body).subscribe(
      (container: Container) => {
        // Assign the received data to the `mobile` variable
        this.runningMobiles.push(container);
        console.log(this.runningMobiles);
        this.isLoading$.next(true);
        this._cdr.detectChanges();
      },
      error => {
        this.isLoading$.next(false);
        // Handle any errors
        console.error(
          'An error occurred while fetching the mobile list',
          error
        );
      }
    );
  }

  // This method stops the mobile container using ID
  stopMobile(mobile, container: Container): void {
    console.log('Stopping container: ', container);
    this.isLoading$.next(true);
    // Call the API service on component initialization
    this._api.stopMobile(container.id).subscribe(
      (container: Container) => {
        this.runningMobiles = this.runningMobiles.filter(
          runningContainer => runningContainer.id !== container.id
        );
        console.log('Mobile container stopped: ', container.id);
        console.log(this.runningMobiles);
        this.isLoading$.next(false);
        this._cdr.detectChanges();
      },
      error => {
        this.isLoading$.next(false);
        // Handle any errors
        console.error(
          'An error occurred while fetching the mobile list',
          error
        );
      }
    );
  }

  inspectMobile(container: Container, mobile: IMobile): void {
    let path = 'mobile/inspector'
    let host = window.location.hostname;
    let capabilities = encodeURIComponent(JSON.stringify(mobile.capabilities))
    let complete_url = `https://${host}/${path}?host=${host}&port=443&path=/emulator/${container.id}/&ssl=true&autoStart=true&capabilities=${capabilities}`
    window.open(complete_url, '_blank');
  }

  isThisMobileContainerRunning(mobile_id): Container | undefined {
    for (let container of this.runningMobiles) {
      if (container.image == mobile_id) {
        return container;
      }
    }
    return undefined;
  }
}
