# 醫療法規標準資料庫查詢器

目前版本是 metadata 索引 MVP，會掃描既有資料夾，依檔名與路徑產生初步法域、文件性質與醫療主題分類，並提供簡易搜尋頁面。Office 文件會讀取 ZIP/XML 文字；PDF 內容解析需另外以 `PDF_TEXT=1` 啟用，掃描型 PDF 仍需 OCR。

## 建立索引

```powershell
npm run index -- "D:\6.查检相关法律法规"
```

索引會產生於 `data/index.json`。原始資料夾只讀取，不會搬移、改名或修改檔案。

## 產生分類報告

```powershell
node src/report.mjs
```

報告會產生於 `data/classification/`：

- `classification-report.csv`：全部文件的分類結果
- `review-queue.csv`：低信心、需要人工確認的文件
- `classification-summary.json`：各分類統計

## 啟動查詢器

```powershell
npm start
```

瀏覽 `http://localhost:3000`。

API：

- `GET /api/health`
- `GET /api/search?q=感染&jurisdiction=CN`

## 目前限制

- PDF、DOCX、XLSX 目前先建立檔名與路徑 metadata，不抽取文件內文。
- 自動分類是初步候選分類，`reviewStatus` 預設為 `unreviewed`。
- 尚未連接既有資料庫、SSO 或 OpenSearch/Elasticsearch。
- 正式上線前需要人工審核分類與法規有效狀態。
