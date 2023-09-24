import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { ApiService } from '@services/api.service';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { ModifyUserComponent } from '@dialogs/modify-user/modify-user.component';
import { ModifyPasswordComponent } from '@dialogs/modify-password/modify-password.component';
import { Store, Select } from '@ngxs/store';
import { filter, map, switchMap } from 'rxjs/operators';
import { Subscribe } from 'app/custom-decorators';
import { UserState } from '@store/user.state';
import { BehaviorSubject, Observable } from 'rxjs';
import { Accounts } from '@store/actions/accounts.actions';
import {
  AreYouSureData,
  AreYouSureDialog,
} from '@dialogs/are-you-sure/are-you-sure.component';

@Component({
  selector: 'account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountComponent {
  @Select(UserState.GetPermission('edit_account'))
  canEditAccount$: Observable<boolean>;
  @Select(UserState.GetPermission('delete_account'))
  canDeleteAccount$: Observable<boolean>;

  constructor(
    private _api: ApiService,
    private _snack: MatSnackBar,
    private _dialog: MatDialog,
    private _store: Store
  ) {}

  @Input() account: IAccount;
  @Input() origin: string;

  changePassword() {
    this._dialog.open(ModifyPasswordComponent, {
      disableClose: true,
      panelClass: 'modify-password-panel',
      data: {
        account: {
          ...this.account,
        },
      },
    });
  }

  modify = new BehaviorSubject<boolean>(false);

  @Subscribe()
  edit() {
    return this._dialog
      .open(ModifyUserComponent, {
        disableClose: true,
        panelClass: 'modify-user-panel',
        data: {
          account: {
            ...this.account,
          },
        },
      })
      .afterClosed()
      .pipe(
        filter(acc => !!acc),
        map(account => ({ ...this.account, ...account })),
        switchMap(account =>
          this._store.dispatch(new Accounts.ModifyAccount(account))
        )
      );
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
          this._api.deleteAccount(this.account.user_id).subscribe(
            res => {
              if (res.success) {
                this._store.dispatch(
                  new Accounts.RemoveAccount(this.account.user_id)
                );
                this._snack.open('Account removed successfully!', 'OK');
              }
            },
            err => this._snack.open('An error ocurred', 'OK')
          );
      });
  }
}
