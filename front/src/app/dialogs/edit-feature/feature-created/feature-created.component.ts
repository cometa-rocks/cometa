import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';

@Component({
    selector: 'feature-created',
    templateUrl: 'feature-created.component.html',
    styleUrls: ['feature-created.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
  })
  export class FeatureCreated {
  
    constructor(
      public dialogRef: MatDialogRef<FeatureCreated>,
      @Inject(MAT_DIALOG_DATA) public data: any,
      private router: Router
    ) { }
  
    onNoClick() {
      this.dialogRef.close();
    }
  
    go() {
      this.router.navigate([this.data.app_name, this.data.environment_name, this.data.feature_id]);
      this.dialogRef.close();
    }
  }