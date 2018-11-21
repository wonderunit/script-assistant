// todo: still need to break after partial sentences

const fs = require('fs')
const path = require('path')
const pdfDocument = require('pdfkit')
const moment = require('moment')
const Jimp = require('jimp')
const qr = require('qr-image')

const fountainParse = require('../fountain-parse')

const imageCache = require('../image-cache.js')


let progressCallback
let doneCallback
let finishedCallback
let chatID

const getWordCount = (text) => {
  if (!text) return 0
  return text.trim().replace(/ +(?= )/g,'').split(' ').length
}

const getDurationOfWords = (text, durationPerWord) => {
  if (!text) return 0
  return getWordCount(text) * durationPerWord
}

const generate = async (options = {}) => {
  progressCallback = options.progressCallback
  doneCallback = options.doneCallback
  finishedCallback = options.finishedCallback
  chatID = options.chatID
  progressCallback({string: "Rendering...", chatID: chatID})
  let scriptData = parseScript(options.inputPath)
  let data = await renderScript(scriptData, false)

  let fullScriptOptions = {
    pageCount: data.pageCount,
    scale: 1.0,
    xOffset: 0,
    yOffset: 0,
    scriptHeader: true,
    scriptFooter: true,
    showNotes: false,
    showLineNumbers: false,
    titlePage: true,
  }

  let notesScriptOptions = {
    pageCount: data.pageCount,
    scale: 0.8,
    xOffset: -22,
    yOffset: 60,
    scriptHeader: false,
    scriptFooter: false,
    showLineNumbers: options.settings.scriptShowLineNumbers,
    showNotes: options.settings.scriptIncludeNotes,
    showImages: options.settings.scriptIncludeImages,
    includeImageSheets: options.settings.scriptIncludeImageSheets,
    showOutside: true,
    titlePage: options.settings.scriptIncludeTitlePage,
    inputPath: options.inputPath,
    scriptWatermarkString: options.settings.scriptWatermarkString,
  }

  setTimeout(()=>{renderScript(scriptData, true, options.outputPath, notesScriptOptions)},1)
}

const getPages = async (options = {}) => {
  let scriptData = parseScript(options.inputPath)
  return await renderScript(scriptData, false)
}

const parseScript = (filepath) => {
  let contents = fs.readFileSync(filepath, "utf8");
  let scriptData = fountainParse.parse(contents, filepath)
  return scriptData
}

let sceneList = []
let sceneListDuration = 0
let sceneListCurrentAct = ''
let sceneListCurrentSection = ''
let sceneListNoteCount = 0
let sceneListSceneNumber = 0
let sceneListCurrentScene
let imageHash = {}

const renderScript = async (scriptData, render, outputFilePath, options) => {
  return new Promise(async (resolve, reject) => {
    sceneList = []
    sceneListDuration = 0
    sceneListCurrentAct
    sceneListCurrentSection
    sceneListNoteCount = 0
    sceneListSceneNumber = 0
    sceneListCurrentScene = null

    if (!options) { options = {}}
    let documentSize = [8.5*72,11*72]
    let marginTop = 72
    let doc = new pdfDocument({size: documentSize, layout: 'portrait', margin: 0})
    doc.registerFont('thin',     path.join(__dirname, '..', '..', '..', 'fonts', 'wonder-unit-sans', 'WonderUnitSans-Thin.ttf'))
    doc.registerFont('italic',   path.join(__dirname, '..', '..', '..', 'fonts', 'wonder-unit-sans', 'WonderUnitSans-RegularItalic.ttf'))
    doc.registerFont('regular',     path.join(__dirname, '..', '..', '..', 'fonts', 'wonder-unit-sans', 'WonderUnitSans-Regular.ttf'))
    doc.registerFont('bold',     path.join(__dirname, '..', '..', '..', 'fonts', 'wonder-unit-sans', 'WonderUnitSans-Bold.ttf'))
    doc.registerFont('extrabold',     path.join(__dirname, '..', '..', '..', 'fonts', 'wonder-unit-sans', 'WonderUnitSans-Extrabold.ttf'))
    doc.registerFont('black',     path.join(__dirname, '..', '..', '..', 'fonts', 'wonder-unit-sans', 'WonderUnitSans-Black.ttf'))
    doc.registerFont('courier-prime-sans',     path.join(__dirname, '..', '..', '..', 'fonts', 'courier-prime-sans', 'Courier Prime Sans.ttf'))
    doc.registerFont('courier-prime-sans-bold',     path.join(__dirname, '..', '..', '..', 'fonts', 'courier-prime-sans', 'Courier Prime Sans Bold.ttf'))
    doc.registerFont('courier-prime-sans-bold-italic',     path.join(__dirname, '..', '..', '..', 'fonts', 'courier-prime-sans', 'Courier Prime Sans Bold Italic.ttf'))
    doc.registerFont('courier-prime-sans-italic',     path.join(__dirname, '..', '..', '..', 'fonts', 'courier-prime-sans', 'Courier Prime Sans Italic.ttf'))
    let stream

    let outputFileName
    if (render) {
      let fName = []
      // get title
      let title = ''
      for (let i = 0; i < scriptData.title.length; i++) {
        if (scriptData.title[i].type == "title") {
          title = scriptData.title[i].plainText.replace(/<(?:.|\n)*?>/gm, '')
        }
      }
      fName.push(title)
      fName.push('Script')
      if (options.scriptWatermarkString) {
        fName.push(options.scriptWatermarkString)
      }
      fName.push(moment().format("MMM Do YYYY"))

      outputFileName = path.join(outputFilePath, fName.join(' - ').replace(/[/\\?%*:|"<>]/g, ' ') + '.pdf')

      stream = doc.pipe(fs.createWriteStream(outputFileName))
    }
    let scale = options.scale || 1
    let xOffset = options.xOffset || 0
    let yOffset = options.yOffset || 0
    let pageNumber = 1
    let scriptHeader = options.scriptHeader || false
    let scriptFooter = options.scriptFooter || false
    let pageCount = options.pageCount || ''
    let showNotes = options.showNotes || false
    let showImages = options.showImages || false
    let includeImageSheets = options.includeImageSheets || false
    let showLineNumbers = options.showLineNumbers
    let showOutside = options.showOutside || false
    let titlePage = options.titlePage
    let headerString = '%p.'
    let footerString = ''
    let currentSection = []
    let pageNotes = []
    let pageImages = []
    let yCursor = (marginTop*scale)
    let currentParagraph = 0
    let watermarkText = options.scriptWatermarkString || ''
    let tableread = false

    let leftM = ((8.5*72)-10)*scale + xOffset
    let widthM = (8.5*72)-leftM - 30

    for (let i = 0; i < scriptData.title.length; i++) {
      if (scriptData.title[i].type == 'property') {
        let prop = scriptData.title[i].formattedText.split(': ')
        if (prop[0].toLowerCase() == 'tableread') {
          tableread = prop[1].trim()
        }
      }
    }

    if (render && showImages) {
      for (let i = 0; i < scriptData.title.length; i++) {
        if (scriptData.title[i].type == 'property') {
          let prop = scriptData.title[i].formattedText.split(': ')
          if (prop[0].toLowerCase() == 'image') {
            if (options.inputPath) {
              if (!imageHash['titleImage']) {
                progressCallback({string: 'Resizing title image', chatID: chatID})
                let filename = prop[1].trim()
                let imagesrc = path.join(path.dirname(options.inputPath),filename.toLowerCase())
                let image = await imageCache.getImage(imagesrc, Math.round((documentSize[0]-72)*4.1666))
                imageHash['titleImage'] = image
              }
            }
          }
        }
      }
      for (let i = 0; i < scriptData.script.length; i++) {
        if (scriptData.script[i].type == 'property') {
          let prop = scriptData.script[i].formattedText.split(': ')
          if (prop[0].toLowerCase() == 'image') {
            if (options.inputPath) {
              let filename = prop[1].trim()
              let imagesrc = path.join(path.dirname(options.inputPath),filename.toLowerCase())
              if (!imageHash[imagesrc]) {
                progressCallback({string: 'Resizing script image: ' + Math.round(((i+1)/scriptData.script.length)*100) + '%', chatID: chatID})
                let image = await imageCache.getImage(imagesrc, Math.round(widthM*4.1666))
                imageHash[imagesrc] = image
              }
            }
          }
        }
      }
    }

    if (includeImageSheets && render) {
      for (let i = 0; i < scriptData.script.length; i++) {
        if (scriptData.script[i].type == 'property') {
          let prop = scriptData.script[i].formattedText.split(': ')
          if (prop[0].toLowerCase() == 'image') {
            if (options.inputPath) {
              let filename = prop[1].trim()
              let imagesrc = path.join(path.dirname(options.inputPath),filename.toLowerCase())
              if (!imageHash[imagesrc + 'large']) {
                progressCallback({string: 'Resizing sheet image: ' + Math.round(((i+1)/scriptData.script.length)*100) + '%', chatID: chatID})
                let image = await imageCache.getImage(imagesrc, Math.round((documentSize[0]-(72*2))*4.1666))
                imageHash[imagesrc + 'large'] = image
              }
            }
          }
        }
      }
    }


    let currentScene = 0

    let renderWatermark = (number) => {
      if (watermarkText && render) {
        doc.fontSize(12*scale)
        doc.save()
        doc.fontSize(35)
        doc.font('extrabold')
        let string = watermarkText
        doc.lineWidth(0.2)
        doc.strokeColor('#444')
        doc.dash(0.3, {space: 1.6})
        let widthOfString = doc.widthOfString(string)
        doc.fontSize(35 * (((documentSize[0]-72)*scale*0.8)/widthOfString))
        doc.translate((72/2)+xOffset, ((documentSize[0]-72)*scale*.65)+yOffset)
        doc.rotate(20, {origin: [150, 70]})
        doc.text(string, 0, 0, {width: ((8.5*72)-72)*scale, lineBreak: false, lineGap: 0, align: 'center', stroke: true})
        doc.undash()
        doc.restore()
        doc.fontSize(12*scale)
      }
    }

    let renderHeader = (number) => {
      if (scriptHeader && render) {
        doc.fontSize(12*scale)
        doc.font('courier-prime-sans')
        let string = headerString
        string = string.replace('%p', pageNumber)
        string = string.replace('%pp', (pageCount))
        doc.text(string, 0+xOffset, (41*scale)+yOffset, {width: ((8.5*72)-72)*scale, lineBreak: false, lineGap: 0, align: 'right'})
      }
    }

    let renderFooter = () => {
      if (scriptFooter && render) {
        doc.fontSize(12*scale)
        doc.font('courier-prime-sans')
        doc.fillColor('#777')
        let string = footerString
        string = string.replace('%p', pageNumber)
        string = string.replace('%pp', (pageCount))
        renderFormattedText(string, 0+xOffset, ((documentSize[1]-50)*scale)+yOffset, ((8.5*72))*scale, 'center')
        doc.fillColor('black')
      }
    }

    let drawLineNumber = (yOverride, numberOverride) => {
      if (showLineNumbers) {
        let string
        if (numberOverride) {
          doc.fillColor('black')
          doc.font('bold')
          string = String(numberOverride) + '.'
        } else {
          doc.fillColor('#aaa')
          doc.font('regular')
          string = String(currentParagraph+1) + ' '
        }
        doc.fontSize(6)
        let y
        if (yOverride) {
          y = yOverride
        } else {
          y = yCursor
        }
        doc.text(string, 0, y+yOffset+1, {width: (50*scale), lineBreak: false, lineGap: 0, align: 'right'})
        doc.fillColor('black')
        doc.fontSize(12*scale)
        currentParagraph++
      }
    }

    let renderOutside = async () => {
      if (showOutside && render) {
        doc.save()
        let currentTop = 35
        let left = ((8.5*72)-10)*scale + xOffset
        let width = (8.5*72)-left - 30

        for (let i = 0; i < currentSection.length; i++) {
          let tHeight

          if (currentSection[i]) {
            currentSection[i] = currentSection[i].toUpperCase()
            if (i == 0) {
              doc.font('regular')
              doc.fontSize(7)
              tHeight = doc.heightOfString(currentSection[i], {width: width, lineBreak: true, lineGap: 0, align: 'left'})
              doc.text(currentSection[i], left, currentTop, {width: width, lineBreak: true, lineGap: 0, align: 'left'})
            }
            if (i == 1) {
              doc.font('extrabold')
              doc.fontSize(10)
              tHeight = doc.heightOfString(currentSection[i], {width: width, lineBreak: true, lineGap: 0, align: 'left'})
              doc.text(currentSection[i], left, currentTop, {width: width, lineBreak: true, lineGap: 0, align: 'left'})
            }
            if (i == 2) {
              doc.font('regular')
              doc.fontSize(7)
              tHeight = doc.heightOfString(currentSection[i], {width: width, lineBreak: true, lineGap: 0, align: 'left'})
              doc.text(currentSection[i], left, currentTop, {width: width, lineBreak: true, lineGap: 0, align: 'left'})
            }
            currentTop += tHeight + 5

          }
        }
        currentTop += 5
        doc.save()
        doc.roundedRect(left, currentTop, width, 4, 2).clip()
        let per = (pageNumber-1)/Math.max(pageCount-1,1)
        doc.fillOpacity(0.3)
        doc.rect(left, currentTop, width*per, 4)
        doc.fill()
        for (var i = 0; i < 4; i++) {
          doc.lineWidth(0.1)
          doc.moveTo(left+(width*(i/4)), currentTop)
          doc.lineTo(left+(width*(i/4)), currentTop+4)
          doc.stroke()
        }
        doc.restore()
        doc.lineWidth(0.1)
        doc.roundedRect(left, currentTop, width, 4, 2)
        doc.stroke()
        currentTop += 10
        doc.font('thin')
        doc.fontSize(5)
        tHeight = doc.heightOfString('xxx', {width: left-10, lineBreak: false, lineGap: 0, align: 'left'})
        doc.text(pageNumber + ' / ' + (pageCount) + '', left, currentTop, {width: width, lineBreak: false, lineGap: 0, align: 'left'})
        currentTop += tHeight
        currentTop += 30

        if (showNotes) {
          for (let i = 0; i < pageNotes.length; i++) {
            doc.font('thin')
            doc.fontSize(8)
            tHeight = doc.heightOfString(pageNotes[i].text, {width: width, lineBreak: true, lineGap: 0, align: 'left'})
            doc.text(pageNotes[i].text, left, currentTop, {width: width, lineBreak: true, lineGap: 0, align: 'left'})
            doc.lineWidth(0.3)
            doc.moveTo(0, pageNotes[i].yLoc)
            doc.lineTo((8*72)*scale+xOffset-10, pageNotes[i].yLoc)
            doc.lineTo(left-10, currentTop+3.5)
            doc.lineTo(left-4, currentTop+3.5)
            doc.dash(2, {space: 1})
            doc.stroke()
            doc.fillColor('black')
            doc.rect(left-6, currentTop, 2, tHeight)
            doc.fill()
            currentTop += tHeight + 12
          }
          if (pageNotes.length > 0) {
            doc.fillColor('#ccc')
            doc.polygon([(8.5*72)-70,0],[(8.5*72),0],[(8.5*72),70])
            doc.fill()
            doc.lineWidth(1)
            doc.moveTo((8.5*72)-70,0)
            doc.lineTo((8.5*72),70)
            doc.dash(4, {space: 2})
            doc.stroke()
            currentTop += 30
          }
        }

        if (showImages) {
          for (let i = 0; i < pageImages.length; i++) {
            doc.lineWidth(0.1)
            let height = width*(1/2.35)
            doc.image(imageHash[pageImages[i].filename], left, currentTop, {width: width})
            doc.rect(left, currentTop, width, height)
            doc.undash()
            doc.stroke()
            currentTop += height + 30
          }
        }

        for (let i = 0; i < 3; i++) {
          doc.lineWidth(0.1)
          let height = width*(1/2.35)
          doc.rect(left, currentTop, width, height)
          doc.dash(1, {space: 0.5})
          doc.stroke()
          currentTop += height + 30
        }
        doc.undash()
        doc.fillColor('black')
        doc.font('regular')
        doc.fontSize(8)
        doc.text(pageNumber + ' / ' + (pageCount) + '', 0, documentSize[1]-40, {width: (8.5*72-30), lineBreak: false, lineGap: 0, align: 'right'})
        for (let i = 0; i < scriptData.title.length; i++) {
          if (scriptData.title[i].type == 'title') {
            doc.fillColor('black')
            doc.font('extrabold')
            doc.fontSize(8)
            doc.text(scriptData.title[i].plainText, 0, documentSize[1]-40, {width: (8.5*72-80), lineBreak: false, lineGap: 0, align: 'right'})
          }
        }
        doc.restore()
        doc.fontSize(12*scale)
        doc.fillColor('black')
      }
    }

    let addPage = (dontReallyAddAPage) => {
      renderHeader()
      renderFooter()
      renderOutside()
      if (!dontReallyAddAPage) {
        pageNotes = []
        pageImages = []
        yCursor = (marginTop*scale)
        pageNumber++
        if (render) {
          doc.addPage()
        } else {
          doc.addPage()
        }
      }

      renderWatermark()

      return yCursor
    }

    let renderDialogueLines = (scriptData, currentScriptNode, yCursor, documentSize, scale, untilNode, untilSentence, characterText, startSentence, continued) => {
      let done = false
      let j = currentScriptNode+1
      let fontStyle = {bold: false, italic: false, underline: false, highlight: false, strikethrough: false}
      let sentenceText
      if (characterText) {
        width = (documentSize[0]-250-72)*scale
        left = 250*scale
        lineAfter = false
        let chrString = characterText
        if (continued) {
          chrString += " (CONT'D)"
        }

        let dialogueHeight = doc.heightOfString(chrString, {width: width, lineBreak: true, lineGap: 0, align: 'left'})
        //if (render) {
          drawLineNumber(yCursor)
          renderFormattedText(chrString, left, yCursor, width, 'left', fontStyle)
        //}
        yCursor += dialogueHeight
      }
      while (done == false) {
        let token = scriptData.script[j]
        let dialogueHeight = 0
        let width = 0
        let left = 0
        let align = 'left'
        let lineBefore = false
        let lineAfter = false
        let sentences
        let plainSentences

        switch (token.type) {
          case 'character':
            width = (documentSize[0]-250-72)*scale
            left = 250*scale
            lineAfter = false
            dialogueHeight += doc.heightOfString(token.plainText, {width: width, lineBreak: true, lineGap: 0, align: align})
            break
          case 'parenthetical':
            width = 250*scale
            left = 210*scale
            lineAfter = false
            dialogueHeight += doc.heightOfString(token.plainText, {width: width, lineBreak: true, lineGap: 0, align: align})
            sentenceText = token.formattedText
            break
          case 'dialogue':
            width = 266*scale
            left = 180*scale
            lineAfter = false

            sentenceText = token.formattedText

            sentences = (token.formattedText + ' ').match( /([^\.!\?]+[\.!\?]+)([^\.!\?])\"?/g )
            plainSentences = (token.plainText + ' ').match( /([^\.!\?]+[\.!\?]+)([^\.!\?])\"?/g )
            let plainSentenceText
            if (!sentences) {
              sentences = [token.formattedText]
            }
            if (!plainSentences) {
              plainSentences = [token.plainText]
            }
            if (untilSentence) {
              if (j == (untilNode-1)) {
                sentenceText = sentences.slice(0,untilSentence).join('')
              } else {
                for (var z = 0; z < sentences.length; z++) {
                  sentenceText = sentences.slice(0,z+1).join('')
                }
              }

            }
            if (startSentence) {
              sentenceText = sentences.slice(startSentence).join('')
              plainSentenceText = plainSentences.slice(startSentence).join('')
            }
            if (startSentence) {
              dialogueHeight += doc.heightOfString(plainSentenceText, {width: width, lineBreak: true, lineGap: 0, align: align})
            } else {
              dialogueHeight += doc.heightOfString(token.plainText, {width: width, lineBreak: true, lineGap: 0, align: align})
            }
            break
          case 'dialogue_end':
            lineAfter = true
            done = true
            break
          case 'inline_note':
            pageNotes.push({yLoc: yCursor+(5.5*scale)+yOffset, text: token.plainText})
            token.formattedText = null
            //continue
        }
        if (token.formattedText) {
          if (j == (untilNode-1)) {
            drawLineNumber(yCursor)
            renderFormattedText(sentenceText, left, yCursor, width, align, fontStyle)
          } else if (startSentence) {
            drawLineNumber(yCursor)
            renderFormattedText(sentenceText, left, yCursor, width, align, fontStyle)
            startSentence = null
          } else {
            drawLineNumber(yCursor)
            renderFormattedText(token.formattedText, left, yCursor, width, align, fontStyle)
          }
        }
        if (lineAfter) {
          yCursor += dialogueHeight + (11.80*scale)
        } else {
          yCursor += dialogueHeight
        }
        j++
        if (j == (untilNode)) { done = true }
      }
      return {yCursor: yCursor, currentScriptNode: j}
    }

    let renderDialogue = (scriptData, currentScriptNode, yCursor, documentSize, scale) => {
      let done = false
      let j = currentScriptNode+1
      let dialogueHeight = 0
      let dialogueCount = 0
      let split = false
      let splitNode = 0
      let splitSentence = 0
      let characterText
      let result = {yCursor: yCursor, currentScriptNode: j}
      while (done == false) {
        let token = scriptData.script[j]
        let width = 0
        let left = 0
        let align = 'left'
        let lineBefore = false
        let lineAfter = false
        let fontStyle = {bold: false, italic: false, underline: false, highlight: false, strikethrough: false}
        switch (token.type) {
          case 'character':
            width = (documentSize[0]-250-72)*scale
            left = 250*scale
            lineAfter = false
            dialogueHeight += doc.heightOfString(token.plainText, {width: width, lineBreak: true, lineGap: 0, align: align})
            characterText = token.plainText
            break
          case 'parenthetical2':
            sceneListDuration += getDurationOfWords(token.plainText, 300)+1000
            width = 250*scale
            left = 210*scale
            lineAfter = false
            dialogueHeight += doc.heightOfString(token.plainText, {width: width, lineBreak: true, lineGap: 0, align: align})
            if ((yCursor + dialogueHeight + (doc.heightOfString("(MORE)", {width: width, lineBreak: true, lineGap: 0, align: align}))*2) > ((documentSize[1]-55)*scale)) {
              if (dialogueCount == 0) {
                splitNode = j+2
                done = true
                i = j
              } else {
                // cool - we can draw at least one sentence
               renderDialogueLines(scriptData, currentScriptNode, yCursor, documentSize, scale, j)
                split = true
                splitNode = j+1
                splitSentence = z
              }
              yCursor = addPage()
              result = renderDialogueLines(scriptData, splitNode-3, yCursor, documentSize, scale, null, null, characterText, z)
              done = true
              i = j
            }
            break
          case 'dialogue':
          case 'parenthetical':
            sceneListDuration += getDurationOfWords(token.plainText, 300)+1000
            width = 266*scale
            left = 180*scale
            lineAfter = false
            let sentences = (token.plainText + ' ').match( /([^\.!\?]+[\.!\?]+)([^\.!\?])\"?/g )
            if (!sentences) {
              sentences = [token.plainText]
            }
            dialogueCount++
            let tHeight
            for (var z = 0; z < sentences.length; z++) {
              let sentenceText = sentences.slice(0,z+1).join(' ')
              tHeight = dialogueHeight + doc.heightOfString(sentenceText, {width: width, lineBreak: true, lineGap: 0, align: align}) + (doc.heightOfString("(MORE)", {width: width, lineBreak: true, lineGap: 0, align: align})*1)
              if (scriptData.script[j+1].type !== 'dialogue_end') {
                tHeight = dialogueHeight + doc.heightOfString(sentenceText, {width: width, lineBreak: true, lineGap: 0, align: align}) + (doc.heightOfString("(MORE)", {width: width, lineBreak: true, lineGap: 0, align: align})*2)
              }
              if ((yCursor + tHeight) > ((documentSize[1]-55)*scale)) {
                let continued = false
                if (dialogueCount == 1 && z == 0) {
                  // couldn't draw even the first sentence. clean break.
                  splitNode = j-1
                } else {
                  // cool - we can draw at least one sentence
                  continued = true
                  split = true
                  if (z == 0) {
                    splitNode = j-1
                    renderDialogueLines(scriptData, currentScriptNode, yCursor, documentSize, scale, j)
                  } else {
                    splitNode = j-1
                    renderDialogueLines(scriptData, currentScriptNode, yCursor, documentSize, scale, j+1, z)
                  }
                }
                // can I draw previous stuff?
                // if so draw it
                // break
                // draw character on next page
                //let result = renderDialogueLines(scriptData, i, yCursor, documentSize, scale)
                // if not,
                // break
                // try again
                tHeight = 0
                yCursor = addPage()
                result = renderDialogueLines(scriptData, splitNode, yCursor, documentSize, scale, null, null, characterText, z, continued)
                done = true
                i = j
                z = 999
              }
            }
            dialogueHeight += doc.heightOfString(token.plainText, {width: width, lineBreak: true, lineGap: 0, align: align})
            break
          case 'dialogue_end':
            // if no break, draw the dialogue
            if (split) {
              result = renderDialogueLines(scriptData, splitNode-2, yCursor, documentSize, scale, null, null, characterText)
            } else {
              result = renderDialogueLines(scriptData, i, yCursor, documentSize, scale)
            }
            done = true
            //i = j
            break
        }
        j++
      }
      return result //{yCursor: yCursor, currentScriptNode: j}
    }

    let renderFormattedText = (text, left, yCursor, width, align, incomingFontStyle) => {
      let textArray = text.split('|')
      let continued = true
      let fontStyleBuffer = [ Object.assign({}, incomingFontStyle) ]
      let setFontStyle = (fontStyle) => {
        if (!fontStyle.bold && !fontStyle.italic) {
          doc.font('courier-prime-sans')
        }
        if (fontStyle.bold && !fontStyle.italic) {
          doc.font('courier-prime-sans-bold')
        }
        if (!fontStyle.bold && fontStyle.italic) {
          doc.font('courier-prime-sans-italic')
        }
        if (fontStyle.bold && fontStyle.italic) {
          doc.font('courier-prime-sans-bold-italic')
        }
      }
      setFontStyle(fontStyleBuffer[fontStyleBuffer.length-1])
      for (var i = 0; i < textArray.length; i++) {
        if (i == 0) {
          doc.text('', left+xOffset, yCursor+yOffset, {width: width, lineBreak: true, lineGap: 0, align: align, continued: continued})
        }
        if (textArray[i] == 'bold-italic') {
          currentFontStyle =  Object.assign({}, fontStyleBuffer[fontStyleBuffer.length-1])
          currentFontStyle.bold = true
          currentFontStyle.italic = true
          fontStyleBuffer.push(currentFontStyle)
          setFontStyle(currentFontStyle)
          textArray[i] = null
        }
        if (textArray[i] == 'bold') {
          currentFontStyle =  Object.assign({}, fontStyleBuffer[fontStyleBuffer.length-1])
          currentFontStyle.bold = true
          fontStyleBuffer.push(currentFontStyle)
          setFontStyle(currentFontStyle)
          textArray[i] = null
        }
        if (textArray[i] == 'italic') {
          currentFontStyle =  Object.assign({}, fontStyleBuffer[fontStyleBuffer.length-1])
          currentFontStyle.italic = true
          fontStyleBuffer.push(currentFontStyle)
          setFontStyle(currentFontStyle)
          textArray[i] = null
        }
        if (textArray[i] == 'underline') {
          currentFontStyle =  Object.assign({}, fontStyleBuffer[fontStyleBuffer.length-1])
          currentFontStyle.underline = true
          fontStyleBuffer.push(currentFontStyle)
          textArray[i] = null
        }
        if (textArray[i] == 'highlight') {
          currentFontStyle =  Object.assign({}, fontStyleBuffer[fontStyleBuffer.length-1])
          currentFontStyle.highlight = true
          fontStyleBuffer.push(currentFontStyle)
          textArray[i] = null
        }
        if (textArray[i] == 'strikethrough') {
          currentFontStyle =  Object.assign({}, fontStyleBuffer[fontStyleBuffer.length-1])
          currentFontStyle.strikethrough = true
          fontStyleBuffer.push(currentFontStyle)
          textArray[i] = null
        }
        if (textArray[i] == '/') {
          fontStyleBuffer.splice(-1,1)
          setFontStyle(fontStyleBuffer[fontStyleBuffer.length-1])
          textArray[i] = null
        }
        if (i == (textArray.length - 1)) {
          continued = false
          doc.text(textArray[i], {underline: fontStyleBuffer[fontStyleBuffer.length-1].underline, strike: fontStyleBuffer[fontStyleBuffer.length-1].strikethrough, continued: continued})
        } else {
          if (textArray[i]) {
            doc.text(textArray[i], {underline: fontStyleBuffer[fontStyleBuffer.length-1].underline, strike: fontStyleBuffer[fontStyleBuffer.length-1].strikethrough, continued: continued})
          }
        }
      }
    }

    if (titlePage && render) {
      progressCallback({string: "Rendering Title Page.", chatID: chatID})
      let yCursor = 11*72/2-72
      let tHeight
      let breakYet = false
      let hasDraftDate = false

      if (imageHash['titleImage'] && showImages) {
        let width = documentSize[0]-(72*2)
        let height = width*(1/2.35)
        yCursor = yCursor-(height/2)
        doc.image(imageHash['titleImage'], documentSize[0]-width-(50), yCursor, {width: width})
        yCursor += height + (72/4)
      }

      if (tableread) {
        let qrImage = qr.imageSync(tableread, {ec_level: 'H', type: 'png', size: 15, margin: 0, parse_url: true})
        doc.image(qrImage, documentSize[0]-100, documentSize[1]-100, {width: 70})
        doc.font('bold')
        doc.fontSize(8)
        doc.text("Listen to the script on your phone:", documentSize[0]-180-10, documentSize[1]-100, {width: 80, lineBreak: true, lineGap: 0, align: 'right'})
        doc.font('thin')
        doc.fontSize(6)
        doc.text("Open the camera app, and point the camera here...", documentSize[0]-180-10, documentSize[1]-100+20, {width: 80, lineBreak: true, lineGap: 0, align: 'right'})

      }

      //

      let width = documentSize[0]-(72*2)
      let left = documentSize[0]-width-50

      for (let i = 0; i < scriptData.title.length; i++) {
        switch (scriptData.title[i].type) {
          case 'title':
            doc.fillColor('black')
            doc.font('black')
            doc.fontSize(55)
            tHeight = doc.heightOfString(scriptData.title[i].plainText, left, yCursor, {width: width, lineBreak: false, lineGap: 0, align: 'center'})
            doc.text(scriptData.title[i].plainText, left, yCursor, {width: width, lineBreak: false, lineGap: 0, align: 'center'})
            yCursor += tHeight + 10
            break
          case 'author':
            doc.fillColor('black')
            doc.font('bold')
            doc.fontSize(12)
            tHeight = doc.heightOfString(scriptData.title[i].plainText, left, yCursor, {width: width, lineBreak: false, lineGap: 0, align: 'center'})
            doc.text('by ' + scriptData.title[i].plainText, left, yCursor, {width: width, lineBreak: false, lineGap: 0, align: 'center'})
            yCursor += tHeight + 10
            break
          case 'draft_date':
          case 'revision':
            hasDraftDate = true
            if (!breakYet) {
              yCursor += 80
              breakYet = true
            }
            let string
            if (scriptData.title[i].type =='draft_date') {
              string = 'DRAFT DATE: ' + scriptData.title[i].plainText
            } else {
              string = 'REVISION: ' + scriptData.title[i].plainText
            }
            doc.fillColor('black')
            doc.font('regular')
            doc.fontSize(8)
            tHeight = doc.heightOfString(scriptData.title[i].plainText, left, yCursor, {width: width, lineBreak: false, lineGap: 0, align: 'center'})
            doc.text(string, left, yCursor, {width: width, lineBreak: false, lineGap: 0, align: 'center'})
            yCursor += tHeight + 10
            break
        }
      }

      if (!hasDraftDate) {
        yCursor += 80
        let dateString = moment().format('MMMM Do, YYYY')
        let string
        string = 'DRAFT DATE: ' + dateString.charAt(0).toUpperCase() + dateString.slice(1)
        doc.fillColor('black')
        doc.font('regular')
        doc.fontSize(8)
        tHeight = doc.heightOfString(string, left, yCursor, {width: width, lineBreak: false, lineGap: 0, align: 'center'})
        doc.text(string, left, yCursor, {width: width, lineBreak: false, lineGap: 0, align: 'center'})
      }

      doc.addPage()
    }

    if (includeImageSheets && render) {

      let sectionCurrent

      let currentImage = 0

      for (let i = 0; i < scriptData.script.length; i++) {
        if (scriptData.script[i].type == 'section') {
          sectionCurrent = scriptData.script[i].plainText
        }
        if (scriptData.script[i].type == 'property') {
          let prop = scriptData.script[i].formattedText.split(': ')
          if (prop[0].toLowerCase() == 'image') {
            if (options.inputPath) {
              let filename = prop[1].trim()
              let imagesrc = path.join(path.dirname(options.inputPath),filename.toLowerCase())
              let width = documentSize[0]-(72*2)
              let height = width*(1/2.35)
              yCursor = 50 + ((currentImage % 3 )*(height + 35))
              doc.image(imageHash[imagesrc + 'large'], documentSize[0]-width-(100/2), yCursor, {width: width})
              yCursor += height + 5
              doc.font('regular')
              doc.fontSize(8)
              doc.text(sectionCurrent.toUpperCase(), documentSize[0]-width-(100/2), yCursor, {width: width, lineBreak: false, lineGap: 0, align: 'right'})
              currentImage++
              if (currentImage % 3 == 0 ) {
                doc.addPage()
              }
            }
          }
        }
      }
      doc.addPage()
      yCursor = 0
    }

    if (render) {
      progressCallback({string: 'Writing ' + pageCount + ' pages.', chatID: chatID})
    }

    if (render) {
      renderWatermark()
    }

    for (var i = 0; i < scriptData.script.length; i++) {
      let token = scriptData.script[i]
      let fontStyle = {bold: false, italic: false, underline: false, highlight: false, strikethrough: false}
      let height = 0
      let width = 0
      let left = 0
      let align = 'left'
      let lineBefore = false
      let lineAfter = true
      doc.fontSize(12*scale)
      switch (token.type) {
        case 'centered':
          width = 450*scale
          left = 108*scale
          align = 'center'
          sceneListDuration += getDurationOfWords(token.plainText, 200)+500
          break
        case 'scene_heading':
          sceneListSceneNumber++
          if (sceneListCurrentScene) {
            sceneListCurrentScene.noteCount = sceneListNoteCount
            sceneListCurrentScene.duration = sceneListDuration
            sceneList.push(sceneListCurrentScene)
          }
          sceneListDuration = 2000
          sceneListNoteCount = 0
          sceneListCurrentScene = {currentPage: pageNumber, sceneNumber: sceneListSceneNumber, currentAct: sceneListCurrentAct, currentSection: sceneListCurrentSection, slugline: token.plainText}

          fontStyle.bold = true
          lineBefore = true
          width = 465*scale
          left = 108*scale
          currentScene++
          break
        case 'action':
          width = 460.55*scale
          left = 108*scale
          break
        case 'transition':
          width = (documentSize[0]-72)*scale
          left = 0
          align = 'right'
          sceneListDuration += 1000
          break
        case 'dialogue_begin':
          let result = renderDialogue(scriptData, i, yCursor, documentSize, scale)
          yCursor = result.yCursor
          i = result.currentScriptNode-1
          continue
        case 'dialogue_end':
          continue
        case 'page_break':
          yCursor = addPage()
          continue
       ////////////////////////////////////
        case 'note':
        case 'inline_note':
          sceneListNoteCount++
          pageNotes.push({yLoc: yCursor-(7*scale)+yOffset, text: token.plainText})
          continue
        case 'section':
          if (token.depth == 1) {
            sceneListCurrentAct = token.plainText
          } else {
            sceneListCurrentSection = token.plainText
          }
          currentSection[token.depth-1] = token.plainText
          currentSection = currentSection.slice(0,token.depth)
          continue
        case 'property':
          let prop = token.formattedText.split(': ')
          switch (prop[0].toLowerCase()) {
            case 'header':
              headerString = prop[1]
              break
            case 'footer':
              footerString = prop[1]
              break
            case 'image':
              if (options.inputPath) {
                let filename = prop[1].trim()
                let imagesrc = path.join(path.dirname(options.inputPath),filename.toLowerCase())
                pageImages.push({filename: imagesrc})
              }
              break
          }
          continue
        default:
          continue
      }
      if (lineBefore) {
        yCursor += height + (12*scale)
      }
      height = doc.heightOfString(token.plainText, {width: width, lineBreak: true, lineGap: 0, align: align})
      if (token.type == 'scene_heading') {
        if ((yCursor + height + (12*scale*5)) > ((documentSize[1]-55)*scale)) {
          // overrun
          yCursor = addPage()
        }
      } else {
        if ((yCursor + height) > ((documentSize[1]-55)*scale)) {
          yCursor = addPage()
        }
      }
      if (token.formattedText) {
        if (render) {
          if (token.type == 'scene_heading') {
            drawLineNumber(null, currentScene)
          } else {
            drawLineNumber()
          }
          renderFormattedText(token.formattedText, left, yCursor, width, align, fontStyle)
        }
      }
      if (lineAfter) {
        yCursor += height + (11.80*scale)
      } else {
        yCursor += height
      }
    }

    if (sceneListCurrentScene) {
      sceneListCurrentScene.noteCount = sceneListNoteCount
      sceneListCurrentScene.duration = sceneListDuration
      sceneList.push(sceneListCurrentScene)
    }

    addPage(true)
    doc.end()
    if (render) {
      stream.on('finish', () => {
        doneCallback({string: "done!", chatID: chatID, outputFileName: outputFileName})
        finishedCallback()
        resolve({ pageCount: pageNumber, sceneList: sceneList })
      })
    } else {
      resolve({ pageCount: pageNumber, sceneList: sceneList })
    }
  })
}

const getSettings = () => {
  let settings = [
    { type: 'title', text: 'Export a Script PDF' },
    { type: 'description', text: 'Export your script as an industry standard script or with margins to include notes, storyboards, and space to write.' },
    { id: 'scriptPageSize', label: 'Page Size', type: 'dropdown', values: [{text: 'Letter', value: 'letter'}, {text: 'A4', value: 'a4'}], default: 1 },
    { id: 'scriptFont', label: 'Font', type: 'dropdown', values: [{text: 'Courier Prime', value: 'prime'}, {text: 'Courier Prime Sans', value: 'sans'}], default: 1 },
    { id: 'scriptType', label: 'Type', type: 'dropdown', values: [{text: 'Normal', value: 'normal'}, {text: 'Margin with thumbnails', value: 'thumbnails'}, {text: 'Margin with blank', value: 'blank'}], default: 1 },
    { type: 'spacer' },
    { id: 'scriptIncludeTitlePage', label: 'Include Title Page', type: 'checkbox', default: true },
    { id: 'scriptShowLineNumbers', label: 'Show line numbers', type: 'checkbox', default: true },
    { id: 'scriptIncludeNotes', label: 'Show Notes', type: 'checkbox', default: true },
    { id: 'scriptIncludeImages', label: 'Show Images', type: 'checkbox', default: true },
    { id: 'scriptIncludeImageSheets', label: 'Include Pages of Images', type: 'checkbox', default: false },
    { type: 'spacer' },
    { id: 'scriptWatermarkString', label: 'Watermark for the script', type: 'string', default: '' },
  ]
  return settings
}

module.exports = {
  generate,
  getPages,
  getSettings
}