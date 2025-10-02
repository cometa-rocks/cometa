import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Observable, timer, Subject, BehaviorSubject, of, forkJoin, merge, combineLatest } from 'rxjs';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { debounce, map, startWith, catchError, switchMap, take, tap } from 'rxjs/operators';
import { Sort } from '@angular/material/sort';
import { AsyncPipe, NgIf, NgClass, NgSwitch, NgSwitchCase, NgSwitchDefault, NgFor } from '@angular/common';
import { AccountComponent } from './account/account.component';
import { NetworkPaginatedListComponent } from '../../network-paginated-list/network-paginated-list.component';
import { DisableAutocompleteDirective } from '../../../directives/disable-autocomplete.directive';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { MatDividerModule } from '@angular/material/divider';
import { InputFocusService } from '@services/inputFocus.service';
import { MtxGridModule } from '@ng-matero/extensions/grid';
import { LetDirective } from '../../../directives/ng-let.directive';
import { TranslateModule } from '@ngx-translate/core';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { ApiService } from '@services/api.service';
import { LogService } from '@services/log.service';
import { Store, Select } from '@ngxs/store';
import { HttpClient } from '@angular/common/http';
import { Configuration } from '@store/actions/config.actions';
import { CustomSelectors } from '@others/custom-selectors';
import { MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { ModifyUserComponent } from '@dialogs/modify-user/modify-user.component';
import { ModifyPasswordComponent } from '@dialogs/modify-password/modify-password.component';
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
    MatLegacyFormFieldModule,
    MatLegacyInputModule,
    MatLegacyButtonModule,
    MatIconModule,
    MatLegacyTooltipModule,
    MatLegacyProgressSpinnerModule,
    MatLegacyCheckboxModule,
    MatLegacyMenuModule,
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
    private cdr: ChangeDetectorRef
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
  private currentAccounts: any[] = [];
  
  // Frontend sorting (like l1-feature-list)
  currentSearch = '';
  totalAccounts = 0;
  // Server-side pagination/sort state
  pageIndex = 0; // zero-based for UI
  currentPageSize = parseInt(localStorage.getItem('co_accounts_pagination') || '25');
  currentSort = { active: this.getSavedSort('active') || 'name', direction: this.getSavedSort('direction') || 'asc' };
  private pageChange$ = new BehaviorSubject<{ pageIndex: number; pageSize: number }>({ pageIndex: 0, pageSize: parseInt(localStorage.getItem('co_accounts_pagination') || '25') });
  private sortChange$ = new BehaviorSubject<{ active: string; direction: 'asc' | 'desc' | '' }>({ active: this.getSavedSort('active') || 'name', direction: this.getSavedSort('direction') || 'asc' });
  private isSorting = false;
  
  // Local page size management
  private pageSizeSubject = new BehaviorSubject<number>(
    parseInt(localStorage.getItem('co_accounts_pagination') || '25')
  );
  public pageSize$ = this.pageSizeSubject.asObservable();
  
  // Local page index management
  private pageIndexSubject = new BehaviorSubject<number>(0);
  public pageIndex$ = this.pageIndexSubject.asObservable();
  
  
  // Table configuration
  columns = [
    { header: 'Actions', field: 'actions' },
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
      initialPageIndex: this.pageIndex,
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
    this.data$ = combineLatest([
      this.search.valueChanges.pipe(
        startWith(''),
        map(value => (typeof value === 'string' ? value : '')),
        debounce(searchValue => (searchValue ? timer(300) : timer(0)))
      ),
      this.pageChange$,
      this.sortChange$,
      this.pageSize$,
      this.refreshTrigger$.pipe(startWith(null))
    ]).pipe(
      switchMap(([search, pageEvt, sortEvt, pageSize, refresh]) => {
        this.log.msg('1', '🚀 DATA STREAM TRIGGERED', 'accounts', { 
          search, 
          pageEvt, 
          pageSize, 
          refresh,
          currentPageSize: this.currentPageSize,
          currentPageIndex: this.pageIndex
        });
        
        // reset to first page on search or page size change
        if (search !== this.currentSearch) {
          this.log.msg('1', '🔍 SEARCH CHANGED - resetting to page 1', 'accounts', { oldSearch: this.currentSearch, newSearch: search });
          this.pageIndex = 0;
          this.pageIndexSubject.next(0);
          this.pageChange$.next({ pageIndex: 0, pageSize: this.currentPageSize });
        }
        // Reset to first page when page size changes
        if (this.currentPageSize !== pageEvt?.pageSize) {
          this.log.msg('1', '📏 PAGE SIZE CHANGED - resetting to page 1', 'accounts', { oldSize: pageEvt?.pageSize, newSize: this.currentPageSize });
          this.pageIndex = 0;
          this.pageIndexSubject.next(0);
          this.pageChange$.next({ pageIndex: 0, pageSize: this.currentPageSize });
        }
        this.currentSearch = search;
        const page = this.pageIndex + 1; // API is 1-based
        const size = this.currentPageSize; // Use the current page size directly
        const ordering = sortEvt?.direction === 'desc' ? `-${sortEvt?.active}` : sortEvt?.active;
        
        this.log.msg('1', '🌐 FETCHING ACCOUNTS - API call params:', 'accounts', { page, size, search, ordering });
        if (!this.isSorting) this.isLoading$.next(true);
        return this.fetchAccountsPageWithPagination({ page, size, search, ordering }).pipe(
          map(paginatedResponse => {
            this.totalAccounts = paginatedResponse.total || 0;
            this.isLoading$.next(false);
            
            this.log.msg('1', '📥 PAGINATED RESPONSE RECEIVED', 'accounts', { 
              totalCount: paginatedResponse.total, 
              resultsLength: paginatedResponse.rows.length,
              requestedPageSize: this.currentPageSize,
              currentPage: page,
              currentPageIndex: this.pageIndex
            });
            
            return paginatedResponse;
          }),
          catchError(err => {
            this.log.msg('0', 'Server pagination error:', 'accounts', err);
            this.isLoading$.next(false);
            return of({ rows: [], total: 0 });
          })
        );
      })
    );
  }

  // Cached page size options to avoid recalculation
  private _cachedPageSizeOptions: number[] | null = null;
  private _lastTotalAccounts = 0;


  // Filter accounts based on search term (frontend filtering)
  private filterAccounts(accountsList: any[], searchTerm: any): any[] {
    this.log.msg('4', 'Filtering accounts with searchTerm:', 'accounts', searchTerm);
    this.log.msg('4', 'SearchTerm type:', 'accounts', typeof searchTerm);
    
    // Convert searchTerm to string safely
    let normalizedSearchTerm = '';
    try {
      if (typeof searchTerm === 'string') {
        normalizedSearchTerm = searchTerm;
      } else if (searchTerm && typeof searchTerm === 'object') {
        if (Array.isArray(searchTerm) && searchTerm.length > 0) {
          normalizedSearchTerm = String(searchTerm[0]);
        } else if (searchTerm.value) {
          normalizedSearchTerm = String(searchTerm.value);
        } else {
          normalizedSearchTerm = JSON.stringify(searchTerm);
        }
      } else {
        normalizedSearchTerm = String(searchTerm || '');
      }
    } catch (error) {
      this.log.msg('0', 'Error converting searchTerm:', 'accounts', error);
      normalizedSearchTerm = '';
    }
    
    this.log.msg('4', 'Converted searchString:', 'accounts', normalizedSearchTerm);
    
    if (!normalizedSearchTerm || !normalizedSearchTerm.trim()) {
      this.log.msg('4', 'No search term, returning all accounts:', 'accounts', accountsList.length);
      return accountsList;
    }
    
    const searchQuery = normalizedSearchTerm.toLowerCase().trim();
    const filteredAccounts = accountsList.filter(account => 
      account.name?.toLowerCase().includes(searchQuery) ||
      account.email?.toLowerCase().includes(searchQuery) ||
      account.permission_name?.toLowerCase().includes(searchQuery)
    );
    
    this.log.msg('4', 'Filtered results:', 'accounts', filteredAccounts.length);
    return filteredAccounts;
  }

  // Set optimal page size based on total accounts
  private setOptimalPageSize() {
    if (this.totalAccounts <= 0) return;

    // Check if there's already a saved page size in localStorage
    const savedPageSize = parseInt(localStorage.getItem('co_accounts_pagination') || '0');
    
    // Respect any saved value, including 25. Only calculate if nothing is saved.
    if (savedPageSize > 0) {
      this.log.msg('4', 'Using saved page size:', 'accounts', savedPageSize);
      this.pageSizeSubject.next(savedPageSize);
      return;
    }

    let optimalPageSize: number;

    if (this.totalAccounts <= 100) {
      // For small datasets, show all
      optimalPageSize = this.totalAccounts;
    } else if (this.totalAccounts <= 500) {
      // For medium datasets, round up to nearest 50
      optimalPageSize = Math.ceil(this.totalAccounts / 50) * 50;
    } else if (this.totalAccounts <= 1000) {
      // For larger datasets, round up to nearest 100
      optimalPageSize = Math.ceil(this.totalAccounts / 100) * 100;
    } else if (this.totalAccounts <= 2000) {
      // For large datasets, round up to nearest 200
      optimalPageSize = Math.ceil(this.totalAccounts / 200) * 200;
    } else {
      // For very large datasets, round up to nearest 500
      optimalPageSize = Math.ceil(this.totalAccounts / 500) * 500;
    }

    // Cap at 2000 to avoid performance issues
    optimalPageSize = Math.min(optimalPageSize, 2000);

    this.log.msg('4', 'Setting optimal page size:', 'accounts', optimalPageSize);
    
    // Update the local page size subject
    this.pageSizeSubject.next(optimalPageSize);
    
    // Save to localStorage
    localStorage.setItem('co_accounts_pagination', optimalPageSize.toString());
  }

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

  // Function to get all accounts for frontend sorting (like l1-feature-list)
  private loadAllAccounts() {
    const startTime = performance.now();
    this.log.msg('4', '🚀 Loading all accounts for frontend sorting...', 'accounts');

    this.isLoading$.next(true);

    // First, get the first page to know the total count
    const params: any = {
      page: 1,
      page_size: 200 // Backend limit
    };

    if (this.currentSearch && this.currentSearch.trim()) {
      params.search = this.currentSearch;
    }

    this.log.msg('4', 'First page API params:', 'accounts', params);

    return this._http.get<any>(`${this._api.api}accounts/`, { params }).pipe(
      switchMap(firstPage => {
        this.log.msg('4', 'First page count:', 'accounts', firstPage.count);
        this.log.msg('4', 'First page results:', 'accounts', firstPage.results?.length || 0);

        if (!firstPage.next) {
          // Only one page, return immediately
          this.isLoading$.next(false);
          this.totalAccounts = firstPage.count || 0;
          this.setOptimalPageSize();
          
          return of({
            rows: firstPage.results || [],
            total: firstPage.count || 0
          });
        }

        // Calculate total pages needed
        const actualPageSize = firstPage.results?.length || 200;
        const totalPages = Math.ceil(firstPage.count / actualPageSize);
        this.log.msg('4', 'Total pages needed:', 'accounts', totalPages);

        // Create array of page requests for remaining pages
        const pageRequests: Observable<any>[] = [];
        for (let currentPage = 2; currentPage <= totalPages; currentPage++) {
          const currentPageParams = { ...params, page: currentPage };
          pageRequests.push(
            this._http.get<any>(`${this._api.api}accounts/`, { params: currentPageParams })
          );
        }

        // Fetch all remaining pages in parallel
        return forkJoin(pageRequests).pipe(
          map(additionalPages => {
            const loadTime = performance.now();
            this.log.msg('4', '⏱️ All pages loaded in:', 'accounts', `${(loadTime - startTime).toFixed(2)}ms`);

            // Combine all results
            let allResults = [...(firstPage.results || [])];
            additionalPages.forEach(page => {
              allResults = allResults.concat(page.results || []);
            });

            this.log.msg('4', 'Total results combined:', 'accounts', allResults.length);
            this.log.msg('4', 'Expected total:', 'accounts', firstPage.count);

            this.isLoading$.next(false);
            this.totalAccounts = firstPage.count || 0;
            this.setOptimalPageSize();

            return {
              rows: allResults,
              total: firstPage.count || 0
            };
          }),
          catchError(error => {
            this.log.msg('0', 'Load additional pages error:', 'accounts', error);
            this.isLoading$.next(false);
            return of({ rows: [], total: 0 });
          })
        );
      }),
      catchError(error => {
        this.log.msg('0', 'Load first page error:', 'accounts', error);
        this.isLoading$.next(false);
        return of({ rows: [], total: 0 });
      })
    );
  }

  // Server-side: fetch one page with proper pagination handling
  private fetchAccountsPageWithPagination(params: { page: number; size: number; search: string; ordering: string }) {
    const { page, size, search, ordering } = params;
    
    this.log.msg('1', '🔄 FETCHING PAGE WITH PAGINATION', 'accounts', { page, size, search, ordering });
    
    // First, get the first page to know the total count
    return this.fetchAccountsPage({ page: 1, size: 200, search, ordering }).pipe(
      switchMap(firstPageResponse => {
        const totalCount = firstPageResponse.count || 0;
        const backendPageSize = 200; // Backend's fixed page size
        const totalPages = Math.ceil(totalCount / backendPageSize);
        
        this.log.msg('1', '📊 PAGINATION CALCULATION', 'accounts', {
          totalCount,
          backendPageSize,
          totalPages,
          requestedPage: page,
          requestedSize: size
        });
        
        // Calculate which backend pages we need to fetch
        const startIndex = (page - 1) * size;
        const endIndex = startIndex + size;
        const startBackendPage = Math.floor(startIndex / backendPageSize) + 1;
        const endBackendPage = Math.floor((endIndex - 1) / backendPageSize) + 1;
        
        this.log.msg('1', '📄 BACKEND PAGES NEEDED', 'accounts', {
          startIndex,
          endIndex,
          startBackendPage,
          endBackendPage
        });
        
        // If we only need the first page, return it directly
        if (startBackendPage === 1 && endBackendPage === 1) {
          const startOffset = startIndex % backendPageSize;
          const endOffset = Math.min(endIndex, backendPageSize);
          const slicedResults = firstPageResponse.results?.slice(startOffset, endOffset) || [];
          
          return of({
            rows: slicedResults,
            total: totalCount
          });
        }
        
        // We need multiple backend pages
        const backendPagesToFetch: Observable<any>[] = [];
        for (let backendPage = startBackendPage; backendPage <= endBackendPage; backendPage++) {
          backendPagesToFetch.push(
            this.fetchAccountsPage({ page: backendPage, size: backendPageSize, search, ordering })
          );
        }
        
        return forkJoin(backendPagesToFetch).pipe(
          map(backendPages => {
            // Combine all results from backend pages
            const allBackendResults = [].concat(...backendPages.map((pageResponse: any) => pageResponse.results || []));
            
            // Slice to get the exact page we need
            const startOffset = startIndex % backendPageSize;
            const endOffset = startOffset + size;
            const finalResults = allBackendResults.slice(startOffset, endOffset);
            
            this.log.msg('1', '✅ PAGINATION COMPLETE', 'accounts', {
              totalBackendResults: allBackendResults.length,
              finalResultsLength: finalResults.length,
              requestedSize: size
            });
            
            return {
              rows: finalResults,
              total: totalCount
            };
          })
        );
      })
    );
  }

  // Server-side: fetch one page
  private fetchAccountsPage(params: { page: number; size: number; search: string; ordering: string }) {
    const apiQueryParams: any = { page: params.page, page_size: params.size };
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

  // Function to get all accounts by fetching all pages (DEPRECATED - keeping for compatibility)
  private getAllAccounts() {
    const startTime = performance.now();
    this.log.msg('4', '🚀 Starting accounts load...', 'accounts');
    
    return this._http.get<any>(`${this._api.api}accounts/?page_size=200`).pipe(
      switchMap(firstPage => {
        const firstPageTime = performance.now();
        this.log.msg('4', '⏱️ First page loaded in:', 'accounts', `${(firstPageTime - startTime).toFixed(2)}ms`);
        this.log.msg('4', 'First page count:', 'accounts', firstPage.count);  
        this.log.msg('4', 'First page results:', 'accounts', firstPage.results.length);
        
        if (!firstPage.next) {
          // Only one page, return immediately
          const totalTime = performance.now();
          this.log.msg('4', '✅ Single page load completed in:', 'accounts', `${(totalTime - startTime).toFixed(2)}ms`);
          return of({
            rows: firstPage.results,
            total: firstPage.count
          });
        }

        // Calculate total pages needed based on the ACTUAL page size returned by the backend (200)
        const actualPageSize = firstPage.results && firstPage.results.length > 0 ? firstPage.results.length : 200;
        const totalPages = Math.ceil(firstPage.count / actualPageSize);
        this.log.msg('4', 'Actual page size:', 'accounts', actualPageSize);
        this.log.msg('4', 'Total pages needed:', 'accounts', totalPages);

        // Create array of page requests
        const pageRequests: Observable<any>[] = [];
        for (let currentPage = 2; currentPage <= totalPages; currentPage++) {
          pageRequests.push(
            this._http.get<any>(`${this._api.api}accounts/?page=${currentPage}&page_size=${actualPageSize}`)
          );
        }

        // Fetch all remaining pages
        const additionalPagesStartTime = performance.now();
        this.log.msg('4', '🔄 Fetching additional pages...', 'accounts');
        
        return forkJoin(pageRequests).pipe(
          map(additionalPagesResponse => {
            const additionalPagesTime = performance.now();
            this.log.msg('4', '⏱️ Additional pages loaded in:', 'accounts', `${(additionalPagesTime - additionalPagesStartTime).toFixed(2)}ms`);
            this.log.msg('4', 'Additional pages fetched:', 'accounts', additionalPagesResponse.length);
            
            // Combine all results
            let allAccountsCombined = [...firstPage.results];
            additionalPagesResponse.forEach((pageResponse: any) => {
              allAccountsCombined = [...allAccountsCombined, ...pageResponse.results];
            });

            const totalTime = performance.now();
            this.log.msg('4', '✅ All accounts loaded in:', 'accounts', `${(totalTime - startTime).toFixed(2)}ms`);
            this.log.msg('4', 'Total accounts loaded:', 'accounts', allAccountsCombined.length);
            
            return {
              rows: allAccountsCombined,
              total: firstPage.count
            };
          })
        );
      })
    );

    // Keep the original URL stream for compatibility
    this.accountsUrl$ = this.search.valueChanges.pipe(
      startWith(this.search.value),
      debounce(searchEvent => {
        this.log.msg('4', 'Debounce triggered with value:', 'accounts', searchEvent);
        return searchEvent ? timer(300) : timer(0);
      }),
      map(search => {
        this.log.msg('4', 'Map triggered with search:', 'accounts', search);
        if (search) {
          const url = `accounts/?search=${search}`;
          this.log.msg('4', 'Search URL:', 'accounts', url);
          return url;
        } else {
          const url = `accounts/`;
          this.log.msg('4', 'Default URL:', 'accounts', url);
          return url;
        }
      })
    );

    // Test the API directly
    this.log.msg('4', 'Testing API directly...', 'accounts');
    this._api.getAccounts().subscribe(
      (response) => {
        this.log.msg('1', 'Direct API test successful', 'accounts', { count: response?.length || 0 });
      },
      (error) => {
        this.log.msg('0', 'Direct API test failed', 'accounts', error);
      }
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
        oldPageIndex: this.pageIndex,
        newPageIndex: event.pageIndex 
      }
    );
    
    // Update local page size and persist to localStorage
    this.currentPageSize = event.pageSize;
    this.pageSizeSubject.next(event.pageSize);
    localStorage.setItem('co_accounts_pagination', String(event.pageSize));
    
    // Reset to first page when page size changes
    this.pageIndex = 0;
    this.pageIndexSubject.next(0);
    this.pageChange$.next({ pageIndex: 0, pageSize: event.pageSize });
    
    this.log.msg('1', '📊 AFTER UPDATE - currentPageSize:', 'accounts', this.currentPageSize);
    this.log.msg('1', '📊 AFTER UPDATE - pageIndex:', 'accounts', this.pageIndex);
    
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

  // Remove account from store data
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
    this.isSorting = true;
    this.sortChange$.next({ active: event.active, direction: event.direction || 'asc' });
    // small timeout to re-enable spinner if needed for subsequent actions
    setTimeout(() => (this.isSorting = false), 200);
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
