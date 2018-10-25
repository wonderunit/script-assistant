const regex = {
  title_page: /^((?:title|credit|author[s]?|source|notes|draft date|date|contact|copyright|revision)\:)/gim,

  scene_heading: /^((?:\*{0,3}_?)?(?:(?:int|ext|est|i\/e)[. ]).+)|^(?:\.(?!\.+))(.+)/i,
  scene_number: /( *#(.+)# *)/,

  transition: /^((?:FADE (?:TO BLACK|OUT)|CUT TO BLACK)\.|.+ TO\:)|^(?:> *)(.+)/,

  dialogue: /^([A-Z*_\~]+[0-9A-Z (._\-')#\~]*)(\^?)?(?:\n(?!\n+))([\s\S]+)/,
  parenthetical: /^(\(.+\))$/,

  action: /^(.+)/g,
  centered: /^(?:> *)(.+)(?: *<)(\n.+)*/g,

  section: /^(#+)(?: *)(.*)/,
  synopsis: /^(?:\=(?!\=+) *)(.*)/,

  property: /^(?:\{{2}(?!\{+))(.+)(?:\}{2}(?!\{+))$/,

  note: /^(?:\[{2}(?!\[+))(.+)(?:\]{2}(?!\[+))$/,
  note_inline: /(?:\[{2}(?!\[+))([\s\S]+?)(?:\]{2}(?!\[+))/g,
  boneyard: /(^\/\*|^\*\/)$/g,

  multilinecomment: /\/\*(.|[\r\n])*?\*\//gm,

  page_break: /^\={3,}$/,
  line_break: /^ {2}$/,

  bold_italic: /(\*{3}(?=.+\*{3}))(.+?)(\*{3})/g,
  bold: /(\*{2}(?=.+\*{2}))(.+?)(\*{2})/g,
  italic: /(\*{1}(?=.+\*{1}))(.+?)(\*{1})/g,
  underline: /(_{1}(?=.+_{1}))(.+?)(_{1})/g,
  highlight: /(\+{1}(?=.+\+{1}))(.+?)(\+{1})/g,
  strikethrough: /(\~{2}(?=.+\~{2}))(.+?)(\~{2})/g,

  splitter: /\n{2,}/g,
  cleaner: /^\n+|\n+$/,
  standardizer: /\r\n|\r/g,
  whitespacer: /^\t+|^ {3,}/gm
}

const sanitizer = (script) => {
  return script.replace(regex.boneyard, '\n$1\n')
    .replace(regex.standardizer, '\n')
    .replace(regex.cleaner, '')
    .replace(regex.whitespacer, '')
    .replace(regex.multilinecomment, '')
}

const tokenize = (script) => {
  let src = sanitizer(script).split(regex.splitter)
  let i = src.length
  let line
  let match
  let parts
  let text
  let meta
  let x
  let xlen
  let dual
  let tokens = []

  while (i--) {
    line = src[i]

    // title page
    if (regex.title_page.test(line)) {
      match = line.replace(regex.title_page, '\n$1').split(regex.splitter).reverse()
      for (x = 0, xlen = match.length; x < xlen; x++) {
        parts = match[x].replace(regex.cleaner, '').split(/\:\n*/)
        tokens.push({ type: parts[0].trim().toLowerCase().replace(' ', '_'), text: parts[1].trim() })
      }
      continue
    }

    // scene headings
    if (match = line.match(regex.scene_heading)) {
      text = match[1] || match[2]
      if (text.indexOf('  ') !== text.length - 2) {
        if (meta = text.match(regex.scene_number)) {
          meta = meta[2]
          text = text.replace(regex.scene_number, '')
        }
        tokens.push({ type: 'scene_heading', text: text, scene_number: meta || undefined })
      }
      continue
    }

    // centered
    if (match = line.match(regex.centered)) {
      tokens.push({ type: 'centered', text: match[0].replace(/>|</g, '') })
      continue
    }

    // transitions
    if (match = line.match(regex.transition)) {
      tokens.push({ type: 'transition', text: match[1] || match[2] })
      continue
    }

    // dialogue blocks - characters, parentheticals and dialogue
    if (match = line.match(regex.dialogue)) {
      if (match[1].indexOf('  ') !== match[1].length - 2) {
        // we're iterating from the bottom up, so we need to push these backwards
        if (match[2]) {
          tokens.push({ type: 'dual_dialogue_end' })
        }

        tokens.push({ type: 'dialogue_end' })

        parts = match[3].split(/(\(.+\))(?:\n+)/).reverse()

        for (x = 0, xlen = parts.length; x < xlen; x++) {
          text = parts[x]

          if (text.length > 0) {
            tokens.push({ type: regex.parenthetical.test(text) ? 'parenthetical' : 'dialogue', text: text })
          }
        }

        tokens.push({ type: 'character', text: match[1].trim() })
        tokens.push({ type: 'dialogue_begin', dual: match[2] ? 'right' : dual ? 'left' : undefined })

        if (dual) {
          tokens.push({ type: 'dual_dialogue_begin' })
        }

        dual = match[2] ? true : false
        continue
      }
    }

    // section
    if (match = line.match(regex.section)) {
      tokens.push({ type: 'section', text: match[2], depth: match[1].length })
      continue
    }

    // synopsis
    if (match = line.match(regex.synopsis)) {
      tokens.push({ type: 'synopsis', text: match[1] })
      continue
    }

    // notes
    if (match = line.match(regex.note)) {
      tokens.push({ type: 'note', text: match[1]})
      continue
    }

    // properties
    if (match = line.match(regex.property)) {
      tokens.push({ type: 'property', text: match[1]})
      continue
    }

    // boneyard
    if (match = line.match(regex.boneyard)) {
      tokens.push({ type: match[0][0] === '/' ? 'boneyard_begin' : 'boneyard_end' })
      continue
    }

    // page breaks
    if (regex.page_break.test(line)) {
      tokens.push({ type: 'page_break' })
      continue
    }

    // line breaks
    if (regex.line_break.test(line)) {
      tokens.push({ type: 'line_break' })
      continue
    }

    tokens.push({ type: 'action', text: line })
  }

  return tokens
}

const inlineParse = (s) => {

  let p = String(s)

  let inline = {
    line_break: '\n',

    bold_italic: '|bold-italic|$2|/|',
    bold: '|bold|$2|/|',
    italic: '|italic|$2|/|',
    underline: '|underline|$2|/|',
    highlight: '|highlight|$2|/|',
    strikethrough: '|strikethrough|$2|/|',
  }

  let styles = ['strikethrough', 'highlight', 'underline', 'italic', 'bold', 'bold_italic' ]
  let i = styles.length
  let style
  let match

  s = s.replace(/\n/g, inline.line_break)

  while (i--) {
    style = styles[i]
    match = regex[style]
    if (match.test(s)) {
      s = s.replace(match, inline[style])
      p = p.replace(match, '$2')
    }
  }

  return {formattedText: s.trim(), plainText: p.trim()}
}

const parse = (script, filepath) => {
  let tokens = tokenize(script).reverse()
  let lastTitleToken =  null
  for (var i = 0; i < tokens.length; i++) {
    switch (tokens[i].type) {
      case 'title':
      case 'credit':
      case 'author':
      case 'authors':
      case 'source':
      case 'notes':
      case 'draft_date':
      case 'date':
      case 'contact':
      case 'copyright':
      case 'revision':
        if (i < 30) {
          lastTitleToken = i
        }
        break
    }
    if (tokens[i].text) {
      let inlineNotesArray = tokens[i].text.match(regex.note_inline)
      tokens[i].text = tokens[i].text.replace(regex.note_inline, '')
      tokens[i].formattedText = inlineParse(tokens[i].text).formattedText
      tokens[i].plainText = inlineParse(tokens[i].text).plainText
      if (inlineNotesArray) {
        for (let z = 0; z < inlineNotesArray.length; z++) {
           tokens.splice(i+1, 0, { type: 'inline_note', 'text': inlineNotesArray[z].match(regex.note)[1], formattedText: inlineParse(inlineNotesArray[z].match(regex.note)[1]).formattedText, plainText: inlineParse(inlineNotesArray[z].match(regex.note)[1]).plainText})
           i++
        }
      }
    }
  }

  let output

  // if there are no title page tokens
  if (lastTitleToken == null) {
    // use the filepath as the title
    let title = filepath.split('\\').pop().split('/').pop().split('.')[0]
    output = { title: [{type: "title", text: title, formattedText: title, plainText: title}], script: tokens }
  } else {
    output = { title: tokens.slice(0,lastTitleToken+1), script: tokens.slice(lastTitleToken+1) }
  }

  //console.log(output)

  return output
}

module.exports = {
  parse
}