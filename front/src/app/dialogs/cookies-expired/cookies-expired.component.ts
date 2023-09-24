import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'cookies-expired',
  templateUrl: './cookies-expired.component.html',
  styleUrls: ['./cookies-expired.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CookiesExpiredDialog {
  relogin(): void {
    location.reload();
  }
}
