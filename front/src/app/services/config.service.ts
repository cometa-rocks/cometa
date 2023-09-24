import { Injectable } from '@angular/core';
import { Store } from '@ngxs/store';
import { switchMap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
import { User } from '@store/actions/user.actions';
import { Configuration } from '@store/actions/config.actions';
import { Features } from '@store/actions/features.actions';
import { Applications } from '@store/actions/applications.actions';
import { Environments } from '@store/actions/environments.actions';
import { Actions } from '@store/actions/actions.actions';
import { Departments } from '@store/actions/departments.actions';
import { WebSockets } from '@store/actions/results.actions';
import { Variables } from '@store/actions/variables.actions';
import { Integrations } from '@store/actions/integrations.actions';

@Injectable()
export class ConfigService {
  constructor(private _store: Store) {}

  selectedFolderId = new BehaviorSubject<SelectedFolder>(null);
  openedFolders = new BehaviorSubject<number[]>([]);

  load(): Promise<any> {
    return this._store
      .dispatch(new User.GetUser())
      .pipe(
        switchMap(_ => {
          return this._store.dispatch([
            new Configuration.GetConfig(),
            new Features.GetFolders(),
            new Applications.GetApplications(),
            new Environments.GetEnvironments(),
            new Actions.GetActions(),
            new Integrations.Get(),
            new Departments.GetAdminDepartments(),
            new WebSockets.Load(),
            new Variables.GetVariables(),
            new Features.GetFeatures(),
          ]);
        })
      )
      .toPromise();
  }
}
