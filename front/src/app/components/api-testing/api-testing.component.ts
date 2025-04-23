/**
 * l1-feature-trashbin-list.component.ts
 *
 * Contains the code to control the behaviour of the features list within the trash bin of the new landing
 *
 * @date 18-04-25
 *
 * @lastModification 23-04-25
 *
 * @author: Nico
 */
import { Component, OnInit, Inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { 
  MatLegacyDialogModule, 
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, 
  MatLegacyDialogRef as MatDialogRef 
} from '@angular/material/legacy-dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DraggableWindowModule } from '@modules/draggable-window.module';

interface ApiCallData {
  stepContent: string;
}

@Component({
  selector: 'cometa-api-testing',
  templateUrl: './api-testing.component.html',
  styleUrls: ['./api-testing.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatLegacyDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatTabsModule,
    MatCheckboxModule,
    FormsModule,
    ReactiveFormsModule,
    DraggableWindowModule
  ],
})
export class ApiTestingComponent implements OnInit {
  httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  selectedMethod: string = 'GET';
  endpoint: string = '';
  parameters: { key: string; value: string; enabled: boolean }[] = [];
  headers: { key: string; value: string; enabled: boolean }[] = [];
  jsonBody: string = '';
  rowBody: string = '';

  constructor(
    public dialogRef: MatDialogRef<ApiTestingComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ApiCallData
  ) {}

  ngOnInit(): void {
    if (this.data?.stepContent) {
      // Parse the step content to extract API call details
      const content = this.data.stepContent;
      const methodMatch = content.match(/with "([^"]+)"/);
      const endpointMatch = content.match(/to "([^"]+)"/);
      const paramsMatch = content.match(/params:([^"]+)"/);
      const headersMatch = content.match(/headers:([^"]+)"/);
      const bodyMatch = content.match(/body:(\{[\s\S]*?\})"/);
      const rowBodyMatch = content.match(/row_body:([^"]+)"/);

      if (methodMatch) this.selectedMethod = methodMatch[1];
      if (endpointMatch) this.endpoint = endpointMatch[1];
      
      if (paramsMatch) {
        try {
          // Parse semicolon-separated key-value pairs
          const paramsStr = paramsMatch[1];
          const params = paramsStr.split(';').reduce((acc, pair) => {
            const [key, value] = pair.split('=');
            if (key && value) {
              acc[key.trim()] = value.trim();
            }
            return acc;
          }, {});
          
          this.parameters = Object.entries(params).map(([key, value]) => ({
            key,
            value: value as string,
            enabled: true
          }));
        } catch (e) {
          console.error('Error parsing parameters:', e);
        }
      }

      if (headersMatch) {
        try {
          // Parse semicolon-separated key-value pairs
          const headersStr = headersMatch[1];
          const headers = headersStr.split(';').reduce((acc, pair) => {
            const [key, value] = pair.split('=');
            if (key && value) {
              acc[key.trim()] = value.trim();
            }
            return acc;
          }, {});
          
          this.headers = Object.entries(headers).map(([key, value]) => ({
            key,
            value: value as string,
            enabled: true
          }));
        } catch (e) {
          console.error('Error parsing headers:', e);
        }
      }

      if (bodyMatch) {
        try {
          // Store the raw JSON body string
          this.jsonBody = bodyMatch[1];
          // Try to parse it to validate, but keep the original string
          JSON.parse(this.jsonBody);
        } catch (e) {
          console.error('Error parsing JSON body:', e);
        }
      }

      if (rowBodyMatch) {
        this.rowBody = rowBodyMatch[1];
      }
    }
  }

  addParameter(): void {
    this.parameters.push({ key: '', value: '', enabled: true });
  }

  removeParameter(index: number): void {
    this.parameters.splice(index, 1);
  }

  addHeader(): void {
    this.headers.push({ key: '', value: '', enabled: true });
  }

  removeHeader(index: number): void {
    this.headers.splice(index, 1);
  }

  getFormattedEndpoint(): string {
    const enabledParams = this.parameters.filter(p => p.enabled && p.key && p.value);
    if (enabledParams.length === 0) return this.endpoint;

    const queryString = enabledParams
      .map((param, index) => `${param.key}=${param.value}`)
      .join('&');

    return `${this.endpoint}?${queryString}`;
  }

  onSave(): void {
    // Format parameters and headers as semicolon-separated key-value pairs
    const formattedParams = this.parameters
      .filter(p => p.enabled && p.key && p.value)
      .map(p => `${p.key}=${p.value}`)
      .join(';');

    const formattedHeaders = this.headers
      .filter(h => h.enabled && h.key && h.value)
      .map(h => `${h.key}=${h.value}`)
      .join(';');

    // Build the step content parts
    const parts: string[] = [];
    
    // Always include method and endpoint
    parts.push(`Make an API call with "${this.selectedMethod}" to "${this.endpoint}"`);
    
    // Collect all additional parts
    const additionalParts: string[] = [];
    
    // Add parameters if they exist
    if (formattedParams) {
      additionalParts.push(`"params:${formattedParams}"`);
    }
    
    // Add headers if they exist
    if (formattedHeaders) {
      additionalParts.push(`"headers:${formattedHeaders}"`);
    }
    
    // Add JSON body if it exists
    if (this.jsonBody && this.jsonBody !== '{json_body}') {
      additionalParts.push(`"body:${this.jsonBody}"`);
    }
    
    // Add raw body if it exists
    if (this.rowBody && this.rowBody !== '{row_body}') {
      additionalParts.push(`"row_body:${this.rowBody}"`);
    }
    
    // Add the first part with "with" if there are any additional parts
    if (additionalParts.length > 0) {
      parts.push(`with ${additionalParts[0]}`);
    }
    
    // Add remaining parts with "and"
    for (let i = 1; i < additionalParts.length; i++) {
      parts.push(`and ${additionalParts[i]}`);
    }
    
    // Join all parts
    const stepContent = parts.join(' ');
    
    console.log('Saving step with content:', stepContent);
    console.log('JSON Body:', this.jsonBody);
    
    this.dialogRef.close(stepContent);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
