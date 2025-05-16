/**
 * l1-feature-item-list.component.ts
 *
 * Contains the code to control the behaviour of the item list (each feature is a squared item) in the new landing
 *
 * @author dph000
 */
import { Component, OnInit, Input, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { Observable, switchMap, tap, map, filter, take } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { observableLast, Subscribe } from 'ngx-amvara-toolbox';
import { NavigationService } from '@services/navigation.service';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { SharedActionsService } from '@services/shared-actions.service';
import { Features } from '@store/actions/features.actions';
import { AddFolderComponent } from '@dialogs/add-folder/add-folder.component';
import { ApiService } from '@services/api.service';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { LogService } from '@services/log.service';
import { FeatureRunningPipe } from '../../pipes/feature-running.pipe';
import { DepartmentNamePipe } from '@pipes/department-name.pipe';
import { BrowserComboTextPipe } from '../../pipes/browser-combo-text.pipe';
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { LetDirective } from '../../directives/ng-let.directive';
import {
  NgIf,
  NgClass,
  NgSwitch,
  NgSwitchCase,
  AsyncPipe,
  LowerCasePipe,
} from '@angular/common';
import { StarredService } from '@services/starred.service';
import { DeleteConfirmationDialogComponent } from '../delete-confirmation-dialog/delete-confirmation-dialog.component';
import { RestoreConfirmationDialogComponent } from '../restore-confirmation-dialog/restore-confirmation-dialog.component';


@Component({
  selector: 'cometa-l1-feature-item-list',
  templateUrl: './l1-feature-item-list.component.html',
  styleUrls: ['./l1-feature-item-list.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    NgClass,
    NgSwitch,
    NgSwitchCase,
    AsyncPipe,
    LowerCasePipe,
    LetDirective,
    MatIconModule,
    MatLegacyTooltipModule,
    MatLegacyButtonModule,
    MatLegacyMenuModule,
    MatDividerModule,
    MatLegacyCheckboxModule,
    TranslateModule,
    AmParsePipe,
    AmDateFormatPipe,
    SecondsToHumanReadablePipe,
    BrowserComboTextPipe,
    DepartmentNamePipe,
    FeatureRunningPipe,
    StopPropagationDirective,
    MatLegacyProgressSpinnerModule,
  ],
})
export class L1FeatureItemListComponent implements OnInit, OnDestroy {
  constructor(
    private _router: NavigationService,
    private _store: Store,
    public _sharedActions: SharedActionsService,
    private _dialog: MatDialog,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
    private log: LogService,
    private cdr: ChangeDetectorRef,
    private starredService: StarredService
  ) {}

  // Receives the item from the parent component
  @Input() item: any;
  @ViewSelectSnapshot(UserState.GetPermission('create_feature'))
  canCreateFeature: boolean;
  @Input() feature_id: number;
  @Input() isTrashbin: boolean = false;
  folderName: string | null = null;
  private hasHandledMouseOver = false;
  private hasHandledMouseOverFolder = false;
  finder: boolean = false;
  running: boolean = false;
  isButtonDisabled: boolean = false;
  running$: Observable<boolean>;
  private lastClickTime: number = 0;
  private readonly CLICK_DEBOUNCE_TIME: number = 1000; // 1 second debounce time

  /**
   * Global variables
   */
  feature$: Observable<Feature>;
  featureRunning$: Observable<boolean>;
  featureStatus$: Observable<string>;
  canEditFeature$: Observable<boolean>;
  canDeleteFeature$: Observable<boolean>;
  isAnyFeatureRunning$: Observable<boolean>;
  departmentFolders$: Observable<Folder[]>;
  isStarred$: Observable<boolean>;
  
  private deletionCheckInterval: any;
  private readonly CHECK_INTERVAL = 1000; // Check every second
  private readonly WARNING_THRESHOLD = 5; // Show warning when less than 5 seconds remaining
  private readonly EXPIRATION_TIME = 10; // Feature will be deleted after 10 seconds

  // NgOnInit
  ngOnInit() {
    this.log.msg('1', 'Initializing component...', 'feature-item-list');

    this.feature$ = this._store.select(
      CustomSelectors.GetFeatureInfo(this.feature_id)
    );

    // Subscribe to the status message comming from NGXS
    this.featureStatus$ = this._store.select(
      CustomSelectors.GetFeatureStatus(this.feature_id)
    ).pipe(
      tap(status => {
        if (status === 'Feature completed' || status === 'completed' || status === 'success' || status === 'failed' || status === 'canceled' || status === 'stopped') {
          this.isButtonDisabled = false;
          this.cdr.detectChanges();
        }
      })
    );

    // Nos aseguramos de que el observable esté suscrito
    this.featureStatus$.subscribe();

    // También actualizamos el estado cuando el feature deja de estar en ejecución
    this.featureRunning$ = this._store.select(
      CustomSelectors.GetFeatureRunningStatus(this.feature_id)
    ).pipe(
      tap(running => {
        
        if (!running) {
          // console.log('Feature stopped running, resetting states');
          this.isButtonDisabled = false;
          this.cdr.detectChanges();
        }
      })
    );

    // Nos aseguramos de que el observable esté suscrito
    this.featureRunning$.subscribe();

    this.canEditFeature$ = this._store.select(
      CustomSelectors.HasPermission('edit_feature', this.feature_id)
    );
    this.canDeleteFeature$ = this._store.select(
      CustomSelectors.HasPermission('delete_feature', this.feature_id)
    );

    this.isAnyFeatureRunning$ = this._sharedActions.folderRunningStates.asObservable().pipe(
      map(runningStates => runningStates.get(this.item.id) || false)
    );

    this.departmentFolders$ = this._store.select(CustomSelectors.GetDepartmentFolders())

    this._sharedActions.filterState$.subscribe(isActive => {
      this.finder = isActive;
    });

    this.isStarred$ = this.starredService.isStarred(this.feature_id);

    // Start periodic check for expired features
    if (this.isTrashbin) {
      this.startDeletionCheck();
    }
  }

  ngOnDestroy() {
    if (this.deletionCheckInterval) {
      clearInterval(this.deletionCheckInterval);
    }
  }

  private startDeletionCheck() {
    // Initial check
    this.checkFeatureExpiration();
    
    // Set up periodic check
    this.deletionCheckInterval = setInterval(() => {
      this.checkFeatureExpiration();
    }, this.CHECK_INTERVAL);
  }

  private checkFeatureExpiration() {
    if (!this.isTrashbin || !this.item) {
      console.log('[Expiration Check] Skipping - isTrashbin:', this.isTrashbin, 'item exists:', !!this.item);
      return;
    }
    
    const remainingSeconds = this.getDaysSinceMarked(this.item.marked_for_deletion_date);
    console.log('[Expiration Check] Remaining seconds:', remainingSeconds);
    
    // Mostrar notificación cuando queden pocos segundos
    if (remainingSeconds <= 0) {
      console.log('[Expiration Check] Feature has expired, triggering deletion:', this.item.id);
      this._snackBar.open(`Feature ${this.item.name} (ID: ${this.item.id}) will be deleted in 5 seconds...`, 'OK', { duration: 5000 });
      
      // Esperar 5 segundos antes de eliminar para que el usuario pueda ver la notificación
      setTimeout(() => {
        this.checkAndDeleteExpiredFeature();
      }, 5000);
    } else if (remainingSeconds <= this.WARNING_THRESHOLD) {
      // Mostrar advertencia cuando queden pocos segundos
      this._snackBar.open(`Feature ${this.item.name} (ID: ${this.item.id}) will be deleted in ${remainingSeconds} seconds`, 'OK', { duration: 1000 });
    }
  }

  async goLastRun() {
    const feature = await observableLast<Feature>(this.feature$);
    this._router.navigate(
      [
        `/${feature.info.app_name}`,
        feature.info.environment_name,
        feature.info.feature_id,
        'step',
        feature.info.feature_result_id,
      ],
      {
        queryParams: {
          runNow: 1,
        },
      }
    );
  }

  /**
   * Folder control functions
   */

  // Go to the clicked folder
  goFolder(route: Folder[]) {
    this.log.msg('1', 'Opening folder...', 'feature-item-list', route);
    // dispach the route of clicked folder
    this._store.dispatch(new Features.SetFolderRoute(route));

    // get absolute path of current route, including department
    const currentRoute = this._store.snapshot().features.currentRouteNew;

    // add clicked folder's id hierarchy to url params
    this._sharedActions.set_url_folder_params(currentRoute);
  }

  // Modify the clicked folder
  modify(folder: Folder) {
    this._dialog.open(AddFolderComponent, {
      autoFocus: true,
      data: {
        mode: 'edit',
        folder: folder,
        featureId: this.item.id
      } as IEditFolder,
    });
  }

  // Delete the clicked folder
  @Subscribe()
  delete(folder: Folder) {
    this.log.msg('1', 'Deleting folder...', 'feature-item-list', folder);
    return this._api.removeFolder(folder.folder_id).pipe(
      switchMap(_ => this._store.dispatch(new Features.GetFolders())),
      tap(_ => this._snackBar.open(`Folder ${folder.name} removed`, 'OK'))
    );
  }

  // Moves the selected folder
  SAmoveFolder(folder: Folder) {
    this.log.msg('1', 'Moving folder...', 'feature-item-list', folder);
    this._sharedActions.moveFolder(folder);
  }

  // Moves the selected feature
  SAmoveFeature(feature: Feature) {
    this.log.msg('1', 'Moving feature...', 'feature-item-list', feature);
    this._sharedActions.moveFeature(feature);
  }

  handleMouseOver(event: MouseEvent): void {
    if (this.hasHandledMouseOver) {
      return;
    }
    this.hasHandledMouseOver = true;
    this.featuresGoToFolder(this.item.id, '', false);
  }

  handleMouseOverFolder(event: MouseEvent): void {
    if (this.hasHandledMouseOverFolder) {
      return;
    }
    this.hasHandledMouseOverFolder = true;
    this.folderGoToFolder(this.item.id, false);
  }

  folderGoToFolder(folder_id: number, folderNameBoolean: boolean){
    this.departmentFolders$.subscribe(
      alldepartments => {
        const { result, folderName, foldersToOpen } = this.findFolderAndNavigate(alldepartments, folder_id, '', folderNameBoolean);

        if (result && folderNameBoolean) {
          this.openFolderInLocalStorage(foldersToOpen);
          const url = `/new/${result}`;
          this._router.navigate([url]);
        }
      },
      error => {
        console.error("Error obtaining Departments:", error);
       }
    );
  }

  findFolderAndNavigate(departments: any[], folder_id: number, path: string, folderNameBoolean): { result: string | null, folderName: string | null, foldersToOpen: string[] } {
    for (const department of departments) {
      for (const folder of department.folders) {

        if (folder.folder_id === folder_id) {
          const finalFolderName = folderNameBoolean ? folder.name : department.name;
          if(!folderNameBoolean){
            this.folderName = department.name;
          }
          return { result: `:${department.folder_id}`, folderName: finalFolderName,  foldersToOpen: [department.name, folder.name] };
        }

        const { result, folderName, foldersToOpen } = this.processFolder(folder, folder_id, path, folder.name, department.folder_id);
        if (result) {
          return { result, folderName, foldersToOpen: [this.item.department, ...foldersToOpen] };
        }
      }
    }
    return { result: null, folderName: null, foldersToOpen: [] };
  }

  processFolder(folder: any, folder_id: number, path: string, parentFolderName: string, department_id: number ): { result: string | null, folderName: string | null, foldersToOpen: string[] } {

    if (folder.folder_id === folder_id) {
      this.folderName = parentFolderName;
      return { result: `${path}:${folder.folder_id}`, folderName: parentFolderName,foldersToOpen: [folder.name]  };
    }

    for (const subfolder of folder.folders) {
      const resultPath = `${path}:${folder.folder_id}`;
      const { result, folderName, foldersToOpen } = this.processFolder(subfolder, folder_id, resultPath, folder.name, department_id);
      if (result) {
        return { result, folderName, foldersToOpen: [folder.name, ...foldersToOpen] };
      }
    }
    return { result: null, folderName: null, foldersToOpen: []  };
  }


  goToDomain(department_id: number) {
    department_id = this.item.reference.department_id;
    const url = `/new/${department_id}`;
    this._router.navigate([url]);
  }


  featuresGoToFolder(feature_id: number, path = '', folderNameBoolean: boolean): void {
    const department_id = this.item.reference.department_id;
    path += `:${department_id}`;

    this.departmentFolders$.subscribe(
      alldepartments => {
        const { result, folderName, foldersToOpen } = this.findAndNavigate(alldepartments, feature_id, path);
        if (result && folderNameBoolean) {
          this.openFolderInLocalStorage(foldersToOpen);
          const url = `/new/${result}`;
          this._router.navigate([url]);
        }
      },
      error => {
        console.error("Error obtaining Departments:", error);
      }
    );
  }

  findAndNavigate(departments: any[], feature_id: number, path: string): { result: string | null, folderName: string | null, foldersToOpen: string[] } {
    for (const department of departments) {
      for (const subfolder of department.folders) {
        const { result, folderName, foldersToOpen } = this.processSubfolder(subfolder, feature_id, path, subfolder.name);
        if (result) {
          return { result, folderName, foldersToOpen: [this.item.department, ...foldersToOpen] };
        }
      }
    }
    return { result: null, folderName: null, foldersToOpen: [] };
  }

  processSubfolder(folder: any, feature_id: number, path: string, feature_directory: string): { result: string | null, folderName: string | null, foldersToOpen: string[] } {

    if (folder.features.includes(feature_id)) {
      return { result: `${path}:${folder.folder_id}`, folderName: feature_directory,foldersToOpen: [folder.name] };
    }

    for (const subfolder of folder.folders) {
      const { result, folderName, foldersToOpen } = this.processSubfolder(subfolder, feature_id, path + `:${folder.folder_id}`, subfolder.name);
      if (result) {
        this.folderName = folderName;
        return { result, folderName, foldersToOpen: [folder.name, ...foldersToOpen] };
      }
    }
    return { result: null, folderName: null, foldersToOpen: [] };
  }

  openFolderInLocalStorage(foldersToOpen: string[]): void {
    const storedState = JSON.parse(localStorage.getItem('co_folderState')) || {};
    let stateUpdated = false;

    foldersToOpen.forEach(folder => {
      if (!storedState[folder]?.open) {
        storedState[folder] = { open: true };
        stateUpdated = true;
      }
    });

    if (stateUpdated) {
      localStorage.setItem('co_folderState', JSON.stringify(storedState));
    }
  }

  hovering = false;

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this._snackBar.open('ID copied to clipboard!', 'OK', { duration: 2000 });
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }

  async onRunClick() {
    const now = Date.now();
    const timeSinceLastClick = now - this.lastClickTime;

    // Prevent clicks when button is disabled and feature is not running
    if (timeSinceLastClick < this.CLICK_DEBOUNCE_TIME) {
      return;
    }

    // Update the last click time
    this.lastClickTime = now;

    // Prevent clicks when button is disabled and feature is not running
    if (this.isButtonDisabled && !this.running) {
      return;
    }

    // Check if feature has browsers selected
    if (!this.item.browsers || this.item.browsers.length === 0) {
      this._snackBar.open("This feature doesn't have browsers selected.", 'OK');
      return;
    }

    this.isButtonDisabled = true;
    this.cdr.detectChanges();

    try {
      await this._sharedActions.run(this.item.id);
    } catch (error) {
      this.isButtonDisabled = false;
      this.cdr.detectChanges();
    }
  }

  toggleStarred(event: Event): void {
    event.stopPropagation();
    this.starredService.toggleStarred(this.feature_id);
    this.starredService.starredChanges$.pipe(
      filter(event => event?.featureId === this.feature_id),
      take(1)
    ).subscribe(event => {
      this._snackBar.open(
        event?.action === 'add' 
          ? `Feature ${this.item.id} (${this.item.name}) added to favorites` 
          : `Feature ${this.item.id} (${this.item.name}) removed from favorites`,
        'OK',
        { duration: 2000 }
      );
    });
  }

  openDeleteConfirmationDialog(item: any) {
    const dialogRef = this._dialog.open(DeleteConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Schedule Deletion',
        message: `Are you sure you want to schedule the deletion of feature "${item.name}"?`,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Si el feature está en favoritos, lo quitamos
        this.isStarred$.pipe(take(1)).subscribe(isStarred => {
          if (isStarred) {
            this.toggleStarred({} as Event);
          }
        });
        
        // Actualizar el item localmente
        if (item.reference) {
          item.reference.marked_for_deletion = true;
        }
        
        // Programar la eliminación usando el servicio
        this._sharedActions.scheduleDeletion(item.id);
        this._snackBar.open('Feature scheduled for deletion', 'OK', { duration: 2000 });
      }
    });
  }

  restoreFeature(featureId: number) {
    const dialogRef = this._dialog.open(RestoreConfirmationDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        try {
          // Llamar al servicio para restaurar el feature
          this._sharedActions.restoreFeature(featureId).subscribe(
            () => {
              // Actualizar el estado local después de una restauración exitosa
              this._store.dispatch(new Features.GetFeatures());
              this._snackBar.open('Feature restored successfully', 'OK', { duration: 2000 });
            },
            error => {
              console.error('Error restoring feature:', error);
              this._snackBar.open('Error restoring feature', 'OK', { duration: 2000 });
            }
          );
        } catch (error) {
          console.error('Error restoring feature:', error);
          this._snackBar.open('Error restoring feature', 'OK', { duration: 2000 });
        }
      }
    });
  }

  deleteFeature(featureId: number) {
    try {
      this._sharedActions.deleteFeature(featureId);
    } catch (error) {
      console.error('Error deleting feature:', error);
      this._snackBar.open('Error deleting feature', 'OK', { duration: 2000 });
    }
  }

  getDaysSinceMarked(date: string): number {
    // Si no estamos en el trashbin, retornamos 0 sin hacer cálculos
    if (!this.isTrashbin) {
      console.log('[Days Calculation] Not in trashbin, returning 0');
      return 0;
    }
    
    // Intentar obtener la fecha de diferentes ubicaciones posibles
    const deletionDate = this.item?.marked_for_deletion_date || 
                        this.item?.reference?.marked_for_deletion_date || 
                        date;
    
    console.log('[Days Calculation] Using deletion date:', deletionDate);
    
    if (!deletionDate) {
      console.log('[Days Calculation] No deletion date found for feature:', this.item?.id);
      return 0;
    }
    
    try {
      const markedDate = new Date(deletionDate);
      const today = new Date();
      
      // Validate if the date is valid
      if (isNaN(markedDate.getTime())) {
        console.error('[Days Calculation] Invalid date provided:', deletionDate);
        return 0;
      }
      
      // Calcular la diferencia en segundos en lugar de días
      const diffTime = today.getTime() - markedDate.getTime();
      const seconds = Math.ceil(diffTime / 1000);
      const remainingSeconds = Math.max(0, this.EXPIRATION_TIME - seconds); // Período de 10 segundos
      
      console.log('[Days Calculation] Results:', {
        markedDate: markedDate.toISOString(),
        today: today.toISOString(),
        secondsPassed: seconds,
        remainingSeconds: remainingSeconds
      });
      
      return remainingSeconds;
    } catch (error) {
      console.error('[Days Calculation] Error calculating time for feature:', this.item?.id, error);
      return 0;
    } 
  }

  private isDeleting = false;

  private checkAndDeleteExpiredFeature() {
    // Evitar múltiples llamadas simultáneas
    if (this.isDeleting) {
      console.log('[Delete Check] Feature deletion already in progress:', this.item?.id);
      return;
    }

    this.isDeleting = true;
    console.log('[Delete Check] Starting deletion process for feature:', this.item?.id);
    
    // Verificar que el feature aún existe y está marcado para eliminación
    if (this.item?.reference?.marked_for_deletion) {
      console.log('[Delete Check] Feature is marked for deletion, proceeding with deletion:', this.item?.id);
      
      try {
        // Llamar directamente al API para eliminar el feature sin mostrar diálogo
        console.log('[Delete Check] Calling API to delete feature:', this.item?.id);
        this._api.deleteFeature(this.item.id).subscribe(
          () => {
            console.log('[Delete Check] API call successful, feature deleted:', this.item?.id);
            this._snackBar.open(`Feature ${this.item.name} (ID: ${this.item.id}) has been deleted`, 'OK', { duration: 3000 });
            // Actualizar la lista de features
            console.log('[Delete Check] Dispatching GetFeatures to refresh the list');
            this._store.dispatch(new Features.GetFeatures());
          },
          error => {
            console.error('[Delete Check] API call failed to delete feature:', this.item?.id, error);
            this._snackBar.open(`Error deleting feature ${this.item.name} (ID: ${this.item.id})`, 'OK', { duration: 3000 });
          },
          () => {
            console.log('[Delete Check] API call completed, resetting isDeleting flag');
            this.isDeleting = false;
          }
        );
      } catch (error) {
        console.error('[Delete Check] Exception while trying to delete feature:', this.item?.id, error);
        this._snackBar.open(`Error deleting feature ${this.item.name} (ID: ${this.item.id})`, 'OK', { duration: 3000 });
        this.isDeleting = false;
      }
    } else {
      console.log('[Delete Check] Feature is not marked for deletion or reference is missing:', this.item?.id);
      this.isDeleting = false;
    }
  }
}

