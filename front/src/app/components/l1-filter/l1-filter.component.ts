/**
 * l1-filter.components.ts
 *
 * Contains the functions for the filter bar of the new-landing. It includes the breadcrumbs, search bar and all other filters. It also shows
 * the currently active filters.
 *
 * Changelog:
 *
 * @author: dph000
 */

import { ChangeDetectionStrategy, Component, HostListener, Input, OnInit } from '@angular/core';
import { UntypedFormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Select, Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { LogService } from '@services/log.service';
import { SharedActionsService } from '@services/shared-actions.service';
import { Configuration } from '@store/actions/config.actions';
import { Features } from '@store/actions/features.actions';
import { FeaturesState } from '@store/features.state';
import { BehaviorSubject, Observable } from 'rxjs';
import { FilterTextPipe } from '@pipes/filter-text.pipe';
import { StoreSelectorPipe } from '../../pipes/store-selector.pipe';
import { DisableAutocompleteDirective } from '../../directives/disable-autocomplete.directive';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { NgFor, NgIf, AsyncPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';

@UntilDestroy()
@Component({
    selector: 'cometa-l1-filter',
    templateUrl: './l1-filter.component.html',
    styleUrls: ['./l1-filter.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatLegacyTooltipModule, MatIconModule, NgFor, MatLegacyFormFieldModule, MatLegacyInputModule, ReactiveFormsModule, DisableAutocompleteDirective, FormsModule, NgIf, StoreSelectorPipe, FilterTextPipe, AsyncPipe]
})
export class L1FilterComponent implements OnInit {

  constructor(
    public _sharedActions: SharedActionsService,
    private _store: Store,
    private _router: Router,
    private log: LogService
  ) { }

  /**
   * Declaration of variables used in the class
   */
  @Select(FeaturesState.GetNewSelectionFolders) currentRoute$: Observable<ReturnType<typeof FeaturesState.GetNewSelectionFolders>>;
  @Select(CustomSelectors.GetConfigProperty('openedSearch')) openedSearch$: Observable<boolean>;
  @Input() filters$; // Filter list

  /**
   * Global variables
   */
  moreOrLessSteps = new UntypedFormControl('is');
  finder = this._store.selectSnapshot<boolean>(CustomSelectors.GetConfigProperty('openedSearch'));
  searchInput: string;
  dialogs = {
    dept: new BehaviorSubject<boolean>(false),
    app: new BehaviorSubject<boolean>(false),
    env: new BehaviorSubject<boolean>(false),
    test: new BehaviorSubject<boolean>(false),
    steps: new BehaviorSubject<boolean>(false),
    date: new BehaviorSubject<boolean>(false),
    ok: new BehaviorSubject<boolean>(false),
    fails: new BehaviorSubject<boolean>(false),
    skipped: new BehaviorSubject<boolean>(false),
    department: new BehaviorSubject<boolean>(false),
    execution_time: new BehaviorSubject<boolean>(false),
    pixel_diff: new BehaviorSubject<boolean>(false)
  };

  /**
   * Once the file loads, subscribes to the specified variables and updates them on change
   */
  ngOnInit() {
    this.log.msg("1","Inicializing component...","filter");
    this.moreOrLessSteps.valueChanges.pipe(
      untilDestroyed(this)
    ).subscribe(value => {
      this._store.dispatch(new Features.SetMoreOrLessSteps(value));
    });
    this.openedSearch$.subscribe(value => this.finder = value);
  }

  /**
   * Go to the parent folder whenever the breadcrumbs back arrow is clicked on mobile view
   * @param folder
   *
   * @returns parent_id of the current folder
   */
  returnParent() {
    this.log.msg("1","Returning to parent folder...","filter");
    return this._store.dispatch(new Features.ReturnToParentRoute());
  }

  /**
   * Whenever the home button is clicked in breadcrumbs sets the current folder as home
   *
   * @returns root folder
   */
  returnToRoot() {
    this.log.msg("1","Returning to root directory...","filter");
    this._router.navigate(['/']);
    this.toggleListType('list');
    return this._store.dispatch(new Features.ReturnToFolderRoute(0));
  }

  /**
   * Changes the current folder to the one clicked on breadcrumbs (only on desktop)
   *
   * @param folder
   * @returns id of the clicked folder
   */
  returnFolder(folder: Partial<Folder>) {
    this.log.msg("1","Changing current route path...","filter");
    // dispach folder path change
    this._store.dispatch(new Features.ReturnToFolderRoute(folder.folder_id));

    // #3414 -------------------------------------------------start
    // path to currently displayed folder
    const currentRoute = this._store.snapshot().features.currentRouteNew;

    this.log.msg("1","Setting url params, adding current folder's id...","filter");
    // change browser url, add folder id as params
    this._sharedActions.set_url_folder_params(currentRoute);
    // #3414 ---------------------------------------------------end
  }

  // Gets and sets the variable from config file to open/close the sidenav
  /**
   * Opens the sidenav whenever the user clicks on the toggle sidenav button on mobile
   * or closes it if the user clicks outside of the sidenav container or goes to another folder
   *
   * @return sets the current status of the sidenav on mobile
   */
  toggleSidenav() {
    // get current state of side navbar after clicking toggle arrow icon
    let newSidebarState = this.getSidebarState() ? false : true;
    this.log.msg("1","Toggling sidenav...","filter");
    return this._store.dispatch(new Configuration.SetProperty('openedSidenav', newSidebarState));
  }

  /**
   * Toggles the status of the search bar
   *
   * @return sets the current status of the search bar
   */
  toggleSearch() {
    this.log.msg("1","Toggling searchbar...","filter");
    this.finder = !this.finder;
    return this._store.dispatch(new Configuration.SetProperty('openedSearch', this.finder));
  }

  /**
   * Removes a filter whenever the cross is pressed on the active filters div
   *
   * @param filter
   * @return removes a filter
   */
  removeFilter(filter: Filter) {
    this.log.msg("1","Removing searchbar filter term...","filter");
    return this._store.dispatch(new Features.RemoveFilter(filter));
  }

  /**
   * Removes a filter whenever the cross is pressed on the active filters div
   *
   * @param filter
   * @return removes a filter
   */
  removeSearchFilter() {
    this.log.msg("1","Clearing searchbar filter terms...","filter");
    return this._store.dispatch(new Features.RemoveSearchFilter());
  }

  // Checks which filter to add and if it's ok then add it
  addFilterOK(id: string, value?: any, value2?: any) {
    const filters = this._store.selectSnapshot(CustomSelectors.GetConfigProperty('filters'));
    let customFilter = { ...filters.find(filter => filter.id === id) };
    switch (id) {
      case 'date':
        customFilter.range1 = value;
        customFilter.range2 = value2;
        break;
      case 'steps':
      case 'ok':
        customFilter.more = value2;
        customFilter.value = value;
        break;
      case 'help':
        break;
      default:
        customFilter.value = value;
    }
    // Check if filter requires a value
    if (customFilter.hasOwnProperty('value')) {
      this.dialogs[id].next(false);
    }
    this.toggleSearch();
    return this._store.dispatch(new Features.AddFilter(customFilter));
  }

  // Adds a filter
  addFilter(filter: Filter) {
    this.log.msg("1","Adding searchbar filter terms...","filter");
    // Check if filter requires a value
    if (filter.hasOwnProperty('value')) {
      this.dialogs[filter.id].next(true);
      setTimeout(() => {
        if (filter.id === 'test') {
          try {
            (document.querySelector('.dialog input[type=text]') as HTMLInputElement).focus();
          } catch (err) { }
        }
      })
    } else {
      this.addFilterOK('help')
    }
  }

  /**
   * If there is text inside of the search input, executes the function to check if the filter is valid
   * and empties the search input
   */
  searchFeature() {
    if (this.searchInput) {
      this.log.msg("1","Searching feature...","filter", this.searchInput);

      this.toggleListType('list');
      this.addFilterOK('test', this.searchInput);
      this.searchInput = "";

      // close search bar after click on search icon ---- #3461
      this.close_search();
    }
  }

  getId(item: Feature) {
    return item.feature_id;
  }

  // returns sidebar state boolean  true/false = open/closed
  getSidebarState() {
    this.log.msg("1","Getting sidebar state...","filter");
    return this._store.selectSnapshot<boolean>(CustomSelectors.GetConfigProperty('openedSidenav'));
  }

  /**
   * If the search bar is closed, opens it and focuses on the search input
   */
  open_search() {
    this.toggleSearch();
    (document.querySelector('.search-input-box') as HTMLInputElement).focus();
  }

  /**
   * If the search bar is open, closes it and empties the search input
   */
  close_search() {
    (document.querySelector('.search-input-box') as HTMLInputElement).value = "";
    this.searchInput = "";
    if (this.finder) {
      this.toggleSearch();
    }
  }

  /**
   * Toggle the recent list variable in the store
   * @returns new Configuration of co_active_list
   * @author dph000
   * @date 11-10-21
   * @lastModification 11-10-21
   */
  toggleListType(listType: string) {
    return this._store.dispatch(new Configuration.SetProperty('co_active_list', listType, true));
  }

  /**
   * HotKey event listeners
   */

  // #3420 ------------------------------------------------ start
  // Hotkey Shift-Alt-f ... opens the finder
  @HostListener('document:keydown.Shift.Alt.f', ['$event'])
  hotkey_shift_alt_f(event: KeyboardEvent) {

    // rewrite browser shortcut
    event.preventDefault();

    // set searchterm to empty ---- #3461
    if(this.searchInput) this.searchInput = "";

    // remove filter term if exists
    if (this.filters$.length > 0) {
      this.removeSearchFilter();
    }

    // toggle searchbar
    this.open_search();
  }
  // #3420 -------------------------------------------------- end

  // Hotkey Shift-Alt-h ... goes to root-Folder
  @HostListener('document:keydown.Shift.Alt.h', ['$event'])
  hotkey_shift_alt_h(event: KeyboardEvent) {
    this.returnToRoot();
    event.preventDefault();
  }

  // Hotkey Escape ... closes search component
  @HostListener('document:keydown.Escape', ['$event'])
  hotkey_escape(event: KeyboardEvent) {
    this.close_search();
    event.preventDefault();
  }

  // Hotkey Shift-Alt-X ... Remove Filter
  @HostListener('document:keydown.Shift.Alt.x', ['$event'])
  hotkey_shift_alt_x(event: KeyboardEvent) {
    if (!this.finder) {
      this.removeSearchFilter();
    }
  }
}
