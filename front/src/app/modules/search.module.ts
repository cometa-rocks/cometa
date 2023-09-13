import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { SharedModule } from './shared.module';
import { TranslateModule } from '@ngx-translate/core';
import { SearchComponent } from '@components/search/search.component';
import { MoveItemDialog } from '@dialogs/move-feature/move-item.component';
import { MatRippleModule } from '@angular/material/core';
import { EasterEggComponent } from '../components/easter-egg/easter-egg.component';

const routes: Routes = [
    {
        path: '',
        title: 'Home',
        component: SearchComponent
    }
];

@NgModule({
    imports: [
        TranslateModule.forChild({
            extend: true
        }),
        RouterModule.forChild(routes),
        MatRippleModule,
        SharedModule,
        CommonModule
    ],
    declarations: [
        /* Pipes */
        /* Components */
        MoveItemDialog,
        SearchComponent,
        EasterEggComponent,
  ]
})
export class SearchModule { }