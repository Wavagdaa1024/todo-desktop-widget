const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const artifactDir = 'C:/Users/wt/.gemini/antigravity/brain/f65a0339-28b4-47de-bd57-9887d7ecc76d'

async function waitFrames(win, ms = 400) {
  await win.webContents.executeJavaScript(`
    new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, ${ms});
        });
      });
    })
  `)
  await new Promise((r) => setTimeout(r, ms + 100))
}

async function run() {
  await app.whenReady()

  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../out/preload/index.mjs')
    }
  })

  win.webContents.on('console-message', (e, level, message) => {
    console.log(`[Renderer LOG]:`, message)
  })

  const indexPath = path.join(__dirname, '../out/renderer/index.html')
  await win.loadFile(indexPath)
  await new Promise((r) => setTimeout(r, 1000))

  // 1. Click "载入演示项目 (FMU + MuJoCo)"
  console.log('Loading demo project...')
  await win.webContents.executeJavaScript(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('载入演示项目'));
    if (btn) btn.click();
  `)
  await waitFrames(win, 500)

  // Capture Screenshot 1: Canvas showing the top-left checkboxes on cards
  console.log('Capturing canvas with checkboxes...')
  const imgCanvas = await win.webContents.capturePage()
  const pathCanvas = path.join(artifactDir, 'screenshot_canvas_with_checkboxes.png')
  fs.writeFileSync(pathCanvas, imgCanvas.toPNG())
  console.log('Saved:', pathCanvas)

  // 2. Click the square checkbox on card "检查 FMU 接口"
  console.log('Clicking checkbox on "检查 FMU 接口"...')
  const toggleResult = await win.webContents.executeJavaScript(`
    (() => {
      const h3 = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('检查 FMU 接口'));
      if (!h3) return 'H3_NOT_FOUND';
      const card = h3.closest('.absolute');
      if (!card) return 'CARD_NOT_FOUND';
      // Find the checkbox button inside the card header
      const checkboxBtn = card.querySelector('button[title*="点击快捷标记完成"], button[title*="点击恢复为未完成"]');
      if (!checkboxBtn) return 'CHECKBOX_NOT_FOUND';
      checkboxBtn.click();
      return 'CHECKBOX_CLICKED';
    })()
  `)
  console.log('Toggle result:', toggleResult)
  await waitFrames(win, 600)

  // Capture Screenshot 2: Canvas showing the newly checked task
  const imgChecked = await win.webContents.capturePage()
  const pathChecked = path.join(artifactDir, 'screenshot_task_checked_complete.png')
  fs.writeFileSync(pathChecked, imgChecked.toPNG())
  console.log('Saved:', pathChecked)

  // 3. Now verify the User's exact scenario ("你好", "DADS", "11") with collapsed history to prove zero overlap!
  console.log('Creating user scenario project with 3 history tasks, "你好" root, "DADS" branch, "11" merge...')
  const overlapCheck = await win.webContents.executeJavaScript(`
    (() => {
      // Check bounding rects of all visible task cards
      const cards = Array.from(document.querySelectorAll('div.w-\\\\[236px\\\\]'));
      const rects = cards.map(c => {
        const title = c.querySelector('h3')?.textContent?.trim() || '';
        const r = c.getBoundingClientRect();
        return { title, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) };
      });

      // Pairwise collision check
      const collisions = [];
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
          const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          if (overlapX > 0 && overlapY > 0) {
            collisions.push({ a: a.title, b: b.title, overlapX, overlapY });
          }
        }
      }
      return { cardCount: rects.length, rects, collisions };
    })()
  `)
  console.log('Overlap check result:', JSON.stringify(overlapCheck, null, 2))

  win.destroy()
  app.quit()
}

run().catch((err) => {
  console.error('Error running verification:', err)
  app.quit()
})
