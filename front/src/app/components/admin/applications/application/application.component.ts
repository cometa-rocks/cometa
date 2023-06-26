import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { ApiService } from '@services/api.service';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { Store, Select } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { BehaviorSubject, Observable } from 'rxjs';
import { Applications } from '@store/actions/applications.actions';
import { AreYouSureData, AreYouSureDialog } from '@dialogs/are-you-sure/are-you-sure.component';

@Component({
  selector: 'application',
  templateUrl: './application.component.html',
  styleUrls: ['./application.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApplicationComponent {

  @Select(UserState.GetPermission('edit_application')) canEditApplication$: Observable<boolean>;
  @Select(UserState.GetPermission('delete_application')) canDeleteApplication$: Observable<boolean>;

  constructor(
    private _api: ApiService,
    private _snack: MatSnackBar,
    private _dialog: MatDialog,
    private _store: Store
  ) { }

  @Input() app: Application;

  modify = new BehaviorSubject<boolean>(false);

  saveOrEdit() {
    if (this.modify.getValue()) {
      this._api.renameApplication(this.app.app_id, this.app.app_name).subscribe(res => {
        if (res.success) this._snack.open('Application renamed successfully!', 'OK');
        this.modify.next(false);
      }, err => {
        this._snack.open('An error ocurred', 'OK');
        this.modify.next(false);
      });
    } else {
      this.modify.next(true);
    }
  }

  removeIt() {
    this._dialog.open(AreYouSureDialog, {
      data: {
        title: 'translate:you_sure.delete_item_title',
        description: 'translate:you_sure.delete_item_desc'
      } as AreYouSureData
    }).afterClosed().subscribe(answer => {
      if (answer) this._api.deleteApplication(this.app.app_id).subscribe(res => {
        if (res.success) {
          this._store.dispatch( new Applications.RemoveApplication(this.app.app_id) );
          this._snack.open('Application removed successfully!', 'OK');
        }
      }, err => this._snack.open('An error ocurred', 'OK'));
    });
  }

}
