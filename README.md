# 醫療法規標準資料庫查詢器

目前版本會從指定來源資料夾全量重建索引，原始資料夾是唯一內容來源，不沿用舊索引或舊分類結果。索引會保存來源路徑、科別／子分類／年份、內容雜湊、可讀文字樣本與分類信心；掃描型 PDF 會標記為待 OCR，不會被當成空文件。

## 建立索引

```powershell
$env:PDF_TEXT='1'
npm.cmd run index -- "C:\6.查检相关法律法规"
```

索引會產生於 `data/index.json`。每次執行都會從來源重新讀取；原始資料夾只讀取，不會搬移、改名或修改檔案。

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
npm.cmd start
```

瀏覽 `http://localhost:3000`。

API：

- `GET /api/health`
- `GET /api/search?q=感染&jurisdiction=CN`

## 目前限制

- DOC、WPS、舊式二進位格式及掃描型 PDF 可能只有檔名與路徑 metadata；`contentExtraction` 會記錄原因。
- 自動分類是初步候選分類，`reviewStatus` 預設為 `unreviewed`；法域不明或需要 OCR 的資料會進入 review queue。
- 尚未連接既有資料庫、SSO 或 OpenSearch/Elasticsearch。
- 正式上線前需要人工審核分類與法規有效狀態。
