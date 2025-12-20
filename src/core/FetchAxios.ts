import type { CustomRequestInit, CreateFetchClientProp } from '../types';
import { buildURL } from '../utils/buildURL';
import { createInterceptorManager } from './interceptor';

export const createFetchClient = ({
  baseURL = '',
  headers: defaultHeaders = {},
  timeout: defaultTimeout = 10000,
}: CreateFetchClientProp = {}) => {
  // 初始化攔截器管理器
  const requestInterceptors = createInterceptorManager<CustomRequestInit>();
  const responseInterceptors = createInterceptorManager<Response>();

  /**
   * 💡 [核心功能]
   * 這是內部使用的通用 request 函式，負責處理所有的底層邏輯：
   * 1. 處理 Timeout
   * 2. 合併 Config
   * 3. 執行攔截器 (Interceptors)
   * 4. 發送 fetch
   * 5. 統一錯誤處理
   */
  const request = async (
    endpoint: string,
    options: CustomRequestInit = {},
  ): Promise<Response | null> => {
    // 1. 從 options 解構出 timeout 和 headers，並給予預設值, 其他的放在 customConfig 裡像是 method, body 等等
    const { timeout = defaultTimeout, headers = {}, ...customConfig } = options;

    /** * 💡 [說明] Controller 設定
     * controller 物件用於中止請求 (每個 request 都要新的 controller)
     * 我們利用 setTimeout 在超時後觸發 controller.abort()
     */
    const controller = new AbortController();
    // 設定 timeout, 超時後中止請求
    const id = setTimeout(() => controller.abort(), timeout);

    const url = buildURL(baseURL, endpoint);

    /**
     * 💡 [說明] Body 與 Content-Type 的自動判定機制
     * * body 影響 POST / PUT / PATCH 傳給後端的「資料長什麼樣」。
     * 後端會根據 Header 的 Content-Type，再用對應 parser 來解析 payload。
     * * 重要原則：
     * - 如果是 FormData: 瀏覽器會自動設定 boundary，絕對不要手動覆蓋它！
     * - 如果是 JSON: 我們幫忙設定 application/json
     */
    const contentTypeRaw =
      customConfig.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };

    // 2. 組合最終 Config
    let config: CustomRequestInit = {
      ...customConfig,
      headers: {
        // * 層級 1：程式自動判斷的 Content-Type
        ...contentTypeRaw,

        // * 層級 2：建立 client 時設定的「全域」header (強制轉型告知 TS)
        ...(defaultHeaders as Record<string, string>),

        // * 層級 3：這次請求「單次」傳入的 header (優先權最高)
        ...(headers as Record<string, string>),
      } as HeadersInit,
      signal: controller.signal,
      timeout,
    };

    // ------------------------------------------------------------
    // 🔄 [流程] 階段 A：執行 Request Interceptors (請求攔截器)
    // ------------------------------------------------------------
    // * 1. 建立 Promise 鏈的初始值 (config)
    // * 2. 讓 config 依序穿過每一個註冊的攔截器
    let configPromise = Promise.resolve(config);

    requestInterceptors.forEach((interceptor) => {
      configPromise = configPromise.then(interceptor.fulfilled, interceptor.rejected);
    });

    // * 3. 等待所有攔截器跑完，拿到最終處理過的 Config
    config = await configPromise;

    try {
      // ------------------------------------------------------------
      // 🚀 [流程] 階段 B：發送請求 (Fetch)
      // ------------------------------------------------------------
      let response = await fetch(url, config);

      // 請求成功回應，清除 timeout 計時器
      clearTimeout(id);

      // ------------------------------------------------------------
      // 🔄 [流程] 階段 C：執行 Response Interceptors (回應攔截器)
      // ------------------------------------------------------------
      // * 1. 建立 Promise 鏈的初始值 (response)
      // * 2. 讓 response 依序穿過每一個註冊的攔截器
      let responsePromise = Promise.resolve(response);

      responseInterceptors.forEach((interceptor) => {
        responsePromise = responsePromise.then(interceptor.fulfilled, interceptor.rejected);
      });

      // * 3. 等待所有攔截器跑完，拿到最終處理過的 Response
      response = await responsePromise;

      // ------------------------------------------------------------
      // 🛡️ [流程] 階段 D：統一錯誤處理
      // ------------------------------------------------------------
      // * 1. 檢查 HTTP 狀態碼 (攔截器之後執行，這樣攔截器可以優先處理 401 等狀況)
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.message || `HTTP Error: ${response.status}`);
      }

      // * 2. 特殊狀態碼處理 (204 No Content 回傳 null)
      if (response.status === 204) return null;

      return response;
    } catch (error: unknown) {
      // 發生錯誤，務必清除 timeout 避免內存洩漏
      clearTimeout(id);

      /**
       * 💡 [說明] Timeout 錯誤轉換
       * Fetch 的超時會拋出 AbortError，我們將其轉換為更易讀的 Error Message
       */
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout} ms`);
      }
      throw error;
    }
  };

  /**
   * 💡 [回傳物件]
   * 包含標準 HTTP 方法 (GET/POST...) 以及 interceptors 註冊接口
   */
  return {
    // 讓外部可以用 client.interceptors.request.use(...)
    interceptors: {
      request: requestInterceptors,
      response: responseInterceptors,
    },

    get: async <TResponse>(
      endpoint: string,
      options: CustomRequestInit = {},
    ): Promise<TResponse> => {
      const response = await request(endpoint, {
        ...options,
        method: 'GET',
      });
      return response ? ((await response.json()) as TResponse) : (null as TResponse);
    },

    post: async <TResponse, TBody = Record<string, unknown>>(
      endpoint: string,
      body?: TBody,
      options: CustomRequestInit = {},
    ): Promise<TResponse> => {
      // 準備 Body
      let bodyToSend: string | FormData | undefined;

      if (body instanceof FormData) {
        bodyToSend = body;
      } else if (body) {
        bodyToSend = JSON.stringify(body);
      } else {
        bodyToSend = undefined;
      }

      const response = await request(endpoint, {
        ...options,
        method: 'POST',
        body: bodyToSend,
      });
      return response ? ((await response.json()) as TResponse) : (null as TResponse);
    },

    put: async <TResponse, TBody = Record<string, unknown>>(
      endpoint: string,
      body?: TBody,
      options: CustomRequestInit = {},
    ): Promise<TResponse> => {
      // 準備 Body (邏輯同 POST)
      let bodyToSend: string | FormData | undefined;

      if (body instanceof FormData) {
        bodyToSend = body;
      } else if (body) {
        bodyToSend = JSON.stringify(body);
      } else {
        bodyToSend = undefined;
      }

      const response = await request(endpoint, {
        ...options,
        method: 'PUT',
        body: bodyToSend,
      });
      return response ? ((await response.json()) as TResponse) : (null as TResponse);
    },

    delete: async <TResponse>(
      endpoint: string,
      options: CustomRequestInit = {},
    ): Promise<TResponse> => {
      const response = await request(endpoint, {
        ...options,
        method: 'DELETE',
      });
      return response ? ((await response.json()) as TResponse) : (null as TResponse);
    },
  };
};
