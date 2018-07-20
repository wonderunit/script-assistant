const fs = require('fs')
const path = require('path')
const md5 = require('md5')
const textToSpeech = require('@google-cloud/text-to-speech')
const mp3Duration = require('mp3-duration')
const ffmpeg = require('@ffmpeg-installer/ffmpeg')
const fountainParse = require('../fountain-parse')

const ffmpegPath = ffmpeg.path
const exec = require('child_process').exec
let child

const client = new textToSpeech.TextToSpeechClient({
  keyFilename: 'tts.json'
})

// set up directories
if (!fs.existsSync(path.join('exports'))) {
  fs.mkdirSync(path.join('exports'))
}

if (!fs.existsSync(path.join('exports','chunks'))) {
  fs.mkdirSync(path.join('exports','chunks'))
}

if (!fs.existsSync(path.join('exports','scenes'))) {
  fs.mkdirSync(path.join('exports','scenes'))
}

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

  // slow it down
  // audioConfig.speakingRate = '1.1'

  if (scriptAtom.plainText) { scriptAtom.plainText = scriptAtom.plainText.replace(/MR./g, "Mister") }

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

    let filename = path.join('exports', 'chunks', md5(JSON.stringify(request)) + '.mp3')

    if (fs.existsSync(filename)) {
      mp3Duration(filename, function (err, duration) {
        resolve({filename: filename, duration: duration, type: scriptAtom.type, plainText: scriptAtom.plainText})
      })
    } else {
      console.log("REQUESTING")
      client.synthesizeSpeech(request, (err, response) => {
        if (err) {
          reject(err)
        }
        fs.writeFile(filename, response.audioContent, 'binary', err => {
          if (err) {
            reject(err)
          }
          mp3Duration(response.audioContent, function (err, duration) {
            resolve({filename: filename, duration: duration, type: scriptAtom.type, plainText: scriptAtom.plainText})
          })
        })
      })
    }
  })
}

const renderScene = (scriptArray) => {
  return new Promise ((resolve, reject) => {
    let filename = path.join('exports', 'scenes', md5(JSON.stringify(scriptArray)) + '.mp3')
    if (fs.existsSync(filename+'s')) {
      // filename, scene number, duration, pagination
      resolve({filename: filename})
    } else {
      let tasks = []
      for (let i = 0; i < scriptArray.length; i++) {
        tasks.push(renderTTS(scriptArray[i]))
      }
      return tasks.reduce((promiseChain, currentTask) => {
        return promiseChain.then(chainResults =>
          currentTask.then(currentResult =>
            [ ...chainResults, currentResult ]
            )
          )
        }, Promise.resolve([])).then(arrayOfResults => {

          let args = []

          for (var i = 0; i < arrayOfResults.length; i++) {
            switch(arrayOfResults[i].type) {
              case 'title':
                // args.push('-i ' + 'soundevents/intro.aiff')
                break
              case 'scene_heading':
                args.push('-i ' + 'src/sounds/events/scene3.aiff')
                break
              case 'action':
                if (arrayOfResults[i].plainText.startsWith('- ')) {
                  args.push('-i ' + 'src/sounds/events/bullet2.aiff')
                }
                break
              case 'property':
                let prop = arrayOfResults[i].plainText.split(':')
                if (prop[0].trim().toLowerCase() == 'audio') {
                  args.push('-i ' + path.join(path.dirname(inputPath),prop[1].trim().toLowerCase()))
                }
                break
            }
            if (arrayOfResults[i].type !== 'property') {
              args.push('-i ' + arrayOfResults[i].filename)
            }
          }

          args.push('-filter_complex \"')

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
          mixstring += 'amix=' + (currentSoundIndex) +  ':dropout_transition=99999999,volume=' + (currentSoundIndex) + '[mixout]\"'

          args.push(filter.join('')+mixstring)

          args.push('-map [mixout]a -ac 2 -b:a 192k -ar 44100 -y -t ' + ((currentOffset/1000)+1) + ' ' + filename)
          
          console.log(ffmpegPath + ' ' + args.join(' '))

          child = exec(ffmpegPath + ' ' + args.join(' '), function (error, stdout, stderr) {
            if (error) {
              reject(error)
            }
            if (error) {
              reject(error)
            }

            // console.log('err: ' + error);
            // console.log('stdout: ' + stdout);
            // console.log('err: ' + stderr);

            resolve({filename: filename})

          })


          console.log(arrayOfResults)

      })
    }
  })
}

let inputPath

const generate = async (options = {}) => {
  inputPath = options.inputPath

  let contents = fs.readFileSync(options.inputPath, "utf8");
  let scriptData = fountainParse.parse(contents)

  // break up the script by scene
  // process by the scene
  // check if the scene already exists
  // pass the type back to the processor
  // based on the pro
  // concat scenes together
  console.log(options.inputPath)
  console.log('scriptdata', scriptData)

  let scriptArray = [[]]

  let currentScene = 0

  if (scriptData.title) {
    let scene = []
    let author
    for (var i = 0; i < scriptData.title.length; i++) {
      switch(scriptData.title[i].type) {
        case 'title':
          scene.push({plainText: scriptData.title[i].plainText, type: scriptData.title[i].type})
          break
        case 'author':
          scene.push({plainText: 'Written by ' + scriptData.title[i].plainText, type: 'action'})
          author = scriptData.title[i].plainText
          break
        case 'draft_date':
          scene.push({plainText: 'Draft dated: ' + scriptData.title[i].plainText, type: 'action'})
          break
        case 'revision':
          scene.push({plainText: scriptData.title[i].plainText, type: 'action'})
          break
        case 'property':
          scene.push(scriptData.title[i])
          break
      }
    }
    scene.push({plainText: 'Approximate screen time: 90 minutes.', type: 'action'})
    scene.push({plainText: 'This reading is 140 minutes.', type: 'action'})
    scene.push({plainText: 'If you have any questions or comments, please dont hesitate to email ' + author + '. Thank you.', type: 'dialogue'})
    scriptArray[currentScene]= scene
    scriptArray.push([])
    currentScene++
  }

  for (var i = 0; i < scriptData.script.length; i++) {
    switch(scriptData.script[i].type) {
      case 'centered':
      case 'action':
      case 'property':
      case 'character':
      case 'dialogue':
      case 'parenthetical':
      case 'transition':
        scriptArray[currentScene].push(scriptData.script[i])
        break
      case 'scene_heading':
        scriptArray.push([scriptData.script[i]])
        currentScene++
    }
  }

  let renderSceneTasks = []

  let fromScene
  fromScene = 2
  //fromScene = 80


  let toScene
  toScene = 2
  toScene = scriptArray.length


  for (var i = fromScene; i < toScene; i++) {
    renderSceneTasks.push(renderScene(scriptArray[i]))
  }

  return renderSceneTasks.reduce((promiseChain, currentTask) => {
    return promiseChain.then(chainResults =>
      currentTask.then(currentResult =>
        [ ...chainResults, currentResult ]
        )
      )
    }, Promise.resolve([])).then(arrayOfResults => {

    console.log(arrayOfResults)

    let args = []
    for (var i = 0; i < arrayOfResults.length; i++) {
      args.push('-i ' + arrayOfResults[i].filename)
    }
    args.push('-filter_complex \"')

    let mixstring = ''

    for (var i = 0; i < arrayOfResults.length; i++) {
      mixstring += '[' + i + ':0]'
    }
    mixstring += 'concat=' + (arrayOfResults.length) +  ':v=0:a=1[mixout]\"'

    args.push(mixstring)

    args.push('-map [mixout] -ac 2 -b:a 192k -ar 44100 -y output.mp3')
      child = exec(ffmpegPath + ' ' + args.join(' '), function (error, stdout, stderr) {
        if (error) {
          console.log(error)
        }
        if (stderr) {
          console.log(stderr)
        }
        if (stdout) {
          console.log(stdout)
        }
      })
    })

}


// /Users/setpixel/git/scriptreader/node_modules/@ffmpeg-installer/darwin-x64/ffmpeg -i output.mp3 -filter_complex "[0:a]avectorscope=s=480x480:zoom=1.5:rc=0:gc=200:bc=0:rf=0:gf=40:bf=0,format=yuv420p[v];  [v]pad=854:480:187:0[out]" -map "[out]" -map 0:a -b:v 700k -b:a 360k OUTPUT_VIDEO.mp4
// /Users/setpixel/git/scriptreader/node_modules/@ffmpeg-installer/darwin-x64/ffmpeg -i output.mp3 -filter_complex "[0:a]showspectrum=s=854x480:mode=combined:slide=scroll:saturation=0.2:scale=log,format=yuv420p[v]" -map "[v]" -map 0:a -b:v 700k -b:a 360k OUTPUT.mp4

module.exports = {
  generate
}