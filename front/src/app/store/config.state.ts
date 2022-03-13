import { State, Action, StateContext, Selector } from '@ngxs/store';
import configFile from '../../assets/config.json';
import { Injectable } from '@angular/core';
import { ApiService } from '@services/api.service';
import { tap } from 'rxjs/operators';
import { produce } from 'immer';
import { log } from 'ngx-amvara-toolbox';
import { ImmutableSelector } from '@ngxs-labs/immer-adapter';
import { Configuration } from './actions/config.actions';
import { format, parse } from 'date-fns';
import enLocale from 'date-fns/locale/en-US';
import esLocale from 'date-fns/locale/es';
import deLocale from 'date-fns/locale/de';
import { Router } from '@angular/router';

/**
 * @description Contains the state of the Configuration
 * @author Alex Barba
 */
@State<Partial<Config>>({
  name: 'config',
  defaults: {}
})
@Injectable()
export class ConfigState {

  constructor(
    private _api: ApiService,
    private _router: Router
  ) { }

  @Action(Configuration.GetConfig)
  getConfig({ setState }: StateContext<Config>) {
    // Initialize the co_active_list variable, starting with recent as this is the type of list a new user needs to see first (config.json)
    configFile.co_active_list = localStorage.getItem('co_active_list') || configFile.co_active_list;
    // Initialize the co_features_pagination variable
    configFile.co_features_pagination = parseInt(localStorage.getItem('co_features_pagination'), 10) || configFile.co_features_pagination;
    // Initialize the co_first_time_cometa variable to control if the user has already seen the welcome page
    configFile.co_first_time_cometa = localStorage.getItem('co_first_time_cometa') === 'true' || false;
    configFile.language = localStorage.getItem('lang') || configFile.language;
    configFile.logWebsockets = localStorage.getItem('logWebsockets') === 'true' || false;
    configFile.disableAnimations = localStorage.getItem('da') === 'yes' || configFile.disableAnimations;
    configFile.percentMode = localStorage.getItem('percentMode') === 'true' || false;
    configFile.toggles.hideInformation = localStorage.getItem('hideInformation') === 'true' || configFile.toggles.hideInformation;
    configFile.toggles.hideBrowsers = localStorage.getItem('hideBrowsers') === 'true' || configFile.toggles.hideBrowsers;
    configFile.toggles.hideSteps = localStorage.getItem('hideSteps') === 'true' || configFile.toggles.hideSteps;
    configFile.toggles.hideSchedule = localStorage.getItem('hideSchedule') === 'true' || configFile.toggles.hideSchedule;
    configFile.toggles.hideSendMail = localStorage.getItem('hideSendMail') === 'true' || configFile.toggles.hideSendMail;
    // decide to useNewDashboard either from localStorage or from global configFile
    configFile.useNewDashboard = localStorage.getItem('useNewDashboard') === 'true' || configFile.useNewDashboard;
    configFile.sorting = localStorage.getItem('search_sorting') || configFile.sorting;
    configFile.reverse = localStorage.getItem('search_sorting_reverse') === 'true' || configFile.reverse;
    let routerConfig = this._router.config;
    routerConfig[0].redirectTo = configFile.useNewDashboard ? 'new' : 'search';
    this._router.resetConfig(routerConfig);
    // Configuration to change the features view
    const featuresViewWith = localStorage.getItem('featuresView.with');
    if (featuresViewWith !== null) {
      if (['tiles','list'].includes(featuresViewWith)) {
        configFile.featuresView.with = featuresViewWith;
      } else {
        localStorage.removeItem('featuresView.with');
      }
    }
    // Configuration to change the related features view
    const featuresViewWithout = localStorage.getItem('featuresView.without');
    if (featuresViewWithout !== null) {
      if (['tiles','list'].includes(featuresViewWithout)) {
        configFile.featuresView.without = featuresViewWithout;
      } else {
        localStorage.removeItem('featuresView.without');
      }
    }
    return this._api.getServerInfo().pipe(
      tap(server => {
        configFile.serverInfo = server;
        // @ts-ignore
        setState(configFile);
        log('Config', configFile);
      })
    );
  }

  @Action(Configuration.ToggleCollapsible)
  toggleCollapsible({ setState }: StateContext<Config>, { key, value }: Configuration.ToggleCollapsible) {
    localStorage.setItem(key, value.toString());
    setState(
      produce((ctx: Config) => {
        ctx.toggles[key] = value;
      })
    );
  }

  @Action(Configuration.SetConfig)
  setConfig({ setState }: StateContext<Config>, { config }: Configuration.SetConfig) {
    setState(config);
  }

  @Action(Configuration.SetProperty)
  setProperty({ setState }: StateContext<Config>, { key, value, save }: Configuration.SetProperty) {
    if (save) {
      localStorage.setItem(key, value);
    }
    setState(
      produce((ctx: Config) => {
        // Convert dotted property format to array
        const parts = key.split('.');
        // Grab last key or unique key
        const lastKey = parts.pop();
        let ref = ctx;
        if (parts.length > 0) {
          // Handles nested properties by re-referencing state
          parts.forEach(part => ref = ref[part]);
        }
        ref[lastKey] = value;
      })
    )
  }

  @Action(Configuration.ChangePercentMode)
  setPercentMode({ getState, patchState }: StateContext<Config>) {
    const percent = !getState().percentMode;
    patchState({ percentMode: percent });
    this.saveViewMode(percent);
  }

  @Action(Configuration.SetPagination)
  setPagination({ setState }: StateContext<Config>, { index, size }: Configuration.SetPagination) {
    setState(
      produce((ctx: Config) => {
        ctx.pagination.pageIndex = index;
        ctx.pagination.pageSize = size;
      })
    )
  }

  @Selector()
  @ImmutableSelector()
  static GetProperty(state: Config): any {
    return (key: string) => {
      // Convert dotted property format to array
      const parts = key.split('.');
      // Grab last key or unique key
      const lastKey = parts.pop();
      let ref = state;
      if (parts.length > 0) {
        // Handles nested properties by re-referencing state
        parts.forEach(part => ref = ref[part]);
      }
      return ref[lastKey];
    };
  }

  // Saves the current view mode for ok / nok in localStorage
  saveViewMode(mode: boolean) {
    localStorage.setItem('ViewMode', mode.toString());
  }

  @Selector()
  static getLastChangelogDate(state: Config) {
    let date;
    try {
      date = state.changelog[0].date;
    } catch (err) { }
    if (date) {
      const parsed = parse(date, 'yyyy-MM-dd', new Date());
      if (parsed) {
        const locales = {
          en: enLocale,
          de: deLocale,
          es: esLocale
        }
        return format(parsed, 'MMMM d, yyyy', {
          locale: locales[state.language]
        })
      }
    }
    return null;
  }

  @Selector()
  static GetOpenedSidenav(ctx: Config) {
    return ctx.openedSidenav;
  }

  static GetOpenedSearch(ctx: Config) {
    return ctx.openedSearch;
  }

  @Selector()
  static GetLanguage(ctx: Config) {
    return ctx.language;
  }

  @Selector()
  static pickRandomWelcomeSentence(state: Config) {
    const total = state.welcomeSentences.length - 1;
    const randIndex = Math.floor( Math.random() * ( total + 1 ) );
    return state.welcomeSentences[randIndex];
  }

}
