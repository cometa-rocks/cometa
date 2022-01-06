import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ApiService } from '@services/api.service';
import { MatDialog } from '@angular/material/dialog';
import { EnterValueComponent } from '@dialogs/enter-value/enter-value.component';
import { Select, Store } from '@ngxs/store';
import { EnvironmentsState } from '@store/environments.state';
import { UserState } from '@store/user.state';
import { Subscribe } from 'app/custom-decorators';
import { filter, map, switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Environments } from '@store/actions/environments.actions';

@Component({
  selector: 'admin-environments',
  templateUrl: './environments.component.html',
  styleUrls: ['./environments.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EnvironmentsComponent implements OnInit {

  constructor(
    private _api: ApiService,
    private _dialog: MatDialog,
    private _store: Store
  ) { }

  trackByFn(index, item: Environment) {
    return item.environment_id;
  }

  @Select(UserState.GetPermission('create_environment')) canCreateEnvironment$: Observable<boolean>;
  @Select(EnvironmentsState) environments$: Observable<Environment[]>;

  @Dispatch()
  ngOnInit() {
    return new Environments.GetEnvironments();
  }

  @Subscribe()
  new() {
    return this._dialog.open(EnterValueComponent, {
      autoFocus: true,
      data: {
        word: 'Environment'
      }
    }).afterClosed().pipe(
      map(res => res.value),
      filter(value => !!value),
      switchMap(value => this._api.createEnvironment(value)),
      switchMap(response => this._store.dispatch(
        new Environments.AddEnvironment({
          environment_id: response.environment_id,
          environment_name: response.environment_name
        })
      ))
    );
  }

}
