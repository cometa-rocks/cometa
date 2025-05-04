/**
 * l1-feature-trashbin-list.component.ts
 *
 * Contains the code to control the behaviour of the features list within the trash bin of the new landing
 *
 * @date 08-10-21
 *
 * @lastModification 08-10-21
 *
 * @author: dph000
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable } from 'rxjs';
import { SharedActionsService } from '@services/shared-actions.service';

@Component({
  selector: 'cometa-l1-feature-trashbin-list',
  templateUrl: './l1-feature-trashbin-list.component.html',
  styleUrls: ['./l1-feature-trashbin-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    AsyncPipe
  ]
})
export class L1FeatureTrashbinListComponent implements OnInit {
  markedFeatures$: Observable<any[]>;

  constructor(private _sharedActions: SharedActionsService) {
    this.markedFeatures$ = this._sharedActions.getMarkedForDeletionFeatures();
  }

  ngOnInit(): void {
    // Inicialización adicional si es necesaria
  }

  restoreFeature(featureId: number): void {
    this._sharedActions.restoreFeature(featureId);
  }

  deleteFeature(featureId: number): void {
    this._sharedActions.deleteFeature(featureId);
  }
}
