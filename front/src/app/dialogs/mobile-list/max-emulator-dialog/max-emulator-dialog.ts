import { filter } from 'rxjs/operators';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import {
  MatLegacyDialogRef as MatDialogRef,
  MatLegacyDialog as MatDialog,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { NgIf } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'max-emulator-dialog',
  templateUrl: 'max-emulator-dialog.html',
  styleUrls: ['max-emulator-dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatLegacyDialogModule,
    NgIf,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatListModule,
    CommonModule
  ],
  providers: [
    { provide: MatDialogRef, useValue: {} }
  ]
})
export class MaxEmulatorDialogComponent {
  departments: any;
  emulatorsByDepartment: { [key: string]: { id: number; name: string }[] };

  constructor(
    private _dialog: MatDialog,
    private dialogRef: MatDialogRef<MaxEmulatorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {

  }

  ngOnInit() {
    // Asignamos los datos recibidos a las propiedades
    this.departments = this.data.departments;
    this.emulatorsByDepartment = this.data.emulatorsByDepartment;

    console.log('Departments:', this.departments);
    console.log('Emulators by department:', this.emulatorsByDepartment);
  }

  closeDialog() {
    this._dialog.closeAll();
  }
}
