// todo: still need to break after partial sentences
// draw notes
// how can I get the page number?


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
  pages = pages.pageCount


  let wordCount = 0
  let sceneCount = 0
  let noteCount = 0
  let duration = 0
  let characters = {}
  let locations = {}

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
          if (characters[character] == undefined) {
            characters[character] = 1
          } else {
            characters[character]++
          }
          break
        case 'parenthetical':
          wordCount += getWordCount(scriptData.script[i].plainText)
          duration += getDurationOfWords(scriptData.script[i].plainText, 300)+1000
          break
        case 'dialogue':
          wordCount += getWordCount(scriptData.script[i].plainText)
          duration += getDurationOfWords(scriptData.script[i].plainText, 300)+1000
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
          //console.log(scriptData.script[i].type)
      }
    }
  }

  return {
    title: title,
    pageCount: pages,
    wordCount: wordCount,
    sceneCount: sceneCount, 
    noteCount: noteCount,
    duration: duration,
    characters: sortedValues(characters), 
    locations: sortedValues(locations),
    modifiedAt: filestats.mtime,
    scriptData: scriptData
  }

}

const parseScript = (filepath) => {
  let contents = fs.readFileSync(filepath, "utf8");
  let scriptData = fountainParse.parse(contents)
  return scriptData
}

const diff = (stats1, stats2) => {
  if (stats1 && stats2) {
    if (stats1.title !== stats2.title) {
      console.log('title', stats1.title, stats2.title)
    }
    if (stats1.pageCount !== stats2.pageCount) {
      console.log('pageCount', stats1.pageCount, stats2.pageCount)
    }
    if (stats1.wordCount !== stats2.wordCount) {
      console.log('wordCount', stats1.wordCount, stats2.wordCount)
    }
    if (stats1.sceneCount !== stats2.sceneCount) {
      console.log('sceneCount', stats1.sceneCount, stats2.sceneCount)
    }
    if (stats1.noteCount !== stats2.noteCount) {
      console.log('noteCount', stats1.noteCount, stats2.noteCount)
    }
    if (stats1.duration !== stats2.duration) {
      console.log('duration', stats1.duration, stats2.duration)
    }

    if (stats1.characters.length !== stats2.characters.length) {
      console.log('characters', stats1.characters.length, stats2.characters.length)
    }

    if (stats1.locations.length !== stats2.locations.length) {
      console.log('locations', stats1.locations.length, stats2.locations.length)
    }

    let currentScene = 0
    let sceneName

    for (var i = 0; i < stats1.scriptData.script.length; i++) {
      if (stats1.scriptData.script[i].text && stats2.scriptData.script[i].text) {
        if (stats1.scriptData.script[i].type == 'scene_heading') {
          currentScene++
          sceneName = stats1.scriptData.script[i].plainText
        }

        if (stats1.scriptData.script[i].text !== stats2.scriptData.script[i].text) {
          console.log('script', currentScene, sceneName, stats1.scriptData.script[i],  stats2.scriptData.script[i])
          break
        }
      }

    }

  }
}

const isEquivalent = (a, b) => {
    // Create arrays of property names
    var aProps = Object.getOwnPropertyNames(a);
    var bProps = Object.getOwnPropertyNames(b);

    // If number of properties is different,
    // objects are not equivalent
    if (aProps.length != bProps.length) {
        return false;
    }

    for (var i = 0; i < aProps.length; i++) {
        var propName = aProps[i];

        // If values of same property are not equal,
        // objects are not equivalent
        if (a[propName] !== b[propName]) {
            return false;
        }
    }

    // If we made it this far, objects
    // are considered equivalent
    return true;
}

module.exports = {
  generate,
  diff
}