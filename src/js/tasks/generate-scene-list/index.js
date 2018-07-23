const fs = require('fs')
const path = require('path')
const fountainParse = require('../fountain-parse')

const generateScriptPdf = require('../generate-script-pdf')

const getWordCount = (text) => {
  if (!text) return 0
  return text.trim().replace(/ +(?= )/g,'').split(' ').length
}

const getDurationOfWords = (text, durationPerWord) => {
  if (!text) return 0
  return getWordCount(text) * durationPerWord
}

const sortedValues = (obj) => {
  let tuples = []
  for (var key in obj) tuples.push([key, obj[key]])
  tuples.sort((a, b)=>{ return a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0 })
  return tuples
}

const values = (obj) => {
  let tuples = []
  for (var key in obj) tuples.push([key, obj[key]])
  return tuples
}


const titleCase = (str) =>  {
  str = str.toLowerCase().split(' ')
  for (var i = 0; i < str.length; i++) {
    str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1)
  }
  return str.join(' ')
}


let progressCallback
let doneCallback
let finishedCallback
let chatID

const generate = async (options = {}) => {
  let scriptData = parseScript(options.inputPath)

  progressCallback = options.progressCallback
  doneCallback = options.doneCallback
  finishedCallback = options.finishedCallback
  chatID = options.chatID

  progressCallback({string: "started", chatID: chatID})

  // page count
  let pages = await generateScriptPdf.getPages(options)
  pages = pages.pageCount

  let scenes = []

  let duration = 0
  let currentAct = ''
  let currentSection = ''
  let noteCount = 0 
  let currentScene

  for (var i = 0; i < scriptData.script.length; i++) {
    if (scriptData.script[i].plainText) {
      switch (scriptData.script[i].type) {
        case 'centered':
          break
        case 'action':
          duration += getDurationOfWords(scriptData.script[i].plainText, 200)+500
          break
        case 'transition':
          duration += 1000
          break
        case 'scene_heading':
          if (currentScene) {
            currentScene.noteCount = noteCount
            currentScene.duration = duration
            scenes.push(currentScene)
          }
          duration = 2000
          noteCount = 0 
          currentScene = {currentAct: currentAct, currentSection: currentSection, slugline: scriptData.script[i].plainText}
          break
        case 'character':
          break
        case 'parenthetical':
          duration += getDurationOfWords(scriptData.script[i].plainText, 300)+1000
          break
        case 'dialogue':
          duration += getDurationOfWords(scriptData.script[i].plainText, 300)+1000
          break
        case 'inline_note':
          noteCount++
          break
        case 'note':
          noteCount++
          break
        case 'section':
          if (scriptData.script[i].depth == 1) {
            currentAct = scriptData.script[i].plainText
          } else {
            currentSection = scriptData.script[i].plainText
          }
          break
        default:
      }
    }
  }

  if (currentScene) {
    currentScene.noteCount = noteCount
    currentScene.duration = duration
    scenes.push(currentScene)
  }

  let settings = options.settings

  let csvText = ''
  let csvLine = []

  if (settings.includeAct) {
    csvLine.push('ACT')
  }
  if (settings.includeSection) {
    csvLine.push('Section')
  }
  csvLine.push('Scene')
  if (settings.includeNotes) {
    csvLine.push('Notes')
  }
  if (settings.includeSeconds) {
    csvLine.push('Seconds')
  }
  if (settings.includeTodo) {
    csvLine.push('TODO')
  }
  if (settings.includeRough) {
    csvLine.push('ROUGH')
  }
  if (settings.includeComplete) {
    csvLine.push('COMPLETE')
  }
  
  csvText += csvLine.join(',') + `\n`

  for (var i = 0; i < scenes.length; i++) {
    csvLine = []
    if (settings.includeAct) {
      csvLine.push(scenes[i].currentAct.split(',').join('-'))
    }
    if (settings.includeSection) {
      csvLine.push(scenes[i].currentSection.split(',').join('-'))
    }
    csvLine.push(scenes[i].slugline.split(',').join('-'))
    if (settings.includeNotes) {
      if (scenes[i].noteCount > 0 ) {
        csvLine.push(scenes[i].noteCount)
      } else {
        csvLine.push('')
      }
    }
    if (settings.includeSeconds) {
      csvLine.push(Math.round(scenes[i].duration/1000))
    }
    if (settings.includeTodo) {
      csvLine.push('')
    }
    if (settings.includeRough) {
      csvLine.push('')
    }
    if (settings.includeComplete) {
      csvLine.push('')
    }
    csvText += csvLine.join(',') + `\n`
  }

  progressCallback({string: "writing", chatID: chatID})

  fs.writeFile(options.outputPath, csvText, function(err) {
    if(err) {
      doneCallback({string: "error", chatID: chatID})
      finishedCallback()
      return 
    }
    doneCallback({string: "done!", chatID: chatID})
    finishedCallback()
  }) 
}

const parseScript = (filepath) => {
  let contents = fs.readFileSync(filepath, "utf8");
  let scriptData = fountainParse.parse(contents)
  return scriptData
}

const getSettings = () => {
  let settings = [
    { type: 'title', text: 'Export scene list CSV' },
    { type: 'description', text: 'This is useful for importing to Google spreadsheets for TODO lists or time management.' },

    { id: 'includeAct', label: 'Include Act', type: 'checkbox', default: true },
    { id: 'includeSection', label: 'Include Section', type: 'checkbox', default: true },
    { id: 'includeNotes', label: 'Include Notes', type: 'checkbox', default: true },
    { id: 'includeSeconds', label: 'Include Seconds', type: 'checkbox', default: true },
    { id: 'includeTodo', label: 'Include TODO', type: 'checkbox', default: false },
    { id: 'includeRough', label: 'Include ROUGH', type: 'checkbox', default: false },
    { id: 'includeComplete', label: 'Include COMPLETE', type: 'checkbox', default: false },
  ]
  return settings
}

module.exports = {
  generate,
  getSettings
}