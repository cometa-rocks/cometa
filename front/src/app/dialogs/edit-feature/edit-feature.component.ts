import {
  Component,
  OnInit,
  Inject,
  ViewChild,
  ChangeDetectionStrategy,
  HostListener,
  OnDestroy,
  ChangeDetectorRef,
  Renderer2,
  ɵɵtrustConstantResourceUrl,
  ViewChildren,
  QueryList
} from '@angular/core';
import { ApiService } from '@services/api.service';
import { FileUploadService } from '@services/file-upload.service';
import { InputFocusService } from '../../services/inputFocus.service';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { API_URL } from 'app/tokens';
import {
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialog as MatDialog,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import {
  UntypedFormControl,
  UntypedFormGroup,
  Validators,
  UntypedFormBuilder,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import {
  MatLegacyCheckboxChange as MatCheckboxChange,
  MatLegacyCheckboxModule,
} from '@angular/material/legacy-checkbox';
import { StepEditorComponent } from '@components/step-editor/step-editor.component';
import { BrowserSelectionComponent } from '@components/browser-selection/browser-selection.component';
import { AddStepComponent } from '@dialogs/add-step/add-step.component';
import {
  MatLegacyChipListChange as MatChipListChange,
  MatLegacyChipsModule,
} from '@angular/material/legacy-chips';
import { ApplicationsState } from '@store/applications.state';
import { Select, Store } from '@ngxs/store';
import { EnvironmentsState } from '@store/environments.state';
import { ConfigState } from '@store/config.state';
import { UserState } from '@store/user.state';
import { EditVariablesComponent } from '@dialogs/edit-variables/edit-variables.component';
import { BehaviorSubject, Observable, of, Subscription } from 'rxjs';
import { FeatureCreated } from '@dialogs/edit-feature/feature-created/feature-created.component';
import { ScheduleHelp } from '@dialogs/edit-feature/schedule-help/schedule-help.component';
import { MobileListComponent } from '@dialogs/mobile-list/mobile-list.component';
import { EmailTemplateHelp } from './email-template-help/email-template-help.component';
import { KEY_CODES } from '@others/enums';
import { CustomSelectors } from '@others/custom-selectors';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { noWhitespaceValidator, deepClone } from 'ngx-amvara-toolbox';
import { StepDefinitions } from '@store/actions/step_definitions.actions';
import { Features } from '@store/actions/features.actions';
import { FeaturesState } from '@store/features.state';
import { ActionsState } from '@store/actions.state';
import { finalize, switchMap } from 'rxjs/operators';
import {
  AreYouSureData,
  AreYouSureDialog,
} from '@dialogs/are-you-sure/are-you-sure.component';
import { Configuration } from '@store/actions/config.actions';
import { parseExpression } from 'cron-parser';
import { DepartmentsState } from '@store/departments.state';
import { VariablesState } from '@store/variables.state';
import { TranslateModule } from '@ngx-translate/core';
import { HumanizeBytesPipe } from '@pipes/humanize-bytes.pipe';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { DisableAutocompleteDirective } from '../../directives/disable-autocomplete.directive';
import { StepEditorComponent as StepEditorComponent_1 } from '../../components/step-editor/step-editor.component';
import { EditSchedule } from '@dialogs/edit-schedule/edit-schedule.component';
import { RouterLink } from '@angular/router';
import { BrowserSelectionComponent as BrowserSelectionComponent_1 } from '../../components/browser-selection/browser-selection.component';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatLegacyTableModule } from '@angular/material/legacy-table';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { MatLegacyRadioModule } from '@angular/material/legacy-radio';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { LetDirective } from '../../directives/ng-let.directive';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyOptionModule } from '@angular/material/legacy-core';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { NgIf, NgFor, AsyncPipe } from '@angular/common';
import { DraggableWindowModule } from '@modules/draggable-window.module';
import { LogService } from '@services/log.service';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MtxGridColumn } from '@ng-matero/extensions/grid';
import { FilesManagementComponent } from '@components/files-management/files-management.component';
import { PageEvent } from '@angular/material/paginator';
import { Departments } from '@store/actions/departments.actions';
import { TelegramNotificationHelp } from './telegram-notification-help/telegram-notification-help.component';


@Component({
  selector: 'edit-feature',
  templateUrl: './edit-feature.component.html',
  styleUrls: ['./edit-feature.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    NgIf,
    MatLegacyDialogModule,
    MatExpansionModule,
    MatLegacyFormFieldModule,
    MatLegacySelectModule,
    NgFor,
    MatLegacyOptionModule,
    MatLegacyInputModule,
    MatIconModule,
    MatLegacyCheckboxModule,
    MatLegacyTooltipModule,
    LetDirective,
    MatLegacyButtonModule,
    MatLegacyChipsModule,
    MatLegacyRadioModule,
    StopPropagationDirective,
    MatLegacyTableModule,
    MatLegacyProgressSpinnerModule,
    MatLegacyMenuModule,
    ClipboardModule,
    BrowserSelectionComponent_1,
    RouterLink,
    StepEditorComponent_1,
    DisableAutocompleteDirective,
    AsyncPipe,
    AmParsePipe,
    AmDateFormatPipe,
    SortByPipe,
    HumanizeBytesPipe,
    TranslateModule,
    DraggableWindowModule,
    MobileListComponent,
    FilesManagementComponent,
    TelegramNotificationHelp
  ],
})
export class EditFeature implements OnInit, OnDestroy {
  displayedColumns: string[] = [
    'name',
    'type',
    'mime',
    'size',
    'uploaded_by.name',
    'created_on',
    'actions',
  ];
  // Get all expansion panels
  @ViewChildren(MatExpansionPanel) expansionPanels!: QueryList<MatExpansionPanel>;

  @ViewSelectSnapshot(ConfigState) config$!: Config;
  /**
   * These values are now filled in the constructor as they need to initialize before the view
   */
  // @ViewSelectSnapshot(ApplicationsState) applications$ !: Application[];
  // @ViewSelectSnapshot(EnvironmentsState) environments$ !: Environment[];
  // @ViewSelectSnapshot(UserState.RetrieveUserDepartments) departments$ !: Department[];
  applications$!: Application[];
  environments$!: Environment[];
  departments$!: Department[];
  @ViewSelectSnapshot(UserState) user!: UserInfo;
  @ViewSelectSnapshot(UserState.HasOneActiveSubscription)
  hasSubscription: boolean;
  @Select(DepartmentsState) allDepartments$: Observable<Department[]>;
  @Select(VariablesState) variableState$: Observable<VariablePair[]>;

  saving$ = new BehaviorSubject<boolean>(false);

  departmentSettings$: Observable<Department['settings']>;
  variable_dialog_isActive: boolean = false;

  steps$: Observable<FeatureStep[]>;

  // next runs an array of next executions
  nextRuns = [];
  // parse error
  parseError = {
    error: false,
    msg: '',
  };
  // get user timezone
  userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // default to user's browser timezone
  timezone = 'browser-timezone';
  private timezoneOffsetCache = new Map<string, string>();

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

  browserstackBrowsers = new BehaviorSubject<BrowserstackBrowser[]>([]);

  // List of default values to be displayed on the feature information selectors
  selected_department;
  selected_application;
  selected_environment;
  department;
  variables!: VariablePair[];

  readonly separatorKeysCodes: number[] = [ENTER, COMMA];


  @ViewChild(StepEditorComponent, { static: false })
  stepEditor: StepEditorComponent;

  @ViewChild(EditSchedule, { static: false })
  EditSch: EditSchedule;

  @ViewChild(FilesManagementComponent, { static: false })
  filesManagement: FilesManagementComponent;

  inputFocus: boolean = false;

  private inputFocusSubscription: Subscription;

  isExpanded: boolean = false;
  
  private notificationSubscription: Subscription;

  // COTEMP -- Used to check the state data status
  @Select(FeaturesState.GetStateDAta) state$: Observable<
    ReturnType<typeof FeaturesState.GetStateDAta>
  >;

  // Step actions
  @Select(ActionsState) actions$: Observable<Action[]>;

  featureForm: UntypedFormGroup;

  featureId: number;

  features: any[] = [];

  // File columns for files-management component
  fileColumns: MtxGridColumn[] = [
    {
      header: 'ID',
      field: 'id',
      sortable: true,
      class: 'name' 
    },
    {
      header: 'Status',
      field: 'status',
      showExpand: true,
      class: (rowData: UploadedFile, colDef?: MtxGridColumn) => {
        return rowData.status === 'Done' ? '' : 'no-expand';
      },
    },
    { header: 'File Name', field: 'name', sortable: true, class: 'name' },
    { header: 'Type', field: 'type', sortable: true, hide: true },
    { header: 'MIME Type', field: 'mime', sortable: true, hide: true },
    { header: 'Size', field: 'size', sortable: true },
    { header: 'Uploaded By', field: 'uploaded_by.name', sortable: true },
    { header: 'Uploaded On', field: 'created_on', sortable: true },
    {
      header: 'Options',
      field: 'options',
      right: '0px',
      type: 'button',
      buttons: [
        {
          type: 'icon',
          text: 'content_copy',
          icon: 'content_copy',
          tooltip: 'Copy upload path',
          click: (result: UploadedFile) => {
            // Use the file's name directly as the path
            const filePath = `${result.uploadPath}`;
            
            // Use the modern Clipboard API
            navigator.clipboard.writeText(filePath)
              .then(() => {
                // Notify user on success
                this.onFilePathCopy(true);
              })
              .catch(err => {
                this.logger.msg('2', 'Could not copy path', 'Clipboard', err);
                this.onFilePathCopy(false);
              });
          },
          iif: row => row.status === 'Done' && !row.is_removed,
        },
        {
          type: 'icon',
          text: 'cloud_download',
          icon: 'cloud_download',
          tooltip: 'Download file',
          click: (result: UploadedFile) => {
            this.onFileDownloaded(result);
          },
          iif: row => row.status === 'Done' && !row.is_removed,
        },
        {
          type: 'icon',
          text: 'delete',
          icon: 'delete',
          tooltip: 'Delete file',
          color: 'warn',
          click: (result: UploadedFile) => {
            this.onFileDeleted(result);
          },
          iif: row => !row.is_removed && row.status === 'Done',
        },
        {
          type: 'icon',
          text: 'restore',
          icon: 'restore',
          tooltip: 'Restore file',
          click: (result: UploadedFile) => {
            this.onRestoreFile(result);
          },
          iif: row => row.is_removed && row.status === 'Done',
        }
      ]
    }
  ];

  // Add new property for tooltip control
  highlightInput = false;

  constructor(
    public dialogRef: MatDialogRef<EditFeature>,
    @Inject(MAT_DIALOG_DATA) public data: IEditFeature,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
    private _store: Store,
    private _dialog: MatDialog,
    private _fb: UntypedFormBuilder,
    private cdr: ChangeDetectorRef,
    private fileUpload: FileUploadService,
    @Inject(API_URL) public api_url: string,
    private inputFocusService: InputFocusService,
    private logger: LogService,
  ) {

    this.featureId = this.data.feature.feature_id;

    this.features = [
      {
        id: this.featureId,
        name: '',
        panels: Array.from({ length: 7 }, (_, i) => ({ id: (i + 1).toString(), expanded: false }))
      }
    ];

    this.inputFocusService.inputFocus$.subscribe(isFocused => {
      this.inputFocus = isFocused;
    });

    // Create the fields within FeatureForm
    this.featureForm = this._fb.group({
      app_name: ['', Validators.required],
      department_name: ['', Validators.required],
      environment_name: ['', Validators.required],
      feature_name: [
        '',
        // Best way to angular 
        [Validators.required, noWhitespaceValidator],
        // Old validator
        // Validators.compose([Validators.required, noWhitespaceValidator]),
      ],
      description: [''],
      schedule: [''],
      email_address: [[]],
      email_subject: [''],
      email_cc_address: [[]],
      email_bcc_address: [[]],
      email_body: [''],
      address_to_add: [''], // Used only for adding new email addresses
      depends_on_others: [false],
      run_now: [false], // Value changed to false so the create testcase dialog will have the schedule checkbox disabled by default
      send_notification: [false], // Parent control for all notifications
      send_mail: [false],
      network_logging: [false],
      generate_dataset: [false],
      need_help: [false],
      send_telegram_notification: [false],
      telegram_options: this._fb.group({
        include_department: [false],
        include_application: [false],
        include_environment: [false],
        include_feature_name: [false],
        include_datetime: [false],
        include_execution_time: [false],
        include_browser_timezone: [false],
        include_browser: [false],
        include_overall_status: [false],
        include_step_results: [false],
        include_pixel_diff: [false],
        include_feature_url: [false],
        include_failed_step_details: [false],
        attach_pdf_report: [false],
        attach_screenshots: [false],
        custom_message: [''],
        send_on_error: [false],
        do_not_use_default_template: [false],
        check_maximum_notification_on_error_telegram: [false],
        maximum_notification_on_error_telegram: ['3'],
        override_telegram_settings: [false],
        override_bot_token: [''],
        override_chat_ids: [''],
        override_message_thread_id: ['']
      }),
      send_mail_on_error: [false],
      check_maximum_notification_on_error: [false],
      maximum_notification_on_error: ['3'],
      attach_pdf_report_to_email: [true],
      do_not_use_default_template: [false],
      continue_on_failure: [true],
      uploaded_files: [[]],
      video: [true],
      minute: [
        '0',
        Validators.compose([
          Validators.required,
          Validators.pattern('^[0-9,-/*]+$'),
        ]),
      ],
      hour: [
        '0',
        Validators.compose([
          Validators.required,
          Validators.pattern('^[0-9,-/*]+$'),
        ]),
      ],
      day_month: [
        '1',
        Validators.compose([
          Validators.required,
          Validators.pattern('^[0-9,-/*]+$'),
        ]),
      ],
      month: [
        '*',
        Validators.compose([
          Validators.required,
          Validators.pattern('^[0-9,-/*]+$'),
        ]),
      ],
      day_week: [
        '*',
        Validators.compose([
          Validators.required,
          Validators.pattern('^[0-9A-Za-z,-/*]+$'),
        ]),
      ],
    });
    // Gets the currently active route
    let route = this._store.selectSnapshot(FeaturesState.GetCurrentRouteNew);
    // Initialize the departments, applications and environments
    this.departments$ = this._store.selectSnapshot(
      UserState.RetrieveUserDepartments
    );
    this.applications$ = this._store.selectSnapshot(ApplicationsState);
    this.environments$ = this._store.selectSnapshot(EnvironmentsState);
    // Initialize the values selected by default on the mat selector
    // Selected the department where the user is currently at or the first available department, only used when creating a new testcase
    this.selected_department =
      route.length > 0 ? route[0].name : this.departments$[0].department_name;
    this.selected_application = this.applications$[0].app_name;
    this.selected_environment = this.environments$[0].environment_name;
    
    // Add reactive behavior for notification controls
    this.notificationSubscription = this.featureForm.get('send_notification').valueChanges.subscribe(sendNotificationEnabled => {
      if (!sendNotificationEnabled) {
        // When send_notification is disabled, also disable child options
        this.featureForm.get('send_mail').setValue(false, { emitEvent: false });
        this.featureForm.get('send_telegram_notification').setValue(false, { emitEvent: false });
      }
    });
  }

  // Save the state of the expansion panel
  savePanelState(featureId: number, panelId: string, isExpanded: boolean) {
    // This object stores the expansion state of panels for each feature
    // Format: { "comment": "Panel expansion states per feature", "featureId": { "panelId": boolean } }
    const panelStates = JSON.parse(localStorage.getItem('co_mat_expansion_states') || '{"comment": "Panel expansion states per feature"}');

    if (!panelStates[featureId]) {
      panelStates[featureId] = {};
    }

    // Save the state of the panel
    panelStates[featureId][panelId] = isExpanded;
    localStorage.setItem('co_mat_expansion_states', JSON.stringify(panelStates));
  }

  // Load the state of the expansion panel


  getPanelSettingKey(panelId: number): string {
    const panelMap: { [key: number]: string } = {
      1: 'hideInformation',
      2: 'hideSendEmail',
      3: 'hideUploadedFiles',
      4: 'hideBrowsers',
      5: 'hideSteps',
      6: 'hideSchedule'
    };
  
    return panelMap[panelId];
  }

  loadPanelStates() {
    const savedStates = JSON.parse(localStorage.getItem('co_mat_expansion_states') || '{}');
  
    const userSettingsMap = {
      'hideBrowsers': this.user.settings.hideBrowsers,
      'hideInformation': this.user.settings.hideInformation,
      'hideSendMail': this.user.settings.hideSendMail,
      'hideSteps': this.user.settings.hideSteps,
      'hideSchedule': this.user.settings.hideSchedule,
      'hideUploadedFiles': this.user.settings.hideUploadedFiles,
    };
  
    this.features.forEach(feature => {
      if (!feature.id) return;
  
      feature.panels.forEach(panel => {
        //map panel.id to the appropriate setting key:
        const settingKey = this.getPanelSettingKey(panel.id);
        const userSetting = userSettingsMap[settingKey];
        // If setting is explicitly true, force it closed
        if (userSetting === true) {
          panel.expanded = false;
        } else {
          // otherwise, use saved state or default to open
          panel.expanded = savedStates[feature.id]?.[panel.id] ?? true;
        }
      });
    });
  }

  // When the expansion panel changes, save
  onExpansionChange(featureId: number, panelId: string, isExpanded: boolean) {
    this.savePanelState(featureId, panelId, isExpanded);

    // Expand only one panel at a time
    const feature = this.features.find(f => f.id === featureId);
    if (feature) {
      const panel = feature.panels.find(p => p.id === panelId);
      if (panel) {
        panel.expanded = isExpanded;
      }
    }
  }


  // // Check if the create button should be disabled
  // ngAfterViewInit() {
  //   setTimeout(() => {
  //     this.expansionPanels.changes.subscribe(() => this.setFocusOnFirstOpenPanel());
  //     this.setFocusOnFirstOpenPanel();
  //   });
  // }
  
  // Focus on the first input or textarea of the first open panel
  //Unused
  setFocusOnFirstOpenPanel() {
    setTimeout(() => {
      const firstOpenPanel = this.expansionPanels.find(panel => panel.expanded);
  
      if (firstOpenPanel) {
        setTimeout(() => { 
          const panelElement = firstOpenPanel._body?.nativeElement;
  
          if (panelElement) {
            // Filter the input have type hidden and checkbox
            const input = panelElement.querySelector('input:not([type="hidden"]):not([type="checkbox"]), textarea') as HTMLInputElement | HTMLTextAreaElement;
  
            if (input) {
              // Focus on the first input or textarea
              input.focus();
            }
          }
        }, 50);
      }
    });
  }
  

  ngOnDestroy() {
    // When Edit Feature Dialog is closed, clear temporal steps
    return this._store.dispatch(new StepDefinitions.ClearNewFeature());
    this.inputFocusSubscription.unsubscribe();
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
    }
  }

  parseSchedule(expression) {
    // ignore if schedule is disabled
    if (!this.featureForm.value.run_now) {
      return;
    }

    try {
      const cronExpression = Object.values(expression).join(' ');
      
      // Determine which timezone to use for parsing and display
      const displayTimezone = this.timezone === 'browser-timezone' ? this.userTimezone : this.timezone;
      
      // Parse the cron expression as if it's in the selected timezone
      // This gives us the correct times when user enters times in their timezone
      let parser = parseExpression(cronExpression, {
        tz: displayTimezone, // Parse in the selected timezone instead of UTC
      });
      
      // reset errors
      this.parseError.error = false;
      // reset nextRuns arrays
      this.nextRuns = [];
      
      for (let i = 0; i < 5; i++) {
        const nextDate = parser.next().toDate();
        // Format the date in the selected timezone for display
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
      // Trigger change detection to update UI immediately for success case
      this.cdr.detectChanges();

      // Add backend validation to catch mismatches
      this._api.validateCron(cronExpression).subscribe({
        next: (response) => {
          if (response.success && !response.valid) {
            // Frontend parsing succeeded but backend validation failed
            this.parseError = {
              error: true,
              msg: `Backend Validation Error: This cron pattern (${cronExpression}) will be rejected when saving. Please use a valid pattern.`,
            };
            // Trigger change detection to update UI immediately
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          // Don't show error to user for backend validation failures
        }
      });

    } catch (error) {
      this.nextRuns = [];
      this.parseError = {
        error: true,
        msg: error.message,
      };
      // Trigger change detection to update UI immediately for frontend error
      this.cdr.detectChanges();
    }
  }

  onTimezoneChange(event: any) {
    // Update the timezone and re-parse the schedule to show updated times
    this.timezone = event.value;
    if (this.featureForm.value.run_now) {
      const { minute, hour, day_month, month, day_week } = this.featureForm.value;
      this.parseSchedule({ minute, hour, day_month, month, day_week });
    }
  }

  getDisplayTimezone(): string {
    return this.timezone === 'browser-timezone' ? this.userTimezone : this.timezone;
  }

  getTimezoneOffset(timezone: string): string {
    if (this.timezoneOffsetCache.has(timezone)) {
      return this.timezoneOffsetCache.get(timezone)!;
    }
    let result: string;
    try {
      const now = new Date();
      const offsetMinutes = this.getTimezoneOffsetInMinutes(timezone);
      const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
      const offsetMins = Math.abs(offsetMinutes) % 60;
      
      const sign = offsetMinutes >= 0 ? '+' : '-';
      const formattedOffset = offsetMins > 0 
        ? `UTC${sign}${offsetHours}:${offsetMins.toString().padStart(2, '0')}`
        : `UTC${sign}${offsetHours}`;
      
      result = formattedOffset;
    } catch (error) {
      result = 'UTC';
    }

    // Cache the result
    this.timezoneOffsetCache.set(timezone, result);
    return result;
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

  changeSchedule({ checked }: MatCheckboxChange) {
    this.featureForm.get('schedule').setValue(checked ? '' : checked);
    this.featureForm.get('schedule').markAsDirty();
  }

  openScheduleHelp() {
    this._dialog.open(ScheduleHelp, { width: '550px' });
  }

  // Add address to the addresses array
  addAddress(change: MatChipListChange, fieldName: string) {
    // Check email value
    if (change.value) {
      // Accounts with only Default department, are limited, they can only use their own email
      if (
        this.departments$.length === 1 &&
        this.departments$[0].department_name === 'Default' &&
        change.value !== this.user.email
      ) {
        this._snackBar.open(
          'Limited account: You can only add the email assigned to your account',
          'OK'
        );
        this.featureForm.get('address_to_add').setValue('');
        return;
      }
      // Get current addresses
      const addresses = this.featureForm.get(fieldName).value.concat();
      // Perform push only if address doesn't exist already
      if (!addresses.includes(change.value)) {
        addresses.push(change.value);
        this.featureForm.get(fieldName).setValue(addresses);
        this.featureForm.get(fieldName).markAsDirty();
      }
      this.featureForm.get('address_to_add').setValue('');
    }
  }

  // Open variables popup, only if a environment is selected (see HTML)
  editVariables() {
    const environmentId = this.environments$.find(
      env =>
        env.environment_name === this.featureForm.get('environment_name').value
    ).environment_id;
    const departmentId = this.departments$.find(
      dep =>
        dep.department_name === this.featureForm.get('department_name').value
    ).department_id;
    const feature = this.feature.getValue();

    this._dialog
      .open(EditVariablesComponent, {
        data: {
          feature_id: feature.feature_id,
          environment_id: environmentId,
          department_id: departmentId,
          department_name: this.featureForm.get('department_name').value,
          environment_name: this.featureForm.get('environment_name').value,
          feature_name: this.featureForm.get('feature_name').value,
        },
        panelClass: 'edit-variable-panel',
      })
      .afterClosed()
      .subscribe(res => {

      });
  }

  // Open variables popup, only if a environment is selected (see HTML)
  openStartEmulatorScreen() {
    let uploadedAPKsList = this.department.files.filter(file => file.name.endsWith('.apk'));
    const departmentId = this.departments$.find(
      dep =>
        dep.department_name === this.featureForm.get('department_name').value
    ).department_id;
    this._dialog
      .open(MobileListComponent, {
        data: {
          department_id: departmentId,
          uploadedAPKsList: uploadedAPKsList
        },
        panelClass: 'mobile-emulator-panel',
      })
      .afterClosed()
      .subscribe(res => {
      });
  }

  // Remove given address from addresses array
  removeAddress(email: string, fieldName: string) {
    if (email) {
      let addresses = this.featureForm.get(fieldName).value.concat();
      addresses = addresses.filter(addr => addr !== email);
      this.featureForm.get(fieldName).setValue(addresses);
      this.featureForm.get(fieldName).markAsDirty();
    }
  }

  handleBrowserChange(browsers) {
    this.browserstackBrowsers.next(browsers);
  }

  // Handle keyboard keys
  @HostListener('document:keydown', ['$event']) handleKeyboardEvent(
    event: KeyboardEvent
  ) {
    // If the FilesManagement context menu is visible, let it handle ESC and skip processing here
    if (event.key === 'Escape') {
      const contextMenuEl = document.querySelector('.ngx-contextmenu') as HTMLElement | null;
      if (contextMenuEl && contextMenuEl.style.display !== 'none') {
        // A context menu is open – don't process ESC in EditFeature
        return;
      }
    }
    // If true... return | only execute switch case if input focus is false
    let KeyPressed = event.keyCode;
    const editVarOpen = document.querySelector('edit-variables') as HTMLElement;
    const startEmulatorOpen = document.querySelector('mobile-list') as HTMLElement;
    const apiScreenOpen = document.querySelector('.api-testing-container') as HTMLElement;
    const emailTemplateHelpOpen = document.querySelector('cometa-email-template-help') as HTMLElement;
    const scheduleHelpOpen = document.querySelector('schedule-help') as HTMLElement;
    const areYouSureOpen = document.querySelector('are-you-sure') as HTMLElement;
    const contextMenuOpen = this.filesManagement?.contextMenuOpen || false;
    
    if(editVarOpen == null && startEmulatorOpen == null && apiScreenOpen == null && emailTemplateHelpOpen == null && scheduleHelpOpen == null && !contextMenuOpen && areYouSureOpen == null){
      switch (event.keyCode) {
        case KEY_CODES.ESCAPE:
          // Check if form has been modified before closing
          if (this.hasChanged()) {
            this._dialog
              .open(AreYouSureDialog, {
                data: {
                  title: 'translate:you_sure.quit_title',
                  description: 'translate:you_sure.quit_desc',
                } as AreYouSureData,
                autoFocus: true,
              })
              .afterClosed()
              .subscribe(exit => {
                // Close edit feature popup
                if (exit) this.dialogRef.close();
              });
          } else {
            this.dialogRef.close();
          }
          break;
        case KEY_CODES.ENTER:
          // Check if Ctrl key is pressed for Ctrl+Enter
          if (event.ctrlKey) {
            // Trigger save button click
            this.editOrCreate();
            event.preventDefault();
          }
          break;
        case KEY_CODES.V:
          // Only trigger shortcut if not focused on input and not using Ctrl+V
          if(!event.ctrlKey && !this.inputFocus){
            // Edit variables
            this.editVariables();
          }
          break;
        case KEY_CODES.D:
          if(!event.ctrlKey && !this.inputFocus) {
            // Depends on other feature
            this.toggleDependsOnOthers(KeyPressed);
          }
          break;
        case KEY_CODES.S:
          if(!event.ctrlKey && !this.inputFocus) {
            // Open Emulator mobile
            this.openStartEmulatorScreen();
          }
          break;
        case KEY_CODES.M:
          if(!event.ctrlKey && !this.inputFocus) {
            // Send notification on finish
            this.toggleDependsOnOthers(KeyPressed);
          }
          break;
        case KEY_CODES.R:
          if(!event.ctrlKey && !this.inputFocus) {
            // Record video
            this.toggleDependsOnOthers(KeyPressed);
          }
          break;
        case KEY_CODES.F:
          if(!event.ctrlKey && !this.inputFocus) {
            // Continue on failure
            this.toggleDependsOnOthers(KeyPressed);
          }
          break;
        case KEY_CODES.H:
          if(!event.ctrlKey && !this.inputFocus) {
            // Need help
            this.toggleDependsOnOthers(KeyPressed);
          }
          break;
        case KEY_CODES.N:
          if(!event.ctrlKey && !this.inputFocus) {
            // Network logging
            this.toggleDependsOnOthers(KeyPressed);
          }
          break;
        case KEY_CODES.T:
          if(!event.ctrlKey && !this.inputFocus) {
            // Telegram notification
            this.toggleDependsOnOthers(KeyPressed);
          }
          break;
        case KEY_CODES.G:
          if(!event.ctrlKey && !this.inputFocus) {
            // Generate dataset
            this.toggleDependsOnOthers(KeyPressed);
          }
          break;
        default:
          break;
      }
    }
  }

  // Shortcut emitter to parent component
  receiveDataFromChild(isFocused: boolean) {
    this.inputFocus = isFocused;
  }

  // Check if focused on input or textarea
  onInputFocus() {
    this.inputFocus = true;
  }

  onInputBlur() {
    this.inputFocus = false;
  }

  // New method to handle focus change from files-management search input
  onSearchFocusChanged(isFocused: boolean) {
    this.inputFocus = isFocused;
    this.cdr.markForCheck();
  }

  toggleDependsOnOthers(KeyPressed) {
    if(KeyPressed === KEY_CODES.D) {
      const dependsOnOthers = this.featureForm.get('depends_on_others').value;
      this.featureForm.get('depends_on_others').setValue(!dependsOnOthers);
    }
    else if (KeyPressed === KEY_CODES.F) {
      const continueOnFailure = this.featureForm.get('continue_on_failure').value;
      this.featureForm.get('continue_on_failure').setValue(!continueOnFailure);
    }
    else if (KeyPressed === KEY_CODES.H) {
      const needHelp = this.featureForm.get('need_help').value;
      this.featureForm.get('need_help').setValue(!needHelp);
    }
    else {
      const dependsOnOthers = this.featureForm.get('depends_on_others').value;
      if(dependsOnOthers === false) {
        if(KeyPressed === KEY_CODES.M) {
          const sendNotification = this.featureForm.get('send_notification').value;
          this.featureForm.get('send_notification').setValue(!sendNotification);
        }
        else if (KeyPressed === KEY_CODES.R) {
          const video = this.featureForm.get('video').value;
          this.featureForm.get('video').setValue(!video);
        }
        else if (KeyPressed === KEY_CODES.N) {
          const networkLogging = this.featureForm.get('network_logging').value;
          this.featureForm.get('network_logging').setValue(!networkLogging);
        }
        else if (KeyPressed === KEY_CODES.G) {
          const generateDataset = this.featureForm.get('generate_dataset').value;
          this.featureForm.get('generate_dataset').setValue(!generateDataset);
        }
      }
    }
  }

  // Check if mouse is over the dialog (puede ser step definition?)
  isHovered = false;

  onMouseOver() {
    this.isHovered = true;
  }

  onMouseOut() {
    this.isHovered = false;
  }


  // Deeply check if two arrays are equal, in length and values
  arraysEqual(a: any[], b: any[]): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /**
   * Check if edit feature form has different values from original object
   */
  hasChanged(): boolean {
    // Retrieve original feature data, when mode is `new` it will only have `feature_id: 0`
    const featureOriginal = this.feature.getValue();
    /**
     * Detect changes in formular
     * Procedure:
     *  1. Check if formular has been modified (dirty)
     *  2. Check if the form field has been modified (dirty)
     *  3. Check if the original feature value is different from the new one
     */
    if (this.featureForm.dirty) {
      // The first selectors needs custom comparison logic
      // Check Department
      const departmentField = this.featureForm.get('department_name');
      if (departmentField.dirty && departmentField.value) {
        const departmentId = this.departments$.find(
          dep => dep.department_name === departmentField.value
        ).department_id;
        if (
          this.data.mode === 'new' ||
          featureOriginal.department_id !== departmentId
        )
          return true;
      }
      // Check application
      const applicationField = this.featureForm.get('app_name');
      if (applicationField.dirty && applicationField.value) {
        const appId = this.applications$.find(
          app => app.app_name === applicationField.value
        ).app_id;
        if (this.data.mode === 'new' || featureOriginal.app_id !== appId)
          return true;
      }
      // Check environment
      const environmentField = this.featureForm.get('environment_name');
      if (environmentField.dirty && environmentField.value) {
        const environmentId = this.environments$.find(
          env => env.environment_name === environmentField.value
        ).environment_id;
        if (
          this.data.mode === 'new' ||
          featureOriginal.environment_id !== environmentId
        )
          return true;
      }
      // Declare an array of fields with the same key name in original feature and modified
      let fields = [
        'description',
        'depends_on_others',
        'send_mail',
        'need_help',
        'feature_name',
        'video',
        'continue_on_failure',
      ];
      // Add fields mandatory for Send email
      if (this.featureForm.get('send_mail').value) {
        fields = [
          ...fields,
          'email_address',
          'email_cc_address',
          'email_bcc_address',
          'email_subject',
          'email_body',
          'send_mail_on_error',
          'maximum_notification_on_error',
          'check_maximum_notification_on_error',
          'attach_pdf_report_to_email',
          'do_not_use_default_template',
        ];
      }
      // Add fields mandatory for Schedule
      if (this.featureForm.get('run_now').value) {
        fields = [
          ...fields,
          'minute',
          'hour',
          'day_month',
          'month',
          'day_week',
        ];
      }
      // Iterate each field
      for (const key of fields) {
        const field = this.featureForm.get(key);
        // Check if field is changed and has value
        if (field.dirty && field.value) {
          // Custom logic for array values
          if (Array.isArray(field.value)) {
            if (
              this.data.mode === 'new' ||
              JSON.stringify(field.value) !==
                JSON.stringify(featureOriginal[key])
            ) {
              return true;
            }
          } else {
            if (featureOriginal[key] !== field.value) {
              return true;
            }
          }
        }
      }
    }
    /**
     * Detect changes made outside of formular code
     */
    // Check browsers
    if (
      JSON.stringify(this.browsersOriginal) !==
      JSON.stringify(this.browserstackBrowsers.getValue())
    )
      return true;
    /**
     * Detect changes in Step Editor
     */
    if (this.stepEditor) {
      const currentSteps = this.stepEditor.getSteps();
      if (this.stepsOriginal.length === currentSteps.length) {
        // Deep compare then
        // Compare step fields
        const fieldsToCompare = [
          'step_content',
          'enabled',
          'screenshot',
          'compare',
        ];
        for (let i = 0; i < currentSteps.length; i++) {
          for (const field of fieldsToCompare) {
            if (currentSteps[i][field] !== this.stepsOriginal[i][field]) {
              return true;
            }
          }
        }
      } else {
        return true;
      }
    }
    return false;
  }

  @ViewChild(BrowserSelectionComponent, { static: false })
  _browserSelection: BrowserSelectionComponent;
  configValueBoolean: boolean = false;

  ngOnInit() {
    // Initialize department if there's already a value in the form
    if (this.featureForm.get('department_name').value) {
      this.allDepartments$.subscribe(data => {
        this.department = data.find(
          dep => dep.department_name === this.featureForm.get('department_name').value
        );
        this.cdr.detectChanges();
      });
    }

    // Subscribe to department name changes
    this.featureForm
      .get('department_name')
      .valueChanges.subscribe(department_name => {
        this.allDepartments$.subscribe(data => {
          if (!data) return;
          
          this.department = data.find(
            dep => dep.department_name === department_name
          );
          
          if (this.department) {
            this.fileUpload.validateFileUploadStatus(this.department);
          }
          this.cdr.detectChanges();
        });
      });

    // Initialize localStorage with a comment if it doesn't exist
    if (!localStorage.getItem('co_mat_expansion_states')) {
      localStorage.setItem('co_mat_expansion_states', JSON.stringify({
        "comment": "Panel expansion states per feature",
        "Default": {}
      }));
    }

    // Show panel expansion states from localstorage
    this.logger.msg('4', 'Localstorage panel expansion states', localStorage.getItem('co_mat_expansion_states'));
    
    // Show panel states from user settings
    this.logger.msg('4', 'Panel States', 'User current panel states:' + JSON.stringify(this.user.settings));

    this.loadPanelStates();

    this._api.getCometaConfigurations().subscribe(res => {

      const config_feature_mobile = res.find((item: any) => item.configuration_name === 'COMETA_FEATURE_MOBILE_TEST_ENABLED');
      if (config_feature_mobile) {
        this.configValueBoolean = !!JSON.parse(config_feature_mobile.configuration_value.toLowerCase());
        this.cdr.detectChanges();
      }
    })

    // Connection with the service who is connected with Step-editor
    this.inputFocusSubscription = this.inputFocusService.inputFocus$.subscribe(isFocused => {
      this.inputFocus = isFocused;
    });

    this.checkForCreateButton();

    this.featureForm.valueChanges.subscribe(() => {
      this.variableState$.subscribe(data => {
        this.variables = this.getFilteredVariables(data);
      });
    });

    const scheduleControls = ['minute', 'hour', 'day_month', 'month', 'day_week'];
    scheduleControls.forEach(controlName => {
      this.featureForm.get(controlName).valueChanges.subscribe(value => {
        if (this.featureForm.get('run_now').value) {
          this.parseSchedule({
            minute: this.featureForm.get('minute').value,
            hour: this.featureForm.get('hour').value,
            day_month: this.featureForm.get('day_month').value,
            month: this.featureForm.get('month').value,
            day_week: this.featureForm.get('day_week').value
          });
        }
      });
    });

    this.featureForm.get('run_now').valueChanges.subscribe(isEnabled => {
      if (isEnabled) {
        this.parseSchedule({
          minute: this.featureForm.get('minute').value,
          hour: this.featureForm.get('hour').value,
          day_month: this.featureForm.get('day_month').value,
          month: this.featureForm.get('month').value,
          day_week: this.featureForm.get('day_week').value
        });
      }
    });

    if (this.data.mode === 'edit' || this.data.mode === 'clone') {
      // Code for editing feautre
      const featureInfo = this.data.info;
      // Initialize the selected by default application, department and environment
      this.selected_application = featureInfo.app_name;
      this.selected_department = featureInfo.department_name;
      this.selected_environment = featureInfo.environment_name;
      this.feature.next(featureInfo);
      // Assign observable of department settings
      this.departmentSettings$ = this._store.select(
        CustomSelectors.GetDepartmentSettings(featureInfo.department_id)
      );
      this.browserstackBrowsers.next(featureInfo.browsers);
      this.browsersOriginal = deepClone(featureInfo.browsers);
      this.featureForm.get('run_now').setValue(featureInfo.schedule !== '');
      if (featureInfo.schedule) {
        const cron_fields = [
          'minute',
          'hour',
          'day_month',
          'month',
          'day_week',
        ];
        
        // Use original_cron if available (for timezone-aware schedules), otherwise use schedule
        const cronToDisplay = featureInfo.original_cron || featureInfo.schedule;
        const cron_values = cronToDisplay.split(' ');
        
        for (let i = 0; i < cron_fields.length; i++) {
          this.featureForm.get(cron_fields[i]).setValue(cron_values[i]);
        }
        
        // Set the timezone dropdown to the original timezone if available
        if (featureInfo.original_timezone) {
          // Use the comprehensive timezone list for validation
          const availableTimezones = [...this.allTimezones, 'browser-timezone'];
          
          if (availableTimezones.includes(featureInfo.original_timezone)) {
            this.timezone = featureInfo.original_timezone;
          } else {
            // Fallback to browser timezone if saved timezone is not in dropdown
            this.timezone = 'browser-timezone';
          }
        } else {
          // Fallback to browser timezone if no original timezone is stored
          this.timezone = 'browser-timezone';
        }
        // Trigger change detection to ensure the dropdown updates
        this.cdr.detectChanges();
        
        if (this.featureForm.value.run_now) {
          const { minute, hour, day_month, month, day_week } = this.featureForm.value;
          this.parseSchedule({ minute, hour, day_month, month, day_week });
        }
      }
      // Try to save all possible feature properties in the form using the same property names
      for (const key in featureInfo) {
        if (this.featureForm.get(key) instanceof UntypedFormControl) {
          this.featureForm.get(key).setValue(featureInfo[key]);
        }
      }
      
      // Special handling for nested telegram_options FormGroup
      if (featureInfo.telegram_options) {
        const telegramOptionsGroup = this.featureForm.get('telegram_options') as UntypedFormGroup;
        if (telegramOptionsGroup) {
          telegramOptionsGroup.patchValue(featureInfo.telegram_options);
        }
      }
      
      // Backward compatibility: Enable send_notification if send_mail or send_telegram_notification are enabled
      // but send_notification is not explicitly set
      if (featureInfo.send_notification === undefined || featureInfo.send_notification === null) {
        const shouldEnableNotifications = featureInfo.send_mail || featureInfo.send_telegram_notification;
        this.featureForm.get('send_notification').setValue(shouldEnableNotifications);
      }
      
      this.stepsOriginal = this.data.steps;
    } else {
      // Code for creating a feature
      // set user preselect options
      this.feature.next(this.data.feature);
      this.preSelectedOptions();
    }
    // @ts-ignore
    if (!this.feature) this.feature = { feature_id: 0 };
    const featureId =
      this.data.mode === 'clone' ? 0 : this.data.feature.feature_id;
    this.steps$ = this._store.select(
      CustomSelectors.GetFeatureSteps(featureId)
    );

    this.featureForm
      .get('department_name')
      .valueChanges.subscribe(department_name => {
        this.allDepartments$.subscribe(data => {
          this.department = data.find(
            dep => dep.department_name === department_name
          );
          this.fileUpload.validateFileUploadStatus(this.department);
          this.cdr.detectChanges();
        });
      });

    // Auto-focus the name input when creating a new feature
    if (this.data.mode === 'new') {
      setTimeout(() => {
        this.focusFormControl('feature_name');
      }, 300); // Delay to ensure input is rendered
    }
  }

  /**
   * Select user specified selections if any.
   */
  preSelectedOptions() {
    const {
      preselectDepartment,
      preselectApplication,
      preselectEnvironment,
      recordVideo,
    } = this.user.settings;

    this.departments$.find(d => {
      if (d.department_id == preselectDepartment)
        this.selected_department = d.department_name;
    });
    this.applications$.find(a => {
      if (a.app_id == preselectApplication)
        this.selected_application = a.app_name;
    });
    this.environments$.find(e => {
      if (e.environment_id == preselectEnvironment)
        this.selected_environment = e.environment_name;
    });
    this.featureForm.patchValue({
      video: recordVideo != undefined ? recordVideo : true,
      // ... add addition properties here.
    });
  }

  stepsOriginal: FeatureStep[] = [];
  browsersOriginal: BrowserstackBrowser[] = [];

  feature = new BehaviorSubject<Feature>(null);

  /**
   * Auto focus to the given form control
   * @param name Name of the control
   */
  focusFormControl(name: string) {
    try {
      // Get form control element
      const element = document.querySelector(
        `[formcontrolname="${name}"]`
      ) as HTMLElement;
      // Scroll element into user view
      element.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
      // Auto focus to it
      element.focus();
    } catch (err) {
      this.logger.msg('2', 'Failed to focus on control', 'UI');
    }
  }

  openEmailHelp() {
    this._dialog.open(EmailTemplateHelp, {
      autoFocus: false,
      panelClass: 'help-panel',
    });
  }

  openTelegramHelp() {
    this._dialog.open(TelegramNotificationHelp, {
      autoFocus: false,
      panelClass: 'help-panel',
    });
  }

  /**
   * Open are you sure dialog and wait for response
   */
  async openAreYouSureDialog(): Promise<boolean> {
    const dialogRef = this._dialog.open(AreYouSureDialog, {
      data: {
        title: `Save ${this.featureForm.get('feature_name').value}`,
        description:
          'Are you sure you want to save this feature? One or more steps contain errors.',
      } as AreYouSureData,
      autoFocus: true,
    });

    return dialogRef
      .afterClosed()
      .toPromise()
      .then(answer => {
        return Promise.resolve(answer);
      });
  }

  async handleCancel() {
    // Check if form has been modified before closing
    if (this.hasChanged()) {
      const dialogRef = this._dialog.open(AreYouSureDialog, {
        data: {
          title: 'translate:you_sure.quit_title',
          description: 'translate:you_sure.quit_desc',
        } as AreYouSureData,
        autoFocus: true,
      });

      const result = await dialogRef.afterClosed().toPromise();
      if (result) {
        this.dialogRef.close();
      }
    } else {
      this.dialogRef.close();
    }
  }

  /**
   * Creates a new feature or edits an existing one. It executes whenever the user clicks on the create / save button in the feature dialog
   * @returns
   */
  async editOrCreate() {
    // Reset search before proceeding
    
    // Trim whitespace from feature_name
    const featureNameControl = this.featureForm.get('feature_name');
    if (featureNameControl && featureNameControl.value) {
      featureNameControl.setValue(featureNameControl.value.trim());
    }

    // For new or clone modes, check for duplicate feature names
    if (this.data.mode === 'new' || this.data.mode === 'clone') {
      if (!this.featureForm.get('feature_name').valid) {
        setTimeout(() => {
          this.highlightInput = true;
          this.focusFormControl('feature_name');
          this._snackBar.open('Feature info is incomplete: missing name', 'OK');
        }, 0);
        return;
      }

      // Check for duplicate feature name
      const featureName = this.featureForm.get('feature_name').value;
      const shouldProceed = await this.checkForDuplicateFeatureName(featureName);
      if (!shouldProceed) {
        return; // User chose to rename the feature
      }
    }
    
    // Get current steps from Store
    let currentSteps = [];
    if (this.stepEditor) {
      // Check if StepEditor exists
      currentSteps = this.stepEditor.getSteps();
      if (this.stepEditor.stepsForm) {
        // Check steps validity
        if (!this.stepEditor.stepsForm.valid) {
          const result = await this.openAreYouSureDialog();
          if (!result) {
            // Focus on on first invalid step
            try {
              document
                .querySelector<HTMLTextAreaElement>('.invalid-step textarea')
                .focus();
            } catch (err) {
              this.logger.msg('2', 'Failed to focus on step input', 'UI');
            }
            return;
          }
          /**
           OLD LOGIC - Before 2021-12-30
          this._snackBar.open('One or more steps are invalid, fix them before saving.', 'OK', { duration: 5000 });
          // Focus on on first invalid step
          try {
            document.querySelector<HTMLTextAreaElement>('.invalid-step textarea').focus();
          } catch (err) { console.log('Failed to focus on step input') }
          return;
          */
        }
      }
    } else {
      // If StepEditor doesn't exist grab steps from Store
      // @ts-ignore
      if (!this.feature) this.feature = { feature_id: 0 };
      const featureId =
        this.data.mode === 'clone' ? 0 : this.data.feature.feature_id;
      currentSteps = this._store.selectSnapshot(
        CustomSelectors.GetFeatureSteps(featureId)
      );
    }
    const steps = {
      // Remove empty steps
      steps_content: currentSteps.filter(step => !!step.step_content),
      screenshots: [],
      compares: [],
    };
    // Create screenshots and compares arrays from current steps
    steps.steps_content
      .filter(step => step.enabled)
      .forEach((item, index) => {
        if (item.screenshot) steps.screenshots.push(index + 1);
        if (item.compare) steps.compares.push(index + 1);
      });
    const incompletePrefix = 'Feature info is incomplete';
    // Get current selectors information ids
    let departmentId, appId, environmentId;
    // Check Department ID
    try {
      departmentId = this.departments$.find(
        dep =>
          dep.department_name === this.featureForm.get('department_name').value
      ).department_id;
    } catch (err) {
      this.focusFormControl('department_name');
      this._snackBar.open(`${incompletePrefix}: missing department`);
      return;
    }
    // Check App ID
    try {
      appId = this.applications$.find(
        app => app.app_name === this.featureForm.get('app_name').value
      ).app_id;
    } catch (err) {
      this.focusFormControl('app_name');
      this._snackBar.open(`${incompletePrefix}: missing application`);
      return;
    }
    // Check Environment ID
    try {
      environmentId = this.environments$.find(
        env =>
          env.environment_name ===
          this.featureForm.get('environment_name').value
      ).environment_id;
    } catch (err) {
      this.focusFormControl('environment_name');
      this._snackBar.open(`${incompletePrefix}: missing environment`);
      return;
    }
    // Check Feature Name
    if (!this.featureForm.get('feature_name').valid) {
      setTimeout(() => {
        this.highlightInput = true;
        this.focusFormControl('feature_name');
        this._snackBar.open('Feature info is incomplete: missing name', 'OK');
      }, 0);
    } else {
      const fValues = this.featureForm.value;
      // Create FormData for sending XHR
      const dataToSend = {
        ...this.featureForm.value,
        steps: steps,
        environment_id: environmentId,
        app_id: appId,
        department_id: departmentId,
        browsers: this.browserstackBrowsers.getValue(),
      };
      
      // Ensure notification consistency: if send_notification is false, child options should also be false
      if (!dataToSend.send_notification) {
        dataToSend.send_mail = false;
        dataToSend.send_telegram_notification = false;
      }
      
      // Construct schedule for sending
      if (fValues.run_now) {
        const cronExpression = [
          fValues.minute,
          fValues.hour,
          fValues.day_month,
          fValues.month,
          fValues.day_week,
        ].join(' ');
        
        dataToSend.schedule = cronExpression;
        
        // Add timezone information for backend conversion
        if (this.timezone === 'browser-timezone') {
          dataToSend.original_timezone = this.userTimezone;
        } else {
          dataToSend.original_timezone = this.timezone;
        }
      } else {
        dataToSend.schedule = '';
        // Clear timezone info when schedule is disabled
        dataToSend.original_timezone = null;
      }

      // --------------------------------------------
      // Save XHR
      // ... now dataToSend has been prepared and we can send it to Backend
      // ... Different for save & clone and create
      // ... create dialog asks if you want to run it now
      // ... data.mode can be 'new', 'clone', 'edit'
      // -------------------------------------------------
      // Special code for when editing or clonning feature
      // -------------------------------------------------
      dataToSend.feature_id = this.data.feature.feature_id;
      dataToSend.cloud = this.feature.getValue().cloud;
      if (this._browserSelection) {
        dataToSend.cloud = this._browserSelection.testing_cloud.value;
      }
      if (this.data.mode === 'clone' || this.data.mode === 'new') {
        dataToSend.feature_id = 0;
      }
      this.saving$.next(true);
      this._api
        .patchFeature(dataToSend.feature_id, dataToSend, {
          loading: 'translate:tooltips.saving_feature',
        })
        .pipe(finalize(() => this.saving$.next(false)))
        .subscribe(res => {
          // res.info contains the feature data
          // res.success contains true or false

          // After sending the XHR we have received the result in "res"
          // Checking for success and not
          // .... show snackBar
          // .... move feature to folder, if necesarry
          // .... show dialog according to new or clone & save/edit
          if (res.success) {
            // If XHR was ok
            this._snackBar.open('Feature saved.', 'OK');
            this._store.dispatch(new Features.UpdateFeatureOffline(res.info));
            // Toggles the welcome to false, meaning that the user is no longer new in co.meta
            this.toggleWelcome();
            this.manageFeatureDialogData(res, dataToSend);
          } else {
            // If XHR was ok
            this._snackBar.open('An error occurred.', 'OK');
          }
        });
    }
  }

  /**
   * Decides what to do with the data after clicking submit on the feature edit dialog: clone, create or edit feature
   * @param res
   * @param dataToSend
   * @author dph000
   * @date 2021/10/25
   */
  manageFeatureDialogData(res, dataToSend) {
    // Move to current folder
    if (this.data.mode === 'clone' || this.data.mode === 'new') {
      this.moveFeatureToCurrentFolder(res.info.feature_id).subscribe();
      this._store.dispatch(new Features.GetFolders());
    }

    // dialog when saving or cloning
    if (this.data.mode === 'edit' || this.data.mode === 'clone') {
      // dialog for clone and save
      this.dialogRef.close(dataToSend);
    } else {
      // dialog when creating offering option to run report
      if (res.info.feature_id) {
        this._dialog.open(FeatureCreated, {
          minWidth: '500px',
          data: {
            feature_name: dataToSend.feature_name,
            feature_id: res.info.feature_id,
            app_name: dataToSend.app_name,
            environment_name: dataToSend.environment_name,
            department_name: dataToSend.department_name,
            description: dataToSend.description,
          },
        });
        this.dialogRef.close(dataToSend);
      }
    }
  }

  /**
   * Checks if the current user is inside a folder and moves
   * the just created/cloned feature inside it
   * @param {number} featureId Feature ID
   */
  moveFeatureToCurrentFolder(featureId: number): Observable<any> {
    // Get current folder route
    const currentRoute = this._store
      .selectSnapshot(FeaturesState.GetSelectionFolders)
      .filter(route => route.type != 'department');
    // Check if changing folder of created feature is necessary
    if (currentRoute.length > 0) {
      // Get current folder id
      const folderId = currentRoute[currentRoute.length - 1].folder_id;
      // Move feature in backend
      return this._api.moveFeatureFolder(null, folderId, featureId).pipe(
        switchMap(res => {
          if (res.success) {
            // Update folders in front
            return this._store.dispatch(new Features.GetFolders());
          }
          // Check errors
          if (!res.success && !res.handled) {
            this._snackBar.open(
              'An error ocurred while moving feature to folder.',
              'OK'
            );
          }
          return of({});
        })
      );
    } else {
      return of({});
    }
  }

  checkboxChange = ({ checked }: MatCheckboxChange, key: string) => {
    this.featureForm.get(key).setValue(checked);
    this.featureForm.get(key).markAsDirty();
  };

  /**
   * Toggle the co_first_time_cometa local storage variable, meaning that the user has already created a testcase
   * @returns new Configuration of co_first_time_cometa
   * @author dph000
   * @date 21/11/02
   * @lastModification 21/11/02
   */
  toggleWelcome() {
    return this._store.dispatch(
      new Configuration.SetProperty('co_first_time_cometa', 'false', true)
    );
  }

  // adds each selected file into formControl array
  onUploadFile(ev) {
    // This is now handled by the files-management component
    this.logger.msg('4', 'File upload handled by files-management component', 'Upload');
  }

  onDownloadFile(file: UploadedFile) {
    // Delegate to the new method
    this.onFileDownloaded(file);
  }

  base64ToArrayBuffer(data: string) {
    const byteArray = atob(data);
    const uint = new Uint8Array(byteArray.length);
    for (let i = 0; i < byteArray.length; i++) {
      let ascii = byteArray.charCodeAt(i);
      uint[i] = ascii;
    }
    return uint;
  }

  onDeleteFile(file: UploadedFile) {
    // Delegate to the new method
    this.onFileDeleted(file);
  }

  onRestoreFile(file: UploadedFile) {
    this.logger.msg('4', `Processing file restoration for ${file.name} (ID: ${file.id})`, 'Restore');
    
    let formData: FormData = new FormData();
    formData.append('restore', String(file.is_removed));

    this.fileUpload.restoreFile(file.id, formData).subscribe({
      next: (res) => {
        if (res.success) {
          this.fileUpload.updateFileState(file, this.department);
          
          // Show success message
          this._snackBar.open(`File "${file.name}" restored successfully`, 'OK', { 
            duration: 5000
          });
        } else {
          this._snackBar.open('Error restoring file', 'OK', { 
            duration: 5000
          });
        }
      },
      error: (error) => {
        this.logger.msg('2', `Error restoring file: ${file.name}`, 'Restore', error);
        this._snackBar.open('Error restoring file', 'OK', { 
          duration: 5000
        });
      }
    });
  }

  public onFilePathCopy(successful: boolean): void {
    const duration = 2000;
    successful
      ? this._snackBar.open('File upload path has been copied', 'OK', {
          duration: duration,
        })
      : this._snackBar.open('File upload path could not be copied', 'OK', {
          duration: duration,
        });
  }

  getFilteredVariables(variables: VariablePair[]) {
    const environmentId = this.environments$.find(
      env =>
        env.environment_name === this.featureForm.get('environment_name').value
    )?.environment_id;
    const departmentId = this.departments$.find(
      dep =>
        dep.department_name === this.featureForm.get('department_name').value
    )?.department_id;

    let feature = this.feature.getValue();
    let reduced = variables.reduce(
      (filtered_variables: VariablePair[], current: VariablePair) => {
        // stores variables, if it's id coincides with received department id and it is based on department
        const byDeptOnly =
          current.department === departmentId && current.based == 'department'
            ? current
            : null;

        // stores variable if department id coincides with received department id and
        // environment or feature ids coincide with received ones, additionally if feature id coincides variable must be based on feature. If environment id coincides, variables must be based on environment.
        const byEnv =
          current.department === departmentId &&
          ((current.environment === environmentId &&
            current.based == 'environment') ||
            (current.feature === feature.feature_id &&
              current.based == 'feature'))
            ? current
            : null;

        // pushes stored variables into array if they have value
        byDeptOnly ? filtered_variables.push(byDeptOnly) : null;
        byEnv ? filtered_variables.push(byEnv) : null;

        // removes duplicated variables and returs set like array
        return filtered_variables.filter(
          (value, index, self) =>
            index === self.findIndex(v => v.id === value.id)
        );
      },
      []
    );
    return reduced;
  }

  checkForCreateButton() {
    if (this.data.mode == 'new') {
      this.isExpanded = true;
    }
    else if (this.data.mode === 'edit' || this.data.mode === 'clone'){
      this.isExpanded = false;
    }
  }

  // Event handlers for files-management component
  onFilesUploaded(files: UploadedFile[]): void {
    // Create new file objects instead of modifying existing ones
    const processedFiles = files.map(file => {
      // Create a shallow copy of the file object
      const newFile = { ...file };
      
      // Add type if not already set
      if (!newFile.type && newFile.name) {
        const lastDotIndex = newFile.name.lastIndexOf('.');
        if (lastDotIndex > 0) {
          newFile.type = newFile.name.substring(lastDotIndex + 1).toUpperCase();
        } else {
          newFile.type = 'Unknown';
        }
      }
      
      return newFile;
    });
    
    // Update original files if needed
    if (this.department && this.department.files) {
      // Create a new department object with updated files
      this.department = {
        ...this.department,
        files: this.department.files.map(existingFile => {
          // Find if this file was processed in the new batch
          const updatedFile = processedFiles.find(f => f.id === existingFile.id);
          return updatedFile || existingFile;
        })
      };
    }
    
    this.cdr.markForCheck();
  }

  onFileDeleted(file: UploadedFile): void {
    // Handle auto-setting type field for files being deleted
    if (!file.type && file.name) {
      const lastDotIndex = file.name.lastIndexOf('.');
      if (lastDotIndex > 0) {
        file.type = file.name.substring(lastDotIndex + 1).toUpperCase();
      } else {
        file.type = 'Unknown';
      }
    }
    
    this.fileUpload.deleteFile(file.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.logger.msg('4', `File deleted successfully: ${file.name}`, 'Delete');
          this.fileUpload.updateFileState(file, this.department);
          
          // Show success message
          this._snackBar.open(`File "${file.name}" deleted successfully`, 'OK', { 
            duration: 5000
          });
        } else {
          this._snackBar.open('Error deleting file', 'OK', { 
            duration: 5000
          });
        }
      },
      error: (error) => {
        this.logger.msg('2', `Error deleting file: ${file.name}`, 'Delete', error);
        this._snackBar.open('Error deleting file', 'OK', { 
          duration: 5000
        });
      }
    });
  }

  onFileDownloaded(file: UploadedFile): void {
    this.logger.msg('4', `Processing file download for ${file.name} (ID: ${file.id})`, 'Download');
    
    // Check if file is ready
    if (file.status.toLowerCase() !== 'done') {
      this._snackBar.open('File is not ready for download', 'Close', {
        duration: 3000
      });
      return;
    }
    
    const downloading = this._snackBar.open(
      'Generating file to download, please be patient.',
      'OK',
      { duration: 10000 }
    );
    
    // Use fileUpload service to download the file
    this.fileUpload.downloadFile(file.id).subscribe({
      next: (res: any) => {
        downloading.dismiss();
        
        // Check if we have a response body
        if (!res.body) {
          this._snackBar.open('Download failed: Empty response', 'OK', {
            duration: 5000
          });
          return;
        }
        
        try {
          // Create a blob from the base64 response
          const blob = new Blob([this.base64ToArrayBuffer(res.body)], {
            type: file.mime || 'application/octet-stream'
          });
          
          // Use the fileUpload service to handle the download
          this.fileUpload.downloadFileBlob(blob, file);
        } catch (error) {
          this.logger.msg('2', `Error processing download response for ${file.name}`, 'Download', error);
          this._snackBar.open('Error processing download', 'Close', {
            duration: 5000
          });
        }
      },
      error: (error) => {
        downloading.dismiss();
        this.logger.msg('2', `Download error for ${file.name}`, 'Download', error);
        this._snackBar.open('Error downloading file', 'Close', {
          duration: 5000
        });
      }
    });
  }

  // Handle panel toggle events from files-management component
  onFilePanelToggled(isExpanded: boolean): void {
    // Update panel state if needed
    this.onExpansionChange(this.featureId, '4', isExpanded);
  }
  
  // Handle pagination events from files-management component
  onFilePaginationChanged(event: {event: PageEvent, file?: UploadedFile}): void {
    this.logger.msg('4', `File pagination changed: ${JSON.stringify(event.event)}`, 'Pagination');
    // No additional action needed
  }

  // Checking duplicate feature names
  async checkForDuplicateFeatureName(featureName: string): Promise<boolean> {
    // Refresh departments data from the server to ensure we have the latest settings
    await this.refreshDepartments();
    
    // Get the department ID from the form
    const departmentName = this.featureForm.get('department_name').value;
    if (!departmentName) {
      return true; // If no department is selected yet, allow the operation
    }

    // Find the department ID from the department name
    const departmentData = this.departments$.find(
      dep => dep.department_name === departmentName
    );
    
    if (!departmentData) {
      return true; // If department not found, allow the operation
    }

    const departmentId = departmentData.department_id;
    
    // Check if the department has validation for duplicate feature names disabled
    if (departmentData.settings && departmentData.settings.validate_duplicate_feature_names === false) {
      return true; // Skip validation if department has it disabled
    }
    
    // Get all features from the store state
    const allFeatures = this._store.selectSnapshot(FeaturesState.GetFeaturesAsArray);
    
    // Filter features to only include those from the same department
    const sameDepartmentFeatures = allFeatures.filter(
      feature => feature.department_id === departmentId
    );
    
    // Check if any feature in the same department has the same name
    const duplicateFeature = sameDepartmentFeatures.find(
      (feature) => feature.feature_name.toLowerCase() === featureName.toLowerCase()
    );
    
    // If a duplicate is found, open a confirmation dialog
    if (duplicateFeature) {
      const dialogRef = this._dialog.open(AreYouSureDialog, {
        data: {
          title: 'Duplicate Feature Name',
          description: `A feature named "${featureName}" already exists in the "${departmentName}" department. Do you want to continue with this name anyway?`,
        } as AreYouSureData,
        minWidth: '400px',
        autoFocus: true,
      });

      // Wait for user decision
      const result = await dialogRef.afterClosed().toPromise();
      if (!result) {
        // If user chooses to rename (clicks "No"), focus on the name field
        this.highlightInput = true;
        this.focusFormControl('feature_name');
        setTimeout(() => {
          this.highlightInput = false;
          this.cdr.detectChanges();
        }, 3000);
      }
      return result; // true if continue, false if rename
    }
    
    return true; // No duplicate found, proceed
  }

  /**
   * Refreshes the departments data from the server to ensure we have the latest settings
   */
  async refreshDepartments(): Promise<void> {
    try {
      // Dispatch the action to get the latest departments data
      await this._store.dispatch(new Departments.GetAdminDepartments()).toPromise();
      
      // Update local departments array with freshly loaded data directly from DepartmentsState
      this.departments$ = this._store.selectSnapshot(DepartmentsState);
      
    } catch (error) {
      console.error('Error refreshing departments:', error);
    }
  }

  async handleCreate() {
    if (!this.featureForm.get('feature_name').valid) {
      this.highlightInput = true;
      this.focusFormControl('feature_name');
      this._snackBar.open('Feature info is incomplete: missing name', 'OK', {
        duration: 5000
      });
      // Hide tooltip and highlight after 3 seconds
      setTimeout(() => {
        this.highlightInput = false;
        this.cdr.detectChanges();
      }, 3000);
      return;
    }
    this.editOrCreate();
  }

}
