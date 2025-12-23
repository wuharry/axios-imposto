import {
  FetchClientError,
  type CreateFetchClientProp,
  type CustomRequestInit,
  type ErrorResponse,
  type InterceptorManager,
  type SSEConnection,
  type SSEOptions,
} from '../types';

import { buildURL } from '../utils/buildURL';
import { parseSSEMessage } from '../utils/parseSSE';
import { createInterceptorManager } from './interceptor';

type RequestBody = string | FormData | undefined;

export const createFetchClient = ({
  baseURL = '',
  headers: defaultHeaders = {},
  timeout: defaultTimeout = 10000,
  credentials: defaultCredentials = 'same-origin',
}: CreateFetchClientProp = {}) => {
  // 初始化攔截器管理器
  const requestInterceptors: InterceptorManager<CustomRequestInit> =
    createInterceptorManager<CustomRequestInit>();
  const responseInterceptors: InterceptorManager<Response> = createInterceptorManager<Response>();
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
    isStream = false,
  ): Promise<Response | null> => {
    // 1. 從 options 解構出 timeout 和 headers，並給予預設值, 其他的放在 customConfig 裡像是 method, body 等等
    const { timeout = defaultTimeout, headers = {}, ...customConfig } = options;

    /** * 💡 [說明] Controller 設定
     * controller 物件用於中止請求 (每個 request 都要新的 controller)
     * 我們利用 setTimeout 在超時後觸發 controller.abort()
     */
    const controller = new AbortController();

    // ✅ 使用 number 類型，相容瀏覽器和 Node.js
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // 設定 timeout, 超時後中止請求(如果不是 stream 請求)
    if (!isStream) {
      timeoutId = setTimeout(() => controller.abort(), timeout);
    }

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
      // 優先權：單次請求 > 全域設定 > 預設值
      credentials: defaultCredentials, // ✅ 注入 credentials 設定
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
      isStream,
      url: endpoint,
      baseURL: baseURL,
    };

    // ------------------------------------------------------------
    // 🔄 [流程] 階段 A：執行 Request Interceptors (請求攔截器)
    // ------------------------------------------------------------
    // * 1. 建立 Promise 鏈的初始值 (config)
    // * 2. 讓 config 依序穿過每一個註冊的攔截器
    let configPromise = Promise.resolve(config);

    requestInterceptors.forEach((interceptor) => {
      configPromise = configPromise.then(
        interceptor.fulfilled,
        interceptor.rejected,
      ) as Promise<CustomRequestInit>;
    });

    // * 3. 等待所有攔截器跑完，拿到最終處理過的 Config
    config = await configPromise;

    try {
      // ------------------------------------------------------------
      // 🚀 [流程] 階段 B：發送請求 (Fetch)
      // ------------------------------------------------------------
      let response = await fetch(url, config);
      // ✅ 把 config 掛載到原生 Response 物件上
      // 這樣你的攔截器才能讀到 response.config.url
      Object.defineProperty(response, 'config', {
        value: config,
        writable: false,
        enumerable: false, // 避免被 JSON.stringify 序列化
      });
      // 請求成功回應，清除 timeout 計時器
      if (!isStream && timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      // ------------------------------------------------------------
      // 🔄 [流程] 階段 C：執行 Response Interceptors (回應攔截器)
      // ------------------------------------------------------------
      // * 1. 建立 Promise 鏈的初始值 (response)
      // * 2. 讓 response 依序穿過每一個註冊的攔截器
      let responsePromise = Promise.resolve(response);

      responseInterceptors.forEach((interceptor) => {
        responsePromise = responsePromise.then(
          interceptor.fulfilled,
          interceptor.rejected,
        ) as Promise<Response>;
      });

      // * 3. 等待所有攔截器跑完，拿到最終處理過的 Response
      response = await responsePromise;

      // ✅ 如果是 Stream，直接返回 response，不做額外處理
      if (isStream) {
        return response;
      }

      // ------------------------------------------------------------
      // 🛡️ [流程] 階段 D：統一錯誤處理
      // ------------------------------------------------------------
      // * 1. 檢查 HTTP 狀態碼 (攔截器之後執行，這樣攔截器可以優先處理 401 等狀況)
      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as ErrorResponse | null;
        const message = errorBody?.message ?? `Request failed with status ${response.status}`;
        // throw new Error(errorBody?.message ?? `HTTP Error: ${response.status}`);
        throw new FetchClientError(
          message,
          config,
          'ERR_BAD_RESPONSE', // 自定義錯誤代碼
          undefined,
          response, // 把 response 塞進去
        );
      }

      // * 2. 特殊狀態碼處理 (204 No Content 回傳 null)
      if (response.status === 204) return null;

      return response;
    } catch (error: unknown) {
      // 發生錯誤，務必清除 timeout 避免內存洩漏
      clearTimeout(timeoutId);

      /**
       * 💡 [說明] Timeout 錯誤轉換
       * Fetch 的超時會拋出 AbortError，我們將其轉換為更易讀的 Error Message
       */
      // if ((error as Error).name === 'AbortError') {
      //   throw new Error(`Request timeout after ${timeout} ms`);
      // }
      if ((error as Error).name === 'AbortError') {
        throw new FetchClientError(`Request timeout after ${timeout} ms`, config, 'ECONNABORTED');
      }
      // 處理既有的 FetchClientError (上面拋出的 4xx/5xx)
      if (error instanceof FetchClientError) {
        throw error;
      }
      // 處理真正的網路錯誤 (Network Error)
      throw new FetchClientError((error as Error).message, config, 'ERR_NETWORK');
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
    /**
     * ✅ SSE 專用方法
     * Why: 解決 EventSource 無法帶 Header 的問題，並處理串流解析
     * What: 建立長連線，持續監聽 server 推送的 data
     */
    sse: (endpoint: string, options: SSEOptions): SSEConnection => {
      const { onOpen, onMessage, onError, onClose, ...requestOptions } = options;
      let readyState: 'connecting' | 'open' | 'closed' = 'connecting';
      // 瀏覽器原生 的 API
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      let isClosed = false; // 預防競態條件, 確保 close 只執行一次,不會同時呼叫多次

      const connection: SSEConnection = {
        close: () => {
          if (isClosed) return;
          isClosed = true;
          readyState = 'closed';

          if (reader) {
            // 取消讀取器，這會讓瀏覽器中斷 HTTP 連線
            reader.cancel().catch(() => {
              /* empty */
            });
            reader = null;
          }
          onClose?.();
        },
        get readyState() {
          return readyState;
        },
      };
      // IIFE: 立即執行，背景連線
      void (async () => {
        try {
          const response = await request(
            endpoint,
            {
              ...requestOptions,
              method: 'GET', // SSE 必須是 GET
              headers: {
                ...requestOptions.headers,
                Accept: 'text/event-stream',
                'Cache-Control': 'no-cache',
              },
            },
            true, // isStream = true
          );
          // 如果 response 是 undefined，response?.body 就是 undefined，!undefined 就是 true (報錯)。
          // 如果 body 是 null，!null 也是 true (報錯)。
          if (!response?.body) {
            throw new Error('ReadableStream not supported');
          }

          if (!response.ok) {
            throw new Error(`SSE error: ${response.status}`);
          }

          readyState = 'open';
          onOpen?.();

          reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (!isClosed) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // 1. 切割每一條完整的 SSE 訊息 (以 \n\n 分界)
            const parts = buffer.split('\n\n');

            // 2. 把最後一塊(可能不完整)留回 buffer 等下一波
            buffer = parts.pop() ?? '';

            // 3. 處理切下來的每一塊
            for (const part of parts) {
              if (!part.trim()) continue;

              const message = parseSSEMessage(part);

              if (message) {
                onMessage(message);
              }
            }
          }
          connection.close();
        } catch (error) {
          if (!isClosed) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
            connection.close();
          }
        }
      })();

      // 立刻回傳控制物件，不讓 UI 等待
      return connection;
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
      let bodyToSend: RequestBody;

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
      let bodyToSend: RequestBody;

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
    patch: async <TResponse, TBody = Record<string, unknown>>(
      endpoint: string,
      body?: TBody,
      options: CustomRequestInit = {},
    ): Promise<TResponse> => {
      let bodyToSend: RequestBody;

      if (body instanceof FormData) {
        bodyToSend = body;
      } else if (body) {
        bodyToSend = JSON.stringify(body);
      } else {
        bodyToSend = undefined;
      }

      const response = await request(endpoint, {
        ...options,
        method: 'PATCH',
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
