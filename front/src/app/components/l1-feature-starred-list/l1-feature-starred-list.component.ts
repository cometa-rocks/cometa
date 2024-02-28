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

import { Component, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'cometa-l1-feature-starred-list',
  templateUrl: './l1-feature-starred-list.component.html',
  styleUrls: ['./l1-feature-starred-list.component.scss'],
  standalone: true,
  imports: [MatIconModule],
})
export class L1FeatureStarredListComponent implements OnInit {
  constructor() {}

  ngOnInit(): void {}
}
