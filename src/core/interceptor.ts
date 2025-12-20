import { InterceptorHandler } from '../types';

// 建立一個攔截器管理器, 可以用來註冊和管理攔截器
// T 是攔截器處理的資料型別，可以是request config 或 response
export const createInterceptorManager = <T>() => {
  // handler陣列用來存放所有註冊的攔截器
  // createInterceptorManager是一個閉包函式,所以handler變數不會消失
  // 外部無法直接存取handler,只能透過use或是eject方法操作
  const handler: (InterceptorHandler<T> | null)[] = [];
  return {
    // use方法是註冊一個新的攔截器
    use: (fulfilled: (value: T) => T | Promise<T>, rejected?: (error: unknown) => any): number => {
      handler.push({ fulfilled, rejected });
      // 回傳目前handler的index,方便之後移除用
      return handler.length - 1;
    },
    // eject方法是移除一個已註冊的攔截器
    eject: (id: number): void => {
      if (handler[id]) {
        // handler.splice(id, 1);
        handler[id] = null;
      }
    },
    // forEach提供給createFetchClient用來遍歷所有已註冊的攔截器，並執行傳入的函式
    forEach: (fn: (h: InterceptorHandler<T>) => void): void => {
      handler.forEach((h) => {
        if (h !== null) {
          fn(h);
        }
      });
    },
  };
};
