import {
  Component,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
  OnInit,
  Input,
  ViewChild,
} from '@angular/core';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { BrowserFavouritedPipe } from '@pipes/browser-favourited.pipe';
import { BrowserstackState } from '@store/browserstack.state';
import { UserState } from '@store/user.state';
import { PlatformSortPipe } from '@pipes/platform-sort.pipe';
import { map } from 'rxjs/operators';
import { BrowsersState } from '@store/browsers.state';
import { BehaviorSubject } from 'rxjs';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { classifyByProperty } from 'ngx-amvara-toolbox';
import { User } from '@store/actions/user.actions';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngxs/store';
import { LyridBrowsersState } from '@store/browserlyrid.state';
import { TranslateModule } from '@ngx-translate/core';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { AddLatestPipe } from '../../pipes/add-latest.pipe';
import { BrowserComboTextPipe } from '../../pipes/browser-combo-text.pipe';
import { VersionSortPipe } from '@pipes/version-sort.pipe';
import { FormatVersionPipe } from '@pipes/format-version.pipe';
import { TranslateNamePipe } from '@pipes/translate-name.pipe';
import { CheckBrowserExistsPipe } from '@pipes/check-browser-exists.pipe';
import { CheckSelectedBrowserPipe } from '@pipes/check-selected-browser.pipe';
import { BrowserIconPipe } from '@pipes/browser-icon.pipe';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { LetDirective } from '../../directives/ng-let.directive';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { ContextMenuModule } from '@perfectmemory/ngx-contextmenu';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyOptionModule } from '@angular/material/legacy-core';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import {
  NgIf,
  NgFor,
  NgClass,
  AsyncPipe,
  TitleCasePipe,
  KeyValuePipe,
} from '@angular/common';
import { MatSelect } from '@angular/material/select';

/**
 * BrowserSelectionComponent
 * @description Component used to select the browser/s used for testing
 * @author Alex Barba
 * @emits Array of BrowserstackBrowser, see interfaces.d.ts
 * @example <cometa-browser-selection origin="browserstack" (selectionChange)="handleChange($event)"></cometa-browser-selection>
 */
@UntilDestroy()
@Component({
  selector: 'cometa-browser-selection',
  templateUrl: './browser-selection.component.html',
  styleUrls: ['./browser-selection.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BrowserFavouritedPipe, PlatformSortPipe],
  standalone: true,
  imports: [
    NgIf,
    MatLegacyFormFieldModule,
    MatLegacySelectModule,
    ReactiveFormsModule,
    NgFor,
    MatLegacyOptionModule,
    MatLegacyInputModule,
    StopPropagationDirective,
    NgClass,
    MatLegacyTooltipModule,
    ContextMenuModule,
    MatLegacyCheckboxModule,
    MatLegacyButtonModule,
    MatIconModule,
    LetDirective,
    MatLegacyProgressSpinnerModule,
    AsyncPipe,
    TitleCasePipe,
    KeyValuePipe,
    PlatformSortPipe,
    BrowserIconPipe,
    CheckSelectedBrowserPipe,
    CheckBrowserExistsPipe,
    TranslateNamePipe,
    FormatVersionPipe,
    VersionSortPipe,
    BrowserFavouritedPipe,
    BrowserComboTextPipe,
    AddLatestPipe,
    SortByPipe,
    TranslateModule,
  ],
})
export class BrowserSelectionComponent implements OnInit {
  @Input() feature: Feature;

  @ViewSelectSnapshot(UserState.GetBrowserFavourites)
  favourites$: BrowserstackBrowser[];
  @ViewSelectSnapshot(BrowsersState.getBrowserJsons)
  localBrowsers$: BrowserstackBrowser[];
  @ViewSelectSnapshot(BrowserstackState) onlineBrowsers$: BrowserstackBrowser[];
  @ViewSelectSnapshot(LyridBrowsersState) lyridBrowsers$: BrowserstackBrowser[];

  @ViewSelectSnapshot(UserState.GetAvailableClouds) clouds$: Cloud[];

  getBrowserKey(key, version) {
    // Get unique key for platform selector values
    return `${key}%${version}`;
  }

  // MAX_CONCURRENCY = 100;
  MIN_CONCURRENCY = 1;
  DEFAULT_CONCURRENCY = 1;

  constructor(
    private _favouritePipe: BrowserFavouritedPipe,
    private _platformSort: PlatformSortPipe,
    private _store: Store
  ) {}

  testing_cloud = new UntypedFormControl('browserstack');
  browser = new UntypedFormControl();
  testing_timezone = new UntypedFormControl();

  // Used for the loading screen
  loaded = new BehaviorSubject<boolean>(false);

  // Whenever some device/s is selected selectionChange will emit the array of browsers
  @Output() selectionChange = new EventEmitter<BrowserstackBrowser[]>();

  // Whenever the testing cloud control changes will emit the value
  @Output() testingCloud = new EventEmitter<string>();

  // Used to hold categories on the left panel
  categories = new BehaviorSubject<any>({});

  // Used to hold browsers and versions on the right panel
  browsers = new BehaviorSubject<any>({});

  // Used to hold all browsers but only for internal purposes
  categoriesInternal;
  // Default timezone for browser container [Test execution environment]
  selectedTimeZone: string = 'Etc/UTC';
  rippleColor = 'rgba(0,0,0,0.05)';

  selectedCategory = new BehaviorSubject<string>('');
  selectedVersion = new BehaviorSubject<string>('');

  browsersSelected = new BehaviorSubject<BrowserstackBrowser[]>([]);

  ngOnInit() {

    try {
      this.browsersSelected.next(this.feature.browsers);
      // If feature has browser and contains selectedTimeZone the get the timezone value
      if (
        this.feature.browsers.length > 0 &&
        this.feature.browsers[0].selectedTimeZone != undefined
      ) {
        this.selectedTimeZone = this.feature.browsers[0].selectedTimeZone;
      }
    } catch (err) {
      this.browsersSelected.next([]);
    }
    // Handle platform selection from mobile selector
    this.browser.valueChanges
      .pipe(
        untilDestroyed(this),
        map(browser => ({
          os: browser.split('%')[0],
          version: browser.split('%')[1],
        }))
      )
      .subscribe(browser => this.processVersion(browser.os, browser.version));
    // Get latest value comming from @Input and BrowserstackState
    this.testing_cloud.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe(origin => {
        this.testingCloud.emit(origin);
        switch (origin) {
          // Origin: Browserstack
          case 'browserstack':
            this.rollupOS(this.onlineBrowsers$);
            break;
          // Origin: Local (Backend)
          case 'local':
            // Grab local browsers from backend instead of static ones from DataService
            this.rollupOS(this.localBrowsers$);
            break;
          case 'Lyrid.io':
            this.rollupOS(this.lyridBrowsers$);
            break;
          // Origin fallback: Local (Backend)
          default:
            // Grab local browsers from backend instead of static ones from DataService
            this.rollupOS(this.localBrowsers$);
        }
      });
    // When testing timezone value changes update all browsers configuration. Default testing timezone is 'Etc/UTC'
    this.testing_timezone.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe(timezone => {
        let timezoneValue =
          timezone == undefined || timezone == ''
            ? this.selectedTimeZone
            : timezone;
        this.selectedTimeZone = timezoneValue;
        const selectedBrowsers = this.browsersSelected.getValue();
        // Add timezone in the each browser. This is for old features
        selectedBrowsers.forEach(
          selectedBrowser => (selectedBrowser.selectedTimeZone = timezoneValue)
        );
        this.browsersSelected.next(selectedBrowsers);
        this.selectionChange.emit(this.browsersSelected.getValue());
      });

    // Check if feature has a cloud assigned, fallback is browserstack
    try {
      this.testing_cloud.setValue(this.feature.cloud || 'local');
    } catch (err) {
      this.testing_cloud.setValue('browserstack');
    }
  }

  showAll(browserKey: string) {
    // Show all versions for a given browser
    document
      .querySelector(`.versions.${browserKey}`)
      .classList.toggle('show_all');
  }

  toggleFavourite(browser: BrowserstackBrowser) {
    return this._favouritePipe.transform(browser, this.favourites$)
      ? this._store.dispatch(new User.RemoveBrowserFavourite(browser))
      : this._store.dispatch(new User.AddBrowserFavourite(browser));
  }

  deleteFavourite(fav: BrowserstackBrowser) {
    // Remove favorite
    return this._store.dispatch(new User.RemoveBrowserFavourite(fav));
  }

  clickOnCategory(key, ev: MouseEvent) {
    if (this.selectedCategory.getValue() === key) {
      this.selectedCategory.next('');
    } else {
      this.selectedCategory.next(key);
    }
  }

  // Classify for Operating Systems
  rollupOS(browsers: BrowserstackBrowser[]) {
    // Check if there's at least 1 browser to process
    if (browsers.length > 0) {
      // First we classify operating systems as category
      const categories = classifyByProperty(browsers, 'os');
      // Second we classify each operating system by OS version
      const categoryArray: any = {};
      // tslint:disable-next-line: forin
      for (const name in categories) {
        categories[name] = classifyByProperty(categories[name], 'os_version');
        // tslint:disable-next-line: forin
        categoryArray[name] = Object.keys(categories[name]);
      }
      this.categoriesInternal = categories;
      this.categories.next(categoryArray);
      const firstCategory = Object.keys(categories)[0];
      this.selectedCategory.next(firstCategory);
      const latestVersion = this._platformSort.transform(
        Object.keys(categories[firstCategory]),
        firstCategory
      )[0];
      this.selectedVersion.next(latestVersion);
      this.processVersion(firstCategory, latestVersion);
    } else {
      this.loaded.next(true);
      // Try to switch to local / browserstack
      // Check local and online
      if (this.localBrowsers$.length > 0) {
        this.testing_cloud.setValue('local');
      } else if (this.onlineBrowsers$.length > 0) {
        this.testing_cloud.setValue('browserstack');
      }
    }
  }

  // Classify by browser based on the select operating system and version
  processVersion(os: string, version: string, ev?: MouseEvent) {
    this.selectedVersion.next(version);
    let browsers = this.categoriesInternal[os][version];
    browsers = classifyByProperty(browsers, 'browser');
    this.browsers.next(browsers);
    this.loaded.next(true);
    this.browser.setValue(`${os}%${version}`, { emitEvent: false });
  }

  // Function to handle when the user checks or unchecks the browsers
  handleCheckbox(browser, checked: boolean) {
    if (checked) {
      const selectedBrowsers = this.browsersSelected.getValue();
      // Add timezone in the browser, When a new browser selected.
      browser.selectedTimeZone = this.selectedTimeZone;
      selectedBrowsers.push(browser);
      this.browsersSelected.next(selectedBrowsers);
    } else {
      const selectedBrowsers = this.browsersSelected.getValue();
      const index = selectedBrowsers.findIndex(
        br =>
          this.toJson(br, ['concurrency','selectedTimeZone']) ===
          this.toJson(browser, ['concurrency', 'selectedTimeZone'])
      );
      selectedBrowsers.splice(index, 1);
      this.browsersSelected.next(selectedBrowsers);
    }
    this.selectionChange.emit(this.browsersSelected.getValue());
  }
  

  handleConcurrencyChange(browser, element) {
    const selectedBrowsers = this.browsersSelected.getValue();
    const br = selectedBrowsers.find(
      br =>
        this.toJson(br, ['concurrency']) ===
        this.toJson(browser, ['concurrency'])
    );
    br.concurrency = parseInt(element.value);
  }

  getCurrentlySelectedBrowser(browser) {
    const selectedBrowsers = this.browsersSelected.getValue();
    const br = selectedBrowsers.find(
      br =>
        this.toJson(br, ['concurrency']) ===
        this.toJson(browser, ['concurrency'])
    );
    return br;
  }

  getSelectedCloud() {
    return this.clouds$.find(cloud => cloud.name === this.testing_cloud.value);
  }

  toJson(json_object, fields_to_ignore) {
    const obj = { ...json_object };

    for (let field of fields_to_ignore) {
      delete obj[field];
    }

    return JSON.stringify(obj);
  }

  // List of timezone supported by selenoid refer https://aerokube.com/selenoid/latest/#_per_session_time_zone_timezone
  // This list to come from DB
  listOfTimeZones = [
    'Africa/Abidjan',
    'Africa/Accra',
    'Africa/Addis_Ababa',
    'Africa/Algiers',
    'Africa/Asmara',
    'Africa/Asmera',
    'Africa/Bamako',
    'Africa/Bangui',
    'Africa/Banjul',
    'Africa/Bissau',
    'Africa/Blantyre',
    'Africa/Brazzaville',
    'Africa/Bujumbura',
    'Africa/Cairo',
    'Africa/Casablanca',
    'Africa/Ceuta',
    'Africa/Conakry',
    'Africa/Dakar',
    'Africa/Dar_es_Salaam',
    'Africa/Djibouti',
    'Africa/Douala',
    'Africa/El_Aaiun',
    'Africa/Freetown',
    'Africa/Gaborone',
    'Africa/Harare',
    'Africa/Johannesburg',
    'Africa/Juba',
    'Africa/Kampala',
    'Africa/Khartoum',
    'Africa/Kigali',
    'Africa/Kinshasa',
    'Africa/Lagos',
    'Africa/Libreville',
    'Africa/Lome',
    'Africa/Luanda',
    'Africa/Lubumbashi',
    'Africa/Lusaka',
    'Africa/Malabo',
    'Africa/Maputo',
    'Africa/Maseru',
    'Africa/Mbabane',
    'Africa/Mogadishu',
    'Africa/Monrovia',
    'Africa/Nairobi',
    'Africa/Ndjamena',
    'Africa/Niamey',
    'Africa/Nouakchott',
    'Africa/Ouagadougou',
    'Africa/Porto-Novo',
    'Africa/Sao_Tome',
    'Africa/Timbuktu',
    'Africa/Tripoli',
    'Africa/Tunis',
    'Africa/Windhoek',
    'America/Adak',
    'America/Anchorage',
    'America/Anguilla',
    'America/Antigua',
    'America/Araguaina',
    'America/Argentina/Buenos_Aires',
    'America/Argentina/Catamarca',
    'America/Argentina/ComodRivadavia',
    'America/Argentina/Cordoba',
    'America/Argentina/Jujuy',
    'America/Argentina/La_Rioja',
    'America/Argentina/Mendoza',
    'America/Argentina/Rio_Gallegos',
    'America/Argentina/Salta',
    'America/Argentina/San_Juan',
    'America/Argentina/San_Luis',
    'America/Argentina/Tucuman',
    'America/Argentina/Ushuaia',
    'America/Aruba',
    'America/Asuncion',
    'America/Atikokan',
    'America/Atka',
    'America/Bahia',
    'America/Bahia_Banderas',
    'America/Barbados',
    'America/Belem',
    'America/Belize',
    'America/Blanc-Sablon',
    'America/Boa_Vista',
    'America/Bogota',
    'America/Boise',
    'America/Buenos_Aires',
    'America/Cambridge_Bay',
    'America/Campo_Grande',
    'America/Cancun',
    'America/Caracas',
    'America/Catamarca',
    'America/Cayenne',
    'America/Cayman',
    'America/Chicago',
    'America/Chihuahua',
    'America/Ciudad_Juarez',
    'America/Coral_Harbour',
    'America/Cordoba',
    'America/Costa_Rica',
    'America/Creston',
    'America/Cuiaba',
    'America/Curacao',
    'America/Danmarkshavn',
    'America/Dawson',
    'America/Dawson_Creek',
    'America/Denver',
    'America/Detroit',
    'America/Dominica',
    'America/Edmonton',
    'America/Eirunepe',
    'America/El_Salvador',
    'America/Ensenada',
    'America/Fort_Nelson',
    'America/Fort_Wayne',
    'America/Fortaleza',
    'America/Glace_Bay',
    'America/Godthab',
    'America/Goose_Bay',
    'America/Grand_Turk',
    'America/Grenada',
    'America/Guadeloupe',
    'America/Guatemala',
    'America/Guayaquil',
    'America/Guyana',
    'America/Halifax',
    'America/Havana',
    'America/Hermosillo',
    'America/Indiana/Indianapolis',
    'America/Indiana/Knox',
    'America/Indiana/Marengo',
    'America/Indiana/Petersburg',
    'America/Indiana/Tell_City',
    'America/Indiana/Vevay',
    'America/Indiana/Vincennes',
    'America/Indiana/Winamac',
    'America/Indianapolis',
    'America/Inuvik',
    'America/Iqaluit',
    'America/Jamaica',
    'America/Jujuy',
    'America/Juneau',
    'America/Kentucky/Louisville',
    'America/Kentucky/Monticello',
    'America/Knox_IN',
    'America/Kralendijk',
    'America/La_Paz',
    'America/Lima',
    'America/Los_Angeles',
    'America/Louisville',
    'America/Lower_Princes',
    'America/Maceio',
    'America/Managua',
    'America/Manaus',
    'America/Marigot',
    'America/Martinique',
    'America/Matamoros',
    'America/Mazatlan',
    'America/Mendoza',
    'America/Menominee',
    'America/Merida',
    'America/Metlakatla',
    'America/Mexico_City',
    'America/Miquelon',
    'America/Moncton',
    'America/Monterrey',
    'America/Montevideo',
    'America/Montreal',
    'America/Montserrat',
    'America/Nassau',
    'America/New_York',
    'America/Nipigon',
    'America/Nome',
    'America/Noronha',
    'America/North_Dakota/Beulah',
    'America/North_Dakota/Center',
    'America/North_Dakota/New_Salem',
    'America/Nuuk',
    'America/Ojinaga',
    'America/Panama',
    'America/Pangnirtung',
    'America/Paramaribo',
    'America/Phoenix',
    'America/Port_of_Spain',
    'America/Port-au-Prince',
    'America/Porto_Acre',
    'America/Porto_Velho',
    'America/Puerto_Rico',
    'America/Punta_Arenas',
    'America/Rainy_River',
    'America/Rankin_Inlet',
    'America/Recife',
    'America/Regina',
    'America/Resolute',
    'America/Rio_Branco',
    'America/Rosario',
    'America/Santa_Isabel',
    'America/Santarem',
    'America/Santiago',
    'America/Santo_Domingo',
    'America/Sao_Paulo',
    'America/Scoresbysund',
    'America/Shiprock',
    'America/Sitka',
    'America/St_Barthelemy',
    'America/St_Johns',
    'America/St_Kitts',
    'America/St_Lucia',
    'America/St_Thomas',
    'America/St_Vincent',
    'America/Swift_Current',
    'America/Tegucigalpa',
    'America/Thule',
    'America/Thunder_Bay',
    'America/Tijuana',
    'America/Toronto',
    'America/Tortola',
    'America/Vancouver',
    'America/Virgin',
    'America/Whitehorse',
    'America/Winnipeg',
    'America/Yakutat',
    'America/Yellowknife',
    'Antarctica/Casey',
    'Antarctica/Davis',
    'Antarctica/DumontDUrville',
    'Antarctica/Macquarie',
    'Antarctica/Mawson',
    'Antarctica/McMurdo',
    'Antarctica/Palmer',
    'Antarctica/Rothera',
    'Antarctica/South_Pole',
    'Antarctica/Syowa',
    'Antarctica/Troll',
    'Antarctica/Vostok',
    'Arctic/Longyearbyen',
    'Asia/Aden',
    'Asia/Almaty',
    'Asia/Amman',
    'Asia/Anadyr',
    'Asia/Aqtau',
    'Asia/Aqtobe',
    'Asia/Ashgabat',
    'Asia/Ashkhabad',
    'Asia/Atyrau',
    'Asia/Baghdad',
    'Asia/Bahrain',
    'Asia/Baku',
    'Asia/Bangkok',
    'Asia/Barnaul',
    'Asia/Beirut',
    'Asia/Bishkek',
    'Asia/Brunei',
    'Asia/Calcutta',
    'Asia/Chita',
    'Asia/Choibalsan',
    'Asia/Chongqing',
    'Asia/Chungking',
    'Asia/Colombo',
    'Asia/Dacca',
    'Asia/Damascus',
    'Asia/Dhaka',
    'Asia/Dili',
    'Asia/Dubai',
    'Asia/Dushanbe',
    'Asia/Famagusta',
    'Asia/Gaza',
    'Asia/Harbin',
    'Asia/Hebron',
    'Asia/Ho_Chi_Minh',
    'Asia/Hong_Kong',
    'Asia/Hovd',
    'Asia/Irkutsk',
    'Asia/Istanbul',
    'Asia/Jakarta',
    'Asia/Jayapura',
    'Asia/Jerusalem',
    'Asia/Kabul',
    'Asia/Kamchatka',
    'Asia/Karachi',
    'Asia/Kashgar',
    'Asia/Kathmandu',
    'Asia/Katmandu',
    'Asia/Khandyga',
    'Asia/Kolkata',
    'Asia/Krasnoyarsk',
    'Asia/Kuala_Lumpur',
    'Asia/Kuching',
    'Asia/Kuwait',
    'Asia/Macao',
    'Asia/Macau',
    'Asia/Magadan',
    'Asia/Makassar',
    'Asia/Manila',
    'Asia/Muscat',
    'Asia/Nicosia',
    'Asia/Novokuznetsk',
    'Asia/Novosibirsk',
    'Asia/Omsk',
    'Asia/Oral',
    'Asia/Phnom_Penh',
    'Asia/Pontianak',
    'Asia/Pyongyang',
    'Asia/Qatar',
    'Asia/Qostanay',
    'Asia/Qyzylorda',
    'Asia/Rangoon',
    'Asia/Riyadh',
    'Asia/Saigon',
    'Asia/Sakhalin',
    'Asia/Samarkand',
    'Asia/Seoul',
    'Asia/Shanghai',
    'Asia/Singapore',
    'Asia/Srednekolymsk',
    'Asia/Taipei',
    'Asia/Tashkent',
    'Asia/Tbilisi',
    'Asia/Tehran',
    'Asia/Tel_Aviv',
    'Asia/Thimbu',
    'Asia/Thimphu',
    'Asia/Tokyo',
    'Asia/Tomsk',
    'Asia/Ujung_Pandang',
    'Asia/Ulaanbaatar',
    'Asia/Ulan_Bator',
    'Asia/Urumqi',
    'Asia/Ust-Nera',
    'Asia/Vientiane',
    'Asia/Vladivostok',
    'Asia/Yakutsk',
    'Asia/Yangon',
    'Asia/Yekaterinburg',
    'Asia/Yerevan',
    'Atlantic/Azores',
    'Atlantic/Bermuda',
    'Atlantic/Canary',
    'Atlantic/Cape_Verde',
    'Atlantic/Faeroe',
    'Atlantic/Faroe',
    'Atlantic/Jan_Mayen',
    'Atlantic/Madeira',
    'Atlantic/Reykjavik',
    'Atlantic/South_Georgia',
    'Atlantic/St_Helena',
    'Atlantic/Stanley',
    'Australia/ACT',
    'Australia/Adelaide',
    'Australia/Brisbane',
    'Australia/Broken_Hill',
    'Australia/Canberra',
    'Australia/Currie',
    'Australia/Darwin',
    'Australia/Eucla',
    'Australia/Hobart',
    'Australia/LHI',
    'Australia/Lindeman',
    'Australia/Lord_Howe',
    'Australia/Melbourne',
    'Australia/North',
    'Australia/NSW',
    'Australia/Perth',
    'Australia/Queensland',
    'Australia/South',
    'Australia/Sydney',
    'Australia/Tasmania',
    'Australia/Victoria',
    'Australia/West',
    'Australia/Yancowinna',
    'Brazil/Acre',
    'Brazil/DeNoronha',
    'Brazil/East',
    'Brazil/West',
    'Canada/Atlantic',
    'Canada/Central',
    'Canada/Eastern',
    'Canada/Mountain',
    'Canada/Newfoundland',
    'Canada/Pacific',
    'Canada/Saskatchewan',
    'Canada/Yukon',
    'CET',
    'Chile/Continental',
    'Chile/EasterIsland',
    'CST6CDT',
    'Cuba',
    'EET',
    'Egypt',
    'Eire',
    'EST',
    'EST5EDT',
    'Etc/GMT',
    'Etc/GMT+0',
    'Etc/GMT+1',
    'Etc/GMT+10',
    'Etc/GMT+11',
    'Etc/GMT+12',
    'Etc/GMT+2',
    'Etc/GMT+3',
    'Etc/GMT+4',
    'Etc/GMT+5',
    'Etc/GMT+6',
    'Etc/GMT+7',
    'Etc/GMT+8',
    'Etc/GMT+9',
    'Etc/GMT0',
    'Etc/GMT-0',
    'Etc/GMT-1',
    'Etc/GMT-10',
    'Etc/GMT-11',
    'Etc/GMT-12',
    'Etc/GMT-13',
    'Etc/GMT-14',
    'Etc/GMT-2',
    'Etc/GMT-3',
    'Etc/GMT-4',
    'Etc/GMT-5',
    'Etc/GMT-6',
    'Etc/GMT-7',
    'Etc/GMT-8',
    'Etc/GMT-9',
    'Etc/Greenwich',
    'Etc/UCT',
    'Etc/Universal',
    'Etc/UTC',
    'Etc/Zulu',
    'Europe/Amsterdam',
    'Europe/Andorra',
    'Europe/Astrakhan',
    'Europe/Athens',
    'Europe/Belfast',
    'Europe/Belgrade',
    'Europe/Berlin',
    'Europe/Bratislava',
    'Europe/Brussels',
    'Europe/Bucharest',
    'Europe/Budapest',
    'Europe/Busingen',
    'Europe/Chisinau',
    'Europe/Copenhagen',
    'Europe/Dublin',
    'Europe/Gibraltar',
    'Europe/Guernsey',
    'Europe/Helsinki',
    'Europe/Isle_of_Man',
    'Europe/Istanbul',
    'Europe/Jersey',
    'Europe/Kaliningrad',
    'Europe/Kiev',
    'Europe/Kirov',
    'Europe/Kyiv',
    'Europe/Lisbon',
    'Europe/Ljubljana',
    'Europe/London',
    'Europe/Luxembourg',
    'Europe/Madrid',
    'Europe/Malta',
    'Europe/Mariehamn',
    'Europe/Minsk',
    'Europe/Monaco',
    'Europe/Moscow',
    'Europe/Nicosia',
    'Europe/Oslo',
    'Europe/Paris',
    'Europe/Podgorica',
    'Europe/Prague',
    'Europe/Riga',
    'Europe/Rome',
    'Europe/Samara',
    'Europe/San_Marino',
    'Europe/Sarajevo',
    'Europe/Saratov',
    'Europe/Simferopol',
    'Europe/Skopje',
    'Europe/Sofia',
    'Europe/Stockholm',
    'Europe/Tallinn',
    'Europe/Tirane',
    'Europe/Tiraspol',
    'Europe/Ulyanovsk',
    'Europe/Uzhgorod',
    'Europe/Vaduz',
    'Europe/Vatican',
    'Europe/Vienna',
    'Europe/Vilnius',
    'Europe/Volgograd',
    'Europe/Warsaw',
    'Europe/Zagreb',
    'Europe/Zaporozhye',
    'Europe/Zurich',
    'Factory',
    'GB',
    'GB-Eire',
    'GMT',
    'GMT+0',
    'GMT0',
    'GMT-0',
    'Greenwich',
    'Hongkong',
    'HST',
    'Iceland',
    'Indian/Antananarivo',
    'Indian/Chagos',
    'Indian/Christmas',
    'Indian/Cocos',
    'Indian/Comoro',
    'Indian/Kerguelen',
    'Indian/Mahe',
    'Indian/Maldives',
    'Indian/Mauritius',
    'Indian/Mayotte',
    'Indian/Reunion',
    'Iran',
    'Israel',
    'Jamaica',
    'Japan',
    'Kwajalein',
    'Libya',
    'MET',
    'Mexico/BajaNorte',
    'Mexico/BajaSur',
    'Mexico/General',
    'MST',
    'MST7MDT',
    'Navajo',
    'NZ',
    'NZ-CHAT',
    'Pacific/Apia',
    'Pacific/Auckland',
    'Pacific/Bougainville',
    'Pacific/Chatham',
    'Pacific/Chuuk',
    'Pacific/Easter',
    'Pacific/Efate',
    'Pacific/Enderbury',
    'Pacific/Fakaofo',
    'Pacific/Fiji',
    'Pacific/Funafuti',
    'Pacific/Galapagos',
    'Pacific/Gambier',
    'Pacific/Guadalcanal',
    'Pacific/Guam',
    'Pacific/Honolulu',
    'Pacific/Johnston',
    'Pacific/Kanton',
    'Pacific/Kiritimati',
    'Pacific/Kosrae',
    'Pacific/Kwajalein',
    'Pacific/Majuro',
    'Pacific/Marquesas',
    'Pacific/Midway',
    'Pacific/Nauru',
    'Pacific/Niue',
    'Pacific/Norfolk',
    'Pacific/Noumea',
    'Pacific/Pago_Pago',
    'Pacific/Palau',
    'Pacific/Pitcairn',
    'Pacific/Pohnpei',
    'Pacific/Ponape',
    'Pacific/Port_Moresby',
    'Pacific/Rarotonga',
    'Pacific/Saipan',
    'Pacific/Samoa',
    'Pacific/Tahiti',
    'Pacific/Tarawa',
    'Pacific/Tongatapu',
    'Pacific/Truk',
    'Pacific/Wake',
    'Pacific/Wallis',
    'Pacific/Yap',
    'Poland',
    'Portugal',
    'PRC',
    'PST8PDT',
    'ROC',
    'ROK',
    'Singapore',
    'Turkey',
    'UCT',
    'Universal',
    'US/Alaska',
    'US/Aleutian',
    'US/Arizona',
    'US/Central',
    'US/Eastern',
    'US/East-Indiana',
    'US/Hawaii',
    'US/Indiana-Starke',
    'US/Michigan',
    'US/Mountain',
    'US/Pacific',
    'US/Samoa',
    'UTC',
    'WET',
    'W-SU',
    'Zulu',
  ];
}
