import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyDialogModule } from '@angular/material/legacy-dialog';

@Component({
    selector: 'cookies-expired',
    templateUrl: './cookies-expired.component.html',
    styleUrls: ['./cookies-expired.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatLegacyDialogModule, MatLegacyButtonModule]
})
export class CookiesExpiredDialog {

  relogin(): void {
    location.reload()
  }
}
