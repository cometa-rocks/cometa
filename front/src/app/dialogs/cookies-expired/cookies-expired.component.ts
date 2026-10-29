import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'cookies-expired',
  templateUrl: './cookies-expired.component.html',
  styleUrls: ['./cookies-expired.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
})
export class CookiesExpiredDialog {
  relogin(): void {
    location.reload();
  }
}
