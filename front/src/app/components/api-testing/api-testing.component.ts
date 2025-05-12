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
  bodyContent: string = '';
  selectedBodyType: 'raw' | 'json' | 'html' | 'xml' = 'raw';

  private readonly contentTypeMap = {
    raw: 'text/plain',
    json: 'application/json',
    html: 'text/html',
    xml: 'application/xml'
  };

  constructor(
    public dialogRef: MatDialogRef<ApiTestingComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ApiCallData
  ) {}

  ngOnInit(): void {
    if (this.data?.stepContent) {
      const content = this.data.stepContent;

      const methodMatch = content.match(/with "([^"]+)"/);
      const endpointMatch = content.match(/to "([^"]+)"/);
      const paramsMatch = content.match(/params:([^"]+)"/);
      const headersMatch = content.match(/headers:([^"]+)"/);
      
      // Find the last quote in the string
      const bodyStart = content.indexOf('body:');
      if (bodyStart !== -1) {
        const lastQuoteIndex = content.lastIndexOf('"');
        if (lastQuoteIndex > bodyStart) {
          this.bodyContent = content.substring(bodyStart + 5, lastQuoteIndex);
        }
      }

      if (methodMatch) this.selectedMethod = methodMatch[1];
      if (endpointMatch) this.endpoint = endpointMatch[1];
      
      if (paramsMatch) {
        try {
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

          // Set initial body type based on content-type header
          const contentTypeHeader = this.headers.find(h => h.key.toLowerCase() === 'content-type');
          if (contentTypeHeader) {
            const contentType = contentTypeHeader.value.toLowerCase();
            if (contentType.includes('json')) this.selectedBodyType = 'json';
            else if (contentType.includes('html')) this.selectedBodyType = 'html';
            else if (contentType.includes('xml')) this.selectedBodyType = 'xml';
            else this.selectedBodyType = 'raw';
          }
        } catch (e) {
          console.error('Error parsing headers:', e);
        }
      }
    }
  }

  onBodyTypeChange(): void {
    const contentType = this.contentTypeMap[this.selectedBodyType];
    const existingContentTypeIndex = this.headers.findIndex(h => h.key.toLowerCase() === 'content-type');
    
    if (existingContentTypeIndex >= 0) {
      // Update existing content-type header
      this.headers[existingContentTypeIndex].value = contentType;
    } else {
      // Add new content-type header
      this.headers.push({
        key: 'Content-Type',
        value: contentType,
        enabled: true
      });
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
    const formattedParams = this.parameters
      .filter(p => p.enabled && p.key && p.value)
      .map(p => `${p.key}=${p.value}`)
      .join(';');

    const formattedHeaders = this.headers
      .filter(h => h.enabled && h.key && h.value)
      .map(h => `${h.key}=${h.value}`)
      .join(';');

    const parts: string[] = [];
    parts.push(`Make an API call with "${this.selectedMethod}" to "${this.endpoint}"`);
    
    const additionalParts: string[] = [];
    
    if (formattedParams) {
      additionalParts.push(`"params:${formattedParams}"`);
    }
    
    if (formattedHeaders) {
      additionalParts.push(`"headers:${formattedHeaders}"`);
    }
    
    if (this.bodyContent && this.bodyContent !== '{json_body}') {
      additionalParts.push(`"body:${this.bodyContent}"`);
    }
    
    if (additionalParts.length > 0) {
      parts.push(`with ${additionalParts[0]}`);
    }
    
    for (let i = 1; i < additionalParts.length; i++) {
      parts.push(`and ${additionalParts[i]}`);
    }
    
    const stepContent = parts.join(' ');
    this.dialogRef.close(stepContent);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
