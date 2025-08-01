import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Inject,
  HostListener,
} from '@angular/core';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '@services/api.service';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { SafeStyle, DomSanitizer } from '@angular/platform-browser';
import { API_BASE } from 'app/tokens';
import { ScreenshotComponent } from '@dialogs/screenshot/screenshot.component';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { BehaviorSubject, Observable } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import {
  distinctUntilChanged,
  filter,
  map,
  switchMap,
  tap,
} from 'rxjs/operators';
import { KEY_CODES } from '@others/enums';
import { FeatureResults } from '@store/actions/feature_results.actions';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import {
  AreYouSureData,
  AreYouSureDialog,
} from '@dialogs/are-you-sure/are-you-sure.component';
import { ScreenshotBgPipe } from '@pipes/screenshot-bg.pipe';
import { NumeralPipe } from '@pipes/numeral.pipe';
import { FirstLetterUppercasePipe } from '@pipes/first-letter-uppercase.pipe';
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { NgIf, NgClass, AsyncPipe } from '@angular/common';
import { FeatureActionsComponent } from '../../components/feature-actions/feature-actions.component';
import { FeatureTitlesComponent } from '../../components/feature-titles/feature-titles.component';
import { GraphViewComponent } from '../../views/detail-view/graph-view/graph-view.component';
import { LogService } from '@services/log.service';

@Component({
  selector: 'detail-view',
  templateUrl: './detail-view.component.html',
  styleUrls: ['./detail-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('image1', [
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
      transition('false => true', animate('200ms 500ms ease-in-out')),
    ]),
    trigger('image2', [
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
      transition('false => true', animate('200ms 600ms ease-in-out')),
    ]),
    trigger('image3', [
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
      transition('false => true', animate('200ms 700ms ease-in-out')),
    ]),
  ],
  standalone: true,
  imports: [
    FeatureTitlesComponent,
    FeatureActionsComponent,
    NgIf,
    NgClass,
    MatLegacyProgressSpinnerModule,
    AmParsePipe,
    AmDateFormatPipe,
    SecondsToHumanReadablePipe,
    FirstLetterUppercasePipe,
    NumeralPipe,
    ScreenshotBgPipe,
    AsyncPipe,
    GraphViewComponent,
  ],
})
export class DetailViewComponent implements OnInit {
  @ViewSelectSnapshot(UserState.GetPermission('remove_screenshot'))
  canDeleteScreenshot: boolean;

  ready = new BehaviorSubject<boolean>(false);

  currentStepResult$ = new BehaviorSubject<StepResult>(null);

  constructor(
    private _acRouted: ActivatedRoute,
    private _router: Router,
    private _api: ApiService,
    private _dialog: MatDialog,
    private _sanitizer: DomSanitizer,
    private _store: Store,
    private logger: LogService,
    @Inject(API_BASE) private api_base: string
  ) {}

  previous() {
    // Goes to the previous step
    const previousStepId = this.currentStepResult$.getValue().previous;
    if (previousStepId) {
      this._router
        .navigate(['../../detail', previousStepId], {
          relativeTo: this._acRouted,
        })
        .then(() => window.scrollTo(0, 0));
    }
  }

  next() {
    // Goes to the next step
    const nextStepId = this.currentStepResult$.getValue().next;
    if (nextStepId) {
      this._router
        .navigate(['../../detail', nextStepId], { relativeTo: this._acRouted })
        .then(() => window.scrollTo(0, 0));
    }
  }

  @HostListener('document:keydown', ['$event']) handleKeyboardEvent(
    event: KeyboardEvent
  ) {
    // Handle keyboard arrows, for navigation of steps
    // Only if user is not in zoom image view
    if (this._dialog.openDialogs.length === 0) {
      switch (event.keyCode) {
        case KEY_CODES.RIGHT_ARROW:
          this.next();
          break;
        case KEY_CODES.LEFT_ARROW:
          this.previous();
          break;
        default:
          break;
      }
    }
  }

  removeScreenshot(type: ScreenshotType) {
    this._dialog
      .open(AreYouSureDialog, {
        data: {
          title: 'translate:you_sure.delete_item_title',
          description: 'translate:you_sure.delete_item_desc',
        } as AreYouSureData,
        autoFocus: true,
      })
      .afterClosed()
      .pipe(
        // Filter by Answer --> Yes
        filter(remove => !!remove),
        // Map to current step object value in this component
        map(_ => this.currentStepResult$.getValue()),
        // Perform removal in backend
        switchMap(step =>
          this._api.removeScreenshot(step.step_result_id, type).pipe(
            filter(json => !!json.success),
            map(_ => step)
          )
        ),
        // Perform removal in current step without affecting pipe value
        tap(step => {
          const currentStep = { ...step };
          if (currentStep.screenshots[type]) {
            currentStep.screenshots[type] = 'removed';
          } else {
            currentStep[`screenshot_${type}`] = 'removed';
          }
          this.currentStepResult$.next(currentStep);
        })
      )
      .subscribe(step => {
        if (type === 'style') {
          // Get template filename
          const templateFile =
            step.screenshot_template || step.template_name || '';
          if (templateFile) {
            // Remove template style image if is of type template and exists
            this._api
              .removeTemplate(step.step_result_id, templateFile)
              .subscribe(
                res => {
                  if (!res.success) {
                    console.log(
                      'An error ocurred while removing screenshot',
                      res
                    );
                  }
                },
                err => {
                  console.log(err);
                }
              );
          }
        }
      });
  }

  getIndexImage(type: ScreenshotType): SafeStyle {
    const screenshot = this.currentStepResult$.getValue().screenshots[type];
    return this._sanitizer.bypassSecurityTrustStyle(
      `url(${this.api_base}screenshot/${screenshot}/)`
    );
  }

  featureResult$: Observable<FeatureResult>;

  ngOnInit() {
    // Get Feature Result info
    this._acRouted.paramMap
      .pipe(
        map(params => +params.get('feature_result_id')),
        distinctUntilChanged(),
        tap(
          featureResultId =>
            (this.featureResult$ = this._store.select(
              CustomSelectors.GetFeatureResultById(featureResultId)
            ))
        ),
        switchMap(featureResultId =>
          this._store.dispatch(
            new FeatureResults.GetFeatureResult(featureResultId, true)
          )
        )
      )
      .subscribe(_ => this.ready.next(true));
    // Get Step Result info
    this._acRouted.paramMap
      .pipe(
        map(params => +params.get('step_result_id')),
        distinctUntilChanged(),
        switchMap(stepResultId => this._api.getStepResult(stepResultId))
      )
      .subscribe(stepResult => {
        this.currentStepResult$.next(stepResult);
        this.logger.msg('4',stepResult,'detail-view');
      });
  }

  makeZoom(screenshot) {
    this._dialog.open(ScreenshotComponent, {
      data: screenshot,
      panelClass: 'screenshot-panel',
    });
  }

  returnToSteps() {
    this._router.navigate(['../../'], { relativeTo: this._acRouted });
  }

  returnToMain() {
    this._router.navigate(['../../../../'], { relativeTo: this._acRouted });
  }
}
