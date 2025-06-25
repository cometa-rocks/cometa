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
import { catchError, map, Observable, throwError, of, concatMap } from 'rxjs';
import { MatChipsModule } from '@angular/material/chips';
import { MatChipInputEvent } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { ConfigState } from '@store/config.state';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { MatToolbarModule } from '@angular/material/toolbar';

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
    MatCardModule,
    SortByPipe,
    MatToolbarModule
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
  installedApks: any[] = [];
  isRemovingApk: { [id: number]: boolean } = {};


  ngOnInit(): void {
    this.installedApks = this.data.uploadedAPKsList.filter(apk =>
      this.data.runningContainer.apk_file.includes(apk.id)
    );
  }

  onSelectApp(event: any): void {
    const selectedApp = event.value;
    if (selectedApp && !this.selectedApks.some(apk => apk.id === selectedApp.id)) {
      this.selectedApks.push(selectedApp);
      this.editMobileForm.get('selectedApp')?.reset();
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

    if (this.editMobileForm.valid && currentSharedStatus !== isShared) {
      this.logger.msg("1", "App-seleccionada:", "modify-emulator", selectedApp);
      this.updateSharedStatus({ checked: isShared }, this.data.mobile, this.data.runningContainer)
        .subscribe((updatedContainer: any) => {
          // Install APKs sequentially
          const installApks = this.selectedApks.reduce((obs, apk) => {
            return obs.pipe(
              concatMap(() => this.installAPK(apk.id, updatedContainer))
            );
          }, of(null));

          installApks.subscribe({
            next: () => {
              // Update apk_file list after all installations
              updatedContainer.apk_file = this.selectedApks.map(apk => apk.id);
              this.dialogRef.close({ updatedContainer });
            },
            error: (error) => {
              console.error('Error installing APKs:', error);
              this.snack.open("Error installing one or more APKs", "OK");
            }
          });
        });
    } else {
      // Install APKs sequentially
      const installApks = this.selectedApks.reduce((obs, apk) => {
        return obs.pipe(
          concatMap(() => this.installAPK(apk.id, this.data.runningContainer))
        );
      }, of(null));

      installApks.subscribe({
        next: () => {
          // Update apk_file list after all installations
          this.data.runningContainer.apk_file = this.selectedApks.map(apk => apk.id);
          this.dialogRef.close({ updatedContainer: this.data.runningContainer });
        },
        error: (error) => {
          console.error('Error installing APKs:', error);
          this.snack.open("Error installing one or more APKs", "OK");
        }
      });
    }
  }

  installAPK(apk_id, container): Observable<any> {
    if (!this.selectedApks.length) {
      this.snack.open("Please select at least one APK before installing.", "OK");
      return throwError(() => new Error("No APKs selected"));
    }
    let updateData = { apk_file: apk_id };
    return this._api.updateMobile(this.data.runningContainer.id, updateData).pipe(
      map((response: any) => {
        if (response && response.containerservice) {
          container = response.containerservice;
          this.snack.open(
            `APK Installed in the mobile ${this.data.mobile.mobile_image_name}`,
            'OK'
          );
          this._cdr.detectChanges();
          return response;
        } else {
          this.snack.open(response.message, 'OK');
          throw new Error(response.message);
        }
      }),
      catchError(error => {
        console.error('An error occurred while installing APK', error);
        this.snack.open('Failed to install APK', 'OK');
        return throwError(() => error);
      })
    );
  }

  // Not implementated yet in backend
  // removeInstalledApk(apk: any): void {
  //   let updatedApkList = this.data.runningContainer.apk_file.filter(id => id !== apk.id);
  //   let updateData = { apk_file: apk.id };

  //   if (!apk.id) {
  //     console.error("APK ID is missing!", apk);
  //     return;
  //   }

  //   this.isRemovingApk[apk.id] = true;

  //   this._api.updateMobile(this.data.runningContainer.id, updateData).subscribe(
  //     (response: any) => {
  //       if (response && response.containerservice) {
  //         this.snack.open(`APK "${apk.name}" uninstalled successfully`, 'OK');
  //         this.data.runningContainer.apk_file = updatedApkList;
  //         this.installedApks = this.data.uploadedAPKsList.filter(apk =>
  //           updatedApkList.includes(apk.id)
  //         );
  //         this._cdr.detectChanges();
  //       } else {
  //         this.isRemovingApk[apk.id] = false;
  //         this.snack.open(response.message, 'OK');
  //       }
  //     },
  //     error => {
  //       this.isRemovingApk[apk.id] = false;
  //       console.error('Error removing APK:', error);
  //       this.snack.open('Failed to remove APK', 'OK');
  //     }
  //   );
  // }

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
