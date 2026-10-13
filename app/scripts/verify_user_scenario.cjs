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
      preload: path.join(__dirname, 'mock_preload.cjs')
    }
  })

  const indexPath = path.join(__dirname, '../out/renderer/index.html')
  await win.loadFile(indexPath)
  await new Promise((r) => setTimeout(r, 1200))
  await waitFrames(win, 500)

  // Verify bounding rects and collision check
  const check = await win.webContents.executeJavaScript(`
    (() => {
      const cards = Array.from(document.querySelectorAll('div.w-\\\\[236px\\\\]'));
      const rects = cards.map(c => {
        const title = c.querySelector('h3')?.textContent?.trim() || '';
        const r = c.getBoundingClientRect();
        return { title, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) };
      });
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
  console.log('User scenario layout result:', JSON.stringify(check, null, 2))

  const imgUser = await win.webContents.capturePage()
  const outUser = path.join(artifactDir, 'screenshot_user_overlap_fixed.png')
  fs.writeFileSync(outUser, imgUser.toPNG())
  console.log('Saved user scenario screenshot:', outUser)

  win.destroy()
  app.quit()
}

run().catch((err) => {
  console.error('Error running verification:', err)
  app.quit()
})
