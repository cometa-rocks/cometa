import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { ApiService } from '@services/api.service';
import {
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { BehaviorSubject, of } from 'rxjs';
import { finalize, map, switchMap } from 'rxjs/operators';
import { SharedActionsService } from '@services/shared-actions.service';
import { Features } from '@store/actions/features.actions';
import { AsyncPipe } from '@angular/common';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { LetDirective } from '../../directives/ng-let.directive';

@Component({
  selector: 'sure-remove-feature',
  templateUrl: './sure-remove-feature.component.html',
  styleUrls: ['./sure-remove-feature.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatLegacyDialogModule,
    LetDirective,
    MatLegacyButtonModule,
    AsyncPipe,
  ],
})
export class SureRemoveFeatureComponent {
  constructor(
    private dialogRef: MatDialogRef<SureRemoveFeatureComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private _api: ApiService,
    private snackBar: MatSnackBar,
    private _sharedActions: SharedActionsService
  ) {}

  deleting$ = new BehaviorSubject<boolean>(false);

  delete() {
    this.deleting$.next(true);
    // Delete feature in backend
    this._api
      .deleteFeature(this.data.feature_id, {
        loading: 'translate:tooltips.deleting_feature',
      })
      .pipe(
        switchMap(res => {
          if (res.success) {
            // Get folders in backend and remove feature from state
            // This is done sequentially to avoid errors
            return this._sharedActions
              .sequentialStoreDispatch([
                new Features.GetFolders(),
                new Features.RemoveFeature(this.data.feature_id),
              ])
              .pipe(
                // Return the previous response
                map(_ => res)
              );
          } else {
            // Just return the previous response
            return of(res);
          }
        }),
        finalize(() => this.deleting$.next(false))
      )
      .subscribe(
        res => {
          if (res.success) {
            this.snackBar.open(
              'Feature ' + this.data.feature_name + ' removed.',
              'OK'
            );
            this.dialogRef.close();
          } else if (res.handled) {
            this.dialogRef.close();
          } else {
            this.snackBar.open('An error ocurred.', 'OK');
          }
        },
        err => {
          this.snackBar.open('An error ocurred.', 'OK');
        }
      );
  }
}
