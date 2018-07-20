const fs = require('fs')
const path = require('path')

const pkg = require('../../../package.json')

const defaultPrefs = {
  version: pkg.version
}

let prefFile
let prefs

// Map doesn't know to toJSON/fromJSON
// see: http://2ality.com/2015/08/es6-map-json.html
// via https://stackoverflow.com/a/43682482
function strMapToObj (strMap) {
  let obj = Object.create(null)
  for (let [k,v] of strMap) {
    // We don’t escape the key '__proto__'
    // which can cause problems on older engines
    obj[k] = v
  }
  return obj
}
function objToStrMap (obj) {
  let strMap = new Map()
  for (let k of Object.keys(obj)) {
    strMap.set(k, obj[k])
  }
  return strMap
}

const init = f => {
  prefFile = f
  console.log('Loading prefs from', prefFile)
  load()
}

const load = () => {
  try {
    // merge
    prefs = new Map(
      Object.entries({
        ...defaultPrefs,
        ...JSON.parse(fs.readFileSync(prefFile))
      }
    ))
    try {
      save()
    } catch (e) {
      console.error(e)
    }
  } catch (e) {
    console.log('Could not read prefs file. Loading defaults.')
    prefs = new Map(Object.entries(defaultPrefs))
    try {
      save()
    } catch (e) {
      console.error(e)
    }
  }
}

const save = () => {
  fs.writeFileSync(prefFile, JSON.stringify(strMapToObj(prefs), null, 2))
}

const set = (key, value, sync = true) => {
  let result = prefs.set(key, value)
  if (sync) { save() }
  return result
}

const get = (key) => prefs.get(key)

module.exports = {
  init,
  load,
  save,
  set,
  get
}
