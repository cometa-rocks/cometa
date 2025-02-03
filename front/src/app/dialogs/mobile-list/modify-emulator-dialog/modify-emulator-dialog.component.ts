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
import { ReactiveFormsModule, FormsModule, FormGroup, Validators, FormBuilder } from '@angular/forms';
import { BehaviorSubject, map, Observable, Subject, takeUntil } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
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
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { Store } from '@ngxs/store';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { DraggableWindowModule } from '@modules/draggable-window.module'
import { MatExpansionModule } from '@angular/material/expansion';
import { LogService } from '@services/log.service';
import { ApiService } from '@services/api.service';

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
    MatExpansionModule
],
})
export class ModifyEmulatorDialogComponent {

  editMobileForm: FormGroup;


  constructor(
    private _dialog: MatDialog,
    private _cdr: ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private snack: MatSnackBar,
    private _store: Store,
    private _fb: FormBuilder,
    private logger: LogService,
    private _api: ApiService,
  ) {

    this.editMobileForm = this._fb.group({
      selectedApp: [null, Validators.required]  // Ajusta los validadores según lo que necesites
    });

    // Log para ver los datos que vienen en 'data'
    this.logger.msg("1", "CO-Departments:", "mobile-list", this.data.department_name);

  }

  // // Declare the variable where the API result will be assigned
  // mobiles: IMobile[] = [];
  // runningMobiles: Container[] = [];
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
    console.log("Data: ", this.data)
  }

  closeDialog(): void {
    this._dialog.closeAll();
  }

  // Función para guardar los cambios
  saveChanges(): void {
    if (this.editMobileForm.valid) {
      const selectedApp = this.editMobileForm.value.selectedApp;
      this.logger.msg("1", "App-seleccionada:", "modify-emulator", selectedApp);

      // Si se seleccionó un APK, lo instalamos
      if (selectedApp) {
        // this.installAPK(selectedApp);
      }
    } else {
      this.logger.msg("1", "CO-Departments:", "modify-emulator", 'Formulario no válido');
    }
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

  // // Función para eliminar APKs instalados
  // removeInstalledApk(apk: any, index: number): void {
  //   const confirmDelete = confirm(`Are you sure you want to uninstall ${apk.name}?`);
  //   if (confirmDelete) {
  //     this._api.uninstallAPK(this.selectedDepartment.id, apk.id).subscribe(
  //       (response: any) => {
  //         if (response.success) {
  //           this.installedAPKs.splice(index, 1);
  //           this._cdr.detectChanges();
  //           this.snack.open(`APK ${apk.name} uninstalled successfully`, 'OK', { duration: 3000 });
  //         } else {
  //           this.snack.open(`Failed to uninstall APK: ${response.message}`, 'OK', { duration: 3000 });
  //         }
  //       },
  //       error => {
  //         console.error("Error uninstalling APK:", error);
  //         this.snack.open("Error uninstalling APK", 'OK', { duration: 3000 });
  //       }
  //     );
  //   }
  // }
}
