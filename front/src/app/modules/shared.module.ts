import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatNativeDateModule } from '@angular/material/core';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { EnterValueComponent } from '@dialogs/enter-value/enter-value.component';
import { AddFolderComponent } from '@dialogs/add-folder/add-folder.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule } from '@angular/material/paginator';
import { ClipboardModule } from '@angular/cdk/clipboard'
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { PlatformSortPipe } from '@pipes/platform-sort.pipe';
import { OfferTourComponent } from '@dialogs/offer-tour/offer-tour.component';
import { EditVariablesComponent } from '@dialogs/edit-variables/edit-variables.component';
import { ErrorDialog } from '@dialogs/error/error.dialog';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { NetworkPaginatedListComponent } from '@components/network-paginated-list/network-paginated-list.component';

/* Pipes */
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { FilterStepPipe } from '@pipes/filter-step.pipe';
import { TranslateNamePipe } from '@pipes/translate-name.pipe';
import { FormatVersionPipe } from '@pipes/format-version.pipe';
import { VersionSortPipe } from '@pipes/version-sort.pipe';
import { BrowserFavouritedPipe } from '@pipes/browser-favourited.pipe';
import { BrowserIconPipe } from '@pipes/browser-icon.pipe';
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
import { MatTableModule } from '@angular/material/table';
// import { MaterialExtensionsModule } from '@ng-matero/extensions';
import { MtxGridModule } from '@ng-matero/extensions/grid';

// virtual scrolling module for extended lists of feature results
import {ScrollingModule} from '@angular/cdk/scrolling';

import { FeatureRunningPipe } from '../pipes/feature-running.pipe';


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
  MoveFolderItemComponent
];

const materialModules = [
  ClipboardModule,
  MatTabsModule,
  MatIconModule,
  MatDialogModule,
  MatSnackBarModule,
  MatProgressSpinnerModule,
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
  ScrollingModule
];

const snacks = [
  LoadingSnack
];

const pipes = [
  FilterStepPipe,
  FilterByPropertyPipe,
  AmParsePipe,
  AmDateFormatPipe,
  PlatformSortPipe,
  SecondsToHumanReadablePipe,
  BrowserIconPipe,
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
  HumanizeBytesPipe
];

const dialogs = [
  ErrorDialog,
  EmailTemplateHelp,
  HtmlDiffDialog,
  AreYouSureDialog,
  EditIntegrationDialog
];

const directives = [
  StopPropagationDirective,
  AttachToDirective,
  LetDirective
];

@NgModule({
  declarations: [
    ...components,
    ...directives,
    ...pipes,
    ...dialogs,
    ...snacks
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ...materialModules,
    TranslateModule.forChild({
      loader: {
      provide: TranslateLoader,
      useFactory: createTranslateLoader,
      deps: [HttpClient]
    },
    isolate: false
  })
  ],
  providers: [
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        hasBackdrop: true,
        autoFocus: false
      }
    },
    {
      provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
      useValue: {
        duration: 3000,
        horizontalPosition: 'center'
      }
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
    TranslateModule
  ]
})
export class SharedModule {
  static forRoot(): ModuleWithProviders<SharedModule> {
    return {
      ngModule: SharedModule
    };
  }
}
