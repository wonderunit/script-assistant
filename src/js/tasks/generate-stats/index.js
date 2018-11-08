const fs = require('fs')
const path = require('path')

const { app } = require('electron').remote

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

const generate = async (options = {}) => {
  let scriptData = parseScript(options.inputPath)
  let filestats = fs.statSync(options.inputPath)

  // title
  let title = path.basename(options.inputPath, '.fountain')
  for (var i = 0; i < scriptData.title.length; i++) {
    if (scriptData.title[i].type == 'title') {
      title = scriptData.title[i].plainText
    }
  }

  // page count
  let pages = await generateScriptPdf.getPages(options)

  let wordCount = 0
  let sceneCount = 0
  let noteCount = 0
  let duration = 0
  let characters = {}
  let locations = {}

  let currentCharacter = null
  let characterLines = {}

  for (var i = 0; i < scriptData.script.length; i++) {
    if (scriptData.script[i].plainText) {
      switch (scriptData.script[i].type) {
        case 'centered':
          wordCount += getWordCount(scriptData.script[i].plainText)
          break
        case 'action':
          wordCount += getWordCount(scriptData.script[i].plainText)
          duration += getDurationOfWords(scriptData.script[i].plainText, 200)+500
          break
        case 'transition':
          wordCount += getWordCount(scriptData.script[i].plainText)
          duration += 1000
          break
        case 'scene_heading':
          wordCount += getWordCount(scriptData.script[i].plainText)
          sceneCount++
          duration += 2000

          let location = scriptData.script[i].plainText.split(' - ')
          if (location.length > 1) {
            location.pop()
          }
          location = location.join(' - ')
          if (locations[location] == undefined) {
            locations[location] = 1
          } else {
            locations[location]++
          }
          break
        case 'character':
          wordCount += getWordCount(scriptData.script[i].plainText)
          let character = titleCase(scriptData.script[i].plainText).split('(')[0].split(' AND ')[0].trim()
          currentCharacter = character
          if (characters[character] == undefined) {
            characters[character] = 1
          } else {
            characters[character]++
          }
          if (characterLines[character] == undefined) {
            characterLines[character] = []
          }
          break
        case 'parenthetical':
          wordCount += getWordCount(scriptData.script[i].plainText)
          duration += getDurationOfWords(scriptData.script[i].plainText, 300)+1000
          break
        case 'dialogue':
          wordCount += getWordCount(scriptData.script[i].plainText)
          duration += getDurationOfWords(scriptData.script[i].plainText, 300)+1000
          characterLines[currentCharacter].push(scriptData.script[i].plainText)
          break
        case 'inline_note':
          noteCount++
          break
        case 'note':
          noteCount++
          break
        case 'section':

          break
        default:
      }
    }
  }

  // save files for the character lines:
  let outputDirectory = app.getPath('documents')
  for (let characterKey in  characterLines) {
    if (characterLines[characterKey].length > 14) {
      let linesText = ''
      for (let i = 0; i<characterLines[characterKey].length; i++ ) {
        linesText += characterLines[characterKey][i] + "\n\n"
      }
      fs.writeFile(path.join(outputDirectory, characterKey + ' - lines.fountain'), linesText, function(err) {
        if(err) {
          return
        }
      })
    }
  }

  return {
    title: title,
    pageCount: pages.pageCount,
    wordCount: wordCount,
    sceneCount: sceneCount,
    noteCount: noteCount,
    duration: duration,
    characters: sortedValues(characters),
    locations: sortedValues(locations),
    modifiedAt: filestats.mtime,
    scriptData: scriptData,
    sceneList: pages.sceneList
  }

}

const parseScript = (filepath) => {
  let contents = fs.readFileSync(filepath, "utf8")
  let scriptData = fountainParse.parse(contents, filepath)
  return scriptData
}

const diff = (stats1, stats2) => {
  let diffStats = {}

  if (stats1 && stats2) {
    let changeMessage = []

    if (stats1.title !== stats2.title) {
      changeMessage.push('Changed title to <strong>' + stats1.title + '</strong> from ' + stats2.title + '.')
    }

    let currentScene = 0
    let sceneName = ''

    for (var i = 0; i < stats1.scriptData.script.length; i++) {
      if (stats1.scriptData.script[i] && stats2.scriptData.script[i]) {
        if (stats1.scriptData.script[i].text && stats2.scriptData.script[i].text) {
          if (stats1.scriptData.script[i].type == 'scene_heading') {
            currentScene++
            sceneName = stats1.scriptData.script[i].plainText
          }
          if (stats1.scriptData.script[i].text !== stats2.scriptData.script[i].text) {
            changeMessage.push('Edited Scene <strong>' + currentScene + ' - ' + sceneName + '</strong> around, "' + stats1.scriptData.script[i].plainText.substring(0,50) + '..."')
            break
          }
        }
      }
    }

    if (stats1.sceneCount !== stats2.sceneCount) {
      let diff = stats1.sceneCount - stats2.sceneCount
      let verb
      if (diff > 0) {
        verb = 'Added'
      } else {
        verb = 'Removed'
      }
      changeMessage.push(verb + ' ' + Math.abs(diff) + ' scenes.')
    }

    if (stats1.locations.length !== stats2.locations.length) {
      let diff = stats1.locations.length - stats2.locations.length
      let verb
      if (diff > 0) {
        verb = 'Added'
      } else {
        verb = 'Removed'
      }
      changeMessage.push(verb + ' ' + Math.abs(diff) + ' locations.')
    }

    if (stats1.characters.length !== stats2.characters.length) {
      let diff = stats1.characters.length - stats2.characters.length
      let verb
      if (diff > 0) {
        verb = 'Added'
      } else {
        verb = 'Removed'
      }
      changeMessage.push(verb + ' ' + Math.abs(diff) + ' characters.')
    }

    if (stats1.wordCount !== stats2.wordCount) {
      let diff = stats1.wordCount - stats2.wordCount
      let verb
      if (diff > 0) {
        verb = 'Added'
      } else {
        verb = 'Removed'
      }
      changeMessage.push(verb + ' ' + Math.abs(diff) + ' words.')
    }

    if (Math.round(stats1.duration/1000/60) !== Math.round(stats2.duration/1000/60)) {
      let diff = stats1.duration - stats2.duration
      let verb
      if (diff > 0) {
        verb = 'Added'
      } else {
        verb = 'Removed'
      }
      changeMessage.push(verb + ' ' + Math.round(Math.abs(diff)/1000/60) + ' minutes.')
    }

    if (stats1.pageCount !== stats2.pageCount) {
      let diff = stats1.pageCount - stats2.pageCount
      let verb
      if (diff > 0) {
        verb = 'Added'
      } else {
        verb = 'Removed'
      }
      changeMessage.push(verb + ' ' + Math.abs(diff) + ' pages.')
    }

    if (stats1.noteCount !== stats2.noteCount) {
      let diff = stats1.noteCount - stats2.noteCount
      let verb
      if (diff > 0) {
        verb = 'Added'
      } else {
        verb = 'Removed'
      }
      changeMessage.push(verb + ' ' + Math.abs(diff) + ' notes.')
    }

    diffStats.changeMessage = changeMessage.join(' ')

  }

  return diffStats
}

module.exports = {
  generate,
  diff
}