# 專案交接紀錄

## 專案

醫療法規標準資料庫查詢器

## 最後更新

2026-09-15

## 目前狀態

- 已建立 Node.js MVP。
- 已掃描 `D:\6.查检相关法律法规`。
- 共掃描 2,725 個檔案，建立 2,705 筆索引。
- 已建立台灣／中國大陸法域、文件性質與醫療主題的初步分類。
- 已分類候選 2,703 筆，待確認 2 筆。
- 已讀取 299 份 DOCX／XLSX／PPTX 的 Office XML 文字。
- PDF 目前主要依檔名、資料夾及標準號分類；掃描型 PDF 尚未 OCR。
- 本地查詢器目前可由 `http://localhost:3000` 開啟。
- 查詢介面已改為三層瀏覽：第一層分類、第二層地區／年份、第三層文件結果。
- 索引已新增 `region`、`year`、`years` 欄位。
- 已重新產生分類報告，確認待確認清單與摘要一致：2 筆待確認。
- 已用隔離埠驗證本地服務：首頁 200、健康檢查 2,705 筆、感染搜尋 190 筆。

## 主要檔案

- `SPEC-醫療法規標準資料庫查詢器.md`：系統規格
- `src/indexer.mjs`：索引建立器
- `src/classifier.mjs`：分類規則
- `src/office-text.mjs`：Office XML 文字擷取
- `src/pdf-text.mjs`：PDF 文字層解析實驗功能
- `src/server.mjs`：本地查詢 API 與 Web 介面
- `data/index.json`：目前索引
- `data/classification/classification-report.csv`：完整分類報告
- `data/classification/review-queue.csv`：待確認清單

## 已完成工作

1. 建立分類與搜尋 Spec。
2. 建立檔案掃描、索引與分類流程。
3. 建立分類報告與待確認清單。
4. 建立本地搜尋 API。
5. 重新設計查詢介面，支援先看分類再搜尋。
6. 驗證本地服務及分類查詢 API 可正常運作。

## 下一步待辦

- 讀取並分類剩餘 PDF 內文。
- 導入 OCR，處理掃描型 PDF。
- 建立人工分類審核介面。
- 確認既有資料庫的資料表與 API 規格。
- 將 JSON 索引替換為正式搜尋引擎或資料庫索引。
- 加入文件內容預覽、來源連結與版本比較。
- 加入院內 SSO、權限與稽核紀錄。
- 依使用者實際操作回饋，持續調整分類卡片、地區及年份的呈現方式。
- 目前兩筆待確認 PDF 不在索引記錄的 `D:\6.查检相关法律法规`，需補回原始檔或提供新來源路徑後才能判讀／OCR。

## 重要注意事項

- 原始資料夾只讀取，尚未搬移、改名或刪除任何原始文件。
- 目前分類屬於自動分類候選，不代表法規內容已經人工或官方來源確認。
- 啟動本地服務：`npm.cmd start`
- 重新建立索引：`npm.cmd run index -- "D:\6.查检相关法律法规"`
- 產生分類報告：`node src/report.mjs`

## 最近一次工作結果

- 已重新設計本地查詢頁面，讓使用者可先目視瀏覽醫療主題與文件類型。
- 已加入依目前第一層篩選連動的地區／省份與年份第二層分類。
- 已重新建立索引：2,705 筆文件。
- 已驗證「感染預防與控制」可取得 296 筆資料。
- 已驗證首頁、分類 API、搜尋 API 及前端 JavaScript 語法。
- 本地服務目前以 `http://localhost:3000` 運行；若服務已停止，下次可用 `npm.cmd start` 重新啟動。

## 2026-09-15 開工與收工結果

- 檢查 `data/classification/review-queue.csv`，確認目前只有 2 筆低信心 PDF。
- 發現 `classification-summary.json` 是舊報告，已執行 `node src/report.mjs` 重新產生；摘要現為 total 2705、autoCandidates 2703、needsReview 2。
- `node --check src/server.mjs` 與 `node --check src/indexer.mjs` 通過。
- 使用 3317 隔離埠驗證：`/` 回應 200、`/api/health` indexed 2705、`/api/search?q=感染` 回傳 190 筆。
- 3000 埠已有其他服務，直接檢查曾收到 404；不代表本專案路由失敗。

### 目前阻塞

- 兩筆待確認 PDF 的 `absolutePath` 均不存在，工作區也沒有同名檔案，暫不能進行內容判讀或 OCR。

### 下一步

1. 取得兩筆 PDF 或新的來源根路徑後，重新執行索引並啟用 PDF 文字層／OCR流程。
2. 原始檔可取得前，先設計人工分類審核介面與審核資料格式。

### 今日部署

- 已初始化 Git 並推送至 `https://github.com/emmyyang1972/0915check.git`。
- 已連結 Vercel 專案 `0915check` 並完成 production 部署。
- 線上網址：`https://0915check.vercel.app`。
- 線上驗證：首頁 200、`/api/health` 2,705 筆、`/api/facets` 2,705 筆、`/api/search?q=感染` 190 筆。
- Vercel API 路由修正提交為 `6dc1778`；最新 repo 提交為 `58a51fc`。

## 開工規則

當使用者輸入「開工」時，先讀取本檔案與 `worklog.md`，了解上一次的工作狀況、未完成事項及下一步，再開始執行新工作。

## 2026-09-15 新資料來源重建索引

- 使用新來源根路徑 `C:\6.查检相关法律法规` 重新建立索引。
- 掃描 2,730 個檔案，成功索引 2,707 筆，23 個不支援格式。
- 分類報表：2,573 筆候選、134 筆需人工覆核。
- 2,315 份 PDF 保留 `pdf_pending_text_extraction` 狀態；299 份 Office 文件完成 XML 文字抽取。
- Node.js 原生 JSON 解析及報表行數驗證通過；`review-queue.csv` 含標題共 135 行。

### 下一步

1. 檢視新的 134 筆人工覆核清單。
2. 需要 PDF 內容判讀時，再啟用 PDF 文字層抽取或 OCR。

## 2026-09-15 查詢器介面重製

- 依分類資料重製 `public/index.html`：改為搜尋列、統計摘要、左側醫療主題、右側篩選與結果的單一路徑介面。
- 法域、文件類型、地區／省份、年份集中在篩選列；目前條件以可移除標籤顯示。
- 結果卡片補上分類標籤、檔案格式、修改日期、分類信心與「開啟原始檔」操作。
- `src/server.mjs` 新增 `/api/file?id=...`，依索引文件 ID 回傳本地原始檔。
- 驗證通過：`node --check src/server.mjs`、UI script compile、`/api/health` 2,707 筆、CN 篩選 336 筆、感染搜尋 414 筆、原始檔 API HTTP 200。
- 瀏覽器自動化環境沒有可用瀏覽器，未完成截圖式視覺檢查。
