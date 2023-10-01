/**
 * l1-landing.component.ts
 *
 * Main component for the new-landing view that includes everything except the header
 *
 * @lastModification 04-10-21
 *
 * @author: dph000
 */

import { animate, query, stagger, state, style, transition, trigger } from '@angular/animations';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntypedFormControl, Validators } from '@angular/forms';
import { Store, Select } from '@ngxs/store';
import { Router } from '@angular/router';
import { FeaturesState } from '@store/features.state';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { UserState } from '@store/user.state';
import { Features } from '@store/actions/features.actions';
import { CustomSelectors } from '@others/custom-selectors';
import { AddFolderComponent } from '@dialogs/add-folder/add-folder.component';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { Configuration } from '@store/actions/config.actions';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { SharedActionsService } from '@services/shared-actions.service';
import { Observable } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { LogService } from '@services/log.service';
import { User } from '@store/actions/user.actions';
import { L1FeatureTrashbinListComponent } from '../l1-feature-trashbin-list/l1-feature-trashbin-list.component';
import { L1FeatureStarredListComponent } from '../l1-feature-starred-list/l1-feature-starred-list.component';
import { L1FeatureRecentListComponent } from '../l1-feature-recent-list/l1-feature-recent-list.component';
import { L1FeatureTeamListComponent } from '../l1-feature-team-list/l1-feature-team-list.component';
import { EditVariablesComponent } from '../../dialogs/edit-variables/edit-variables.component';
import { WelcomeComponent } from '../welcome/welcome.component';
import { L1TreeViewComponent } from '../l1-tree-view/l1-tree-view.component';
import { L1FeatureListComponent } from '../l1-feature-list/l1-feature-list.component';
import { L1FeatureItemListComponent } from '../l1-feature-item-list/l1-feature-item-list.component';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatRippleModule } from '@angular/material/core';
import { L1FilterComponent } from '../l1-filter/l1-filter.component';
import { LetDirective } from '../../directives/ng-let.directive';
import { FolderTreeComponent } from '../folder-tree/folder-tree.component';
import { NgIf, NgFor, AsyncPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';


@UntilDestroy()
@Component({
    selector: 'cometa-l1-landing',
    templateUrl: './l1-landing.component.html',
    styleUrls: ['./l1-landing.component.scss'],
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
    ],
    standalone: true,
    imports: [MatLegacyButtonModule, MatIconModule, NgIf, FolderTreeComponent, LetDirective, L1FilterComponent, MatRippleModule, MatLegacyTooltipModule, NgFor, L1FeatureItemListComponent, L1FeatureListComponent, L1TreeViewComponent, WelcomeComponent, EditVariablesComponent, L1FeatureTeamListComponent, L1FeatureRecentListComponent, L1FeatureStarredListComponent, L1FeatureTrashbinListComponent, AsyncPipe]
})
export class L1LandingComponent implements OnInit {

  constructor(
    private _router: Router,
    private _dialog: MatDialog,
    private _store: Store,
    public _sharedActions: SharedActionsService,
    private activatedRoute: ActivatedRoute,
    private log: LogService
  ) {
    const filtersStorage = localStorage.getItem('filters');
    if (!!filtersStorage) {
      try {
        const parsedFilters = JSON.parse(filtersStorage);
        this._store.dispatch(new Features.SetFilters(parsedFilters));
      } catch (err) { }
    }

    // if user clicks on browser bookmark that saves location to certain folder or feature, it will not be loaded if active_list is not set to 'list', as 'list' renders the table
    // that's why we check if there are params in url and if so, set active_list to 'list'. So user can directly navigate to saved bookmark location
    if (this.url_has_params())  {
      this._store.dispatch(new Configuration.SetProperty('co_active_list', 'list', true));
    }

    // forces the components content to reload when url parameters are changed manually
    this._router.routeReuseStrategy.shouldReuseRoute = () => false;
    
  }

  // Contains all the features and folders data
  @Select(FeaturesState.GetNewFeaturesWithinFolder) data$: Observable<ReturnType<typeof FeaturesState.GetNewFeaturesWithinFolder>>;
  // Contains the list of active filters
  @Select(FeaturesState.GetFilters) filters$: Observable<ReturnType<typeof FeaturesState.GetFilters>>;
  // Checks if the sidenav is opened (only mobile)
  @Select(CustomSelectors.GetConfigProperty('openedSidenav')) showFolders$: Observable<boolean>;
  // Checks if the search bar is opened
  @Select(CustomSelectors.GetConfigProperty('openedSearch')) openedSearch$: Observable<boolean>;
  // Checks which list is active
  @Select(CustomSelectors.GetConfigProperty('co_active_list')) aciveList$: Observable<string>;
  // Type of view (list / item)
  @ViewSelectSnapshot(CustomSelectors.GetConfigProperty('featuresView.with')) itemsViewWith: FeatureViewTypes;
  // Checks if the user can create features
  @ViewSelectSnapshot(UserState.GetPermission('create_feature')) canCreateFeature: boolean;
  // Checks if the user has an active subscription
  @ViewSelectSnapshot(UserState.HasOneActiveSubscription) hasSubscription: boolean;


  // Global variables
  minADate = new UntypedFormControl('', Validators.required);
  maxADate = new UntypedFormControl('', Validators.required);
  moreOrLessSteps = new UntypedFormControl('is');
  openedAdd: boolean = false; // Checks if the add buttons are opened
  search: string;
  sidenavClosed = false;

  ngOnInit() {
    this.log.msg("1","Inicializing component...","landing");
    // #3414 -------------------------------------------------start
    // check if there are folder ids in url params, if so redirect to that folder
    this.redirect_with_url_params(); 
    // #3414 --------------------------------------------------end

    this.moreOrLessSteps.valueChanges.pipe(untilDestroyed(this))
    .subscribe(value => {
      this._store.dispatch( new Features.SetMoreOrLessSteps(value));
    });

    this.aciveList$.pipe(untilDestroyed(this))
    .subscribe(value => {
      localStorage.setItem('co_active_list', value) // Initialize the recentList_active variable in the local storage 
    });
  }

  /**
   * Dispatch functions
   */

  // Changes the type of view of the feature list (list / item)
  setView(type: string, view: FeatureViewTypes) {
    this.log.msg("1","Changing feature list view type to...","landing", view);
    this.openedAdd = false;

    return this._store.dispatch([
      new User.SetSetting({ 'featuresView.with': view }),
      new Configuration.SetProperty(`featuresView.${type}`, view, true)
    ]);
  }

  // Hides the sidenav
  hideSidenav() {
    let currentSidebarState = this._store.selectSnapshot<boolean>(CustomSelectors.GetConfigProperty('openedSidenav'));
    let newSidebarState = currentSidebarState ? false : true;
    this.log.msg("1","Hiding sidenav...","landing");
    return this._store.dispatch(new Configuration.SetProperty('openedSidenav', newSidebarState));
  } 

  /**
   * General functions
   */

  // Closes the add feature / folder menu
  closeAdd() {
    this.openedAdd = false;
  }

  // Open the create folder dialog
  createFolder() {
    this.log.msg("1","Opening create folder dialog...","landing");
    const currentFolder = this._store.selectSnapshot(FeaturesState).currentRouteNew as Folder[];
    let folder_id;
    if (currentFolder.length === 0) {
      folder_id = 0;
    } else {
      folder_id = currentFolder[currentFolder.length - 1]
    }
    this._dialog.open(AddFolderComponent, {
      autoFocus: true,
      data: {
        mode : 'new',
        folder: folder_id
      } as IEditFolder
    })
  }

  /**
   * Shared Actions functions
   */

  // Opens a menu to create a new feature
  SAopenCreateFeature() {
    this.log.msg("1","Opening create feature dialog...","landing");
    this._sharedActions.openEditFeature();
  }


  // checks if current url contains params and returns corresponding boolean
  url_has_params() {
    let folderIdRoute = this.activatedRoute.snapshot.paramMap.get('breadcrumb');
    return folderIdRoute ? true : false;
  }


  // #3414 -----------------------------------------------------------------------------------------start
  // generates a folder path with folder ids retrieved from url and redirect to there to show content
  redirect_with_url_params() {
    this.log.msg("1","Checking url params","landing");
    // get url params - which contains a path created with folder ids, like 2:13:15 for example
    let folderIdRoute = this.activatedRoute.snapshot.paramMap.get('breadcrumb');

    // if there are folder ids in browser path
    if(folderIdRoute) {      
      // remove first ':' from url params
      folderIdRoute = folderIdRoute.indexOf(":") == 0 ? folderIdRoute.slice(1) : folderIdRoute;

      // split the url string to get array or folder ids base on ':'
      const folderIDS = folderIdRoute.split(":");

      // checks if there is more than one id in url params
      // if so it means that user is currently inside a folder within department, so we load that folders content
      // if there is only one id it means user is currently in department, so we load all the folders that belong to that department
      folderIDS.length > 1 ? this.show_folder_content(folderIDS) : this.show_department_content(folderIDS)
    } else {
      this.log.msg("1","No url params were found","landing");
    }
  }
  // #3414 ------------------------------------------------------------------------------------------end


  // #3414 -----------------------------------------------------------------------------------------start
  show_folder_content (folderIDS: any) {
    // removes the first item from array, which is departmentId
    folderIDS.shift();

    let currentRoute = [];

    // get folders from state
    let folders = this._store.snapshot().features.folders.folders;

    // filter folders with the first id of params
    let folder = folders.filter(folder => folder.folder_id == folderIDS[0]);

    // array.prototype.filter returns an array, but we need to push an object in currentRoutes, so the final resut is array of objects, not array of arrays
    // thats why we dont push folder array itself, but first and only item it has
    currentRoute.push(folder[0]);

    // search recursively ids that are recieved from url params, search startpoint is the first folder
    // the next filter is always performed on previus filter result (recursive filtering)
    for(let i = 1; i<folderIDS.length; i++ ) {
      folder = folder[0].folders.filter(folder => folder.folder_id == folderIDS[i]);
      currentRoute.push(folder[0]);
    }

    // log folder id that app is redirected to
    this.log.msg("1",`Folder id param found, redirectiong to folder with id ${currentRoute.slice(-1)[0].folder_id}`,"landing");

    // save the final folder path in localstorage
    localStorage.setItem('co_last_selected_folder_route', JSON.stringify(currentRoute));
  }
  // #3414 ------------------------------------------------------------------------------------------end


  // #3414 -----------------------------------------------------------------------------------------start
  // filters folders to show only the ones that belong to department id present in url params
  show_department_content(folderIDS: any) {
    // log department id where app is redirected to
    this.log.msg("1",`Department id param found, redirectiong to department with id ${folderIDS[0]}`,"landing");

    let department = [];
    this._store.select(CustomSelectors.GetDepartmentFolders())
      .subscribe(
        data => {
          department = data.filter(department => department.folder_id == Number(folderIDS[0]));
        }
      );
      localStorage.setItem('co_last_selected_folder_route', JSON.stringify(department));
  }
  // #3414 ------------------------------------------------------------------------------------------end
  }

