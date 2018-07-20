// todo: still need to break after partial sentences
// draw notes
// how can I get the page number?


const fs = require('fs')
const path = require('path')
const pdfDocument = require('pdfkit')
const moment = require('moment')
const fountainParse = require('../fountain-parse')

const generate = async (options = {}) => {
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
    showLineNumbers: true,
    showNotes: true,
    showOutside: true,
    titlePage: true,
  }


  await renderScript(scriptData, true, options.outputPath, notesScriptOptions)
}

const getPages = async (options = {}) => {
  let scriptData = parseScript(options.inputPath)
  return await renderScript(scriptData, false)
}


const parseScript = (filepath) => {
  let contents = fs.readFileSync(filepath, "utf8");
  let scriptData = fountainParse.parse(contents)
  console.log(scriptData.script)
  return scriptData
}

const renderScript = (scriptData, render, outputFilePath, options) => {
  return new Promise((resolve, reject) => {
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

    if (render) {
      stream = doc.pipe(fs.createWriteStream(outputFilePath))
    }

    let scale = options.scale || 1
    let xOffset = options.xOffset || 0
    let yOffset = options.yOffset || 0
    let pageNumber = 1
    let scriptHeader = options.scriptHeader || false
    let scriptFooter = options.scriptFooter || false
    let pageCount = options.pageCount || ''
    let showNotes = options.showNotes || false
    let showLineNumbers = options.showLineNumbers || false
    let showOutside = options.showOutside || false
    let titlePage = options.titlePage || true

    pageNumber = 1

    let headerString = '%p.'
    let footerString = ''

    let currentSection = []
    let pageNotes = []

    let yCursor = (marginTop*scale)

    let currentParagraph = 0
    let currentScene = 0

    let renderHeader = (number) => {
      if (scriptHeader && render) {
        doc.fontSize(12*scale)
        doc.font('courier-prime-sans')
        let string = headerString
        string = string.replace('%p', pageNumber)
        string = string.replace('%pp', (pageCount+1))
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
        string = string.replace('%pp', (pageCount+1))
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

    let renderOutside = () => {
      if (showOutside && render) {
        doc.save()

        let currentTop = 35

        let left = ((8.5*72)-10)*scale + xOffset
        let width = (8.5*72)-left - 30




        for (let i = 0; i < currentSection.length; i++) {
          let tHeight

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

        currentTop += 5

        doc.save()
        doc.roundedRect(left, currentTop, width, 4, 2).clip()

        let per = (pageNumber-1)/pageCount
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
        doc.text(pageNumber + ' / ' + (pageCount+1) + '', left, currentTop, {width: width, lineBreak: false, lineGap: 0, align: 'left'})
        currentTop += tHeight





        currentTop += 30

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
        doc.text(pageNumber + ' / ' + (pageCount+1) + '', 0, documentSize[1]-40, {width: (8.5*72-30), lineBreak: false, lineGap: 0, align: 'right'})

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
        yCursor = (marginTop*scale)
        pageNumber++
        if (render) {
          doc.addPage()
        }
      }
      return yCursor
    }


    let renderDialogueLines = (scriptData, currentScriptNode, yCursor, documentSize, scale, untilNode, untilSentence, characterText) => {
      let done = false
      let j = currentScriptNode+1
      let fontStyle = {bold: false, italic: false, underline: false, highlight: false, strikethrough: false}
      let sentenceText
      if (characterText) {
        width = (documentSize[0]-250-72)*scale
        left = 250*scale
        lineAfter = false
        let dialogueHeight = doc.heightOfString(characterText + " (CONT'D)", {width: width, lineBreak: true, lineGap: 0, align: 'left'})
        if (render) {
          drawLineNumber(yCursor)
          renderFormattedText(characterText + " (CONT'D)", left, yCursor, width, 'left', fontStyle)
        }
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
            break
          case 'dialogue':
            width = 266*scale
            left = 180*scale
            lineAfter = false
            let sentences = token.formattedText.match( /([^\.!\?]+[\.!\?]+)([^\.!\?])\"?/g )
            if (!sentences) {
              sentences = [token.formattedText]
            }
            if ((j == (untilNode-1)) && (untilSentence)) {
              for (var z = 0; z < (untilSentence+1); z++) {
                sentenceText = sentences.slice(0,z+1).join(' ')
              }
              // console.log(untilSentence)
              // console.log( "SPLIT: ", sentenceText)
            } else {
              for (var z = 0; z < sentences.length; z++) {
                sentenceText = sentences.slice(0,z+1).join(' ')
              }
            }
            dialogueHeight += doc.heightOfString(token.plainText, {width: width, lineBreak: true, lineGap: 0, align: align})
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
           // console.log(sentenceText)
            if (render) {
              drawLineNumber(yCursor)
              renderFormattedText(sentenceText, left, yCursor, width, align, fontStyle)
            }
          } else {
            if (render) {
              drawLineNumber(yCursor)
              renderFormattedText(token.formattedText, left, yCursor, width, align, fontStyle)
            }
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
          case 'parenthetical':
            width = 250*scale
            left = 210*scale
            lineAfter = false
            dialogueHeight += doc.heightOfString(token.plainText, {width: width, lineBreak: true, lineGap: 0, align: align})
            if ((yCursor + dialogueHeight + (doc.heightOfString("(MORE)", {width: width, lineBreak: true, lineGap: 0, align: align}))*2) > ((documentSize[1]-55)*scale)) {
              // console.log("omg, broke on parent")
              // console.log(scriptData.script[j-1].plainText)
              // console.log({y: yCursor, dialogueHeight: dialogueHeight, max: ((documentSize[1]-55)*scale)})
              if (dialogueCount == 0) {
                // couldn't draw even the first sentence. clean break.
                splitNode = j+1
                //result = renderDialogueLines(scriptData, splitNode-2, yCursor, documentSize, scale, null, null, characterText)
                done = true
                i = j
              } else {
                // console.log("DOESNT FIT: SPLIT BREAK")
                // cool - we can draw at least one sentence
                renderDialogueLines(scriptData, currentScriptNode, yCursor, documentSize, scale, j)
                split = true
                splitNode = j+1
                splitSentence = z
              }
              yCursor = addPage()

              result = renderDialogueLines(scriptData, splitNode-2, yCursor, documentSize, scale, null, null, characterText)
              done = true
              i = j
            }
            break
          case 'dialogue':
            width = 266*scale
            left = 180*scale
            lineAfter = false
            let sentences = token.plainText.match( /([^\.!\?]+[\.!\?]+)([^\.!\?])\"?/g )
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
                if (dialogueCount == 1 && z == 0) {
                  // couldn't draw even the first sentence. clean break.
                } else {
                  // console.log(sentenceText)
                  // console.log(z)
                  // console.log("DOESNT FIT: SPLIT BREAK")
                  // cool - we can draw at least one sentence
                  renderDialogueLines(scriptData, currentScriptNode, yCursor, documentSize, scale, j+1, z)
                  split = true
                  if (z == (sentences.length-1)) {
                    splitNode = j+2
                  } else {
                    splitNode = j+1
                  }
                  splitSentence = z
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
      let yCursor = 11*72/2-72
      let tHeight
      let breakYet = false
      for (let i = 0; i < scriptData.title.length; i++) {
        console.log(scriptData.title[i])

        switch (scriptData.title[i].type) {
          case 'title':
            doc.fillColor('black')
            doc.font('black')
            doc.fontSize(55)
            tHeight = doc.heightOfString(scriptData.title[i].plainText, 0, yCursor, {width: (8.5*72), lineBreak: false, lineGap: 0, align: 'center'})
            doc.text(scriptData.title[i].plainText, 0, yCursor, {width: (8.5*72), lineBreak: false, lineGap: 0, align: 'center'})
            yCursor += tHeight + 10
            break
          case 'author':
            doc.fillColor('black')
            doc.font('bold')
            doc.fontSize(12)
            tHeight = doc.heightOfString(scriptData.title[i].plainText, 0, yCursor, {width: (8.5*72), lineBreak: false, lineGap: 0, align: 'center'})
            doc.text('by ' + scriptData.title[i].plainText, 0, yCursor, {width: (8.5*72), lineBreak: false, lineGap: 0, align: 'center'})
            yCursor += tHeight + 10
            break
          case 'draft_date':
          case 'revision':
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
            tHeight = doc.heightOfString(scriptData.title[i].plainText, 0, yCursor, {width: (8.5*72), lineBreak: false, lineGap: 0, align: 'center'})
            doc.text(string, 0, yCursor, {width: (8.5*72), lineBreak: false, lineGap: 0, align: 'center'})
            yCursor += tHeight + 10
            break

        }


      }
      doc.addPage()
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
          break
        case 'scene_heading':
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
          pageNotes.push({yLoc: yCursor-(7*scale)+yOffset, text: token.plainText})
          continue
        case 'section':
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

          }
          continue
        default:
          // console.log(token.type, token.text)
          // console.log(token)
          continue
      }
      if (lineBefore) {
        yCursor += height + (12*scale)
      }
      height = doc.heightOfString(token.plainText, {width: width, lineBreak: true, lineGap: 0, align: align})
        
      if (token.type == 'scene_heading') {
        if ((yCursor + height + (12*scale*5)) > ((documentSize[1]-55)*scale)) {
          console.log(token.formattedText)
          console.log("OVERRUN")
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
    addPage(true)

    doc.end()
    if (render) {
      stream.on('finish', () => {
        resolve({ pageCount: pageNumber })
      })
    } else {
      resolve({ pageCount: pageNumber })
    }
  })
}

module.exports = {
  generate,
  getPages
}