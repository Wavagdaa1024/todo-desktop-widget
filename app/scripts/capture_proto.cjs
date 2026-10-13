const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const htmlPath = 'C:/Users/wt/Downloads/AI_Task_Board_Personal_Taskline_Expandable_v2 (1).html';
const outputDir = 'C:/Users/wt/.gemini/antigravity/brain/f65a0339-28b4-47de-bd57-9887d7ecc76d';

async function captureScenario(win, scenarioId, filename, { fit = false } = {}) {
  console.log(`Setting scenario: ${scenarioId}...`);
  await win.webContents.executeJavaScript(`
    (() => {
      const btn = document.getElementById('${scenarioId}');
      if (btn) btn.click();
      if (${fit}) {
        const fitBtn = document.getElementById('fitView');
        if (fitBtn) fitBtn.click();
      }
      const toast = document.getElementById('toast');
      if (toast) toast.classList.remove('on');
    })()
  `);

  await win.webContents.executeJavaScript(`
    new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 300);
        });
      });
    })
  `);
  await new Promise(r => setTimeout(r, 600));

  const image = await win.webContents.capturePage();
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, image.toPNG());
  console.log(`Saved ${filename} (${image.getSize().width}x${image.getSize().height})`);
}

async function run() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false
    }
  });

  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
  await win.loadURL(fileUrl);
  await new Promise(r => setTimeout(r, 1000));

  // Scenario 1: Only 1 completed node
  await captureScenario(win, 'scene1Btn', 'screenshot_scenario_1.png');

  // Scenario 2: 5 completed nodes auto-collapsed
  await captureScenario(win, 'scene2Btn', 'screenshot_scenario_2.png');

  // Scenario 3: 5 completed nodes expanded with parallel & merge branches (fitted to view so all nodes and branches are visible)
  await captureScenario(win, 'scene3Btn', 'screenshot_scenario_3.png', { fit: true });

  console.log('All 3 scenarios captured successfully.');
  app.quit();
}

app.whenReady().then(run).catch(err => {
  console.error(err);
  app.quit();
});
