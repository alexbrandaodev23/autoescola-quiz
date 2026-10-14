//-----------------variables globals

let arrayPreguntes = [];
let idEditant = null;
let imatgeEditant = null;


//------------------------Funcions

function carregarPreguntes() {
    fetch('/preguntes')
        .then(function (resposta) {
            return resposta.json();
        })
        .then(function (dades) {
            arrayPreguntes = dades;
            pintarLlista();
        });
}

function pintarLlista() {
    let htmlStr = "";

    for (let i = 0; i < arrayPreguntes.length; i++) {
        const preg = arrayPreguntes[i];

        // si la pregunta té imatge, preparem l'etiqueta img; si no, queda buida
        let imgStr = "";
        if (preg.imatge) {
            imgStr = `<img src="${preg.imatge}" width="80" class="me-3">`;
        }

        // llista de respostes, amb la correcta en verd i amb una marca
        let respostesStr = "";
        for (let j = 0; j < preg.respostes.length; j++) {
            if (preg.respostes[j].correcta) {
                respostesStr += `<li class="text-success fw-bold">${preg.respostes[j].resposta} [correcto]</li>`;
            } else {
                respostesStr += `<li>${preg.respostes[j].resposta}</li>`;
            }
        }

        htmlStr += `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="d-flex">
                        ${imgStr}
                        <div>
                            <p class="fw-bold mb-1">${preg.pregunta}</p>
                            <ul class="mb-2">${respostesStr}</ul>
                        </div>
                    </div>
                    <button data-id="${preg.id}" class="btnModificar btn btn-sm btn-outline-primary">Modificar</button>
                    <button data-id="${preg.id}" class="btnEliminar btn btn-sm btn-outline-danger">Eliminar</button>
                </div>
            </div>`;
    }

    document.getElementById("llista").innerHTML = htmlStr;
}

function mostrarMissatge(text) {
    document.getElementById("missatgeAdmin").textContent = text;
}

function eliminarPregunta(id) {
    if (!confirm("Segur que vols eliminar aquesta pregunta?")) {
        return;
    }

    fetch('/preguntes/' + id, { method: 'DELETE' })
        .then(function (resposta) {
            return resposta.json();
        })
        .then(function (dades) {
            if (dades.error) {
                mostrarMissatge("Error: " + dades.error);
            } else {
                mostrarMissatge("Pregunta eliminada");
                if (idEditant == id) {
                    cancelarEdicio();
                }
                carregarPreguntes();
            }
        })
        .catch(function (error) {
            mostrarMissatge("No s'ha pogut eliminar: " + error);
        });
}

function editarPregunta(id) {
    // busquem la pregunta dins de l'array
    let preg = null;
    for (let i = 0; i < arrayPreguntes.length; i++) {
        if (arrayPreguntes[i].id == id) {
            preg = arrayPreguntes[i];
        }
    }

    idEditant = preg.id;
    imatgeEditant = preg.imatge;

    // omplim el formulari amb les dades de la pregunta
    document.getElementById("titolForm").textContent = "Modificar pregunta";
    document.getElementById("inputPregunta").value = preg.pregunta;
    document.getElementById("inputImatge").value = "";

    if (preg.imatge) {
        document.getElementById("imatgeActual").textContent = "Imatge actual: " + preg.imatge + " (si no en tries una de nova, es manté)";
    } else {
        document.getElementById("imatgeActual").textContent = "Aquesta pregunta no té imatge";
    }

    const radios = document.getElementsByName("correcta");
    for (let j = 0; j < 4; j++) {
        document.getElementById("resp" + j).value = preg.respostes[j].resposta;
        radios[j].checked = preg.respostes[j].correcta;
    }

    document.getElementById("btnCancelar").classList.remove("hidden");
    window.scrollTo(0, 0);
}

function cancelarEdicio() {
    idEditant = null;
    imatgeEditant = null;

    document.getElementById("formPregunta").reset();
    document.getElementById("titolForm").textContent = "Nova pregunta";
    document.getElementById("imatgeActual").textContent = "";
    document.getElementById("btnCancelar").classList.add("hidden");
}

function guardarPregunta() {
    let pregunta = document.getElementById("inputPregunta").value.trim();

    if (pregunta == "") {
        mostrarMissatge("Escriu l'enunciat de la pregunta");
        return;
    }

    // mirem quin dels 4 radios està marcat
    const radios = document.getElementsByName("correcta");
    let correcta = 0;
    for (let j = 0; j < radios.length; j++) {
        if (radios[j].checked) {
            correcta = j;
        }
    }

    // preparem la llista de les 4 respostes
    let respostes = [];
    for (let j = 0; j < 4; j++) {
        respostes.push({
            resposta: document.getElementById("resp" + j).value.trim(),
            correcta: (j == correcta)
        });
    }

    // posem les dades dins del FormData
    const formData = new FormData();
    formData.append("pregunta", pregunta);
    formData.append("respostes", JSON.stringify(respostes));

    const fitxer = document.getElementById("inputImatge").files[0];
    if (fitxer) {
        formData.append("imatge", fitxer);
    }

    // per defecte creem (POST); si estem editant, modifiquem (PUT)
    let url = '/preguntes';
    let metode = 'POST';
    let text = "Pregunta afegida";

    if (idEditant != null) {
        url = '/preguntes/' + idEditant;
        metode = 'PUT';
        text = "Pregunta modificada";

        // si no han triat imatge nova, tornem a enviar l'actual perquè no es perdi
        if (!fitxer && imatgeEditant) {
            formData.append("imatge", imatgeEditant);
        }
    }

    fetch(url, {
        method: metode,
        body: formData
    })
        .then(function (resposta) {
            return resposta.json();
        })
        .then(function (dades) {
            if (dades.error) {
                mostrarMissatge("Error: " + dades.error);
            } else {
                mostrarMissatge(text);
                cancelarEdicio();
                carregarPreguntes();
            }
        })
        .catch(function (error) {
            mostrarMissatge("No s'ha pogut guardar: " + error);
        });
}


//------------------------Esdeveniments

// un sol listener al contenidor de la llista (delegació d'esdeveniments)
document.getElementById("llista").addEventListener("click", function (e) {
    if (e.target.classList.contains("btnEliminar")) {
        eliminarPregunta(e.target.dataset.id);
    }
    if (e.target.classList.contains("btnModificar")) {
        editarPregunta(e.target.dataset.id);
    }
});

document.getElementById("btnCancelar").addEventListener("click", function () {
    cancelarEdicio();
});

document.getElementById("formPregunta").addEventListener("submit", function (e) {
    e.preventDefault();
    guardarPregunta();
});


//------------------------Main

carregarPreguntes();