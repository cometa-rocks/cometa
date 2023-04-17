import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { SharedModule } from './shared.module';
import { TranslateModule } from '@ngx-translate/core';
import { MatRippleModule } from '@angular/material/core';
import { L1LandingComponent } from '@components/l1-landing/l1-landing.component';
import { FolderTreeComponent } from '@components/folder-tree/folder-tree.component';
import { FolderItemTreeComponent } from '../components/folder-item-tree/folder-item-tree.component';
import { L1FilterComponent } from '../components/l1-filter/l1-filter.component';
import { L1FeatureItemListComponent } from '../components/l1-feature-item-list/l1-feature-item-list.component';
import { L1FeatureRecentListComponent } from '../components/l1-feature-recent-list/l1-feature-recent-list.component';
import { L1FeatureStarredListComponent } from '../components/l1-feature-starred-list/l1-feature-starred-list.component';
import { L1FeatureTrashbinListComponent } from '../components/l1-feature-trashbin-list/l1-feature-trashbin-list.component';
import { L1FeatureTeamListComponent } from '../components/l1-feature-team-list/l1-feature-team-list.component';
import { L1TreeViewComponent } from '../components/l1-tree-view/l1-tree-view.component';
import { WelcomeComponent } from '@components/welcome/welcome.component';

const routes: Routes = [
    {
        path: '',
        component: L1LandingComponent
    },
    {
        path: ':breadcrumb',
        component: L1LandingComponent
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
    L1LandingComponent,
    FolderTreeComponent,
    FolderItemTreeComponent,
    L1FilterComponent,
    L1FeatureItemListComponent,
    L1FeatureRecentListComponent,
    L1FeatureStarredListComponent,
    L1FeatureTrashbinListComponent,
    L1FeatureTeamListComponent,
    L1TreeViewComponent,
    WelcomeComponent
  ]
})
export class NewlandingModule { }