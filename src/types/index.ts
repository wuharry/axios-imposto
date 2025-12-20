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
  /** * 自定義的請求超時時間 (單位: 毫秒)
   * @note 原生 fetch 不支援此屬性，這是我們封裝層手動實作的功能
   */
  timeout?: number;
}

export interface CreateFetchClientProp {
  baseURL?: string; // 允許不傳，預設使用環境變數
  headers?: HeadersInit; // 使用原生的 HeadersInit 型別
  timeout?: number; // 單位毫秒 (ms)
}

export interface InterceptorHandler<T> {
  fulfilled: (value: T) => T | Promise<T>;

  // 失敗時：
  // 1. error 型別設為 unknown
  // 2. 回傳值設為 any，因為我們無法預測使用者在錯誤處理後會回傳什麼 (可能是修正後的 T，也可能是新的錯誤)
  // 用 any，為了極致的相容性。
  rejected?: (error: unknown) => any;
}
