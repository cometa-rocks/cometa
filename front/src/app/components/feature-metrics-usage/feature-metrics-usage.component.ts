/**
 * l1-feature-list.component.ts
 *
 * Contains the code to control the behaviour of the features list of the new landing
 *
 * @author: dph000
 */

import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
    ViewChild,
  } from '@angular/core';
  import { Select, Store } from '@ngxs/store';
  import { SharedActionsService } from '@services/shared-actions.service';
 
  import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
  import { ApiService } from '@services/api.service';
  import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';

  import { LogService } from '@services/log.service';
  
  import { StarredService } from '@services/starred.service';
  import { Router } from '@angular/router';
  
  
  @Component({
    selector: 'cometa-feature-metrics-usage',
    templateUrl: './feature-metrics-usage.component.html',    
    styleUrls: ['./feature-metrics-usage.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [

    ],
  })
  export class FeatureMetricsUsageComponent implements OnInit {
    constructor(
      // private _store: Store,
      // public _sharedActions: SharedActionsService,
      // private _dialog: MatDialog,
      // private _api: ApiService,
      // private _snackBar: MatSnackBar,
      private log: LogService,
      // private _starred: StarredService,
      // private _router: Router
    ) {}
  
  
    ngOnInit() {
      this.log.msg('feature-metrics-usage.component.ts','FeatureMetricsUsageComponent initialized','','');
    }
  }
  