/**
 * l1-feature-starred-list.component.ts
 *
 * Contains the code to control the behaviour of the list containing the starred features of the new landing
 *
 * @date 08-10-21
 *
 * @lastModification 08-10-21
 *
 * @author: Redouan
 */

import { Component, Input, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StarredService } from '@services/starred.service';
import { Observable, combineLatest, of, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { L1FeatureItemListComponent } from '../l1-feature-item-list/l1-feature-item-list.component';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { LogService } from '@services/log.service';
interface TableData {
  rows: FeatureData[];
  featureCount: number;
  folderCount: number;
  last_update: string;
}

@Component({
  selector: 'cometa-l1-feature-starred-list',
  standalone: true,
  imports: [
    CommonModule, 
    MatIconModule, 
    L1FeatureItemListComponent,
    MatLegacyFormFieldModule,
    MatLegacySelectModule,
    FormsModule
  ],
  templateUrl: './l1-feature-starred-list.component.html',
  styleUrls: ['./l1-feature-starred-list.component.scss']
})

export class L1FeatureStarredListComponent implements OnInit {
  @Input() data$?: Observable<TableData>;
  starredFeatures$: Observable<FeatureData[]> = of([]);
  groupedFeatures$!: Observable<Map<string, FeatureData[]>>;
  
  selectedDepartment: string = '';
  departments: string[] = [];
  private selectedDepartment$ = new BehaviorSubject<string>('');


  @ViewChild('readmeButton') readmeButton!: ElementRef;
  showReadme: boolean = false;
  popupPosition = { x: 0, y: 0 };

  constructor(
    private starredService: StarredService,
    private store: Store,
    private log: LogService
  ) {}

  ngOnInit() {
    // If data$ is not provided, use an empty observable
    const inputData$ = this.data$ || of({ rows: [], featureCount: 0, folderCount: 0, last_update: '' });


    // Get departments from user state
    this.store.select<Department[]>(UserState.RetrieveUserDepartments).subscribe(departments => {
      this.departments = ['All Departments', ...departments.map(dept => dept.department_name)];
      // Get selected department from localStorage or use first department
      const savedDepartment = localStorage.getItem('co_starred_selected_department') || this.departments[0] || '';
      this.selectedDepartment = savedDepartment;
      this.selectedDepartment$.next(savedDepartment);
    });

    // Combine the starred features, the input data and the selected department
    this.starredFeatures$ = combineLatest([
      this.starredService.starredFeatures$,
      inputData$,
      this.selectedDepartment$
    ]).pipe(
      map(([starredIds, data, selectedDept]) => {
        const filtered = data.rows.filter(feature => {
          const featureId = parseInt(feature.id);
          const isStarred = starredIds.has(featureId);
          // When "All Departments" is selected, we only check if it's starred
          const matchesDepartment = selectedDept === 'All Departments' || !selectedDept || feature.department === selectedDept;
          return feature.type === 'feature' && isStarred && matchesDepartment;
        });
        return filtered;
      })
    );

    this.starredFeatures$.subscribe(features => {
      this.log.msg('4', 'starredfeatures', 'l1-feature-starred-list.component', features);
    });

    // Initialize groupedFeatures$ after starredFeatures$ is set up
    this.groupedFeatures$ = this.starredFeatures$.pipe(
      map(features => {
        const grouped = new Map<string, FeatureData[]>();
        features.forEach(feature => {
          // Ensure we always have a department, defaulting to 'Other' if none is specified
          const dept = feature.department || 'Other';
          if (!grouped.has(dept)) {
            grouped.set(dept, []);
          }
          grouped.get(dept)?.push(feature);
        });
        // Sort departments alphabetically
        const sortedMap = new Map([...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])));
        return sortedMap;
      })
    );
  }

  /**
   * Handles the department selection change
   * Updates the selected department, notifies subscribers, and saves the selection to localStorage
   * @param department - The newly selected department name
   */
  onDepartmentChange(department: string) {
    this.selectedDepartment = department;
    this.selectedDepartment$.next(department);
    localStorage.setItem('co_starred_selected_department', department);
  }

  /**
   * Toggles the visibility of the README popup
   * When showing the popup, calculates its position relative to the README button
   * The popup is centered horizontally below the button
   */
  toggleReadme() {
    this.showReadme = !this.showReadme;
    if (this.showReadme) {
      const buttonRect = this.readmeButton.nativeElement.getBoundingClientRect();
      this.popupPosition = {
        x: buttonRect.left - 585, // Centers the popup (300px minimum width / 2)
        y: buttonRect.bottom - 140  // Adds 8px spacing below the button
      };
    }
  }

  /**
   * Closes the README popup when clicking outside of it
   * Checks if the click was outside both the button and the popup
   * @param event - The click event
   */
  @HostListener('document:click', ['$event'])
  closePopupOnClickOutside(event: MouseEvent) {
    if (this.showReadme && 
        !this.readmeButton.nativeElement.contains(event.target) &&
        !(event.target as HTMLElement).closest('.readme-popup')) {
      this.showReadme = false;
    }
  }

  /**
   * Handles scroll events to manage sticky headers
   * @param event - The scroll event
   */
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
