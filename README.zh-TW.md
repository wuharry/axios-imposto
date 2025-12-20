**繁體中文** | [English](./README.md)

# Axios Impostor 🎭

一個基於 Fetch API 的輕量級 HTTP 客戶端，模仿 Axios 的核心功能，包含 `axios.create()` 和 interceptor 機制。

## ✨ 特性

- 🚀 **基於現代 Fetch API** - 無需額外的依賴包
- 🔧 **axios.create() 風格** - 熟悉的 API 設計
- 🔄 **Request/Response Interceptors** - 完整的攔截器支援
- ⏱️ **請求超時控制** - 可自訂超時時間
- 📝 **TypeScript 支援** - 完整的型別定義
- 🎯 **自動 Content-Type 判斷** - 智慧處理 JSON 和 FormData
- 🛡️ **統一錯誤處理** - 一致的錯誤處理機制

## 📦 安裝

```bash
npm install axios-impostor
```

```bash
pnpm add axios-impostor
```

```bash
yarn add axios-impostor
```

## 🚀 快速開始

### 基本使用

```typescript
import { createFetchClient } from 'axios-impostor';

// 創建客戶端實例
const api = createFetchClient({
  baseURL: 'https://jsonplaceholder.typicode.com',
  headers: {
    Authorization: 'Bearer your-token',
    'X-Custom-Header': 'value',
  },
  timeout: 5000, // 5秒超時
});

// GET 請求
interface User {
  id: number;
  name: string;
  email: string;
}

const user = await api.get<User>('/users/1');
console.log(user.name);

// POST 請求
const newUser = await api.post<User>('/users', {
  name: 'John Doe',
  email: 'john@example.com',
});

// PUT 請求
const updatedUser = await api.put<User>('/users/1', {
  name: 'Jane Doe',
  email: 'jane@example.com',
});

// DELETE 請求
await api.delete('/users/1');
```

### 使用 Interceptors

```typescript
// Request Interceptor
api.interceptors.request.use(
  (config) => {
    // 在發送請求前做些什麼
    console.log('發送請求:', config);

    // 可以修改配置
    config.headers = {
      ...config.headers,
      'X-Timestamp': Date.now().toString(),
    };

    return config;
  },
  (error) => {
    // 對請求錯誤做些什麼
    console.error('請求錯誤:', error);
    return Promise.reject(error);
  },
);

// Response Interceptor
api.interceptors.response.use(
  (response) => {
    // 對響應數據做些什麼
    console.log('收到響應:', response);
    return response;
  },
  (error) => {
    // 對響應錯誤做些什麼
    if (error.message.includes('401')) {
      // 處理未授權錯誤，例如重新登入
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
```

### FormData 支援

```typescript
// 自動處理 FormData，無需手動設定 Content-Type
const formData = new FormData();
formData.append('file', file);
formData.append('name', 'document.pdf');

const response = await api.post('/upload', formData);
```

## 🔧 API 參考

### createFetchClient(options?)

創建一個新的 HTTP 客戶端實例。

**參數:**

```typescript
interface CreateFetchClientProp {
  baseURL?: string; // 基礎 URL
  headers?: HeadersInit; // 預設標頭
  timeout?: number; // 預設超時時間（毫秒）
}
```

**回傳值:**

```typescript
{
  // HTTP 方法
  get<T>(endpoint: string, options?: CustomRequestInit): Promise<T>
  post<T, B>(endpoint: string, body?: B, options?: CustomRequestInit): Promise<T>
  put<T, B>(endpoint: string, body?: B, options?: CustomRequestInit): Promise<T>
  delete<T>(endpoint: string, options?: CustomRequestInit): Promise<T>

  // 攔截器
  interceptors: {
    request: InterceptorManager<CustomRequestInit>
    response: InterceptorManager<Response>
  }
}
```

### Interceptor Manager

```typescript
// 註冊攔截器
const id = interceptors.request.use(fulfilled, rejected);

// 移除攔截器
interceptors.request.eject(id);
```

## 🎯 特色功能

### 智慧 Content-Type 處理

- **JSON 資料**: 自動設定 `Content-Type: application/json`
- **FormData**: 讓瀏覽器自動設定正確的 boundary
- **自訂覆蓋**: 可在 headers 中手動指定

### 請求超時控制

```typescript
// 全域設定
const api = createFetchClient({ timeout: 10000 });

// 單次請求設定
const data = await api.get('/slow-endpoint', { timeout: 30000 });
```

### 錯誤處理

- **HTTP 錯誤**: 自動檢查 `response.ok`，拋出相應錯誤
- **超時錯誤**: 轉換 AbortError 為可讀的超時訊息
- **204 No Content**: 回傳 `null`

## 🔄 與 Axios 的差異

| 功能                          | Axios Impostor | Axios          |
| ----------------------------- | -------------- | -------------- |
| 基底技術                      | Fetch API      | XMLHttpRequest |
| 包大小                        | 輕量           | 較大           |
| 瀏覽器支援                    | 現代瀏覽器     | 廣泛支援       |
| Request/Response Interceptors | ✅             | ✅             |
| 請求超時                      | ✅             | ✅             |
| 自動 JSON 解析                | ✅             | ✅             |
| Request/Response Transform    | ❌             | ✅             |
| 上傳進度                      | ❌             | ✅             |

## 🛠️ 開發

```bash
# 安裝依賴
pnpm install

# 開發模式
pnpm dev

# 建置
pnpm build

# 測試
pnpm test

# 程式碼檢查
pnpm lint

# 程式碼格式化
pnpm format
```

## 📄 授權

[0BSD License](LICENSE) - 可自由使用於任何目的

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

1. Fork 本專案
2. 創建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

---

如果這個套件對您有幫助，請給個 ⭐️ 支持一下！
