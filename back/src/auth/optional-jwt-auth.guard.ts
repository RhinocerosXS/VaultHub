import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const result = super.canActivate(context);

    // 如果是 Promise，处理错误
    if (result instanceof Promise) {
      return result.catch(() => true);
    }

    // 如果是 Observable，处理错误
    if (result instanceof Observable) {
      return new Observable((subscriber) => {
        result.subscribe({
          next: (value) => subscriber.next(value),
          error: () => {
            subscriber.next(true);
            subscriber.complete();
          },
          complete: () => subscriber.complete(),
        });
      });
    }

    // 如果是 boolean，直接返回
    return result;
  }

  handleRequest(err: any, user: any, info: any) {
    // 即使有错误也返回 user（可能为 null），不抛出异常
    return user || null;
  }
}
