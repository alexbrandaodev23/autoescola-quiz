// Imports (require)
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const mysql = require('mysql');
const fs = require('fs');
const multer = require('multer');
const path = require('path');

// Configuració Express
const app = express();
const port = Number(process.env.PORT) || Number(process.argv[2]) || 20100;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
const sessions = new Map();

//Connexió amb la BBDD 
//Les credencials es llegeixen del fitxer .env (mai es pugen a GitHub)
const con = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  port: Number(process.env.DB_PORT) || 3306,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

//--Carpeta on guardem  les imatges pujades
const carpetaImatge = path.join(__dirname, 'public', 'images');

// configuració del multer: on i amb quin nom es guarda el fitxer
const storage = multer.diskStorage({
  destination: carpetaImatge,
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {fileSize: 2 *1024*1024},
  fileFilter: function(req, file, cb) {
    cb(null, file.mimetype.startsWith("image/"));
  }
});


//==============================================
//Transformacio de les files de la BBDD al format JSON original 

function transformacioPreguntes(result) {
  const preguntes = [];

  for (let i = 0; i < result.length; i++) {
    const fila = result[i];

    let preg = null;
    for (let j = 0; j < preguntes.length; j++) {
      if (preguntes[j].id == fila.id) {
        preg = preguntes[j];
      }
    }

    if (preg == null) {
      preg = {
        id: fila.id,
        pregunta: fila.pregunta,
        imatge: fila.imatge,
        respostes: []
      };
      preguntes.push(preg);
    }

    preg.respostes.push({
      id: fila.idResposta,
      resposta: fila.resposta,
      correcta: fila.resCorrecta == 1
    });
  }

  return preguntes;
}


//----------Rutas
//creamos una session con una preguntas aleatorias de forma única.
app.get('/json1', (req, res) => {

  const sql = "SELECT p.id, p.pregunta, p.imatge, r.id AS idResposta, r.resposta " +
    "FROM preguntes p JOIN respostes r ON r.pregunta_id = p.id " +
    "ORDER BY p.id, r.id";

  con.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "Error de la base de dades" });
      return;
    }

    //transformacio de files de la BBDD al format de client

    const totesPreguntes = [];

    for (let i = 0; i < result.length; i++) {
      const fila = result[i];

      //Busquem si la pregunta no está al array
      let preg = null;
      for (let j = 0; j < totesPreguntes.length; j++) {
        if (totesPreguntes[j].id == fila.id) {
          preg = totesPreguntes[j];
        }
      }


      //si no la tenim, la creem amb l'array de respostes buit
      if (preg == null) {
        preg = {
          id: fila.id,
          pregunta: fila.pregunta,
          imatge: fila.imatge,
          respostes: []
        };
        totesPreguntes.push(preg);
      }


      //afegim la resposta d'aquesta fila a la seva pregunta.

      preg.respostes.push({
        id: fila.idResposta,
        resposta: fila.resposta
      });
    }

    //Selecció Preguntes y sessió usuari.
    const sessionId = uuidv4();

    totesPreguntes.sort(() => Math.random() - 0.5);

    const seleccioPreguntes = [];
    for (let i = 0; i < 10 && i < totesPreguntes.length; i++) {
      seleccioPreguntes[i] = totesPreguntes[i]
    }
    //seleccionamos el id de las preguntas para asi poder guardar en la sessión las preguntas que ha hecho el usuario.

    const seleccioIdPreg = [];

    for (let i = 0; i < seleccioPreguntes.length; i++) {
      seleccioIdPreg[i] = seleccioPreguntes[i].id;
    }

    sessions.set(sessionId, { questions: seleccioIdPreg });

    if (sessions.has(sessionId)) {
      console.log("Sessió trobada:", sessions.get(sessionId));
    }
    //con esto vamos limitar que el front pueda ver las respuestas correctas de cada pregunta, evitando que vea información que no queremos que el cliente vea. 

    //enviar al client

    res.json({ sessionId: sessionId, preguntes: seleccioPreguntes });
  });
});


//--- Corregir: Les respostes de l'usuari i retorna quantes ha encertat
app.post('/respostes', (req, res) => {

  const sessionId = req.body.sessionId;
  const respostesUsuari = req.body.respostes;

  if (!sessionId || !respostesUsuari) {
    res.status(400).json({ error: "Falten dades: cal enviar sessionID i respostes" });
    return;
  }
  //busquem la sessió que vam crear a /json1
  const sessio = sessions.get(sessionId);

  if (!sessio) {
    res.status(404).json({ error: "Sessió no trobada" });
    return;
  }

  //-- agafem les respostes de les preguntes d'aquesta sessió, en el mateix ordre que al client.

  const sql = "SELECT pregunta_id, resCorrecta FROM respostes " +
    "WHERE pregunta_id IN (?) " +
    "ORDER BY pregunta_id, id";

  con.query(sql, [sessio.questions], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "Error de la base de dades" });
      return;
    }

    let encerts = 0;

    //- recorrem les preguntes de la sessió (així mai podem comptar més de 10)
    for (let i = 0; i < sessio.questions.length; i++) {
      const idPreg = sessio.questions[i];

      //busquem què ha respost l'usuari a aquesta pregunta
      let respostaUsuari = null;
      for (let j = 0; j < respostesUsuari.length; j++) {
        if (respostesUsuari[j] != null && respostesUsuari[j].id == idPreg) {
          respostaUsuari = respostesUsuari[j];
        }
      }

      if (respostaUsuari != null) {
        const respostesPreg = [];
        for (let j = 0; j < result.length; j++) {
          if (result[j].pregunta_id == idPreg) {
            respostesPreg.push(result[j]);
          }
        }
        //--la posició que ha marcat l'usuari és la correcta?
        const marcada = respostesPreg[respostaUsuari.resp];
        if (marcada != undefined && marcada.resCorrecta == 1) {
          encerts++;
        }
      }
    }

    //-- la sessió ja s'ha corregir: l'esborrem perquè no es pugui reenviar
    sessions.delete(sessionId);

    res.json({ encerts: encerts, total: sessio.questions.length })
  });
});
//Crud Preguntes

//--CONSULTA: totes les preguntes
app.get('/preguntes', (req, res) => {
  const sql = "SELECT p.id, p.pregunta, p.imatge, r.id AS idResposta, r.resposta, r.resCorrecta " +
    "FROM preguntes p JOIN respostes r ON r.pregunta_id = p.id " +
    "ORDER BY p.id, r.id";

  con.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "Error de la base de dades" });
      return;
    }

    res.json(transformacioPreguntes(result));
  });
});

//-- Consulta: una pregunta per el seu id
app.get('/preguntes/:id', (req, res) => {

  const id = req.params.id;

  const sql = "SELECT p.id, p.pregunta, p.imatge, r.id AS idResposta, r.resposta, r.resCorrecta " +
    "FROM preguntes p JOIN respostes r ON r.pregunta_id = p.id " +
    "WHERE p.id = ? " +
    "ORDER BY r.id";

  con.query(sql, [id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "Error de la base de dades" });
      return;
    }

    //si no hi ha cap fila la pregunta no existeix
    if (result.length == 0) {
      res.status(404).json({ error: "Pregunta no trobada" });
      return;
    }

    res.json(transformacioPreguntes(result)[0]);
  });
});

//-- Afegir: una nova pregunta amb noves respostes.
app.post('/preguntes', upload.single('imatge'), (req, res) => {

  const pregunta = req.body.pregunta;
  let respostaPregunta = req.body.respostes;

  //amb FormData les respostes arriben com a text: les convertim en una llista
  if (typeof respostaPregunta == "string") {
    try {
      respostaPregunta = JSON.parse(respostaPregunta);
    } catch (e) {
      res.status(400).json({ error: "El format de les respostes no és vàlid" });
      return;
    }
  }

  //si han pujat un fitxer guardem el seu path; si no, el valor que arribi (o null)
  let imatge = req.body.imatge || null;
  if (req.file) {
    imatge = "/images/" + req.file.filename;
  }


  //comprovem que ens han enviate les dades mínimes

  if (!pregunta || !respostaPregunta) {
    res.status(400).json({ error: "falten dades: cal enviar pregunta i respostes" });
    return;
  }
  if (respostaPregunta.length != 4) {
    res.status(400).json({ error: "Cal enviar exactament 4 respostes" });
    return;
  }

  //1. inserim pregunta (la id la posa Mysql)
  const sqlPregunta = "INSERT INTO preguntes (pregunta, imatge) VALUES (?, ?)";

  con.query(sqlPregunta, [pregunta, imatge], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "Error de la base de dades" });
      return;
    }

    //2. recuperem l'id que Mysql ha asignat a la pregunta
    const idNova = result.insertId;

    //3. Preparem totes les respostes per inserir-les de cop
    const valor = [];
    for (let i = 0; i < respostaPregunta.length; i++) {
      valor.push([idNova, respostaPregunta[i].resposta, respostaPregunta[i].correcta]);
    }

    const sqlRespostes = "INSERT INTO respostes (pregunta_id, resposta, resCorrecta) VALUES ?";

    con.query(sqlRespostes, [valor], (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: "Error de la base de dades" });
        return;
      }

      res.status(201).json({ missatge: "Pregunta afegida", id: idNova });
    });
  });
});

//Delete: eliminar una pregunta per el seu id

app.delete('/preguntes/:id', (req, res) => {

  const id = req.params.id;

  const sql = "DELETE FROM preguntes WHERE id = ?";

  con.query(sql, [id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "Error de la base de dades" });
      return;
    }

    //si no s'ha borrat cap fila, la pregunta no existeix

    if (result.affectedRows == 0) {
      res.status(404).json({ error: "Pregunta no trobada" });
      return;
    }

    res.json({ missatge: "Pregunta eliminada", id: id });
  });
});

//PUT: modificar una pregunta

app.put('/preguntes/:id', upload.single('imatge'), (req, res) => {
  const id = req.params.id;
  const pregunta = req.body.pregunta;
  let respostaPregunta = req.body.respostes;

  //amb FormData les respostes arriben com a text: les convertim en una llista
  if (typeof respostaPregunta == "string") {
    try {
      respostaPregunta = JSON.parse(respostaPregunta);
    } catch (e) {
      res.status(400).json({ error: "El format de les respostes no és vàlid" });
      return;
    }
  }

  //si pugen una imatge nova usem el seu path; si no, mantenim la que ens arribi
  let imatge = req.body.imatge || null;
  if (req.file) {
    imatge = "/images/" + req.file.filename;
  }
  //comprovem que ens han enviat les dades mínimes

  if (!pregunta || !respostaPregunta) {
    res.status(400).json({ error: "falten dades: cal enviar pregunta i respostes" });
    return;
  }

  if (respostaPregunta.length != 4) {
    res.status(400).json({ error: "Cal enviar exactament 4 respostes." });
    return;
  }

  //1. actualizem la pregunta
  const sqlPregunta = "UPDATE preguntes SET pregunta = ? , imatge = ? WHERE id = ?";

  con.query(sqlPregunta, [pregunta, imatge, id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "Error de la base de dades" });
      return;
    }

    //si no s'ha trobat cap fila existent, la pregunta no existeix
    if (result.affectedRows == 0) {
      res.status(404).json({ error: "Pregunta no trobada" });
      return;
    }
    //2. esborrem les respostes antigues d'aquesta pregunta
    const sqlEsborrar = "DELETE FROM respostes WHERE pregunta_id =?";

    con.query(sqlEsborrar, [id], (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: "Error de la base de dades" });
        return;
      }

      //3. preparem les noves preguntes
      const valor = [];
      for (let i = 0; i < respostaPregunta.length; i++) {
        valor.push([id, respostaPregunta[i].resposta, respostaPregunta[i].correcta]);
      }

      const sqlRespostes = "INSERT INTO respostes (pregunta_id, resposta, resCorrecta) VALUES ?";

      con.query(sqlRespostes, [valor], (err, result) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: "Error de la base de dades" });
          return;
        }

        res.json({ missatge: "Pregunta modificada", id: id });
      });
    });
  });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

