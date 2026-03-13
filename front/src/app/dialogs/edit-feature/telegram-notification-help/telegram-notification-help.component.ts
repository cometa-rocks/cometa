import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { NgFor } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'cometa-telegram-notification-help',
  templateUrl: 'telegram-notification-help.component.html',
  styleUrls: ['telegram-notification-help.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatDialogModule, NgFor, MatButtonModule],
})
export class TelegramNotificationHelp {

  constructor() {}

} 