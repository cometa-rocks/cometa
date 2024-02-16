import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';

@Injectable({
  providedIn: 'root',
})
export class PermissionGuard implements CanActivate {
  constructor(
    private _store: Store,
    private _router: Router
  ) {}

  // Check if the current user has permissions to a given resource
  canActivate(next: ActivatedRouteSnapshot): boolean {
    if (next.data.require_permission) {
      const permission = this._store.selectSnapshot(
        UserState.GetPermission(next.data.require_permission)
      );
      if (permission && next.data.require_permission === 'view_admin_panel') {
        const user = this._store.selectSnapshot<UserInfo>(UserState);
        const tabs = [
          'departments',
          'applications',
          'browsers',
          'environments',
          'features',
          'accounts',
        ];
        const tab_permissions = tabs.filter(
          v => user.user_permissions[`view_${v}_panel`]
        );
        if (tab_permissions.length > 0) {
          this._router.navigate(['/admin', tab_permissions[0]]);
        } else {
          console.log(
            'Oops, looks like you have permission for the admin panel but not for all tabs.'
          );
          history.back();
          return false;
        }
      }
      return permission;
    }
    return true;
  }
}
