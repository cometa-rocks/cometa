import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { NgFor } from '@angular/common';
import { MatLegacyDialogModule } from '@angular/material/legacy-dialog';

@Component({
  selector: 'cometa-telegram-notification-help',
  templateUrl: 'telegram-notification-help.component.html',
  styleUrls: ['telegram-notification-help.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatLegacyDialogModule, NgFor, MatLegacyButtonModule],
})
export class TelegramNotificationHelp {

  constructor() {}

} 