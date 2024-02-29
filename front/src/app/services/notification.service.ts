import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  checkNotificationAPIAccess(): Promise<boolean> {
    return new Promise(resolve => {
      if (!('Notification' in window)) resolve(false);
      else if (Notification.permission === 'granted') resolve(true);
      else if (Notification.permission !== 'denied')
        Notification.requestPermission(permission =>
          resolve(permission === 'granted')
        );
    });
  }

  notify(title: string, options: NotificationOptions, callback?: Function) {
    this.checkNotificationAPIAccess().then(result => {
      if (result) {
        const notification: any = new Notification(title, options);
        notification.onclick = () => {
          notification.close();
          if (typeof callback === 'function') {
            callback();
          }
        };
        return notification;
      } else {
        return null;
      }
    });
  }
}
