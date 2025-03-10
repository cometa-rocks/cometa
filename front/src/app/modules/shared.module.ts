import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatLegacyTabsModule as MatTabsModule } from '@angular/material/legacy-tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatNativeDateModule } from '@angular/material/core';
import { MatLegacyRadioModule as MatRadioModule } from '@angular/material/legacy-radio';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyMenuModule as MatMenuModule } from '@angular/material/legacy-menu';
import { MatLegacySlideToggleModule as MatSlideToggleModule } from '@angular/material/legacy-slide-toggle';
import { MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatLegacyAutocompleteModule as MatAutocompleteModule } from '@angular/material/legacy-autocomplete';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { EnterValueComponent } from '@dialogs/enter-value/enter-value.component';
import { AddFolderComponent } from '@dialogs/add-folder/add-folder.component';
import { MatLegacySnackBarModule as MatSnackBarModule } from '@angular/material/legacy-snack-bar';
import { MatLegacyChipsModule as MatChipsModule } from '@angular/material/legacy-chips';
import { MatLegacyPaginatorModule as MatPaginatorModule } from '@angular/material/legacy-paginator';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { PlatformSortPipe } from '@pipes/platform-sort.pipe';
import { OfferTourComponent } from '@dialogs/offer-tour/offer-tour.component';
import { EditVariablesComponent } from '@dialogs/edit-variables/edit-variables.component';
import { ErrorDialog } from '@dialogs/error/error.dialog';
import { MAT_LEGACY_SNACK_BAR_DEFAULT_OPTIONS as MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/legacy-snack-bar';
import { MAT_LEGACY_DIALOG_DEFAULT_OPTIONS as MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/legacy-dialog';
import { NetworkPaginatedListComponent } from '@components/network-paginated-list/network-paginated-list.component';

/* Pipes */
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { FilterStepPipe } from '@pipes/filter-step.pipe';
import { TranslateNamePipe } from '@pipes/translate-name.pipe';
import { FormatVersionPipe } from '@pipes/format-version.pipe';
import { VersionSortPipe } from '@pipes/version-sort.pipe';
import { BrowserFavouritedPipe } from '@pipes/browser-favourited.pipe';
import { BrowserIconPipe } from '@pipes/browser-icon.pipe';
import { MobileIconPipe } from '@pipes/mobile-icon.pipe';
import { CheckSelectedBrowserPipe } from '@pipes/check-selected-browser.pipe';
import { CheckBrowserExistsPipe } from '@pipes/check-browser-exists.pipe';
import { BrowserResultStatusPipe } from '@pipes/browser-result-status.pipe';
import { AttachToDirective } from '@directives/attach-to.directive';
import { StoreSelectorPipe } from '../pipes/store-selector.pipe';
import { BrowserComboTextPipe } from '../pipes/browser-combo-text.pipe';
import { CheckDuplicatePipe } from '../pipes/check-duplicate.pipe';
import { PaginationPipe } from '@pipes/pagination.pipe';
import { FilterByPropertyPipe } from '@pipes/filter-by-property.pipe';
import { PercentagePipe } from '@pipes/percentage.pipe';
import { PercentageFieldPipe } from '@pipes/percentage-field.pipe';
import { LoadingPipe } from '@pipes/loading.pipe';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { HasPermissionPipe } from '../pipes/has-permission.pipe';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';
import { AddLatestPipe } from '../pipes/add-latest.pipe';
import { SafeUrlPipe } from '@pipes/safe-url.pipe';
import { HumanizeBytesPipe } from '@pipes/humanize-bytes.pipe';

/* Directives */
import { StopPropagationDirective } from '@directives/stop-propagation.directive';
import { LetDirective } from '@directives/ng-let.directive';
import { DisableAutocompleteDirective } from '@directives/disable-autocomplete.directive';

/* Snacks */
import { LoadingSnack } from '@components/snacks/loading/loading.snack';

/* Dialogs */
import { EmailTemplateHelp } from '@dialogs/edit-feature/email-template-help/email-template-help.component';
import { HtmlDiffDialog } from '@dialogs/html-diff/html-diff.component';
import { AreYouSureDialog } from '@dialogs/are-you-sure/are-you-sure.component';
import { EditIntegrationDialog } from '@dialogs/edit-integration/edit-integration.component';
import { SendOnPipe } from '../pipes/send-on.pipe';
import { TestDurationPipe } from '../pipes/test-duration.pipe';
import { LogPipe } from '../pipes/log.pipe';
import { NgInitDirective } from '../directives/ng-init.directive';
import { DependsPipe } from '@pipes/depends.pipe';
import { FeatureSortPipe } from '@pipes/feature-sort.pipe';
import { FeatureListComponent } from '@components/feature-list/feature-list.component';
import { L1FeatureListComponent } from '@components/l1-feature-list/l1-feature-list.component';
import { FeatureItemComponent } from '@components/search/feature-item/feature-item.component';
import { FillFeatureInfoPipe } from '@pipes/fill-feature-info.pipe';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { createTranslateLoader } from 'app/app.module';
import { AlreadyTakenFilterPipe } from '@pipes/already-taken-filter.pipe';
import { FilterTextPipe } from '@pipes/filter-text.pipe';
import { FolderComponent } from '@components/folder/folder.component';
import { DepartmentNamePipe } from '@pipes/department-name.pipe';
import { NewFolderComponent } from '@components/new-folder/new-folder.component';
import { MoveFolderItemComponent } from '@dialogs/move-feature/move-folder-item/move-folder-item.component';
import { MatSortModule } from '@angular/material/sort';
import { MatLegacyTableModule as MatTableModule } from '@angular/material/legacy-table';
import { MatLegacyListModule as MatListModule } from '@angular/material/legacy-list';
// import { MaterialExtensionsModule } from '@ng-matero/extensions';
import { MtxGridModule } from '@ng-matero/extensions/grid';

// virtual scrolling module for extended lists of feature results
import { ScrollingModule } from '@angular/cdk/scrolling';

import { FeatureRunningPipe } from '../pipes/feature-running.pipe';
import { PixelDifferencePipe } from '@pipes/pixel-difference.pipe';
import { BehaveChartTestComponent } from '@components/behave-charts/behave-chart.component';
import { HighchartsChartModule } from 'highcharts-angular';
import { FirstLetterUppercasePipe } from '@pipes/first-letter-uppercase.pipe';
import { NumeralPipe } from '@pipes/numeral.pipe';
import { RoundProgressModule } from 'angular-svg-round-progressbar';
import { ScreenshotBgPipe } from '@pipes/screenshot-bg.pipe';
import { AvailableFilesPipe } from '@pipes/available-files.pipe';

const components = [
  EnterValueComponent,
  AddFolderComponent,
  OfferTourComponent,
  EditVariablesComponent,
  NetworkPaginatedListComponent,
  DisableAutocompleteDirective,
  NgInitDirective,
  FeatureItemComponent,
  FeatureListComponent,
  L1FeatureListComponent,
  FolderComponent,
  NewFolderComponent,
  MoveFolderItemComponent,
  BehaveChartTestComponent,
];

const materialModules = [
  ClipboardModule,
  MatTabsModule,
  MatIconModule,
  MatDialogModule,
  MatSnackBarModule,
  MatProgressSpinnerModule,
  MatListModule,
  MatNativeDateModule,
  MatRadioModule,
  MatFormFieldModule,
  MatInputModule,
  MatTooltipModule,
  MatChipsModule,
  MatCheckboxModule,
  MatMenuModule,
  MatSlideToggleModule,
  MatSelectModule,
  DragDropModule,
  MatButtonModule,
  MatExpansionModule,
  MatAutocompleteModule,
  MatPaginatorModule,
  MatDividerModule,
  MatTableModule,
  MatSortModule,
  MtxGridModule,
  ScrollingModule,
  HighchartsChartModule,
  RoundProgressModule,
];

const snacks = [LoadingSnack];

const pipes = [
  FilterStepPipe,
  FilterByPropertyPipe,
  AmParsePipe,
  AmDateFormatPipe,
  PlatformSortPipe,
  SecondsToHumanReadablePipe,
  BrowserIconPipe,
  MobileIconPipe,
  PercentagePipe,
  PercentageFieldPipe,
  LoadingPipe,
  SafeUrlPipe,
  CheckSelectedBrowserPipe,
  CheckBrowserExistsPipe,
  BrowserResultStatusPipe,
  TranslateNamePipe,
  FormatVersionPipe,
  VersionSortPipe,
  BrowserFavouritedPipe,
  PaginationPipe,
  StoreSelectorPipe,
  BrowserComboTextPipe,
  CheckDuplicatePipe,
  HasPermissionPipe,
  SafeHtmlPipe,
  AddLatestPipe,
  SortByPipe,
  SendOnPipe,
  TestDurationPipe,
  LogPipe,
  DependsPipe,
  FeatureSortPipe,
  FillFeatureInfoPipe,
  AlreadyTakenFilterPipe,
  FilterTextPipe,
  DepartmentNamePipe,
  FeatureRunningPipe,
  HumanizeBytesPipe,
  PixelDifferencePipe,
  FirstLetterUppercasePipe,
  NumeralPipe,
  ScreenshotBgPipe,
  AvailableFilesPipe,
];

const dialogs = [
  ErrorDialog,
  EmailTemplateHelp,
  HtmlDiffDialog,
  AreYouSureDialog,
  EditIntegrationDialog,
];

const directives = [StopPropagationDirective, AttachToDirective, LetDirective];

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ...materialModules,
    TranslateModule.forChild({
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient],
      },
      isolate: false,
    }),
    ...components,
    ...directives,
    ...pipes,
    ...dialogs,
    ...snacks,
  ],
  providers: [
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        hasBackdrop: true,
        autoFocus: false,
      },
    },
    {
      provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
      useValue: {
        duration: 3000,
        horizontalPosition: 'center',
      },
    },
  ],
  exports: [
    ReactiveFormsModule,
    FormsModule,
    ...materialModules,
    ...components,
    ...directives,
    ...pipes,
    ...dialogs,
    ...snacks,
    TranslateModule,
  ],
})
export class SharedModule {
  static forRoot(): ModuleWithProviders<SharedModule> {
    return {
      ngModule: SharedModule,
    };
  }
}
