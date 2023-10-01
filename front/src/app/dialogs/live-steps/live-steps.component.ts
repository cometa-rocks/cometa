import { Component, Inject, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogModule } from '@angular/material/legacy-dialog';
import { ApiService } from '@services/api.service';
import { Store, Actions, ofActionCompleted } from '@ngxs/store';
import { Subscribe } from 'app/custom-decorators';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { distinctUntilKeyChanged, filter, map, shareReplay, tap } from 'rxjs/operators';
import { MatLegacyCheckboxChange as MatCheckboxChange, MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { Observable } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { WebSockets } from '@store/actions/results.actions';
import { StepDefinitions } from '@store/actions/step_definitions.actions';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { getBrowserKey } from '@services/tools';
import { TranslateModule } from '@ngx-translate/core';
import { TestDurationPipe } from '../../pipes/test-duration.pipe';
import { BrowserComboTextPipe } from '../../pipes/browser-combo-text.pipe';
import { StoreSelectorPipe } from '../../pipes/store-selector.pipe';
import { BrowserResultStatusPipe } from '@pipes/browser-result-status.pipe';
import { BrowserIconPipe } from '@pipes/browser-icon.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { LiveStepComponent } from './live-step/live-step.component';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatIconModule } from '@angular/material/icon';
import { LetDirective } from '../../directives/ng-let.directive';
import { MatLegacyTabsModule } from '@angular/material/legacy-tabs';
import { NgIf, NgFor, NgSwitch, NgSwitchCase, NgTemplateOutlet, NgSwitchDefault, AsyncPipe, KeyValuePipe } from '@angular/common';

@UntilDestroy()
@Component({
    selector: 'live-steps',
    templateUrl: './live-steps.component.html',
    styleUrls: ['./live-steps.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [NgIf, MatLegacyDialogModule, MatLegacyTabsModule, LetDirective, NgFor, MatIconModule, MatLegacyTooltipModule, NgSwitch, NgSwitchCase, MatLegacyProgressSpinnerModule, NgTemplateOutlet, NgSwitchDefault, LiveStepComponent, MatLegacyCheckboxModule, MatLegacyButtonModule, AsyncPipe, KeyValuePipe, AmParsePipe, BrowserIconPipe, BrowserResultStatusPipe, StoreSelectorPipe, BrowserComboTextPipe, TestDurationPipe, TranslateModule]
})
export class LiveStepsComponent implements OnInit, OnDestroy {

  results$: Observable<IResult>;
  lastFeatureRunID: any;
  status$: Observable<string>;
  feature$: Observable<Feature>;
  steps$: Observable<FeatureStep[]>;

  // Controls de auto scroll
  autoScroll = localStorage.getItem('live_steps_auto_scroll') === 'true';

  constructor(
    private dialogRef: MatDialogRef<LiveStepsComponent>,
    @Inject(MAT_DIALOG_DATA) public feature_id: number,
    private _store: Store,
    private _actions$: Actions,
    private _api: ApiService,
    private _snack: MatSnackBar
  ) {
    this.status$ = this._store.select(CustomSelectors.GetFeatureStatus(this.feature_id));
    this.feature$ = this._store.select(CustomSelectors.GetFeatureInfo(this.feature_id));
    this.results$ = this._store.select(CustomSelectors.GetFeatureResults(this.feature_id));
    this.lastFeatureRunID = CustomSelectors.GetLastFeatureRunID(this.feature_id);
  }

  // Cleanup old or unused runs info on close
  ngOnDestroy = () => this._store.dispatch(new WebSockets.CleanupFeatureResults(this.feature_id));

  trackBrowserFn(index, item) {
    return item.key;
  }

  trackStepFn(index, item) {
    return item.id;
  }

  ngOnInit() {
    // Grab the steps of the feature
    this.steps$ = this._store.select(CustomSelectors.GetFeatureSteps(this.feature_id, 'edit', false, true)).pipe(
      // CustomSelectors.GetFeatureSteps is taxing
      // Therefore we need to share the result among all subscribers
      shareReplay({ bufferSize: 1, refCount: true })
    );
    this._store.dispatch( new StepDefinitions.GetStepsForFeature(this.feature_id) );
    // Scroll handler
    this._actions$.pipe(
      untilDestroyed(this), // Stop emitting events after LiveSteps is closed
      // Filter only by NGXS actions which trigger step index changing
      ofActionCompleted(
        WebSockets.StepStarted,
        WebSockets.StepFinished
      ),
      map(event => event.action),
      filter(action => action.feature_id === this.feature_id),
      distinctUntilKeyChanged('step_index'),
      // Switch current observable to scroll option value
      filter(_ => !!this.autoScroll)
      // Then filter stream by truthy values
    ).subscribe(action => {
      const index = action.step_index;
      const browser = getBrowserKey(action.browser_info);
      const steps = document.querySelector(`.steps-container[browser="${browser}"]`)
      if (steps) {
        // Browser result of current WebSocket is visible
        let runningElement = steps.querySelectorAll('cometa-live-step');
        if (runningElement.length > 0) {
          // Current view has steps visible
          if (runningElement[index]) {
            // Running step exists
            runningElement[index].scrollIntoView({
              block: 'center',
              behavior: 'smooth'
            });
          }
        }
      }
    });
  }

  @Subscribe()
  stopTest() {
    return this._api.stopRunningTask(this.feature_id).pipe(
      tap(answer => {
        if (answer.success) {
          this._snack.open('Test stopped!', 'OK');
          // Let the client clearly know it's stopped
          this.dialogRef.close();
          // Get last runId
          const runId = this._store.selectSnapshot<number>(this.lastFeatureRunID)
          // Tell the store the run has finished with stopped event
          this._store.dispatch( new WebSockets.StoppedFeature( this.feature_id, runId ) );
        } else {
          this._snack.open('An error ocurred', 'OK');
        }
      })
    );
  }

  live(feature_result_id) {
    const url = `/live-session/vnc.html?autoconnect=true&path=feature_result_id/${feature_result_id}`;
    window.open(url, '_blank').focus();
  }

  showLiveIcon(browser) {
    // get data from browser
    const data = browser.value;
    // check if browser is not running on local cloud
    // if so we don't have access to live session
    if (data.browser_info.cloud != 'local') return false;
    // array of status on which not to show the live icon
    const notToShowOn = ['Queued', 'Initializing', 'Timeout', 'Completed'];
    return !notToShowOn.includes(data.status);
  }

  handleScrollChange({ checked }: MatCheckboxChange) {
    this.autoScroll = checked;
    localStorage.setItem('live_steps_auto_scroll', checked.toString())
  }

}
