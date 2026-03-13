import { ChangeDetectionStrategy, Component, Inject, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'feature-created',
  templateUrl: 'feature-created.component.html',
  styleUrls: ['feature-created.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
})
export class FeatureCreated {
  static panelClass = 'no-resize-dialog';

  constructor(
    public dialogRef: MatDialogRef<FeatureCreated>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private router: Router
  ) {}

  // Listen for Ctrl+Enter and trigger go()
  @HostListener('document:keydown', ['$event'])
  handleCtrlEnter(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === 'Enter') {
      this.go();
    }
  }

  onNoClick() {
    this.dialogRef.close();
  }

  go() {
    this.router.navigate([
      this.data.app_name,
      this.data.environment_name,
      this.data.feature_id,
    ]);
    this.dialogRef.close();
  }
}
