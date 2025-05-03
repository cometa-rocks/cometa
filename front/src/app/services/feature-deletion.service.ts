import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { FeatureDeletionStatus } from '@others/interfaces';

@Injectable({
  providedIn: 'root'
})
export class FeatureDeletionService {
  private readonly STORAGE_KEY = 'co_feature_deletions';
  private deletionsSubject = new BehaviorSubject<FeatureDeletionStatus[]>([]);

  constructor(private store: Store) {
    this.loadDeletions();
  }

  private loadDeletions(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      this.deletionsSubject.next(JSON.parse(stored));
    }
  }

  private saveDeletions(deletions: FeatureDeletionStatus[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(deletions));
    this.deletionsSubject.next(deletions);
  }

  scheduleDeletion(featureId: number): void {
    const userId = this.store.selectSnapshot(UserState.GetUserId);
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now

    const currentDeletions = this.deletionsSubject.value;
    const newDeletion: FeatureDeletionStatus = {
      feature_id: featureId,
      deletion_date: deletionDate.toISOString(),
      deleted_by: userId
    };

    this.saveDeletions([...currentDeletions, newDeletion]);
  }

  cancelDeletion(featureId: number): void {
    const currentDeletions = this.deletionsSubject.value;
    const updatedDeletions = currentDeletions.filter(d => d.feature_id !== featureId);
    this.saveDeletions(updatedDeletions);
  }

  getDeletionStatus(featureId: number): Observable<FeatureDeletionStatus | null> {
    return new Observable(subscriber => {
      this.deletionsSubject.subscribe(deletions => {
        const status = deletions.find(d => d.feature_id === featureId) || null;
        subscriber.next(status);
      });
    });
  }

  getDaysRemaining(deletionDate: string): number {
    const now = new Date();
    const deletion = new Date(deletionDate);
    const diffTime = deletion.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
} 