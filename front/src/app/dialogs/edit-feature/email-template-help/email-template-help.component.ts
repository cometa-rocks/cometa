import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { NgFor } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'cometa-email-template-help',
  templateUrl: 'email-template-help.component.html',
  styleUrls: ['email-template-help.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatDialogModule, NgFor, MatButtonModule],
})
export class EmailTemplateHelp {

  sortedBasicVariables: any[] = [];

  sortedFeatureVariables: any[] = [];

  constructor(){
    this.sortVariables();
  }

  variables = [
    ['Basic Information','status', 'The status of the result'],
    ['Feature Execution Result','feature_result_id', 'ID of the result'],
    ['Basic Information','feature_id', 'ID of the feature'],
    ['Basic Information','result_date', 'Datetime of the result'],
    ['Basic Information','feature_name', 'Feature name'],
    ['Basic Information','app_name', 'Application name'],
    ['Basic Information','environment_name', 'Environment name'],
    ['Basic Information','department_name', 'Department name'],
    ['Basic Information','url', 'Direct link to open the feature in Co.meta interface'],
    ['Feature Execution Result','total', 'Total steps of result'],
    ['Feature Execution Result','fails', 'Fails of result'],
    ['Feature Execution Result','ok', 'Success steps of result'],
    ['Feature Execution Result','skipped', 'Skipped steps of result'],
    ['Feature Execution Result','execution_time', 'Time in milliseconds of the result'],
    ['Feature Execution Result','pixel_diff', 'Pixel difference of the result'],
    ['Feature Execution Result','log', 'Log output of the result'],
    ['Basic Information','archived', 'Whether or not the result is archived'],
    ['Feature Execution Result','executed_by', 'User ID of who executed the result'],
    ['Feature Execution Result','screenshot[n]', 'Attach screenshot from feature steps [n,-n,last]']
  ];

  sortVariables(){
    this.sortedBasicVariables = this.variables.filter(variable => variable[0] === 'Basic Information').sort((a,b) => a[1].localeCompare(b[1]));

    this.sortedFeatureVariables  = this.variables.filter(variable => variable[0] === 'Feature Execution Result').sort((a, b) => a[1].localeCompare(b[1]));
  }

}
