import {
  Component,
  OnInit,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NgFor, NgIf, AsyncPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { EditConfigurationComponent } from './edit-configuration/edit-configuration.component';

@Component({
  selector: 'administration',
  templateUrl: './administration.component.html',
  styleUrls: ['./administration.component.scss'],
  imports: [
    NgFor,
    NgIf,
    MatButtonModule,
    MatIconModule,
    AsyncPipe,
    EditConfigurationComponent,
  ],
  // changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class AdministrationComponent implements OnInit {
  showConfigurations: Boolean = false
 
  constructor(
    private _dialog: MatDialog,
  ) {}

  ngOnInit() {
   
  }

  
  openConfigurationVariable() {
    this._dialog.open(EditConfigurationComponent, {
      panelClass: 'configuration-variables',
      width: '90%',
    });
  }

}
