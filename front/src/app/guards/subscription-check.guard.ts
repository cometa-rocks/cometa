import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  Router,
} from '@angular/router';
import { SelectSnapshot } from '@ngxs-labs/select-snapshot';
import { UserState } from '@store/user.state';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SubscriptionCheckGuard implements CanActivate {
  constructor(private _router: Router) {}

  @SelectSnapshot(UserState) account: UserInfo;

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ):
    | Observable<boolean | UrlTree>
    | Promise<boolean | UrlTree>
    | boolean
    | UrlTree {
    if (this.account.hasOwnProperty('requires_payment')) {
      // Check if the user has at least one subscription active, if not, redirect him to Pricing page
      const requires_payment = this.account.requires_payment;
      if (!requires_payment) return true;
      if (this.account.subscriptions.length > 0) {
        return true;
      } else {
        this._router.navigate(['/pricing']);
        return false;
      }
    } else {
      return true;
    }
  }
}
