const tippy = require('tippy.js')

const createButton = (domName, generator, prefs, options) => {
  let settingsTooltip = document.createElement("div")
  settingsTooltip.className = "settings-content"
  let settings = generator.getSettings()
  settingsHTML = []
  for (var i = 0; i < settings.length; i++) {
    settingsHTML.push('<div class="row">')
    switch (settings[i].type) {
      case 'title':
        settingsHTML.push('<div class="title">' + settings[i].text + '</div>')
        break
      case 'description':
        settingsHTML.push('<div class="description">' + settings[i].text + '</div>')
        break
      case 'spacer':
        settingsHTML.push('<div class="spacer"></div>')
        break
      default:
        let value
        if (typeof prefs.get(settings[i].id) !== 'undefined') {
          value = prefs.get(settings[i].id)
        } else {
          value = settings[i].default
        }
        switch (settings[i].type) {
          case 'checkbox':
            if (value) {
            settingsHTML.push('<input type="checkbox" id="' + settings[i].id + '" checked /><label for="' + settings[i].id + '"><span></span>' + settings[i].label + '</label>')
            } else {
            settingsHTML.push('<input type="checkbox" id="' + settings[i].id + '" /><label for="' + settings[i].id + '"><span></span>' + settings[i].label + '</label>')
            }
            break
          case 'dropdown':
            settingsHTML.push('<label for="' + settings[i].id + '">' + settings[i].label + ':</label>')
            settingsHTML.push('<select id="' + settings[i].id + '">')
            for (var z = 0; z < settings[i].values.length; z++) {
              if (value == settings[i].values[z].value) {
                settingsHTML.push('<option value="' + settings[i].values[z].value + '" selected="selected">' + settings[i].values[z].text + '</option>')
              } else {
                settingsHTML.push('<option value="' + settings[i].values[z].value + '">' + settings[i].values[z].text + '</option>')
              }
            }
            settingsHTML.push('</select>')
            break
          case 'range':
            settingsHTML.push('<label for="' + settings[i].id + '">' + settings[i].label + ':</label>')
            if (value) {
              settingsHTML.push('<input type="text" id="' + settings[i].id + '" value="' + value + '"/>')
            } else {
              settingsHTML.push('<input type="text" id="' + settings[i].id + '"/>')
            }
            break
        }
        break
    }
    settingsHTML.push('</div>')
  }
  settingsTooltip.innerHTML = settingsHTML.join('')
  settingsTooltip.querySelectorAll('input, select').forEach((element) => {
    if (element.type == 'text') {
      element.oninput = (event) => {
        let value
        switch (event.target.type) {
          case 'text':
            value = event.target.value
            break
        }
        prefs.set(event.target.id, value)
      }
    } else {
      element.onchange = (event) => {
        let value
        switch (event.target.type) {
          case 'checkbox':
            value = event.target.checked
            break
          case 'select-one':
            value = event.target.options[event.target.selectedIndex].value
            break
        }
        prefs.set(event.target.id, value)
      }
    }
  })

  tippy(domName, {
    theme: 'settings',
    delay: [350, 100],
    arrow: true,
    arrowType: 'large',
    interactive: true,
    interactiveBorder: 20,
    size: 'large',
    duration: [100, 200],
    animation: 'shift-toward',
    multiple: false,
    html: settingsTooltip
  })

  document.querySelector(domName).addEventListener('click', (event) => {
    let target = event.target
    let chatID = 'chat-' + String(new Date().getTime())
    target.disabled = true
    let settingsList = generator.getSettings()
    let settings = {}
    for (var i = 0; i < settingsList.length; i++) {
      let value
      if (typeof prefs.get(settingsList[i].id) !== 'undefined') {
        value = prefs.get(settingsList[i].id)
      } else {
        value = settingsList[i].default
      }
      settings[settingsList[i].id] = value
    }
    options.settings = settings
    options.chatID = chatID
    options.finishedCallback = (event) => {
      target.disabled = false
    }
    generator.generate(options)
  })

}

module.exports = {
  createButton
}