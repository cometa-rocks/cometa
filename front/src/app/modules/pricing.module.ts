import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { SharedModule } from './shared.module';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { createTranslateLoader } from 'app/app.module';
import { PricingComponent } from '@components/pricing/pricing.component';
import { NgxsModule } from '@ngxs/store';
import { SubscriptionsState } from '@store/subscriptions.state';
import { PricingSuccessComponent } from '../components/pricing/pricing-success/pricing-success.component';

const routes: Routes = [
  {
    path: '',
    component: PricingComponent
  },
  {
    path: 'success',
    component: PricingSuccessComponent
  }
];

@NgModule({
    imports: [
        TranslateModule.forChild({
            loader: {
                provide: TranslateLoader,
                useFactory: (createTranslateLoader),
                deps: [HttpClient]
            }
        }),
        NgxsModule.forFeature([
            SubscriptionsState
        ]),
        RouterModule.forChild(routes),
        SharedModule,
        CommonModule,
        PricingComponent,
        PricingSuccessComponent
    ]
})
export class PricingModule { }
