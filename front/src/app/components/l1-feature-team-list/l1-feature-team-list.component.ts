/**
 * l1-feature-team-list.component.ts
 *
 * Contains the code to control the behaviour of the list containing the team shared features of the new landing
 *
 * @date 08-10-21
 *
 * @lastModification 08-10-21
 *
 * @author: dph000
 */
import { Component, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'cometa-l1-feature-team-list',
  templateUrl: './l1-feature-team-list.component.html',
  styleUrls: ['./l1-feature-team-list.component.scss'],
  standalone: true,
  imports: [MatIconModule, TranslateModule],
})
export class L1FeatureTeamListComponent implements OnInit {
  constructor() {}

  ngOnInit(): void {}
}
