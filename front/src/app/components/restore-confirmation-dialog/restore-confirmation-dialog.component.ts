import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { ApiService } from '@services/api.service';
import {
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { BehaviorSubject, of } from 'rxjs';
import { finalize, map, switchMap } from 'rxjs/operators';
import { SharedActionsService } from '@services/shared-actions.service';
import { Features } from '@store/actions/features.actions';
import { AsyncPipe } from '@angular/common';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { LetDirective } from '../../directives/ng-let.directive';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'cometa-restore-confirmation-dialog',
  templateUrl: './restore-confirmation-dialog.component.html',
  styleUrls: ['./restore-confirmation-dialog.component.scss'],
  standalone: true,
  imports: [
    MatLegacyDialogModule,
    LetDirective,
    MatLegacyButtonModule,
    AsyncPipe,
    MatIconModule
  ],
})
export class RestoreConfirmationDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<RestoreConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
} 