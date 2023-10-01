import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { ApiService } from '@services/api.service';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { Select, Store } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { BehaviorSubject, Observable } from 'rxjs';
import { Environments } from '@store/actions/environments.actions';
import { AreYouSureData, AreYouSureDialog } from '@dialogs/are-you-sure/are-you-sure.component';
import { NgIf, NgClass, AsyncPipe } from '@angular/common';
import { DisableAutocompleteDirective } from '../../../../directives/disable-autocomplete.directive';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

@Component({
    selector: 'environment',
    templateUrl: './environment.component.html',
    styleUrls: ['./environment.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [ReactiveFormsModule, DisableAutocompleteDirective, FormsModule, NgIf, NgClass, AsyncPipe]
})
export class EnvironmentComponent {

  @Select(UserState.GetPermission('edit_environment')) canEditEnvironment$: Observable<boolean>;
  @Select(UserState.GetPermission('delete_environment')) canDeleteEnvironment$: Observable<boolean>;

  constructor(
    private _api: ApiService,
    private _snack: MatSnackBar,
    private _dialog: MatDialog,
    private _store: Store
  ) { }

  @Input() environment: Environment;

  modify = new BehaviorSubject<boolean>(false);

  saveOrEdit() {
    if (this.modify.getValue()) {
      this._api.renameEnvironment(this.environment.environment_id, this.environment.environment_name).subscribe(res => {
        if (res.success) this._snack.open('Environment renamed successfully!', 'OK');
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
      if (answer) this._api.deleteEnvironment(this.environment.environment_id).subscribe(res => {
        if (res.success) {
          this._store.dispatch( new Environments.RemoveEnvironment(this.environment.environment_id) )
          this._snack.open('Environment removed successfully!', 'OK');
        }
      }, err => this._snack.open('An error ocurred', 'OK'));
    });
  }

}
