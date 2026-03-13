import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Inject,
} from '@angular/core';

import {
  MatDialogRef,
  MatDialog,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReactiveFormsModule, FormsModule, FormGroup, Validators, FormBuilder } from '@angular/forms';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ContextMenuModule } from '@perfectmemory/ngx-contextmenu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
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
    MatFormFieldModule,
    MatSelectModule,
    ReactiveFormsModule,
    NgFor,
    MatOptionModule,
    MatInputModule,
    NgClass,
    MatTooltipModule,
    ContextMenuModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    AsyncPipe,
    TitleCasePipe,
    KeyValuePipe,
    TranslateModule,
    MatDialogModule,
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
  isSaving = false;

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
    // Load already installed APKs
    if (this.data.runningContainer && this.data.runningContainer.apk_file) {
      this.installedApks = this.data.uploadedAPKsList.filter(apk =>
        this.data.runningContainer.apk_file.includes(apk.id)
      );
    } else {
      this.installedApks = [];
    }
    
    // Clear any previously selected APKs
    this.selectedApks = [];
    
    // Log for debugging
    this.logger.msg("1", "Installed APKs loaded:", "modify-emulator", {
      count: this.installedApks.length,
      apkIds: this.data.runningContainer?.apk_file || [],
      apkNames: this.installedApks.map(apk => apk.name)
    });
  }

  onSelectApp(event: any): void {
    const selectedApp = event.value;
    if (selectedApp && !this.selectedApks.some(apk => apk.id === selectedApp.id)) {
      // Check if APK is already installed
      const isAlreadyInstalled = this.installedApks.some(apk => apk.id === selectedApp.id);
      if (isAlreadyInstalled) {
        this.snack.open(
          `APK "${selectedApp.name}" is already installed`,
          'OK',
          { duration: 3000 }
        );
        this.editMobileForm.get('selectedApp')?.reset();
        return;
      }
      
      this.selectedApks.push(selectedApp);
      this.editMobileForm.get('selectedApp')?.reset();
    }
  }

  // Eliminar un APK seleccionado
  removeSelectedApk(apk: any, index: number): void {
    this.selectedApks.splice(index, 1);
  }

  isApkSelected(apk: any): boolean {
    // Check if APK is selected for installation
    const isSelected = this.selectedApks.some(selected => selected.id === apk.id);
    // Check if APK is already installed
    const isInstalled = this.installedApks.some(installed => installed.id === apk.id);
    
    return isSelected || isInstalled;
  }

  closeDialog(): void {
    this.dialogRef.close(false);
  }

  saveChanges(): void {
    this.isSaving = true;
    
    const selectedApp = this.editMobileForm.value.selectedApp;
    const isShared = this.editMobileForm.value.shared;
    const currentSharedStatus = this.data.runningContainer?.shared;

    // Check if there are any changes to save
    const hasSharedChanges = currentSharedStatus !== isShared;
    const hasNewApks = this.selectedApks.length > 0;
    
    // If no changes, just close the dialog without updating
    if (!hasSharedChanges && !hasNewApks) {
      this.isSaving = false;
      this.dialogRef.close({ updatedContainer: this.data.runningContainer });
      return;
    }

    if (this.editMobileForm.valid && hasSharedChanges) {
      this.logger.msg("1", "App-seleccionada:", "modify-emulator", selectedApp);
      this.updateSharedStatus({ checked: isShared }, this.data.mobile, this.data.runningContainer)
        .subscribe({
          next: (updatedContainer: any) => {
          // Install APKs sequentially if there are new ones
          if (hasNewApks) {
            const installApks = this.selectedApks.reduce((obs, apk) => {
              return obs.pipe(
                concatMap(() => this.installAPK(apk.id, updatedContainer))
              );
            }, of(null));

            installApks.subscribe({
              next: () => {
                // Update apk_file list after all installations
                // Preserve existing APKs and add new ones
                const existingApks = updatedContainer.apk_file || [];
                const newApkIds = this.selectedApks.map(apk => apk.id);
                updatedContainer.apk_file = this.mergeApkIds(existingApks, newApkIds);
                this.isSaving = false;
                this.dialogRef.close({ updatedContainer });
              },
              error: (error) => {
                console.error('Error installing APKs:', error);
                this.isSaving = false;
                this._cdr.detectChanges();
              }
            });
          } else {
            // Only shared status changed, no new APKs
            this.isSaving = false;
            this.dialogRef.close({ updatedContainer });
          }
        },
                  error: (error) => {
            console.error('Error updating shared status:', error);
            this.isSaving = false;
            this._cdr.detectChanges();
          }
        });
    } else {
      // Only installing new APKs, shared status unchanged
      if (hasNewApks) {
        const installApks = this.selectedApks.reduce((obs, apk) => {
          return obs.pipe(
            concatMap(() => this.installAPK(apk.id, this.data.runningContainer))
          );
        }, of(null));

        installApks.subscribe({
          next: () => {
            // Update apk_file list after all installations
            // Preserve existing APKs and add new ones
            const existingApks = this.data.runningContainer.apk_file || [];
            const newApkIds = this.selectedApks.map(apk => apk.id);
            this.data.runningContainer.apk_file = this.mergeApkIds(existingApks, newApkIds);
            this.isSaving = false;
            this.dialogRef.close({ updatedContainer: this.data.runningContainer });
          },
          error: (error) => {
            console.error('Error installing APKs:', error);
            this.isSaving = false;
            this._cdr.detectChanges();
          }
        });
      } else {
        // No changes at all
        this.isSaving = false;
        this.dialogRef.close({ updatedContainer: this.data.runningContainer });
      }
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
          // Check if the error is due to APK already being installed
          const errorMessage = response.message || 'Unknown error occurred';
          if (errorMessage.toLowerCase().includes('already installed') || 
              errorMessage.toLowerCase().includes('already exists')) {
            this.snack.open(`APK is already installed in the mobile`, 'OK');
            // Still return success since the APK is already there
            return response;
          } else {
            this.snack.open(errorMessage, 'OK');
            throw new Error(errorMessage);
          }
        }
      }),
      catchError(error => {
        console.error('An error occurred while installing APK', error);
        
        // Check if it's a network error or server error
        let errorMessage = 'Failed to install APK';
        if (error.status === 0) {
          errorMessage = 'Network error: Unable to connect to server';
        } else if (error.status >= 500) {
          errorMessage = 'Server error: Please try again later';
        } else if (error.error && error.error.message) {
          errorMessage = error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        this.snack.open(errorMessage, 'OK', {
          panelClass: 'high-z-index-snackbar'
        });
        return throwError(() => error);
      })
    );
  }

  // Remove installed APK
  removeInstalledApk(apk: any): void {
    if (!apk.id) {
      console.error("APK ID is missing!", apk);
      return;
    }

    this.isRemovingApk[apk.id] = true;

    let updateData = { apk_file_remove: apk.id };

    this._api.updateMobile(this.data.runningContainer.id, updateData).subscribe({
      next: (response: any) => {
        if (response && response.containerservice) {
          this.snack.open(`APK "${apk.name}" uninstalled successfully`, 'OK');
          
          // Update local data
          this.data.runningContainer = response.containerservice;
          
          // Update installed APKs list
          this.installedApks = this.data.uploadedAPKsList.filter(apk =>
            this.data.runningContainer.apk_file.includes(apk.id)
          );
          
          this._cdr.detectChanges();
        } else {
          this.snack.open(response.message || 'Failed to uninstall APK', 'OK');
        }
        this.isRemovingApk[apk.id] = false;
      },
      error: (error) => {
        this.isRemovingApk[apk.id] = false;
        console.error('Error removing APK:', error);
        
        // Enhanced error handling
        let errorMessage = 'Failed to remove APK';
        if (error.status === 0) {
          errorMessage = 'Network error: Unable to connect to server';
        } else if (error.status >= 500) {
          errorMessage = 'Server error: Please try again later';
        } else if (error.error && error.error.message) {
          errorMessage = error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        this.snack.open(errorMessage, 'OK', {
          panelClass: 'high-z-index-snackbar'
        });
      }
    });
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

  importClipboard(androidVersion: string) {
    navigator.clipboard.writeText(androidVersion).then(() => {
      this.isIconActive[androidVersion] = true;
      setTimeout(() => {
        this.isIconActive[androidVersion] = false;
        this._cdr.detectChanges();
      }, 3000);
    });
  }

  openNoVNC(): void {
    if (this.data.runningContainer && this.data.runningContainer.service_id) {
      // Check if container is in a valid state for noVNC
      if (this.data.runningContainer.service_status === 'Stopped' || 
          this.data.runningContainer.service_status === 'Pausing' || 
          this.data.runningContainer.service_status === 'Restarting') {
        this.snack.open('Mobile device is not ready for noVNC connection', 'OK', { duration: 3000 });
        return;
      }
      
      // Use the same URL format as the main component
      const complete_url = `/live-session/vnc.html?autoconnect=true&path=mobile/${this.data.runningContainer.service_id}`;
      window.open(complete_url, '_blank');
      
      this.snack.open('Opening noVNC in a new tab...', 'OK', { duration: 2000 });
    } else {
      this.snack.open('Mobile device not available for noVNC', 'OK', { duration: 3000 });
    }
  }

  /**
   * Merges existing APK IDs with new ones, avoiding duplicates
   * @param existingApks Array of existing APK IDs
   * @param newApkIds Array of new APK IDs to add
   * @returns Array with merged APK IDs without duplicates
   */
  private mergeApkIds(existingApks: any[], newApkIds: number[]): any[] {
    const existingSet = new Set(existingApks);
    newApkIds.forEach(id => existingSet.add(id));
    return Array.from(existingSet);
  }

}
