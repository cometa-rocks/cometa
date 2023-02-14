import { Component, ChangeDetectionStrategy, Output, EventEmitter, OnInit, Input } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
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
  providers: [
    BrowserFavouritedPipe,
    PlatformSortPipe
  ]
})
export class BrowserSelectionComponent implements OnInit {

  @Input() feature: Feature;

  @ViewSelectSnapshot(UserState.GetBrowserFavourites) favourites$: BrowserstackBrowser[];
  @ViewSelectSnapshot(BrowsersState.getBrowserJsons) localBrowsers$: BrowserstackBrowser[];
  @ViewSelectSnapshot(BrowserstackState) onlineBrowsers$: BrowserstackBrowser[];

  @ViewSelectSnapshot(UserState.GetAvailableClouds) clouds$: Cloud[];

  getBrowserKey(key, version) {
    // Get unique key for platform selector values
    return `${key}%${version}`;
  }

  constructor(
    private _favouritePipe: BrowserFavouritedPipe,
    private _platformSort: PlatformSortPipe,
    private _store: Store
  ) { }

  testing_cloud = new UntypedFormControl('browserstack');
  browser = new UntypedFormControl();

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

  rippleColor = 'rgba(0,0,0,0.05)';

  selectedCategory = new BehaviorSubject<string>('');
  selectedVersion = new BehaviorSubject<string>('');

  browsersSelected = new BehaviorSubject<BrowserstackBrowser[]>([]);

  ngOnInit() {
    try {
      this.browsersSelected.next(this.feature.browsers);
    } catch (err) {
      this.browsersSelected.next([]);
    }
    // Handle platform selection from mobile selector
    this.browser.valueChanges.pipe(
      untilDestroyed(this),
      map(browser => ({ os: browser.split('%')[0], version: browser.split('%')[1] }))
    ).subscribe(browser => this.processVersion(browser.os, browser.version));
    // Get latest value comming from @Input and BrowserstackState
    this.testing_cloud.valueChanges.pipe(
      untilDestroyed(this)
    ).subscribe(origin => {
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
        // Origin fallback: Local (Backend)
        default:
          // Grab local browsers from backend instead of static ones from DataService
          this.rollupOS(this.localBrowsers$);
      }
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
    document.querySelector(`.versions.${browserKey}`).classList.toggle('show_all');
  }
  
  toggleFavourite(browser: BrowserstackBrowser) {
    return this._favouritePipe.transform(browser, this.favourites$) ?
           this._store.dispatch(new User.RemoveBrowserFavourite(browser)) :
           this._store.dispatch(new User.AddBrowserFavourite(browser));
  }

  deleteFavourite(fav: BrowserstackBrowser) {
    // Remove favourite
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
      const latestVersion = this._platformSort.transform(Object.keys(categories[firstCategory]), firstCategory)[0];
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
      selectedBrowsers.push(browser);
      this.browsersSelected.next(selectedBrowsers);
    } else {
      const selectedBrowsers = this.browsersSelected.getValue();
      const index = selectedBrowsers.findIndex(br => JSON.stringify(br) === JSON.stringify(browser));
      selectedBrowsers.splice(index, 1);
      this.browsersSelected.next(selectedBrowsers);
    }
    this.selectionChange.emit(this.browsersSelected.getValue());
  }

}
