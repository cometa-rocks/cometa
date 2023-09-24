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
import { FeatureFilledInfo } from '@pipes/fill-feature-info.pipe';
import { SharedActionsService } from '@services/shared-actions.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'cometa-feature-list',
  templateUrl: './feature-list.component.html',
  styleUrls: ['./feature-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
