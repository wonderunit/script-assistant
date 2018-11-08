const utils = require('./wonder-utils')

let stats

// welcome
// what do you think?

const titleCritique = () => {
  let comment
  if (stats) {
    comment = 'I really like your title, "<strong>' + stats.title + '</strong>".'
  }

  return comment
}

let characterQuotes = {}
let sceneQuotes = []
let notes = []


const update = (incomingStats) => {
  stats = incomingStats

  let currentCharacter
  let currentScene = 0

  for (var i = 0; i < stats.scriptData.script.length; i++) {
    switch (stats.scriptData.script[i].type) {
      case 'scene_heading':
        currentScene++
      case 'character':
        currentCharacter = stats.scriptData.script[i].plainText
        break
      case 'dialogue':
        if (!characterQuotes[currentCharacter]) characterQuotes[currentCharacter] = []
        characterQuotes[currentCharacter].push({quote: stats.scriptData.script[i].plainText, scene: currentScene})
        if (!sceneQuotes[currentScene]) sceneQuotes[currentScene] = []
        sceneQuotes[currentScene].push({quote: stats.scriptData.script[i].plainText, character: currentCharacter})
        break
    }
  }


}

const welcome = () => {
  // It's time to make _____ the best it can be.
  // I can't wait to get started working on ____ today.
  // What do you think ____,_____, and _____ are going to be up to next?
  // Let's get working on _______
  //
}

const whatIThink = () => {
  // I really like _____ but have you considered renaming it?
  // I really love the scene where ____ does that thing. You know what I'm talking about.
  // Who is more _______, _____ or ______?
  // My favorite line in the story is ________.
  // I really like scene ___, the one where _____ says _______.
  // Do we really need scene ___, the one where ____ says ______? Whats the purpose of it?
  // What if instead of _____ saying, ________, they said, ______.
  // Scene __ in _____ where _____ says, _______, could you do that scene without dialgue?
  // You have a note, ______ in scene ___. What do you mean by that?

  // title
  // scenes
  // quotes
  // characters
  // notes

  // I like it, I love it, My favorite
  // I dont like it, I hate it, I think it could be better
  // Have you considered changing it?
  // What do you mean by it? What's the purpose of it?
  // Could you remove it? Do we need it?
  // What if _____?

  //SCENE
  let foundScene
  while (!foundScene) {
    let tryScene = Math.round(Math.random()*(sceneQuotes.length-1))
    if (sceneQuotes[tryScene]) {
      foundScene = tryScene
    }
  }
  let quote = sceneQuotes[foundScene].randomElement()
  let text = 'You know scene ' + foundScene + ', ' + stats.sceneList[foundScene].slugline + ' where ' + quote.character + ' says, "' + quote.quote + '"?'
  //console.log(text)

  // CHARACTER
  let importantChar = 0
  for (var i = 0; i < stats.characters.length; i++) {
    if (stats.characters[i][1] < 16) {
      break
    }
    importantChar++
  }
  let charNumber = Math.round(Math.random()*(importantChar-1))
  let characterQuote = characterQuotes[stats.characters[charNumber][0].toUpperCase()].randomElement()

  //console.log(characterQuote)


}

module.exports = {
  update: update,
  welcome: welcome,
  whatIThink: whatIThink,
  titleCritique: titleCritique
}