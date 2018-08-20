/* global CodeMirror */
/* global define */

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../../node_modules/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../../node_modules/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
    'use strict';
    
    CodeMirror.defineOption('showInvisibles', false, (cm, val, prev) => {
        let Count = 0;
        const Maximum = cm.getOption('maxInvisibles') || 16;
        
        if (prev === CodeMirror.Init)
            prev = false;
        
        if (prev && !val) {
            cm.removeOverlay('invisibles');
            return rm();
        }
        
        if (!prev && val) {
            add(Maximum);
         
            cm.addOverlay({
                name: 'invisibles',
                token: function nextToken(stream) {
                    let spaces = 0;
                    let peek = stream.peek() === ' ';
                    
                    if (peek) {
                        while (peek && spaces < Maximum) {
                            ++spaces;
                            
                            stream.next();
                            peek = stream.peek() === ' ';
                        }
                        
                        let ret = 'whitespace whitespace-' + spaces;
                        
                        /*
                         * styles should be different
                         * could not be two same styles
                         * beside because of this check in runmode
                         * function in `codemirror.js`:
                         *
                         * 6624: if (!flattenSpans || curStyle != style) {}
                         */
                        if (spaces === Maximum)
                            ret += ' whitespace-rand-' + Count++;
                        
                        return ret;
                    }
                    
                    while (!stream.eol() && !peek) {
                        stream.next();
                        
                        peek = stream.peek() === ' ';
                    }
                    
                    return 'cm-eol';
                }
            });
        }
    });

    function add(max) {
        const classBase = '.CodeMirror .cm-whitespace-';
        const spaceChar = '·';
        const style = document.createElement('style');
        
        style.setAttribute('data-name', 'js-show-invisibles');
        
        let rules = '';
        let spaceChars = '';
        
        for (let i = 1; i <= max; ++i) {
            spaceChars += spaceChar;
            
            const rule = classBase + i + '::before { content: "' + spaceChars + '";}\n';
            rules += rule;
        }
        
        style.textContent = getStyle() + '\n' + getEOL() + '\n' + rules;
        
        document.head.appendChild(style);
    }
    
    function rm() {
        const style = document.querySelector('[data-name="js-show-invisibles"]');
        
        document.head.removeChild(style);
    }
    
    function getStyle() {
        const style = [
            '.cm-whitespace::before {',
            '    position: absolute;',
            '    margin-left: 0px;',
            '    pointer-events: none;',
            '    color: rgba(255,255,255,0.05);',
            '}'
        ].join('');
        
        return style;
    }
    
    function getEOL() {
        const style = [
            '.CodeMirror-code > div > pre > span::after, .CodeMirror-line > span::after {',
            '    pointer-events: none;',
            '    color: rgba(255,255,255,0.02);',
            '    content: "¬";',
            '    opacity: 1',
            '}',
        ].join('');
        
        return style;
    }
});
