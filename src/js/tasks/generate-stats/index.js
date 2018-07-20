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
  }

}



const parseScript = (filepath) => {
  let contents = fs.readFileSync(filepath, "utf8");
  let scriptData = fountainParse.parse(contents)
  return scriptData
}


module.exports = {
  generate
}