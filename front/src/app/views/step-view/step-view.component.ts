import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ViewChild,
  ViewChildren,
  QueryList,
  ElementRef,
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
import { TruncateApiBodyPipe } from '@pipes/truncate-api-body.pipe';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { UserState } from '@store/user.state';
import { Select } from '@ngxs/store';
import { ChangeDetectorRef} from '@angular/core';
import { LogService } from '@services/log.service';
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
    TruncateApiBodyPipe,
  ],
})
export class StepViewComponent implements OnInit {
  clickStepResult: number = null;
  test$: Observable<FeatureResult>;

  @Select(UserState.GetPermission('change_result_status'))
  canChangeResultStatus$: Observable<boolean>;
 
  stepResultsUrl$: Observable<string>;
  counter: number = 0; // Counts how many times the function is called
  
  constructor(
    private _router: Router,
    private _acRouted: ActivatedRoute,
    private _store: Store,
    private _api: ApiService,
    public _sharedActions: SharedActionsService,
    private _dialog: MatDialog,
    private _cdr: ChangeDetectorRef,
    private logger: LogService,
  ) {}

  featureId$: Observable<number>;
  featureResultId$: Observable<number>;
  @ViewChildren('div.status-bar') statusBars!: QueryList<ElementRef>;
  errorCount: number = 0;

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
            // Create a new array with the updated step
            const updatedResults = currentSteps.results.map(step => 
              step.step_result_id === item.step_result_id 
                ? { ...step, status } 
                : step
            );
            // Update view with new object
            this.paginatedList.pagination$.next({
              ...currentSteps,
              results: updatedResults
            });
            this._cdr.detectChanges();
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
    try {
      // Parse the content - this will work for JSON content
      const content = JSON.parse(item.notes.content);
      
      // Check if this is HTML content from accessibility report
      // HTML content will be a string that starts with <html>, <body>, etc.
      if (typeof content === 'string' && 
          (content.trim().startsWith('<html') || 
          content.trim().startsWith('<body') || 
          content.trim().startsWith('<!DOCTYPE') || 
          content.trim().startsWith('<div'))) {
        // It's HTML content - open it directly in a new tab
        this._dialog.open(JsonViewerComponent, {
          data: {
            responses: content,
            stepNameVar: item.step_name,
            openInNewTab: true
          },
          width: '100vw',
          maxHeight: '90vh',
          maxWidth: '85vw',
          panelClass: 'rest-api-panel',
        });
      } else {
        // It's regular JSON content - pass the parsed object
        this._dialog.open(JsonViewerComponent, {
          data: {
            responses: content,
            stepNameVar: item.step_name
          },
          width: '100vw',
          maxHeight: '90vh',
          maxWidth: '85vw',
          panelClass: 'rest-api-panel',
        });
      }
    } catch (e) {
      // If JSON parsing fails, it might be a raw HTML string already
      // Try to handle it as HTML directly
      try {
        const content = item.notes.content;
        if (typeof content === 'string' && 
            (content.trim().startsWith('<html') || 
            content.trim().startsWith('<body') || 
            content.trim().startsWith('<!DOCTYPE') || 
            content.trim().startsWith('<div'))) {
          // It's HTML content - open it directly in a new tab
          this._dialog.open(JsonViewerComponent, {
            data: {
              responses: content,
              stepNameVar: item.step_name,
              openInNewTab: true
            },
            width: '100vw',
            maxHeight: '90vh',
            maxWidth: '85vw',
            panelClass: 'rest-api-panel',
          });
        } else {
          // Neither valid JSON nor recognized HTML
          console.error('Failed to parse step notes content:', e);
          // Still try to display it as-is
          this._dialog.open(JsonViewerComponent, {
            data: {
              responses: content,
              stepNameVar: item.step_name
            },
            width: '100vw',
            maxHeight: '90vh',
            maxWidth: '85vw',
            panelClass: 'rest-api-panel',
          });
        }
      } catch (err) {
        console.error('Failed to handle step notes content:', err);
      }
    }
  }

  onStepRowClick(event: MouseEvent, stepId: number) {
    // If user is selecting text, do not navigate
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }
    this.goToDetail(stepId);
  }

  /**
   * Determines if a feature name should be shown for the current step
   * @param currentItem The current step item
   * @param currentIndex The current index in the list
   * @returns true if the feature name should be displayed
   * 
   * FIX ME:
   * 1. This function is called too many times.
   * 2. It is called hovering the edit icon for all items in the list
   * 3. It is called when hovering the pagination icons
   *  
   */
  shouldShowFeatureName(currentItem: any, currentIndex: number): boolean {
    this.logger.msg('4', `------------------------------`, 'Step View shouldShowFeatureName');
    this.logger.msg('4', `FeatureID: ${currentItem.belongs_to.feature_id} ${currentItem.belongs_to.feature_name}`, 'Step View shouldShowFeatureName');
    this.logger.msg('4', `currentIndex ${currentIndex}`, 'Step View shouldShowFeatureName');

    this.counter = this.counter + 1;

    this.logger.msg('4', `counter ${this.counter} - ${currentItem.step_name}`, 'Step View shouldShowFeatureName');

    if (!currentItem?.belongs_to?.feature_id) {
      this.logger.msg('4', `FeatureID is not set`, 'Step View shouldShowFeatureName');
      return false;
    }
    
    // Always show for the first item
    if (currentIndex === 0) {
      this.logger.msg('4', `currentIndex is 0`, 'Step View shouldShowFeatureName');
      return true;
    }
    
    // Get the current list of items
    const currentSteps = this.paginatedList?.pagination$?.getValue();
    if (!currentSteps?.results || currentIndex >= currentSteps.results.length) {
      this.logger.msg('4', `currentSteps is not set`, 'Step View shouldShowFeatureName');
      return true;
    }
    
    // Check if the previous item has a different feature ID
    const previousItem = currentSteps.results[currentIndex - 1];
    if (!previousItem?.belongs_to?.feature_id) {
      this.logger.msg('4', `previousItem is not set`, 'Step View shouldShowFeatureName');
      return true;
    }
    
    return previousItem.belongs_to.feature_id !== currentItem.belongs_to.feature_id;
  }

  /**
   * Get healing data for a specific step item
   */
  getHealingDataForStep(item: any): HealeniumData | undefined {
    // Check if the item itself has healing_data
    if (item?.healing_data) {
      return item.healing_data;
    }
    // Check if the item has info.healing_data
    if (item?.info?.healing_data) {
      return item.info.healing_data;
    }
    return undefined;
  }

  /**
   * Generate healing tooltip text
   */
  getHealingTooltip(healingData: HealeniumData): string {
    return `Self-healed element (${Math.round(healingData.score * 100)}%)
Original: By.${healingData.original_selector.type}(${healingData.original_selector.value})
Healed: By.${healingData.healed_selector.type}(${healingData.healed_selector.value})
Method: Score-based Tree Comparison
Time: +${healingData.healing_duration_ms}ms`;
  }
}
