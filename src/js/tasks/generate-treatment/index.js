const fs = require('fs')
const path = require('path')
const pdfDocument = require('pdfkit')
const fountainParse = require('../fountain-parse')
const moment = require('moment')
const Jimp = require('jimp')
const qr = require('qr-image')


const imageCache = require('../image-cache.js')

const reader = require('../reader.js')



let imageHash = {}
let fountainString

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

const toTitleCase = (str) => {
  return str.replace(/\w\S*/g, function(txt){
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  })
}

let progressCallback
let doneCallback
let finishedCallback
let chatID

let pageNumber

let scriptReadArray
let scene

const generate = async (options = {}) => {
  let scriptData = parseScript(options.inputPath)

  let documentSize = [8.5*72,11*72]
  let marginTop = 50
  let marginLeft = 72
  let marginRight = 72+35
  let marginBottom = 50

  let xCursor = marginLeft
  let yCursor = marginTop

  let author

  pageNumber = 1

  let treatmentread

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
  let outputAudioFileName
  let outputFountainFileName

  let fName = []
  let title = ''
  for (let i = 0; i < scriptData.title.length; i++) {
    if (scriptData.title[i].type == "title") {
      title = scriptData.title[i].plainText.replace(/<(?:.|\n)*?>/gm, '')
    }
  }
  fName.push(title)
  fName.push('Treatment')
  if (options.settings.treatmentWatermarkString) {
    fName.push(options.settings.treatmentWatermarkString)
  }
  fName.push(moment().format("MMM Do YYYY"))

  outputFileName = path.join(options.outputPath, fName.join(' - ').replace(/[/\\?%*:|"<>]/g, ' ') + '.pdf')
  outputAudioFileName = path.join(options.outputPath, fName.join(' - ').replace(/[/\\?%*:|"<>]/g, ' ') + '.mp3')
  outputFountainFileName = path.join(options.outputPath, fName.join(' - ').replace(/[/\\?%*:|"<>]/g, ' ') + '.fountain')

  stream = doc.pipe(fs.createWriteStream(outputFileName))

  progressCallback = options.progressCallback
  doneCallback = options.doneCallback
  finishedCallback = options.finishedCallback
  chatID = options.chatID

  fountainString = ''

  progressCallback({string: "started", chatID: chatID})

  for (let i = 0; i < scriptData.title.length; i++) {
    if (scriptData.title[i].type == 'property') {
      let prop = scriptData.title[i].formattedText.split(': ')
      if (prop[0].toLowerCase() == 'treatmentread') {
        treatmentread = prop[1].trim()
      }
    }
  }

  /*
    Title
    Logline
    Characters
    Synopsis
      ACT
        Sequence
          Synopsis
  */

  let widthM = 2.5*72

  let showImages = options.settings.treatmentIncludeImages


  if (showImages) {
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

  let treatmentChunks = []
  let chunk = []

  for (var i = 0; i < scriptData.script.length; i++) {
    if (scriptData.script[i].plainText) {
      switch (scriptData.script[i].type) {
        case 'centered':
          break
        case 'action':
          break
        case 'transition':
          break
        case 'scene_heading':
          chunk.push({type: 'scene_heading', text: scriptData.script[i].plainText })
          break
        case 'character':
          break
        case 'parenthetical':
          break
        case 'dialogue':
          break
        case 'inline_note':
        case 'note':
          break
        case 'section':
          if (chunk.length > 0) {
            for (let z = 0; z < chunk.length; z++) {
              if (chunk[z].type == 'scene_heading') {
                if (z < (chunk.length-1)) {
                  if (chunk[z+1].type !== 'synopsis') {
                    chunk.splice(z, 1)
                    z--
                  }
                }
                if (z == (chunk.length-1)) {
                  chunk.splice(z, 1)
                  z--
                }
              }
            }
            treatmentChunks.push(chunk)
            chunk = []
          }
          if (scriptData.script[i].depth == 1) {
            chunk.push({type: 'act', text: scriptData.script[i].plainText.toUpperCase() })
          } else {
            chunk.push({type: 'sequence', text: toTitleCase(scriptData.script[i].plainText) })
          }
          break
        case 'synopsis':
          chunk.push({type: 'synopsis', text: scriptData.script[i].plainText })
          break
        case 'property':
          let prop = scriptData.script[i].formattedText.split(': ')
          if (prop[0].toLowerCase() == 'image') {
            if (options.inputPath) {
              let filename = prop[1].trim()
              let imagesrc = path.join(path.dirname(options.inputPath),filename.toLowerCase())
              chunk.push({type: 'image', text: imagesrc })
            }
          }

          // if (scriptData.script[i].plainText.split(':')[0].trim() == 'progress') {
          //   try {
          //     progress = JSON.parse(scriptData.script[i].plainText.split(':').slice(1).join(':').replace(/\'/g, '"'))
          //   } catch {
          //     progress = null
          //   }

          // }
        default:
      }
    }
  }
  for (let z = 0; z < chunk.length; z++) {
    if (chunk[z].type == 'scene_heading') {
      if (z < (chunk.length-1)) {
        if (chunk[z+1].type !== 'synopsis') {
          chunk.splice(z, 1)
          z--
        }
      }
      if (z == (chunk.length-1)) {
        chunk.splice(z, 1)
        z--
      }
    }
  }

  if (chunk[chunk.length-1].type == 'scene_heading') { chunk.splice(-1) }
  if (chunk[chunk.length-1].type == 'scene_heading') { chunk.splice(-1) }

  treatmentChunks.push(chunk)

  let renderChunk = (chunk, render) => {
    let height = 0

    let width = documentSize[0] - marginLeft - marginRight
    let string

    let imageCount = 0

    for (let i = 0; i < chunk.length; i++) {
      switch (chunk[i].type) {
        case 'act':
          imageCount = 0
          doc.fontSize(8)
          doc.font('thin')
          string = chunk[i].text
          if (render) {
            doc.text(string, xCursor, yCursor+height , {width: width, lineBreak: true, lineGap: 0, align: 'left'})

            fountainString += "# " + string + "\n\n"


            if (scene.length > 0 ) {
              scriptReadArray.push(scene)
              scene = []
            }
            scene.push({plainText: string.toLowerCase(), type: 'scene_heading'})

            doc.lineWidth(3)
            doc.moveTo(xCursor, yCursor+height+15)
            doc.lineTo(documentSize[0] - marginLeft, yCursor+height+15)
            //doc.dash(4, {space: 2})
            doc.stroke()

          }
          height += doc.heightOfString(string, {width: width, lineBreak: true, lineGap: 0, align: 'left'})
          height += 20
          break
        case 'sequence':
          imageCount = 0
          doc.fontSize(16)
          doc.font('black')
          string = chunk[i].text
          if (render) {
            doc.text(string, xCursor, yCursor+height , {width: width, lineBreak: true, lineGap: 0, align: 'left'})
            scene.push({plainText: '', type: 'action'})
            fountainString += "## " + string + "\n\n"
          }
          height += doc.heightOfString(string, {width: width, lineBreak: true, lineGap: 0, align: 'left'})
          height += 2
          break
        case 'scene_heading':
          imageCount = 0
          doc.fontSize(6)
          doc.font('thin')
          string = chunk[i].text
          if (render) {
            doc.text(string, xCursor, yCursor+height , {width: width, lineBreak: true, lineGap: 0, align: 'left'})
            fountainString += string + "\n\n"
          }
          height += doc.heightOfString(string, {width: width, lineBreak: true, lineGap: 0, align: 'left'})
          height += 3
          break
        case 'synopsis':
          imageCount = 0
          doc.fontSize(12)
          doc.font('regular')
          string = chunk[i].text
          if (render) {
            fountainString += "= " + string + "\n\n"
            doc.text(string, xCursor, yCursor+height , {width: width, lineBreak: true, lineGap: 2, align: 'left'})
            scene.push({plainText: '- ' + string, type: 'synopsis'})
          }
          height += doc.heightOfString(string, {width: width, lineBreak: true, lineGap: 2, align: 'left'})
          height += 5
          break
        case 'image':
          if (showImages) {
            if (render) {
              if (imageCount % 2 == 0) {
                doc.image(imageHash[chunk[i].text], xCursor, yCursor+height, {width: widthM})
              } else {
                height -= widthM*(1/2.35)
                height -= 5

                doc.image(imageHash[chunk[i].text], xCursor + widthM + 5, yCursor+height, {width: widthM})

              }

            }
            height += widthM*(1/2.35)
            height += 5
            imageCount++

          }
          break



      }
    }

    return height
  }

  let renderFooter = () => {
    doc.font('regular')
    doc.fontSize(8)
    doc.text(pageNumber, 0, documentSize[1]-40, {width: (8.5*72-30), lineBreak: false, lineGap: 0, align: 'right'})
    for (let i = 0; i < scriptData.title.length; i++) {
      if (scriptData.title[i].type == 'title') {
        doc.font('extrabold')
        doc.fontSize(8)
        doc.text(scriptData.title[i].plainText, 0, documentSize[1]-40, {width: (8.5*72-80), lineBreak: false, lineGap: 0, align: 'right'})
      }
    }
  }

  watermarkText = options.settings.treatmentWatermarkString

  let renderWatermark = (number) => {
    if (watermarkText) {
      doc.fontSize(12)
      doc.save()
      doc.fontSize(35)
      doc.font('extrabold')
      let string = watermarkText
      doc.lineWidth(0.2)
      doc.strokeColor('#444')
      doc.dash(0.3, {space: 1.6})
      let widthOfString = doc.widthOfString(string)
      doc.fontSize(35 * (((documentSize[0]-72)*0.8)/widthOfString))
      doc.translate((72/2), ((documentSize[0]-72)*.55))
      doc.rotate(20, {origin: [150, 70]})
      doc.text(string, 0, 0, {width: ((8.5*72)-72), lineBreak: false, lineGap: 0, align: 'center', stroke: true})
      doc.undash()
      doc.restore()
      doc.fontSize(12)
    }
  }

  let addPage = (dontAdd) => {
    // renderHeader()
    renderFooter()
    // renderOutside()
    yCursor = marginTop

    if (!dontAdd) {
      doc.addPage()
      renderWatermark()
    } else {
    }
    pageNumber++
  }

  renderWatermark()

  width = documentSize[0] - marginLeft - marginRight

  scriptReadArray = []
  scene = []

  for (var i = 0; i < scriptData.title.length; i++) {
    switch(scriptData.title[i].type) {
      case 'property':
        scene.push(scriptData.title[i])
        break
    }
  }

  if (treatmentread) {
    let qrImage = qr.imageSync(treatmentread, {ec_level: 'H', type: 'png', size: 15, margin: 0, parse_url: true})
    doc.image(qrImage, documentSize[0]-100, 30, {width: 70})
    doc.font('bold')
    doc.fontSize(8)
    doc.text("Listen to the treatment on your phone:", documentSize[0]-180-20, 30, {width: 90, lineBreak: true, lineGap: 0, align: 'right'})
    doc.font('thin')
    doc.fontSize(6)
    doc.text("Open the camera app, and point the camera here, and click the link...", documentSize[0]-180-10, 30+20, {width: 80, lineBreak: true, lineGap: 0, align: 'right'})

  }



  for (let i = 0; i < scriptData.title.length; i++) {
    if (scriptData.title[i].type == "title") {
      title = scriptData.title[i].plainText.replace(/<(?:.|\n)*?>/gm, '')
      doc.fontSize(35)
      doc.font('black')
      string = title
      scene.push({plainText: scriptData.title[i].plainText, type: scriptData.title[i].type})

      doc.text(string, xCursor, yCursor , {width: width, lineBreak: true, lineGap: 0, align: 'left'})
      yCursor += doc.heightOfString(string, {width: width, lineBreak: true, lineGap: 0, align: 'left'})
      yCursor += 2

      doc.fontSize(8)
      doc.font('thin')
      string = 'TREATMENT // DRAFT DATE: ' + moment().format("MMMM Do, YYYY")
      scene.push({plainText: 'Treatment dated: ' + moment().format("MMMM Do, YYYY"), type: 'action'})

      doc.text(string, xCursor, yCursor, {width: width, lineBreak: true, lineGap: 0, align: 'left'})
      yCursor += doc.heightOfString(string, {width: width, lineBreak: true, lineGap: 0, align: 'left'})
      yCursor += 10
    }
  }

  yCursor += 10

  for (let i = 0; i < scriptData.title.length; i++) {
    if (scriptData.title[i].type == "author") {
      author = scriptData.title[i].plainText.replace(/<(?:.|\n)*?>/gm, '')
      title = 'by: ' + scriptData.title[i].plainText.replace(/<(?:.|\n)*?>/gm, '')
      scene.push({plainText: 'Written by: ' + scriptData.title[i].plainText.replace(/<(?:.|\n)*?>/gm, ''), type: 'action'})

      doc.fontSize(8)
      doc.font('bold')
      string = title

      doc.text(string, xCursor, yCursor , {width: width, lineBreak: true, lineGap: 0, align: 'left'})
      yCursor += doc.heightOfString(string, {width: width, lineBreak: true, lineGap: 0, align: 'left'})
    }
  }

  yCursor += 20

  for (let i = 0; i < scriptData.title.length; i++) {
    if (scriptData.title[i].type == 'property') {
      let prop = scriptData.title[i].formattedText.split(': ')
      if (prop[0].toLowerCase() == 'logline') {
        string = prop[1].trim()
        scene.push({plainText: string, type: 'dialogue'})
        doc.fontSize(12)
        doc.font('regular')
        doc.text(string, xCursor, yCursor , {width: width, lineBreak: true, lineGap: 2, align: 'left'})
        yCursor += doc.heightOfString(string, {width: width, lineBreak: true, lineGap: 2, align: 'left'})
        yCursor += 20
      }
    }
  }

  for (let i = 0; i < scriptData.title.length; i++) {
    if (scriptData.title[i].type == 'property') {
      let prop = scriptData.title[i].formattedText.split(': ')
      if (prop[0].toLowerCase() == 'logline2') {
        string = prop[1].trim()
        scene.push({plainText: string, type: 'dialogue'})
        doc.fontSize(12)
        doc.font('regular')
        doc.text(string, xCursor, yCursor , {width: width, lineBreak: true, lineGap: 2, align: 'left'})
        yCursor += doc.heightOfString(string, {width: width, lineBreak: true, lineGap: 2, align: 'left'})
        yCursor += 20
      }
    }
  }

  scriptReadArray.push(scene)

  scene = []

  for (let i = 0; i < treatmentChunks.length; i++) {
    let chunkHeight = renderChunk(treatmentChunks[i], false)
    if ((yCursor + chunkHeight) > (documentSize[1] - marginBottom)) {
      addPage()
    }
    if ((treatmentChunks[i][0].type == 'act') && (yCursor > (documentSize[1]*(2/3)))) {
      addPage()
    }
    yCursor += renderChunk(treatmentChunks[i], true) + 10
  }

  scriptReadArray.push(scene)

  scene = []
  scene.push({plainText: 'The end.', type: 'scene_heading'})
  scene.push({plainText: 'If you have any questions or comments, please dont hesitate to email ' + author + '. Thank you.', type: 'dialogue'})

  scriptReadArray.push(scene)


  if (options.settings.treatmentRead) {
    reader.generate(scriptReadArray, outputAudioFileName, options)
  }

  addPage(true)

  progressCallback({string: "writing", chatID: chatID})

  doc.end()


  fs.writeFileSync(outputFountainFileName, fountainString, function(err) {
    if(err) {
      return console.log(err);
    }
  })

  stream.on('finish', () => {
    doneCallback({string: "done!", chatID: chatID, outputFileName: outputFileName})
    finishedCallback()
    //resolve({ pageCount: pageNumber, sceneList: sceneList })
  })

}

const parseScript = (filepath) => {
  let contents = fs.readFileSync(filepath, "utf8")
  let scriptData = fountainParse.parse(contents, filepath)
  return scriptData
}

const getSettings = () => {
  let settings = [
    { type: 'title', text: 'Export Treatment' },
    { type: 'description', text: 'Outline summary of the story including sequences and synopses.' },

    { id: 'treatmentIncludeImages', label: 'Include Images', type: 'checkbox', default: true },
    { id: 'treatmentRead', label: 'Render Treatment Reading', type: 'checkbox', default: false },
    { type: 'spacer' },
    { id: 'treatmentWatermarkString', label: 'Watermark for the treatment', type: 'string', default: '' },
  ]
  return settings
}

module.exports = {
  generate,
  getSettings
}