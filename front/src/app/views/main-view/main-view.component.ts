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

  constructor(
    private _route: ActivatedRoute,
    private _actions: Actions,
    private _store: Store,
    private _router: Router
  ) { }

  featureRunsUrl$: Observable<string>;
  featureId$: Observable<number>;

  ngOnInit() {
    this.featureId$ = this._route.paramMap.pipe(
      map(params => +params.get('feature'))
    )
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
