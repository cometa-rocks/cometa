import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { 
  MatLegacyDialogModule, 
  MatLegacyDialogRef,
  MAT_LEGACY_DIALOG_DATA
} from '@angular/material/legacy-dialog';

@Component({
  selector: 'data-driven-stop',
  templateUrl: 'data-driven-stop.component.html',
  styleUrls: ['data-driven-stop.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatLegacyDialogModule, MatLegacyButtonModule],
})
export class DataDrivenTestStop {
  constructor(
    public dialogRef: MatLegacyDialogRef<DataDrivenTestStop>,
    @Inject(MAT_LEGACY_DIALOG_DATA) public data: any,
    private router: Router
  ) {}

  close() {
    this.dialogRef.close();
  }
}
