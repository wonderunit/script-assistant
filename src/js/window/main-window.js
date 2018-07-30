const chokidar = require('chokidar')
const { ipcRenderer, shell } = require('electron')
const { app } = require('electron').remote
const path = require('path')

const moment = require('moment')
const tippy = require('tippy.js')
const electronUtil = require('electron-util')

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

const loadScript = async (filepath) => {
  scriptPath = filepath
  await loadStats(scriptPath)
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
  renderTimeline(stats.sceneList)
  agent.setStats(stats)
  return stats
}

const renderTimeline = (sceneList) => {
  let timelineDom = document.querySelector('#timeline')
  let timelineHTML = []
  let colors = [
    '#5a5a5a', 
    '#00bbe3', 
    '#167fb2', 
    '#ffeb97', 
    '#fbbbff'
  ]
  let currentAct = ''
  timelineHTML.push('<div id="label">')
  for (var i = 0; i < sceneList.length; i++) {
    if (currentAct !== sceneList[i].currentAct) {
      timelineHTML.push('<div style="position: relative;"><div class="section">' + sceneList[i].currentAct + '</div></div>')
      currentAct = sceneList[i].currentAct
    }
    timelineHTML.push('<div style="flex: ' + sceneList[i].duration + ';"></div>')
  }
  timelineHTML.push('</div><div id="bar">')
  for (var i = 0; i < sceneList.length; i++) {
    timelineHTML.push('<div id="scene-' + i + '" style="flex: ' + sceneList[i].duration + '; background: ' + colors[i % 5] + ';"></div>')
  }
  timelineHTML.push('</div>')
  timelineDom.innerHTML = timelineHTML.join('')
  for (var i = 0; i < sceneList.length; i++) {
    let settingsTooltip = document.createElement("div")
    settingsTooltip.className = "settings-content"
    settingsHTML = []
    settingsHTML.push(sceneList[i].currentAct + ' // ')
    settingsHTML.push(sceneList[i].currentSection + '<br/>')
    settingsHTML.push(sceneList[i].sceneNumber + '. ')
    settingsHTML.push(sceneList[i].slugline + '<br/>')
    settingsHTML.push('Page: ' + sceneList[i].currentPage + '<br/>')
    settingsHTML.push('Duration: ' + (Math.round(sceneList[i].duration/1000/60 * 10) / 10) + ' minutes<br/>')
    settingsHTML.push('Notes: ' + sceneList[i].noteCount + '<br/>')
    settingsTooltip.innerHTML = settingsHTML.join('')
    tippy("#scene-" + i, {
      theme: 'settings',
      delay: [20, 20],
      arrow: true,
      arrowType: 'large',
      interactive: false,
      interactiveBorder: 20,
      size: 'large',
      duration: [100, 100],
      animation: 'shift-toward',
      multiple: false,
      html: settingsTooltip
    })
  }
}

const onLinkedFileChange = async (eventType, filepath, stats) => {
  if (eventType !== 'change') {
    return
  }
  let filename = path.basename(filepath)
  await loadStats(filepath)
  prefs.set('scriptStats', scriptStats)
}

const init = async () => {
  electronUtil.disableZoom()

  prefs.init(path.join(app.getPath('userData'), 'prefs.json'))
  
  console.log('%cScript Assistant v' + prefs.get('version'), "color: blue; font-size: 20px;")
  console.log('Most Recent Script Path:', prefs.get('lastScriptPath'))

  if (prefs.get('lastScriptPath')) {
    await loadScript(prefs.get('lastScriptPath'))
  }

  chatInterface.init(agent)
  agent.init(chatInterface)

  let watcher = chokidar.watch(null, {
    disableGlobbing: true // treat file strings as literal file names
  })
  
  watcher.on('all', onLinkedFileChange)

  watcher.add(scriptPath)

  tippy("#editScript, #revealScript", {
    //theme: 'settings',
    delay: [200, 200],
    arrow: true,
    arrowType: 'large',
    interactive: false,
    interactiveBorder: 20,
    size: 'large',
    duration: [200, 200],
    animation: 'shift-toward',
    multiple: false,
  })

  document.querySelector('#editScript').addEventListener('click', () => {
    if (scriptPath.length) {
      shell.openItem(scriptPath)
    }
  })

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