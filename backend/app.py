import numpy as np
import tensorflow as tf
from flask import Flask, jsonify, request 
from flask import url_for, redirect
from flask_cors import CORS
from transformers import pipeline
import re
import json
from types import SimpleNamespace
import threading

lock = threading.Lock()

app = Flask(__name__, static_url_path='/static')
CORS(app)

static_text = text = "Im Folgenden werde ich nun das Geschäftsmodell zur Alp-Us fachlich bewerten. Insights: die Präsentation liefert nur sehr geringe Einblicke und Insights, die teilweise zu schwach sind um die Existenz der App zu gerechtfertigen. Eine Strategie, wie man zur Entwicklung einer Ski-Plannungs App gekommen ist fehlt gänzlich. Leder keine Insights von Konsumenten Seite und keine von einer Kommerziellen Seite. Dies lässt auf eine zu geringe Marktforschung hinschließen. Die Zielgruppe ist doch sehr spezifisch, vielleicht sogar zu klein um die Kosten einer solchen App zu gerechtfertigen. Ich bezweifele die Nachfrage nach der App. Mission: das Mission Statement fehlt komplett und deutet weiterhin auf eine oberflächliche Recherche der Entwicklung bezüglich des Marketes hin. Das Statement hilft einen Fokus und Direktion der Marke beizubehalten. Das Fehlen davon lässt darauf schließen, dass die Entwickler selbst nicht sehr motiviert und an Ihr Produkt glauben. Die Präsentation war sehr fad und es fehlte jegliche Passion für das Projekt. Tool: die App und deren interne Datenabwicklung werden sehr gut beschrieben. Es ist klar verständlich, wie der Enduser die App nutzen wird. Der Prozess ist leicht und verständlich erklärt. Positiv fielen auch die angestrebten Drittanbieter auf, die zur Kafentscheidung des Endkonsumenten beitragen werden. Branding: aus dem Beitrag kommen wenige Information über das Branding zu Wort und wie man sich klar von der Konkurenz absetzen möchte. Ich hätte mir hier eine stärkere Präzens gewünsct, zum Beispiel die Slides hätte man jewels mit dem Logo versehen können. Auch hier ein Indiz zur geringen Vorbereitung des Projektes. Benefits: die Vorteile für den Nutzer werden am Anfang der Präsentation wiedergegeben. Jedoch sind sie nicht stark genug, um eine App zu gerechtfertigen. Auch hier fehlen Daten und Fakten um das Argument für die Entwicklung der App zu gerechtfertigen. Problem Solving: das Anfangss-Problem wird aus der Sicht des Nutzers kurz beschrieben. Jedoch nicht mit Marktforschung unterstützt. Es gibt keinen Winkel aus kommerzieller Seite, was die Idee der App unterstützen könnte und die Promotion für die App wird so deutlich beinträchtigt. Das Problem wird nicht gerade  weltenverändernd  präsentiert. Warum ist gerade dieses Problem lösungswert? Reiseplannungs-Apps gibt es genug. Die Argumente für die App sind aus meiner wirtschaftlichen Sicht zu schwach. Hier fehlt die Strategie, Konsumenten und Kommerz zusammen zu bringen. Wo könnten weiterhin Probleme bei der Entwicklung auftreten? Wie beugt man diesen vor? Competitors: keine Competitor Analyse. Wo ist die Nische? Wie will man sich von der Konkurenz absetzen? Was macht diese App speziell? Reiseplanner Apps gibt es zahlreich, was macht diese einzigartig? Commercial: sehr vage Andeutungen, wie man die App gewinnbringend gestaltet. Wo bleibt das ROI? Wie sieht dieses aus? Plant man eventuell weitere Produkte? Wo sind die Möglichkeiten die App finanziell gewinnbringend zu gestalten? Wie macht die App letzten Endes Profit? Die Präsentation geht darauf gar nicht ein. Für mich fehlt der revolutionäre Character. Warum brauchen wir diese App, wenn sie für Investoren keinen Gewinn erzielt? Es muss deutlich explizierter darauf eingegangen werden, wie kommerziell diese App gestaltet werden kann."

gpt2_pipe = pipeline("text-generation", model = "gpt2-v1/")

def load_data_from_file(file_name):
    with open(file_name + ".json", "r") as f:
        return json.loads(f.read(), object_hook = lambda d: SimpleNamespace(**d))

def save_data_to_file(file_name, data):
    with open(file_name + ".json", "w") as f:
        f.write(json.dumps(data, default=lambda o: o.__dict__, indent=4))

def remove_prefix(text, prefix):
    if text.startswith(prefix):
        return text[len(prefix):]
    return text

def predict_text(initial_text, num_of_words):
    global gpt2_pipe
    result = str(gpt2_pipe(initial_text, max_length = num_of_words)[0]["generated_text"])
    result = remove_prefix(result, initial_text)
    return result

@app.route('/')
def home():
    return redirect(url_for('static', filename='index.html'))

def find_result(text):
    global gpt2_pipe
    use_text = text + " "
    text_to_use_words = [word for word in use_text.split(" ") if word != ""]
    if len(text_to_use_words) > 20:
        text_to_use_words = text_to_use_words[-19:]
    text_to_use = " ".join(text_to_use_words)
    result = predict_text(text_to_use, 60 if (len(text_to_use_words) >= 18) else 40)
    words = [word for word in result.split(" ") if word != ""]
    if len(words) == 0:
        return ""
    if len(words) == 1:
        return words[0]
    response = " ".join(words[:-1])
    return response

@app.route('/predict', methods=['GET'])
def predict():
    text = request.args.get('text').strip()
    result_1 = find_result(text)
    result_2 = find_result(text)
    result_3 = find_result(text)
    return jsonify({"suggestions": [result_1, result_2, result_3]})

@app.route('/predict_static', methods=['GET'])
def predict_static():
    global static_text
    length = len(request.args.get('text').strip())
    result_1 = find_result(static_text[: length])
    result_2 = find_result(static_text[: length])
    result_3 = find_result(static_text[: length])
    return jsonify({"suggestions": [result_1, result_2, result_3]})
    
@app.route('/submitReview', methods=['POST'])
def submit_review_text():
    review = request.json['review']
    suggestions = request.json['suggestions']
    username = request.json['username']
    lock.acquire()
    suggestions_data = load_data_from_file("suggestions")
    suggestions_data.append({"suggestions": suggestions, "username": username})
    save_data_to_file("suggestions", suggestions_data)
    reviews_data = load_data_from_file("reviews")
    reviews_data.append({"review": review, "username": username})
    save_data_to_file("reviews", reviews_data)
    keystrokes = request.json['keystrokes']
    keystrokes_data = load_data_from_file("keystrokes")
    keystrokes_data.append({"keystrokes": keystrokes, "username": username})
    save_data_to_file("keystrokes", keystrokes_data)
    lock.release()
    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5003, debug=True)