
interface Test {
    ID: number;
    date: string;
    total_test: number;
    ok: number;
    nok: number;
    skipped: number;
    time: number;
    pixel_difference: number;
    browser: string;
    executing?: boolean;
}

interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

interface Subscription {
    id: number;
    name: string;
    cloud: string;
    price_hour: string;
    fee: string;
    active?: boolean;
}

interface FlatIconItem {
    name: string;
    author: string;
    link: string;
}

interface Step {
    id: number;
    name: string;
    steps: number;
    result: boolean;
    time: number;
    pixel_difference: number;
    test_id: number;
}

interface Browser {
    browser_id: number;
    browser_name: string;
}

// Features

interface FeatureRequirements {
    environment?: any;
    app?: any;
    feature_id?: any;
    browser_id?: number;
    departament_id?: number;
    page?: number;
    page_size?: number;
    ordering?: string;
    feature_result_id?: number;
}

interface FeatureResult {
    executing?: boolean;
    archived: boolean;
    feature_result_id: number;
    feature_id: number;
    result_date: string;
    feature_name: string;
    description?: string;
    app_id: number;
    app_name: string;
    environment_id: number;
    environment_name: string;
    departament_name: string;
    browser: BrowserstackBrowser;
    total: number;
    fails: number;
    ok: number;
    running: boolean;
    skipped: number;
    execution_time: number | string;
    pixel_diff: number;
    success_rate: number;
    success?: boolean;
    screen_style: string;
    screen_actual: string;
    screen_diff: string;
    log?: string;
    total_executions?: number;
    video_url?: string;
    status: string;
    files: string[];
}

// Create feature

interface CreateFeatureRequirements {
    feature_id: number;
    result_date: string;
    feature_name: string;
    app_id: number;
    app_name: string;
    environment_id: number;
    environment_name: string;
    departament_id: number;
    departament_name: string;
    browser_id: string;
    browser_name: string;
    total: number;
    fails: number;
    ok: number;
    skipped: number;
    execution_time: number;
    pixel_diff: number;
    success_rate: number;
    screen_style: string;
    screen_actual: string;
    screen_diff: string;
}

// Tests Results

interface StepRequirements {
    page?: number;
    page_size?: number;
}

interface StepResult {
    belongs_to?: BelongsTo;
    step_result_id: number;
    feature_result_id: number;
    step_name: string;
    execution_time: number;
    pixel_diff: number;
    success: boolean;
    screenshot?: boolean;
    compare?: boolean;
    template_name?: string;
    screenshots?: Screenshots;
    previous: null | number;
    next: null | number;
    status: string;
    files: string[];
    screenshot_current: string;
    screenshot_style: string;
    screenshot_difference: string;
    screenshot_template: string;
}

interface BelongsTo {
    feature_id: number;
    feature_name: string;
}

type ScreenshotType = 'current' | 'template' | 'difference' | 'style';

type Screenshots = {
    [type in ScreenshotType]: string;
};

interface PageRequirements {
    page?: number;
    page_size?: number;
    ordering?: string;
    app?: any;
    environment?: any;
    feature_id?: number;
}

// Environments

interface Environment {
    environment_id: number;
    environment_name: string;
}

// Features

interface Feature {
    feature_id: number;
    feature_name: string;
    app_id: number;
    app_name: string;
    description?: string;
    environment_id: number;
    environment_name: string;
    department_id: number;
    department_name: string;
    steps: number;
    browser_code: string;
    browser_name: string;
    schedule: string;
    success?: boolean;
    screenshot: string;
    compare: string;
    info?: FeatureResult;
    depends_on_others?: boolean;
    feature_runs: FeatureRun[];
    feature_results?: FeatureResult[];
    browsers: BrowserstackBrowser[];
    cloud: string;
    send_mail: boolean;
    send_mail_on_error: boolean;
    email_address: string[];
    email_subject: string;
    email_body: string;
    folder_id?: number;
    last_edited: IAccount;
    last_edited_date?: string;
    created_by: number;
    video: boolean;
    steps_content?: FeatureStep[];
    continue_on_failure?: boolean;
    need_help: boolean;
    current_folder_id?: number;
}

interface FeatureRun {
    run_id: number;
    feature_results: FeatureResult[];
    date_time: string;
    archived: boolean;
    status: string;
    total: number;
    fails: number;
    ok: number;
    skipped: number;
    execution_time: number;
    pixel_diff: number;
}

// Applications

interface Application {
    app_id: number;
    app_name: string;
}

// Browsers

interface BrowserResultObject {
    browser_id: number;
    browser_json: BrowserstackBrowser;
}

interface BrowserResult {
    browser_id: number;
    browser_name: string;
}

// Departments

interface Department {
    department_id: number;
    department_name: string;
    files?: [],
    slug?: string;
    settings?: any;
    users?: IAccount[];
}

// Steps

interface CreateStepRequirements {
    feature_id: number;
    step_name: string;
}

// Array of steps

interface StepGroup {
    group_name: string;
    group_content: string[];
    group_template: string;
}

// Action object

interface Action {
    action_id: number;
    action_name: string;
    department: string;
    application: string;
    date_created: string;
    values: number;
    description: string;
    screenshot?: boolean;
    compare?: boolean;
    text?: string;
    interpreted?: string;
}

// Send Feature Information

interface SendFeature {
    feature_name: string;
    app_id: number;
    app_name: string;
    description: string;
    environment_id: number;
    environment_name: string;
    browser_id: number;
    browser_name: string;
    browser_code: string;
    department_id: number;
    department_name: string;
    steps: number;
    schedule: string;
    steps_content: GroupContent[];
    wait: boolean;
    browsers: BrowserstackBrowser[];
    cloud: string;
    depends_on_other: boolean;
    send_mail: boolean;
    email_address: string[];
    email_subject: string;
    email_body: string;
    last_edited: number;
    video: boolean;
}

interface GroupContent {
    group_name: string;
    group_content: FeatureStep[];
    group_template: string;
    screenshots: number[];
    compares: number[];
}

interface FeatureStep {
    id?: number;
    step_content: string;
    step_keyword: string;
    screenshot?: boolean;
    compare?: boolean;
    enabled?: boolean;
    error?: string;
    step_type?: StepType;
    continue_on_failure?: boolean;
    timeout?: number;
}

declare type StepType = 'normal' | 'subfeature' | 'substep' | 'loop';

interface GroupContentObject {
    screenshot?: boolean;
    compare?: boolean;
    text?: string;
    action_id: number;
    values: number;
}

interface Schedule {
    day_month: number | string;
    month: number | string;
    day_week: number | string;
    hour: number | string;
    minute: number | string;
}

interface Success {
    success: boolean;
    error?: string;
    /** If true or setted it means any error is already handled by an interceptor */
    handled?: boolean;
    results?: any;
    sessionId?: string;
    url?: string;
    action?: string;
}

interface DiffResponse extends Success {
    diff: string;
}

interface UserInfo {
    comment: string;
    created_on?: IAccount['created_on'];
    last_login?: IAccount['last_login'];
    success?: boolean;
    error?: string;
    user_id?: number;
    name?: string;
    email?: string;
    departments?: Department[];
    favourite_browsers?: string;
    settings?: any;
    user_permissions?: UserPermissions;
    permissions?: string[];
    clouds?: Cloud[];
    step_keywords?: string[];
    /** Contains the AES Encryption prefix, used to know if a variable contains an encrypted value */
    encryption_prefix?: string;
    integration_apps?: string[];
    requires_payment?: boolean;
    subscriptions?: Subscription[];
    feedback_mail?: string;
}

type EditMode = 'new' | 'edit' | 'clone';


interface UserPermissions {
    create_account: boolean;
    create_application: boolean;
    create_browser: boolean;
    create_department: boolean;
    create_environment: boolean;
    create_feature: boolean;
    delete_account: boolean;
    delete_application: boolean;
    delete_browser: boolean;
    delete_department: boolean;
    delete_environment: boolean;
    delete_feature: boolean;
    edit_account: boolean;
    edit_application: boolean;
    edit_browser: boolean;
    edit_department: boolean;
    edit_environment: boolean;
    edit_feature: boolean;
    permission_id: number;
    permission_name: UserPermissionType;
    remove_feature_result: boolean;
    remove_feature_runs: boolean;
    remove_screenshot: boolean;
    run_feature: boolean;
    view_accounts: boolean;
    view_feature: boolean;
    view_admin_panel: boolean;
    view_accounts_panel: boolean;
    view_applications_panel: boolean;
    view_browsers_panel: boolean;
    view_departments_panel: boolean;
    view_environments_panel: boolean;
    view_features_panel: boolean;
    create_variable: boolean;
    edit_variable: boolean;
    delete_variable: boolean;
}

declare enum UserPermissionType {
    DEVOP = 'DEVOP',
    ANALYSIS = 'ANALYSIS',
    SUPERUSER = 'SUPERUSER'
}

interface IAccount {
    user_id: number;
    name: string;
    email: string;
    departments: number[];
    created_on?: string;
    last_login?: string;
    user_permissions?: UserPermissions;
    permission_name?: string;
}

interface SendSaveFeature {
    feature_id: number;
    steps: any;
    description: string;
    environment_id: number;
    environment_name: string;
    app_id: number;
    app_name: string;
    department_id: number;
    department_name: string;
    depends_on_other: boolean;
    cloud: string;
    browsers: BrowserstackBrowser[];
    send_mail: boolean;
    email_address: string[];
    email_subject: string;
    email_body: string;
    send_mail_on_error: boolean;
    last_edited: number;
    video: boolean;
}

interface Config {
    version: string;
    language: string;
    reports: any;
    percentMode: boolean;
    delay: number;
    internal: InternalOptions;
    co_active_list: string; // Controls if the recent feature list is active or not
    co_features_pagination: number; // Stores the amount of items to show per page
    co_first_time_cometa: boolean; // Checks wether the use has already seen the welcome page or not
    openedMenu: boolean;
    heartbeat: number;
    scenario: string;
    contacts: any[];
    openedSidenav: boolean;
    openedSearch: boolean;
    useNewDashboard: boolean;
	sorting: string;
	reverse: boolean;
    copyright: string;
    license: string;
    featuresView: FeatureViewItems;
    disableAnimations: boolean;
    translations: 'en' | 'de' | any;
    changelog: ChangelogItem[];
    appTitle: string;
    pagination: IPagination;
    filters: Filter[];
    languageCodes: any;
    toggles: Toggles;
    flaticon: FlatIconItem[];
    serverInfo: ServerInfo;
    logWebsockets: boolean;
    welcomeSentences: string[];
    websocketsTimeout: number;
    tableHeaders: ResultHeader[];
    deleteTemplateWithResults: boolean;
}

interface FeatureViewItems {
    [view: string]: FeatureViewTypes;
}

type FeatureViewTypes = 'tiles' | 'list';

interface ResultHeader {
    enable: boolean;
    id: string;
    disabled: boolean;
}

interface ChangelogItem {
    version: string;
    date?: string;
    text?: string[];
    bugfixes?: string[];
    features?: ChangelogNewFeature[];
}

interface ChangelogNewFeature {
    title?: string;
    description: string;
    text?: string; // Backwards compatibility
}

interface InternalOptions {
    openedMenu: boolean;
    showArchived: boolean;
}

interface ServerInfo {
    version: string;
}

interface Toggles {
    hideInformation: boolean;
    hideBrowsers: boolean;
    hideUploadedFiles: boolean;
    hideSteps: boolean;
    hideSchedule: boolean;
    hideSendMail: boolean;
}

interface UploadedFile {
    created_on?: string,
    id?: number,
    md5sum?: string,
    mime?: string,
    name?: string,
    department?: string,
    size?: number,
    type?: string,
    is_removed?: boolean;
    uploadPath?: string,
    uploaded_by?: Uploader,
    error?: FileUploadError,
    status?: 'Unknown' | 'Processing' | 'Scanning' | 'Encrypting' | 'Done' | 'Error'
}

interface Uploader {
    email?: string,
    name?: string,
    user_id?: number
}

interface FileUploadError {
    description?: string,
    status?: string;
}
interface FileAction {
    icon: string;
    tooltip: string;
}

interface LiveStep {
    id: number;
    name: string;
    state: 'static' | 'current' | 'failed' | 'success';
}

interface OIDCUserInfo {
    userinfo: OIDCUserData;
}

interface OIDCUserData {
    sub: String;
    name: string;
    given_name: String;
    family_name: String;
    picture: String;
    email: string;
    email_verified: Boolean;
    locale: String;
}

interface BrowserstackBrowser {
    os: string;
    os_version: string;
    browser: string;
    device: string | null;
    browser_version: string;
    real_mobile: boolean | null;
    mobile_emulation?: boolean;
    mobile_width?: number;
    mobile_height?: number;
    mobile_pixel_ratio?: number;
    mobile_user_agent?: string;
}

interface BrowserstackBrowsersResponse {
    success: boolean;
    results: BrowserstackBrowser[];
}

interface Filter {
    id: string;
    value?: number | string;
    title: string;
    text: string;
    rangeText?: string;
    range1?: string;
    range2?: string;
    date?: string;
    more?: string;
    sign?: string;
    text_copy: string;
}

interface Folder {
    folder_id: number;
    folders: Folder[];
    features: number[];
    name: string;
    owner: number;
    parent_id?: number;
    department?: number;
    type?: 'department' | 'folder' | 'home';
    current_folder_id?: number;
    route: Folder[];
}

interface FoldersResponse {
    folders: Folder[];
    features: number[];
}

/**
 * 21/11/09 - Added two new variables as they are needed to know the destination department
 */
interface SelectedFolder {
    type: Folder['type'];
    id: number;
    name: string;
    department: number;
}

interface AccountRole {
    account_role_id: number;
    user: number;
    department: number;
}

interface VariablePair {
    variable_name: string;
    variable_value: string;
    encrypted: boolean;
    id?: number;
    department: Department;
    environment: Environment;
}

interface Cloud {
    id: number;
    name: string;
    active: boolean;
}

interface IEditFeature {
    mode: EditMode;
    feature?: Feature;
    steps?: FeatureStep[];
    info?: Feature;
}

interface CategorySelection {
    os: string;
    os_version: string;
}

interface SubscriptionLike {
    unsubscribe(): void;
}

interface IDepartments {
    admin: Department[];
    users: Department[];
}

interface IFeatureResultsState {
    comment: string;
    [result_id: number]: FeatureResult;
}

interface IFeaturesState {
    comment: string;
    /** Contains the detailed info of each feature in a [featureId: value] manner */
    details: IFeatureStateDetail;
    /** Contains the detailed info of each feature in a [featureId: value] manner */
    folderDetails: IFolderStateDetail;
    /** The current state of the more or less sign when adding a filter */
    moreOrLessSteps: string;
    /** Current navigation filters selected */
    filters: Filter[];
    /** Contains the folders and features structure of the root folder including descendants */
    folders: FoldersResponse;
    /** Contains the current navigated route */
    currentRoute: Partial<Folder>[];
    /** Contains the current navigated route used in the new landing*/
    currentRouteNew: Partial<Folder>[];
    /** Contains the filter for environments */
    environments: number[];
    /** Contains the filter for applications */
    applications: number[];
    /** Contains the filter for departments */
    departments: number[];
    /** Contains the string of what has to be searched */
    search: string;
}

interface ListItem {
    type: 'feature' | 'folder';
    info: ListItemInfo;
}

type ListItemInfo = Feature & Folder;

interface FeatureListItem {
    type: 'feature';
    info: Feature;
}

interface FolderListItem {
    type: 'folder';
    info: Folder;
}

interface PropertyBased<T> {
    [feature_id: number]: T;
}

interface IFeatureStateDetail {
    [feature_id: number]: Feature;
}

// Interface for the Folder State which contains the details of each folder
interface IFolderStateDetail {
    [folder_id: number]: Folder;
}
interface IResults {
    comment: string;
    [feature_id: number]: IResult;
    notification_ids: number[];
}

type Status = 'Success' | 'Failed' | '';

interface IResult {
    status: string;
    running: boolean;
    results: IResultContent;
    error?: string;
}

interface IResultContent {
    [run_id: number]: IBrowserResults;
}

interface IBrowserResults {
    [browser: string]: IBrowserResult;
}

interface IBrowserResult {
    browser_info: BrowserstackBrowser;
    status: string;
    start_at: string | null;
    end_at: Date | null;
    steps: StepStatus[];
    error?: string;
    details?: LiveStepSubDetail;
    feature_result_id?: number;
}

interface LiveStepSubDetail {
    [index: number]: string
}

interface ITimeoutSubscriptions {
    [key: string]: any;
}

interface StepStatus {
    index: number;
    name: string;
    running: boolean;
    success: boolean;
    step_time?: number;
    datetime?: string;
    error?: string;
    info?: StepResult;
    screenshots: any;
}

interface IRunsState {
    [feature_id: number]: FeatureRun[];
}

interface IScreenshotsState {
    [step_result_id: number]: string[];
}

interface IStepResultsState {
    [result_id: number]: Paginations<StepResult>;
}

interface Paginations<T> {
    [pagination_index: number]: PaginatedResponse<T>;
}

interface IStepDefinitionsState {
    comment: string;
    [feature_id: number]: FeatureStep[];
}

interface Log {
    log: string;
    success: boolean;
}

interface ILogsState {
    comment: string;
    [feature_result_id: number]: Log;
}

interface EditFeatureResponse {
    info: Feature;
    success: boolean;
}

interface LogChange {
    type: 'feature' | 'bugfix';
    title?: string;
    text: string;
}

type ClearRunsType = 'all' | 'all_failed' | 'all_except_last';

interface IPaginationsState {
    [paginationId: string]: Partial<IPagination>
}

interface IPaginatedListsState {
    [listId: string]: IPaginatedList;
}

interface IPaginatedList {
    [page: number]: any[];
}

interface IPagination {
    pageIndex: number;
    pageSize: number;
    id: string;
    data?: any
}

interface ILoadingsState {
    [id: string]: boolean;
}

interface ISearchState {
    newNovelForm: any;
}

interface Integration {
    id: number;
    department: Department;
    hook: string;
    description: string;
    send_on?: any;
    application: IntegrationType;
    created_on?: string;
}

interface IntegrationByDepartment {
    [dept: string]: Integration;
}

interface IntegrationPayload {
    department: number;
    hook: string;
    app: string;
}

type IntegrationType = 'Discord';

interface IEditFolder {
  mode: 'new' | 'edit';
  folder: Partial<Folder>;
}

interface IMoveData {
    type: 'folder' | 'feature';
    folder?: Folder;
    feature?: Feature;
}

interface SetSettingOptions {
    [key: string]: any;
}

interface UserDetails {
    usage_money?: number;
}

interface UsageInvoice {
    id: number;
    user: number;
    stripe_invoice_id: string;
    period_start: string;
    period_end: string;
    hours: number;
    total: number;
    cloud: number;
    status: string;
    created_on: string;
    modified_on: string;
    error: string;
}