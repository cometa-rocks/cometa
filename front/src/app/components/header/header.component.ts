import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  trigger,
  state,
  style,
  animate,
  transition,
} from '@angular/animations';
import { UserState } from '@store/user.state';
import { SharedActionsService } from '@services/shared-actions.service';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { CustomSelectors } from '@others/custom-selectors';
import { Configuration } from '@store/actions/config.actions';
import { User } from '@store/actions/user.actions';
import { Store } from '@ngxs/store';

@Component({
  selector: 'header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('opened', [
      state(
        'false',
        style({
          transform: 'translateX(100vw)',
        })
      ),
      state(
        'true',
        style({
          transform: 'translateX(calc(100vw - 360px))',
        })
      ),
      transition('false <=> true', animate('250ms 0ms ease-in-out')),
    ]),
  ],
})
export class HeaderComponent {
  @ViewSelectSnapshot(UserState.GetPermission('view_admin_panel'))
  canViewAdminPanel: boolean;
  @ViewSelectSnapshot(UserState.GetPermission('create_feature'))
  canCreateFeature: boolean;
  @ViewSelectSnapshot(UserState.HasOneActiveSubscription)
  hasSubscription: boolean;
  @ViewSelectSnapshot(UserState.GetRequiresPayment) requiresPayment: boolean;

  /** Holds if the sidebar menu is opened or not */
  @ViewSelectSnapshot(CustomSelectors.GetConfigProperty('internal.openedMenu'))
  openedMenu: boolean;

  constructor(
    public _sharedActions: SharedActionsService,
    private _store: Store
  ) {}

  closeMenu = () =>
    this._store.dispatch(
      new Configuration.SetProperty('internal.openedMenu', false)
    );

  openMenu = () =>
    this._store.dispatch(
      new Configuration.SetProperty('internal.openedMenu', true)
    );

  logout = () => this._store.dispatch(new User.Logout());
}
