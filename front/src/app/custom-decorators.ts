import { Observable } from 'rxjs';

/**
 * @description Decorator used to input an Observable and output a Subscription to that observable,
 * useful for not having to use .subscribe() every time
 * @author Alex Barba
 */
export function Subscribe() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const result: Observable<any> = originalMethod.apply(this, args);
      return result.subscribe();
    };
  };
}
