import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Host,
  OnInit,
} from '@angular/core';
import { Store } from '@ngxs/store';
import { tap } from 'rxjs/operators';
import { LiveStepsComponent } from '../live-steps.component';
import { DomSanitizer } from '@angular/platform-browser';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { ScreenshotComponent } from '@dialogs/screenshot/screenshot.component';
import { BehaviorSubject, Observable } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { animate, style, transition, trigger } from '@angular/animations';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { JsonViewerComponent } from 'app/views/json-view/json-view.component';
import { ApiService } from '@services/api.service';
import { log } from 'console';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import {
  NgClass,
  NgIf,
  NgStyle,
  AsyncPipe,
  TitleCasePipe,
} from '@angular/common';
import { LetDirective } from '../../../directives/ng-let.directive';

@UntilDestroy()
@Component({
  selector: 'cometa-live-step',
  templateUrl: './live-step.component.html',
  styleUrls: ['./live-step.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('detailAnimation', [
      transition(':enter', [
        style({ transform: 'translateY(100%)', height: 0, opacity: 0 }),
        animate(
          '250ms',
          style({ transform: 'translateY(0)', height: '20px', opacity: 1 })
        ),
      ]),
      transition(':leave', [
        style({ transform: 'translateY(0)', height: '20px', opacity: 1 }),
        animate(
          '250ms',
          style({ transform: 'translateY(100%)', height: 0, opacity: 0 })
        ),
      ]),
    ]),
  ],
  standalone: true,
  imports: [
    LetDirective,
    NgClass,
    MatLegacyTooltipModule,
    NgIf,
    MatIconModule,
    NgStyle,
    AsyncPipe,
    TitleCasePipe,
  ],
})
export class LiveStepComponent implements OnInit {
  status$ = new BehaviorSubject<string>('waiting');

  error$ = new BehaviorSubject<string>('');

  constructor(
    private _store: Store,
    @Host() public _liveSteps: LiveStepsComponent,
    private _dialog: MatDialog,
    private _sanitizer: DomSanitizer,
    private _api: ApiService
  ) {}

  @Input() step: FeatureStep;
  @Input() index: number;
  @Input() featureRunID: number;
  @Input() browser: BrowserstackBrowser;

  details$: Observable<LiveStepSubDetail>;

  screenshots;
  vulnerable_headers_count;
  rest_api: number;

  ngOnInit() {
    this.details$ = this._store.select(
      CustomSelectors.GetLastFeatureRunDetails(
        this._liveSteps.feature_id,
        this.featureRunID,
        this.browser,
        this.index
      )
    );
    this._store
      .select(
        CustomSelectors.GetLastFeatureRunSteps(
          this._liveSteps.feature_id,
          this.featureRunID,
          this.browser
        )
      )
      .pipe(
        untilDestroyed(this),
        tap((steps: StepStatus[]) => (this.resultSteps = steps))
      )
      .subscribe(steps => {
        if (steps && steps[this.index]) {
          if (steps[this.index].running) {
            this.status$.next('running');
          } else {
            this.status$.next(
              steps[this.index].info.success ? 'success' : 'failed'
            );
            this.rest_api = steps[this.index].info.rest_api;
          }
          console.log(steps[this.index].vulnerable_headers_count);
          this.vulnerable_headers_count =
            steps[this.index].vulnerable_headers_count;
          this.screenshots = steps[this.index].screenshots;
          if (steps[this.index].error)
            this.error$.next(steps[this.index].error);
        } else {
          this.status$.next('waiting');
        }
      });
  }

  resultSteps: StepStatus[] = [];

  getScreenshot = (type: string) => {
    if (this.screenshots && this.screenshots[type]) {
      return this._sanitizer.bypassSecurityTrustStyle(
        `url(/v2/screenshots/${this.screenshots[type]})`
      );
    }
    return '';
  };

  openScreenshot(type: string) {
    this._dialog.open(ScreenshotComponent, {
      data: this.screenshots[type],
      panelClass: 'screenshot-panel',
    });
  }

  openRequest() {
    if (this.rest_api) {
      this._api.getRestAPI(this.rest_api).subscribe(result => {
        this._dialog.open(JsonViewerComponent, {
          data: result,
          width: '100vw',
          maxHeight: '90vh',
          maxWidth: '85vw',
          panelClass: 'rest-api-panel',
        });
      });
    }
  }
}
