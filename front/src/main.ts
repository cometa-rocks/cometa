import {
  enableProdMode,
  APP_INITIALIZER,
  importProvidersFrom,
} from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import {
  configLoader,
  getApiBase,
  getSocketUrl,
  getWebpSupport,
  getStripeApiKey,
  customTooltipDefaults,
  createTranslateLoader,
} from './app/app.module';
import { environment } from './environments/environment';
import { bootstrapApplication } from '@angular/platform-browser';
import { CometaComponent } from './app/app.component';
import { environment as environment_1 } from '@environments/environment';
import { NgxNetworkErrorModule } from 'ngx-network-error';
import { JoyrideModule } from './app/plugins/ngx-joyride/joyride.module';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { ContextMenuModule } from '@perfectmemory/ngx-contextmenu';
import { NgxsSelectSnapshotModule } from '@ngxs-labs/select-snapshot';
import { SearchState } from '@store/search.state';
import { IntegrationsState } from '@store/integrations.state';
import { LoadingsState } from '@store/loadings.state';
import { PaginatedListsState } from '@store/paginated-list.state';
import { PaginationsState } from '@store/paginations.state';
import { LogsState } from '@store/logs.state';
import { FeatureResultsState } from '@store/feature_results.state';
import { StepDefinitionsState } from '@store/step-definitions.state';
import { VariablesState } from '@store/variables.state';
import { LyridBrowsersState } from '@store/browserlyrid.state';
import { BrowsersState } from '@store/browsers.state';
import { AccountsState } from '@store/accounts.state';
import { ResultsState } from '@store/results.state';
import { UserState } from '@store/user.state';
import { DepartmentsState } from '@store/departments.state';
import { ConfigState } from '@store/config.state';
import { ActionsState } from '@store/actions.state';
import { BrowserstackState } from '@store/browserstack.state';
import { EnvironmentsState } from '@store/environments.state';
import { ApplicationsState } from '@store/applications.state';
import { FeaturesState } from '@store/features.state';
import { NgxsModule } from '@ngxs/store';
import { NgxsFormPluginModule } from '@ngxs/form-plugin';
import { SharedModule } from '@modules/shared.module';
import { ClipboardModule } from 'ngx-clipboard';
import { CometaRoutingModule } from './app/routing.module';
import { provideAnimations } from '@angular/platform-browser/animations';
import { CometaTitleStrategyService } from '@services/titles/cometa-title.service';
import { TitleStrategy } from '@angular/router';
import {
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogRef as MatDialogRef,
} from '@angular/material/legacy-dialog';
import {
  MAT_LEGACY_TOOLTIP_DEFAULT_OPTIONS as MAT_TOOLTIP_DEFAULT_OPTIONS,
  MatLegacyTooltipDefaultOptions as MatTooltipDefaultOptions,
} from '@angular/material/legacy-tooltip';
import { i18nMatPaginatorIntl } from '@services/paginator-intl';
import { MatLegacyPaginatorIntl as MatPaginatorIntl } from '@angular/material/legacy-paginator';
import {
  STRIPE_PUBLIC_TEST_KEY,
  STRIPE_PUBLIC_LIVE_KEY,
} from './app/deploy-tokens';
import {
  API_URL,
  API_BASE,
  SOCKET_URL,
  WEBP_SUPPORT,
  STRIPE_API_KEY,
} from './app/tokens';
import { LoadingInterceptor } from '@services/loading.interceptor';
import { SuccessHandlerInterceptor } from '@services/success-handler.interceptor';
import {
  HTTP_INTERCEPTORS,
  withInterceptorsFromDi,
  provideHttpClient,
  HttpClient,
} from '@angular/common/http';
import { Tours } from '@services/tours';
import { SharedActionsService } from '@services/shared-actions.service';
import { WhatsNewService } from '@services/whats-new.service';
import { TourService } from '@services/tour.service';
import { SocketService } from '@services/socket.service';
import { PaymentsService } from '@services/payments.service';
import { DownloadService } from '@services/download.service';
import { ApiService } from '@services/api.service';
import { ConfigService } from '@services/config.service';

var co_backend_uri = localStorage.getItem('co_backend_uri');
const developmentMode = location.host !== 'cometa.amvara.de';
let protocol = location.protocol;
const protocolInStorage = localStorage.getItem('http_protocol');
let host = location.hostname;
const hostInStorage = localStorage.getItem('api_url');
const portInStorage = localStorage.getItem('port');
let port = '';
const socketUrlInStorage = localStorage.getItem('socket_url');
var elem = document.createElement('canvas');
const testDomains = [
  /cometa-stage\.amvara\./,
  /stage\.cometa/,
  /localhost/,
  /co\.meta\.de/,
  /cometa-dev\.ddns\./,
];
let STRIPE_TEST_KEY = STRIPE_PUBLIC_TEST_KEY;
const STRIPE_PUBLIC_TEST_KEY_STORAGE = localStorage?.getItem(
  'STRIPE_PUBLIC_TEST_KEY'
);

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(CometaComponent, {
  providers: [
    importProvidersFrom(
      CometaRoutingModule,
      ClipboardModule,
      SharedModule.forRoot(),
      NgxsFormPluginModule.forRoot(),
      NgxsModule.forRoot(
        [
          FeaturesState,
          ApplicationsState,
          EnvironmentsState,
          BrowserstackState,
          ActionsState,
          ConfigState,
          DepartmentsState,
          UserState,
          ResultsState,
          AccountsState,
          BrowsersState,
          LyridBrowsersState,
          VariablesState,
          StepDefinitionsState,
          FeatureResultsState,
          LogsState,
          PaginationsState,
          PaginatedListsState,
          LoadingsState,
          IntegrationsState,
          SearchState,
          // Deprecated States or no longer used
          // ScreenshotsState,
          // RunsState,
          // CloudsState,
          // StepResultsState,
        ],
        {
          developmentMode: false,
          selectorOptions: {
            suppressErrors: false,
          },
        }
      ),
      NgxsSelectSnapshotModule.forRoot(),
      ContextMenuModule,
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: createTranslateLoader,
          deps: [HttpClient],
        },
        isolate: false,
      }),
      SharedModule.forRoot(),
      JoyrideModule.forRoot(),
      NgxNetworkErrorModule.forRoot({
        authType: 'openid',
        reporting: {
          sentryDSN: environment.sentryDSN,
          ignoreErrors: ['ResizeObserver loop limit exceeded'],
        },
      })
    ),
    ConfigService,
    ApiService,
    DownloadService,
    PaymentsService,
    SocketService,
    ConfigService,
    TourService,
    WhatsNewService,
    SharedActionsService,
    Tours,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: SuccessHandlerInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoadingInterceptor,
      multi: true,
    },
    {
      provide: API_URL,
      useValue: `${getApiBase()}api/`,
    },
    {
      provide: API_BASE,
      useValue: getApiBase(),
    },
    {
      provide: SOCKET_URL,
      useValue: getSocketUrl(),
    },
    {
      provide: WEBP_SUPPORT,
      useValue: getWebpSupport(),
    },
    {
      provide: STRIPE_API_KEY,
      useValue: getStripeApiKey(),
    },
    {
      // This loads the config.json file before the App is initialized
      provide: APP_INITIALIZER,
      useFactory: configLoader,
      deps: [ConfigService],
      multi: true,
    },
    {
      provide: MatPaginatorIntl,
      useClass: i18nMatPaginatorIntl,
    },
    // provides default options for mat-tooltip, this will force tooltip to dissapear as soon as mouse pointer leaves hover zone
    // careful, this can not be used with tooltips that are supposted to be copied, as user will not be able to copy it
    {
      provide: MAT_TOOLTIP_DEFAULT_OPTIONS,
      useValue: customTooltipDefaults,
    },
    { provide: MAT_DIALOG_DATA, useValue: {} },
    { provide: MatDialogRef, useValue: {} },
    { provide: TitleStrategy, useClass: CometaTitleStrategyService },
    provideAnimations(),
    provideHttpClient(withInterceptorsFromDi()),
  ],
}).catch(err => console.log(err));
