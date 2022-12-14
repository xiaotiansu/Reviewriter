import './App.css';
import React from 'react';
import HelpIcon from '@mui/icons-material/Help';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';

// Credit to Liam (Stack Overflow)
// https://stackoverflow.com/a/41034697/3480193
class Cursor {
    static getCurrentCursorPosition(parentElement) {
        var selection = window.getSelection(),
            charCount = -1,
            node;
        
        if (selection.focusNode) {
            if (Cursor._isChildOf(selection.focusNode, parentElement)) {
                node = selection.focusNode; 
                charCount = selection.focusOffset;
                
                while (node) {
                    if (node === parentElement) {
                        break;
                    }

                    if (node.previousSibling) {
                        node = node.previousSibling;
                        charCount += node.textContent.length;
                    } else {
                        node = node.parentNode;
                        if (node === null) {
                            break;
                        }
                    }
                }
            }
        }
        
        return charCount;
    }
    
    static setCurrentCursorPosition(chars, element) {
        if (chars >= 0) {
            var selection = window.getSelection();
            
            let range = Cursor._createRange(element, { count: chars });

            if (range) {
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }
    
    static _createRange(node, chars, range) {
        if (!range) {
            range = document.createRange()
            range.selectNode(node);
            range.setStart(node, 0);
        }

        if (chars.count === 0) {
            range.setEnd(node, chars.count);
        } else if (node && chars.count >0) {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.textContent.length < chars.count) {
                    chars.count -= node.textContent.length;
                } else {
                    range.setEnd(node, chars.count);
                    chars.count = 0;
                }
            } else {
                for (var lp = 0; lp < node.childNodes.length; lp++) {
                    range = Cursor._createRange(node.childNodes[lp], chars, range);

                    if (chars.count === 0) {
                    break;
                    }
                }
            }
        } 

        return range;
    }
    
    static _isChildOf(node, parentElement) {
        while (node !== null) {
            if (node === parentElement) {
                return true;
            }
            node = node.parentNode;
        }

        return false;
    }
}

let suggestionText = "";
let textBeforeSuggestion = "";

const HtmlTooltip = styled(({ className, ...props }: TooltipProps) => (
    <Tooltip {...props} classes={{ popper: className }} />
  ))(({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
      backgroundColor: '#f5f5f9fa',
      color: 'rgba(0, 0, 0, 0.87)',
      maxWidth: 220,
      fontSize: theme.typography.pxToRem(12),
      border: '1px solid #dadde9',
    },
  }));

let isPredicting = false;

const predictNextWord = (textEditor, text, hintArea) => {
    isPredicting = true;
    fetch('http://localhost:5004/predictNextWord?' + new URLSearchParams({
        text: text,
    }), {
        method: 'GET',
        headers: {
        'Content-Type': 'application/json'
        },
    })
    .then(response => response.json())
    .then(data => {
        if (isPredicting) {
            console.log(data);
            let offset = Cursor.getCurrentCursorPosition(textEditor);
            suggestionText = data.suggestions[0];
            textBeforeSuggestion = text;
            textEditor.innerHTML = text + "<span class='inline-suggestion'>" + suggestionText + "</span>";
            Cursor.setCurrentCursorPosition(offset, textEditor);
            textEditor.focus();
            updateWordCount();
            hintArea.innerHTML = "Drücken Sie Tab, um den Vorschlag anzunehmen, oder Esc, um ihn abzulehnen.";
            isPredicting = false;
        }
    })
    .catch((error) => {
        if (isPredicting) {
            console.log('Error in fetch predictNextWord:', error);
            hintArea.innerHTML = text;
            isPredicting = false;
        }
    });
}

const isCharacterTypable = (character, keycode) => {
    const result = 
        (keycode > 47 && keycode < 58)   || // number keys
        keycode == 32 || keycode == 13   || // spacebar & return key(s) (if you want to allow carriage returns)
        (keycode > 64 && keycode < 91)   || // letter keys
        (keycode > 95 && keycode < 112)  || // numpad keys
        (keycode > 185 && keycode < 193) || // ;=,-./` (in order)
        (keycode > 218 && keycode < 223) ||   // [\]' (in order)
        character == "ä" || character == "ö" || character == "ü" || character == "ß";
    return result;
}

const setTextOfEditor = (textEditor, newText) => {
    let offset = Cursor.getCurrentCursorPosition(textEditor);
    textEditor.innerHTML = newText;
    Cursor.setCurrentCursorPosition(offset, textEditor);
    textEditor.focus();
    updateWordCount();
}

const setTextOfEditorAndMoveToEnd = (textEditor, newText) => {
    textEditor.innerHTML = newText;
    Cursor.setCurrentCursorPosition(newText.length, textEditor);
    textEditor.focus();
    updateWordCount();
}

const updateWordCount = () => {
    const wordCountArea = document.getElementById("word-count");
    wordCountArea.innerHTML = "Aktuelle Wortzahl: " + textBeforeSuggestion.split(' ').length;
}

const keyTapped = (event) => {
    isPredicting = false;
    const textEditor = document.getElementById('text-editor');
    const text = textEditor.innerText;
    const hintArea = document.getElementById('hint-area');
    console.log("Key Tapped", event.key);
    if (event.key == "Escape") {
        setTextOfEditor(textEditor, textBeforeSuggestion);
        suggestionText = "";
        hintArea.innerHTML = "&nbsp;";
    }
    if (event.key == "Tab") {
        setTextOfEditorAndMoveToEnd(textEditor, textBeforeSuggestion + suggestionText + " ");
        suggestionText = "";
        if (!isPredicting) hintArea.innerHTML = "Vorschlag laden..."
        predictNextWord(textEditor, text + " ", hintArea);
    }
    if (!isCharacterTypable(event.key, event.keyCode)) return;
    const wordCountArea = document.getElementById('word-count');
    const key = event.key;

    wordCountArea.innerHTML = "Aktuelle Wortzahl: " + textEditor.innerHTML.split(' ').length;
    console.log("'" + text[text.length - 1] + "'");
    console.log("'" + text + "'");

    // if (text.length > 0 && (text[text.length - 1] == "\n" || text[text.length - 1] == "\r") && (key != "\r" && key != "\n" && key != "Enter")) {
    //     console.log("Here!");
    //     hintArea.innerHTML = "&nbsp;";
    //     setTextOfEditor(textEditor, text.substring(0, text.length - 1));
    // }
    // if (key == " " && text.length > 0 && text[text.length - 1] == " ") {
    if (key == " " && text.length > 0) {
        hintArea.innerHTML = "Vorschlag laden..."
        predictNextWord(textEditor, text, hintArea);
    } else {
        hintArea.innerHTML = "&nbsp;";
        if (suggestionText.length > 0 && key == suggestionText[0]) {
            suggestionText = suggestionText.substring(1);
            textBeforeSuggestion = textBeforeSuggestion + key;
            let offset = Cursor.getCurrentCursorPosition(textEditor);
            console.log(textBeforeSuggestion + "<span class='inline-suggestion'>" + suggestionText + "</span>")
            textEditor.innerHTML = textBeforeSuggestion + "<span class='inline-suggestion'>" + suggestionText + "</span>";
            Cursor.setCurrentCursorPosition(offset, textEditor);
            textEditor.focus();
            updateWordCount();
        } else {
            if (suggestionText != "") {
                suggestionText = "";
                let offset = Cursor.getCurrentCursorPosition(textEditor);
                textEditor.innerHTML = textBeforeSuggestion + "" + key;
                Cursor.setCurrentCursorPosition(offset, textEditor);
                textEditor.focus();
                updateWordCount();
            }
        }
    }
}

const keyDownOnTextArea = (e) => {
    if (e.key == "Tab") {
        e.preventDefault();
    }
}

/*
textEditor.innerHTML = text.substring(0, text.length - suggestionText.length);
            suggestionText = "";
             */


function AppInline() {
    const [isHelpDialogOpen, setHelpDialogOpen] = React.useState(false);
    const handleOpenHelpDialog = () => {
        setHelpDialogOpen(true);
    };
    const handleCloseHelpDialog = () => {
        setHelpDialogOpen(false);
    };
    return (
        <>
            <div className="main-container">
                
                <div style={{fontSize: '275%', fontWeight: 'bold', paddingTop: 50, paddingBottom: 50, paddingRight: 15, paddingLeft: 10}}>
                    <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                        <span>Vilot - Peer Reviews Schreiben</span>

                        <HtmlTooltip title={
                            <>
                                <h2>Hilfe</h2>
                                <h3>Klicken Sie auf das Fragezeichen, um die Hilfe für das System anzuzeigen.</h3>
                            </>
                            }
                            ><span ><HelpIcon onClick={handleOpenHelpDialog} className="help-icon" /></span></HtmlTooltip>
                    </div>
                </div>

                    
                
                <div className="main-container-prompt-and-text-editor">
                    <div style={{paddingLeft: '2%', paddingRight: '2%', paddingTop: '0%', paddingBottom: '0%', marginBottom: 20, border: '1px solid #111', width: '96%', borderRadius: 20}}>
                        <p style={{fontSize: '150%', lineHeight: '150%'}}>
                            {/* TODO: link for video! */}
                            In dieser Aufgabe sollen Sie ein Peer Review mit mindestens 300 Wörtern über ein Geschäftsmodell schreiben. Sie können ein Video des Geschäftsmodells unter <a target="_blank" href="https://google.com">diesem Link</a> sehen. Sie sollten versuchen, die Stärken und Schwächen des Geschäftsmodells sowie Ihre eigenen Verbesserungsvorschläge und Ideen einzubringen.
                        </p>
                        <p style={{fontSize: '150%', lineHeight: '150%', fontStyle: 'italic'}} id="word-count">Aktuelle Wortzahl: 0</p>
                    </div>

                    <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: 20, fontSize: '150%'}} id="hint-area">
                        &nbsp;
                    </div>
                    <div contentEditable={true} id="text-editor" onKeyUp={keyTapped} onKeyDown={keyDownOnTextArea}></div>
                    {/* <div style={{width: '100%', display: 'flex', justifyContent: 'center', marginTop: 20}}>
                        <div className='submit-button'>Einreichen</div>
                    </div> */}
                   
                </div>
                
            </div>

            <Dialog open={isHelpDialogOpen} onClose={handleCloseHelpDialog} scroll={"paper"} aria-labelledby="scroll-dialog-title" aria-describedby="scroll-dialog-description" >
                <DialogTitle id="scroll-dialog-title">Hilfe</DialogTitle>
                <DialogContent dividers={true}>
                <DialogContentText
                    id="scroll-dialog-description"
                    tabIndex={-1} >
                    <div style={{fontSize: '120%'}}>
                    <h2>Leitfaden für das Verfassen von Peer-Reviews mit Vilot</h2>

                    <p>
                    Beginnen Sie mit der Eingabe Ihrer Peer Review in das Textfeld unter der Eingabeaufforderung. Während Sie tippen, sehen Sie, wie viele Wörter im Text unter der Aufforderung und über dem Textbereich aktualisiert werden.
                    </p>

                    <p>
                    Wenn Sie die Eingabe Ihrer Peer Review im Textfeld beendet haben und die im Aufforderungstext über dem Textfeld angegebene Anzahl von Wörtern erreicht haben, sollten Sie den Text kopieren, um ihn in die Umfrage einzufügen, die Ihnen von den Forschern zur Verfügung gestellt wird.
                    </p>

                    <p>
                    Nachdem Sie jedes Wort eingegeben und die Leertaste oder eventuell die Eingabetaste gedrückt haben, sehen Sie oberhalb des Textbereichs "Vorschlag laden...". Nach kurzer Zeit kann ein Vorschlag im Textbereich in grauer Schrift hinter dem Cursor erscheinen.
                    <br />
                    Um den Vorschlag anzunehmen (d. h. ihn zum Rest des aktuell eingegebenen Textes im Textbereich hinzuzufügen), drücken Sie die Tab auf Ihrer Tastatur.
                    <br />
                    Um den Vorschlag abzulehnen (was bedeutet, dass Sie den Vorschlag nicht an den Text anhängen und etwas anderes schreiben möchten), können Sie entweder die Escape-Taste (Esc) auf der Tastatur drücken oder etwas anderes als den Vorschlag schreiben.
                    <br />
                    Wenn Sie lange Zeit die Meldung "Vorschlag laden..." sehen und keine Vorschläge erhalten, kann dies auf vorübergehende technische Probleme des Servers zurückzuführen sein. In diesem Fall können Sie ganz normal weitertippen, und nach dem nächsten Wort, das Sie eingeben, wird eine neue Verbindung zum Server hergestellt.
                    </p>

                    <p>
                    Vielen Dank für Ihre Teilnahme an dieser Forschungsarbeit!
                    </p>

                    <p>
                        Seyed Parsa Neshaei (parsa.neshaei@uni-kassel.de)
                        <br />
                        Xiaotian Su (xiaotian.su@epfl.ch)
                        <br />
                        Thiemo Wambsganss (thiemo.wambsganss@epfl.ch)
                        <br />
                        Roman Rietsche (roman.rietsche@unisg.ch)
                        <br />
                        Tanja Käser (tanja.kaeser@epfl.ch)
                    </p>

                    </div>
                </DialogContentText>
                </DialogContent>
                <DialogActions>
                <Button onClick={handleCloseHelpDialog}>Erledigt</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

export default AppInline;