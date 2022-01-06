import { animate, query, stagger, state, style, transition, trigger } from '@angular/animations';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Store, Select } from '@ngxs/store';
import { FeaturesState } from '@store/features.state';
import { ApplicationsState } from '@store/applications.state';
import { EnvironmentsState } from '@store/environments.state';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, Observable } from 'rxjs';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { UserState } from '@store/user.state';
import { Features } from '@store/actions/features.actions';
import { CustomSelectors } from '@others/custom-selectors';
import { PageEvent } from '@angular/material/paginator';
import { Paginations } from '@store/actions/paginations.actions';
import { AddFolderComponent } from '@dialogs/add-folder/add-folder.component';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { Configuration } from '@store/actions/config.actions';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { SharedActionsService } from '@services/shared-actions.service';

@UntilDestroy()
@Component({
  selector: 'search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('listAnimation', [
      transition('* => *', [
        query(':enter', style({ opacity: 0, top: '30px' }), { optional: true }),
        query(':enter', stagger('100ms', [
          animate('.4s ease-in-out', style({ opacity: 1, top: '0px' }))
        ]), { optional: true })
      ])
    ]),
    trigger('addDialog', [
      state('false', style({
        visibility: 'hidden',
        left: '-30px',
        opacity: 0
      })),
      state('true', style({
        visibility: 'visible',
        left: '0',
        opacity: 1
      })),
      transition('false <=> true', animate('150ms ease-out'))
    ])
  ]
})
export class SearchComponent implements OnInit {

  @Select(ApplicationsState) applications$: Observable<Application[]>;
  @Select(UserState.RetrieveUserDepartments) departments$: Observable<ReturnType<typeof UserState.RetrieveUserDepartments>>;
  @Select(FeaturesState.GetFeaturesWithinFolder) features$: Observable<ReturnType<typeof FeaturesState.GetFeaturesWithinFolder>>;
  @Select(FeaturesState.GetFoldersWithinFolder) folders$: Observable<ReturnType<typeof FeaturesState.GetFoldersWithinFolder>>;
  @Select(FeaturesState.GetSelectionFolders) currentRoute$: Observable<ReturnType<typeof FeaturesState.GetSelectionFolders>>;
  @Select(FeaturesState.GetFilters) filters$: Observable<ReturnType<typeof FeaturesState.GetFilters>>;
  @Select(EnvironmentsState) environments$: Observable<Environment[]>;

  @Select(FeaturesState.IsEasterEgg) isEasterEgg$: Observable<ReturnType<typeof FeaturesState.IsEasterEgg>>;

  @Select(CustomSelectors.RetrievePagination('search_without_depends')) paginationWithoutDepends$: Observable<IPagination>;
  @Select(CustomSelectors.RetrievePagination('search_with_depends')) paginationWithDepends$: Observable<IPagination>;

  @ViewSelectSnapshot(CustomSelectors.GetConfigProperty('featuresView.with')) itemsViewWith: FeatureViewTypes;
  @ViewSelectSnapshot(CustomSelectors.GetConfigProperty('featuresView.without')) itemsViewWithout: FeatureViewTypes;

  // Checks if the user can create a feature and has a subscription
  @ViewSelectSnapshot(UserState.GetPermission('create_feature')) canCreateFeature: boolean;
  @ViewSelectSnapshot(UserState.HasOneActiveSubscription) hasSubscription: boolean;

  moreOrLessSteps = new FormControl('is');

  constructor(
    private _dialog: MatDialog,
    private _store: Store,
    private _sharedActions: SharedActionsService
  ) {
    const filtersStorage = localStorage.getItem('filters');
    if (!!filtersStorage) {
      try {
        const parsedFilters = JSON.parse(filtersStorage);
        this._store.dispatch(new Features.SetFilters(parsedFilters));
      } catch (err) { }
    }
  }

  @Dispatch()
  setView(type: string, view: FeatureViewTypes) {
    return new Configuration.SetProperty(`featuresView.${type}`, view, true);
  }

  @Dispatch()
  handlePageChange(paginationId: string, { pageIndex, pageSize }: PageEvent) {
    return new Paginations.SetPagination(paginationId, { pageIndex, pageSize })
  }

  sorting = new FormControl(localStorage.getItem('search_sorting') || 'execution');
  minADate = new FormControl('', Validators.required);
  maxADate = new FormControl('', Validators.required);

  search: string;

  ready = new BehaviorSubject<boolean>(false);

  ngOnInit() {
    this.moreOrLessSteps.valueChanges.pipe(
      untilDestroyed(this)
    ).subscribe(value => {
      this._store.dispatch( new Features.SetMoreOrLessSteps(value) );
    });
    // Save sorting preference in localStorage
    this.sorting.valueChanges.pipe(
      untilDestroyed(this)
    ).subscribe(value => localStorage.setItem('search_sorting', value))
  }

  @Dispatch()
  goFolder(folder: Folder) {
    return new Features.AddFolderRoute(folder);
  }

  @Dispatch()
  returnToRoot() {
    return new Features.ReturnToFolderRoute(0);
  }

  @Dispatch()
  returnFolder(folder: Partial<Folder>) {
    return new Features.ReturnToFolderRoute(folder.folder_id);
  }

  getId(item: Feature) {
    return item.feature_id;
  }

  listStyle = {
    opacity: 0,
    left: '52px',
    visibility: 'hidden'
  };

  createFolder() {
    const currentFolder = this._store.selectSnapshot(FeaturesState).currentRoute as Folder[];
    let folder_id;
    if (currentFolder.length === 0) {
      folder_id = 0;
    } else {
      folder_id = currentFolder[currentFolder.length - 1].folder_id
    }
    this._dialog.open(AddFolderComponent, {
      autoFocus: true,
      data: {
        mode : 'new',
        folder: { folder_id }
      } as IEditFolder
    })
  }

  @Dispatch()
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
    return new Features.AddFilter(customFilter);
  }

  @Dispatch()
  removeFilter(filter: Filter) {
    return new Features.RemoveFilter(filter);
  }

  addFilter(filter: Filter) {
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
   * Shared Actions functions
   */

  // Opens a menu to create a new feature
  SAopenCreateFeature() {
    this._sharedActions.openEditFeature();
  }
}
