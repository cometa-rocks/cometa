import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Inject,
} from '@angular/core';

import {
  MatLegacyDialogRef as MatDialogRef,
  MatLegacyDialog as MatDialog,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { ReactiveFormsModule, FormsModule, FormGroup, Validators, FormBuilder } from '@angular/forms';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { ContextMenuModule } from '@perfectmemory/ngx-contextmenu';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { Store } from '@ngxs/store';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { DraggableWindowModule } from '@modules/draggable-window.module'
import { MatExpansionModule } from '@angular/material/expansion';
import { LogService } from '@services/log.service';
import { ApiService } from '@services/api.service';
import { catchError, map, Observable, throwError } from 'rxjs';
import { MatChipsModule } from '@angular/material/chips';
import { MatChipInputEvent } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { ConfigState } from '@store/config.state';

/**
 * MobileListComponent
 * @description Dialog - edit emulator
 * @author Redouan Nati
 * @emits
 * @example
 */
@UntilDestroy()
@Component({
  selector: 'modify-emulator-dialog',
  templateUrl: './modify-emulator-dialog.component.html',
  styleUrls: ['./modify-emulator-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgIf,
    MatLegacyFormFieldModule,
    MatLegacySelectModule,
    ReactiveFormsModule,
    NgFor,
    MatLegacyOptionModule,
    MatLegacyInputModule,
    NgClass,
    MatLegacyTooltipModule,
    ContextMenuModule,
    MatLegacyCheckboxModule,
    MatLegacyButtonModule,
    MatIconModule,
    MatLegacyProgressSpinnerModule,
    AsyncPipe,
    TitleCasePipe,
    KeyValuePipe,
    TranslateModule,
    MatLegacyDialogModule,
    MatSlideToggleModule,
    MatDividerModule,
    FormsModule,
    MatMenuModule,
    MatButtonToggleModule,
    DraggableWindowModule,
    MatExpansionModule,
    MatChipsModule,
    MatCardModule
],
})
export class ModifyEmulatorDialogComponent {

  editMobileForm: FormGroup;
  selectedApks: any[] = [];
  separatorKeysCodes: number[] = [13, 188];
  addOnBlur = true;

  constructor(
    private _dialog: MatDialog,
    private dialogRef: MatDialogRef<ModifyEmulatorDialogComponent>,
    private _cdr: ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private snack: MatSnackBar,
    private _store: Store,
    private _fb: FormBuilder,
    private logger: LogService,
    private _api: ApiService,
  ) {
    this.logger.msg("1", "CO-Dialog-data", "Modify-emulator-dialog", this.data);
    this.editMobileForm = this._fb.group({
      selectedApp: [null],
      shared: [data.runningContainer?.shared || false]
    });

    // Log para ver los datos que vienen en 'data'
    // this.logger.msg("1", "CO-Departments:", "mobile-list", this.data.department_name);

  }
  @ViewSelectSnapshot(ConfigState) config$!: Config;

  mobiles: IMobile[] = [];
  runningMobiles: Container[] = [];
  isIconActive: { [key: string]: boolean } = {};


  ngOnInit(): void {
    this.logger.msg("1", "ModifyEmulatorDialogComponent",  "Data received:", this.data);

    console.log('Config value:', this.config$);
    // this.config$.subscribe( config => {
    //   console.log("config: ", config.toggles);
    // });
    // if (!this.data.runningContainer) {
    //   this.logger.msg("1", "ModifyEmulatorDialogComponent", "", "runningContainer is undefined!");
    // }

  }

  onSelectApp(event: any): void {
    const selectedApp = event.value;
    if (selectedApp && !this.selectedApks.includes(selectedApp)) {
      this.selectedApks.push(selectedApp);
    }
  }

  // Eliminar un APK seleccionado
  removeSelectedApk(apk: any, index: number): void {
    this.selectedApks.splice(index, 1);
  }

  isApkSelected(apk: any): boolean {
    return this.selectedApks.some(selected => selected.name === apk.name);
  }

  closeDialog(): void {
    this.dialogRef.close(false);
  }

  saveChanges(): void {
    const selectedApp = this.editMobileForm.value.selectedApp;
    const isShared = this.editMobileForm.value.shared;
    const currentSharedStatus = this.data.runningContainer?.shared;
    // console.log(" this.data.runningContainer",  this.data.runningContainer);

    if (this.editMobileForm.valid && currentSharedStatus !== isShared) {
      this.logger.msg("1", "App-seleccionada:", "modify-emulator", selectedApp);
      this.updateSharedStatus({ checked: isShared }, this.data.mobile, this.data.runningContainer)
        .subscribe((updatedContainer: any) => {

          console.log("data.runningContainer-->savchanges", this.data.runningContainer.id);
          // for each apk
          this.selectedApks.forEach(apk => {
            this.installAPK(apk, updatedContainer);
          });

          this.dialogRef.close({ updatedContainer });
        });
    } else {
      // for each apk
      this.selectedApks.forEach(apk => {
        this.installAPK(apk, this.data.runningContainer);
      });

      this.dialogRef.close();
    }
  }

  installAPK(mobile: IMobile, container): void {
    let updateData = { apk_file: mobile.selectedAPKFileID };

    // this.logger.msg("1", "Mobile", "", mobile);
    // this.logger.msg("1", "container", "", container);
    console.log("data.runningContainer", this.data.runningContainer.id);
    this._api.updateMobile(this.data.runningContainer.id, updateData).subscribe(

      (response: any) => {
        if (response && response.containerservice) {
          console.log("response.containerservice: ", response.containerservice);
          container = response.containerservice;
          console.log("mobile: ", mobile);
          console.log("container: ", container);
          this.logger.msg("1", "container inside: ", "", container);
          this.snack.open(
            `APK Installed in the mobile ${this.data.mobile.mobile_image_name}`,
            'OK'
          );
          this._cdr.detectChanges();
        } else {
          this.snack.open(response.message, 'OK');
        }
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

  updateSharedStatus(isShared: any, mobile: IMobile, container): Observable<any> {
    let updateData = { shared: isShared.checked };

    console.log("container - updateshared: ", container)

    return this._api.updateMobile(container.id, updateData).pipe(
      map((response: any) => {
        if (response?.containerservice) {
          container.shared = response.containerservice.shared;
          this.snack.open(
            `Mobile ${isShared.checked ? 'shared' : 'unshared'} with other users in this department`,
            'OK'
          );
          this._cdr.detectChanges();
          return container;
        } else {
          this.snack.open(response.message, 'OK');
          throw new Error(response.message);
        }
      }),
      catchError(error => {
        console.error('An error occurred while updating the mobile container:', error);
        return throwError(error);
      })
    );
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

}
