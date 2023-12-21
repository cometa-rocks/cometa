import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions, ofActionDispatched, Select } from '@ngxs/store';
import { combineLatest, Observable, fromEvent } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { map } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngxs/store';
import { MtxGridColumn } from '@ng-matero/extensions/grid';
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

@UntilDestroy()
@Component({
  selector: 'main-view',
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    PdfLinkPipe
  ],
})
export class MainViewComponent implements OnInit {

  @Select(CustomSelectors.GetConfigProperty('internal.showArchived')) showArchived$: Observable<boolean>;

  svgs = {
    record: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h480q33 0 56.5 23.5T720-720v180l160-160v440L720-420v180q0 33-23.5 56.5T640-160H160Zm0-80h480v-480H160v480Zm0 0v-480 480Z"/></svg>`,
    pdf: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M360-460h40v-80h40q17 0 28.5-11.5T480-580v-40q0-17-11.5-28.5T440-660h-80v200Zm40-120v-40h40v40h-40Zm120 120h80q17 0 28.5-11.5T640-500v-120q0-17-11.5-28.5T600-660h-80v200Zm40-40v-120h40v120h-40Zm120 40h40v-80h40v-40h-40v-40h40v-40h-80v200ZM320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-560h80v560h560v80H160Zm160-720v480-480Z"/></svg>`,
    archive: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="m480-240 160-160-56-56-64 64v-168h-80v168l-64-64-56 56 160 160ZM200-640v440h560v-440H200Zm0 520q-33 0-56.5-23.5T120-200v-499q0-14 4.5-27t13.5-24l50-61q11-14 27.5-21.5T250-840h460q18 0 34.5 7.5T772-811l50 61q9 11 13.5 24t4.5 27v499q0 33-23.5 56.5T760-120H200Zm16-600h528l-34-40H250l-34 40Zm264 300Z"/></svg>`,
    delete: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000000"><path d="M0 0h24v24H0z" fill="none"/><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
  };

  columns: MtxGridColumn[] = [
    {header: 'Status', field: 'status', sortable: true, class: 'aligned-center'},
    {header: 'Execution Date', field: 'result_date', sortable: true, width: '230px', sortProp: { start: 'desc', id: 'result_date'}},
    {header: 'Total', field: 'total', sortable: true, class: 'aligned-center'},
    {header: 'OK', field: 'ok', sortable: true, class: 'aligned-center'},
    {header: 'NOK', field: 'fails', sortable: true, class: 'aligned-center'},
    {header: 'Skipped', field: 'skipped', class: 'aligned-center'},
    {header: 'Browser', field: 'browser', class: 'aligned-center'},
    {header: 'Browser Version', field: 'browser.browser_version', hide: true, sortable: true, class: 'aligned-center'},
    {header: 'Duration', field: 'execution_time', sortable: true, class: "aligned-right"},
    {header: 'Pixel Difference', field: 'pixel_diff', sortable: true, class: "aligned-right"},
    {
      header: 'Options',
      field: 'options',
      width: '230px',
      // pinned: 'right',
      right: '0px',
      type: 'button',
      buttons: [
        {
          type: 'icon',
          text: 'replay',
          icon: 'videocam',
          tooltip: 'View results replay',
          color: 'primary',
          iif: (result: FeatureResult) => result.video_url ? true : false,
          click: (result: FeatureResult) => this.openVideo(result),
        },
        {
          type: 'icon',
          text: 'pdf',
          icon: 'picture_as_pdf',
          tooltip: 'Download result PDF',
          color: 'primary',
          click: (result: FeatureResult) => {
            const pdfLink = this._pdfLinkPipe.transform(result.feature_result_id)
            this._http.get(pdfLink, {
              params: new InterceptorParams({
                skipInterceptor: true,
              }),
              responseType: 'text',
              observe: 'response'
            }).subscribe({
              next: (res) => {
                this._downloadService.downloadFile(res, {
                  mime: 'application/pdf',
                  name: `${result.feature_name}_${result.feature_result_id}.pdf`
                })
              },
              error: console.error
            })
          },
        },
        {
          type: 'icon',
          text: 'archive',
          icon: 'archive',
          tooltip: 'Archive result',
          color: 'accent',
          click: (result: FeatureResult) => {
            this._sharedActions.archive(result).subscribe(_ => this.getResults())
          },
          iif: (result: FeatureResult) => !result.archived
        },
        {
          type: 'icon',
          text: 'unarchive',
          icon: 'unarchive',
          tooltip: 'Unarchive result',
          color: 'accent',
          click: (result: FeatureResult) => {
            this._sharedActions.archive(result).subscribe(_ => this.getResults())
          },
          iif: (result: FeatureResult) => result.archived
        },
        {
          type: 'icon',
          text: 'delete',
          icon: 'delete',
          tooltip: 'Delete result',
          color: 'warn',
          click: (result: FeatureResult) => {
            this._sharedActions.deleteFeatureResult(result).subscribe(_ => this.getResults())
          },
          iif: (result: FeatureResult) => !result.archived
        }
      ]
    }
  ];

  results = [];
  total = 0;
  isLoading = true;
  showPagination = true;
  latestFeatureResultId: number = 0;

  query = {
    page: 0,
    size: 10
  }
  get params() {
    const p = { ...this.query };
    p.page += 1;
    return p
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
    private _downloadService: DownloadService
  ) { 
    console.log(this.svgs.delete);
  }

  featureId$: Observable<number>;

  openContent(feature_result: FeatureResult) {
    this._router.navigate([
      this._route.snapshot.paramMap.get('app'),
      this._route.snapshot.paramMap.get('environment'),
      this._route.snapshot.paramMap.get('feature'),
      'step',
      feature_result.feature_result_id
    ]);
  }

  getResults() {
    this.isLoading = true;
    combineLatest([this.featureId$,this.showArchived$]).subscribe(([featureId, archived]) => {
      this._http.get(`/backend/api/feature_results_by_featureid/`, {
        params: {
          feature_id: featureId,
          archived: archived,
          ...this.params
        }
      }).subscribe({
        next: (res: any) => {
          this.results = res.results
          this.total = res.count
          this.showPagination = this.total > 0 ? true : false

          // set latest feature id
          if (this.showPagination) this.latestFeatureResultId = this.results[0].feature_result_id;
        },
        error: (err) => {
          console.error(err)
        },
        complete: () => {
          this.isLoading = false
          this.cdRef.detectChanges();
        }
      })
    })
  }

  updateData(e: PageEvent) {
    this.query.page = e.pageIndex
    this.query.size = e.pageSize
    this.getResults()

    // create a localstorage session
    localStorage.setItem('co_results_page_size', e.pageSize.toString())
  }

  /**
   * Performs the overriding action through the Store
   */
  setResultStatus(results: FeatureResult, status: 'Success' | 'Failed' | '') {
    this._sharedActions.setResultStatus(results, status).subscribe(_ => {
      this.getResults();
    })
  }

  openVideo(result: FeatureResult) {
    this._sharedActions.loadingObservable(
      this._sharedActions.checkVideo(result.video_url),
      'Loading video'
    ).subscribe({
      next: _ => {
        this._dialog.open(VideoComponent, {
          backdropClass: 'video-player-backdrop',
          panelClass: 'video-player-panel',
          data: result
        })
      },
      error: err => this._snack.open('An error ocurred', 'OK')
    })
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
      duration: 60000
    });
    const featureId = +this._route.snapshot.params.feature;
    const deleteTemplateWithResults = this._store.selectSnapshot<boolean>(CustomSelectors.GetConfigProperty('deleteTemplateWithResults'));
    this._api.removeMultipleFeatureRuns(featureId, clearing, deleteTemplateWithResults).subscribe({
      next: _ => {
        this.getResults();
      },
      error: (err) => {
        console.error(err)
      },
      complete: () => {
        // Close loading snack
        loadingRef.dismiss();
        // Show completed snack
        this._snack.open('History cleared', 'OK', {
          duration: 5000
        });
      }
    })
  }

  handleDeleteTemplateWithResults({ checked }: MatCheckboxChange) {
    return this._store.dispatch(new Configuration.SetProperty('deleteTemplateWithResults', checked));
  }

  /**
   * Enables or disables archived runs from checkbox
   * @param change MatCheckboxChange
   */
  handleArchived = (change: MatCheckboxChange) => this._store.dispatch(new Configuration.SetProperty('internal.showArchived', change.checked));

  ngOnInit() {
    this.featureId$ = this._route.paramMap.pipe(
      map(params => +params.get('feature'))
    )
    this.query.size = parseInt(localStorage.getItem('co_results_page_size')) || 10;
    this.getResults()

    // Reload current page of runs whenever a feature run completes
    this._actions.pipe(
      untilDestroyed(this),
      ofActionDispatched(WebSockets.FeatureRunCompleted)
    ).subscribe(_ => {
      this.getResults()
    });

  }

  // return to v2 dashboard
  returnToMain() {
    this._router.navigate(['/']);
  }
}
