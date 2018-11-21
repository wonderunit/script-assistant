const fs = require('fs')
const path = require('path')
const md5 = require('md5')
const Jimp = require('jimp')
const { app, shell } = require('electron').remote

let imageHash = {}
let isSetup = false

const setUpDirectories = () => {
  if (!fs.existsSync(path.join(app.getPath('userData'), 'exports'))) {
    fs.mkdirSync(path.join(app.getPath('userData'), 'exports'))
  }
  if (!fs.existsSync(path.join(app.getPath('userData'), 'exports','images'))) {
    fs.mkdirSync(path.join(app.getPath('userData'), 'exports','images'))
  }
  isSetup = true
}

const getImage = async (imageFilename, width) => {
  let filenameHash = md5(imageFilename + width)
  if (imageHash[filenameHash]) { return imageHash[filenameHash] }
  if (!isSetup) {
    setUpDirectories()
  }
  let cachedFilename = path.join(app.getPath('userData'), 'exports', 'images', filenameHash + '.jpg')
  if (fs.existsSync(cachedFilename)) {
    imageHash[filenameHash] = cachedFilename
  } else {
    let resizedImage = await Jimp.read(imageFilename).then(image => {
      return image.resize(Math.round(width), Jimp.AUTO).quality(80)
    }).catch(err => { console.error(err) })
    resizedImage.write(cachedFilename)
    let image = await resizedImage.getBase64Async(Jimp.MIME_JPEG)
    imageHash[filenameHash] = image
  }
  return imageHash[filenameHash]
}

module.exports = {
  getImage,
}