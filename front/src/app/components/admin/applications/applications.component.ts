import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { EnterValueComponent } from '@dialogs/enter-value/enter-value.component';
import { ApiService } from '@services/api.service';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { Select, Store } from '@ngxs/store';
import { ApplicationsState } from '@store/applications.state';
import { UserState } from '@store/user.state';
import { Subscribe } from 'app/custom-decorators';
import { filter, map, switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { Applications } from '@store/actions/applications.actions';

@Component({
  selector: 'admin-applications',
  templateUrl: './applications.component.html',
  styleUrls: ['./applications.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApplicationsComponent implements OnInit {

  @Select(UserState.GetPermission('create_application')) canCreateApplication$: Observable<boolean>;

  constructor(
    private _api: ApiService,
    private _dialog: MatDialog,
    private _store: Store
  ) { }

  @Select(ApplicationsState) applications$: Observable<Application[]>;

  ngOnInit() {
    return this._store.dispatch(new Applications.GetApplications());
  }

  trackByFn(index, app: Application) {
    return app.app_id;
  }

  @Subscribe()
  newApp() {
    return this._dialog.open(EnterValueComponent, {
      autoFocus: true,
      data: {
        word: 'Application'
      }
    }).afterClosed().pipe(
      map(res => res.value),
      filter(value => !!value),
      switchMap(value => this._api.createApplication(value)),
      switchMap(response => this._store.dispatch( new Applications.AddApplication({
          app_id: response.app_id,
          app_name: response.app_name
        })
      ))
    );
  }

}
