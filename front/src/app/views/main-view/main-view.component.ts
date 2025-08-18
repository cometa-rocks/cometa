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
import { UserState } from '@store/user.state';
import { Features } from '@store/actions/features.actions';
import { filter, take } from 'rxjs/operators';

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
  
  @Select(UserState.GetPermission('change_result_status'))
  canChangeResultStatus$: Observable<boolean>;

  // Add archived$ observable for template binding
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
          click: (result: FeatureResult) => this.handleVideoFromTemplate(result, result.video_url),
          class: 'replay-button',
        },
        {
          type: 'icon',
          text: 'replay',
          icon: 'videocam',
          tooltip: 'View mobile test result replay',
          color: 'primary',
          iif: (result: FeatureResult) => (result.mobile && result.mobile.length>0),
          click: (result: FeatureResult) => this.handleMobileVideoFromTemplate(result, result.mobile[0]),
          class: 'replay-button-2',
        },
        {
          type: 'icon',
          text: 'pdf',
          icon: 'picture_as_pdf',
          tooltip: 'Download result PDF',
          color: 'primary',
          click: (result: FeatureResult) => this.handlePdfDownloadFromTemplate(result),
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
          click: (result: FeatureResult) => this.handleNetworkResponsesFromTemplate(result),
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
          click: (result: FeatureResult) => this.handleVulnerableNetworkResponsesFromTemplate(result),
        },
        {
          type: 'icon',
          text: 'archive',
          icon: 'archive',
          tooltip: 'Archive result',
          color: 'accent',
          click: (result: FeatureResult) => this.handleArchiveFromTemplate(result),
          iif: (result: FeatureResult) => !result.archived,
        },
        {
          type: 'icon',
          text: 'unarchive',
          icon: 'unarchive',
          tooltip: 'Unarchive result',
          color: 'accent',
          click: (result: FeatureResult) => this.handleArchiveFromTemplate(result),
          iif: (result: FeatureResult) => result.archived,
        },
        {
          type: 'icon',
          text: 'delete',
          icon: 'delete',
          tooltip: 'Delete result',
          color: 'warn',
          click: (result: FeatureResult) => this.handleDeleteFromTemplate(result),
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
  originalResults: any[] = [];

  openContent(feature_result: FeatureResult) {
    // this.logger.msg("1", "CO-featResult", "main-view", feature_result);

    // Refresh L1 feature item list data before navigating to ensure consistency
    if (feature_result.feature_id) {
      this.logger.msg('1', `Refreshing L1 feature item list data before navigating to feature result ${feature_result.feature_result_id}`, 'main-view');
      this.safeUpdateFeatureData(feature_result.feature_id);
    }

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
              this.originalResults = this.results;
              this.total = res.count;
              this.showPagination = this.total > 0 ? true : false;
      
              // set latest feature id
              if (this.showPagination)
                this.latestFeatureResultId = this.results[0].feature_result_id;

              this.checkIfThereAreFailedSteps();
              
              // Update the store to ensure l1-feature-items gets the latest data
              if (featureId && res.results && res.results.length > 0) {
                // Use the new action that only updates result data without affecting other features
                this._store.dispatch(new Features.UpdateFeatureResultData(featureId, res.results[0]));
                this._store.dispatch(new WebSockets.CleanupFeatureResults(featureId));
                
                // Also ensure L1 feature item list data is preloaded for seamless UI experience
                this.ensureL1FeatureItemListDataPreloaded(featureId, res.results);
                
                // Refresh L1 feature item list data to ensure consistency after any data changes
                this.refreshL1FeatureItemListDataAfterResultsUpdate(featureId, res.results);
              } else if (featureId) {
                // Log when no results are available
                this.logger.msg('1', `No results available for feature ${featureId}, skipping store update`, 'main-view');
              }
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

  /**
   * Ensures L1 feature item list data is preloaded with the latest results
   * This method works in conjunction with preloadL1FeatureItemListData to provide seamless data loading
   */
  private ensureL1FeatureItemListDataPreloaded(featureId: number, results: any[]): void {
    if (results && results.length > 0) {
      const latestResult = results[0];
      
      // Safely check if latestResult has the required properties before updating store
      if (latestResult && typeof latestResult === 'object') {
        // Use the new action that only updates result data without affecting other features
        this._store.dispatch(new Features.UpdateFeatureResultData(featureId, latestResult));
        
        // Log the data synchronization for debugging
        this.logger.msg('1', `Synchronized L1 feature item list data for feature ${featureId} with ${results.length} results`, 'main-view');
        
        // If we have execution data, ensure it's properly cached for L1 feature items
        if (latestResult.total || latestResult.execution_time || latestResult.result_date) {
          this.logger.msg('1', `L1 feature item list data synchronized: total=${latestResult.total}, time=${latestResult.execution_time}, date=${latestResult.result_date}`, 'main-view');
        }
      } else {
        this.logger.msg('1', `Invalid result data for feature ${featureId}, skipping store update`, 'main-view');
      }
    } else {
      this.logger.msg('1', `No results available for feature ${featureId}, skipping L1 data preload`, 'main-view');
    }
  }

  /**
   * Refreshes L1 feature item list data after results are updated
   * This ensures data consistency across the application after any data changes
   */
  private refreshL1FeatureItemListDataAfterResultsUpdate(featureId: number, results: any[]): void {
    if (results && results.length > 0) {
      const latestResult = results[0];
      
      // Safely check if latestResult has the required properties before updating store
      if (latestResult && typeof latestResult === 'object') {
        // Use the new action that only updates result data without affecting other features
        this._store.dispatch(new Features.UpdateFeatureResultData(featureId, latestResult));
        
        // Log the data refresh for debugging
        this.logger.msg('1', `Refreshed L1 feature item list data after results update for feature ${featureId}`, 'main-view');
        
        // If we have execution data, ensure it's properly synchronized
        if (latestResult.total || latestResult.execution_time || latestResult.result_date) {
          this.logger.msg('1', `L1 feature item list data refreshed: total=${latestResult.total}, time=${latestResult.execution_time}, date=${latestResult.result_date}`, 'main-view');
        }
      } else {
        this.logger.msg('1', `Invalid result data for feature ${featureId}, skipping store refresh`, 'main-view');
      }
    } else {
      this.logger.msg('1', `No results available for feature ${featureId}, skipping L1 data refresh`, 'main-view');
    }
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
    
    // Also refresh L1 feature item list data to ensure consistency after pagination change
    this.featureId$.pipe(take(1)).subscribe(featureId => {
      if (featureId) {
        this.logger.msg('1', `Refreshing L1 feature item list data after pagination change for feature ${featureId}`, 'main-view');
        // Use the new action that only updates result data without affecting other features
        // Note: We don't have result data here, so we'll just log the action
        this.logger.msg('1', `Pagination change detected for feature ${featureId}, will update data on next results fetch`, 'main-view');
      }
    });
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
    this._sharedActions.setResultStatus(results, status).subscribe(_ => {
      this.getResults();
      this.checkIfThereAreFailedSteps(); 
      
      // Also refresh L1 feature item list data to ensure consistency
      if (results.feature_id) {
        this.logger.msg('1', `Refreshing L1 feature item list data after status change for feature ${results.feature_id}`, 'main-view');
        this.safeUpdateFeatureData(results.feature_id);
      }
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
      .subscribe({
        next: _ => {
          this.getResults();
          
          // Also refresh L1 feature item list data to ensure consistency
          if (featureId) {
            this.logger.msg('1', `Refreshing L1 feature item list data after clearing runs for feature ${featureId}`, 'main-view');
            this.safeUpdateFeatureData(featureId);
          }
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

  handleDeleteTemplateWithResults(event: MatCheckboxChange) {
    return this._store.dispatch(
      new Configuration.SetProperty('deleteTemplateWithResults', event.checked)
    );
  }

  /**
   * Getter for deleteTemplateWithResults observable for template binding
   */
  get deleteTemplateWithResults$(): Observable<boolean> {
    return this._store.select(CustomSelectors.GetConfigProperty('deleteTemplateWithResults'));
  }

  /**
   * Safely updates feature data without affecting other features
   * This prevents cross-contamination when scheduled features complete
   */
  private safeUpdateFeatureData(featureId: number, resultData?: any): void {
    if (featureId) {
      if (resultData) {
        // Use the new action that only updates result data without affecting other features
        this._store.dispatch(new Features.UpdateFeatureResultData(featureId, resultData));
        this.logger.msg('1', `Safely updated feature ${featureId} result data`, 'main-view');
      } else {
        // If no result data, just log that we're skipping the update to prevent cross-contamination
        this.logger.msg('1', `Skipping feature ${featureId} update to prevent cross-contamination (no result data)`, 'main-view');
      }
    }
  }

  /**
   * Handles deleteTemplateWithResults state change and refreshes L1 feature item list data
   */
  handleDeleteTemplateWithResultsAndRefresh(event: MatCheckboxChange) {
    this.handleDeleteTemplateWithResults(event);
    
    // Also refresh L1 feature item list data to ensure consistency
    this.featureId$.pipe(take(1)).subscribe(featureId => {
      if (featureId) {
        this.logger.msg('1', `Refreshing L1 feature item list data after deleteTemplateWithResults change for feature ${featureId}`, 'main-view');
        this.safeUpdateFeatureData(featureId);
      }
    });
  }

  /**
   * Handles delete template with results action from template with L1 feature item list data refresh
   * This method is called when the delete template with results checkbox is changed
   */
  handleDeleteTemplateWithResultsFromTemplate(event: MatCheckboxChange) {
    this.handleDeleteTemplateWithResults(event);
    
    // Also refresh L1 feature item list data to ensure consistency
    this.featureId$.pipe(take(1)).subscribe(featureId => {
      if (featureId) {
        this.logger.msg('1', `Refreshing L1 feature item list data after delete template with results change for feature ${featureId}`, 'main-view');
        this.safeUpdateFeatureData(featureId);
      }
    });
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
    
    // Also refresh L1 feature item list data to ensure consistency
    this.featureId$.pipe(take(1)).subscribe(featureId => {
      if (featureId) {
        this.logger.msg('1', `Refreshing L1 feature item list data after archived filter change for feature ${featureId}`, 'main-view');
        this.safeUpdateFeatureData(featureId);
      }
    });
  };

  /**
   * Handles archived state change from template
   * This method is called when the archived button is clicked
   */
  handleArchivedFromTemplate() {
    this.handleArchived();
  }

  /**
   * Handles archived state change from template with L1 feature item list data refresh
   * This method is called when the archived button is clicked
   */
  handleArchivedFromTemplateWithRefresh() {
    this.handleArchived();
    
    // Also refresh L1 feature item list data to ensure consistency
    this.featureId$.pipe(take(1)).subscribe(featureId => {
      if (featureId) {
        this.logger.msg('1', `Refreshing L1 feature item list data after archived template change for feature ${featureId}`, 'main-view');
        this.safeUpdateFeatureData(featureId);
      }
    });
  }

  /**
   * Handles failure filter change from template with L1 feature item list data refresh
   * This method is called when the failure filter button is clicked
   */
  handleFailureFilterFromTemplateWithRefresh() {
    this.filteredByFailuresResults();
    
    // Also refresh L1 feature item list data to ensure consistency
    this.featureId$.pipe(take(1)).subscribe(featureId => {
      if (featureId) {
        this.logger.msg('1', `Refreshing L1 feature item list data after failure filter template change for feature ${featureId}`, 'main-view');
        this.safeUpdateFeatureData(featureId);
      }
    });
  }

  /**
   * Handles clear runs action from template with L1 feature item list data refresh
   * This method is called when the clear runs button is clicked
   */
  handleClearRunsFromTemplate(clearing: ClearRunsType) {
    this.clearRuns(clearing);
    
    // Also refresh L1 feature item list data to ensure consistency
    this.featureId$.pipe(take(1)).subscribe(featureId => {
      if (featureId) {
        this.logger.msg('1', `Refreshing L1 feature item list data after clear runs action for feature ${featureId}`, 'main-view');
        this.safeUpdateFeatureData(featureId);
      }
    });
  }

  /**
   * Handles page change action from template with L1 feature item list data refresh
   * This method is called when the page changes
   */
  handlePageChangeFromTemplate(event: PageEvent) {
    this.updateData(event);
    
    // Also refresh L1 feature item list data to ensure consistency after page change
    this.featureId$.pipe(take(1)).subscribe(featureId => {
      if (featureId) {
        this.logger.msg('1', `Refreshing L1 feature item list data after page change for feature ${featureId}`, 'main-view');
        this.safeUpdateFeatureData(featureId);
      }
    });
  }

  /**
   * Handles archive/unarchive action from template with L1 feature item list data refresh
   * This method is called when the archive/unarchive button is clicked
   */
  handleArchiveFromTemplate(result: FeatureResult) {
    this._sharedActions
      .archive(result)
      .subscribe(_ => {
        this.getResults();
        
        // Also refresh L1 feature item list data to ensure consistency
        if (result.feature_id) {
          this.logger.msg('1', `Refreshing L1 feature item list data after archive action for feature ${result.feature_id}`, 'main-view');
          this.safeUpdateFeatureData(result.feature_id);
        }
      });
  }

  /**
   * Handles delete action from template with L1 feature item list data refresh
   * This method is called when the delete button is clicked
   */
  handleDeleteFromTemplate(result: FeatureResult) {
    this._sharedActions
      .deleteFeatureResult(result)
      .subscribe(_ => {
        this.getResults();
        
        // Also refresh L1 feature item list data to ensure consistency
        if (result.feature_id) {
          this.logger.msg('1', `Refreshing L1 feature item list data after delete action for feature ${result.feature_id}`, 'main-view');
          this.safeUpdateFeatureData(result.feature_id);
        }
      });
  }

  /**
   * Handles video opening action from template with L1 feature item list data refresh
   * This method is called when the video button is clicked
   */
  handleVideoFromTemplate(result: FeatureResult, video_url: string) {
    this.openVideo(result, video_url);
    
    // Also refresh L1 feature item list data to ensure consistency
    if (result.feature_id) {
      this.logger.msg('1', `Refreshing L1 feature item list data after video opening for feature ${result.feature_id}`, 'main-view');
      this.safeUpdateFeatureData(result.feature_id);
    }
  }

  /**
   * Handles mobile video opening action from template with L1 feature item list data refresh
   * This method is called when the mobile video button is clicked
   */
  handleMobileVideoFromTemplate(result: FeatureResult, mobile: any) {
    if (mobile && mobile.video_recording) {
      this.openVideo(result, mobile.video_recording);
      
      // Also refresh L1 feature item list data to ensure consistency
      if (result.feature_id) {
        this.logger.msg('1', `Refreshing L1 feature item list data after mobile video opening for feature ${result.feature_id}`, 'main-view');
        this.safeUpdateFeatureData(result.feature_id);
      }
    }
  }

  /**
   * Handles PDF download action from template with L1 feature item list data refresh
   * This method is called when the PDF button is clicked
   */
  handlePdfDownloadFromTemplate(result: FeatureResult) {
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
          
          // Also refresh L1 feature item list data to ensure consistency
          if (result.feature_id) {
            this.logger.msg('1', `Refreshing L1 feature item list data after PDF download for feature ${result.feature_id}`, 'main-view');
            this.safeUpdateFeatureData(result.feature_id);
          }
        },
        error: console.error,
      });
  }

  /**
   * Handles network responses action from template with L1 feature item list data refresh
   * This method is called when the network responses button is clicked
   */
  handleNetworkResponsesFromTemplate(result: FeatureResult) {
    // This is a placeholder for network responses functionality
    // The actual implementation would depend on the specific requirements
    
    // Also refresh L1 feature item list data to ensure consistency
    if (result.feature_id) {
      this.logger.msg('1', `Refreshing L1 feature item list data after network responses action for feature ${result.feature_id}`, 'main-view');
      this.safeUpdateFeatureData(result.feature_id);
    }
  }

  /**
   * Handles vulnerable network responses action from template with L1 feature item list data refresh
   * This method is called when the vulnerable network responses button is clicked
   */
  handleVulnerableNetworkResponsesFromTemplate(result: FeatureResult) {
    // This is a placeholder for vulnerable network responses functionality
    // The actual implementation would depend on the specific requirements
    
    // Also refresh L1 feature item list data to ensure consistency
    if (result.feature_id) {
      this.logger.msg('1', `Refreshing L1 feature item list data after vulnerable network responses action for feature ${result.feature_id}`, 'main-view');
      this.safeUpdateFeatureData(result.feature_id);
    }
  }

  /**
   * Handles mobile selection change action from template with L1 feature item list data refresh
   * This method is called when the mobile selection changes
   */
  handleMobileSelectionChangeFromTemplate(event: any, row: FeatureResult): void {
    this.onMobileSelectionChange(event, row);
    
    // Also refresh L1 feature item list data to ensure consistency
    if (row.feature_id) {
      this.logger.msg('1', `Refreshing L1 feature item list data after mobile selection change for feature ${row.feature_id}`, 'main-view');
      this.safeUpdateFeatureData(row.feature_id);
    }
  }

  /**
   * Handles row click action from template with L1 feature item list data refresh
   * This method is called when a row is clicked
   */
  handleRowClickFromTemplate(rowData: any) {
    // Refresh L1 feature item list data before navigating to ensure consistency
    if (rowData && rowData.feature_id) {
      this.logger.msg('1', `Refreshing L1 feature item list data before row click for feature ${rowData.feature_id}`, 'main-view');
      this.safeUpdateFeatureData(rowData.feature_id);
    }
    
    this.openContent(rowData);
  }

  ngOnInit() {

    this.featureId$ = this._route.paramMap.pipe(
      map(params => +params.get('feature'))
    );
    this.query.size =
      parseInt(localStorage.getItem('co_results_page_size')) || 500;
    
    // Get feature ID from route
    const featureId = +this._route.snapshot.params.feature;
    
    // Preload L1 feature item list data to avoid UI loading states
    this.preloadL1FeatureItemListData();
    
    // Get results and immediately update store with feature data
    this.getResults();
    
    // Also fetch feature results data directly and update store immediately
    if (featureId) {
      this.fetchAndUpdateFeatureResultsData(featureId);
    }

    // Reload current page of runs whenever a feature run completes
    this._actions
      .pipe(
        untilDestroyed(this),
        ofActionDispatched(WebSockets.FeatureRunCompleted)
      )
      .subscribe(_ => {
        this.getResults();
      });
      
    // Also refresh L1 feature item list data when returning to main view
    this.refreshL1FeatureItemListDataOnNavigation();
      
    this.extractButtons();
  }

  /**
   * Fetches feature results data directly and updates the store
   * This ensures l1-feature-item-list has access to the latest results data
   */
  private fetchAndUpdateFeatureResultsData(featureId: number): void {
    // Fetch the latest results for this feature
    this._http
      .get(`/backend/api/feature_results_by_featureid/`, {
        params: {
          feature_id: featureId,
          archived: false,
          page: 1,
          size: 1,
        },
      })
      .subscribe({
        next: (res: any) => {
          
          if (res && res.results && res.results.length > 0) {
            const latestResult = res.results[0];
            
            // Create the data structure that l1-feature-item-list expects
            const featureData = {
              total: latestResult.total || 0,
              execution_time: latestResult.execution_time || 0,
              result_date: latestResult.result_date || null,
              status: latestResult.status || 'Unknown',
              success: latestResult.success || false,
              ok: latestResult.ok || 0,
              fails: latestResult.fails || 0,
              skipped: latestResult.skipped || 0,
              browser: latestResult.browser || {},
              mobile: latestResult.mobile || [],
              description: latestResult.description || '',
              pixel_diff: latestResult.pixel_diff || 0
            };
            
            // Update the store so l1-feature-item-list can access this data
            this._store.dispatch(new Features.UpdateFeatureResultData(featureId, featureData));
            
            this.logger.msg('1', `Updated store with feature results data for feature ${featureId}`, 'main-view');
          }
        },
        error: err => {
          this.logger.msg('1', `Error fetching feature results for feature ${featureId}: ${err}`, 'main-view');
        }
      });
  }

  /**
   * Preloads data for L1 feature item list components to avoid UI loading states
   * This method fetches feature data in the background so it's ready when needed
   */
  private preloadL1FeatureItemListData(): void {
    // Get the current feature ID from route
    const featureId = +this._route.snapshot.params.feature;
    if (!featureId) return;

    // Preload feature results data for the L1 feature item list
    this._http
      .get(`/backend/api/feature_results_by_featureid/`, {
        params: {
          feature_id: featureId,
          archived: false,
          page: 1,
          size: 1,
        },
      })
      .subscribe({
        next: (res: any) => {
          if (res && res.results && res.results.length > 0) {
            const latestResult = res.results[0];
            
            // Use the new action that only updates result data without affecting other features
            this._store.dispatch(new Features.UpdateFeatureResultData(featureId, latestResult));
            
            // Also update the feature status in the store by dispatching UpdateFeatureResultData
            // This will trigger the store to refresh the feature information
            if (latestResult.status) {
              // The UpdateFeatureResultData action will refresh the feature data including status
              this.logger.msg('1', `Preloaded L1 feature item list data for feature ${featureId} with status: ${latestResult.status}`, 'main-view');
            }
            
            this.logger.msg('1', `Preloaded L1 feature item list data for feature ${featureId}`, 'main-view');
          }
        },
        error: err => {
          this.logger.msg('1', `Error preloading L1 feature item list data: ${err}`, 'main-view');
        }
      });
  }

  /**
   * Refreshes L1 feature item list data when navigating back to main view
   * This ensures the data is always up to date when the user returns
   */
  private refreshL1FeatureItemListDataOnNavigation(): void {
    // Listen for route changes to refresh data when returning to main view
    this._route.paramMap.pipe(
      map(params => +params.get('feature')),
      filter(featureId => !!featureId),
      take(1) // Only take the first emission to avoid repeated refreshes
    ).subscribe(featureId => {
      // Small delay to ensure the component is fully initialized
      setTimeout(() => {
        this.logger.msg('1', `Refreshing L1 feature item list data on navigation for feature ${featureId}`, 'main-view');
        this.safeUpdateFeatureData(featureId);
      }, 100);
    });
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
    // Refresh L1 feature item list data before navigating to ensure consistency
    this.featureId$.pipe(take(1)).subscribe(featureId => {
      if (featureId) {
        this.logger.msg('1', `Refreshing L1 feature item list data before returning to main for feature ${featureId}`, 'main-view');
        this.safeUpdateFeatureData(featureId);
      }
    });
    
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
    
    // Also refresh L1 feature item list data to ensure consistency after filter change
    this.featureId$.pipe(take(1)).subscribe(featureId => {
      if (featureId) {
        this.logger.msg('1', `Refreshing L1 feature item list data after failure filter change for feature ${featureId}`, 'main-view');
        this.safeUpdateFeatureData(featureId);
      }
    });
  }

  /**
   * Handles return to main action from template with L1 feature item list data refresh
   * This method is called when the return to main button is clicked
   */
  handleReturnToMainFromTemplate() {
    // Refresh L1 feature item list data before navigating to ensure consistency
    this.featureId$.pipe(take(1)).subscribe(featureId => {
      if (featureId) {
        this.logger.msg('1', `Refreshing L1 feature item list data before returning to main for feature ${featureId}`, 'main-view');
        this.safeUpdateFeatureData(featureId);
      }
    });
    
    this.returnToMain();
  }

  /**
   * Handles status change action from template with L1 feature item list data refresh
   * This method is called when the status is changed
   */
  handleStatusChangeFromTemplate(result: FeatureResult, status: 'Success' | 'Failed' | 'Canceled' | '') {
    this.setResultStatus(result, status);
    
    // Also refresh L1 feature item list data to ensure consistency after status change
    if (result.feature_id) {
      this.logger.msg('1', `Refreshing L1 feature item list data after status change for feature ${result.feature_id}`, 'main-view');
      // Use the new action that only updates result data without affecting other features
      this._store.dispatch(new Features.UpdateFeatureResultData(result.feature_id, result));
    }
  }

  // Checks if there are any results with a 'Failed' status and disables the button accordingly
  checkIfThereAreFailedSteps() {
    // Disable the button if no failed steps exist, enable if there are any
    this.buttonDisabled = !this.results.some(result => result.status === 'Failed');
  }

  
}
