import { Component, OnInit, ChangeDetectionStrategy, ViewChild, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions, ofActionDispatched, Select } from '@ngxs/store';
import { combineLatest, Observable, fromEvent } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { NetworkPaginatedListComponent } from '@components/network-paginated-list/network-paginated-list.component';
import { WebSockets } from '@store/actions/results.actions';
import { map } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { startWith } from 'rxjs/operators';
import { Store } from '@ngxs/store';
import { MainViewFieldsDesktop, MainViewFieldsMobile, MainViewFieldsTabletLandscape, MainViewFieldsTabletPortrait } from '@others/variables';
import { MtxGridColumn } from '@ng-matero/extensions/grid';
import { HttpClient } from '@angular/common/http';
import { PageEvent } from '@angular/material/paginator';

@UntilDestroy()
@Component({
  selector: 'main-view',
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainViewComponent implements OnInit, AfterViewInit {

  isloaded: boolean = false;

  @ViewChild(NetworkPaginatedListComponent, { static: false }) paginatedList: NetworkPaginatedListComponent;

  @Select(CustomSelectors.GetConfigProperty('internal.showArchived')) showArchived$: Observable<boolean>;

  columns: MtxGridColumn[] = [
    {header: 'Status', field: 'status', sortable: true},
    {header: 'Execution Date', field: 'result_date', sortable: true},
    {header: 'Steps Total', field: 'total', sortable: true},
    {header: 'Steps OK', field: 'ok', sortable: true},
    {header: 'Steps NOK', field: 'fails', sortable: true},
    {header: 'Steps Skipped', field: 'skipped', sortable: true},
    {header: 'Duration', field: 'execution_time', sortable: true},
    {header: 'Pixel Difference', field: 'pixel_diff', sortable: true},
    {
      header: 'Operation',
      field: 'operation',
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
          click: () => alert('copy'),
        },
        {
          type: 'icon',
          text: 'pdf',
          icon: 'picture_as_pdf',
          tooltip: 'Download result PDF',
          color: 'primary',
          click: () => alert('copy'),
        },
        {
          type: 'icon',
          text: 'delete',
          icon: 'delete',
          tooltip: 'Delete result',
          color: 'warn',
          click: () => alert('copy'),
        },
        {
          type: 'icon',
          text: 'archive',
          icon: 'archive',
          tooltip: 'Archive result',
          color: 'accent',
          click: () => alert('copy'),
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
    private _http: HttpClient
  ) { }

  featureRunsUrl$: Observable<string>;
  featureId$: Observable<number>;

  openContent(feature_result: FeatureResult) {
    console.log(feature_result)
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
      }).subscribe(
        (res: any) => {
          this.results = res.results
          this.total = res.count
          this.isLoading = false
          console.log(this.results, this.total, this.isLoading)
        },
        () => {
          this.isLoading = false
        },
        () => {
          this.isLoading = false
        }
      )
    })
  }

  getNextPage(e: PageEvent) {
    this.query.page = e.pageIndex
    this.query.size = e.pageSize
    this.getResults()
  }

  ngOnInit() {
    this.featureId$ = this._route.paramMap.pipe(
      map(params => +params.get('feature'))
    )
    this.getResults()

    // Subscribe to URL params
    this.featureRunsUrl$ = combineLatest([
      // Get featureId parameter
      this.featureId$,
      // Get latest value from archived$
      this.showArchived$
    ]).pipe(
      // Return endpointUrl for paginated list
      map(([featureId, archived]) => `feature_results_by_featureid/?feature_id=${featureId}&archived=${archived}`)
    )
    // Reload current page of runs whenever a feature run completes
    this._actions.pipe(
      untilDestroyed(this),
      ofActionDispatched(WebSockets.FeatureRunCompleted)
    ).subscribe(_ => {
      if (this.paginatedList) this.paginatedList.reloadCurrentPage().subscribe()
    });

  }

  ngAfterViewInit() {
    // Change the run elements' visibility whenever the user changes the window size
    combineLatest([
      this._store.select(CustomSelectors.RetrieveResultHeaders(true)).pipe(
        // Add some virtual headers
        map(headers => ([
          { id: 'bar', enable: true },
          // @ts-ignore
          ...headers,
          { id: 'video', enable: true},
          { id: 'options', enable: true }
        ]))
      ),
      fromEvent(window, 'resize').pipe(
        map((event: Event) => (event.target as Window).innerWidth),
        startWith(window.innerWidth)
      )
    ]).pipe(
      untilDestroyed(this)
    ).subscribe(([headers, windowWidth]) => {
      var showVariables = [];
      if (windowWidth < 600) {
        // Mobile
        showVariables = MainViewFieldsMobile;
      } else if (windowWidth < 900) {
        // Tablet Portrait
        showVariables = MainViewFieldsTabletPortrait;
      } else if (windowWidth < 1200) {
        // Tablet Landscape
        showVariables = MainViewFieldsTabletLandscape;
      } else {
        // Desktop
        showVariables = MainViewFieldsDesktop;
      }
      for (let i = 0; i < headers.length; i++) {
        if (showVariables.includes(headers[i].id)) {
          document.documentElement.style.setProperty(`--${headers[i].id}-display`, headers.find(header => header.id === headers[i].id).enable ? 'flex' : 'none');
          document.documentElement.style.setProperty(`--${headers[i].id}-order`, (headers.findIndex(header => header.id === headers[i].id) + 1).toString());
        } else {
          document.documentElement.style.setProperty(`--${headers[i].id}-display`, 'none');
          document.documentElement.style.setProperty(`--${headers[i].id}-order`, '0');
        }
      }
    })

    this.isloaded = true;
  }

  // return to v2 dashboard
  returnToMain() {
    this._router.navigate(['/']);
  }
}
