import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { UserState } from '@store/user.state';
import { ConfigState } from '@store/config.state';
import { MatLegacyCheckboxChange as MatCheckboxChange } from '@angular/material/legacy-checkbox';
import { Tour, TourExtended, Tours } from '@services/tours';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { Observable } from 'rxjs';
import { Select, Store } from '@ngxs/store';
import { map } from 'rxjs/operators';
import { TourService } from '@services/tour.service';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { InviteUserDialog } from '@dialogs/invite-user/invite-user.component';
import { SharedActionsService } from '@services/shared-actions.service';
import { IntegrationsState } from '@store/integrations.state';
import { ApiService } from '@services/api.service';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
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
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatLegacyOptionModule } from '@angular/material/legacy-core';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { MatLegacyRadioModule } from '@angular/material/legacy-radio';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacySlideToggleModule } from '@angular/material/legacy-slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { NgIf, NgFor, NgClass, AsyncPipe, UpperCasePipe, TitleCasePipe, KeyValuePipe } from '@angular/common';
import { LetDirective } from '../../directives/ng-let.directive';

@Component({
    selector: 'account-settings',
    templateUrl: './user.component.html',
    styleUrls: ['./user.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [LetDirective, NgIf, MatLegacyButtonModule, NgFor, MatIconModule, MatLegacySlideToggleModule, MatLegacyFormFieldModule, MatLegacyInputModule, MatLegacyRadioModule, MatLegacySelectModule, MatLegacyOptionModule, MatLegacyTooltipModule, NgClass, TranslateModule, FilterByPropertyPipe, AmParsePipe, AmDateFormatPipe, SortByPipe, SendOnPipe, AsyncPipe, UpperCasePipe, TitleCasePipe, KeyValuePipe]
})
export class UserComponent implements OnInit {

  @Select(UserState) account$: Observable<UserInfo>;
  @Select(ApplicationsState) applications$: Observable<Application>
  @Select(EnvironmentsState) environments$: Observable<Environment>
  @ViewSelectSnapshot(ConfigState) config: Config;
  @Select(UserState.RetrieveSettings) settings$: Observable<UserInfo['settings']>;
  @Select(UserState.IsDefaultDepartment) isDefaultDepartment$: Observable<boolean>;

  @ViewSelectSnapshot(IntegrationsState.ByDepartment) integrationsDept: IntegrationByDepartment;
  @ViewSelectSnapshot(ConfigState) config$ !: Config;

  tours$: Observable<TourExtended[]>

  details$: Observable<UserDetails>;
  invoices$: Observable<UsageInvoice[]>;

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
  ) {
    this.tours$ = this.settings$.pipe(
      map(settings => {
        return Object.entries(this._tours)
          // Remove injected services
          .filter(entry => !entry[0].startsWith('_'))
          // Map to value
          .map(entry => entry[1])
          // Add custom properties
          .map((tour: Tour) => {
            let completed
            try {
              completed = settings.tours_completed[tour.id] >= tour.version
            } catch (err) {
              completed = false
            }
            return {
              ...tour,
              completed: completed
            }
          })
      })
    )
  }

  goInvoice(invoiceId: number) {
    this._api.getInvoiceUrl(invoiceId).subscribe(res => {
      if (res.success && res.url) window.open(res.url);
    })
  }

  ngOnInit() {
    this.details$ = this._api.getUserDetails();
    this.invoices$ = this._api.getInvoices();
  }

  removeIntegration(id: number) {
    this._sharedActions.loadingObservable(
      this._api.deleteIntegration(id),
      'Deleting integration'
    ).subscribe({
      next: () => this._store.dispatch(new Integrations.RemoveOne(id)),
      error: () => this._snack.open('An error ocurred', 'OK')
    })
  }

  goCustomerPortal() {
    this._api.generateCustomerPortal().subscribe(response => {
      if (response.success) {
        location.href = response.url;
      }
    })
  }

  setLang(code: string) {
    localStorage.setItem('lang', code);
    this._translate.use(code);
    this._snack.open('Language changed successfully!', 'OK');
    return this._store.dispatch(new Configuration.SetProperty('language', code));
  }

  reloadLang() {
    this._translate.reloadLang(this.config$.language);
    this._snack.open('Language reloaded successfully!', 'OK');
  }

  toggleLogWebsockets(event: MatCheckboxChange) {
    // save log websockets value in user setting and send it to backend to make it persistent
    return this._store.dispatch([
      new User.SetSetting({ logWebsockets: event.checked }),
      new Configuration.SetProperty('logWebsockets', event.checked, true)
    ]);
  }

  inviteUser() {
    this._dialog.open(InviteUserDialog);
  }

  startTour(tour: Tour) {
    this._tourService.startTourById(tour.id, true)
  }

  handleDisableAnimations(event: MatCheckboxChange) {
    localStorage.setItem('da', event.checked ? 'yes' : 'no');

    // save disable animation value in user setting and send it to backend to make it persistent
    return this._store.dispatch([
      new User.SetSetting({ disableAnimations: event.checked }),
      new Configuration.SetProperty('disableAnimations', event.checked)
    ]);
  }

  handlePercentMode(event: MatCheckboxChange) {
    // save percent mode in user setting and send it to backend to make it persistent
    return this._store.dispatch([
      new User.SetSetting({ percentMode: event.checked }),
      new Configuration.ChangePercentMode()
    ]);
  }

  handleToggle(event: MatCheckboxChange, prop) {
    // creates js object in format ex: {hidesteps: true} {hidesteps: false}
    let toggleSetting = {};
    toggleSetting[prop] = event.checked;

    // save toggle settings in user settings and send it to backend to make it persistent
    return this._store.dispatch([
      new User.SetSetting(toggleSetting),
      new Configuration.ToggleCollapsible(prop, event.checked)
    ]);
  }

  preselectSave(prop: string, value: string) {
    let preselectSettings = {}
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
      new Configuration.SetProperty('useNewDashboard', event.checked, true)
    ])
  }

  handleAccountSetting(ev: any, prop) {
    // Handle any change in any option
    if (ev.hasOwnProperty('checked')) {
      // Add exception if for Budgets
      if (prop === 'enable_budget' && ev.checked) {
        return this._store.dispatch(new User.SetSetting({
          budget: this._store.selectSnapshot(UserState.RetrieveSettings).budget || 0,
          enable_budget: ev.checked,
          budget_schedule_behavior: this._store.selectSnapshot(UserState.RetrieveSettings).budget_schedule_behavior || 'prevent'
        }))
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
