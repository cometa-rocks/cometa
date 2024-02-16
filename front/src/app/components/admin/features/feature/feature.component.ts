import {
  Component,
  Input,
  ChangeDetectionStrategy,
  OnInit,
  Output,
  EventEmitter,
  Host,
} from '@angular/core';
import { ApiService } from '@services/api.service';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { Store } from '@ngxs/store';
import { EditFeature } from '@dialogs/edit-feature/edit-feature.component';
import { map } from 'rxjs/operators';
import { FeaturesComponent } from '../features.component';
import { Observable } from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import { Features } from '@store/actions/features.actions';
import {
  AreYouSureData,
  AreYouSureDialog,
} from '@dialogs/are-you-sure/are-you-sure.component';

@Component({
  selector: 'feature',
  templateUrl: './feature.component.html',
  styleUrls: ['./feature.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureComponent implements OnInit {
  canEditFeature$: Observable<boolean>;
  canDeleteFeature$: Observable<boolean>;

  @Output() checkboxChange = new EventEmitter<boolean>();

  constructor(
    private _api: ApiService,
    private _snack: MatSnackBar,
    private _dialog: MatDialog,
    private _store: Store,
    @Host() private _features: FeaturesComponent
  ) {}

  checked$: Observable<boolean>;

  @Input() feature: Feature;

  ngOnInit() {
    this.checked$ = this._features.toExport.pipe(
      map(exports => exports.includes(this.feature.feature_id))
    );
    this.canEditFeature$ = this._store.select(
      CustomSelectors.HasPermission('edit_feature', this.feature)
    );
    this.canDeleteFeature$ = this._store.select(
      CustomSelectors.HasPermission('delete_feature', this.feature)
    );
  }

  saveOrEdit() {
    this._dialog.open(EditFeature, {
      disableClose: true,
      autoFocus: false,
      panelClass: 'edit-feature-panel',
      // @ts-ignore
      data: {
        mode: 'edit',
        feature: {
          app: this.feature.app_name,
          environment: this.feature.environment_name,
          feature_id: this.feature.feature_id,
        },
      } as IEditFeature,
    });
  }

  removeIt() {
    this._dialog
      .open(AreYouSureDialog, {
        data: {
          title: 'translate:you_sure.delete_item_title',
          description: 'translate:you_sure.delete_item_desc',
        } as AreYouSureData,
      })
      .afterClosed()
      .subscribe(answer => {
        if (answer)
          this._api.deleteFeature(this.feature.feature_id).subscribe(
            res => {
              if (res.success) {
                this._store.dispatch(
                  new Features.RemoveFeature(this.feature.feature_id)
                );
                this._snack.open('Feature removed successfully!', 'OK');
              }
            },
            err => this._snack.open('An error ocurred', 'OK')
          );
      });
  }
}
