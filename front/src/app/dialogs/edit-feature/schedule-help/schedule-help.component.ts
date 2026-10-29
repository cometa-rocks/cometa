import { Component, HostListener } from '@angular/core';
import {
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { NgIf } from '@angular/common';

@Component({
  selector: 'schedule-help',
  templateUrl: 'schedule-help.component.html',
  styleUrls: ['schedule-help.component.scss'],
  standalone: true,
  imports: [MatDialogModule, NgIf, MatButtonModule],
})
export class ScheduleHelp {
  constructor(public dialogRef: MatDialogRef<ScheduleHelp>) {}

  usages = {
    minute: false,
    hour: false,
    day_month: false,
    month: false,
    day_week: false,
  };

  onNoClick() {
    this.dialogRef.close();
  }

  @HostListener('document:keydown', ['$event']) handleKeyboardEvent(
    event: KeyboardEvent
  ) {
    // Escape key
    if (event.keyCode === 27) {
      this.dialogRef.close();
    }
  }
}
