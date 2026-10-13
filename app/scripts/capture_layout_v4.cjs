const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const htmlPath = 'C:/Users/wt/Downloads/AI_Task_Board_Clean_Layout_v4.html';
const outputDir = 'C:/Users/wt/.gemini/antigravity/brain/f65a0339-28b4-47de-bd57-9887d7ecc76d';

async function waitFrames(win) {
  await win.webContents.executeJavaScript(`
    new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 350);
        });
      });
    })
  `);
  await new Promise(r => setTimeout(r, 450));
}

async function run() {
  const win = new BrowserWindow({
    width: 1440,
    height: 880,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false
    }
  });

  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
  await win.loadURL(fileUrl);
  await new Promise(r => setTimeout(r, 1200));

  // 1. Screenshot 1: 三条任务线的切换状态 (Showing top tabs + compact overview popover)
  console.log('Capturing Screenshot 1: Tabs Switching State...');
  await win.webContents.executeJavaScript(`
    window.__setScenarioState({
      projectId: 'fmu',
      selectedNodeId: null,
      collapseHistory: true,
      zoom: 1
    });
    // Open the compact project overview list to highlight the multi-project navigation
    const overviewBtn = document.getElementById('btnToggleOverview');
    if (overviewBtn) overviewBtn.click();
  `);
  await waitFrames(win);
  let img1 = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outputDir, 'screenshot_tabs_switching.png'), img1.toPNG());
  console.log('Saved screenshot_tabs_switching.png');

  // Close overview popover before next shots
  await win.webContents.executeJavaScript(`
    document.getElementById('popoverOverview').classList.remove('show');
  `);

  // 2. Screenshot 2: 一条包含两个并行分支的任务线 (No giant grey columns, clean auto-layout, full canvas)
  console.log('Capturing Screenshot 2: Parallel Branches Taskline...');
  await win.webContents.executeJavaScript(`
    window.__setScenarioState({
      projectId: 'robot',
      selectedNodeId: null,
      collapseHistory: true,
      zoom: 1
    });
  `);
  await waitFrames(win);
  let img2 = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outputDir, 'screenshot_parallel_branches.png'), img2.toPNG());
  console.log('Saved screenshot_parallel_branches.png');

  // 3. Screenshot 3: 点击节点后的详情面板 (<=360px right inspector, non-blocking, in-place actions, no modal popups)
  console.log('Capturing Screenshot 3: Inspector Panel...');
  await win.webContents.executeJavaScript(`
    window.__setScenarioState({
      projectId: 'robot',
      selectedNodeId: 'r7', // Select the review node
      collapseHistory: true,
      zoom: 1
    });
  `);
  await waitFrames(win);
  let img3 = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outputDir, 'screenshot_inspector_panel.png'), img3.toPNG());
  console.log('Saved screenshot_inspector_panel.png');

  console.log('All 3 requested screenshots captured successfully.');
  app.quit();
}

app.whenReady().then(run).catch(err => {
  console.error(err);
  app.quit();
});
