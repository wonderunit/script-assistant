const fs = require('fs')
const path = require('path')
const md5 = require('md5')
const textToSpeech = require('@google-cloud/text-to-speech')
const mp3Duration = require('mp3-duration')
const ffmpeg = require('@ffmpeg-installer/ffmpeg')
const electronUtil = require('electron-util')
const moment = require('moment')
const { app, shell } = require('electron').remote

const fountainParse = require('./fountain-parse')
const generateStats = require('./generate-stats')

const ffmpegPath = electronUtil.fixPathForAsarUnpack(ffmpeg.path)
const execa = require('execa')

let child

if (!fs.existsSync(path.join(app.getPath('userData'), 'tts.json'))) {
  console.log("cant find tts key")
  shell.showItemInFolder(path.join(app.getPath('userData')))
}

const client = new textToSpeech.TextToSpeechClient({
  keyFilename: path.join(app.getPath('userData'), 'tts.json')
})

const setUpDirectories = () => {
  if (!fs.existsSync(path.join(app.getPath('userData'), 'exports'))) {
    fs.mkdirSync(path.join(app.getPath('userData'), 'exports'))
  }

  if (!fs.existsSync(path.join(app.getPath('userData'), 'exports','chunks'))) {
    fs.mkdirSync(path.join(app.getPath('userData'), 'exports','chunks'))
  }

  if (!fs.existsSync(path.join(app.getPath('userData'), 'exports','events'))) {
    fs.mkdirSync(path.join(app.getPath('userData'), 'exports','events'))
  }

  if (!fs.existsSync(path.join(app.getPath('userData'), 'exports','scenes'))) {
    fs.mkdirSync(path.join(app.getPath('userData'), 'exports','scenes'))
  }
}

let talkingFast = true
let renderTitlePage

const renderTTS = (scriptAtom) => {
  let voice
  let audioConfig
  voice = {
    "languageCode": "en-US",
    "name": "en-US-Wavenet-F"
  }
  audioConfig = {audioEncoding: 'MP3',"pitch": "-5.00","speakingRate": "1.25"}
  switch(scriptAtom.type) {
    case 'centered':
      voice = {
        "languageCode": "en-US",
        "name": "en-US-Wavenet-C"
      }
      audioConfig = {audioEncoding: 'MP3',"pitch": "-1.00","speakingRate": "1.20"}
      scriptAtom.plainText = scriptAtom.plainText.toLowerCase()
      break
    case 'action':
    case 'synopsis':
    case 'transition':
      if (scriptAtom.plainText) {
        if (scriptAtom.plainText.startsWith("NOTE")) {
          voice = {
            "languageCode": "en-US",
            "name": "en-US-Wavenet-F"
          }
          audioConfig = {audioEncoding: 'MP3',"pitch": "-5.00","speakingRate": "1.25"}
        } else {
          voice = {
            "languageCode": "en-US",
            "name": "en-US-Wavenet-C"
          }
          audioConfig = {audioEncoding: 'MP3',"pitch": "-3.00","speakingRate": "1.30"}
        }
      } else {
        scriptAtom.plainText = ''
      }
      break
    case 'title':
      voice = {
        "languageCode": "en-US",
        "name": "en-US-Wavenet-B"
      }
      audioConfig = {audioEncoding: 'MP3',"pitch": "-5.00","speakingRate": "1.1"}
      break
    case 'scene_heading':
      voice = {
        "languageCode": "en-US",
        "name": "en-US-Wavenet-C"
      }
      audioConfig = {audioEncoding: 'MP3',"pitch": "-1.00","speakingRate": "1.20"}
      scriptAtom.plainText = scriptAtom.plainText.replace(/INT./g, "Interior. ");
      scriptAtom.plainText = scriptAtom.plainText.replace(/EXT./g, "Exterior. ");
      scriptAtom.plainText = scriptAtom.plainText.replace(/-/g, ".");
      scriptAtom.plainText = scriptAtom.plainText.replace(/\//g, ".");
      break
    case 'parenthetical':
      voice = {
        "languageCode": "en-US",
        "name": "en-US-Wavenet-C"
      }
      audioConfig = {audioEncoding: 'MP3',"pitch": "-3.00","speakingRate": "1.30"}
      scriptAtom.plainText = scriptAtom.plainText.replace(/O.S./g, "off screen");
      scriptAtom.plainText = scriptAtom.plainText.replace(/\(beat\)/g, "");
      break
    case 'character':
      voice = {
        "languageCode": "en-US",
        "name": "en-US-Wavenet-C"
      }
      audioConfig = {audioEncoding: 'MP3',"pitch": "-3.00","speakingRate": "1.30"}
      break
    case 'dialogue':
      voice = {
        "languageCode": "en-US",
        "name": "en-US-Wavenet-B"
      }
      audioConfig = {audioEncoding: 'MP3',"pitch": "-3.00","speakingRate": "1.35"}
      break
  }

  if (!talkingFast) {
    // slow it down
    audioConfig.speakingRate = '1.1'
  }

  if (scriptAtom.plainText) { scriptAtom.plainText = scriptAtom.plainText.replace(/Mr./g, "Mister").replace(/MR./g, "Mister") }

  return new Promise ((resolve, reject) => {
    if (scriptAtom.type == 'property') {
      resolve({type: 'property', plainText: scriptAtom.plainText})
    }

    let request = {
      input: {
        text: scriptAtom.plainText
      },
      voice: voice,
      audioConfig: audioConfig
    }

    let filename = path.join(app.getPath('userData'), 'exports', 'chunks', md5(JSON.stringify(request)) + '.mp3')

    if (fs.existsSync(filename)) {
      mp3Duration(filename, function (err, duration) {
        resolve({filename: filename, duration: duration, type: scriptAtom.type, plainText: scriptAtom.plainText})
      })
    } else {
      client.synthesizeSpeech(request, (err, response) => {
        if (err) {
          reject(err)
        }
        fs.writeFile(filename, response.audioContent, 'binary', err => {
          if (err) {
            reject(err)
          }
          mp3Duration(response.audioContent, function (err, duration) {

            // to avoid rate limit
            setTimeout(
              () => resolve({filename: filename, duration: duration, type: scriptAtom.type, plainText: scriptAtom.plainText}),
              5
            )

          })
        })
      })
    }
  })
}

const renderScene = async (scriptArray, progressString, sceneNumber) => {
  return new Promise (async (resolve, reject) => {
    progressCallback({string: progressString, chatID: chatID})
    let filename
    if (!renderTitlePage && (sceneNumber == 0)) {
      filename = path.join(app.getPath('userData'), 'exports', 'scenes', md5(JSON.stringify(scriptArray)+String(talkingFast)+0) + '.mp3')
    } else {
      filename = path.join(app.getPath('userData'), 'exports', 'scenes', md5(JSON.stringify(scriptArray)+String(talkingFast)) + '.mp3')
    }

    if (fs.existsSync(filename)) {
      // filename, scene number, duration, pagination
      let duration = await mp3Duration(filename)
      resolve({ filename: filename, duration })
    } else {
      let arrayOfResults = []
      for (let i = 0; i < scriptArray.length; i++) {
        progressCallback({string: progressString + ' Generating sentence ' + (i+1) + ' of ' + scriptArray.length, chatID: chatID})
        let result = await renderTTS(scriptArray[i])
        arrayOfResults.push(result)
      }

      let args = []

      for (var i = 0; i < arrayOfResults.length; i++) {
        switch(arrayOfResults[i].type) {
          case 'title':
            // args.push('-i ' + 'soundevents/intro.aiff')
            break
          case 'scene_heading':
            args = args.concat(['-i', '"' + path.join(app.getPath('userData'), 'exports', 'events', 'scene3.aiff') + '"'])
            break
            case 'action':
            case 'synopsis':
            if (arrayOfResults[i].plainText.startsWith('- ')) {
              args = args.concat(['-i', '"' + path.join(app.getPath('userData'), 'exports', 'events', 'bullet2.aiff') + '"'])
            }
            break
          case 'property':
            let prop = arrayOfResults[i].plainText.split(':')
            if (prop[0].trim().toLowerCase() == 'audio') {
              args = args.concat(['-i', '"' + path.join(path.dirname(inputPath),prop[1].trim().toLowerCase()) + '"' ])
            }
            break
        }
        if (arrayOfResults[i].type !== 'property') {
          args = args.concat(['-i', '"' + path.join(arrayOfResults[i].filename) + '"'])
        }
      }

      args.push('-filter_complex')

      let d = 0
      for (var i = 0; i < arrayOfResults.length; i++) {
        if (arrayOfResults[i].duration) {
          d += Math.round((arrayOfResults[i].duration)*1000)
        }
      }

      let currentOffset = 0
      let currentSoundIndex = 0
      let filter = []

      for (var i = 0; i < arrayOfResults.length; i++) {
        let afterDelay = 0
        switch(arrayOfResults[i].type) {
          case 'title':
            // filter.push('[' + currentSoundIndex + ']adelay=' + currentOffset + '|' + currentOffset + ',volume=0.1,afade=t=out:st=' + (((d+3000)/1000)-5) + ':d=5[s' + currentSoundIndex + '];')
            currentOffset += 1000
            // afterDelay = 3000
            // currentSoundIndex++
            break
          case 'scene_heading':
            filter.push('[' + currentSoundIndex + ']adelay=' + currentOffset + '|' + currentOffset + ',volume=0.3,afade=t=out:st=' + (((d+3000)/1000)-5) + ':d=5[s' + currentSoundIndex + '];')
            currentOffset += 1000
            afterDelay = 1000
            currentSoundIndex++
            break
          case 'action':
            if (arrayOfResults[i].plainText.startsWith('- ')) {
              filter.push('[' + currentSoundIndex + ']adelay=' + currentOffset + '|' + currentOffset + ',volume=0.4[s' + currentSoundIndex + '];')
              currentOffset += 200
              afterDelay = 0
              currentSoundIndex++
            }
            break
          case 'synopsis':
            if (arrayOfResults[i].plainText.startsWith('- ')) {
              filter.push('[' + currentSoundIndex + ']adelay=' + currentOffset + '|' + currentOffset + ',volume=0.4[s' + currentSoundIndex + '];')
              currentOffset += 200
              afterDelay = 200
              currentSoundIndex++
            }
            break
          case 'property':
            let prop = arrayOfResults[i].plainText.split(':')
            if (prop[0].trim().toLowerCase() == 'audio') {
              filter.push('[' + currentSoundIndex + ']adelay=' + currentOffset + '|' + currentOffset + ',volume=0.2,afade=t=out:st=' + (((d+3000)/1000)-5) + ':d=5[s' + currentSoundIndex + '];')
              currentOffset += 10
              afterDelay = 0
              currentSoundIndex++
            }
            break
        }
        if (arrayOfResults[i].duration) {
          filter.push('[' + currentSoundIndex + ']adelay=' + currentOffset + '|' + currentOffset + '[s' + currentSoundIndex + '];')
          currentOffset += Math.round((arrayOfResults[i].duration)*1000) + afterDelay
          currentSoundIndex++
        }
      }

      let mixstring = ''

      for (var i = 0; i < currentSoundIndex; i++) {
        mixstring += '[s' + i + ']'
      }
      mixstring += 'amix=' + (currentSoundIndex) +  ':dropout_transition=99999999,volume=' + (currentSoundIndex) + '[mixout]'

      args.push("'" + filter.join('')+ mixstring+ "'")

      args = args.concat(['-map', '[mixout]a', '-ac', '2', '-b:a', '192k', '-ar', '44100', '-y', '-t', ((currentOffset/1000)+1), '"' + filename + '"'])

      let totalDurationInSeconds = currentOffset / 1000

      child = execa('"' + ffmpegPath + '"', args, {shell: true})

      //console.log(args)

      const timeRegex = /time=(\d\d:\d\d:\d\d.\d\d)/gm
      child.stderr.on('data', data => {
        let m = data.toString().match(timeRegex)

        if (m) {
          m = m[0].substring(5)
          let parts = m.split(':')

          let seconds = (Number(parts[0]) * 60 * 60) + (Number(parts[1]) * 60) + (Number(parts[2]))

          progressCallback({string: progressString + ' Merging scene: ' + Math.round(seconds/totalDurationInSeconds*100) + '%', chatID: chatID})
        }
      })
      child.on('error', (err) => {
        console.error(err)
        reject(err)
      })
      child.on('exit', async code => {
        if (code !== 0) {
          reject(Error(`Could not use ffmpeg. Failed with error ${code}`))
        } else {
          // when done:
          let duration = await mp3Duration(filename)
          resolve({ filename: filename, duration })

        }
      })
      child.catch(err => {
        console.error(err)
        reject(err)
      })

    }
  })
}

let progressCallback
let doneAudioCallback
let finishedCallback
let chatID

let inputPath

const generate = async (scriptArray, outputFileName, options = {}) => {
  progressCallback = options.progressCallback
  doneAudioCallback = options.doneAudioCallback
  finishedCallback = options.finishedCallback
  chatID = options.chatID

  let settings = options.settings

  setUpDirectories()

  inputPath = options.inputPath

  let asarPath = app.getAppPath()
  fs.copyFileSync(path.join(asarPath, 'src/sounds/events/scene3.aiff'), path.join(app.getPath('userData'), 'exports', 'events', 'scene3.aiff'))
  fs.copyFileSync(path.join(asarPath, 'src/sounds/events/bullet2.aiff'), path.join(app.getPath('userData'), 'exports', 'events', 'bullet2.aiff'))

  progressCallback({string: "started", chatID: chatID})

  let arrayOfResults = []
  let totalDuration = 0
  for (var i = 0; i < scriptArray.length; i++) {
    let result = await renderScene(scriptArray[i], 'Scene ' + (i+1) + ' of ' + scriptArray.length + '. ', i)
    totalDuration += result.duration
    arrayOfResults.push(result)
  }

  let args = []
  let totalDurationInSeconds = 0
  for (var i = 0; i < arrayOfResults.length; i++) {
    totalDurationInSeconds += arrayOfResults[i].duration
    args = args.concat(['-i', '"' + path.join(arrayOfResults[i].filename) + '"'])
  }
  args.push('-filter_complex')

  let mixstring = ''
  for (var i = 0; i < arrayOfResults.length; i++) {
    mixstring += '[' + i + ':0]'
  }
  mixstring += 'concat=' + (arrayOfResults.length) +  ':v=0:a=1[mixout]'
  args.push("'" + mixstring + "'")
  args = args.concat(['-map', '[mixout]', '-ac', '2', '-b:a', '192k', '-ar', '44100', '-y', '"' + outputFileName + '"'])
  child = execa('"' + ffmpegPath + '"', args, {shell: true})
  const timeRegex = /time=(\d\d:\d\d:\d\d.\d\d)/gm
  child.stderr.on('data', data => {
    let m = data.toString().match(timeRegex)
    if (m) {
      m = m[0].substring(5)
      let parts = m.split(':')
      let seconds = (Number(parts[0]) * 60 * 60) + (Number(parts[1]) * 60) + (Number(parts[2]))
      progressCallback({string: "Last step: merging together... " + Math.round(seconds/totalDurationInSeconds*100) + '%', chatID: chatID})
    }
  })
  child.on('error', (err) => {
    console.error(err)
    throw err
  })
  child.on('exit', code => {
    if (code !== 0) {
      throw new Error(`Could not use ffmpeg. Failed with error ${code}`)
    } else {
      doneAudioCallback({string: "done", chatID: chatID, outputFileName: outputFileName})
      finishedCallback()
    }
  })
  child.catch(err => {
    console.error(err)
    throw err
  })
}

module.exports = {
  generate,
}