const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

async function runCapture() {
  await app.whenReady()

  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../out/preload/index.js')
    }
  })

  win.webContents.on('console-message', (e, level, message) => {
    console.log(`[Renderer LOG ${level}]:`, message)
  })

  const indexPath = path.join(__dirname, '../out/renderer/index.html')
  await win.loadFile(indexPath)
  await new Promise((r) => setTimeout(r, 1000))

  // Click "载入演示项目 (FMU + MuJoCo)"
  await win.webContents.executeJavaScript(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('载入演示项目'));
    if (btn) btn.click();
  `)

  await new Promise((r) => setTimeout(r, 800))

  // Call .click() directly on the card
  await win.webContents.executeJavaScript(`
    (() => {
      const h3 = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('检查 FMU 接口'));
      if (h3) {
        const card = h3.closest('.absolute');
        if (card) card.click();
      }
    })()
  `)

  // Wait for React to re-render the inspector panel
  await new Promise((r) => setTimeout(r, 1000))

  const asideInfo = await win.webContents.executeJavaScript(`
    (() => {
      const aside = document.querySelector('aside');
      return {
        asideFound: !!aside,
        asideTitle: aside ? aside.querySelector('h2')?.textContent : null,
        rect: aside ? { left: aside.getBoundingClientRect().left, top: aside.getBoundingClientRect().top, width: aside.getBoundingClientRect().width, height: aside.getBoundingClientRect().height, right: aside.getBoundingClientRect().right } : null,
        windowInnerWidth: window.innerWidth,
        windowInnerHeight: window.innerHeight,
        bodyWidth: document.body.offsetWidth,
        buttons: aside ? Array.from(aside.querySelectorAll('button')).map(b => b.textContent.trim()) : []
      };
    })()
  `)
  console.log('Aside info:', JSON.stringify(asideInfo, null, 2))

  await win.webContents.executeJavaScript(`
    new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 500);
        });
      });
    })
  `)
  await new Promise((r) => setTimeout(r, 500))

  const imageTodo = await win.webContents.capturePage()
  const outPathTodo = 'C:/Users/wt/.gemini/antigravity/brain/f65a0339-28b4-47de-bd57-9887d7ecc76d/screenshot_production_inspector_todo.png'
  fs.writeFileSync(outPathTodo, imageTodo.toPNG())
  console.log('Saved todo inspector screenshot to:', outPathTodo)

  win.destroy()
  app.quit()
}

runCapture().catch((err) => {
  console.error('Fatal error:', err)
  app.quit()
})
