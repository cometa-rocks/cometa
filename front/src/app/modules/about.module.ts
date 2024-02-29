import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { SharedModule } from './shared.module';
import { AboutComponent } from '@components/about/about.component';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { createTranslateLoader } from 'app/app.module';

const routes: Routes = [
  {
    path: '',
    title: 'About',
    component: AboutComponent,
  },
];

@NgModule({
  imports: [
    TranslateModule.forChild({
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient],
      },
    }),
    RouterModule.forChild(routes),
    SharedModule,
    CommonModule,
    AboutComponent,
  ],
})
export class AboutModule {}
