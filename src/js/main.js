const {app, ipcMain, BrowserWindow, dialog} = electron = require('electron')

const isDev = require('electron-is-dev')

const path = require('path')
const url = require('url')
const os = require('os')

const autoUpdater = require('./auto-updater')

let mainWindow

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = true

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1200,
    minHeight: 715,
    show: false,
    center: true,
    frame: false,
    titleBarStyle: 'hiddenInset',
    acceptFirstMouse: true,
    simpleFullscreen: true,
    webPreferences: {
      plugins: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      backgroundThrottling: false,
    }
  })
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '..', 'main-window.html'),
    protocol: 'file:',
    slashes: true
  }))

  // mainWindow = new BrowserWindow({
  //   width: 1500,
  //   height: 900,
  //   minWidth: 1200,
  //   minHeight: 715,
  //   x: 0,
  //   y: 0,
  //   show: false,
  //   center: true,
  //   frame: true,
  //   acceptFirstMouse: true,
  //   simpleFullscreen: true,
  //   webPreferences: {
  //     plugins: true,
  //     webSecurity: false,
  //     allowRunningInsecureContent: true,
  //     experimentalFeatures: true,
  //     backgroundThrottling: false,
  //   }
  // })
  // mainWindow.loadURL(url.format({
  //   //pathname: path.join(__dirname, '..', 'main-window.html'),
  //   pathname: path.join(__dirname, '..', 'test-window.html'),
  //   protocol: 'file:',
  //   slashes: true
  // }))

  if (os.platform() === 'darwin') {
    if (!isDev && !app.isInApplicationsFolder()) {
      const choice = dialog.showMessageBox({
        type: 'question',
        title: 'Move to Applications folder?',
        message: 'Would you like to move Storyboarder to the Applications folder?',
        buttons: ['Move to Applications', 'Do Not Move'],
        defaultId: 1
      })
      const yes = (choice === 0)
      if (yes) {
        try {
          let didMove = app.moveToApplicationsFolder()
          if (!didMove) {
            dialog.showMessageBox(null, {
              type: 'error',
              message: 'Could not move to Applications folder'
            })
          }
        } catch (err) {
          dialog.showMessageBox(null, {
            type: 'error',
            message: err.message
          })
        }
      }
    }
  }



  mainWindow.on('closed', function () {
    mainWindow = null
  })
  mainWindow.once('ready-to-show', () => {
    if (!isDev) autoUpdater.init()
    if (isDev) mainWindow.webContents.openDevTools()
    mainWindow.webContents.send('ready')
    mainWindow.show()
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', function () {
  app.quit()
})

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow()
  }
})