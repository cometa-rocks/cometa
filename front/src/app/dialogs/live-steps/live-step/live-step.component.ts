import { animate, style, transition, trigger } from '@angular/animations';
import {
  AsyncPipe,
  NgClass,
  NgIf,
  NgStyle,
  TitleCasePipe,
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { DomSanitizer } from '@angular/platform-browser';
import { ScreenshotComponent } from '@dialogs/screenshot/screenshot.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { ApiService } from '@services/api.service';
import { JsonViewerComponent } from 'app/views/json-view/json-view.component';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LetDirective } from '../../../directives/ng-let.directive';
import { TruncateApiBodyPipe } from '@pipes/truncate-api-body.pipe';

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
    trigger('healingDetailsAnimation', [
      transition(':enter', [
        style({ 
          opacity: 0, 
          transform: 'translateY(-10px) scaleY(0.8)', 
          transformOrigin: 'top',
          maxHeight: 0,
          paddingTop: 0,
          paddingBottom: 0,
          marginTop: 0
        }),
        animate(
          '300ms cubic-bezier(0.4, 0, 0.2, 1)',
          style({ 
            opacity: 1, 
            transform: 'translateY(0) scaleY(1)', 
            maxHeight: '300px',
            paddingTop: '12px',
            paddingBottom: '12px',
            marginTop: '4px'
          })
        ),
      ]),
      transition(':leave', [
        animate(
          '250ms cubic-bezier(0.4, 0, 0.2, 1)',
          style({ 
            opacity: 0, 
            transform: 'translateY(-10px) scaleY(0.8)', 
            transformOrigin: 'top',
            maxHeight: 0,
            paddingTop: 0,
            paddingBottom: 0,
            marginTop: 0
          })
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
    TruncateApiBodyPipe,
  ],
})
export class LiveStepComponent implements OnInit {
  status$ = new BehaviorSubject<string>('waiting');

  error$ = new BehaviorSubject<string>('');
  
  healingData$ = new BehaviorSubject<HealeniumData | undefined>(undefined);
  
  showHealingDetails = false;

  constructor(
    private _store: Store,
    private _dialog: MatDialog,
    private _sanitizer: DomSanitizer,
    private _api: ApiService
  ) {}

  @Input() step: FeatureStep;
  @Input() index: number;
  @Input() feature_result_id: number;
  @Input() featureRunID: number;
  @Input() browser: BrowserstackBrowser;
  @Input() mobiles: any;
  @Input() feature_id: number;
  @Input() steps$: Observable<FeatureStep[]>;

  @Output() updateMobiles: EventEmitter<any> = new EventEmitter<any>();

  details$: Observable<LiveStepSubDetail>;

  screenshots;
  vulnerable_headers_count;
  rest_api: number;

  ngOnInit() {
    this.details$ = this._store.select(
      CustomSelectors.GetLastFeatureRunDetails(
        this.feature_id,
        this.featureRunID,
        this.browser,
        this.index
      )
    );
    this._store
      .select(
        CustomSelectors.GetLastFeatureRunSteps(
          this.feature_id,
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
            const mobiles_info = JSON.parse(JSON.stringify(steps[this.index].mobiles_info));
            this.updateMobiles.emit({
              feature_run_id:this.feature_result_id,
              mobiles_info: mobiles_info
            });
          }
          this.vulnerable_headers_count = steps[this.index].vulnerable_headers_count;
          this.screenshots = steps[this.index].screenshots;
          if (steps[this.index].error)
            this.error$.next(steps[this.index].error);
          // Update healing data
          if (steps[this.index].healing_data) {
            this.healingData$.next(steps[this.index].healing_data);
          } else if (steps[this.index].info && steps[this.index].info.healing_data) {
            // Check if healing data is nested in info
            this.healingData$.next(steps[this.index].info.healing_data);
          }
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
  
  toggleHealingDetails() {
    this.showHealingDetails = !this.showHealingDetails;
  }
  
  getHealingTooltip(healingData: HealeniumData): string {
    return `Self-healed element (${healingData.confidence_score}%)
Original: ${healingData.original_selector}
Healed: ${healingData.healed_selector}
Method: ${healingData.healing_method}
Time: +${healingData.healing_duration_ms}ms`;
  }
}
