import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialog as MatDialog,
} from '@angular/material/legacy-dialog';
import { ApiService } from '@services/api.service';
import { NgxJsonViewerModule } from 'ngx-json-viewer';
import {
  EMPTY,
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
} from 'rxjs';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LogService } from '@services/log.service';

@Component({
  selector: 'json-viewer',
  templateUrl: './json-view.component.html',
  styleUrls: ['./json-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, MatButtonModule, NgxJsonViewerModule],
})
export class JsonViewerComponent implements OnInit {
  @ViewChild('jqResult') jq_result: ElementRef<HTMLTextAreaElement>;
  jq_filter$ = new Subject<string>();
  isHtmlContent: boolean = false;
  isStepVariableContent: boolean = false;
  sanitizedHtml: SafeHtml;
  dataToProcess: any;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<JsonViewerComponent>,
    private _api: ApiService,
    private _sanitizer: DomSanitizer,
    private log: LogService
  ) {}

  ngOnInit(): void {
    // Check if the response content is HTML
    if (this.data && this.data.responses && typeof this.data.responses === 'string') {
      // If the content starts with <html>, <div>, etc., treat it as HTML
      const content = this.data.responses.trim();
      if (content.startsWith('<') && (
          content.startsWith('<html') || 
          content.startsWith('<div') || 
          content.startsWith('<body') ||
          content.startsWith('<!DOCTYPE')
      )) {
        this.isHtmlContent = true;
        this.sanitizedHtml = this._sanitizer.bypassSecurityTrustHtml(content);
        
        // If openInNewTab flag is set, directly open in new tab
        if (this.data.openInNewTab) {
          this.openHtmlInNewTab();
          // Close the dialog as we're showing content in new tab
          setTimeout(() => this.closeDialog(), 100);
        }
      }
    }

    // If the content is a step variable, show it accordingly in the dialog
    this.isStepVariableContent = this.data?.responses?.variable_name !== undefined;
      
    // If it's a step variable, use the variable value as a data
    if (this.isStepVariableContent) {
      this.dataToProcess = this.data.responses.variable_value;
      this.log.msg('4', '=== dataToProcess() === If --> Data to process: ', 'json-view', this.dataToProcess);
    }
    else if (this.data.call) {  
      this.dataToProcess = this.data.call;
      this.log.msg('4', '=== dataToProcess() === Else if -->Data to process: ', 'json-view', this.dataToProcess);
    }
    else {
      this.dataToProcess = this.data?.responses || {};
      this.log.msg('4', '=== dataToProcess() === Else --> Data to process: ', 'json-view', this.dataToProcess);
    }

    this.log.msg('4', '=== dataToProcess() === Final Data to process: ', 'json-view', this.dataToProcess);
   

    this.jq_filter$
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap(filter => {
          if (!filter) {
            return EMPTY;
          }
          
          // Use the appropriate API method based on what's available
          if (this.data.id !== undefined) {
            return this._api.getParsedJQFilter(filter, this.data.id);
          } else {
            // Fallback to getParsedJQFilter_content if no id is available
            return this._api.getParsedJQFilter_content(filter, this.dataToProcess);
          }
        })
      )
      .subscribe(result => {
        try {
          // Try to parse the result as JSON if it's a string
          if (typeof result === 'string') {
            const parsedBody = JSON.parse(result);
            this.jq_result.nativeElement.value = parsedBody.result || parsedBody;
          } else {
            this.jq_result.nativeElement.value = JSON.stringify(result, null, 2);
          }
        } catch (e) {
          // If parsing fails, just use the string value
          this.jq_result.nativeElement.value = String(result);
        }
      });
  }

  getJQResult(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.jq_filter$.next(value);
  }

  closeDialog() {
    this.dialogRef.close();
  }
  
  openHtmlInNewTab() {
    // Create a new window without triggering print
    const newTab = window.open('', '_blank');
    
    if (!newTab) {
      console.error('Unable to open new tab. This might be due to popup blockers.');
      return;
    }
    
    // Add the HTML content and styling
    newTab.document.write(`
      <html>
        <head>
          <title>${this.data.stepNameVar || 'Accessibility Report'}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              line-height: 1.5;
            }
            h1, h2, h3 {
              color: #2d6da9;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin-bottom: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .scorecard {
              display: flex;
              background: #f5f5f5;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
            }
            .score-circle {
              width: 100px;
              height: 100px;
              border-radius: 50%;
              background: white;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              margin-right: 20px;
              border: 1px solid #ddd;
            }
            .green { color: green; }
            .orange { color: orange; }
            .red { color: red; }
            
            .print-button {
              position: fixed;
              top: 20px;
              right: 20px;
              padding: 10px 15px;
              background-color: #2d6da9;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-weight: bold;
            }
            
            @media print {
              .print-button { display: none; }
            }
          </style>
        </head>
        <body>
          <button class="print-button" onclick="window.print()">Print Report</button>
          ${this.data.responses}
        </body>
      </html>
    `);
    
    // Finalize document
    newTab.document.close();
    newTab.focus();
  }
  
  printReport() {
    // Create a new window with the print dialog triggered
    const printWindow = window.open('', '_blank');
    
    // Add the HTML content and styling
    printWindow.document.write(`
      <html>
        <head>
          <title>${this.data.stepNameVar || 'Accessibility Report'}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              line-height: 1.5;
            }
            h1, h2, h3 {
              color: #2d6da9;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin-bottom: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .scorecard {
              display: flex;
              background: #f5f5f5;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
            }
            .score-circle {
              width: 100px;
              height: 100px;
              border-radius: 50%;
              background: white;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              margin-right: 20px;
              border: 1px solid #ddd;
            }
            .green { color: green; }
            .orange { color: orange; }
            .red { color: red; }
            @media print {
              .no-print { display: none; }
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          ${this.data.responses}
        </body>
      </html>
    `);
    
    // Trigger print dialog
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}
