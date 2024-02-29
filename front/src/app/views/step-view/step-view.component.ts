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
import { JsonViewerComponent } from '../json-view/json-view.component';
import { StepNotesComponent } from '@dialogs/step-notes/step-notes.component';
import { DownloadNamePipe } from '@pipes/download-name.pipe';
import { DownloadLinkPipe } from '@pipes/download-link.pipe';
import { NumeralPipe } from '@pipes/numeral.pipe';
import { FirstLetterUppercasePipe } from '@pipes/first-letter-uppercase.pipe';
import { PixelDifferencePipe } from '@pipes/pixel-difference.pipe';
import { PercentagePipe } from '@pipes/percentage.pipe';
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatDividerModule } from '@angular/material/divider';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { LetDirective } from '../../directives/ng-let.directive';
import { NetworkPaginatedListComponent as NetworkPaginatedListComponent_1 } from '../../components/network-paginated-list/network-paginated-list.component';
import { RoundProgressModule } from 'angular-svg-round-progressbar';
import {
  NgIf,
  NgClass,
  NgStyle,
  NgFor,
  AsyncPipe,
  JsonPipe,
} from '@angular/common';
import { FeatureActionsComponent } from '../../components/feature-actions/feature-actions.component';
import { FeatureTitlesComponent } from '../../components/feature-titles/feature-titles.component';

@Component({
  selector: 'step-view',
  templateUrl: './step-view.component.html',
  styleUrls: ['./step-view.component.scss'],
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
  standalone: true,
  imports: [
    FeatureTitlesComponent,
    FeatureActionsComponent,
    NgIf,
    RoundProgressModule,
    NetworkPaginatedListComponent_1,
    LetDirective,
    NgClass,
    StopPropagationDirective,
    MatLegacyTooltipModule,
    MatLegacyMenuModule,
    MatDividerModule,
    MatLegacyButtonModule,
    MatIconModule,
    NgStyle,
    NgFor,
    MatLegacyProgressSpinnerModule,
    TranslateModule,
    AmParsePipe,
    AmDateFormatPipe,
    SecondsToHumanReadablePipe,
    PercentagePipe,
    PixelDifferencePipe,
    FirstLetterUppercasePipe,
    NumeralPipe,
    AsyncPipe,
    JsonPipe,
    DownloadLinkPipe,
    DownloadNamePipe,
  ],
})
export class StepViewComponent implements OnInit {
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

  featureId$: Observable<number>;
  featureResultId$: Observable<number>;

  ngOnInit() {
    this.featureId$ = this._acRouted.paramMap.pipe(
      map(params => +params.get('feature')),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }) // Share resulting value among subscribers
    );
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
    this.stepResultsUrl$ = combineLatest([
      this.featureId$,
      this.featureResultId$,
    ]).pipe(
      map(
        ([featureId, resultId]) =>
          `feature_results/${featureId}/step_results/${resultId}/`
      )
    );
  }

  getFeatureResult = resultId =>
    this._store.dispatch(new FeatureResults.GetFeatureResult(resultId, true));

  returnToMain() {
    this._router.navigate([
      this._acRouted.snapshot.paramMap.get('app'),
      this._acRouted.snapshot.paramMap.get('environment'),
      this._acRouted.snapshot.paramMap.get('feature'),
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

  loadRestApi(item) {
    this._api.getRestAPI(item).subscribe(result => {
      this._dialog.open(JsonViewerComponent, {
        data: result,
        width: '100vw',
        maxHeight: '90vh',
        maxWidth: '85vw',
        panelClass: 'rest-api-panel',
      });
    });
  }

  loadNetworkResponses(networkResponses, stepName) {
    this._dialog.open(JsonViewerComponent, {
      data: {
        responses: networkResponses,
        stepName: stepName,
      },
      width: '100vw',
      maxHeight: '90vh',
      maxWidth: '85vw',
      panelClass: 'rest-api-panel',
    });
  }

  openStepNotes(item) {
    this._dialog.open(StepNotesComponent, {
      data: item.notes,
      width: '100vw',
      maxHeight: '80vh',
      maxWidth: '75vw',
    });
  }
}
