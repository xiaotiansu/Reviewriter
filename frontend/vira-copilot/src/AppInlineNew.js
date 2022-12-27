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
import Backdrop from '@mui/material/Backdrop';
import LinearProgress, { linearProgressClasses } from '@mui/material/LinearProgress';
import CircularProgress, {
    CircularProgressProps,
} from '@mui/material/CircularProgress';

// Hamta Configuration

let serverURL = "https://ml4ed-apps.epfl.ch/reviewriter5003/";

let timerLength = 0.00000001; // in seconds
let minimumNumberOfWordsToTriggerGeneration = 25;

let keystrokes = [];

// End Configuration

let allFetchedSuggestions = [];

let fetchedSuggestions = [];
let fetchedSuggestionsIndex = 0;

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

const keyDownOnTextArea = (e) => {
    if (e.keyCode == 9 || e.key == "Tab" || e.key == "Enter") {
        e.preventDefault();
    }
    if (status == "presented" && (e.key == "ArrowUp" || e.key == "ArrowDown")) {
        e.preventDefault();
    }
}

// Credit to Liam (Stack Overflow)
// https://stackoverflow.com/a/41034697/3480193
class Cursor {
    // static getCurrentCursorPosition(parentElement) {
    //     return getInputSelection(parentElement).start;
    // }

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
        } else if (node && chars.count > 0) {
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

// https://stackoverflow.com/a/9160869/4915882
String.prototype.insert = function (index, string) {
    if (index > 0) {
        return this.substring(0, index) + string + this.substr(index);
    }

    return string + this;
};

let status = "none" // "none", "loading", "presented"
let loadingIndex = -1; // TODO: Loading index is not dependant on the current text area index, which MAY make problems in the future
let timerID = undefined;

const setTextOfEditor = (textEditor, newText) => {
    let offset = Cursor.getCurrentCursorPosition(textEditor);
    console.log("newText - old", newText);
    const afterText = newText.replaceAll("<span class", "#####").replaceAll("\n", "<br>").replaceAll("\r", "<br>").replaceAll(" ", "&nbsp;").replaceAll("#####", "<span class");
    console.log("afterText - new", afterText);
    textEditor.innerHTML = afterText;
    Cursor.setCurrentCursorPosition(offset, textEditor);
    textEditor.focus();
}

const moveCursorForwardBy = (textEditor, i) => {
    let offset = Cursor.getCurrentCursorPosition(textEditor);
    Cursor.setCurrentCursorPosition(offset + i, textEditor);
    textEditor.focus();
}

const replaceTheWholeSpanWithSuggestionText = (textEditor) => {
    const str = getTextOfEditor(textEditor);
    const spanStart = "<span class=\"inline-suggestion\">"
    const spanEnd = "</span>"
    const indexOfSpanStart = str.indexOf(spanStart);
    const indexOfSpanEnd = str.indexOf(spanEnd);
    if (indexOfSpanStart == -1 || indexOfSpanEnd == -1) return;
    const suggestionText = str.substring(indexOfSpanStart + spanStart.length, indexOfSpanEnd);
    const newStr = str.replaceAll("<span class=\"inline-suggestion\">" + suggestionText + "</span>", suggestionText);
    setTextOfEditor(textEditor, newStr);
}

const getTextOfEditor = (textEditor) => {
    return textEditor.innerHTML.replaceAll("<br>", "\n").replaceAll("<br>", "\r").replaceAll("&nbsp;", " ");
}

function removeFromIToJ(str, i, j) {
    return str.substring(0, i) + str.substring(j + 1, str.length)
}

function removeSuggestionSpanFromString(str) {
    const i = str.indexOf("<span class=\"inline-suggestion\">");
    const j = str.indexOf("</span>") + 6;
    if (i == -1 || j == -1) return str;
    return removeFromIToJ(str, i, j);
}

const removeSuggestion = (textEditor) => {
    const hintArea = document.getElementById("hint-area");
    hintArea.innerHTML = "&nbsp;<br/>&nbsp;";
    status = "none";
    setTextOfEditor(textEditor, removeSuggestionSpanFromString(getTextOfEditor(textEditor)));
}

const getSuggestionPortionFromString = (str) => {
    const spanStart = "<span class=\"inline-suggestion\">"
    const i = str.indexOf(spanStart);
    const j = str.indexOf("</span>");
    if (i == -1 || j == -1) return "";
    return str.substring(i + spanStart.length, j);
}

const setLoading = (i, textEditor) => {
    const hintArea = document.getElementById("hint-area");
    status = "loading";
    hintArea.innerHTML = "Vorschlag laden...<br/>&nbsp;"; // Loading
    loadingIndex = i;
}

const addSuggestionAtIndex = (i, suggestion, textEditor) => {
    if (loadingIndex != i) return;
    const hintArea = document.getElementById("hint-area");
    const currentText = getTextOfEditor(textEditor);
    let offset = Cursor.getCurrentCursorPosition(textEditor);
    const newText = currentText.insert(offset, "<span class=\"inline-suggestion\">" + suggestion + "</span>");
    setTextOfEditor(textEditor, newText);
    keystrokes.push({ "key": "presented-suggestion", "time": Date.now(), "status": "loading" });
    status = "presented";
    hintArea.innerHTML = "Drücken Sie die Tab, um den Vorschlag zu akzeptieren, die Esc-Taste, um ihn abzulehnen, oder die Aufwärts- und Abwärtspfeiltaste, um zwischen den Vorschlägen zu wechseln.";
}

const allTextUpToCursorInTextEditor = (textEditorIndex, textEditor, currentOffset) => {
    let text = ""
    for (let i = 1; i < textEditorIndex; i++) {
        text += getTextOfEditor(document.getElementById("text-editor-" + i)) + "\n";
    }
    text += getTextOfEditor(textEditor).substring(0, currentOffset);
    console.log("allTextUpToCursorInTextEditor", text);
    return text;
}

const replaceSuggestionTextWithAnotherText = (textEditor, newText) => {
    const str = getTextOfEditor(textEditor);
    const spanStart = "<span class=\"inline-suggestion\">"
    const spanEnd = "</span>"
    const indexOfSpanStart = str.indexOf(spanStart);
    const indexOfSpanEnd = str.indexOf(spanEnd);
    if (indexOfSpanStart == -1 || indexOfSpanEnd == -1) return;
    const newStr = str.replaceAll("<span class=\"inline-suggestion\">" + str.substring(indexOfSpanStart + spanStart.length, indexOfSpanEnd) + "</span>", "<span class=\"inline-suggestion\">" + newText + "</span>");
    setTextOfEditor(textEditor, newStr);
}

const keyTappedInNoneStatus = (textEditorIndex, textEditor, hintArea, key, event) => {
    if (typeof timerID === 'number') {
        clearTimeout(timerID);
    }
    if (key == " " && getTotalNumberOfWordsFromAllTextEditors() >= minimumNumberOfWordsToTriggerGeneration) {
        timerID = setTimeout(() => {
            const currentOffset = Cursor.getCurrentCursorPosition(textEditor);
            setLoading(currentOffset, textEditor);
            const initialText = allTextUpToCursorInTextEditor(textEditorIndex, textEditor, currentOffset);
            fetch(serverURL + "predict", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8"
                },
                body: JSON.stringify({
                    "text": initialText
                })
            })
                .then(response => response.json())
                .then(data => {
                    fetchedSuggestions = data.suggestions;
                    allFetchedSuggestions.push(fetchedSuggestions);
                    console.log("fetchedSuggestions", fetchedSuggestions);
                    fetchedSuggestionsIndex = 0;
                    // TODO: Uppercase also!
                    if (status != "loading") removeSuggestion(textEditor);
                    else addSuggestionAtIndex(currentOffset, fetchedSuggestions[0].toLowerCase().replace("\n", " "), textEditor);
                })
                .catch((error) => {
                    removeSuggestion(textEditor);
                });
        }, timerLength);
    } else {
        const currentText = getTextOfEditor(textEditor);
        removeSuggestion(textEditor);
    }
}

const keyTappedInLoadingStatus = (textEditor, hintArea, key, event) => {
    removeSuggestion(textEditor);
}

const keyTappedInPresentedStatus = (textEditor, hintArea, key, event, currentOffset) => {
    const currentTextEditorText = getTextOfEditor(textEditor);
    const suggestionText = getSuggestionPortionFromString(currentTextEditorText);
    // TODO: if the user continues typing the first letter of the suggestion...
    if (key == "Tab") {
        replaceTheWholeSpanWithSuggestionText(textEditor);
        moveCursorForwardBy(textEditor, suggestionText.length + 1);
        hintArea.innerHTML = "&nbsp;<br/>&nbsp;";
        status = "none";
    } else if (key == "ArrowUp") {
        if (fetchedSuggestionsIndex == 0) fetchedSuggestionsIndex = fetchedSuggestions.length - 1;
        else fetchedSuggestionsIndex -= 1;
        const newSuggestion = fetchedSuggestions[fetchedSuggestionsIndex];
        replaceSuggestionTextWithAnotherText(textEditor, newSuggestion);
        Cursor.setCurrentCursorPosition(currentOffset, textEditor);
        textEditor.focus();
    } else if (key == "ArrowDown") {
        if (fetchedSuggestionsIndex == fetchedSuggestions.length - 1) fetchedSuggestionsIndex = 0;
        else fetchedSuggestionsIndex += 1;
        const newSuggestion = fetchedSuggestions[fetchedSuggestionsIndex];
        replaceSuggestionTextWithAnotherText(textEditor, newSuggestion);
        Cursor.setCurrentCursorPosition(currentOffset, textEditor);
        textEditor.focus();
    } else {
        removeSuggestion(textEditor);
        status = "none";
    }
}

let countOfTextEditors = 1;

const getTotalTextFromAllTextEditorsSeperatedBySpace = () => {
    let totalText = "";
    for (let i = 0; i < countOfTextEditors + 1; i++) {
        const textEditor = document.getElementById("text-editor-" + i);
        if (textEditor == undefined || textEditor == null) continue;
        totalText += getTextOfEditor(textEditor) + " ";
    }
    return totalText;
}

const getTotalTextFromAllTextEditorsSeperatedByNewline = () => {
    let totalText = "";
    for (let i = 0; i < countOfTextEditors + 1; i++) {
        const textEditor = document.getElementById("text-editor-" + i);
        if (textEditor == undefined || textEditor == null) continue;
        totalText += getTextOfEditor(textEditor) + "\n";
    }
    return totalText;
}

const getTotalNumberOfWordsFromAllTextEditors = () => {
    const text = getTotalTextFromAllTextEditorsSeperatedBySpace();
    const words = text.split(" ");
    let length = 0;
    for (let i = 0; i < words.length; i++) {
        if (words[i] != "") {
            length += 1;
        }
    }
    return length;
}


const setWordCount = () => {
    document.getElementById("word-count").innerHTML = "Aktuelle Wortzahl: " + getTotalNumberOfWordsFromAllTextEditors();
}

// https://stackoverflow.com/a/74157816/4915882
const onPaste = (e) => {
    e.preventDefault();

    // Get the copied text from the clipboard
    const text = e.clipboardData
        ? (e.originalEvent || e).clipboardData.getData('text/plain')
        : // For IE
        window.clipboardData
            ? window.clipboardData.getData('Text')
            : '';

    // Insert text at the current position of caret
    const range = document.getSelection().getRangeAt(0);
    range.deleteContents();

    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.selectNodeContents(textNode);
    range.collapse(false);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

const keyTapped = (textEditorIndex, event, textEditor) => {
    console.log(event.key);
    let currentOffset = Cursor.getCurrentCursorPosition(textEditor);
    keystrokes.push({ "key": event.key, "time": Date.now(), "status": status }); // "status" is status before the key was pressed
    if (event.key == "Enter") {
        event.preventDefault();
        countOfTextEditors += 1;
        const mainContainer = document.getElementById("main-container");
        const newEditor = document.createElement("div");
        newEditor.setAttribute("contenteditable", "true");
        newEditor.setAttribute("class", "text-editor");
        const id = countOfTextEditors;
        newEditor.setAttribute("id", "text-editor-" + id);
        newEditor.onkeyup = (event) => {
            keyTapped(id, event, document.getElementById("text-editor-" + id));
        }
        newEditor.onpaste = (event) => {
            onPaste(event);
        }
        newEditor.onkeydown = (event) => {
            keyDownOnTextArea(event);
        }
        mainContainer.appendChild(newEditor);
        newEditor.focus();
        setWordCount();
        return;
    }
    if (event.key == "Meta" || event.key == "Alt" || event.key == "Control" || event.key == "Shift") {
        event.preventDefault();
        setWordCount();
        return;
    }
    const hintArea = document.getElementById("hint-area");
    if (status == "none") {
        keyTappedInNoneStatus(textEditorIndex, textEditor, hintArea, event.key, event);
    } else if (status == "loading") {
        keyTappedInLoadingStatus(textEditor, hintArea, event.key, event);
    } else if (status == "presented") {
        keyTappedInPresentedStatus(textEditor, hintArea, event.key, event, currentOffset);
    }
    setWordCount();
}

function AppInlineNew() {
    const [isLoadingIndicatorOpen, setLoadingIndicatorOpen] = React.useState(false);
    const [isHelpDialogOpen, setHelpDialogOpen] = React.useState(false);
    const handleOpenHelpDialog = () => {
        setHelpDialogOpen(true);
    };
    const handleCloseHelpDialog = () => {
        setHelpDialogOpen(false);
    };
    const submitTapped = () => {
        const username = prompt("Bitte geben Sie Ihre ID ein:");
        if (username == undefined || username == null) return;
        const review = getTotalTextFromAllTextEditorsSeperatedByNewline();
        setLoadingIndicatorOpen(true);
        fetch(serverURL + "submitReview", {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8"
            },
            body: JSON.stringify({
                "review": review,
                "username": username,
                "keystrokes": keystrokes,
                "suggestions": allFetchedSuggestions
            })
        })
            .then(response => response.json())
            .then(data => {
                keystrokes = [];
                allFetchedSuggestions = [];
                setLoadingIndicatorOpen(false);
                console.log(data);
                alert("Deine Bewertung wurde erfolgreich gesendet!");
            })
            .catch(error => {
                setLoadingIndicatorOpen(false);
                console.log(error);
                alert("Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.");
            });
    }

    React.useEffect(() => {
        const textEditor1 = document.getElementById("text-editor-1");
        textEditor1.focus();
    }, []);

    return (
        <>
            <div className="main-container">

                <div style={{ fontSize: '275%', fontWeight: 'bold', paddingTop: 50, paddingBottom: 50, paddingRight: 15, paddingLeft: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Reviewriter - Peer Reviews Schreiben</span>

                        <HtmlTooltip title={
                            <>
                                <h2>Hilfe</h2>
                                <h3>Klicken Sie auf das Fragezeichen, um die Hilfe für das System anzuzeigen.</h3>
                            </>
                        }
                        ><span ><HelpIcon onClick={handleOpenHelpDialog} className="help-icon" /></span></HtmlTooltip>
                    </div>
                </div>



                <div id="main-container" className="main-container-prompt-and-text-editor">
                    <div style={{ paddingLeft: '2%', paddingRight: '2%', paddingTop: '0%', paddingBottom: '0%', marginBottom: 20, border: '1px solid #111', width: '96%', borderRadius: 20 }}>
                        <p style={{ fontSize: '150%', lineHeight: '150%' }}>
                            {/* TODO: link for video! */}
                            In dieser Aufgabe werden Sie gebeten, einen Peer Review von mindestens 300 Wörtern über ein Geschäftsmodell zu schreiben. Dabei sollten Sie versuchen, die Stärken und Schwächen des Geschäftsmodells sowie eigene Verbesserungsvorschläge und Ideen einzubringen.
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: 20, fontSize: '150%', textAlign: "center", lineHeight: "150%" }} id="hint-area">
                        &nbsp;<br />&nbsp;
                    </div>

                    <div contentEditable={true} className={"text-editor"} id="text-editor-1" onKeyUp={(event) => keyTapped(1, event, document.getElementById("text-editor-1"))} onKeyDown={keyDownOnTextArea} onPaste={onPaste}></div>


                </div>

                <br /> <br />
                <p style={{ fontSize: '150%', lineHeight: '150%', fontStyle: 'italic' }} id="word-count">Aktuelle Wortzahl: 0</p>

                <br /> <br />

                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                    <button style={{ width: 150, height: 50, backgroundColor: 'rgb(199, 236, 245)', borderRadius: 10, border: '1px solid black', resize: 'none', outline: 'none', fontSize: '120%', textAlign: 'center', padding: 5, cursor: 'pointer', fontWeight: 'bold', marginBottom: 10 }} onClick={submitTapped}>Submit</button>
                </div>

            </div>

            <Dialog open={isHelpDialogOpen} onClose={handleCloseHelpDialog} scroll={"paper"} aria-labelledby="scroll-dialog-title" aria-describedby="scroll-dialog-description" >
                <DialogTitle id="scroll-dialog-title">Hilfe</DialogTitle>
                <DialogContent dividers={true}>
                    <DialogContentText
                        id="scroll-dialog-description"
                        tabIndex={-1} >
                        <div style={{ fontSize: '120%' }}>
                            <h2>Leitfaden für das Verfassen von Peer-Reviews</h2>

                            <p>
                                Beginnen Sie mit der Eingabe Ihres Peer-Reviews im Textbereich unter. Drücken Sie die Eingabetaste, um einen neuen Absatz zu beginnen.
                            </p>

                            <p>
                                Nach Eingabe von 25 Wörtern, können Sie die intelligenten Vorschläge von Hamta nutzen. Nachdem Sie jedes Wort eingegeben und die Leertaste gedrückt haben, sehen Sie „Vorschlag wird geladen…". Drücken Sie die Tab, um den Vorschlag zu akzeptieren, die Esc-Taste, um ihn abzulehnen, oder die Aufwärts- und Abwärtspfeiltaste, um zwischen den Vorschlägen zu wechseln.
                            </p>

                            <p>
                                Wenn „Vorschläge werden geladen…" lange Zeit angezeigt wird und Sie keine Vorschläge erhalten, kann dies an vorübergehenden technischen Problemen des Servers liegen. In diesem Fall können Sie ganz normal weitertippen, und nach dem nächsten eingegebenen Wort wird möglicherweise eine neue Verbindung zum Server hergestellt.
                            </p>

                            <p>
                                Bitte beachten Sie, dass Hamta noch in Arbeit ist und die bereitgestellten Vorschläge nicht unbedingt korrekt sind, sodass Sie den Text auch selbst überprüfen müssen.
                            </p>

                            <p>
                                Vielen Dank für Ihre Teilnahme an dieser Forschungsarbeit!
                            </p>

                        </div>
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseHelpDialog}>Erledigt</Button>
                </DialogActions>
            </Dialog>

            <Backdrop
                sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
                open={isLoadingIndicatorOpen}
            >
                <CircularProgress color="inherit" />
            </Backdrop>
        </>
    );
}

export default AppInlineNew;