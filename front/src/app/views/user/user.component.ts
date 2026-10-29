import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { UserState } from '@store/user.state';
import { ConfigState } from '@store/config.state';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { Tour, TourExtended, Tours } from '@services/tours';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { Observable } from 'rxjs';
import { Select, Store } from '@ngxs/store';
import { map } from 'rxjs/operators';
import { TourService } from '@services/tour.service';
import { MatDialog } from '@angular/material/dialog';
import { InviteUserDialog } from '@dialogs/invite-user/invite-user.component';
import { SharedActionsService } from '@services/shared-actions.service';
import { IntegrationsState } from '@store/integrations.state';
import { ApiService } from '@services/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Integrations } from '@store/actions/integrations.actions';
import { Configuration } from '@store/actions/config.actions';
import { User } from '@store/actions/user.actions';
import { Router } from '@angular/router';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { ApplicationsState } from '@store/applications.state';
import { EnvironmentsState } from '@store/environments.state';
import { SendOnPipe } from '../../pipes/send-on.pipe';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { FilterByPropertyPipe } from '@pipes/filter-by-property.pipe';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import {
  NgIf,
  NgFor,
  NgClass,
  AsyncPipe,
  UpperCasePipe,
  TitleCasePipe,
  KeyValuePipe,
} from '@angular/common';
import { LetDirective } from '../../directives/ng-let.directive';
import { InputFocusService } from '../../services/inputFocus.service';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'account-settings',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    LetDirective,
    NgIf,
    NgFor,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    MatOptionModule,
    MatTooltipModule,
    NgClass,
    TranslateModule,
    FilterByPropertyPipe,
    AmParsePipe,
    AmDateFormatPipe,
    SortByPipe,
    SendOnPipe,
    AsyncPipe,
    UpperCasePipe,
    TitleCasePipe,
    KeyValuePipe,
    MatSlideToggleModule,
    MatButtonToggleModule,
    MatButtonModule
  ],
})
export class UserComponent implements OnInit {
  @Select(UserState) account$: Observable<UserInfo>;
  @Select(ApplicationsState) applications$: Observable<Application>;
  @Select(EnvironmentsState) environments$: Observable<Environment>;
  @ViewSelectSnapshot(ConfigState) config: Config;
  @Select(UserState.RetrieveSettings) settings$: Observable<
    UserInfo['settings']
  >;
  @Select(UserState.IsDefaultDepartment)
  isDefaultDepartment$: Observable<boolean>;

  @ViewSelectSnapshot(IntegrationsState.ByDepartment)
  integrationsDept: IntegrationByDepartment;
  @ViewSelectSnapshot(ConfigState) config$!: Config;

  tours$: Observable<TourExtended[]>;

  details$: Observable<UserDetails>;
  invoices$: Observable<UsageInvoice[]>;

  inputFocus: boolean = false;

  private inputFocusSubscription: Subscription;

  constructor(
    private _tours: Tours,
    private _tourService: TourService,
    private _dialog: MatDialog,
    public _sharedActions: SharedActionsService,
    private _api: ApiService,
    private _snack: MatSnackBar,
    private _store: Store,
    private _router: Router,
    private _translate: TranslateService,
    private inputFocusService: InputFocusService,
  ) {

    this.inputFocusService.inputFocus$.subscribe(isFocused => {
      this.inputFocus = isFocused;
    });

    this.tours$ = this.settings$.pipe(
      map(settings => {
        return (
          Object.entries(this._tours)
            // Remove injected services
            .filter(entry => !entry[0].startsWith('_'))
            // Map to value
            .map(entry => entry[1])
            // Add custom properties
            .map((tour: Tour) => {
              let completed;
              try {
                completed = settings.tours_completed[tour.id] >= tour.version;
              } catch (err) {
                completed = false;
              }
              return {
                ...tour,
                completed: completed,
              };
            })
        );
      })
    );
  }

  goInvoice(invoiceId: number) {
    this._api.getInvoiceUrl(invoiceId).subscribe(res => {
      if (res.success && res.url) window.open(res.url);
    });
  }

  ngOnInit() {

    // this.inputFocusSubscription = this.inputFocusService.inputFocus$.subscribe(isFocused => {
    //   this.inputFocus = isFocused;
    // });

    // Synchronize localStorage panel states with user settings
    this.syncLocalStorageWithUserSettings();

    this.details$ = this._api.getUserDetails();
    this.invoices$ = this._api.getInvoices();
  }

  removeIntegration(id: number) {
    this._sharedActions
      .loadingObservable(
        this._api.deleteIntegration(id),
        'Deleting integration'
      )
      .subscribe({
        next: () => this._store.dispatch(new Integrations.RemoveOne(id)),
        error: () => this._snack.open('An error ocurred', 'OK'),
      });
  }

  goCustomerPortal() {
    this._api.generateCustomerPortal().subscribe(response => {
      if (response.success) {
        location.href = response.url;
      }
    });
  }

  setLang(code: string) {
    localStorage.setItem('lang', code);
    this._translate.use(code);
    this._snack.open('Language changed successfully!', 'OK');
    return this._store.dispatch(
      new Configuration.SetProperty('language', code)
    );
  }

  reloadLang() {
    this._translate.reloadLang(this.config$.language);
    this._snack.open('Language reloaded successfully!', 'OK');
  }

  toggleLogWebsockets(event: MatCheckboxChange) {
    // save log websockets value in user setting and send it to backend to make it persistent
    return this._store.dispatch([
      new User.SetSetting({ logWebsockets: event.checked }),
      new Configuration.SetProperty('logWebsockets', event.checked, true),
    ]);
  }

  inviteUser() {
    this._dialog.open(InviteUserDialog);
  }

  startTour(tour: Tour) {
    this._tourService.startTourById(tour.id, true);
  }

  handleDisableAnimations(event: MatCheckboxChange) {
    localStorage.setItem('da', event.checked ? 'yes' : 'no');

    // save disable animation value in user setting and send it to backend to make it persistent
    return this._store.dispatch([
      new User.SetSetting({ disableAnimations: event.checked }),
      new Configuration.SetProperty('disableAnimations', event.checked),
    ]);
  }

  handlePercentMode(event: MatCheckboxChange) {
    // save percent mode in user setting and send it to backend to make it persistent
    return this._store.dispatch([
      new User.SetSetting({ percentMode: event.checked }),
      new Configuration.ChangePercentMode(),
    ]);
  }

  handleToggle(event: MatCheckboxChange, prop) {
    // creates js object in format ex: {hidesteps: true} {hidesteps: false}
    let toggleSetting = {};
    toggleSetting[prop] = event.checked;

    // Map user setting keys to panel IDs for localStorage sync
    const panelIdMap = {
      'hideInformation': '1',
      'hideSendMail': '2', 
      'hideTelegramConfig': '3',
      'hideUploadedFiles': '4',
      'hideBrowsers': '5',
      'hideSteps': '6',
      'hideSchedule': '7'
    };

    // Update localStorage panel states to sync with features
    const panelId = panelIdMap[prop];
    if (panelId) {
      // Get existing panel states
      let panelStates = {};
      const savedStates = localStorage.getItem('co_mat_expansion_states');
      
      if (savedStates) {
        try {
          panelStates = JSON.parse(savedStates);
          if (typeof panelStates !== 'object' || panelStates === null) {
            panelStates = {};
          }
        } catch (e) {
          panelStates = {};
        }
      }

      // Update panel state based on toggle
      // If toggle is checked (hide=true), panel should be closed (expanded=false)
      // If toggle is unchecked (hide=false), panel should be open (expanded=true)
      panelStates[panelId] = !event.checked;
      
      // Save back to localStorage
      localStorage.setItem('co_mat_expansion_states', JSON.stringify(panelStates));
      
    }

    // save toggle settings in user settings and send it to backend to make it persistent
    // This will affect all features since they now prioritize user.settings over config$.toggles
    return this._store.dispatch([
      new User.SetSetting(toggleSetting),
      new Configuration.ToggleCollapsible(prop, event.checked),
    ]);
  }

  /**
   * Synchronize localStorage panel states with user settings on component load
   * This ensures that if localStorage has panel states, they are reflected in user settings
   */
  syncLocalStorageWithUserSettings() {
    const savedStates = localStorage.getItem('co_mat_expansion_states');
    if (!savedStates) return;

    const panelStates = JSON.parse(savedStates);
    if (typeof panelStates !== 'object' || panelStates === null) return;

    // Map panel IDs to user setting keys
    const panelToSettingMap = {
      '1': 'hideInformation',
      '2': 'hideSendMail',
      '3': 'hideTelegramConfig',
      '4': 'hideUploadedFiles',
      '5': 'hideBrowsers',
      '6': 'hideSteps',
      '7': 'hideSchedule'
    };

    // Get current user settings
    const currentSettings = this._store.selectSnapshot(UserState.RetrieveSettings);
    let settingsToUpdate = {};

    // Check each panel state and update user settings if needed
    Object.keys(panelToSettingMap).forEach(panelId => {
      const settingKey = panelToSettingMap[panelId];
      const panelExpanded = panelStates[panelId];
      
      // If panel is expanded (true), setting should be false (not hidden)
      // If panel is collapsed (false), setting should be true (hidden)
      const shouldHide = !panelExpanded;
      
      // Only update if the setting is different from what it should be
      if (currentSettings[settingKey] !== shouldHide) {
        settingsToUpdate[settingKey] = shouldHide;
      }
    });

    // Update user settings if there are changes
    if (Object.keys(settingsToUpdate).length > 0) {
      this._store.dispatch(new User.SetSetting(settingsToUpdate));
    }
  }

  preselectSave(prop: string, value: string) {
    let preselectSettings = {};
    preselectSettings[prop] = value;

    return this._store.dispatch(new User.SetSetting(preselectSettings));
  }

  // Sets the new landing as default dashboard
  toggleNewDashboard(event: MatCheckboxChange) {
    let routerConfig = this._router.config;
    // Toggles all the home redirects to /new or /search
    routerConfig[0].redirectTo = event.checked ? 'new' : 'search';

    // save useNewDashboard value in user setting and send it to backend to make it persistent
    return this._store.dispatch([
      new User.SetSetting({ useNewDashboard: event.checked }),
      new Configuration.SetProperty('useNewDashboard', event.checked, true),
    ]);
  }

  handleAccountSetting(ev: any, prop) {
    // Handle any change in any option
    if (ev.hasOwnProperty('checked')) {
      // Add exception if for Budgets
      if (prop === 'enable_budget' && ev.checked) {
        return this._store.dispatch(
          new User.SetSetting({
            budget:
              this._store.selectSnapshot(UserState.RetrieveSettings).budget ||
              0,
            enable_budget: ev.checked,
            budget_schedule_behavior:
              this._store.selectSnapshot(UserState.RetrieveSettings)
                .budget_schedule_behavior || 'prevent',
          })
        );
      }
      // Handle as checkbox
      return this._store.dispatch(new User.SetSetting({ [prop]: ev.checked }));
    } else if (ev.hasOwnProperty('value')) {
      // Handle as radio
      return this._store.dispatch(new User.SetSetting({ [prop]: ev.value }));
    } else {
      // Handle as input
      let value: any = ev.target.value;
      value = isNaN(value) ? value : parseFloat(value);
      return this._store.dispatch(new User.SetSetting({ [prop]: value }));
    }
  }
}
