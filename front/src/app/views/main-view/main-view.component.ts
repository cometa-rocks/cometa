import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions, ofActionDispatched, Select } from '@ngxs/store';
import { combineLatest, Observable, fromEvent, Subject } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { map, takeUntil, distinctUntilChanged, debounceTime } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngxs/store';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { HttpClient } from '@angular/common/http';
import { PageEvent } from '@angular/material/paginator';
import { SharedActionsService } from '@services/shared-actions.service';
import { WebSockets } from '@store/actions/results.actions';
import { Configuration } from '@store/actions/config.actions';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VideoComponent } from '@dialogs/video/video.component';
import { ApiService } from '@services/api.service';
import { LoadingSnack } from '@components/snacks/loading/loading.snack';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { PdfLinkPipe } from '@pipes/pdf-link.pipe';
import { DownloadService } from '@services/download.service';
import { InterceptorParams } from 'ngx-network-error';
import { PixelDifferencePipe } from '@pipes/pixel-difference.pipe';
import { BrowserIconPipe } from '@pipes/browser-icon.pipe';
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { LetDirective } from '../../directives/ng-let.directive';
import { BehaveChartTestComponent } from '../../components/behave-charts/behave-chart.component';
import { NgClass, NgIf, AsyncPipe, TitleCasePipe } from '@angular/common';
import { FeatureActionsComponent } from '../../components/feature-actions/feature-actions.component';
import { FeatureTitlesComponent } from '../../components/feature-titles/feature-titles.component';
import { ElementRef } from '@angular/core';
import { LogService } from '@services/log.service';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatBadgeModule } from '@angular/material/badge';
import { UserState } from '@store/user.state';
import { Features } from '@store/actions/features.actions';

@UntilDestroy()
@Component({
  selector: 'main-view',
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PdfLinkPipe],
  standalone: true,
  imports: [
    FeatureTitlesComponent,
    FeatureActionsComponent,
    NgClass,
    NgIf,
    BehaveChartTestComponent,
    LetDirective,
    MtxGridModule,
    StopPropagationDirective,
    MatLegacyMenuModule,
    MatDividerModule,
    MatLegacyTooltipModule,
    MatLegacyCheckboxModule,
    MatLegacyButtonModule,
    MatIconModule,
    TranslateModule,
    AmParsePipe,
    AmDateFormatPipe,
    SecondsToHumanReadablePipe,
    BrowserIconPipe,
    PixelDifferencePipe,
    AsyncPipe,
    TitleCasePipe,
    CommonModule,
    MatSelectModule,
    MatBadgeModule
  ],
})
export class MainViewComponent implements OnInit, OnDestroy {
  @Select(CustomSelectors.GetConfigProperty('internal.showArchived'))
  showArchived$: Observable<boolean>;
  
  @Select(UserState.GetPermission('change_result_status'))
  canChangeResultStatus$: Observable<boolean>;

  @Select(CustomSelectors.GetConfigProperty('deleteTemplateWithResults'))
  deleteTemplateWithResults$: Observable<boolean>;

  // Alias for archived state to match template expectations
  get archived$(): Observable<boolean> {
    return this.showArchived$;
  }

  columns: MtxGridColumn[] = [
    {
      header: 'Status',
      field: 'status',
      sortable: true,
      class: 'aligned-center',
    },
    {
      header: 'Execution Date',
      field: 'result_date',
      sortable: true,
      width: '230px',
      sortProp: { start: 'desc', id: 'result_date' },
    },
    {
      header: 'Total',
      field: 'total',
      sortable: true,
      class: 'aligned-center',
    },
    { header: 'OK', field: 'ok', sortable: true, class: 'aligned-center' },
    { header: 'NOK', field: 'fails', sortable: true, class: 'aligned-center' },
    { header: 'Skipped', field: 'skipped', class: 'aligned-center' },
    { header: 'Browser', field: 'browser', class: 'aligned-center' },
    { header: 'Mobile', field: 'mobile', class: 'aligned-center' },
    {
      header: 'Browser Version',
      field: 'browser.browser_version',
      hide: true,
      sortable: true,
      class: 'aligned-center',
    },
    {
      header: 'Duration',
      field: 'execution_time',
      sortable: true,
      class: 'aligned-right',
    },
    { header: 'Description', field: 'description', width: '250px' },
    {
      header: 'Pixel Difference',
      field: 'pixel_diff',
      sortable: true,
      class: 'aligned-right',
    },
    {
      header: 'Options',
      field: 'options',
      width: '290px',
      // pinned: 'right',
      right: '0px',
      type: 'button',
      class: 'options-buttons',
      buttons: [
        {
          type: 'icon',
          text: 'replay',
          icon: 'videocam',
          tooltip: 'View browser test result replay',
          color: 'primary',
          iif: (result: FeatureResult) => (result.video_url ? true : false),
          click: (result: FeatureResult) => this.openVideo(result, result.video_url),
          class: 'replay-button',
        },
        {
          type: 'icon',
          text: 'replay',
          icon: 'videocam',
          tooltip: 'View mobile test result replay',
          color: 'primary',
          iif: (result: FeatureResult) => (result.mobile && result.mobile.length>0),
          click: (result: FeatureResult) => this.openVideo(result, result.mobile[0].video_recording),
          class: 'replay-button-2',
        },
        {
          type: 'icon',
          text: 'pdf',
          icon: 'picture_as_pdf',
          tooltip: 'Download result PDF',
          color: 'primary',
          click: (result: FeatureResult) => {
            const pdfLink = this._pdfLinkPipe.transform(
              result.feature_result_id
            );
            this._http
              .get(pdfLink, {
                params: new InterceptorParams({
                  skipInterceptor: true,
                }),
                responseType: 'text',
                observe: 'response',
              })
              .subscribe({
                next: res => {
                  this._downloadService.downloadFile(res, {
                    mime: 'application/pdf',
                    name: `${result.feature_name}_${result.feature_result_id}.pdf`,
                  });
                },
                error: console.error,
              });
          },
        },
        {
          type: 'icon',
          text: 'Network Responses',
          icon: 'sync',
          tooltip: 'You can see network responses',
          color: 'accent',
          iif: (result: FeatureResult) =>
            result.network_response_count > 0 &&
            result.vulnerable_response_count == 0,
        },
        {
          type: 'icon',
          text: 'Vulnerable Network Responses',
          icon: 'sync_problem',
          tooltip:
            'Refer to the step reports to view vulnerable headers in the network responses.',
          color: 'warn',
          iif: (result: FeatureResult) =>
            result.network_response_count > 0 &&
            result.vulnerable_response_count > 0,
        },
        {
          type: 'icon',
          text: 'archive',
          icon: 'archive',
          tooltip: 'Archive result',
          color: 'accent',
          click: (result: FeatureResult) => {
            this._sharedActions
              .archive(result)
              .pipe(takeUntil(this.destroy$))
              .subscribe(_ => this.getResults());
          },
          iif: (result: FeatureResult) => !result.archived,
        },
        {
          type: 'icon',
          text: 'unarchive',
          icon: 'unarchive',
          tooltip: 'Unarchive result',
          color: 'accent',
          click: (result: FeatureResult) => {
            this._sharedActions
              .archive(result)
              .pipe(takeUntil(this.destroy$))
              .subscribe(_ => this.getResults());
          },
          iif: (result: FeatureResult) => result.archived,
        },
        {
          type: 'icon',
          text: 'delete',
          icon: 'delete',
          tooltip: 'Delete result',
          color: 'warn',
          click: (result: FeatureResult) => {
            this._sharedActions
              .deleteFeatureResult(result)
              .pipe(takeUntil(this.destroy$))
              .subscribe(_ => this.getResults());
          },
          iif: (result: FeatureResult) => !result.archived,
        },
      ],
    },
  ];

  

  results = [];
  total = 0;
  isLoading = false;
  showPagination = true;
  latestFeatureResultId: number = 0;
  archived: boolean = false;
  buttons: any[] = [];
  selectMobile: { [key: number]: any } = {};
  showingFiltered: boolean = false;
  buttonDisabled: boolean = false;

  query = {
    page: 0,
    size: 500,
  };
  get params() {
    const p = { ...this.query };
    p.page += 1;
    return p;
  }

  // Add private properties for subscription management
  private destroy$ = new Subject<void>();
  private isInitialized = false;
  private lastFeatureId: number = 0;
  private lastArchived: boolean = false;

  constructor(
    private _route: ActivatedRoute,
    private _actions: Actions,
    private _store: Store,
    private _router: Router,
    public _sharedActions: SharedActionsService,
    private _http: HttpClient,
    private cdRef: ChangeDetectorRef,
    private _dialog: MatDialog,
    private _snack: MatSnackBar,
    private _api: ApiService,
    private _pdfLinkPipe: PdfLinkPipe,
    private _downloadService: DownloadService,
    private elementRef: ElementRef,
    private logger: LogService
  ) {
    // Ensure initial state is correct
    this.isLoading = false;
    this.isInitialized = false;
  }

  featureId$: Observable<number>;
  originalResults: any[] = [];

  openContent(feature_result: FeatureResult) {
    // this.logger.msg("1", "CO-featResult", "main-view", feature_result);

    this._router.navigate([
      this._route.snapshot.paramMap.get('app'),
      this._route.snapshot.paramMap.get('environment'),
      this._route.snapshot.paramMap.get('feature'),
      'step',
      feature_result.feature_result_id,
    ]);
  }

    getResults() {
    // Prevent multiple simultaneous calls
    if (this.isLoading) {
      return;
    }

    // Prevent calls before initialization
    if (!this.isInitialized) {
      return;
    }

    this.isLoading = true;
    
    combineLatest([
      this.featureId$.pipe(distinctUntilChanged()),
      this.showArchived$.pipe(distinctUntilChanged())
    ])
    .pipe(
      takeUntil(this.destroy$),
      debounceTime(200) // Prevent rapid successive calls
    )
    .subscribe({
      next: ([featureId, archived]) => {
        if (!featureId || featureId <= 0) {
          this.isLoading = false;
          this.cdRef.detectChanges();
          return;
        }

        // Check if parameters have actually changed to avoid unnecessary API calls
        if (this.lastFeatureId === featureId && 
            this.lastArchived === archived && 
            this.results.length > 0) {
          this.isLoading = false;
          this.cdRef.detectChanges();
          return;
        }

        // Update last known values
        this.lastFeatureId = featureId;
        this.lastArchived = archived;
        
        this._http
          .get(`/backend/api/feature_results_by_featureid/`, {
            params: {
              feature_id: featureId,
              archived: archived,
              ...this.params,
            },
          })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res: any) => {
              this.results = res.results;
              this.originalResults = this.results;
              this.total = res.count;
              this.showPagination = this.total > 0 ? true : false;
      
              // set latest feature id
              if (this.showPagination)
                this.latestFeatureResultId = this.results[0].feature_result_id;

              this.checkIfThereAreFailedSteps();
              
              // Update the store to ensure l1-feature-items gets the latest data
              // Only dispatch store actions if we have results and this is not a pagination call
              if (featureId && this.results.length > 0 && this.query.page === 0) {
                this._store.dispatch(new Features.UpdateFeature(featureId));
                this._store.dispatch(new WebSockets.CleanupFeatureResults(featureId));
              }
            },
            error: err => {
              console.error('getResults: HTTP error:', err);
              this.isLoading = false;
              this.cdRef.detectChanges();
            },
            complete: () => {
              this.isLoading = false;
              this.cdRef.detectChanges();
            },
          });
      },
      error: err => {
        console.error('getResults: combineLatest error:', err);
        this.isLoading = false;
        this.cdRef.detectChanges();
      }
    });
  }

  onMobileSelectionChange(event: any, row: FeatureResult): void {
    // Event it's the selected mobile
    const selectedMobile = event.value;

    if (selectedMobile && selectedMobile.video_recording) {
      this.openVideo(row, selectedMobile.video_recording);
    }
  }

  updateData(e: PageEvent) {
    // Only update if page or size actually changed
    if (this.query.page !== e.pageIndex || this.query.size !== e.pageSize) {
      this.query.page = e.pageIndex;
      this.query.size = e.pageSize;
      this.getResults();
    }

    // create a localstorage session
    localStorage.setItem('co_results_page_size', e.pageSize.toString());
  }

  getVulnerabilityMessage(result: FeatureResult): string {
    const message = `${result.vulnerable_response_count} network responses received. `;
    return result.vulnerable_response_count > 0
      ? message +
          `${result.vulnerable_response_count} responses contain vulnerable headers`
      : message;
  }

  /**
   * Performs the overriding action through the Store
   */
  setResultStatus(results: FeatureResult, status: 'Success' | 'Failed' | 'Canceled' | '') {
    this._sharedActions.setResultStatus(results, status)
      .pipe(takeUntil(this.destroy$))
      .subscribe(_ => {
        this.getResults();
        this.checkIfThereAreFailedSteps(); 
      });
  }

  openVideo(result: FeatureResult, video_url:string) {

    this._sharedActions
      .loadingObservable(
        this._sharedActions.checkVideo(video_url),
        'Loading video'
      )
      .subscribe({
        next: _ => {
          const dialogRef = this._dialog.open(VideoComponent, {
            backdropClass: 'video-player-backdrop',
            panelClass: 'video-player-panel',
            data: {
              result: result,
              video_url: video_url
            },
          });

          dialogRef.afterClosed().subscribe(() => {

            const targetElement = this.elementRef.nativeElement.ownerDocument.querySelector('.replay-button');
            if (targetElement) {
              (targetElement as HTMLElement).blur();
            }

          });
        },
        error: err => this._snack.open('An error ocurred', 'OK'),
      });
  }


  /**
   * Clears runs depending on the type of clearing passed
   * @param clearing ClearRunsType
   * @returns void
   */
  clearRuns(clearing: ClearRunsType) {
    this.buttonDisabled = true;
    // Open Loading Snack
    const loadingRef = this._snack.openFromComponent(LoadingSnack, {
      data: 'Clearing history...',
      duration: 60000,
    });
    const featureId = +this._route.snapshot.params.feature;
    const deleteTemplateWithResults = this._store.selectSnapshot<boolean>(
      CustomSelectors.GetConfigProperty('deleteTemplateWithResults')
    );
    this._api
      .removeMultipleFeatureRuns(featureId, clearing, deleteTemplateWithResults)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: _ => {
          this.getResults();
        },
        error: err => {
          console.error(err);
        },
        complete: () => {
          // Close loading snack
          loadingRef.dismiss();
          // Show completed snack
          this._snack.open('History cleared', 'OK', {
            duration: 5000,
          });
          this.buttonDisabled = false;
        },
      });
  }

  handleDeleteTemplateWithResults({ checked }: MatCheckboxChange) {
    return this._store.dispatch(
      new Configuration.SetProperty('deleteTemplateWithResults', checked)
    );
  }

  /**
   * Enables or disables archived runs from checkbox
   * @param change MatCheckboxChange
   */
  handleArchived = () => {
    this.archived = !this.archived;
    this._store.dispatch(
      new Configuration.SetProperty('internal.showArchived', this.archived)
    );
  };


  ngOnInit() {
    console.log('ngOnInit: Component initializing');
    
    // Reset isLoading to ensure clean state
    this.isLoading = false;
    
    this.featureId$ = this._route.paramMap.pipe(
      map(params => +params.get('feature')),
      distinctUntilChanged()
    );
    
    this.query.size =
      parseInt(localStorage.getItem('co_results_page_size')) || 500;
    
    console.log('ngOnInit: query.size set to:', this.query.size);
    
    // Set initialization flag
    this.isInitialized = true;
    console.log('ngOnInit: Component initialized, calling getResults');
    this.getResults();

    // Reload current page of runs whenever a feature run completes
    this._actions
      .pipe(
        untilDestroyed(this),
        ofActionDispatched(WebSockets.FeatureRunCompleted),
        debounceTime(1000) // Increase debounce time to prevent rapid successive calls from WebSocket events
      )
      .subscribe(_ => {
        // Only reload if we're on the first page to avoid disrupting pagination
        if (this.query.page === 0) {
          this.getResults();
        }
      });
      
    this.extractButtons();
  }

  ngOnDestroy() {
    console.log('ngOnDestroy: Cleaning up component');
    this.isLoading = false;
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Extract buttons from mtxgridCoumns
  extractButtons() {
    this.buttons = this.columns
    .filter(col => col.buttons)
    .map(col => col.buttons)
    .reduce((acc, val) => acc.concat(val), []);
  }

  // return to v2 dashboard
  returnToMain() {
    this._router.navigate(['/']);
  }

  // Toggles the filter for displaying only failed results or all results
  filteredByFailuresResults() {
    // If currently showing filtered results, reset to the original results
    if (this.showingFiltered) {
      this.results = [...this.originalResults];
    }
    // Otherwise, filter results to only include those with a 'Failed' status
    else {
      this.results = this.results.filter(result => result.status === 'Failed');
    }

    // Toggle the filter flag to indicate whether filtered results are displayed
    this.showingFiltered = !this.showingFiltered;

    // Check if there are any failed steps in the results
    this.checkIfThereAreFailedSteps();
  }

  // Checks if there are any results with a 'Failed' status and disables the button accordingly
  checkIfThereAreFailedSteps() {
    // Disable the button if no failed steps exist, enable if there are any
    this.buttonDisabled = !this.results.some(result => result.status === 'Failed');
  }

  
}
