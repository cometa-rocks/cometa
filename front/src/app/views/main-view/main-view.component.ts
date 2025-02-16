import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions, ofActionDispatched, Select } from '@ngxs/store';
import { combineLatest, Observable, fromEvent } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { map } from 'rxjs/operators';
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
export class MainViewComponent implements OnInit {
  @Select(CustomSelectors.GetConfigProperty('internal.showArchived'))
  showArchived$: Observable<boolean>;

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
              .subscribe(_ => this.getResults());
          },
          iif: (result: FeatureResult) => !result.archived,
        },
      ],
    },
  ];

  results = [];
  total = 0;
  isLoading = true;
  showPagination = true;
  latestFeatureResultId: number = 0;
  archived: boolean = false;
  buttons: any[] = [];
  selectMobile: { [key: number]: any } = {};

  query = {
    page: 0,
    size: 10,
  };
  get params() {
    const p = { ...this.query };
    p.page += 1;
    return p;
  }

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
  ) {}

  featureId$: Observable<number>;

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
    this.isLoading = true;
    combineLatest([this.featureId$, this.showArchived$]).subscribe(
      ([featureId, archived]) => {
        this._http
          .get(`/backend/api/feature_results_by_featureid/`, {
            params: {
              feature_id: featureId,
              archived: archived,
              ...this.params,
            },
          })
          .subscribe({
            next: (res: any) => {
              this.results = res.results;
              this.total = res.count;
              this.showPagination = this.total > 0 ? true : false;

              // set latest feature id
              if (this.showPagination)
                this.latestFeatureResultId = this.results[0].feature_result_id;

              this.results.forEach(result => {
                if (result.mobile && result.mobile.length > 0) {
                  console.log(`FeatureResult ID: ${result.feature_result_id}`);
                  result.mobile.forEach(mobile => {
                    console.log('📱 Mobile:', mobile);
                    console.log(`📱 Mobile (JSON): ${JSON.stringify(mobile, null, 2)}`);
                    console.log(`📱 Mobile Name: ${mobile.name}`);
                    console.log(`🎥 Video Recording: ${mobile.video_recording}`);
                  });
                }
              });
            },
            error: err => {
              console.error(err);
            },
            complete: () => {
              this.isLoading = false;
              this.cdRef.detectChanges();
            },
          });
      }
    );
  }

  onMobileSelectionChange(event: any, row: FeatureResult): void {
    // Event it's the selected mobile
    const selectedMobile = event.value;

    if (selectedMobile && selectedMobile.video_recording) {
      this.openVideo(row, selectedMobile.video_recording);
    }
  }

  updateData(e: PageEvent) {
    this.query.page = e.pageIndex;
    this.query.size = e.pageSize;
    this.getResults();

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
  setResultStatus(results: FeatureResult, status: 'Success' | 'Failed' | '') {
    this._sharedActions.setResultStatus(results, status).subscribe(_ => {
      this.getResults();
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

    this.featureId$ = this._route.paramMap.pipe(
      map(params => +params.get('feature'))
    );
    this.query.size =
      parseInt(localStorage.getItem('co_results_page_size')) || 10;
    this.getResults();

    // Reload current page of runs whenever a feature run completes
    this._actions
      .pipe(
        untilDestroyed(this),
        ofActionDispatched(WebSockets.FeatureRunCompleted)
      )
      .subscribe(_ => {
        this.getResults();
      });
      this.extractButtons();
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
}
