import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import {
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { Tour } from '@services/tours';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';

@Component({
  selector: 'offer-tour',
  templateUrl: './offer-tour.component.html',
  styleUrls: ['./offer-tour.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatLegacyDialogModule, MatLegacyButtonModule],
})
export class OfferTourComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: Tour) {}
}
