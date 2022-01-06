import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { AdminWrapperComponent } from '@components/admin-wrapper/admin-wrapper.component';
import { DepartmentsComponent } from '@components/admin/departments/departments.component';
import { ApplicationsComponent } from '@components/admin/applications/applications.component';
import { BrowsersComponent } from '@components/admin/browsers/browsers.component';
import { EnvironmentsComponent } from '@components/admin/environments/environments.component';
import { FeaturesComponent } from '@components/admin/features/features.component';
import { AccountsComponent } from '@components/admin/accounts/accounts.component';
import { DepartmentComponent } from '@components/admin/departments/department/department.component';
import { SharedModule } from './shared.module';
import { ApplicationComponent } from '@components/admin/applications/application/application.component';
import { AccountComponent } from '@components/admin/accounts/account/account.component';
import { BrowserComponent } from '@components/admin/browsers/browser/browser.component';
import { EnvironmentComponent } from '@components/admin/environments/environment/environment.component';
import { FeatureComponent } from '@components/admin/features/feature/feature.component';
import { ModifyUserComponent } from '@dialogs/modify-user/modify-user.component';
import { ModifyPasswordComponent } from '@dialogs/modify-password/modify-password.component';
import { PermissionGuard } from '@guards/permission.guard';
import { ModifyDepartmentComponent } from '@dialogs/modify-department/modify-department.component';
import { TranslateModule } from '@ngx-translate/core';

const routes: Routes = [
    {
        path: '',
        component: AdminWrapperComponent,
        children: [
            {
                path: '',
                pathMatch: 'full',
                canActivate: [PermissionGuard],
                data: {
                    require_permission: 'view_admin_panel'
                }
            },
            {
                path: 'departments',
                component: DepartmentsComponent,
                canActivate: [PermissionGuard],
                data: {
                    require_permission: 'view_departments_panel'
                }
            },
            {
                path: 'applications',
                component: ApplicationsComponent,
                canActivate: [PermissionGuard],
                data: {
                    require_permission: 'view_applications_panel'
                }
            },
            {
                path: 'environments',
                component: EnvironmentsComponent,
                canActivate: [PermissionGuard],
                data: {
                    require_permission: 'view_environments_panel'
                }
            },
            {
                path: 'browsers',
                component: BrowsersComponent,
                canActivate: [PermissionGuard],
                data: {
                    require_permission: 'view_browsers_panel'
                }
            },
            {
                path: 'features',
                component: FeaturesComponent,
                canActivate: [PermissionGuard],
                data: {
                    require_permission: 'view_features_panel'
                }
            },
            {
                path: 'accounts',
                component: AccountsComponent,
                canActivate: [PermissionGuard],
                data: {
                    require_permission: 'view_accounts_panel'
                }
            }
        ]
    }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes),
    TranslateModule.forChild({
        extend: true
    }),
    SharedModule,
    CommonModule
  ],
  declarations: [
    ModifyUserComponent,
    ModifyPasswordComponent,
    ModifyDepartmentComponent,
    DepartmentComponent,
    ApplicationComponent,
    AccountComponent,
    BrowserComponent,
    EnvironmentComponent,
    FeatureComponent,
    AdminWrapperComponent,
    DepartmentsComponent,
    ApplicationsComponent,
    EnvironmentsComponent,
    BrowsersComponent,
    FeaturesComponent,
    AccountsComponent
  ]
})
export class AdminModule { }
