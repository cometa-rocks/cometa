import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { InputFocusService } from '@services/inputFocus.service';

interface AddColumnDialogData {
  title?: string;
  placeholder?: string;
  currentValue?: string;
}

@Component({
  selector: 'add-column-name-dialog',
  templateUrl: './add-column-name.component.html',
  styleUrls: ['./add-column-name.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
})
export class AddColumnNameDialogComponent {
  columnName = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AddColumnDialogData,
    private _dialogRef: MatDialogRef<AddColumnNameDialogComponent>,
    public inputFocusService: InputFocusService
  ) {
    // Pre-fill with current value if provided (for rename operation)
    if (this.data.currentValue) {
      this.columnName = this.data.currentValue;
    }
    this._dialogRef.keydownEvents().subscribe(event => {
      if (event.key === 'Escape' || event.keyCode === 27) {
        event.stopPropagation();
        this.cancel();
      }
    });
  }

  accept(): void {
    const name = this.columnName.trim();
    if (name) {
      this._dialogRef.close(name);
    }
  }

  cancel(): void {
    this._dialogRef.close();
  }
} 