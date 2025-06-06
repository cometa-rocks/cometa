import {
  Component,
  HostListener,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from '@services/api.service';
import { Select, Store } from '@ngxs/store';
import { ConfigState } from './store/config.state';
import { SocketService } from '@services/socket.service';
import { interval, Observable, Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { catchError, retry, switchMap } from 'rxjs/operators';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { CookiesExpiredDialog } from '@dialogs/cookies-expired/cookies-expired.component';
import { SelectSnapshot } from '@ngxs-labs/select-snapshot';
import { TourService } from '@services/tour.service';
import { WhatsNewService } from '@services/whats-new.service';
import { AsyncPipe } from '@angular/common';
import { FooterComponent } from './components/footer/footer.component';
import { ToursComponent } from './components/tours/tours.component';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { SharedActionsService } from './services/shared-actions.service';
import { ChatbotComponent } from './components/chatbot/chatbot.component';

@Component({
  selector: 'cometa',
  templateUrl: './cometa.component.html',
  styleUrls: ['./cometa.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    HeaderComponent,
    RouterOutlet,
    ToursComponent,
    FooterComponent,
    ChatbotComponent,
    AsyncPipe,
  ],
})
export class CometaComponent implements OnInit {
  @Select(ConfigState) config$: Observable<Config>;
  @SelectSnapshot(ConfigState) config: Config;

  @HostListener('document:keydown.control.F11')
  showState() {
    console.log(this._store.snapshot());
  }

  heartbeat: Subscription;

  // Initialize translator service
  constructor(
    private translate: TranslateService,
    public api: ApiService,
    private _socket: SocketService,
    private _store: Store,
    private _http: HttpClient,
    private _dialog: MatDialog,
    private _tourService: TourService,
    private _whatsNew: WhatsNewService,
    public _sharedActions: SharedActionsService
  ) {
    this._socket.Init();
    this.translate.setDefaultLang('en');
    let lang =
      localStorage.getItem('lang') ||
      navigator.language ||
      navigator['userLanguage'];
    // Check selected language exists in our possibilities
    const languagePossibilities = Object.keys(this.config.languageCodes);
    if (!languagePossibilities.includes(lang)) {
      lang = 'en';
    }
    const userLang = lang.length > 2 ? lang.substring(0, 2) : lang;
    this.translate.use(userLang);
    // Heartbeat
    this.heartbeat = interval(this.config.heartbeat)
      .pipe(
        switchMap(_ =>
          this._http
            .get(`https://${location.hostname}/callback?info=json`, {
              responseType: 'text',
            })
            .pipe(retry(3))
        ),
        catchError(err => {
          this._dialog.open(CookiesExpiredDialog);
          this.heartbeat.unsubscribe();
          return err;
        })
      )
      .subscribe();

    // Open What's New dialog automatically
    // All logic is handled in service
    this._whatsNew.collectAndOpen();
  }

  ngOnInit() {
    // Migration of localStorage keys (compatibility 6 months)
    this.migrateLocalStorage();
    // Start create feature tour
    this._tourService.startTour('CreateFeature');
    // Load config 
    this._sharedActions.loadConfig(); 
    // Log Easter Egg
    const styles = [
      'font-weight: bold',
      'color: #E5B355',
      'font-size:30px',
      'text-shadow: 2px 0 0 #000, -2px 0 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 1px 1px #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
    ];
    console.log('%c co.meta loves developers', styles.join(';'));
  }

  /**
   * Migration of localStorage keys (compatibility 6 months)
   */
  migrateLocalStorage() {
    const migrations = [
      { oldKey: 'live_steps_auto_scroll', newKey: 'co_live_steps_auto_scroll' },
      { oldKey: 'terminatingContainers', newKey: 'co_terminatingContainers' },
      { oldKey: 'Variable_Sort_State', newKey: 'co_Variable_Sort_State' },
      { oldKey: 'filters', newKey: 'co_filters' },
      { oldKey: 'search_sorting', newKey: 'co_search_sorting' },
      { oldKey: 'lang', newKey: 'co_lang' },
      { oldKey: 'da', newKey: 'co_da' },
      { oldKey: 'ViewMode', newKey: 'co_ViewMode' },
      { oldKey: 'configuration_Sort_State', newKey: 'co_configuration_Sort_State' },
      { oldKey: 'feedback_mail', newKey: 'co_feedback_mail' },
      { oldKey: 'notifications', newKey: 'co_notifications' },
      { oldKey: 'active_list', newKey: 'co_active_list' },
      { oldKey: 'features_pagination', newKey: 'co_features_pagination' },
      { oldKey: 'first_time_cometa', newKey: 'co_first_time_cometa' },
      { oldKey: 'logWebsockets', newKey: 'co_logWebsockets' },
      { oldKey: 'percentMode', newKey: 'co_percentMode' },
      { oldKey: 'hideInformation', newKey: 'co_hideInformation' },
      { oldKey: 'hideBrowsers', newKey: 'co_hideBrowsers' },
      { oldKey: 'hideUploadedFiles', newKey: 'co_hideUploadedFiles' },
      { oldKey: 'hideSteps', newKey: 'co_hideSteps' },
      { oldKey: 'hideSchedule', newKey: 'co_hideSchedule' },
      { oldKey: 'hideSendMail', newKey: 'co_hideSendMail' },
      { oldKey: 'useNewDashboard', newKey: 'co_useNewDashboard' },
      { oldKey: 'search_sorting_reverse', newKey: 'co_search_sorting_reverse' },
      { oldKey: 'hideInformationMobile', newKey: 'co_hideInformationMobile' },
      { oldKey: 'hideInstallAPKSMobile', newKey: 'co_hideInstallAPKSMobile' },
      { oldKey: 'hideInstalledAPKSMobile', newKey: 'co_hideInstalledAPKSMobile' },
      { oldKey: 'hideSharedMobile', newKey: 'co_hideSharedMobile' },
      { oldKey: 'dd_panel_executePanel', newKey: 'co_dd_panel_executePanel' },
      { oldKey: 'dd_panel_resultsPanel', newKey: 'co_dd_panel_resultsPanel' },
      { oldKey: 'dd_panel_filtersPanel', newKey: 'co_dd_panel_filtersPanel' }
    ];
    migrations.forEach(({ oldKey, newKey }) => {
      let value = localStorage.getItem(newKey);
      if (value) {
      } else {
        const oldValue = localStorage.getItem(oldKey);
        if (oldValue) {
          localStorage.setItem(newKey, oldValue);
        }
      }
    });
    // Migrate dynamic pagination keys
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('pagination.')) {
        const newKey = 'co_' + key;
        if (!localStorage.getItem(newKey)) {
          const value = localStorage.getItem(key);
          if (value !== null) {
            localStorage.setItem(newKey, value);
          }
        }
      }
    });
  }
}
