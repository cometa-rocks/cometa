import { Component, Inject, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatLegacyDialogModule as MatDialogModule, MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';

@Component({
  selector: 'step-notes',
  templateUrl: './step-notes.component.html',
  styleUrls: ['./step-notes.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatDialogModule, MatButtonModule]
})
export class StepNotesComponent {

  constructor(
    private dialogRef: MatDialogRef<StepNotesComponent>,
    @Inject(MAT_DIALOG_DATA) public note: {
      title: string,
      content: string
    }
  ) { }

  @HostListener('document:keydown', ['$event']) handleKeyboardEvent(event: KeyboardEvent) {
    // Escape key
    if (event.keyCode === 27) this.dialogRef.close();
  }

}
