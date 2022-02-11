import { NgModule } from '@angular/core';
import { RouterModule, Routes, ExtraOptions, PreloadAllModules } from '@angular/router';

/* App Routes */
const routes: Routes = [
    {
      path: '',
      pathMatch: 'full',
      redirectTo: 'search'
    },
    {
      path: 'about',
      loadChildren: () => import('@modules/about.module').then(m => m.AboutModule)
    },
    {
      path: 'help',
      loadChildren: () => import('@modules/help.module').then(m => m.HelpModule)
    },
    {
      path: 'search',
      loadChildren: () => import('@modules/search.module').then(m => m.SearchModule)
    },
    {
      path: 'my-account',
      loadChildren: () => import('@modules/user.module').then(m => m.MyAccountModule)
    },
    {
      path: 'admin',
      loadChildren: () => import('@modules/admin.module').then(m => m.AdminModule)
    },
    {
      path: ':app/:environment/:feature',
      loadChildren: () => import('@modules/details.module').then(m => m.DetailsModule)
    },
    {
      path: 'pricing',
      loadChildren: () => import('@modules/pricing.module').then(m => m.PricingModule)
    },
    {
      path: 'new',
      loadChildren: () => import('@modules/newlanding.module').then(m => m.NewlandingModule)
    },
    {
      path: 'new/:breadcrumb',
      loadChildren: () => import('@modules/newlanding.module').then(m => m.NewlandingModule)
    }
];


// Enable route parameters inheritance
export const routingConfiguration: ExtraOptions = {
    useHash: true,
    paramsInheritanceStrategy: 'always',
    preloadingStrategy: PreloadAllModules
};

@NgModule({
    imports: [
      RouterModule.forRoot(routes, routingConfiguration)
    ],
    exports: [
        RouterModule
    ]
})
export class CometaRoutingModule { }