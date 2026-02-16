# Lucky Paws Scratchers

這是一個使用 React + Vite + TypeScript 構建的刮刮樂應用程式。

## 開始使用

### 先決條件

- Node.js (建議 v18 或更高版本)
- npm

### 安裝

1. 克隆存儲庫：
   ```bash
   git clone https://github.com/stevenbocheng/Scratch-off-card.git
   cd Scratch-off-card
   ```

2. 安裝依賴項：
   ```bash
   npm install
   ```

3. 啟動開發伺服器：
   ```bash
   npm run dev
   ```

## 可用腳本

在專案目錄中，您可以運行：

- `npm run dev`：在開發模式下啟動應用程序。
- `npm run build`：將應用程序構建到 `dist` 文件夾中以進行生產。
- `npm run preview`：在本地預覽生產構建。
- `npm run lint`：運行 ESLint 檢查代碼質量。
- `npm run deploy`：手動將應用程序部署到 GitHub Pages。

## 部署

本專案使用 GitHub Actions 自動部署到 GitHub Pages。

1. 確保您的 GitHub 存儲庫設置中的 **Pages** 選項卡下，**Source** 設置為 "GitHub Actions" 或確保 "Deploy from a branch" 選中的是 `gh-pages` 分支（如果是手動部署）。
2. 對於自動部署（推薦）：
   - 推送代碼到 `main` 分支。
   - GitHub Action `Deploy to GitHub Pages` 將自動運行並部署到 `gh-pages` 環境。
3. 對於手動部署：
   - 運行 `npm run deploy`。

## 技術棧

- React 19
- TypeScript
- Vite
- Tailwind CSS (如果有的話)
- Framer Motion
- Lucide React
