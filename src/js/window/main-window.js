const chokidar = require('chokidar')
const { ipcRenderer, shell } = require('electron')
const { app } = require('electron').remote
const path = require('path')

const moment = require('moment')
const tippy = require('tippy.js')

const generateStats = require('../tasks/generate-stats')
const generateScriptPdf = require('../tasks/generate-script-pdf')
const generateOutlinePdf = require('../tasks/generate-outline-pdf')
const generateReader = require('../tasks/generate-reader')
const generateSceneList = require('../tasks/generate-scene-list')

const agent = require('../agent')
const chatInterface = require('../chat-interface')
const generatorButton = require('../generator-button')

const prefs = require('../prefs')

let scriptPath
let outputDirectory = app.getPath('documents')
let scriptStats

const loadScript = (filepath) => {
  scriptPath = filepath
  loadStats(scriptPath)
  prefs.set('lastScriptPath', scriptPath)
}

const loadStats = async (filepath) => {
  scriptStats = prefs.get('scriptStats')
  let stats = await generateStats.generate({inputPath: scriptPath})
  let diffStats = generateStats.diff(stats, scriptStats)
  if (diffStats.changeMessage) {
    chatInterface.agentOutput('Script updated!')
    chatInterface.agentOutput(diffStats.changeMessage)
  }
  scriptStats = JSON.parse(JSON.stringify(stats))
  document.querySelector('#title').innerHTML = stats.title
  let statsHTML = []
  statsHTML.push('Last Modified: ' + moment(stats.modifiedAt).calendar() + ' / ' + moment(stats.modifiedAt).fromNow() + '<br/>')
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
  return stats
}

const onLinkedFileChange = async (eventType, filepath, stats) => {
  if (eventType !== 'change') {
    return
  }
  let filename = path.basename(filepath)
  await loadStats(filepath)
  prefs.set('scriptStats', scriptStats)
}

const init = () => {
  chatInterface.init(agent)
  agent.init(chatInterface)

  prefs.init(path.join(app.getPath('userData'), 'prefs.json'))
  
  console.log('%cScript Assistant v' + prefs.get('version'), "color: blue; font-size: 20px;")
  console.log('Most Recent Script Path:', prefs.get('lastScriptPath'))

  if (prefs.get('lastScriptPath')) {
    loadScript(prefs.get('lastScriptPath'))
  }

  let watcher = chokidar.watch(null, {
    disableGlobbing: true // treat file strings as literal file names
  })
  
  watcher.on('all', onLinkedFileChange)

  watcher.add(scriptPath)

  document.querySelector('#revealScript').addEventListener('click', () => {
    if (scriptPath.length) {
      shell.showItemInFolder(scriptPath)
    }
  })

  generatorButton.createButton('#generateScriptPdf', generateScriptPdf, prefs, {
    inputPath: scriptPath,
    outputPath: path.join(outputDirectory, 'script.pdf'),
    progressCallback: (event) => {
      chatInterface.agentOutput('Generating Script PDF: ' + event.string, event.chatID)
    },
    doneCallback: (event) => {
      chatInterface.agentOutput('Finished generating Script PDF. Showing in folder.', event.chatID)
      shell.openItem(path.join(outputDirectory, 'script.pdf'))
    }
  })

  generatorButton.createButton('#generateOutlinePdf', generateOutlinePdf, prefs, {
    inputPath: scriptPath,
    outputPath: path.join(outputDirectory, 'outline.pdf'),
    progressCallback: (event) => {
      chatInterface.agentOutput('Generating Outline: ' + event.string, event.chatID)
    },
    doneCallback: (event) => {
      chatInterface.agentOutput('Finished generating Outline PDF. Showing in folder.', event.chatID)
      shell.openItem(path.join(outputDirectory, 'outline.pdf'))
    }
  })

  generatorButton.createButton('#generateReader', generateReader, prefs, {
    inputPath: scriptPath,
    outputPath: path.join(outputDirectory, 'output.mp3'),
    progressCallback: (event) => {
      chatInterface.agentOutput('Generating Reader MP3: ' + event.string, event.chatID)
    },
    doneCallback: (event) => {
      chatInterface.agentOutput('Finished generating Reader MP3. Showing in folder.', event.chatID)
      shell.showItemInFolder(path.join(outputDirectory, 'output.mp3'))
    }
  })

  generatorButton.createButton('#generateSceneList', generateSceneList, prefs, {
    inputPath: scriptPath,
    outputPath: path.join(outputDirectory, 'scene-list.csv'),
    progressCallback: (event) => {
      chatInterface.agentOutput('Generating Scene List CSV: ' + event.string, event.chatID)
    },
    doneCallback: (event) => {
      chatInterface.agentOutput('Finished generating Scene List CSV. Showing in folder.', event.chatID)
      shell.showItemInFolder(path.join(outputDirectory, 'scene-list.csv'))
    }
  })

  window.addEventListener('resize', chatInterface.resize)
}

window.ondragover = () => { return false }
window.ondragleave = () => { return false }
window.ondragend = () => { return false }

window.ondrop = e => {
  e.preventDefault()
  let file = e.dataTransfer.files[0]
  if (path.extname(file.name).match(/\.fountain*/)) {
    loadScript(file.path)
  }
}

ipcRenderer.on('ready', () => {})

init()