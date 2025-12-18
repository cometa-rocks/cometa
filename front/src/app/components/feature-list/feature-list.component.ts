/**
 * feature-list.component.ts
 *
 * Contains the code to control the behaviour of the features list of the main landing
 *
 * @author: Alex Barba
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Select, Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import {
  FeatureFilledInfo,
  FillFeatureInfoPipe,
} from '@pipes/fill-feature-info.pipe';
import { SharedActionsService } from '@services/shared-actions.service';
import { Observable } from 'rxjs';
import { HasPermissionPipe } from '../../pipes/has-permission.pipe';
import { BrowserComboTextPipe } from '../../pipes/browser-combo-text.pipe';
import { LoadingPipe } from '@pipes/loading.pipe';
import { BrowserIconPipe } from '@pipes/browser-icon.pipe';
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { LetDirective } from '../../directives/ng-let.directive';
import {
  NgFor,
  NgClass,
  NgIf,
  NgSwitch,
  NgSwitchCase,
  NgSwitchDefault,
  AsyncPipe,
  LowerCasePipe,
} from '@angular/common';

@Component({
  selector: 'cometa-feature-list',
  templateUrl: './feature-list.component.html',
  styleUrls: ['./feature-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgFor,
    NgClass,
    LetDirective,
    StopPropagationDirective,
    MatTooltipModule,
    NgIf,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    NgSwitch,
    NgSwitchCase,
    NgSwitchDefault,
    MatCheckboxModule,
    MatMenuModule,
    MatDividerModule,
    AsyncPipe,
    LowerCasePipe,
    TranslateModule,
    AmParsePipe,
    AmDateFormatPipe,
    SecondsToHumanReadablePipe,
    BrowserIconPipe,
    LoadingPipe,
    BrowserComboTextPipe,
    HasPermissionPipe,
    FillFeatureInfoPipe,
  ],
})
export class FeatureListComponent {
  @Select(CustomSelectors.GetConfigProperty('sorting'))
  sorting$: Observable<string>;
  @Select(CustomSelectors.GetConfigProperty('reverse'))
  reverse$: Observable<boolean>;

  constructor(
    public _sharedActions: SharedActionsService,
    private _store: Store
  ) {}

  /**
   * List of columns to be shown on the feature list
   */
  displayedColumns = [
    { name: 'ID', key: 'feature_id' },
    { name: 'Name', key: 'feature_name' },
    { name: 'Status', key: 'status' },
    { name: 'Last run', key: 'execution' },
    { name: 'Last duration', key: 'duration' },
    { name: 'Last steps', key: 'last_edited' },
    { name: 'Department', key: null },
    { name: 'Application', key: null },
    { name: 'Environment', key: null },
    { name: 'Browsers', key: null },
    { name: 'Scheduled', key: null },
  ];

  @Input() features: number[];

  @Input() dependsOnOther: boolean;

  trackId = (i, item: FeatureFilledInfo) => item.id;

  trackBrowser = (i, item: BrowserstackBrowser) => JSON.stringify(item);
}
