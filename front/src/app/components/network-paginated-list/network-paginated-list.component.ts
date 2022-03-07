import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, Input, OnChanges, OnInit, SimpleChanges, TemplateRef } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Select, Store } from '@ngxs/store';
import { SharedActionsService } from '@services/shared-actions.service';
import { VideoComponent } from '@dialogs/video/video.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '@services/api.service';
import { PaginatedList } from '@store/actions/paginated-list.actions';
import { PaginatedListsState } from '@store/paginated-list.state';
import { SafeGetStorage, StorageType } from 'ngx-amvara-toolbox';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { CustomSelectors } from '@others/custom-selectors';
import { LoadingSnack } from '@components/snacks/loading/loading.snack';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Configuration } from '@store/actions/config.actions';
import { MatCheckboxChange } from '@angular/material/checkbox';

/**
 * This component is used to display an array of items in a paginated fashion using network.
 * More details in component code
 */
@Component({
  selector: 'network-paginated-list',
  templateUrl: './network-paginated-list.component.html',
  styleUrls: ['./network-paginated-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NetworkPaginatedListComponent implements OnChanges, OnInit {

  /**
   * ListId name to use when saving the downloaded page items into the state
   * It can be later accessed from PaginatedListState selectors
   * This input is required and should not be changed once initialized
   */
  @Input() listId: string;

  /**
   * Template for every item in list
   * An $implicit variable is exposed with every item object
   *
   * Usage:
   * ```
   *  <network-paginated-list [itemTemplate]="listItem">
   *    <ng-template #listItem let-item>
          <button class="item-button"(click)="navigate(item.id)">Navigate</button>
        </ng-template>
   *  </network-paginated-list>
   ```
   */
  @Input() itemTemplate: TemplateRef<any>;

  /**
   * Template for list header
   *
   * Usage:
   * ```
   *  <network-paginated-list [headerTemplate]="headTemplate">
   *    <ng-template #headTemplate>
          <div></div>
          <div></div>
          <div></div>
        </ng-template>
   *  </network-paginated-list>
   * ```
   */
  // @Input() headerTemplate: TemplateRef<any>; <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< previous

  /**
   * Template for the No Items Found footer
   *
   * Usage:
   * ```
   *  <network-paginated-list [noItemsTemplate]="notFoundTemplate">
   *    <ng-template #notFoundTemplate>
          <div>No items were found</div>
        </ng-template>
   *  </network-paginated-list>
   * ```
   */
  @Input() noItemsTemplate: TemplateRef<any>;

  /**
   * Used to described which URL will be used to get items,
   * the returned response should be in the following format:
   * {
   *  count: number,
   *  previous: null | string,
   *  next: null | string,
   *  results: Items[]
   * }
   */
  @Input() endpointUrl: string = '';

  /** Size of each page, default is 5 */
  @Input() pageSize = 10;

  /** Whether or not to inject index property into each item */
  @Input() injectIndex: boolean = false;

  /** Whether or not to use skeletons when loading */
  // @Input() useSkeletons: boolean = false; <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< previous

  /** Skeletons height size */
  // @Input() skeletonsHeight: string = '25px'; <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< previous

  /** Skeletons width size */
  // @Input() skeletonsWidth: string = '100%'; <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< previous

  /** Whether or not to show the header when no results were found */
  // @Input() showHeaderOnNoResults: boolean = false <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< previous

  /** Key for item tracking */
  @Input() trackByKey: string;

  /** Exposes an observable with all pages loaded and its items */
  public pagedItems$: Observable<any> = of({});

  /** Exposes an observable with all items in all pages, in one array */
  // public allItems$: Observable<any[]> = of([]); <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< previous

  // skeletonItems$: Observable<number[]>;  <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< previous

  feature_results$: Observable<any[]> = of([]);
  archived: boolean = false;


  @Select(CustomSelectors.GetConfigProperty('deleteTemplateWithResults')) deleteTemplateWithResults$: Observable<boolean>;

  columns = [
    {header: 'STATUS', field: 'status', sortable: true},
    {header: 'RESULT DATE', field: 'result_date', sortable: true},
    {header: 'TOTAL', field: 'total', sortable: true},
    {header: 'OK', field: 'ok', sortable: true},
    {header: 'NOK', field: 'fails', sortable: true},
    {header: 'SKIPPED', field: 'skipped', sortable: true},
    {header: 'TIME', field: 'execution_time', sortable: true},
    {header: 'BROWSER', field: 'browsers', sortable: true},
    {header: 'PIXEL DIFFERENCE', field: 'pixel_diff', sortable: true},
    {header: '', field: 'video_url', sortable: true},
  ];

  constructor(
    private _acRouted: ActivatedRoute,
    private _http: HttpClient,
    private _router: Router,
    private _store: Store,
    private _api: ApiService,
    private _sharedActions: SharedActionsService,
    private _dialog: MatDialog,
    private _snack: MatSnackBar
  ) {}


  ngOnInit(): void {
    // get all the feature_results for clicked feature
    this.feature_results$ = this._store.select(PaginatedListsState.GetFeatureResults).pipe(
      map(fn => fn(this.listId)
      // filter recieved data to render not archived feature results by default
      .filter(feature_results => feature_results.archived == this.archived)));
  }

  ngOnChanges(changes: SimpleChanges) {
    // this.skeletonItems$ = this._acRouted.queryParamMap.pipe( <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< previous
    //   map(queryParams => this.getPageSize(queryParams, changes)),
    //   map(size => Array(size).fill(0)) 
    // ) 
    if (this.listId) {
      // Assign pagedItems observable
      this.pagedItems$ = this._store.select(PaginatedListsState.GetPagedItems).pipe(
        map(fn => fn(this.listId))
      )
      // Assign allItems observable
      // this.allItems$ = this._store.select(PaginatedListsState.GetItems).pipe( <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< previous
      //   map(fn => fn(this.listId))
      // )
    
      // Get parameter values
      const endpointUrl = (changes.endpointUrl && changes.endpointUrl.currentValue) || this.endpointUrl;
      // Get pageSize in localStorage with fallback value
      // Check if values are valid
      if (endpointUrl) {
        // Get and React to page and size parameters in URL
        this._acRouted.queryParamMap.pipe(
          map(queryParams => ({
            size: this.getPageSize(queryParams, changes),
            page: +queryParams.get('page') || 1
          })),
          switchMap(({ page, size }) => this.loadPage(page, size)),
          tap(response => this.processPagination(response))
        ).subscribe();
      }
    } else {
      console.error('[NetworkPaginatedList]', 'No listId parameter provided or empty, please specify some name ID.');
    }
  }

  // gets the feature_result object from clicked row and navigated to see its steps
  getRowData(rowData) {
    this._router.navigate(['result', rowData.feature_result_id], { relativeTo: this._acRouted }).then(() => window.scrollTo(0, 0));
  }
  //-------------------------------------------------------------------------------


  // start a video reproduction of already performed feature_result
  openVideo(test: FeatureResult) {
    this._sharedActions.loadingObservable(
      this._sharedActions.checkVideo(test.video_url),
      'Loading video'
    ).subscribe(_ => {
      this._dialog.open(VideoComponent, {
        backdropClass: 'video-player-backdrop',
        panelClass: 'video-player-panel',
        data: test
      })
    }, err => this._snack.open('An error ocurred', 'OK'))
  }
  //-------------------------------------------------------------------------------


  // deletes the feature_result object of clicked row
  deleteFeatureResult(test: FeatureResult) {
    this.reloadPageAfterAction( this._sharedActions.deleteFeatureResult(test) );
  }
  //-------------------------------------------------------------------------------


  // archives the selected feature_result object
  // this action prevents user from deleting the feature itself
  // shows a popup to inform user that feature has an archived result and it has to be unarchived before deleting feature
  archive(run: FeatureRun | FeatureResult) {
    this.reloadPageAfterAction( this._sharedActions.archive(run) );
  }
  //-------------------------------------------------------------------------------


  reloadPageAfterAction<T = any>(observable: Observable<T>) {
    observable.pipe(
      switchMap(_ => this.reloadCurrentPage())
    ).subscribe();
  }


  // triggered when user marks or unmarks  checkbox >> show saved items 
  handleArchived() {
    // filters data according to check box's current value
    this.feature_results$ = this._store.select(PaginatedListsState.GetFeatureResults).pipe(map(fn => fn(this.listId).filter(data => data.archived == this.archived)));
  }
  //-------------------------------------------------------------------------------

  @Dispatch()
  handleDeleteTemplateWithResults({ checked }: MatCheckboxChange) {
    return new Configuration.SetProperty('deleteTemplateWithResults', checked);
  }


  // Retrieves the page size based on multiple places to get it
  getPageSize(params: ParamMap, changes: SimpleChanges): number {
    // Get page size from URL param
    if (params.get('size')) return +params.get('size');
    // Get page size from changes in template
    if (changes.pageSize && changes.pageSize.currentValue) return changes.pageSize.currentValue;
    // Get page size from localStorage with fallback to 10
    return SafeGetStorage(`pagination.${this.listId}`, StorageType.Int, this.pageSize)
  }
  //-------------------------------------------------------------------------------


  // Used to track every item in list, so Angular knows when an item has been updated
  trackFn(trackKey, index, item) {
    if (trackKey) {
      return item[trackKey];
    } else {
      return item;
    }
  }
  //-------------------------------------------------------------------------------


  // Observable to retrieve items within XHR and process pagination
  public reloadCurrentPage() {
    const { page, size } = this.pagination$.getValue();
    return this.loadPage(page, size).pipe(
      switchMap(response => this.processPagination(response))
    )
  }
  //-------------------------------------------------------------------------------


  // XHR: Loads the list
  loadPage(page: number, size: number) {
    // Activate loading spinner
    this.loading$.next(true);
    // Load page values from network from the given endpoint URL
    return this._http.get<PaginatedResponse<any>>(`${this._api.api}${this.endpointUrl}`, {
      params: {
        page: page.toString(),
        size: size.toString()
      }
    }).pipe(
      map(response => ({ ...response, page: page, size: size }))
    )
  }
  //-------------------------------------------------------------------------------



  clearRuns(clearing: ClearRunsType) {
    // get feature id
    let feature_id = Number(this.listId.substring("runs_".length));

    // Open Loading Snack
    const loadingRef = this._snack.openFromComponent(LoadingSnack, {
      data: 'Clearing history...',
      duration: 60000
    });

    const deleteTemplateWithResults = this._store.selectSnapshot<boolean>(CustomSelectors.GetConfigProperty('deleteTemplateWithResults'));
    this._api.removeMultipleFeatureRuns(feature_id, clearing, deleteTemplateWithResults)
     .subscribe(_ => {
      // Close loading snack
      loadingRef.dismiss();
      // Show completed snack
      this._snack.open('History cleared', 'OK', {
        duration: 5000
      });
    })
  }



  // Process the received XHR data for pagination and saves it to NGXS
  processPagination(response: PaginationWithPage<any>) {
    let results = response.results;
    // Inject index property if user specifically asked for it from @Input
    if (this.injectIndex) {
      results = results.map((item, index) => ({
        ...item,
        index: ((response.page - 1) * response.size) + (index + 1)
      }))
    }
    // Send to HTML
    this.pagination$.next({
      ...response,
      results: results
    });
    this.loading$.next(false);
    // Save items into NGXS State with provided ListID
    return this._store.dispatch( new PaginatedList.SetList(this.listId, response.page, response.results) );
  }

  /**
   * Handles the click in previous and next buttons
   * @param {number} page Next page to proceed
   */
  pageChange(event: PageEvent) {
    // Save custom pageSize into storage
    if (this.pagination$.getValue().size !== event.pageSize) {
      localStorage.setItem(`pagination.${this.listId}`, event.pageSize.toString());
    }
    this._router.navigate([], {
      // Make navigation with no change in url tree
      relativeTo: this._acRouted,
      // Change page url parameter
      queryParams: {
        page: event.pageIndex + 1,
        size: event.pageSize
      },
      // No other parameter is left behind
      queryParamsHandling: 'merge'
    })
    // console.log(this.features_results);
  }

  /** Controls the HTML for showing the loading spinner */
  loading$ = new BehaviorSubject<boolean>(true);
  /** Globally used in component HTML to handle pagination state */
  pagination$ = new BehaviorSubject<PaginationWithPage<any>>(null);
}



/** Extended Pagination with Page and Size */
interface PaginationWithPage<T> extends PaginatedResponse<T> {
  page: number;
  size: number;
}
