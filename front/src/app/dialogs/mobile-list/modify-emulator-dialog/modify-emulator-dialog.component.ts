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
    MatChipsModule
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
    this.logger.msg("1", "CO-Departments:", "mobile-list", this.data.department_name);

  }

  // // Declare the variable where the API result will be assigned
  mobiles: IMobile[] = [];
  runningMobiles: Container[] = [];
  // sharedMobileContainers: Container[] = [];
  // isIconActive: { [key: string]: boolean } = {};
  // showDetails: { [key: string]: boolean} = {};
  // sharedDetails: { [key: string]: boolean} = {};
  // isDialog: boolean = false;
  // selectedApps: { [mobileId: string]: string | null } = {};

  // // No dialog
  // departmentChecked: { [key: string]: boolean } = {};
  // buttonEnabledState = false;
  // selectionsDisabled: boolean = false;
  // selectedDepartment: { id: number, name: string } = {
  //   id: null,
  //   name: '',
  // };

  // departments$: Department[] = [];
  // destroy$ = new Subject<void>();
  // departments: Department[] = [];
  // apkFiles: any[] = [];
  // configValueBoolean: boolean = false;
  // isLoading = true;

  ngOnInit(): void {

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


  closeDialog(): void {
    this.dialogRef.close(false);
  }

  saveChanges(): void {
    const selectedApp = this.editMobileForm.value.selectedApp;
    const isShared = this.editMobileForm.value.shared;

    const currentSharedStatus = this.data.runningContainer?.shared;

    if (this.editMobileForm.valid && currentSharedStatus !== isShared) {
      this.logger.msg("1", "App-seleccionada:", "modify-emulator", selectedApp);
      this.updateSharedStatus({ checked: isShared }, this.data.mobile, this.data.runningContainer)
        .subscribe((updatedContainer: any) => {

          // for each apk
          this.selectedApks.forEach(apk => {
            this.installAPK(apk, updatedContainer);
          });

          this.dialogRef.close({ updatedContainer });
        });
    } else {

      this.selectedApks.forEach(apk => {
        this.installAPK(apk, this.data.runningContainer);
      });

      this.dialogRef.close();
    }
  }


  updateSharedStatus(isShared: any, mobile: IMobile, container): Observable<any> {
    let updateData = { shared: isShared.checked };

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

  installAPK(mobile: IMobile, container): void {
    let updateData = { apk_file: mobile.selectedAPKFileID };

    this._api.updateMobile(container.id, updateData).subscribe(

      (response: any) => {
        if (response && response.containerservice) {
          container = response.containerservice;
          this.snack.open(
            `APK Installed in the mobile ${mobile.mobile_image_name}`,
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

}
