/**
 * l1-feature-item-list.component.ts
 *
 * Contains the code to control the behaviour of the item list (each feature is a squared item) in the new landing
 *
 * @author dph000
 */
import { Component, OnInit, Input, ChangeDetectorRef, OnDestroy, HostListener } from '@angular/core';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { Observable, switchMap, tap, map, filter, take, Subject, takeUntil } from 'rxjs';
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
  NgFor,
  NgClass,
  NgSwitch,
  NgSwitchCase,
  AsyncPipe,
  LowerCasePipe,
} from '@angular/common';
import { StarredService } from '@services/starred.service';
import '../../utils/api-debug-utils';

@Component({
  selector: 'cometa-l1-feature-item-list',
  templateUrl: './l1-feature-item-list.component.html',
  styleUrls: ['./l1-feature-item-list.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    LetDirective,
    MatLegacyTooltipModule,
    NgClass,
    MatIconModule,
    StopPropagationDirective,
    MatLegacyProgressSpinnerModule,
    NgSwitch,
    NgSwitchCase,
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
    AsyncPipe,
    LowerCasePipe,
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
    private starredService: StarredService,
  ) {}

  // Receives the item from the parent component
  @Input() item: any;
  @ViewSelectSnapshot(UserState.GetPermission('create_feature'))
  canCreateFeature: boolean;
  @Input() feature_id: number;
  folderName: string | null = null;
  private hasHandledMouseOver = false;
  private hasHandledMouseOverFolder = false;
  finder: boolean = false;
  running: boolean = false;
  isButtonDisabled: boolean = false;
  running$: Observable<boolean>;
  private lastClickTime: number = 0;
  private readonly CLICK_DEBOUNCE_TIME: number = 1000; // 1 second debounce time
  private destroy$ = new Subject<void>();
  public isRefreshingData: boolean = false;
  private lastDataUpdate: number = 0; // Track the last time data was updated

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
  

  // NgOnInit
  ngOnInit() {
    this.log.msg('1', 'Initializing component...', 'feature-item-list');

    this.feature$ = this._store.select(
      CustomSelectors.GetFeatureInfo(this.feature_id)
    );

    // Subscribe to the status message coming from NGXS
    this.featureStatus$ = this._store.select(
      CustomSelectors.GetFeatureStatus(this.feature_id)
    ).pipe(
      tap(status => {
        if (status === 'Feature completed' || status === 'completed' || status === 'success' || status === 'failed' || status === 'canceled' || status === 'stopped') {
          // Update feature information from backend when feature completes
          // This ensures the total steps, execution time, and date are refreshed
          this._store.dispatch(new Features.UpdateFeature(this.feature_id));
          this.cdr.detectChanges();
        }
      }),
      takeUntil(this.destroy$)
    );

    // Nos aseguramos de que el observable esté suscrito
    this.featureStatus$.pipe(
      takeUntil(this.destroy$)
    ).subscribe();

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
      }),
      takeUntil(this.destroy$)
    );

    // Nos aseguramos de que el observable esté suscrito
    this.featureRunning$.pipe(
      takeUntil(this.destroy$)
    ).subscribe();

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

    this._sharedActions.filterState$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(isActive => {
      this.finder = isActive;
    });

    this.isStarred$ = this.starredService.isStarred(this.feature_id);

    // Actualizar datos del feature si no están disponibles
    this.updateFeatureDataIfNeeded();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Actualiza los datos del feature solo si es necesario y no se han actualizado recientemente
   */
  private updateFeatureDataIfNeeded(): void {
    // Solo actualizar si no hay datos o si los datos están desactualizados
    if (!this.item.total && !this.item.time && !this.item.date) {
      this.refreshFeatureData();
    } else {
      // También actualizar si han pasado más de 5 minutos desde la última actualización
      // para asegurar que los datos estén actualizados después de borrar resultados
      const lastUpdate = this.lastDataUpdate || 0;
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000; // 5 minutos en milisegundos
      
      if (now - lastUpdate > fiveMinutes) {
        this.refreshFeatureData();
      }
    }
  }

  /**
   * Refresca los datos del feature desde la API de manera controlada
   */
  private refreshFeatureData(): void {
    // Evitar múltiples llamadas simultáneas
    if (this.isRefreshingData) {
      return;
    }

    this.isRefreshingData = true;

    this._api.getFeatureResultsByFeatureId(this.feature_id, {
      archived: false,
      page: 1,
      size: 1,
    }).pipe(
      takeUntil(this.destroy$),
      take(1) // Solo tomar la primera respuesta
    ).subscribe({
      next: (response: any) => {
        if (response && response.results && response.results.length > 0) {
          const latestResult = response.results[0];
          
          // Actualizar solo si los datos son diferentes
          if (this.item.total !== latestResult.total || 
              this.item.time !== latestResult.execution_time || 
              this.item.date !== latestResult.result_date) {
            
            this.item.total = latestResult.total || 0;
            this.item.time = latestResult.execution_time || 0;
            this.item.date = latestResult.result_date || null;
            
            this.cdr.detectChanges();
          }
        } else {
          // Si no hay resultados, limpiar los datos
          this.item.total = 0;
          this.item.time = 0;
          this.item.date = null;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error fetching feature results:', err);
      },
      complete: () => {
        this.isRefreshingData = false;
        this.lastDataUpdate = Date.now(); // Update the last data update time
      }
    });
  }

  /**
   * Método público para refrescar datos (puede ser llamado desde el template o eventos externos)
   */
  public refreshData(): void {
    this.refreshFeatureData();
  }

  /**
   * Listener para detectar cuando la página se vuelve visible (después de navegar de vuelta)
   */
  @HostListener('window:focus')
  onWindowFocus(): void {
    // Actualizar datos cuando la ventana vuelve a tener foco (después de navegar de vuelta)
    this.updateFeatureDataIfNeeded();
  }

  /**
   * Listener para detectar cuando el documento se vuelve visible
   */
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (!document.hidden) {
      // Actualizar datos cuando el documento se vuelve visible
      this.updateFeatureDataIfNeeded();
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
    this.departmentFolders$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(
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

  findFolderAndNavigate(departments: any[], folder_id: number, path: string, folderNameBoolean: boolean): { result: string | null, folderName: string | null, foldersToOpen: string[] } {
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

    this.departmentFolders$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(
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
      take(1),
      takeUntil(this.destroy$)
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

  /**
   * Get email notification tooltip text
   */
  getEmailTooltip(): string {
    let tooltip = 'Email notifications enabled. Recipients: ';
    
    if (this.item.reference?.email_address && this.item.reference.email_address.length > 0) {
      tooltip += this.item.reference.email_address.join(', ');
    }
    
    if (this.item.reference?.email_cc_address && this.item.reference.email_cc_address.length > 0) {
      tooltip += ` (CC: ${this.item.reference.email_cc_address.join(', ')})`;
    }
    
    if (this.item.reference?.email_bcc_address && this.item.reference.email_bcc_address.length > 0) {
      tooltip += ` (BCC: ${this.item.reference.email_bcc_address.join(', ')})`;
    }
    
    return tooltip;
  }

  /**
   * Get Telegram notification tooltip text
   */
  getTelegramTooltip(): string {
    let tooltip = 'Telegram notifications enabled';
    
    if (this.item.reference?.telegram_options?.override_chat_ids) {
      tooltip += `. Custom chat IDs: ${this.item.reference.telegram_options.override_chat_ids}`;
    } else {
      tooltip += '. Using department settings';
    }
    
    return tooltip;
  }

  /**
   * Get network login tooltip text
   */
  getNetworkLoginTooltip(): string {
    console.log(this.item.reference);
    return 'Network logging enabled. This feature will record network responses and analyze vulnerable headers.';
  }

  /**
   * Get generate dataset tooltip text
   */
  getGenerateDatasetTooltip(): string {
    return 'Dataset generation enabled for this feature';
  }

  /**
   * Get browsers tooltip text
   */
  getBrowsersTooltip(): string {
    if (!this.item.browsers || this.item.browsers.length === 0) {
      return 'No browsers selected';
    }
    
    // Group browsers by type
    const browsersByType = new Map<string, any[]>();
    
    this.item.browsers.forEach(browser => {
      const browserType = browser.browser;
      if (!browsersByType.has(browserType)) {
        browsersByType.set(browserType, []);
      }
      browsersByType.get(browserType)!.push(browser);
    });
    
    // Build organized tooltip text
    const tooltipLines: string[] = [];
    
    browsersByType.forEach((browsers, browserType) => {
      if (browsers.length === 1) {
        // Single version
        const version = browsers[0].browser_version || 'latest';
        tooltipLines.push(`${browserType} ${version}`);
      } else {
        // Multiple versions
        const versions = browsers.map(browser => browser.browser_version || 'latest').join(', ');
        tooltipLines.push(`${browserType} (${versions})`);
      }
    });
    
    return tooltipLines.join('\n');
  }

  /**
   * Get unique browser types (grouped by browser name to avoid duplicates)
   */
  getUniqueBrowsers(): any[] {
    if (!this.item.browsers || this.item.browsers.length === 0) {
      return [];
    }
    
    // Group browsers by browser type and return unique ones
    const uniqueBrowsers = new Map<string, any>();
    
    this.item.browsers.forEach(browser => {
      const browserType = browser.browser;
      if (!uniqueBrowsers.has(browserType)) {
        uniqueBrowsers.set(browserType, browser);
      }
    });
    
    return Array.from(uniqueBrowsers.values());
  }

  /**
   * Get tooltip for unique browser showing all versions
   */
  getUniqueBrowserTooltip(browserType: string): string {
    if (!this.item.browsers || this.item.browsers.length === 0) {
      return '';
    }
    
    // Get all browsers of this type
    const browsersOfType = this.item.browsers.filter(browser => browser.browser === browserType);
    
    if (browsersOfType.length === 1) {
      return `${browserType} ${browsersOfType[0].browser_version || ''}`.trim();
    } else {
      // Multiple versions of the same browser
      const versions = browsersOfType.map(browser => browser.browser_version || 'latest').join(', ');
      return `${browserType} (${versions})`;
    }
  }

  // Track function for browser icons to optimize rendering
  trackBrowser(index: number, browser: any): string {
    return browser.browser + browser.browser_version + browser.os + browser.os_version;
  }

}

