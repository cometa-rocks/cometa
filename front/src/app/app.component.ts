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

@Component({
  selector: 'cometa',
  templateUrl: './cometa.component.html',
  styleUrls: ['./cometa.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    private _whatsNew: WhatsNewService
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
    // Start create feature tour
    this._tourService.startTour('CreateFeature');
    // Log Easter Egg
    const styles = [
      'font-weight: bold',
      'color: #E5B355',
      'font-size:30px',
      'text-shadow: 2px 0 0 #000, -2px 0 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 1px 1px #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
    ];
    console.log('%c co.meta loves developers', styles.join(';'));
  }
}
