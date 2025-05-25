import { Component, Inject, ChangeDetectionStrategy, HostListener } from '@angular/core';
import {
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialog as MatDialog,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { ApiService } from '@services/api.service';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { ScheduleHelp } from '@dialogs/edit-feature/schedule-help/schedule-help.component';
import {
  MatLegacySlideToggleChange as MatSlideToggleChange,
  MatLegacySlideToggleModule,
} from '@angular/material/legacy-slide-toggle';
import { Store } from '@ngxs/store';
import { FeaturesState } from '@store/features.state';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
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
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { MatLegacyOptionModule } from '@angular/material/legacy-core';
import { NgIf, NgFor, AsyncPipe } from '@angular/common';
import { InputFocusService } from '../../services/inputFocus.service';

@UntilDestroy()
@Component({
  selector: 'edit-schedule',
  templateUrl: './edit-schedule.component.html',
  styleUrls: ['./edit-schedule.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    MatLegacyDialogModule,
    NgIf,
    MatLegacyFormFieldModule,
    MatLegacyInputModule,
    MatLegacySelectModule,
    MatLegacyOptionModule,
    DisableAutocompleteDirective,
    NgFor,
    MatLegacySlideToggleModule,
    MatIconModule,
    MatLegacyTooltipModule,
    MatLegacyButtonModule,
    TranslateModule,
    AsyncPipe,
  ],
})
export class EditSchedule {
  schedule: UntypedFormGroup;

  // formLayout is a variable to steer the layout of the schedule edit form
  // ... value: "1" ... means the first layout
  // ... value: "2" ... second layout proposed from Cosimo
  formLayout: Number;
  // The text shown in the link to toggle the layout
  formLayoutTextSelected: String;
  // The Icon shown in front of the link etxt
  formLayoutIcon = 'rotate_right';

  // next runs an array of next executions
  nextRuns: string[] = [];
  // parse error
  parseError = {
    error: false,
    msg: '',
  };
  // get user timezone
  userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  selectedTimezone = 'browser-timezone';

  // Comprehensive list of timezones (based on tz database 2025b - canonical zones only)
  allTimezones = [
    'UTC', 'Etc/UTC', 'Etc/GMT',
    // Americas
    'America/Adak', 'America/Anchorage', 'America/Anguilla', 'America/Antigua', 'America/Araguaina',
    'America/Argentina/Buenos_Aires', 'America/Argentina/Catamarca', 'America/Argentina/Cordoba', 
    'America/Argentina/Jujuy', 'America/Argentina/La_Rioja', 'America/Argentina/Mendoza', 
    'America/Argentina/Rio_Gallegos', 'America/Argentina/Salta', 'America/Argentina/San_Juan', 
    'America/Argentina/San_Luis', 'America/Argentina/Tucuman', 'America/Argentina/Ushuaia',
    'America/Aruba', 'America/Asuncion', 'America/Atikokan', 'America/Bahia', 'America/Bahia_Banderas', 
    'America/Barbados', 'America/Belem', 'America/Belize', 'America/Blanc-Sablon', 'America/Boa_Vista', 
    'America/Bogota', 'America/Boise', 'America/Cambridge_Bay', 'America/Campo_Grande', 'America/Cancun', 
    'America/Caracas', 'America/Cayenne', 'America/Cayman', 'America/Chicago', 'America/Chihuahua', 
    'America/Ciudad_Juarez', 'America/Costa_Rica', 'America/Creston', 'America/Cuiaba', 'America/Curacao', 
    'America/Danmarkshavn', 'America/Dawson', 'America/Dawson_Creek', 'America/Denver', 'America/Detroit', 
    'America/Dominica', 'America/Edmonton', 'America/Eirunepe', 'America/El_Salvador', 'America/Fort_Nelson',
    'America/Fortaleza', 'America/Glace_Bay', 'America/Goose_Bay', 'America/Grand_Turk', 'America/Grenada', 
    'America/Guadeloupe', 'America/Guatemala', 'America/Guayaquil', 'America/Guyana', 'America/Halifax', 
    'America/Havana', 'America/Hermosillo', 'America/Indiana/Indianapolis', 'America/Indiana/Knox', 
    'America/Indiana/Marengo', 'America/Indiana/Petersburg', 'America/Indiana/Tell_City', 'America/Indiana/Vevay', 
    'America/Indiana/Vincennes', 'America/Indiana/Winamac', 'America/Inuvik', 'America/Iqaluit', 'America/Jamaica', 
    'America/Juneau', 'America/Kentucky/Louisville', 'America/Kentucky/Monticello', 'America/La_Paz', 'America/Lima',
    'America/Los_Angeles', 'America/Maceio', 'America/Managua', 'America/Manaus', 'America/Marigot',
    'America/Martinique', 'America/Matamoros', 'America/Mazatlan', 'America/Menominee', 'America/Merida', 
    'America/Metlakatla', 'America/Mexico_City', 'America/Miquelon', 'America/Moncton', 'America/Monterrey', 
    'America/Montevideo', 'America/Montreal', 'America/Montserrat', 'America/Nassau', 'America/New_York', 
    'America/Nipigon', 'America/Nome', 'America/Noronha', 'America/North_Dakota/Beulah', 'America/North_Dakota/Center',
    'America/North_Dakota/New_Salem', 'America/Nuuk', 'America/Ojinaga', 'America/Panama', 'America/Pangnirtung',
    'America/Paramaribo', 'America/Phoenix', 'America/Port_of_Spain', 'America/Port-au-Prince',
    'America/Porto_Velho', 'America/Puerto_Rico', 'America/Punta_Arenas', 'America/Rainy_River',
    'America/Rankin_Inlet', 'America/Recife', 'America/Regina', 'America/Resolute', 'America/Rio_Branco',
    'America/Santarem', 'America/Santiago', 'America/Santo_Domingo', 'America/Sao_Paulo',
    'America/Scoresbysund', 'America/Sitka', 'America/St_Barthelemy', 'America/St_Johns',
    'America/St_Kitts', 'America/St_Lucia', 'America/St_Thomas', 'America/St_Vincent',
    'America/Swift_Current', 'America/Tegucigalpa', 'America/Thule', 'America/Thunder_Bay',
    'America/Tijuana', 'America/Toronto', 'America/Tortola', 'America/Vancouver', 'America/Whitehorse',
    'America/Winnipeg', 'America/Yakutat', 'America/Yellowknife',
    // Europe
    'Europe/Amsterdam', 'Europe/Andorra', 'Europe/Astrakhan', 'Europe/Athens', 'Europe/Belgrade',
    'Europe/Berlin', 'Europe/Bratislava', 'Europe/Brussels', 'Europe/Bucharest', 'Europe/Budapest',
    'Europe/Busingen', 'Europe/Chisinau', 'Europe/Copenhagen', 'Europe/Dublin', 'Europe/Gibraltar',
    'Europe/Guernsey', 'Europe/Helsinki', 'Europe/Isle_of_Man', 'Europe/Istanbul', 'Europe/Jersey',
    'Europe/Kaliningrad', 'Europe/Kirov', 'Europe/Kyiv', 'Europe/Lisbon', 'Europe/Ljubljana', 
    'Europe/London', 'Europe/Luxembourg', 'Europe/Madrid', 'Europe/Malta', 'Europe/Mariehamn', 
    'Europe/Minsk', 'Europe/Monaco', 'Europe/Moscow', 'Europe/Nicosia', 'Europe/Oslo', 'Europe/Paris', 
    'Europe/Podgorica', 'Europe/Prague', 'Europe/Riga', 'Europe/Rome', 'Europe/Samara', 'Europe/San_Marino', 
    'Europe/Sarajevo', 'Europe/Saratov', 'Europe/Simferopol', 'Europe/Skopje', 'Europe/Sofia', 'Europe/Stockholm', 
    'Europe/Tallinn', 'Europe/Tirane', 'Europe/Ulyanovsk', 'Europe/Uzhgorod', 'Europe/Vaduz', 'Europe/Vatican', 
    'Europe/Vienna', 'Europe/Vilnius', 'Europe/Volgograd', 'Europe/Warsaw', 'Europe/Zagreb', 'Europe/Zaporozhye',
    'Europe/Zurich',
    // Asia
    'Asia/Aden', 'Asia/Almaty', 'Asia/Amman', 'Asia/Anadyr', 'Asia/Aqtau', 'Asia/Aqtobe',
    'Asia/Ashgabat', 'Asia/Atyrau', 'Asia/Baghdad', 'Asia/Bahrain', 'Asia/Baku', 'Asia/Bangkok',
    'Asia/Barnaul', 'Asia/Beirut', 'Asia/Bishkek', 'Asia/Brunei', 'Asia/Chita', 'Asia/Choibalsan',
    'Asia/Colombo', 'Asia/Damascus', 'Asia/Dhaka', 'Asia/Dili', 'Asia/Dubai', 'Asia/Dushanbe', 
    'Asia/Famagusta', 'Asia/Gaza', 'Asia/Hebron', 'Asia/Ho_Chi_Minh', 'Asia/Hong_Kong', 'Asia/Hovd', 
    'Asia/Irkutsk', 'Asia/Jakarta', 'Asia/Jayapura', 'Asia/Jerusalem', 'Asia/Kabul', 'Asia/Kamchatka', 
    'Asia/Karachi', 'Asia/Kathmandu', 'Asia/Khandyga', 'Asia/Kolkata', 'Asia/Krasnoyarsk', 'Asia/Kuala_Lumpur', 
    'Asia/Kuching', 'Asia/Kuwait', 'Asia/Macau', 'Asia/Magadan', 'Asia/Makassar', 'Asia/Manila', 'Asia/Muscat', 
    'Asia/Nicosia', 'Asia/Novokuznetsk', 'Asia/Novosibirsk', 'Asia/Omsk', 'Asia/Oral', 'Asia/Phnom_Penh',
    'Asia/Pontianak', 'Asia/Pyongyang', 'Asia/Qatar', 'Asia/Qostanay', 'Asia/Qyzylorda', 'Asia/Riyadh', 
    'Asia/Sakhalin', 'Asia/Samarkand', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Srednekolymsk', 
    'Asia/Taipei', 'Asia/Tashkent', 'Asia/Tbilisi', 'Asia/Tehran', 'Asia/Thimphu', 'Asia/Tokyo', 'Asia/Tomsk', 
    'Asia/Ulaanbaatar', 'Asia/Urumqi', 'Asia/Ust-Nera', 'Asia/Vientiane', 'Asia/Vladivostok', 'Asia/Yakutsk', 
    'Asia/Yangon', 'Asia/Yekaterinburg', 'Asia/Yerevan',
    // Africa
    'Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa', 'Africa/Algiers', 'Africa/Asmara',
    'Africa/Bamako', 'Africa/Bangui', 'Africa/Banjul', 'Africa/Bissau', 'Africa/Blantyre',
    'Africa/Brazzaville', 'Africa/Bujumbura', 'Africa/Cairo', 'Africa/Casablanca', 'Africa/Ceuta',
    'Africa/Conakry', 'Africa/Dakar', 'Africa/Dar_es_Salaam', 'Africa/Djibouti', 'Africa/Douala',
    'Africa/El_Aaiun', 'Africa/Freetown', 'Africa/Gaborone', 'Africa/Harare', 'Africa/Johannesburg',
    'Africa/Juba', 'Africa/Kampala', 'Africa/Khartoum', 'Africa/Kigali', 'Africa/Kinshasa',
    'Africa/Lagos', 'Africa/Libreville', 'Africa/Lome', 'Africa/Luanda', 'Africa/Lubumbashi',
    'Africa/Lusaka', 'Africa/Malabo', 'Africa/Maputo', 'Africa/Maseru', 'Africa/Mbabane',
    'Africa/Mogadishu', 'Africa/Monrovia', 'Africa/Nairobi', 'Africa/Ndjamena', 'Africa/Niamey',
    'Africa/Nouakchott', 'Africa/Ouagadougou', 'Africa/Porto-Novo', 'Africa/Sao_Tome',
    'Africa/Tripoli', 'Africa/Tunis', 'Africa/Windhoek',
    // Australia & Oceania
    'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Broken_Hill', 'Australia/Currie',
    'Australia/Darwin', 'Australia/Eucla', 'Australia/Hobart', 'Australia/Lindeman',
    'Australia/Lord_Howe', 'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney',
    'Pacific/Apia', 'Pacific/Auckland', 'Pacific/Bougainville', 'Pacific/Chatham', 'Pacific/Chuuk',
    'Pacific/Easter', 'Pacific/Efate', 'Pacific/Enderbury', 'Pacific/Fakaofo', 'Pacific/Fiji',
    'Pacific/Funafuti', 'Pacific/Galapagos', 'Pacific/Gambier', 'Pacific/Guadalcanal', 'Pacific/Guam',
    'Pacific/Honolulu', 'Pacific/Kanton', 'Pacific/Kiritimati', 'Pacific/Kosrae', 'Pacific/Kwajalein', 
    'Pacific/Majuro', 'Pacific/Marquesas', 'Pacific/Midway', 'Pacific/Nauru', 'Pacific/Niue', 'Pacific/Norfolk',
    'Pacific/Noumea', 'Pacific/Pago_Pago', 'Pacific/Palau', 'Pacific/Pitcairn', 'Pacific/Pohnpei',
    'Pacific/Port_Moresby', 'Pacific/Rarotonga', 'Pacific/Saipan', 'Pacific/Tahiti', 'Pacific/Tarawa',
    'Pacific/Tongatapu', 'Pacific/Wake', 'Pacific/Wallis'
  ];

  feature: Feature;

  fields = ['minute', 'hour', 'day', 'month', 'dayWeek'];

  // Input focus tracking to disable keyboard shortcuts while typing
  inputFocus: boolean = false;

  constructor(
    private dialogRef: MatDialogRef<EditSchedule>,
    @Inject(MAT_DIALOG_DATA) private feature_id: number,
    private _api: ApiService,
    private snackBar: MatSnackBar,
    private _dialog: MatDialog,
    private _store: Store,
    private _fb: UntypedFormBuilder,
    private log: LogService,
    private inputFocusService: InputFocusService
  ) {
    this.log.msg('1', 'Edit Schedule Constuctor', 'edit-schedule');

    // Set up InputFocusService subscription like other components
    this.inputFocusService.inputFocus$.subscribe(isFocused => {
      this.inputFocus = isFocused;
    });

    // set the default layout of the form for editing schedule
    // "1" is the crontab like layout
    // "2" is the vertical form layout
    this.formLayout = 2;
    this.formLayoutTextSelected = 'horizontal';

    // Create empty form
    this.schedule = this._fb.group({});
    // Iterate each cron field and add control in form
    for (const field of this.fields) {
      // Use different validation patterns for different fields
      let pattern = '^[0-9,-/*]+$'; // Default pattern for most fields
      if (field === 'dayWeek') {
        // Allow letters for day names (SUN, MON, TUE, etc.) in addition to numbers
        pattern = '^[0-9A-Za-z,-/*]+$';
      }
      
      const control = this._fb.control(
        '',
        Validators.compose([
          Validators.required,
          Validators.minLength(1),
          Validators.pattern(pattern),
        ])
      );
      this.schedule.addControl(field, control);
    }
    // Retrieve information about the feature
    this.feature = this._store.selectSnapshot(FeaturesState.GetFeatureInfo)(
      this.feature_id
    );
    // Set the enabled state of Schedule
    this.enableSchedule.next(this.feature.schedule !== '');
    if (this.enableSchedule.getValue()) {
      // Insert schedule value parts into form
      // Use original_cron if available (for timezone-aware schedules), otherwise use schedule
      const cronToDisplay = this.feature.original_cron || this.feature.schedule;
      const cron_values = cronToDisplay.split(' ');
      for (let i = 0; i < this.fields.length; i++) {
        this.schedule.get(this.fields[i]).setValue(cron_values[i]);
      }
      
      // Set the timezone dropdown to the original timezone if available
      if (this.feature.original_timezone) {
        // Use the comprehensive timezone list for validation
        const availableTimezones = [...this.allTimezones, 'browser-timezone'];
        
        if (availableTimezones.includes(this.feature.original_timezone)) {
          this.selectedTimezone = this.feature.original_timezone;
        } else {
          // Fallback to browser timezone if saved timezone is not in dropdown
          this.selectedTimezone = 'browser-timezone';
        }
      } else {
        // Fallback to browser timezone if no original timezone is stored
        this.selectedTimezone = 'browser-timezone';
      }
    } else {
      // Initialize form with default values
      this.schedule.setValue({
        minute: '0,15,30,45',
        hour: '*/2',
        day: '1-31',
        month: '*',
        dayWeek: '*',
      });
    }
    this.enableSchedule.pipe(untilDestroyed(this)).subscribe(enable => {
      if (enable) {
        this.log.msg('1', 'Enable Schedule', 'edit-schedule');
        this.schedule.enable();
        this.parseSchedule(this.schedule.getRawValue());
      } else {
        this.log.msg('1', 'Disable Schedule', 'edit-schedule');
        this.schedule.disable();
      }
      this.schedule.updateValueAndValidity();
    });

    this.schedule.valueChanges.subscribe(expression => {
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
      const cronExpression = Object.values(expression).join(' ');
      
      // Determine which timezone to use for parsing and display
      const displayTimezone = this.selectedTimezone === 'browser-timezone' ? this.userTimezone : this.selectedTimezone;
      
      // Parse the cron expression in the display timezone
      let parser = parseExpression(cronExpression, {
        tz: displayTimezone,
      });
      
      // reset errors
      this.parseError.error = false;
      // reset nextRuns arrays
      this.nextRuns = [];
      
      for (let i = 0; i < 5; i++) {
        const nextDate = parser.next().toDate();
        // Format the date in the display timezone for display
        this.nextRuns.push(nextDate.toLocaleString(undefined, { 
          timeZone: displayTimezone,
          year: 'numeric',
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }));
      }
    } catch (error) {
      this.nextRuns = [];
      this.parseError = {
        error: true,
        msg: error.message,
      };
    }
  }

  onTimezoneChange(event: any) {
    // Update the timezone and re-parse the schedule to show updated times
    this.selectedTimezone = event.value;
    if (this.enableSchedule.getValue()) {
      this.parseSchedule(this.schedule.getRawValue());
    }
  }

  getDisplayTimezone(): string {
    return this.selectedTimezone === 'browser-timezone' ? this.userTimezone : this.selectedTimezone;
  }

  getTimezoneOffset(timezone: string): string {
    try {
      const now = new Date();
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      
      const offsetMinutes = this.getTimezoneOffsetInMinutes(timezone);
      const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
      const offsetMins = Math.abs(offsetMinutes) % 60;
      
      const sign = offsetMinutes >= 0 ? '+' : '-';
      const formattedOffset = offsetMins > 0 
        ? `UTC${sign}${offsetHours}:${offsetMins.toString().padStart(2, '0')}`
        : `UTC${sign}${offsetHours}`;
      
      return formattedOffset;
    } catch (error) {
      return 'UTC';
    }
  }

  private getTimezoneOffsetInMinutes(timezone: string): number {
    try {
      const now = new Date();
      const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const targetTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      
      const offsetMs = targetTime.getTime() - utcTime.getTime();
      return offsetMs / (1000 * 60);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get timezones by continent/region
   */
  getTimezonesByContinent(continent: string): string[] {
    const regex = new RegExp(`^(${continent})`);
    return this.allTimezones
      .filter(tz => regex.test(tz))
      .sort();
  }

  /**
   * Get a display name for a timezone
   */
  getTimezoneDisplayName(timezone: string): string {
    // Remove continent prefix and replace underscores with spaces
    const displayName = timezone
      .split('/')[1] // Get the part after the continent
      ?.replace(/_/g, ' ') // Replace underscores with spaces
      || timezone; // Fallback to original if no slash found
    
    return displayName;
  }

  // triggers the toggle of the layout
  switchFormLayout() {
    // toggle the layout between layout 1 and layout 2
    this.formLayout = this.formLayout == 1 ? 2 : 1;
    // Toggle the string to click on
    this.formLayoutTextSelected =
      this.formLayout == 1 ? 'vertical' : 'horizontal';
    // Toggle the Icon
    this.formLayoutIcon = this.formLayout == 1 ? 'rotate_right' : 'rotate_left';
  }

  updateSchedule() {
    let schedule = [
      this.schedule.value.minute,
      this.schedule.value.hour,
      this.schedule.value.day,
      this.schedule.value.month,
      this.schedule.value.dayWeek,
    ].join(' ');
    
    // Prepare data to send - include timezone information for proper backend processing
    const dataToSend: any = {
      schedule: schedule
    };
    
    if (!this.enableSchedule.getValue()) {
      dataToSend.schedule = '';
      // Clear timezone info when schedule is disabled
      dataToSend.original_timezone = null;
    } else {
      // Add timezone information for backend conversion (same logic as edit-feature)
      if (this.selectedTimezone === 'browser-timezone') {
        dataToSend.original_timezone = this.userTimezone;
      } else {
        dataToSend.original_timezone = this.selectedTimezone;
      }
    }
    
    if (schedule !== this.feature.schedule) {
      // Use patchFeature like edit-feature component does to send timezone information
      this._api.patchFeature(this.feature_id, dataToSend).subscribe(res => {
        if (res.success) {
          this.snackBar.open('Schedule modified', 'OK');
          this._store.dispatch(
            new Features.ModifyFeatureInfo(
              this.feature_id,
              'schedule',
              dataToSend.schedule
            )
          );
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

  // Input focus handling methods
  onInputFocus() {
    this.inputFocus = true;
    this.inputFocusService.setInputFocus(true);
  }

  onInputBlur() {
    this.inputFocus = false;
    this.inputFocusService.setInputFocus(false);
  }

}
