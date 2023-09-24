import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { Tour } from '@services/tours';

@Component({
  selector: 'offer-tour',
  templateUrl: './offer-tour.component.html',
  styleUrls: ['./offer-tour.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferTourComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: Tour) {}
}
