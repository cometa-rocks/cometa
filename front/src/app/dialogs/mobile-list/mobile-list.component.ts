import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Output,
  EventEmitter,
  OnInit,
  Input,
  ViewChild,
} from '@angular/core';

import {
  MatLegacyDialog as MatDialog,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { BrowserFavouritedPipe } from '@pipes/browser-favourited.pipe';
import { BrowserstackState } from '@store/browserstack.state';
import { UserState } from '@store/user.state';
import { PlatformSortPipe } from '@pipes/platform-sort.pipe';
import { map } from 'rxjs/operators';
import { BrowsersState } from '@store/browsers.state';
import { BehaviorSubject } from 'rxjs';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { classifyByProperty } from 'ngx-amvara-toolbox';
import { User } from '@store/actions/user.actions';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngxs/store';
import { LyridBrowsersState } from '@store/browserlyrid.state';
import { TranslateModule } from '@ngx-translate/core';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { MobileIconPipe } from '@pipes/mobile-icon.pipe';
import { AddLatestPipe } from '../../pipes/add-latest.pipe';
import { BrowserComboTextPipe } from '../../pipes/browser-combo-text.pipe';
import { VersionSortPipe } from '@pipes/version-sort.pipe';
import { FormatVersionPipe } from '@pipes/format-version.pipe';
import { TranslateNamePipe } from '@pipes/translate-name.pipe';
import { CheckBrowserExistsPipe } from '@pipes/check-browser-exists.pipe';
import { CheckSelectedBrowserPipe } from '@pipes/check-selected-browser.pipe';
import { BrowserIconPipe } from '@pipes/browser-icon.pipe';
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
import { MatSelect } from '@angular/material/select';
import { ApiService } from '@services/api.service';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';

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
    MatLegacyDialogModule
  ],
})
export class MobileListComponent implements OnInit {
  constructor(
    private _api: ApiService,
    private _cdr: ChangeDetectorRef,
  ) {}

  // Declare the variable where the API result will be assigned
  mobile_containers: IMobile[] = [];
  running_mobile_containers : Container[] = []

  ngOnInit(): void {
    // Call the API service on component initialization
    this._api.getMobileList().subscribe(
      (data: IMobile[]) => {
        // Assign the received data to the `mobile` variable
        this.mobile_containers = data;
        console.log(this.mobile_containers);
        this._cdr.detectChanges();
      },
      (error) => {
        // Handle any errors
        console.error('An error occurred while fetching the mobile list', error);
      }
    );
  }
  
  // This method starts the mobile container
  startMobile(mobile_id): void {
    let body = {
      "image" : mobile_id,
      "service_type" : "Emulator"
    }
    // Call the API service on component initialization
    this._api.startEmulator(body).subscribe(
      (container: Container) => {
        // Assign the received data to the `mobile` variable
        this.running_mobile_containers.push(container);
        console.log(this.running_mobile_containers);
        this._cdr.detectChanges();
      },
      (error) => {
        // Handle any errors
        console.error('An error occurred while fetching the mobile list', error);
      }
    );
  }

  // This method stops the mobile container using ID
  stopMobile(container:Container): void {
    // Call the API service on component initialization
    this._api.stopEmulator(container.id).subscribe(
      (container: Container) => {
        // Assign the received data to the `mobile` variable
        this.running_mobile_containers.filter(container=>{
          container != container
        });
        console.log(this.running_mobile_containers);
        this._cdr.detectChanges();
      },
      (error) => {
        // Handle any errors
        console.error('An error occurred while fetching the mobile list', error);
      }
    );
  }

  inspectMobile(container): void {

  }

  isThisMobileContainerRunning(container_image): Container | undefined {
    for (let container of this.running_mobile_containers){
      if (container.image==container_image){
        return container
      }
    }
    return undefined
  }


}
