**繁體中文** | [English](./README.md)

# Axios Impostor 🎭

這份說明只專注在：**怎麼用**、**有哪些型別**、**這些型別建議用在哪裡**，不會介紹專案本身的架構或技術細節。

## 安裝

```bash
npm install axios-impostor
# 或
pnpm add axios-impostor
# 或
yarn add axios-impostor
```

---

## 1. 建議的使用方式

在你的專案裡，建議這樣拆：

1. **建立一個共用的 client 實例**
   - 放在像是 `src/api/client.ts` 的檔案裡。
   - 在這裡設定 `baseURL`、`timeout`、預設 `headers`、interceptors 等。
2. **每個領域/模組各自一組 API 函式**
   - 例如 `src/api/users.ts` 裡面只放「使用者相關」的 API：`getUser`、`createUser`...
   - 這些函式回傳明確的型別（例如 `Promise<User>`），內部再呼叫 `api.get<User>()`。
3. **錯誤處理集中在 UI 或服務層**
   - 當需要依 HTTP 狀態碼、錯誤 code 做判斷時，使用 `FetchClientError`。
4. **SSE 相關放在獨立模組**
   - 例如 `src/api/stream.ts`，裡面只放用 `api.sse()` 建立串流的 helper（聊天室、通知、AI 串流等）。

不需要知道這個套件內部怎麼實作，只要照下面的使用方式即可。

---

## 2. 可直接複製的範例（REST + 錯誤處理）

```typescript
import { createFetchClient, FetchClientError } from 'axios-impostor';

// 1. 定義回傳資料型別
interface User {
  id: number;
  name: string;
  email: string;
}

// 2. 建立共用 client（建議放在 src/api/client.ts）
export const api = createFetchClient({
  baseURL: 'https://jsonplaceholder.typicode.com',
  timeout: 10000,
});

// 3. 針對單一資源寫小函式（建議放在 src/api/users.ts）
export async function getUser(userId: number): Promise<User> {
  return api.get<User>(`/users/${userId}`);
}

export async function createUser(input: Pick<User, 'name' | 'email'>): Promise<User> {
  return api.post<User, typeof input>('/users', input);
}

// 4. 在 UI / service 內使用
async function example() {
  try {
    const user = await getUser(1);
    console.log('User name:', user.name);
  } catch (error) {
    if (error instanceof FetchClientError) {
      console.error('請求失敗', {
        code: error.code,
        status: error.response?.status,
        url: (error.config as any).url,
      });
    }
    throw error;
  }
}
```

這個範例可以直接複製使用，只要：
- 把 `baseURL` 改成你自己的 API 網域。
- 在不同檔案中依照資源拆分（例如 `users.ts`、`posts.ts`）。
- 所有程式共用同一個 `api` 實例。

---

## 3. 可直接複製的範例（SSE 串流）

```typescript
import { api } from './client'; // 從前一個範例共用同一個 client
import type { SSEMessage, SSEConnection } from 'axios-impostor';

export function subscribeChat(
  roomId: string,
  onMessage: (data: unknown) => void,
): SSEConnection {
  const connection = api.sse(`/chat/rooms/${roomId}/stream`, {
    headers: {
      Authorization: 'Bearer your-token',
    },
    onOpen: () => {
      console.log('SSE 已連線');
    },
    onMessage: (message: SSEMessage) => {
      // 很多後端會把 JSON 字串塞在 message.data 內
      try {
        const parsed = JSON.parse(message.data);
        onMessage(parsed);
      } catch {
        onMessage(message.data);
      }
    },
    onError: (error) => {
      console.error('SSE 錯誤', error);
    },
    onClose: () => {
      console.log('SSE 已關閉');
    },
  });

  return connection;
}

// 使用方式
const connection = subscribeChat('room-1', (payload) => {
  console.log('聊天更新:', payload);
});

// 需要停止監聽時
connection.close();
```

---

## 4. Public API 總覽

### `createFetchClient(options?: CreateFetchClientProp)`

建立一個可重複使用的 HTTP client 實例。

**選項（`CreateFetchClientProp`）:**
- `baseURL?: string` – 所有相對路徑 endpoint 都會加在這個前面。
- `headers?: HeadersInit` – 每個請求都會帶上的預設 headers。
- `timeout?: number` – 預設超時時間（毫秒）。
- `credentials?: RequestCredentials` – Cookie / 認證傳送策略（`'omit' | 'same-origin' | 'include'`）。

**回傳值（`FetchClient`）包含：**
- `get<T>(endpoint: string, options?: CustomRequestInit): Promise<T>`
- `post<T, B>(endpoint: string, body?: B, options?: CustomRequestInit): Promise<T>`
- `put<T, B>(endpoint: string, body?: B, options?: CustomRequestInit): Promise<T>`
- `patch<T, B>(endpoint: string, body?: B, options?: CustomRequestInit): Promise<T>`
- `delete<T>(endpoint: string, options?: CustomRequestInit): Promise<T | null>`
- `sse(endpoint: string, options: SSEOptions): SSEConnection`
- `interceptors.request: InterceptorManager<CustomRequestInit>`
- `interceptors.response: InterceptorManager<Response>`

**方法行為說明：**
- 所有 HTTP 方法都會嘗試將回應 **解析為 JSON**，並以型別 `T` 回傳。
- 若狀態碼是 `204 No Content`，回傳值為 **`null`**。
- 非 2xx 狀態碼會丟出 `FetchClientError`。

### `interceptors`

- **Request interceptors**：適合用來加上 Token、追蹤 ID、log 等。
- **Response interceptors**：適合用來統一處理 401、顯示全域錯誤訊息等。

範例：

```typescript
api.interceptors.request.use((config) => {
  config.headers = {
    ...config.headers,
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  };
  return config;
});
```

---

## 5. 型別說明與建議放置位置

### `CustomRequestInit`

在原生 `RequestInit` 上額外加上：
- `timeout?: number` – 單次請求專用的超時時間，會覆蓋 client 預設值。
- `isStream?: boolean` – 內部使用的旗標，通常不需要自己設定。
- `url?: string` – 由 client 內部填入實際請求的 endpoint。
- `baseURL?: string` – 由 client 內部填入使用的 baseURL。

**適合用在：**
- 寫工具函式時，讓參數 `options?: CustomRequestInit` 能完全轉給 `api` 來使用。

### `FetchClient`

`createFetchClient` 回傳物件的型別。

**適合用在：**
- 宣告共用 client：`const api: FetchClient = createFetchClient(...)`。
- 需要把 client 注入到 service / hook / 測試時，作為參數型別使用。

### `FetchClientError`

當以下情況發生時會丟出的錯誤型別：
- 請求逾時。
- 網路錯誤。
- 伺服器回傳非 2xx 狀態碼（4xx / 5xx）。

比內建 `Error` 多出：
- `code?: string` – 例如 `'ERR_NETWORK'`、`'ERR_BAD_RESPONSE'`、`'ECONNABORTED'`。
- `config: CustomRequestInit` – 最後實際送出的設定。
- `request?: Request` – 底層的 `Request` 物件（有的環境才會有）。
- `response?: Response` – 底層的 `Response` 物件。

**適合用在：**
- 全域錯誤處理（例如 React Error Boundary 或 toast 通知）。
- 寫 log / 監控系統時，收集錯誤相關資訊。

### `InterceptorManager<T>` / `InterceptorHandler<T>`

你不需要自己 new，只會透過 `api.interceptors.request` / `api.interceptors.response` 使用。

**適合用在：**
- 呼叫 `use` 新增攔截器、`eject` 移除攔截器時，作為回傳 ID 的型別與說明參考。

### `SSEMessage`

代表一則從 SSE 串流來的訊息：
- `data: string` – 訊息內容（常見是 JSON 字串）。
- `event?: string` – 事件名稱。
- `id?: string` – 訊息 ID。
- `retry?: number` – 伺服器建議的重試間隔（毫秒）。

**適合用在：**
- 型別標註 SSE handler：`onMessage: (message: SSEMessage) => void`。

### `SSEOptions`

`api.sse()` 使用的設定物件：
- 繼承 `CustomRequestInit`（但移除 `method`，因為 SSE 一定是 GET）。
- 多了：`onOpen`、`onMessage`、`onError`、`onClose` 四個 callback。

**適合用在：**
- 你自己包一層 SSE helper 函式時，讓參數型別直接用 `SSEOptions`。

### `SSEConnection`

`api.sse()` 回傳的控制物件：
- `close(): void` – 手動關閉連線。
- `readyState: 'connecting' | 'open' | 'closed'` – 目前連線狀態。

**適合用在：**
- React / Vue / Svelte 等框架中的 effect 或 hook，管理串流生命週期。

---

## 6. 授權

[MIT License](LICENSE)
