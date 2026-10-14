
//-----------------------Variables globals

let arrayPreguntas = [];
let sessionId = null;

let NPREG = 10;
let temps_Max = 30;
let segons = temps_Max;
let intevalTemps = null;
let partidaAcabada = false;
let respostesEnviades = false;
let preguntaActual = 0;


//------------------------Funcions 

function iniciarPartida(preguntes) {
    let htmlStr = ""
    for (let i = 0; i < preguntes.length; i++) {
        htmlStr += `
            <div id="preg_${i}" class="hidden">
                <p class="fw-bold text-center">${preguntes[i].pregunta}</p>
                <img class="d-block mx-auto mb-3" width="150" src="${preguntes[i].imatge}">
                <div class="d-grid gap-2">
                    <button data-id-preg="${i}" data-id-resp="0" id="${i}_0" class="btnRespuesta btn btn-outline-success">${preguntes[i].respostes[0].resposta}</button>
                    <button data-id-preg="${i}" data-id-resp="1" id="${i}_1" class="btnRespuesta btn btn-outline-success">${preguntes[i].respostes[1].resposta}</button>
                    <button data-id-preg="${i}" data-id-resp="2" id="${i}_2" class="btnRespuesta btn btn-outline-success">${preguntes[i].respostes[2].resposta}</button>
                    <button data-id-preg="${i}" data-id-resp="3" id="${i}_3" class="btnRespuesta btn btn-outline-success">${preguntes[i].respostes[3].resposta}</button>
                </div>
            </div>`
    }

    document.getElementById("partida").innerHTML = htmlStr;
    document.getElementById("totalPreguntes").textContent = preguntes.length;

    document.getElementById("partida").addEventListener("click", function (e) {
        if (e.target.classList.contains("btnRespuesta")) {
            marcar(e.target.dataset.idPreg, e.target.dataset.idResp);
        }
    });

    mostrarPregunta(0);
}

function mostrarPregunta(n) {
    //amaguem totes les preguntes
    for (let i = 0; i < arrayPreguntas.length; i++) {
        document.getElementById(`preg_${i}`).classList.add("hidden");
    }

    //mostrem només la pregunta n
    document.getElementById(`preg_${n}`).classList.remove("hidden");
    preguntaActual = n;

    document.getElementById("numPregunta").textContent = n + 1;
    document.getElementById("btnAnterior").disabled = (n == 0);
    document.getElementById("btnSeguent").disabled = (n == arrayPreguntas.length - 1);
}

let estatDeLaPartida = {
    contadorPreguntes: 0,
    respostesUsuari: []
};

estatDeLaPartida.respostesUsuari = new Array(NPREG).fill(null);

function marcar(preg, resp) {
    if (partidaAcabada) {
        return;
    }
    console.log("En la pregunta " + preg + " has marcado " + resp);

    // desmarco totes les respostes d'aquesta pregunta
    for (let j = 0; j < 4; j++) {
        document.getElementById(`${preg}_${j}`).classList.remove("btn-primary");
        document.getElementById(`${preg}_${j}`).classList.add("btn-outline-success");
    }

    // marco la resposta escollida
    document.getElementById(`${preg}_${resp}`).classList.add("btn-primary");
    document.getElementById(`${preg}_${resp}`).classList.remove("btn-outline-success");

    if (estatDeLaPartida.respostesUsuari[preg] == null) {
        estatDeLaPartida.contadorPreguntes++;
    }

    estatDeLaPartida.respostesUsuari[preg] = {
        id: arrayPreguntas[preg].id,
        resp: resp
    };

    if (estatDeLaPartida.contadorPreguntes == NPREG) {
        document.getElementById("marcador").classList.add("hidden");
        document.getElementById("btnEnviar").classList.remove("hidden");
        pararTemps();
    }

    // actualitzem el marcador
    renderMarcador();


}

function renderMarcador() {
    let pctActual = (estatDeLaPartida.contadorPreguntes / NPREG) * 100;
    document.getElementById("marcador").innerHTML = `
        <div class="progress">
            <div class="progress-bar" role="progressbar"
                style="width: ${pctActual}%"
                aria-valuenow="${pctActual}"
                aria-valuemin="0"
                aria-valuemax="100">
            </div>
        </div>`;
}

function enviarRespostes() {
    if (respostesEnviades) {
        return;
    }
    respostesEnviades = true;
    partidaAcabada = true;
    pararTemps();
    document.getElementById("btnEnviar").classList.add("hidden");

    fetch('/respostes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId: sessionId,
            respostes: estatDeLaPartida.respostesUsuari
        })
    })
        .then(resposta => resposta.json())
        .then(dades => {
            if (dades.error) {
                alert("ERROR: " + dades.error);
            } else {
                mostrarResultat(dades.encerts, dades.total);
            }
        })
        .catch(error => {
            alert("No s'ha pogut enviar: " + error);
        });
}

function mostrarResultat(encerts, total) {
    alert("Has encertat " + encerts + " de " + total + " preguntes!");
}

function iniciarTemps() {
    document.getElementById("temps").textContent = segons;

    intevalTemps = setInterval(function () {
        segons--;
        document.getElementById("temps").textContent = segons;

        if (segons <= 0) {
            pararTemps();
            finalitzarPartida();
        }
    }, 1000);
}

function pararTemps() {
    clearInterval(intevalTemps);
}

function finalitzarPartida() {
    partidaAcabada = true;
    document.getElementById("missatge").textContent = "Temps esgotat!";
    document.getElementById("marcador").classList.add("hidden")
    document.getElementById("btnEnviar").classList.remove("hidden");
    alert("temps Esgotat! Prem 'Enviar Respostes' per completar el teu intent.");
}

//------------------------Main

function carregarPartida() {
    fetch('/json1')
        .then(json1 => json1.json())
        .then(json1 => {
            console.log("Dades Carregades", json1);
            sessionId = json1.sessionId;
            arrayPreguntas = json1.preguntes;
            iniciarPartida(json1.preguntes);
            iniciarTemps()

        });
}

function iniciarSessio() {
    let nom = localStorage.getItem("nomJugador");

    if (nom) {
        document.getElementById("nomJugador").textContent = nom;

        document.getElementById("zonaJoc").classList.remove("hidden");

        carregarPartida();
    } else {
        document.getElementById("zonaLogin").classList.remove("hidden");
    }
}



//-------------------------Usuari (localStoratge)

document.getElementById("formNom").addEventListener("submit", function (e) {
    e.preventDefault();
    let nom = document.getElementById("inputNom").value.trim();

    if (nom != "") {
        localStorage.setItem("nomJugador", nom);
        location.reload();
    }
    console.log("Nom Jogador Guardat:", nom);

});
document.getElementById("btnEsborrarNom").addEventListener("click", function () {
    localStorage.removeItem("nomJugador");
    location.reload();
});

document.getElementById("btnAnterior").addEventListener("click", function () {
    if (preguntaActual > 0) {
        mostrarPregunta(preguntaActual - 1);
    }
});
document.getElementById("btnSeguent").addEventListener("click", function () {
    if (preguntaActual < arrayPreguntas.length - 1) {
        mostrarPregunta(preguntaActual + 1);
    }
});

iniciarSessio();