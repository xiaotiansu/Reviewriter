import './App.css';
import React from 'react';
import HelpIcon from '@mui/icons-material/Help';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';
import Grid from '@mui/material/Grid';
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
import { Divider } from '@mui/material';

// Hamta Configuration

let serverURL = "http://localhost:5001/";

let timerLength = 1; // in seconds
let minimumNumberOfWordsToTriggerGeneration = 25;

let keystrokes = [];

// End Configuration
let allFetchedSuggestions = [];

let fetchedSuggestions = [];

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
let timerID = undefined;

const getTextOfEditor = (textEditor) => {
    return textEditor.innerHTML.replaceAll("<br>", "\n").replaceAll("<br>", "\r").replaceAll("&nbsp;", " ");
}

const setTextOfEditor = (textEditor, newText) => {
    let offset = Cursor.getCurrentCursorPosition(textEditor);
    const afterText = newText.replaceAll("<span class", "#####").replaceAll("\n", "<br>").replaceAll("\r", "<br>").replaceAll(" ", "&nbsp;").replaceAll("#####", "<span class");
    textEditor.innerHTML = afterText;
    Cursor.setCurrentCursorPosition(offset, textEditor);
    textEditor.focus();
}

const allTextUpToCursorInTextEditor = (textEditor, currentOffset) => {
    return getTextOfEditor(textEditor).substring(0, currentOffset);
}

const getTotalTextFromAllTextEditorsSeperatedBySpace = () => {
    const textEditor = document.getElementById("text-editor");
    if (textEditor == undefined || textEditor == null) return "";
    return getTextOfEditor(textEditor);
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

const setDashboardContents = (suggestions) => {
    if (suggestions == undefined || suggestions == null) return;
    if (suggestions.length == 0) return;
    if (suggestions.length == 1) {
        document.getElementById("right-dashboard-p1").innerHTML = suggestions[0];
        document.getElementById("right-dashboard-p2").innerHTML = "&nbsp;";
        document.getElementById("right-dashboard-p3").innerHTML = "&nbsp;";
        document.getElementById("right-dashboard-divider1").style.display = "none";
        document.getElementById("right-dashboard-divider2").style.display = "none";
    } else {
        document.getElementById("right-dashboard-p1").innerHTML = "... " + suggestions[0] + "...";
        document.getElementById("right-dashboard-p2").innerHTML = "... " + suggestions[1] + "...";
        document.getElementById("right-dashboard-p3").innerHTML = "... " + suggestions[2] + "...";
        document.getElementById("right-dashboard-divider1").style.display = "block";
        document.getElementById("right-dashboard-divider2").style.display = "block";
    }
}

const keyTappedInNoneStatus = (textEditor, key, event) => {
    if (typeof timerID === 'number') {
        clearTimeout(timerID);
    }
    if (key == " " && getTotalNumberOfWordsFromAllTextEditors() >= minimumNumberOfWordsToTriggerGeneration) {
        timerID = setTimeout(() => {
            const currentOffset = Cursor.getCurrentCursorPosition(textEditor);
            setDashboardContents(["Vorschlag laden..."]);
            const initialText = allTextUpToCursorInTextEditor(textEditor, currentOffset);
            fetch(serverURL + 'predict?' + new URLSearchParams({
                text: initialText,
            }), { method: 'GET', headers: { 'Content-Type': 'application/json' } })
                .then(response => response.json())
                .then(data => {
                    fetchedSuggestions = data.suggestions;
                    allFetchedSuggestions.push(fetchedSuggestions);
                    setDashboardContents(fetchedSuggestions);
                })
                .catch((error) => {
                    console.error('Error:', error);
                });
        }, timerLength * 1000 + 1);
    } else {
        setDashboardContents(["Geben Sie eine Weile weiter ein, um Vorschläge zu erhalten."]);
    }
}

const keyTappedInLoadingStatus = (textEditor, key, event) => {
    setDashboardContents(["Geben Sie eine Weile weiter ein, um Vorschläge zu erhalten."]);
}

const keyTappedInPresentedStatus = (textEditor, key, event, currentOffset) => {
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

const keyTapped = (event, textEditor) => {
    console.log(event.key);
    let currentOffset = Cursor.getCurrentCursorPosition(textEditor);
    keystrokes.push({ "key": event.key, "time": Date.now(), "status": status + "-dashboard" }); // "status" is status before the key was pressed
    if (event.key == "Meta" || event.key == "Alt" || event.key == "Control" || event.key == "Shift") {
        event.preventDefault();
        setWordCount();
        return;
    }
    if (status == "none") {
        keyTappedInNoneStatus(textEditor, event.key, event);
    } else if (status == "loading") {
        keyTappedInLoadingStatus(textEditor, event.key, event);
    } else if (status == "presented") {
        keyTappedInPresentedStatus(textEditor, event.key, event, currentOffset);
    }
    setWordCount();
}

function AppDashboard() {
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
        const review = getTotalTextFromAllTextEditorsSeperatedBySpace();
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
        const textEditor = document.getElementById("text-editor");
        textEditor.focus();
    }, []);

    return (
        <>
            <div className="main-container">

                <div style={{ fontSize: '275%', fontWeight: 'bold', paddingTop: 30, paddingBottom: 30, paddingRight: 15, paddingLeft: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Hamta - Peer Reviews Schreiben</span>

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
                    <div style={{ paddingLeft: '2%', paddingRight: '2%', paddingTop: '0%', paddingBottom: '0%', marginBottom: 20, border: '1px solid #111', width: '96%', borderRadius: 20}}>
                        <p style={{ fontSize: '150%', lineHeight: '150%' }}>
                            In dieser Aufgabe werden Sie gebeten, einen Peer Review von mindestens 300 Wörtern über ein Geschäftsmodell zu schreiben. Dabei sollten Sie versuchen, die Stärken und Schwächen des Geschäftsmodells sowie eigene Verbesserungsvorschläge und Ideen einzubringen.
                        </p>
                    </div>

                    <Grid container spacing={10}>
                        <Grid item xs={6}>
                            <div>
                                <div contentEditable={true} className={"text-editor text-editor-dashboard"} id="text-editor" onKeyUp={(event) => keyTapped(event, document.getElementById("text-editor"))} onPaste={onPaste}></div>
                                <br />
                                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                                    <p style={{ fontSize: '150%', lineHeight: '150%' }} id="word-count">Aktuelle Wortzahl: 0</p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                                    <button style={{ width: 150, height: 50, backgroundColor: 'rgb(199, 236, 245)', borderRadius: 10, border: '1px solid black', resize: 'none', outline: 'none', fontSize: '120%', textAlign: 'center', padding: 5, cursor: 'pointer', fontWeight: 'bold', marginBottom: 10 }} onClick={submitTapped}>Submit</button>
                                </div>
                            </div>
                        </Grid>
                        <Grid item xs={6}>
                            <div className={"right-dashboard"}>
                                <h2 style={{textAlign: 'center', lineHeight: '125%'}}>Vorschläge zur Vervollständigung Ihres Bewertungstextes</h2>
                                <p id="right-dashboard-p1">Geben Sie eine Weile weiter ein, um Vorschläge zu erhalten.</p>
                                <Divider id="right-dashboard-divider1" style={{ width: '100%', borderBottomWidth: 3, display: 'none' }} />
                                <p id="right-dashboard-p2">&nbsp;</p>
                                <Divider id="right-dashboard-divider2" style={{ width: '100%', borderBottomWidth: 3, display: 'none' }} />
                                <p id="right-dashboard-p3">&nbsp;</p>
                            </div>
                        </Grid>
                    </Grid>
                </div>
            </div>

            <Dialog open={isHelpDialogOpen} onClose={handleCloseHelpDialog} scroll={"paper"} aria-labelledby="scroll-dialog-title" aria-describedby="scroll-dialog-description" >
                <DialogTitle id="scroll-dialog-title">Hilfe</DialogTitle>
                <DialogContent dividers={true}>
                    <DialogContentText
                        id="scroll-dialog-description"
                        tabIndex={-1} >
                        <div style={{ fontSize: '120%' }}>
                            <h2>Leitfaden für das Verfassen von Peer-Reviews mit Hamta</h2>

                            <p>
                                Beginnen Sie mit der Eingabe Ihres Peer-Reviews im Textbereich. Während Sie tippen, können Sie die aktualisierte Wortzahl im Text unterhalb des Textbereichs sehen.
                            </p>

                            <p>
                                Wenn Ihnen die Ideen ausgehen oder Sie nicht wissen, was Sie als Nächstes schreiben sollen, können Sie Hamtas intelligente Vorschläge nutzen. Nachdem Sie jedes Wort eingegeben und die Leertaste gedrückt haben, wird im rechten Bereich "Vorschlag wird geladen..." angezeigt. Nach einer gewissen Zeit kann im rechten Bereich ein grauer Textvorschlag erscheinen. Es werden keine Vorschläge gemacht, bis Sie insgesamt mehr als 25 Wörter eingeben. Die genaue Anzahl hängt vom Bewertungstext selbst ab.
                            </p>

                            <p>
                                Nachdem Sie Ihre Peer-Review mit mindestens 300 Wörtern in das Textfeld eingegeben haben, sollten Sie auf die Schaltfläche „Senden“ klicken und dann Ihre Prolific-ID eingeben, um den Text einzureichen. Kehren Sie dann zur Umfrage zurück.
                            </p>

                            <p>
                                Wenn „Vorschläge werden geladen…“ lange Zeit angezeigt wird und Sie keine Vorschläge erhalten, kann dies an vorübergehenden technischen Problemen des Servers liegen. In diesem Fall können Sie ganz normal weitertippen, und nach dem nächsten eingegebenen Wort wird möglicherweise eine neue Verbindung zum Server hergestellt.
                            </p>

                            <p>
                                Bitte beachten Sie, dass Hamta noch in Arbeit ist und die bereitgestellten Vorschläge nicht unbedingt korrekt sind, sodass Sie den Text auch selbst überprüfen müssen. Mit anderen Worten, es werden Fehler oder Ungenauigkeiten in den generierten Texten erwartet.
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

export default AppDashboard;