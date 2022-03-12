import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { ApiService } from '@services/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ScheduleHelp } from '@dialogs/edit-feature/schedule-help/schedule-help.component';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { Store } from '@ngxs/store';
import { FeaturesState } from '@store/features.state';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { BehaviorSubject } from 'rxjs';
import { Features } from '@store/actions/features.actions';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
  selector: 'edit-schedule',
  templateUrl: './edit-schedule.component.html',
  styleUrls: ['./edit-schedule.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditSchedule {

  schedule: FormGroup;

  // formLayout is a variable to steer the layout of the schedule edit form
  // ... value: "1" ... means the first layout
  // ... value: "2" ... second layout proposed from Cosimo
  formLayout : Number
  formLayoutText = ['switch to horizontal layout','switch to vertical layout']
  formLayoutTextSelected : String

  feature: Feature;

  fields = ['minute', 'hour', 'day', 'month', 'dayWeek']

  constructor(
    private dialogRef: MatDialogRef<EditSchedule>,
    @Inject(MAT_DIALOG_DATA) private feature_id: number,
    private _api: ApiService,
    private snackBar: MatSnackBar,
    private _dialog: MatDialog,
    private _store: Store,
    private _fb: FormBuilder
  ) {

    // set the default layout of the form for editing schedule
    // "1" is the crontab like layout
    // "2" is the vertical form layout 
    this.formLayout = 2
    this.formLayoutTextSelected = "horizontal"

    // Create empty form
    this.schedule = this._fb.group({});
    // Iterate each cron field and add control in form
    for (const field of this.fields) {
      const control = this._fb.control('', Validators.compose([Validators.required, Validators.minLength(1), Validators.pattern('^[0-9,-/*]+$')]))
      this.schedule.addControl( field, control )
    }
    // Retrieve information about the feature
    this.feature = this._store.selectSnapshot(FeaturesState.GetFeatureInfo)(this.feature_id);
    // Set the enabled state of Schedule
    this.enableSchedule.next(this.feature.schedule !== '');
    if (this.enableSchedule.getValue()) {
      // Insert schedule value parts into form
      const cron_values = this.feature.schedule.split(' ');
      for (let i = 0; i < this.fields.length; i++) {
        this.schedule.get(this.fields[i]).setValue(cron_values[i]);
      }
    } else {
      // Initialize form with default values
      this.schedule.setValue({
        minute: '0,15,30,45',
        hour: '*/2',
        day: '1-31',
        month: '*',
        dayWeek: '*'
      });
    }
    this.enableSchedule.pipe(
      untilDestroyed(this)
    ).subscribe(enable => {
      if (enable) {
        this.schedule.enable();
      } else {
        this.schedule.disable();
      }
      this.schedule.updateValueAndValidity();
    });
  }

  getHelp() {
    this._dialog.open(ScheduleHelp, { panelClass: 'help-schedule-panel' });
  }

  // triggers the toggle of the layout
  switchFormLayout() {
    // toggle the layout between layout 1 and layout 2
    this.formLayout = (this.formLayout == 1) ? 2 : 1;
    this.formLayoutTextSelected = (this.formLayout == 1) ? 'vertical' : 'horizontal'
  }

  updateSchedule() {
    let schedule = [
      this.schedule.value.minute,
      this.schedule.value.hour,
      this.schedule.value.day,
      this.schedule.value.month,
      this.schedule.value.dayWeek
    ].join(' ');
    if (!this.enableSchedule.getValue()) schedule = '';
    if (schedule !== this.feature.schedule) {
      this._api.updateSchedule(this.feature_id, schedule).subscribe(res => {
        if (res.success) {
          this.snackBar.open('Schedule modified', 'OK');
          this._store.dispatch( new Features.ModifyFeatureInfo(this.feature_id, 'schedule', schedule) );
          this.dialogRef.close();
        } else {
          this.snackBar.open('An error ocurred', 'OK');
        }
      });
    } else {
      this.dialogRef.close();
    }
  }

  changeSchedule(e: MatSlideToggleChange) {
    this.enableSchedule.next(e.checked);
  }

  enableSchedule = new BehaviorSubject<boolean>(false);

}
