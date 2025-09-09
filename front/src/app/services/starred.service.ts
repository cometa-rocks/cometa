/**
 * Service to manage starred features.
 * Provides functionality to add, remove and query favorites,
 * maintaining persistence in localStorage and notifying changes to subscribed components.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { LogService } from '@services/log.service';
/**
 * Interface that defines the structure of events when a feature is starred/unstarred
 */
export interface StarredFeatureEvent {
  featureId: number;     // ID of the affected feature
  action: 'add' | 'remove';  // Type of action: add or remove from favorites
}

@Injectable({
  providedIn: 'root'  // Makes the service a singleton available throughout the app
})
export class StarredService {

  // Prefix for localStorage key, following project convention (co_)
  private readonly STORAGE_KEY_PREFIX = 'co_starred_features_user_';

  // BehaviorSubject maintains the current state of favorites (Set of IDs)
  // Set ensures there are no duplicate IDs
  private starredFeaturesSubject = new BehaviorSubject<Set<number>>(new Set());

  // Public Observable that other components can subscribe to receive updates
  public starredFeatures$ = this.starredFeaturesSubject.asObservable();

  // Current user ID
  private userId: number;

  // Subject to emit events when favorites are added/removed in real-time
  private starredChangesSubject = new BehaviorSubject<StarredFeatureEvent | null>(null);
  
  // Public Observable for other components to react to changes in favorites
  public starredChanges$ = this.starredChangesSubject.asObservable();

  constructor(private store: Store, private log: LogService) {
    // Get user ID from store
    this.userId = this.store.selectSnapshot(UserState.GetUserId);
    // log de userId
    console.log('userId', this.userId);
    this.log.msg('4', 'userId', 'starred.service', this.userId);
    // log de starredfeaturesubject
    console.log('starredfeaturesubject', this.starredFeaturesSubject);
    this.log.msg('4', 'starredfeaturesubject', 'starred.service', this.starredFeaturesSubject);   
    // Load saved favorites when service initializes
    this.loadFromLocalStorage();
    // log of the localstorage
    console.log('localstorage', localStorage.getItem(this.storageKey));
    this.log.msg('4', 'localstorage', 'starred.service', localStorage.getItem(this.storageKey));
  }

  /**
   * Generates unique localStorage key by combining prefix and user ID
   */
  private get storageKey(): string {
    // log of the storageKey
    this.log.msg('4', 'storageKey', 'starred.service', `${this.STORAGE_KEY_PREFIX}${this.userId}`);
    return `${this.STORAGE_KEY_PREFIX}${this.userId}`;
  }

  /**
   * Loads saved favorites from localStorage when service initializes
   * If there's an error parsing, initializes with an empty Set
   */
  private loadFromLocalStorage(): void {
    const stored = localStorage.getItem(this.storageKey);
    // log of the stored
    console.log('Stored -->', stored);
    this.log.msg('4', 'stored', 'starred.service', stored);
    if (stored) {
      try {
        const parsedData = JSON.parse(stored);
        // log of the parsedData
        console.log('ParsedData -->', parsedData);
        this.log.msg('4', 'parsedData', 'starred.service', parsedData);
        if (Array.isArray(parsedData)) {
          // Filter to ensure only numbers are included
          const numberArray = parsedData.filter(item => typeof item === 'number');
          // Create new Set with IDs and update subject
          const features = new Set<number>(numberArray);
          this.starredFeaturesSubject.next(features);
        }
      } catch (error) {
        console.error('Error parsing starred features:', error);
        // If there's an error, initialize with empty Set
        this.starredFeaturesSubject.next(new Set());
      }
    }
  }

  /**
   * Saves favorites to localStorage
   * Converts Set to array before saving as JSON
   */
  private saveToLocalStorage(features: Set<number>): void {
    // log storagekey
    console.log('Storagekey -->', this.storageKey);
    this.log.msg('4', 'storagekey', 'starred.service', this.storageKey);

    localStorage.setItem(this.storageKey, JSON.stringify(Array.from(features)));
    // log of the localstorage
    console.log('Localstorage -->', localStorage.getItem(this.storageKey));
    this.log.msg('4', 'localstorage', 'starred.service', localStorage.getItem(this.storageKey));

    // Its given by the parameter
    console.log('Features -->', JSON.stringify(Array.from(features)));
    this.log.msg('4', 'localstorage', 'starred.service', localStorage.getItem(this.storageKey));
  }

  /**
   * Toggles favorite status of a feature (adds or removes)
   * Updates state, saves to localStorage and emits change event
   */
  toggleStarred(featureId: number): void {

    const current = this.starredFeaturesSubject.value;
    // log of the current
    console.log('current', current);
    this.log.msg('4', 'current', 'starred.service', current);

    const updated = new Set(current);
    // log of the updated
    console.log('updated', updated);
    this.log.msg('4', 'updated', 'starred.service', updated);

    const action = updated.has(featureId) ? 'remove' : 'add';
    // log of the action
    console.log('action', action);
    this.log.msg('4', 'action', 'starred.service', action);

    if (action === 'remove') {
      updated.delete(featureId);  // Remove ID from Set
    } else {
      updated.add(featureId);     // Add ID to Set
    }

    // Update state and save to localStorage
    this.starredFeaturesSubject.next(updated);
    // log starredfeaturesubject
    console.log('starredfeaturesubject', this.starredFeaturesSubject);
    this.log.msg('4', 'starredfeaturesubject', 'starred.service', this.starredFeaturesSubject);

    this.saveToLocalStorage(updated); // save to localstorage
    
    // Emit change event
    this.starredChangesSubject.next({ featureId, action });
  }

  /**
   * Checks if a feature is marked as favorite
   * @returns Observable<boolean> that emits true if the feature is starred
   * It's called from l1-feature-starred-list.component.ts
   * It's called from l1-feature-list.component.ts
   * Its called from l1-featur-recent-list.component.ts
   */
  isStarred(featureId: number): Observable<boolean> {
    // Return True or false 
    // to send this to other components to show or hide the icon (starred)
    return this.starredFeatures$.pipe(
      map(features => features.has(featureId))
    );
  }
} 