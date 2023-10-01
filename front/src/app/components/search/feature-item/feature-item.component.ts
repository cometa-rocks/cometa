import { Component, OnInit, Input, ChangeDetectionStrategy } from '@angular/core';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { Observable } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { observableLast } from 'ngx-amvara-toolbox';
import { NavigationService } from '@services/navigation.service';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { SharedActionsService } from '@services/shared-actions.service';
import { BrowserComboTextPipe } from '../../../pipes/browser-combo-text.pipe';
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { StopPropagationDirective } from '../../../directives/stop-propagation.directive';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { NgIf, NgClass, NgSwitch, NgSwitchCase, AsyncPipe, LowerCasePipe } from '@angular/common';
import { LetDirective } from '../../../directives/ng-let.directive';

@Component({
    selector: 'cometa-feature-item',
    templateUrl: './feature-item.component.html',
    styleUrls: ['./feature-item.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [LetDirective, NgIf, MatLegacyTooltipModule, NgClass, MatIconModule, StopPropagationDirective, MatLegacyProgressSpinnerModule, NgSwitch, NgSwitchCase, MatLegacyButtonModule, MatLegacyMenuModule, MatDividerModule, MatLegacyCheckboxModule, AsyncPipe, LowerCasePipe, TranslateModule, AmParsePipe, AmDateFormatPipe, SecondsToHumanReadablePipe, BrowserComboTextPipe]
})
export class FeatureItemComponent implements OnInit {

  @ViewSelectSnapshot(UserState.GetPermission('create_feature')) canCreateFeature: boolean;

  feature$: Observable<Feature>;

  featureRunning$: Observable<boolean>;
  featureStatus$: Observable<string>;
  canEditFeature$: Observable<boolean>;

  canDeleteFeature$: Observable<boolean>;

  constructor(
    private _router: NavigationService,
    private _store: Store,
    public _sharedActions: SharedActionsService
  ) { }

  ngOnInit() {
    this.feature$ = this._store.select(CustomSelectors.GetFeatureInfo(this.feature_id));
    // Subscribe to the running state comming from NGXS
    this.featureRunning$ = this._store.select(CustomSelectors.GetFeatureRunningStatus(this.feature_id));
    // Subscribe to the status message comming from NGXS
    this.featureStatus$ = this._store.select(CustomSelectors.GetFeatureStatus(this.feature_id));
    this.canEditFeature$ = this._store.select(CustomSelectors.HasPermission('edit_feature', this.feature_id));
    this.canDeleteFeature$ = this._store.select(CustomSelectors.HasPermission('delete_feature', this.feature_id));
  }

  async goLastRun() {
    const feature = await observableLast<Feature>(this.feature$);
    this._router.navigate([
      `/${feature.info.app_name}`,
      feature.info.environment_name,
      feature.info.feature_id,
      'step',
      feature.info.feature_result_id
    ], {
      queryParams: {
        runNow: 1
      }
    });
  }

  @Input() feature_id: number;

}
