import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FeaturesState } from '@store/features.state';
import { UserState } from '@store/user.state';
import { ApiService } from '@services/api.service';
import { map, concatMap, finalize } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, from } from 'rxjs';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { exportToJSONFile } from 'ngx-amvara-toolbox';
import { Features } from '@store/actions/features.actions';
import { SharedActionsService } from '@services/shared-actions.service';

@Component({
  selector: 'admin-features',
  templateUrl: './features.component.html',
  styleUrls: ['./features.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeaturesComponent implements OnInit {

  @ViewSelectSnapshot(UserState.GetPermission('create_feature')) canCreateFeature: boolean;
  @ViewSelectSnapshot(FeaturesState.GetFeaturesAsArray) features: Feature[];

  constructor(
    private _api: ApiService,
    private _snack: MatSnackBar,
    private _actionsService: SharedActionsService
  ) { }

  trackByFn(index, item: Feature) {
    return item.feature_id;
  }

  @Dispatch()
  ngOnInit() {
    return new Features.GetFeatures();
  }

  new() {
    this._actionsService.openEditFeature();
  }

  loadingExport$ = new BehaviorSubject<boolean>(false);

  export() {
    const requests = this.features.filter(f => this.toExport.getValue().includes(f.feature_id)).map(f => this._api.getJsonFeatureFile(f.feature_id).pipe(
      map(response => ({ ...f, steps: response }))
    ));
    if (requests.length > 0) {
      this.loadingExport$.next(true);
      const results = [];
      from(requests).pipe(
        concatMap(res => res),
        finalize(() => {
          this.loadingExport$.next(false);
          exportToJSONFile('exported_features', results);
        })
      ).subscribe(response => results.push(response));
    } else {
      this._snack.open('Nothing to export', 'OK');
    }
  }

  selectAll() {
    if (this.toExport.getValue().length !== this.features.length) {
      this.toExport.next(this.features.map(f => f.feature_id));
    } else {
      this.toExport.next([]);
    }
  }

  toExport = new BehaviorSubject<number[]>([]);

  handleCheckbox(feature_id: number, action: boolean) {
    let toExport = this.toExport.getValue();
    if (action) {
      toExport.push(feature_id);
    } else {
      toExport = toExport.filter(t => t !== feature_id);
    }
    this.toExport.next(toExport);
  }

}
