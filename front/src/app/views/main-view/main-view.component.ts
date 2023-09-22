import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions, ofActionDispatched, Select } from '@ngxs/store';
import { combineLatest, Observable, fromEvent } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { map } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngxs/store';
import { MainViewFieldsDesktop, MainViewFieldsMobile, MainViewFieldsTabletLandscape, MainViewFieldsTabletPortrait } from '@others/variables';
import { MtxGridColumn } from '@ng-matero/extensions/grid';
import { HttpClient } from '@angular/common/http';
import { PageEvent } from '@angular/material/paginator';
import { SharedActionsService } from '@services/shared-actions.service';
import { WebSockets } from '@store/actions/results.actions';
import { Configuration } from '@store/actions/config.actions';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VideoComponent } from '@dialogs/video/video.component';

@UntilDestroy()
@Component({
  selector: 'main-view',
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainViewComponent implements OnInit {

  @Select(CustomSelectors.GetConfigProperty('internal.showArchived')) showArchived$: Observable<boolean>;

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
      pinned: 'right',
      right: '0px',
      type: 'button',
      buttons: [
        {
          type: 'icon',
          text: 'replay',
          icon: 'videocam',
          tooltip: 'View results replay',
          color: 'primary',
          disabled: (result: FeatureResult) => !result.video_url ? true : false,
          click: (result: FeatureResult) => this.openVideo(result),
        },
        {
          type: 'icon',
          text: 'pdf',
          icon: 'picture_as_pdf',
          tooltip: 'Download result PDF',
          color: 'primary',
          click: (result: FeatureResult) => alert('copy'),
        },
        {
          type: 'icon',
          text: 'archive',
          icon: 'archive',
          tooltip: 'Archive result',
          color: 'accent',
          click: (result: FeatureResult) => alert('copy'),
        },
        {
          type: 'icon',
          text: 'delete',
          icon: 'delete',
          tooltip: 'Delete result',
          color: 'warn',
          click: (result: FeatureResult) => alert('copy'),
        }
      ]
    }
  ];

  results = [];
  total = 0;
  isLoading = true;

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
    private _snack: MatSnackBar
  ) { }

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
