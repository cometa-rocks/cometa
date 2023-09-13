import { NgModule, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule, ResolveFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { SharedModule } from './shared.module';
import { MainViewComponent } from '../views/main-view/main-view.component';
import { StepViewComponent } from '../views/step-view/step-view.component';
import { DetailViewComponent } from '../views/detail-view/detail-view.component';
import { FeatureTitlesComponent } from '@components/feature-titles/feature-titles.component';
import { FeatureActionsComponent } from '@components/feature-actions/feature-actions.component';
import { HighchartsChartModule } from 'highcharts-angular';
import { NumeralPipe } from '@pipes/numeral.pipe';
import { PixelDifferencePipe } from '@pipes/pixel-difference.pipe';
import { FirstLetterUppercasePipe } from '@pipes/first-letter-uppercase.pipe';
import { RoundProgressModule } from 'angular-svg-round-progressbar';
import { EditSchedule } from '@dialogs/edit-schedule/edit-schedule.component';
import { LogOutputComponent } from '@dialogs/log-output/log-output.component';
import { FeatureRunComponent } from '@components/feature-run/feature-run.component';
import { PdfLinkPipe } from '@pipes/pdf-link.pipe';
import { VideoComponent } from '@dialogs/video/video.component';
import { BehaveChartTestComponent } from '@components/behave-charts/behave-chart.component';
import { TranslateModule } from '@ngx-translate/core';
import { SumByPropertyPipe } from '@pipes/sum-by-property.pipe';
import { TotalDifferencePipe } from '@pipes/total-difference.pipe';
import { TotalOkPipe } from '@pipes/total-ok.pipe';
import { TotalNokPipe } from '@pipes/total-nok.pipe';
import { ArchivedRunsPipe } from '@pipes/archived.pipe';
import { FeatureRunPassedPipe } from '@pipes/feature-run-passed.pipe';
import { FeatureResultPassedPipe } from '@pipes/feature-result-passed.pipe';
import { DownloadLinkPipe } from '@pipes/download-link.pipe';
import { DownloadNamePipe } from '@pipes/download-name.pipe';
import { MainViewHeaderComponent } from '../views/main-view/main-view-header/main-view-header.component';
import { ScreenshotBgPipe } from '../pipes/screenshot-bg.pipe';
import { RunColumnDirective } from '../directives/run-column.directive';
import { Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';

const resolveFeatureTitle: ResolveFn<string> = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const featureId = route.paramMap.get('feature');
    const feature = inject(Store).selectSnapshot(CustomSelectors.GetFeatureInfo(parseInt(featureId)))
    return `${feature.feature_name} (${feature.feature_id})`
}

const routes: Routes = [
    {
        path: '',
        title: resolveFeatureTitle,
        component: MainViewComponent
    },
    {
        path: 'step/:feature_result_id',
        children: [
            {
                path: '',
                title: resolveFeatureTitle,
                component: StepViewComponent
            },
            {
                path: 'detail/:step_result_id',
                title: 'Step Details',
                component: DetailViewComponent
            }
        ]
    },
    {
        path: 'run/:run/step/:feature_result_id',
        redirectTo: 'step/:feature_result_id' 
    }
];

@NgModule({
    imports: [
        TranslateModule.forChild({
            extend: true
        }),
        HighchartsChartModule,
        RoundProgressModule,
        RouterModule.forChild(routes),
        SharedModule,
        CommonModule
    ],
    declarations: [
        /* Pipes */
        NumeralPipe,
        ArchivedRunsPipe,
        PixelDifferencePipe,
        FirstLetterUppercasePipe,
        PdfLinkPipe,
        SumByPropertyPipe,
        DownloadLinkPipe,
        DownloadNamePipe,
        /* Components */
        FeatureTitlesComponent,
        EditSchedule,
        BehaveChartTestComponent,
        VideoComponent,
        FeatureRunComponent,
        LogOutputComponent,
        FeatureActionsComponent,
        MainViewComponent,
        StepViewComponent,
        DetailViewComponent,
        TotalDifferencePipe,
        TotalOkPipe,
        TotalNokPipe,
        FeatureRunPassedPipe,
        FeatureResultPassedPipe,
        MainViewHeaderComponent,
        ScreenshotBgPipe,
        RunColumnDirective
  ]
})
export class DetailsModule { }