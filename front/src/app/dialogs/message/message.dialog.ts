import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import {
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';

@Component({
  selector: 'cometa-message',
  templateUrl: './message.dialog.html',
  styleUrls: ['./message.dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatLegacyDialogModule, MatLegacyButtonModule],
})
export class MessageDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public message: Message) {
    console.log(message);
    // Convert message to object if necessary
    if (typeof this.message !== 'object') {
      this.message = JSON.parse(this.message);
    }
  }
}
