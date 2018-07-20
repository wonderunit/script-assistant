const chokidar = require('chokidar')
const { ipcRenderer, shell } = require('electron')
const { app } = require('electron').remote
const path = require('path')

const moment = require('moment')

const generateStats = require('../tasks/generate-stats')
const generateScriptPdf = require('../tasks/generate-script-pdf')
const generateOutlinePdf = require('../tasks/generate-outline-pdf')
const generateSceneList = require('../tasks/generate-scene-list')

// loads prefs
// if theres file there, open it
// watch file for changes
// parses the fountain
// generate stats
// display them
// load settings prefs

let scriptPath = "/Users/setpixel/git/explorers-script/EXPLORERS.fountain"
let outputDirectory = app.getPath('documents')

const loadScript = (filepath) => {
  scriptPath = filepath
  document.querySelector('#revealScript').innerText = scriptPath
  loadStats(scriptPath)

}

const loadStats = async (filepath, modifiedTime) => {
  let stats = await generateStats.generate({inputPath: scriptPath})
  console.log(stats)
  document.querySelector('#title').innerHTML = stats.title

  let statsHTML = []

  // console.log(moment(stats.mtime).format('MMMM Do, YYYY, h:mma'))
  // console.log(moment(stats.mtime).calendar())
  // console.log(moment(stats.mtime).fromNow())


  statsHTML.push('Last Modified: ' + moment(modifiedTime).calendar() + ' / ' + moment(modifiedTime).fromNow() + '<br/>')
  statsHTML.push('Pages: ' + stats.pageCount + '<br/>')
  statsHTML.push('Words: ' + stats.wordCount + '<br/>')
  statsHTML.push('Duration: ' + Math.round(stats.duration/1000/60) + ' minutes<br/>')
  statsHTML.push('Scenes: ' + stats.sceneCount + '<br/>')
  statsHTML.push('Notes: ' + stats.noteCount + '<br/>')
  statsHTML.push('Locations: ' + stats.locations.length + '<br/>')
  statsHTML.push('Characters: ' + stats.characters.length + ' - ')
  
  let chars = []

  for (var i = 0; i < stats.characters.length; i++) {
    if (stats.characters[i][1] > 15) {
      chars.push(stats.characters[i][0] +  ' (' + stats.characters[i][1] + ')')
    }
  }

  statsHTML.push(chars.join(', '))
  document.querySelector('#title').innerHTML = stats.title
  document.querySelector('#stats').innerHTML = statsHTML.join('')
}

loadScript(scriptPath)



const onLinkedFileChange = async (eventType, filepath, stats) => {
  console.log('onLinkedFileChange', eventType, filepath, stats)

  // if (eventType !== 'change') {
  //   // ignore `add` events, etc
  //   // we only care about `change` events (explicit save events)
  //   return
  // }


  let filename = path.basename(filepath)
  loadStats(filepath, stats.mtime)
  // do stuff
  // generate stats
  // display them
}


let watcher = chokidar.watch(null, {
  disableGlobbing: true // treat file strings as literal file names
})
watcher.on('all', onLinkedFileChange)

watcher.add(scriptPath)


// // const pdf = require('../pdf')

// // pdf.generatePDF()

// // console.log(document)


ipcRenderer.on('ready', () => {
})

  document.querySelector('#revealScript').addEventListener('click', () => {
    if (scriptPath.length) {
      shell.showItemInFolder(scriptPath)
    }
  })


  document.querySelector('#generateScriptPdf').addEventListener('click', async () => {
    if (scriptPath.length) {
      await generateScriptPdf.generate({
        inputPath: scriptPath,
        outputPath: path.join(outputDirectory, 'script.pdf')
      })
      shell.openItem(path.join(outputDirectory, 'script.pdf'))
    }
  })

  document.querySelector('#generateOutlinePdf').addEventListener('click', async () => {
    if (scriptPath.length) {
      await generateOutlinePdf.generate({
        inputPath: scriptPath,
        outputPath: path.join(outputDirectory, 'outline.pdf')
      })

      shell.openItem(path.join(outputDirectory, 'outline.pdf'))
    }
  })


  document.querySelector('#generateSceneList').addEventListener('click', async () => {
    if (scriptPath.length) {
      await generateSceneList.generate({
        inputPath: scriptPath,
        outputPath: path.join(outputDirectory, 'scene-list.csv')
      })

      shell.showItemInFolder(path.join(outputDirectory, 'scene-list.csv'))
    }
  })


window.ondragover = () => { return false }
window.ondragleave = () => { return false }
window.ondragend = () => { return false }

window.ondrop = e => {
  e.preventDefault()
  let file = e.dataTransfer.files[0]
  
  console.log(file)
  if (path.extname(file.name).match(/\.fountain*/)) {
    loadScript(file.path)
  }
}