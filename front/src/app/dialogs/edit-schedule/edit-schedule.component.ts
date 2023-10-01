import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog, MatLegacyDialogModule } from '@angular/material/legacy-dialog';
import { ApiService } from '@services/api.service';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { ScheduleHelp } from '@dialogs/edit-feature/schedule-help/schedule-help.component';
import { MatLegacySlideToggleChange as MatSlideToggleChange, MatLegacySlideToggleModule } from '@angular/material/legacy-slide-toggle';
import { Store } from '@ngxs/store';
import { FeaturesState } from '@store/features.state';
import { UntypedFormGroup, UntypedFormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject } from 'rxjs';
import { Features } from '@store/actions/features.actions';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { parseExpression } from 'cron-parser';
import { LogService } from '@services/log.service';
import { TranslateModule } from '@ngx-translate/core';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatIconModule } from '@angular/material/icon';
import { DisableAutocompleteDirective } from '../../directives/disable-autocomplete.directive';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { NgIf, NgFor, AsyncPipe } from '@angular/common';

@UntilDestroy()
@Component({
    selector: 'edit-schedule',
    templateUrl: './edit-schedule.component.html',
    styleUrls: ['./edit-schedule.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [ReactiveFormsModule, MatLegacyDialogModule, NgIf, MatLegacyFormFieldModule, MatLegacyInputModule, DisableAutocompleteDirective, NgFor, MatLegacySlideToggleModule, MatIconModule, MatLegacyTooltipModule, MatLegacyButtonModule, TranslateModule, AsyncPipe]
})
export class EditSchedule {

  schedule: UntypedFormGroup;

  // formLayout is a variable to steer the layout of the schedule edit form
  // ... value: "1" ... means the first layout
  // ... value: "2" ... second layout proposed from Cosimo
  formLayout : Number
  // The text shown in the link to toggle the layout
  formLayoutTextSelected : String
  // The Icon shown in front of the link etxt
  formLayoutIcon = "rotate_right"

  // next runs an array of next executions
  nextRuns = [];
  // parse error
  parseError = {
	  "error": false,
	  "msg": ""
  }
  // get user timezone
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  feature: Feature;

  fields = ['minute', 'hour', 'day', 'month', 'dayWeek']

  constructor(
    private dialogRef: MatDialogRef<EditSchedule>,
    @Inject(MAT_DIALOG_DATA) private feature_id: number,
    private _api: ApiService,
    private snackBar: MatSnackBar,
    private _dialog: MatDialog,
    private _store: Store,
    private _fb: UntypedFormBuilder,
    private log: LogService
  ) {

    this.log.msg("1","Edit Schedule Constuctor","edit-schedule")

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
        this.log.msg("1","Enable Schedule","edit-schedule")
        this.schedule.enable();
		this.parseSchedule(this.schedule.getRawValue());
      } else {
        this.log.msg("1","Disable Schedule","edit-schedule")
        this.schedule.disable();
      }
      this.schedule.updateValueAndValidity();
    });

	this.schedule.valueChanges.subscribe((expression) => {
		this.parseSchedule(expression);
	});
  }

  getHelp() {
    this._dialog.open(ScheduleHelp, { panelClass: 'help-schedule-panel' });
  }

  parseSchedule(expression) {
	// ignore if schedule is disabled
	if (!this.schedule.enable) return;

	try {
		// parse cron expression
		let parser = parseExpression(Object.values(expression).join(" "), {utc: true});
		// reset errors
		this.parseError.error = false;
		// reset nextRuns arrays
		this.nextRuns = [];
		for(let i = 0; i<5; i++) { this.nextRuns.push(parser.next().toDate().toLocaleString()); }
	} catch (error) {
		this.nextRuns = [];
		this.parseError = {
			"error": true,
			"msg": error.message
		}
	}
  }

  // triggers the toggle of the layout
  switchFormLayout() {
    // toggle the layout between layout 1 and layout 2
    this.formLayout = (this.formLayout == 1) ? 2 : 1;
    // Toggle the string to click on
    this.formLayoutTextSelected = (this.formLayout == 1) ? 'vertical' : 'horizontal'
    // Toggle the Icon
    this.formLayoutIcon = (this.formLayout == 1) ? 'rotate_right' : 'rotate_left'

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
