const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { machineIdSync } = require('node-machine-id')

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
    },
  })

  const isDev = !app.isPackaged
  if (isDev) {
    win.loadURL('http://localhost:5180')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

ipcMain.handle('get-device-fingerprint', () => {
  return machineIdSync(true)
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})