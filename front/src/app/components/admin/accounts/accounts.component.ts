import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { Observable, Subject, BehaviorSubject, of, combineLatest } from 'rxjs';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { map, startWith, catchError, switchMap, take, tap, distinctUntilChanged, debounceTime } from 'rxjs/operators';
import { Sort } from '@angular/material/sort';
import { AsyncPipe, NgIf, NgClass, NgSwitch, NgSwitchCase, NgSwitchDefault, NgFor } from '@angular/common';
import { AccountComponent } from './account/account.component';
import { NetworkPaginatedListComponent } from '../../network-paginated-list/network-paginated-list.component';
import { DisableAutocompleteDirective } from '../../../directives/disable-autocomplete.directive';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { InputFocusService } from '@services/inputFocus.service';
import { MtxGridModule } from '@ng-matero/extensions/grid';
import { LetDirective } from '../../../directives/ng-let.directive';
import { TranslateModule } from '@ngx-translate/core';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { ApiService } from '@services/api.service';
import { LogService } from '@services/log.service';
import { Store, Select, Actions, ofActionDispatched } from '@ngxs/store';
import { HttpClient } from '@angular/common/http';
import { Configuration } from '@store/actions/config.actions';
import { CustomSelectors } from '@others/custom-selectors';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ModifyUserComponent } from '@dialogs/modify-user/modify-user.component';
import { Accounts } from '@store/actions/accounts.actions';
import { AreYouSureData, AreYouSureDialog } from '@dialogs/are-you-sure/are-you-sure.component';
import { UserState } from '@store/user.state';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'admin-accounts',
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatMenuModule,
    MatDividerModule,
    ReactiveFormsModule,
    DisableAutocompleteDirective,
    NetworkPaginatedListComponent,
    MtxGridModule,
    LetDirective,
    TranslateModule,
    AmDateFormatPipe,
    AmParsePipe,
    NgIf,
    NgClass,
    NgSwitch,
    NgSwitchCase,
    NgSwitchDefault,
    NgFor,
    AccountComponent,
    AsyncPipe,
  ],
  encapsulation: ViewEncapsulation.None,
})
export class AccountsComponent implements OnInit {
  inputFocus: boolean = false;
  
  constructor(
    private inputFocusService: InputFocusService,
    private _api: ApiService,
    private _http: HttpClient,
    private log: LogService,
    private _store: Store,
    private _dialog: MatDialog,
    private _snack: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private actions$: Actions
  ){}

  // Permission selectors
  @Select(UserState.GetPermission('edit_account'))
  canEditAccount$: Observable<boolean>;
  @Select(UserState.GetPermission('delete_account'))
  canDeleteAccount$: Observable<boolean>;

  // Table data and configuration
  accountsUrl$: Observable<string>;
  search = new UntypedFormControl('');
  isLoading$ = new BehaviorSubject<boolean>(true);
  private refreshTrigger$ = new Subject<void>();
  
  // Frontend sorting (like l1-feature-list)
  currentSearch = '';
  // Locally removed account ids to hide rows immediately without reload
  private locallyRemovedAccountIds: Set<string> = new Set<string>();
  private removedAccountIdsSubject = new BehaviorSubject<Set<string>>(new Set<string>());
  private removedAccountIds$ = this.removedAccountIdsSubject.asObservable();
  
  // Locally modified accounts to update rows immediately without reload
  private locallyModifiedAccounts: Map<string, any> = new Map<string, any>();
  private modifiedAccountsSubject = new BehaviorSubject<Map<string, any>>(new Map<string, any>());
  private modifiedAccounts$ = this.modifiedAccountsSubject.asObservable();
  totalAccounts = 0;
  // Server-side pagination/sort state
  currentPageIndex = 0; // zero-based for UI
  currentPageSize = parseInt(localStorage.getItem('co_accounts_pagination') || '200');
  currentSortSettings = { active: this.getSavedSort('active') || 'name', direction: this.getSavedSort('direction') || 'asc' };
  private pageChangeSubject$ = new BehaviorSubject<{ pageIndex: number; pageSize: number }>({ pageIndex: 0, pageSize: parseInt(localStorage.getItem('co_accounts_pagination') || '200') });
  private sortChangeSubject$ = new BehaviorSubject<{ active: string; direction: 'asc' | 'desc' | '' }>({ active: this.getSavedSort('active') || 'name', direction: this.getSavedSort('direction') || 'asc' });
  private isCurrentlySorting = false;
  
  // Local page size management
  private pageSizeSubject = new BehaviorSubject<number>(
    parseInt(localStorage.getItem('co_accounts_pagination') || '200')
  );
  public pageSize$ = this.pageSizeSubject.asObservable();
  
  // Local page index management
  private pageIndexSubject = new BehaviorSubject<number>(0);
  public pageIndex$ = this.pageIndexSubject.asObservable();
  
  
  // Table configuration
  columns = [
    { header: 'Actions', field: 'actions', width: '50px' },
    { header: 'Name', field: 'name', sortable: true, class: 'name' },
    { header: 'Email', field: 'email', sortable: true },
    { header: 'Permission', field: 'permission_name', sortable: true },
    { header: 'Created On', field: 'created_on', sortable: true },
    { header: 'Last Login', field: 'last_login', sortable: true },
  ];

  // Mtx-grid row selection checkbox options
  multiSelectable = false;
  rowSelectable = false;
  hideRowSelectionCheckbox = true;

  // Mtx-grid column move and hide options
  columnHideable = true;
  columnMovable = true;
  columnHideableChecked: 'show' | 'hide' = 'show';

  // Pagination
  @Select(CustomSelectors.GetConfigProperty('co_accounts_pagination'))
  accountsPagination$: Observable<string>;

  // Creates a source for the data
  tableValues = new BehaviorSubject<MatTableDataSource<any>>(
    new MatTableDataSource<any>([])
  );

  // Data stream for mtx-grid - now using store data
  data$: Observable<any>;
  
  // Store data management
  @Select(CustomSelectors.GetConfigProperty('co_accounts_data'))
  accountsData$: Observable<any[]>;

  ngOnInit() {
    this.log.msg('1', '🚀 INITIALIZING ACCOUNTS COMPONENT', 'accounts', {
      initialPageSize: this.currentPageSize,
      initialPageIndex: this.currentPageIndex,
      localStorageValue: localStorage.getItem('co_accounts_pagination')
    });
    
    // Initialize pagination from store (but don't override localStorage)
    this.accountsPagination$.subscribe(value => {
      // Only update if localStorage doesn't have a value
      const savedValue = localStorage.getItem('co_accounts_pagination');
      if (!savedValue) {
        localStorage.setItem('co_accounts_pagination', value);
        this.pageSizeSubject.next(parseInt(value) || 25);
        this.log.msg('1', '📝 Updated pageSize from store:', 'accounts', value);
      }
    });

    // Load column settings
    this.getSavedColumnSettings();


    // Data stream for mtx-grid - server-side pagination and sorting
    const serverSideData$ = combineLatest([
      this.search.valueChanges.pipe(
        startWith(''),
        map(value => (typeof value === 'string' ? value : '')),
        debounceTime(200),
        distinctUntilChanged()
      ),
      this.pageChangeSubject$.pipe(
        distinctUntilChanged((previousPage, currentPage) => previousPage.pageIndex === currentPage.pageIndex && previousPage.pageSize === currentPage.pageSize)
      ),
      this.sortChangeSubject$.pipe(
        distinctUntilChanged((previousSort, currentSort) => previousSort.active === currentSort.active && previousSort.direction === currentSort.direction)
      ),
      this.pageSize$.pipe(distinctUntilChanged()),
      this.refreshTrigger$.pipe(startWith(null))
    ]).pipe(
      switchMap(([searchTerm, pageEvent, sortEvent, pageSize, refreshTrigger]) => {
        this.log.msg('1', '🚀 DATA STREAM TRIGGERED', 'accounts', { 
          searchTerm, 
          pageEvent, 
          pageSize, 
          refreshTrigger,
          currentPageSize: this.currentPageSize,
          currentPageIndex: this.currentPageIndex
        });
        
        // reset to first page on search or page size change
        if (searchTerm !== this.currentSearch) {
          this.log.msg('1', '🔍 SEARCH CHANGED - resetting to page 1', 'accounts', { oldSearch: this.currentSearch, newSearch: searchTerm });
          this.currentPageIndex = 0;
          this.pageIndexSubject.next(0);
        }
        // Reset to first page when page size changes
        if (this.currentPageSize !== pageEvent?.pageSize) {
          this.log.msg('1', '📏 PAGE SIZE CHANGED - resetting to page 1', 'accounts', { oldSize: pageEvent?.pageSize, newSize: this.currentPageSize });
          this.currentPageIndex = 0;
          this.pageIndexSubject.next(0);
        }
        this.currentSearch = searchTerm;
        const apiPageNumber = this.currentPageIndex + 1; // API is 1-based
        const apiPageSize = this.currentPageSize; // Use the current page size directly
        const sortOrdering = sortEvent?.direction === 'desc' ? `-${sortEvent?.active}` : sortEvent?.active;
        
        this.log.msg('1', '🌐 FETCHING ACCOUNTS - API call params:', 'accounts', { page: apiPageNumber, size: apiPageSize, search: searchTerm, ordering: sortOrdering });
        if (!this.isCurrentlySorting) this.isLoading$.next(true);
        return this.fetchAccountsPage({ page: apiPageNumber, size: apiPageSize, search: searchTerm, ordering: sortOrdering }).pipe(
          map(apiResponse => {
            this.totalAccounts = apiResponse.count || 0;
            this.isLoading$.next(false);
            
            // TEMPORARY FIX: Backend ignores page_size, so we slice the results on frontend
            const requestedPageSize = this.currentPageSize;
            const fullApiResponse = apiResponse.results || [];
            const paginatedResults = fullApiResponse.slice(0, requestedPageSize);

          // Immediately reflect locally removed rows (without extra network calls)
          const visibleResults = paginatedResults.filter((account: any) => !this.locallyRemovedAccountIds.has(String(account.user_id)));
          const removedOnThisPage = paginatedResults.length - visibleResults.length;
            
            this.log.msg('1', '📥 API RESPONSE RECEIVED', 'accounts', { 
              totalCount: apiResponse.count, 
              fullApiResponseLength: fullApiResponse.length,
              requestedPageSize: requestedPageSize,
            paginatedResultsLength: paginatedResults.length,
            visibleAfterLocalRemovals: visibleResults.length,
              pageSize: apiPageSize,
              page: apiPageNumber,
              currentPageSize: this.currentPageSize,
              currentPageIndex: this.currentPageIndex,
              backendIgnoresPageSize: fullApiResponse.length !== requestedPageSize
            });
            
            return {
              rows: visibleResults, // Hide rows removed locally
              // Adjust total minimally to force UI refresh without extra XHR
              total: Math.max(0, (apiResponse.count || 0) - removedOnThisPage)
            };
          }),
          catchError(err => {
            this.log.msg('0', 'Server pagination error:', 'accounts', err);
            this.isLoading$.next(false);
            return of({ rows: [], total: 0 });
          })
        );
      })
    );

    // Combine with locally removed ids and modified accounts to update rows instantly without refetching
    this.data$ = combineLatest([serverSideData$, this.removedAccountIds$, this.modifiedAccounts$]).pipe(
      map(([serverData, removedAccountIds, modifiedAccounts]) => {
        // First filter out removed accounts
        let visibleRows = (serverData?.rows || []).filter((account: any) => !removedAccountIds.has(String(account.user_id)));
        
        // Then apply local modifications
        visibleRows = visibleRows.map((account: any) => {
          const accountId = String(account.user_id);
          return modifiedAccounts.has(accountId) ? modifiedAccounts.get(accountId) : account;
        });
        
        return {
          rows: visibleRows,
          total: serverData?.total || 0
        };
      })
    );

    // React to WebSocket-driven account changes without full reload
    this.actions$
      .pipe(ofActionDispatched(Accounts.RemoveAccount))
      .subscribe((action: Accounts.RemoveAccount) => {
        this.log.msg('1', '🔔 WS Account removed → updating table locally', 'accounts', { accountId: action.account_id });
        
        // Track locally to hide row instantly
        if (action && action.account_id !== undefined && action.account_id !== null) {
          this.locallyRemovedAccountIds.add(String(action.account_id));
          // emit new reference so UI updates without triggering network
          this.removedAccountIdsSubject.next(new Set(this.locallyRemovedAccountIds));
        }

        // Update total count and trigger change detection
        this.totalAccounts = Math.max(0, this.totalAccounts - 1);
        this.cdr.detectChanges();
      });

    this.actions$
      .pipe(ofActionDispatched(Accounts.AddAccount))
      .subscribe((action: Accounts.AddAccount) => {
        this.log.msg('1', '🔔 WS Account added → updating table locally', 'accounts', { account: action.account });
        
        // Update total count and trigger change detection
        this.totalAccounts += 1;
        this.cdr.detectChanges();
      });

    this.actions$
      .pipe(ofActionDispatched(Accounts.ModifyAccount))
      .subscribe((action: Accounts.ModifyAccount) => {
        this.log.msg('1', '🔔 WS Account modified → updating table locally', 'accounts', { account: action.account });
        
        // Track locally to update row instantly
        if (action.account && action.account.user_id !== undefined && action.account.user_id !== null) {
          this.locallyModifiedAccounts.set(String(action.account.user_id), action.account);
          // emit new reference so UI updates without triggering network
          this.modifiedAccountsSubject.next(new Map(this.locallyModifiedAccounts));
        }
        
        this.cdr.detectChanges();
      });
  }

  // Cached page size options to avoid recalculation
  private _cachedPageSizeOptions: number[] | null = null;
  private _lastTotalAccounts = 0;




  // Calculate dynamic page size options based on total accounts
  getPageSizeOptions() {
    // Only recalculate if total accounts changed
    if (this._cachedPageSizeOptions && this._lastTotalAccounts === this.totalAccounts) {
      return this._cachedPageSizeOptions;
    }

    const baseOptions = [10, 25, 50, 100, 200, 500, 1000];
    
    if (this.totalAccounts > 0) {
      // Calculate a smart max size based on total accounts (same logic as setOptimalPageSize)
      let maxSize: number;
      
      if (this.totalAccounts <= 100) {
        maxSize = this.totalAccounts;
      } else if (this.totalAccounts <= 500) {
        maxSize = Math.ceil(this.totalAccounts / 50) * 50;
      } else if (this.totalAccounts <= 1000) {
        maxSize = Math.ceil(this.totalAccounts / 100) * 100;
      } else if (this.totalAccounts <= 2000) {
        maxSize = Math.ceil(this.totalAccounts / 200) * 200;
      } else {
        maxSize = Math.ceil(this.totalAccounts / 500) * 500;
      }
      
      // Cap at 2000
      maxSize = Math.min(maxSize, 2000);
      
      // Only add if it's not already in the base options and is reasonable
      if (!baseOptions.includes(maxSize) && maxSize <= 2000) {
        this.log.msg('4', 'Dynamic max page size:', 'accounts', maxSize);
        this._cachedPageSizeOptions = [...baseOptions, maxSize];
        this._lastTotalAccounts = this.totalAccounts;
        return this._cachedPageSizeOptions;
      }
    }
    
    this._cachedPageSizeOptions = baseOptions;
    this._lastTotalAccounts = this.totalAccounts;
    return this._cachedPageSizeOptions;
  }


  // Server-side: fetch one page
  private fetchAccountsPage(params: { page: number; size: number; search: string; ordering: string }) {
    const apiQueryParams: any = { page: params.page, size: params.size };
    if (params.search && params.search.trim()) apiQueryParams.search = params.search.trim();
    if (params.ordering && params.ordering.trim()) apiQueryParams.ordering = params.ordering.trim();
    this.log.msg('1', '🔗 API CALL - Final query params:', 'accounts', apiQueryParams);
    this.log.msg('1', '🔗 API CALL - Full URL:', 'accounts', `${this._api.api}accounts/`);
    
    // Try different parameter names to see which one the backend expects
    const alternativeParams = { ...apiQueryParams, limit: params.size };
    this.log.msg('1', '🧪 TESTING - Alternative params with limit:', 'accounts', alternativeParams);
    
    return this._http.get<any>(`${this._api.api}accounts/`, { params: apiQueryParams }).pipe(
      tap(response => {
        this.log.msg('1', '🔍 BACKEND RESPONSE ANALYSIS:', 'accounts', {
          requestedPageSize: params.size,
          actualResultsLength: response.results?.length,
          totalCount: response.count,
          isPageSizeRespected: response.results?.length === params.size
        });
      })
    );
  }

  // Check if focused on input or textarea
  onInputFocus() {
    this.inputFocusService.setInputFocus(true);
  }

  onInputBlur() {
    this.inputFocusService.setInputFocus(false);
  }

  /**
   * Stores the accounts page size on change
   * @returns new Configuration of co_accounts_pagination
   */
  storePagination(event) {
    this.log.msg(
      '1',
      '🔄 STORE PAGINATION CALLED',
      'accounts',
      { 
        oldPageSize: this.currentPageSize, 
        newPageSize: event.pageSize, 
        oldPageIndex: this.currentPageIndex,
        newPageIndex: event.pageIndex 
      }
    );
    
    // Update local page size and persist to localStorage
    this.currentPageSize = event.pageSize;
    this.pageSizeSubject.next(event.pageSize);
    localStorage.setItem('co_accounts_pagination', String(event.pageSize));
    
    // Reset to first page when page size changes
    this.currentPageIndex = 0;
    this.pageIndexSubject.next(0);
    this.pageChangeSubject$.next({ pageIndex: 0, pageSize: event.pageSize });
    
    this.log.msg('1', '📊 AFTER UPDATE - currentPageSize:', 'accounts', this.currentPageSize);
    this.log.msg('1', '📊 AFTER UPDATE - currentPageIndex:', 'accounts', this.currentPageIndex);
    
    // Force data refresh by triggering the data stream
    this.refreshTrigger$.next();
    
    // Force change detection
    this.cdr.detectChanges();
    
    this.log.msg('1', '✅ STORE PAGINATION COMPLETED', 'accounts', 'Data refresh triggered');
    
    return this._store.dispatch(
      new Configuration.SetProperty(
        'co_accounts_pagination',
        event.pageSize,
        true
      )
    );
  }


  /**
   * Saves current column settings to localstorage
   * @param event Column settings array
   */
  saveColumnSettings(event) {
    this.log.msg('4', 'Saving column settings...', 'accounts', event);

    // add missing keys for next reload
    event.forEach(column => {
      const defaultProperties = this.columns.find(
        defaultColumn => defaultColumn.header == column.label
      );
      Object.assign(column, defaultProperties, { hide: !column.show });
    });
    
    localStorage.setItem('co_accounts_table_columns_v2', JSON.stringify(event));
    this.columns = event;
  }

  /**
   * Gets column settings from localstorage or
   * a default value if localstorage return null or undefined.
   */
  getSavedColumnSettings() {
    this.log.msg('4', 'Getting saved column settings...', 'accounts');
    const savedColumns = localStorage.getItem('co_accounts_table_columns_v2');
    this.columns = savedColumns ? JSON.parse(savedColumns) : this.columns;
  }


  /**
   * Edit account action
   * @param account The account to edit
   */
  editAccount(account: any) {
    this.log.msg('4', 'Editing account...', 'accounts', account);
    this._dialog
      .open(ModifyUserComponent, {
        disableClose: true,
        panelClass: 'modify-user-panel',
        data: {
          account: {
            ...account,
          },
        },
      })
      .afterClosed()
      .pipe(
        filter(acc => !!acc)
      )
      .subscribe(updatedAccount => {
        // Show success message immediately
        this._snack.open('Account updated successfully!', 'OK');
        
        // Update table locally immediately (optimistic update)
        if (updatedAccount && updatedAccount.user_id !== undefined && updatedAccount.user_id !== null) {
          this.locallyModifiedAccounts.set(String(updatedAccount.user_id), updatedAccount);
          // emit new reference so UI updates immediately
          this.modifiedAccountsSubject.next(new Map(this.locallyModifiedAccounts));
        }
        
        // Make API call in background
        this._store.dispatch(new Accounts.ModifyAccount(updatedAccount));
        
        // Update store data immediately (optimistic update)
        this.updateStoreData();
      });
  }

  /**
   * Delete account action
   * @param account The account to delete
   */
  deleteAccount(account: any) {
    this.log.msg('4', 'Deleting account...', 'accounts', account);
    this._dialog
      .open(AreYouSureDialog, {
        data: {
          title: 'translate:you_sure.delete_item_title',
          description: 'translate:you_sure.delete_item_desc',
        } as AreYouSureData,
        autoFocus: true,
      })
      .afterClosed()
      .subscribe(answer => {
        if (answer) {
          // Show success message immediately
          this._snack.open('Account removed successfully!', 'OK');
          
          // Update store data immediately (optimistic update)
          this.removeFromStoreData(account.user_id);
          // Hide row instantly
          if (account && account.user_id !== undefined && account.user_id !== null) {
            this.locallyRemovedAccountIds.add(String(account.user_id));
            // emit new reference so UI updates immediately
            this.removedAccountIdsSubject.next(new Set(this.locallyRemovedAccountIds));
          }
          
          // Make API call in background
          this._api.deleteAccount(account.user_id).subscribe(
            res => {
              if (res.success) {
                this._store.dispatch(
                  new Accounts.RemoveAccount(account.user_id)
                );
              } else {
                this._snack.open('Failed to delete account', 'OK');
                // Revert optimistic update on failure
                this.refreshTrigger$.next();
              }
            },
            err => {
              this._snack.open('An error occurred', 'OK');
              // Revert optimistic update on failure
              this.refreshTrigger$.next();
            }
          );
        }
      });
  }

  // Update store data after edit
  private updateStoreData() {
    this.accountsData$.pipe(take(1)).subscribe(storeData => {
      if (storeData && storeData.length > 0) {
        this.log.msg('4', 'Updating store data after edit...', 'accounts');
        this._store.dispatch(
          new Configuration.SetProperty(
            'co_accounts_data',
            storeData,
            true
          )
        );
      }
    });
  }

  // Remove account from store data and update table locally
  private removeFromStoreData(userId: number) {
    this.accountsData$.pipe(take(1)).subscribe(storeData => {
      if (storeData && storeData.length > 0) {
        const updatedData = storeData.filter(account => account.user_id !== userId);
        this.log.msg('4', 'Removing account from store:', 'accounts', userId);
        this._store.dispatch(
          new Configuration.SetProperty(
            'co_accounts_data',
            updatedData,
            true
          )
        );
        
        // Update total count and trigger change detection
        this.totalAccounts = Math.max(0, this.totalAccounts - 1);
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Save sort settings to localStorage
   * @param event Looks something like this: {"active":"name","direction":"asc"}
   */
  saveSort(event) {
    this.log.msg('1', 'Saving chosen sort in localstorage...', 'accounts', event);
    localStorage.setItem('co_accounts_table_sort', JSON.stringify(event));
    // Update server-side sort state, avoid spinner flash
    this.isCurrentlySorting = true;
    this.sortChangeSubject$.next({ active: event.active, direction: event.direction || 'asc' });
    // small timeout to re-enable spinner if needed for subsequent actions
    setTimeout(() => (this.isCurrentlySorting = false), 200);
  }

  // Handle sort change from mtx-grid (frontend sort)
  onSortChange(event: Sort) {
    this.log.msg('4', 'Sort change from mtx-grid:', 'accounts', event);
    this.saveSort({
      active: event.active,
      direction: event.direction
    });
  }

  /**
   * Gets the key from already saved sort value from localstorage or
   * a default value if localstorage return null or undefined.
   * @param key can be 'active' (Field Name) or 'direction' (Sort)
   * @returns Field Name or Sort Direction depending on the key value
   */
  getSavedSort(key) {
    const savedSort = JSON.parse(
      localStorage.getItem('co_accounts_table_sort') || 
      '{"active":"name","direction":"asc"}'
    );
    return savedSort[key];
  }

}
