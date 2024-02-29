import { Injectable, NgZone } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  constructor(
    private _router: Router,
    private _ngZone: NgZone
  ) {}

  /**
   * Same as router navigate but can also be used within async functions
   * @param url {any[]}
   * @param extras {NavigationExtras}
   */
  navigate(commands: any[], extras?: NavigationExtras) {
    this._ngZone.run(() => this._router.navigate(commands, extras));
  }
}
