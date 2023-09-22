import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { SharedModule } from './shared.module';
import { HelpComponent } from '@components/help/help.component';

const routes: Routes = [
    {
        path: '',
        title: 'Help',
        component: HelpComponent
    }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes),
    SharedModule,
    CommonModule
  ],
  declarations: [
    HelpComponent
  ]
})
export class HelpModule { }