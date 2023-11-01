import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ViewChild,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import {
  trigger,
  state,
  style,
  transition,
  query,
  stagger,
  animate,
} from '@angular/animations';
import { Store } from '@ngxs/store';
import { Observable, combineLatest } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { FeatureResults } from '@store/actions/feature_results.actions';
import {
  distinctUntilChanged,
  map,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs/operators';
import { ApiService } from '@services/api.service';
import { NetworkPaginatedListComponent } from '@components/network-paginated-list/network-paginated-list.component';
import { SharedActionsService } from '@services/shared-actions.service';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { ScreenshotComponent } from '@dialogs/screenshot/screenshot.component';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@modules/shared.module';

@Component({
  selector: 'data-driven-step-view',
  templateUrl: './data-driven-steps.component.html',
  styleUrls: ['./data-driven-steps.component.scss'],
  standalone: true,
  imports: [CommonModule, SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('progressIn', [
      transition('* => *', [
        query(
          ':enter',
          style({ opacity: 0, position: 'relative', left: '-50px' }),
          { optional: true }
        ),
        query(
          ':enter',
          stagger('80ms', [
            animate(
              '.2s 0ms ease-in',
              style({ opacity: 1, position: 'relative', left: '0' })
            ),
          ]),
          { optional: true }
        ),
      ]),
    ]),
    trigger('info', [
      state(
        'false',
        style({
          opacity: 0,
          position: 'relative',
          bottom: '-20px',
        })
      ),
      state(
        'true',
        style({
          opacity: 1,
          position: 'relative',
          bottom: '0',
        })
      ),
      transition('false => true', animate('200ms 300ms ease-in-out')),
    ]),
    trigger('chart', [
      state(
        'false',
        style({
          opacity: 0,
          position: 'relative',
          top: '30px',
        })
      ),
      state(
        'true',
        style({
          opacity: 1,
          position: 'relative',
          top: '0',
        })
      ),
      transition('false => true', animate('300ms 500ms ease-in-out')),
    ]),
    trigger('returnArrow', [
      state(
        'false',
        style({
          opacity: 0,
          position: 'relative',
          left: '-30px',
        })
      ),
      state(
        'true',
        style({
          opacity: 1,
          position: 'relative',
          left: '0',
        })
      ),
      transition('false => true', animate('200ms 0ms ease-in-out')),
    ]),
    trigger('returnText', [
      state(
        'false',
        style({
          opacity: 0,
          position: 'relative',
          left: '-50px',
        })
      ),
      state(
        'true',
        style({
          opacity: 1,
          position: 'relative',
          left: '0',
        })
      ),
      transition('false => true', animate('200ms 100ms ease-in-out')),
    ]),
  ],
})
export class DataDrivenStepViewComponent implements OnInit {
  clickStepResult: number = null;
  test$: Observable<FeatureResult>;

  stepResultsUrl$: Observable<string>;

  constructor(
    private _router: Router,
    private _acRouted: ActivatedRoute,
    private _store: Store,
    private _api: ApiService,
    public _sharedActions: SharedActionsService,
    private _dialog: MatDialog
  ) {}

  featureResultId$: Observable<number>;

  ngOnInit() {
    this.featureResultId$ = this._acRouted.paramMap.pipe(
      map(params => +params.get('feature_result_id')),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }) // Share resulting value among subscribers
    );
    this.test$ = this.featureResultId$.pipe(
      tap(resultId => this.getFeatureResult(resultId)),
      switchMap(resultId =>
        this._store.select(CustomSelectors.GetFeatureResultById(resultId))
      )
    );
    this.stepResultsUrl$ = this.featureResultId$.pipe(
      map(resultId => `feature_results/999/step_results/${resultId}/`)
    );
  }

  getFeatureResult = resultId =>
    this._store.dispatch(new FeatureResults.GetFeatureResult(resultId, true));

  returnToMain() {
    this._router.navigate([
      'data-driven',
      this._acRouted.snapshot.paramMap.get('id'),
    ]);
  }

  goToDetail(step_id: number) {
    // Save FeatureResult steps for later user in DetailView of clicked step
    this._router
      .navigate(['detail', step_id], { relativeTo: this._acRouted })
      .then(() => window.scrollTo(0, 0));
  }

  @ViewChild(NetworkPaginatedListComponent)
  paginatedList: NetworkPaginatedListComponent;

  /**
   * Performs the overriding action through the Store
   */
  setStepStatus(item: StepResult, status: string) {
    // If Default, compute original value
    if (status === 'Default') {
      status = '';
    }
    if (this.paginatedList) {
      // Launch Store action to process it
      this._api
        .patchStepResult(item.step_result_id, { status })
        .subscribe(res => {
          if (res.success) {
            // Get current steps in view
            const currentSteps = this.paginatedList.pagination$.getValue();
            // Get modifying step index
            const stepIndex = currentSteps.results.findIndex(
              step => step.step_result_id === item.step_result_id
            );
            // Update status value
            currentSteps.results[stepIndex].status = status;
            // Update view
            this.paginatedList.pagination$.next(currentSteps);
          }
        });
    }
  }

  loadImages(item) {
    if (item) {
      this._dialog.open(ScreenshotComponent, {
        data: item,
        panelClass: 'screenshot-panel',
      });
    }
  }
}
