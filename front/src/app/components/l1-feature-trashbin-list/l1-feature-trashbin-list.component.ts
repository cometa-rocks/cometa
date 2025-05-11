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
import { Component, Input, OnInit, HostListener } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { SharedActionsService } from '@services/shared-actions.service';
import { L1FeatureItemListComponent } from '../l1-feature-item-list/l1-feature-item-list.component';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';

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
    MatMenuModule,
    MatDividerModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
    AsyncPipe,
    L1FeatureItemListComponent
  ]
})
export class L1FeatureTrashbinListComponent implements OnInit {
  @Input() data$: any[] = [];
  selectedDepartment: string = 'All Departments';
  departments: string[] = [];

  constructor(
    private _sharedActions: SharedActionsService,
    private store: Store
  ) {}

  ngOnInit(): void {
    console.log('Trashbin component data:', this.data$);
    // Get departments from user state
    this.store.select(UserState.RetrieveUserDepartments).subscribe(departments => {
      this.departments = departments.map(dept => dept.department_name);
      // Get selected department from localStorage or use default
      const savedDepartment = localStorage.getItem('co_trashbin_selected_department') || 'All Departments';
      this.selectedDepartment = savedDepartment;
    });
  }

  onDepartmentChange(department: string): void {
    this.selectedDepartment = department;
    localStorage.setItem('co_trashbin_selected_department', department);
  }

  restoreFeature(featureId: number): void {
    console.log('Restoring feature:', featureId);
    this._sharedActions.restoreFeature(featureId);
  }

  deleteFeature(featureId: number): void {
    console.log('Deleting feature:', featureId);
    this._sharedActions.deleteFeature(featureId);
  }

  getDepartments(): string[] {
    if (!this.data$) return [];
    const departments = new Set<string>();
    this.data$.forEach(item => {
      if (item.department) {
        departments.add(item.department);
      }
    });
    return Array.from(departments).sort();
  }

  getFeaturesByDepartment(department: string): any[] {
    if (!this.data$) return [];
    return this.data$.filter(item => item.department === department);
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(event: Event) {
    const headers = document.querySelectorAll('.department-header');
    headers.forEach((header, index) => {
      const nextHeader = headers[index + 1];
      const headerRect = header.getBoundingClientRect();
      const nextHeaderRect = nextHeader?.getBoundingClientRect();
      
      // Add sticky class when header is at the top
      if (headerRect.top <= 80) {
        header.classList.add('sticky');
      } else {
        header.classList.remove('sticky');
      }
      
      // Remove sticky class when next header is about to push it up
      if (nextHeader && nextHeaderRect.top <= 80 + headerRect.height) {
        header.classList.remove('sticky');
      }
    });
  }
}
