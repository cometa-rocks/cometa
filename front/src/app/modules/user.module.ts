import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { SharedModule } from './shared.module';
import { UserComponent } from 'app/views/user/user.component';
import { TranslateModule } from '@ngx-translate/core';

const routes: Routes = [
  {
    path: '',
    component: UserComponent
  }
];

@NgModule({
  imports: [
    TranslateModule.forChild({
        extend: true
    }),
    RouterModule.forChild(routes),
    SharedModule,
    CommonModule
  ],
  declarations: [
    UserComponent
  ]
})
export class MyAccountModule { }
