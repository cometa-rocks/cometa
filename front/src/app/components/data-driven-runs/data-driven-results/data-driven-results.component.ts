import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Actions, Store, ofActionDispatched } from '@ngxs/store';
import { MtxGridColumn } from '@ng-matero/extensions/grid';
import { HttpClient } from '@angular/common/http';
import { PageEvent } from '@angular/material/paginator';
import { SharedActionsService } from '@services/shared-actions.service';
import { Configuration } from '@store/actions/config.actions';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VideoComponent } from '@dialogs/video/video.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { PdfLinkPipe } from '@pipes/pdf-link.pipe';
import { DownloadService } from '@services/download.service';
import { InterceptorParams } from 'ngx-network-error';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@modules/shared.module';
import { WebSockets } from '@store/actions/results.actions';

@UntilDestroy()
@Component({
  selector: 'data-driven-results',
  templateUrl: './data-driven-results.component.html',
  styleUrls: ['./data-driven-results.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    PdfLinkPipe
  ],
  imports: [CommonModule, SharedModule],
  standalone: true
})
export class DataDrivenResultsComponent implements OnInit {

//   @Select(CustomSelectors.GetConfigProperty('internal.showArchived')) showArchived$: Observable<boolean>;

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
    private _store: Store,
    private _router: Router,
    public _sharedActions: SharedActionsService,
    private _http: HttpClient,
    private cdRef: ChangeDetectorRef,
    private _dialog: MatDialog,
    private _snack: MatSnackBar,
    private _actions: Actions,
    private _pdfLinkPipe: PdfLinkPipe,
    private _downloadService: DownloadService
  ) { }

  runId$: Observable<number>;

  openContent(feature_result: FeatureResult) {
    this._router.navigate([
      'data-driven',
      this._route.snapshot.paramMap.get('id'),
      'step',
      feature_result.feature_result_id
    ]);
  }

  getResults() {
    this.isLoading = true;
    this.runId$.subscribe(runId => {
      this._http.get(`/backend/api/data_driven/results/${runId}`, {
        params: {
          ...this.params
        }
      }).subscribe({
        next: (res: any) => {
          this.results = res.results
          this.total = res.count
          this.showPagination = this.total > 0 ? true : false
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

  handleDeleteTemplateWithResults({ checked }: MatCheckboxChange) {
    return this._store.dispatch(new Configuration.SetProperty('deleteTemplateWithResults', checked));
  }

  /**
   * Enables or disables archived runs from checkbox
   * @param change MatCheckboxChange
   */
//   handleArchived = (change: MatCheckboxChange) => this._store.dispatch(new Configuration.SetProperty('internal.showArchived', change.checked));

  ngOnInit() {
    this.runId$ = this._route.paramMap.pipe(
      map(params => +params.get('id'))
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
