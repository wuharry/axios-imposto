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
  isStream?: boolean;
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
 * ✅ 攔截器管理器介面
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

/**
 * 💡 [SSE 訊息物件]
 * 代表從 Server-Sent Events 串流中解析出來的一則完整訊息。
 * 這是依照 SSE 協議標準 (Event Stream Format) 定義的欄位。
 */
export interface SSEMessage {
  /**
   * 📩 訊息內容
   * 通常是 JSON 字串，使用者收到後需自行 JSON.parse，
   * 或是純文字訊息。
   */
  data: string;

  /**
   * 🏷️ 事件類型 (對應 SSE 的 `event:` 欄位)
   * 如果後端沒有指定，預設通常是 'message'。
   * 可用於區分不同的推播類型 (e.g., 'update', 'ping', 'error')。
   */
  event?: string;

  /**
   * 🆔 訊息 ID (對應 SSE 的 `id:` 欄位)
   * 用於斷線重連機制。當連線中斷重連時，瀏覽器會自動帶上
   * `Last-Event-ID` header，告訴後端從哪裡開始補送。
   */
  id?: string;

  /**
   * ⏱️ 重試時間 (對應 SSE 的 `retry:` 欄位)
   * 單位：毫秒 (ms)。告訴客戶端如果斷線了，多久之後要嘗試重連。
   */
  retry?: number;
}

/**
 * 💡 [SSE 設定參數]
 * 使用者呼叫 `client.sse()` 時傳入的設定物件。
 *
 * @extends Omit<CustomRequestInit, 'method'>
 * * 繼承 CustomRequestInit：讓使用者可以設定 Headers (如 Token)、Timeout 等。
 * * 排除 'method'：因為 SSE 規範強制使用 HTTP GET，不允許 POST 或其他方法。
 */
export interface SSEOptions extends Omit<CustomRequestInit, 'method'> {
  /**
   * 🟢 當連線成功建立時觸發
   */
  onOpen?: () => void;

  /**
   * 📩 當收到後端推播訊息時觸發 (核心 callback)
   * @param message 解析後的 SSE 訊息物件
   */
  onMessage: (message: SSEMessage) => void;

  /**
   * 🔴 當發生錯誤時觸發
   * (例如：網路斷線、解析錯誤、或後端回傳非 200 狀態碼)
   */
  onError?: (error: Error) => void;

  /**
   * ⚫ 當連線關閉時觸發 (包含手動關閉或意外斷線且不再重試)
   */
  onClose?: () => void;
}

/**
 * 💡 [SSE 連線控制物件]
 * `client.sse()` 函式的回傳值，讓外部可以控制這條連線。
 */
export interface SSEConnection {
  /**
   * 🛑 關閉連線
   * 呼叫此方法將中止 fetch 請求 (AbortController) 並停止接收訊息。
   */
  close: () => void;

  /**
   * 🚦 目前的連線狀態 (唯讀)
   * - 'connecting': 正在建立連線
   * - 'open': 連線中，正在接收資料
   * - 'closed': 連線已關閉
   */
  readonly readyState: 'connecting' | 'open' | 'closed';
}

/**
 * ✅ [核心] 客戶端實體介面 (對應 AxiosInstance)
 * 這是 createFetchClient 回傳物件的型別定義
 */
export interface FetchClient {
  /**
   * 攔截器管理器
   */
  interceptors: {
    request: InterceptorManager<CustomRequestInit>;
    response: InterceptorManager<Response>;
  };

  /**
   * HTTP Methods
   * TResponse: 預期回傳的資料型別 (JSON)
   * TBody: 請求 Body 的型別
   */
  get: <TResponse>(endpoint: string, options?: CustomRequestInit) => Promise<TResponse>;

  post: <TResponse, TBody = Record<string, unknown>>(
    endpoint: string,
    body?: TBody,
    options?: CustomRequestInit,
  ) => Promise<TResponse>;

  put: <TResponse, TBody = Record<string, unknown>>(
    endpoint: string,
    body?: TBody,
    options?: CustomRequestInit,
  ) => Promise<TResponse>;

  // ✅ 新增 PATCH 方法定義
  patch: <TResponse, TBody = Record<string, unknown>>(
    endpoint: string,
    body?: TBody,
    options?: CustomRequestInit,
  ) => Promise<TResponse>;

  delete: <TResponse>(endpoint: string, options?: CustomRequestInit) => Promise<TResponse>;

  /**
   * SSE 專用方法
   */
  sse: (endpoint: string, options: SSEOptions) => SSEConnection;
}
