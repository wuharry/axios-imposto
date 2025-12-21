// src/types/index.ts

/**
 * CustomRequestInit 繼承自原生的 RequestInit
 * * @description
 * RequestInit 是 TS 內建型別 (lib.dom.d.ts)，包含了所有 fetch 支援的參數：
 * - method?: 'GET' | 'POST' | 'PUT' | 'DELETE' ... (HTTP 方法)
 * - headers?: HeadersInit (標頭，如 { 'Content-Type': 'application/json' })
 * - body?: BodyInit (請求內容，可以是 string, FormData, Blob 等)
 * - signal?: AbortSignal (搭配 AbortController 用來取消請求)
 * - credentials?: 'omit' | 'same-origin' | 'include' (是否帶 Cookie)
 * - mode?: 'cors' | 'no-cors' | 'same-origin' (跨域設定)
 * - cache?: 'default' | 'no-store' | 'reload' ... (快取策略)
 */
export interface CustomRequestInit extends RequestInit {
  /** 自定義的請求超時時間 (單位: 毫秒) */
  timeout?: number;
}

export interface CreateFetchClientProp {
  baseURL?: string;
  headers?: HeadersInit;
  timeout?: number;
  /**
   * 控制是否傳送 Cookie
   * - 'omit': 不傳送
   * - 'same-origin': 同源才傳送 (預設)
   * - 'include': 跨域也傳送 (對應 axios 的 withCredentials: true)
   */
  credentials?: RequestCredentials;
}

/**
 * 單個攔截器的處理函式定義
 */
export interface InterceptorHandler<T> {
  fulfilled: (value: T) => T | Promise<T>;
  rejected?: (error: unknown) => any;
}

/**
 * ✅  攔截器管理器介面
 * 這是 createInterceptorManager 回傳的物件形狀
 */
export interface InterceptorManager<T> {
  // 註冊攔截器，回傳 ID
  use: (fulfilled: (value: T) => T | Promise<T>, rejected?: (error: unknown) => any) => number;

  // 移除攔截器
  eject: (id: number) => void;

  // 內部使用：遍歷執行
  forEach: (fn: (handler: InterceptorHandler<T>) => void) => void;
}

/**
 * API 錯誤回應介面
 */
export interface ErrorResponse {
  message?: string;
  error?: string;
}
