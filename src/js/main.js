const electron = require('electron')
const { ipcMain } = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow

const isDev = require('electron-is-dev')

const path = require('path')
const url = require('url')
const os = require('os')

let mainWindow

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = true


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




function createWindow () {

  mainWindow = new BrowserWindow({
    width: 1500, 
    height: 900, 
    minWidth: 1200, 
    minHeight: 715, 
    x: 0,
    y: 0,
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
    }})

  //mainWindow.ELECTRON_DISABLE_SECURITY_WARNINGS = true


  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '..', 'main-window.html'),
    protocol: 'file:',
    slashes: true
  }))


// mainWindow.loadURL('http://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf')
  // Open the DevTools.
  mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.webContents.send('ready')
    mainWindow.show()
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  //if (process.platform !== 'darwin') {
    app.quit()
  //}
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.