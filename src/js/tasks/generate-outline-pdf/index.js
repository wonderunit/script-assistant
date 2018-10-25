const fs = require('fs')
const path = require('path')
const pdfDocument = require('pdfkit')
const moment = require('moment')
const fountainParse = require('../fountain-parse')

const parseScript = (filepath) => {
  let contents = fs.readFileSync(filepath, "utf8");
  let scriptData = fountainParse.parse(contents, filepath)

  console.log(scriptData)

  let title
  let author
  let chunks = []
  let sequence = []
  let sceneHasImage = false
  let mode = null
  let currentScene = 0

  for (let i = 0; i < scriptData.title.length; i++) {
    if (scriptData.title[i].type == "title") {
      title = scriptData.title[i].plainText.replace(/<(?:.|\n)*?>/gm, '')
    }
    if (scriptData.title[i].type == "author") {
      author = scriptData.title[i].plainText.replace(/<(?:.|\n)*?>/gm, '')
    }
  }

  for (var i = 0; i < scriptData.script.length; i++) {
    if (mode == "scene" && !sceneHasImage && sequence.length > 0 && scriptData.script[i].type !== "property") {
      sceneHasImage = true
      sequence.push({type: "image", text: 'blank'})
    }
    if (scriptData.script[i].type == "property") {
      if (scriptData.script[i].text.split(':')[0].trim() == "image") {
        sceneHasImage = true
        let filename = scriptData.script[i].text.split(':')[1].trim()
        let imagesrc = path.join(path.dirname(filepath),filename.toLowerCase())
        sequence.push({type: "image", text: imagesrc})
      }
    }
    if (scriptData.script[i].type == "section" && scriptData.script[i].depth == 1) {
      if (sequence.length > 0) {
        chunks.push(sequence)
      }
      sequence = []
      chunks.push([{type: "act", text: scriptData.script[i].text}])
    }
    if (scriptData.script[i].type == "section" && scriptData.script[i].depth == 2) {
      if (sequence.length > 0) {
        chunks.push(sequence)
      }
      sequence = []
      sequence.push({type: "title", text: scriptData.script[i].text})
    }
    if (scriptData.script[i].type == "scene_heading" && scriptData.script[i].text !== 'BLACK') {
      currentScene++
      mode = 'scene'
      sceneHasImage = false
      sequence.push({type: "scene", text: scriptData.script[i].text, number: currentScene})
    }
    if (scriptData.script[i].type == "note") {
      sequence.push({type: "note", text: scriptData.script[i].text})
    }
  }
  chunks.push(sequence)
  return {chunks: chunks, title: title, author: author}
}

const renderChunk = (chunk, doc, width, x, y, render) => {
  let verticalCursor = 0
  let paddingBottom = 0
  let atomText
  let needsWork = false

  for (var i = 0; i < chunk.length; i++) {
    atomText = chunk[i].text
    paddingBottom = 0
    doc.fontSize(width*0.035)
    doc.font('regular')
    if (chunk[i].type == "act") {
      doc.fontSize(width*0.050)
      doc.font('thin')
      atomText = chunk[i].text.toUpperCase()
    }
    if (chunk[i].type == "title") {
      doc.fontSize(width*0.1)
      doc.font('extrabold')
      paddingBottom = width*0.01
      needsWork = Array.isArray(chunk[i].text.match(/~~/g, ''))
      atomText = chunk[i].text.replace(/~~/g, '').toUpperCase()
    }
    if (chunk[i].type == "scene") {
      doc.fontSize(width*0.035)
      doc.font('regular')
      paddingBottom = width*0.01
      needsWork = Array.isArray(chunk[i].text.match(/~~/g, ''))
      atomText = chunk[i].text.replace(/~~/g, '').toUpperCase()
      if (render) {
        doc.save()
        doc.fontSize(width*0.02)
        doc.font('thin')
        doc.text(chunk[i].number + '.', x-(width*0.04)-(width*0.015), y+ verticalCursor+(width*0.008), {width: width*0.04, align: 'right'})
        doc.restore()
      }
    }
    if (chunk[i].type == "scene") {
      doc.fontSize(width*0.035)
      doc.font('regular')
      paddingBottom = width*0.01
    }
    if (chunk[i].type == "note") {
      doc.fontSize(width*0.025)
      doc.font('regular')
      paddingBottom = width*0.02
      needsWork = true
      if (render) {
        doc.lineWidth((width*0.01))
        doc.lineCap('butt')
          .moveTo(x-(width*0.025), y+ verticalCursor)
          .lineTo(x-(width*0.025), y+ verticalCursor + (width*0.025))
          .stroke()
      }
    }
    if (chunk[i].type == "image") {
      paddingBottom = width*0.045
    }
    if (i == (chunk.length-1)) {
      paddingBottom = 0
    }
    if (chunk[i].type == "image") {
      if (render) {
        console.log(chunk[i].text)
        if (chunk[i].text !== 'blank') {
          doc.image(chunk[i].text, x, y+ verticalCursor, {width: width})
        }
        doc.rect(x,y+ verticalCursor,width,(width*(1/2.35)))
        doc.lineWidth(.1).stroke()
      }
      verticalCursor += (width*(1/2.35)) + paddingBottom
    } else {
      if (render) {
        doc.text(atomText, x, y+ verticalCursor, {width: width, align: 'left'})
      }
      verticalCursor += doc.heightOfString(atomText, {width: width, align: 'left'}) + paddingBottom
    }
  }
  if (render && needsWork) {
    doc.lineWidth((width*0.01))
    doc.dash((width*0.02), {space: (width*0.005)})
    doc.lineCap('butt')
      .moveTo(x-(width*0.07), y)
      .lineTo(x-(width*0.07), y+ verticalCursor + (width*0.015))
      .stroke()
    doc.undash()
  }
  return verticalCursor
}

const layoutChunks = (chunks, columnCount, doc, documentSize, render, margin) => {
  let actCount = 0
  let currentScene = 0
  let lastActStart

  for (var i = 0; i < chunks.length; i++) {
    if (chunks[i][0].type == "act") {
      actCount++
    }
  }
  let columnsFit = false
  let cursorY = margin[1]
  let cursorX = margin[0]
  let actSpacing = (documentSize[0]/columnCount)*0.4
  let columnSpacing = (documentSize[0]/columnCount)*0.15
  let verticalSpacing = (documentSize[0]/columnCount)*0.08
  for (var i = 0; i < chunks.length; i++) {
    let chunkWidth = Math.round((documentSize[0]- ((actCount-1)*actSpacing) - ((columnCount-1)*columnSpacing) - margin[0] -margin[2])/columnCount)
    if (chunks[i][0].type == "act" && i !== 0) {
      if (!lastActStart) { lastActStart = margin[0] }
      if (render) {
        doc.lineWidth(((documentSize[0]/columnCount)*0.015))
        doc.lineCap('butt')
          .moveTo(lastActStart, margin[1] + ((documentSize[0]/columnCount)*0.055))
          .lineTo(cursorX + chunkWidth, margin[1] + ((documentSize[0]/columnCount)*0.055))
          .stroke()
      }
      cursorY = margin[1]
      cursorX += chunkWidth + actSpacing
      lastActStart = cursorX
    }
    height = renderChunk(chunks[i], doc, chunkWidth, 0, cursorY, false)
    if ((cursorY+height) > documentSize[1]-margin[1]-margin[3]) {
      cursorY = margin[1] + (documentSize[0]/columnCount)*0.118
      cursorX += chunkWidth+ columnSpacing
      if ((cursorX+chunkWidth+actSpacing+columnSpacing+20) > (documentSize[0]- margin[0] -margin[2])) {
        break
      }
    }
    if (i == chunks.length-1) {
      columnsFit = true
    }
    if (render) {
      progressCallback({string: "Rendering Node " + (i+1) + ' of ' + chunks.length, chatID: chatID})
      renderChunk(chunks[i], doc, chunkWidth, cursorX, cursorY, true)
    }
    cursorY += height + verticalSpacing
    if (i == chunks.length-1 && render) {
      if (render) {
        doc.lineWidth(((documentSize[0]/columnCount)*0.015))
        doc.lineCap('butt')
          .moveTo(lastActStart, margin[1] + ((documentSize[0]/columnCount)*0.055))
          .lineTo(cursorX + chunkWidth, margin[1] + ((documentSize[0]/columnCount)*0.055))
          .stroke()
      }
    }
  }
  return columnsFit
}

let progressCallback
let doneCallback
let finishedCallback
let chatID

const generate = async (options = {}) => {
  progressCallback = options.progressCallback
  doneCallback = options.doneCallback
  finishedCallback = options.finishedCallback
  chatID = options.chatID
  progressCallback({string: "started", chatID: chatID})
  renderScript(options)
}

const renderScript = (options = {}) => {
  return new Promise((resolve, reject) => {
    let script = parseScript(options.inputPath)
    let documentSize = [48*72,24*72]
    let margin = [40, 22, 40, 40]
    let doc = new pdfDocument({size: documentSize, layout: 'portrait', margin: 0})
    doc.registerFont('thin',     path.join(__dirname, '..', '..', '..', 'fonts', 'wonder-unit-sans', 'WonderUnitSans-Thin.ttf'))
    doc.registerFont('italic',   path.join(__dirname, '..', '..', '..', 'fonts', 'wonder-unit-sans', 'WonderUnitSans-RegularItalic.ttf'))
    doc.registerFont('regular',     path.join(__dirname, '..', '..', '..', 'fonts', 'wonder-unit-sans', 'WonderUnitSans-Regular.ttf'))
    doc.registerFont('bold',     path.join(__dirname, '..', '..', '..', 'fonts', 'wonder-unit-sans', 'WonderUnitSans-Bold.ttf'))
    doc.registerFont('extrabold',     path.join(__dirname, '..', '..', '..', 'fonts', 'wonder-unit-sans', 'WonderUnitSans-Extrabold.ttf'))
    doc.registerFont('black',     path.join(__dirname, '..', '..', '..', 'fonts', 'wonder-unit-sans', 'WonderUnitSans-Black.ttf'))
    let stream = doc.pipe(fs.createWriteStream(options.outputPath))
    // try to layout, if too large, increment columnCount and try again
    let columnCount = 3
    let columnsFit = false
    while (!columnsFit) {
      columnsFit = layoutChunks(script.chunks, columnCount, doc, documentSize, false, margin)
      columnCount++
      progressCallback({string: "Trying to layout out... " + columnCount, chatID: chatID})
    }
    columnCount--
    layoutChunks(script.chunks, columnCount, doc, documentSize, true, margin)
    doc.fontSize(documentSize[0]/columnCount*.15)
    doc.font('black')
    let titleWidth = doc.widthOfString(script.title)
    let titleHeight = doc.heightOfString(script.title)
    doc.text(script.title, doc.page.width-margin[2]-titleWidth, doc.page.height-margin[3]-1.25-titleHeight, {lineBreak: false})
    let dateText = 'DRAFT: ' + moment().format('MMMM D, YYYY').toUpperCase() + '  //  ' + script.author
    doc.fontSize(documentSize[0]/columnCount*.025)
    doc.font('thin')
    let dateHeight = doc.heightOfString(dateText, {lineBreak: false, align: 'right', width: 400})
    doc.text(dateText, doc.page.width-margin[2]-400, doc.page.height-margin[3]-1.25-dateHeight-titleHeight-(documentSize[0]/columnCount*.01), {lineBreak: false, align: 'right', width: 400})
    doc.fontSize(10)
    doc.font('thin')
    let logoWidth = doc.widthOfString('')
    doc.fontSize(5)
    let wuWidth = doc.widthOfString(' WONDER UNIT', {characterSpacing: 1})
    doc.fontSize(6)
    let sbWidth = doc.widthOfString('   //   Outliner')
    doc.fontSize(10)
    doc.text('', doc.page.width-margin[2]-logoWidth-wuWidth-sbWidth-1.25, doc.page.height-margin[3]-1.25, {lineBreak: false})
    doc.fontSize(5)
    doc.text(' WONDER UNIT', doc.page.width-margin[2]-wuWidth-sbWidth, doc.page.height-margin[3]+0.5, {lineBreak: false, characterSpacing: 1})
    doc.fontSize(6)
    doc.text('   //   Outliner', doc.page.width-margin[2]-sbWidth, doc.page.height-margin[3], {lineBreak: false})
    stream.on('finish', () => {
      doneCallback({string: "done!", chatID: chatID})
      finishedCallback()
      resolve()
    })
    doc.end()
  })
}

const getSettings = () => {
  let settings = [
    { type: 'title', text: 'Export a script pdf' },
    { type: 'description', text: 'Export a script pdf' },
    { id: 'includeAct', label: 'Include Act', type: 'checkbox', default: true },
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