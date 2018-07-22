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

const prefs = require('../prefs')

// loads prefs
// if theres file there, open it
// watch file for changes
// parses the fountain
// generate stats
// display them
// load settings prefs

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

  generateStats.diff(stats, scriptStats)

  console.log(stats, scriptStats)



  //chatInterface.agentOutput('Script Changed!')



  scriptStats = JSON.parse(JSON.stringify(stats))

  console.log(scriptStats)

  document.querySelector('#title').innerHTML = stats.title

  let statsHTML = []

  // console.log(moment(stats.mtime).format('MMMM Do, YYYY, h:mma'))
  // console.log(moment(stats.mtime).calendar())
  // console.log(moment(stats.mtime).fromNow())


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
  console.log('onLinkedFileChange', eventType, filepath, stats)
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
  console.log('Script Assistant v' + prefs.get('version'))
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


  tippy('#sup',{multiple: true,})

  tippy('#generateScriptPdf',{
  theme: 'settings',
  delay: [350, 100],
  arrow: true,
  arrowType: 'large',
  interactive: true,
  interactiveBorder: 20,
  size: 'large',
  duration: [100, 200],
  animation: 'shift-toward',
  multiple: true,
  html: document.querySelector('#tooltipHTML')
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


  tippy('#generateOutlinePdf',{
  delay: 300,
  arrow: true,
  arrowType: 'large',
  interactive: true,
  interactiveBorder: 20,
  size: 'large',
  duration: 500,
  animation: 'shift-toward',
  multiple: false,
  html: document.querySelector('#tooltipHTML2')
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

  document.querySelector('#generateReader').addEventListener('click', async () => {
    if (scriptPath.length) {
      generateReader.generate({
        inputPath: scriptPath,
        outputPath: path.join(outputDirectory, 'output.mp3')
      })

      shell.showItemInFolder(path.join(outputDirectory, 'output.mp3'))
    }
  })


  let settingsTooltip = document.createElement("div")
  let settings = generateSceneList.getSettings()
  settingsHTML = []
  settingsHTML.push('<h2>Export a scene list CSV file</h2>')
  settingsHTML.push('<div>This can useful for todos</div>')
  for (var i = 0; i < settings.length; i++) {
    settingsHTML.push('<div>')
    let value
    if (typeof prefs.get(settings[i].id) !== 'undefined') {
      value = prefs.get(settings[i].id)
    } else {
      value = settings[i].default
    }
    switch (settings[i].type) {
      case 'checkbox':
        if (value) {
          settingsHTML.push('<input type="checkbox" id="' + settings[i].id + '" value="1" checked><label for="' + settings[i].id + '">' + settings[i].label + '</label>')
        } else {
          settingsHTML.push('<input type="checkbox" id="' + settings[i].id + '" value="1"><label for="' + settings[i].id + '">' + settings[i].label + '</label>')
        }
        break
    }
    settingsHTML.push('</div>')
  }
  settingsTooltip.innerHTML = settingsHTML.join('')
  settingsTooltip.querySelectorAll('input').forEach((element) => {
    element.onchange = (event) => {
      let value
      switch (event.target.type) {
        case 'checkbox':
          value = event.target.checked
          break
      }
      prefs.set(event.target.id, value)
    }
  })

  tippy('#generateSceneList',{
    theme: 'settings',
    delay: [350, 100],
    arrow: true,
    arrowType: 'large',
    interactive: true,
    interactiveBorder: 20,
    size: 'large',
    duration: [100, 200],
    animation: 'shift-toward',
    multiple: true,
    html: settingsTooltip
  })

  document.querySelector('#generateSceneList').addEventListener('click', (event) => {
    if (scriptPath.length) {
      let target = event.target
      let chatID = 'chat-' + String(new Date().getTime())
      target.disabled = true
      chatInterface.agentOutput('Generating Scene List CSV...', chatID)

      let settingsList = generateSceneList.getSettings()
      let settings = {}

      for (var i = 0; i < settingsList.length; i++) {
        let value
        if (typeof prefs.get(settingsList[i].id) !== 'undefined') {
          value = prefs.get(settingsList[i].id)
        } else {
          value = settingsList[i].default
        }

        settings[settingsList[i].id] = value
      }

      generateSceneList.generate({
        inputPath: scriptPath,
        outputPath: path.join(outputDirectory, 'scene-list.csv'),
        settings: settings,
        progressCallback: (event) => {
          console.log(event)
          chatInterface.agentOutput('Generating Scene List CSV: ' + event, chatID)
        },
        doneCallback: (event) => {
          console.log(event)
          chatInterface.agentOutput('Finished generating Scene List CSV. Showing in folder.', chatID)
          console.log(target)
          target.disabled = false
          shell.showItemInFolder(path.join(outputDirectory, 'scene-list.csv'))
        }
      })
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
  
  console.log(file)
  if (path.extname(file.name).match(/\.fountain*/)) {
    loadScript(file.path)
  }
}

ipcRenderer.on('ready', () => {})

init()
