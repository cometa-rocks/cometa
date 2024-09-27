/**
 * l1-feature-starred-list.component.ts
 *
 * Contains the code to control the behaviour of the list containing the starred features of the new landing
 *
 * @date 08-10-21
 *
 * @lastModification 08-10-21
 *
 * @author: dph000
 */
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Select, Store } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { SocketService } from '@services/socket.service';
import { SharedActionsService } from '@services/shared-actions.service';
import { UserState } from '@store/user.state';
import { Observable } from 'rxjs';



@Component({
  selector: 'cometa-l1-feature-starred-list',
  templateUrl: './l1-feature-starred-list.component.html',
  styleUrls: ['./l1-feature-starred-list.component.scss'],
  standalone: true,
  imports: [MatIconModule, CommonModule],
})
export class L1FeatureStarredListComponent implements OnInit {
  @Select(UserState.favouriteFeatures) favouriteFeatures$!: Observable<Feature[]>;
  constructor(
    public _dialog: MatDialog,
    private _store: Store,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
    private _router: Router,
    private _snack: MatSnackBar,
    private _socket: SocketService,
    public _sharedActions: SharedActionsService,
  ) {}
  
  starredItem: any;

  ngOnInit() {
    // Usamos el selector para obtener un observable que nos da las features favoritas
    this.favouriteFeatures$ = this._store.select(UserState.favouriteFeatures);

    // Si quieres ver las features en la consola
    this.favouriteFeatures$.subscribe(features => {
      console.log('Favourite Features:', features);
    });
  }
}