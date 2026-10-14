const mysql = require('mysql');
const dades = require('../data/preguntes.json');

//Les credencials es llegeixen del fitxer .env
const con = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    port: Number(process.env.DB_PORT) || 3306,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

con.connect(function (err) {
    if (err) throw err;
    console.log("Connectat a la Base de Dades");

    //--Buidem les taules de la bbdd per si executem l'script més d'un cop
    //--Les respostes s'esborren soles gràcies al ON DELETE CASCADE
    con.query("DELETE FROM preguntes", function (err, result) {
        if (err) throw err;
        console.log("Taules Buidades");
    });

    const preguntes = dades.preguntes;

    //--recorrem totes les preguntes del JSON
    for (let i = 0; i < preguntes.length; i++) {
        const preg = preguntes[i];

        //--inserim la pregunta mantenint el mateix id que té al JSON
        const sqlPregunta = "INSERT INTO preguntes (id, pregunta, imatge) VALUES (?, ?, ?)";
        con.query(sqlPregunta, [preg.id, preg.pregunta, preg.imatge], function (err, result) {
            if (err) throw err;
            console.log("Pregunta inserida: " + preg.id);
        });

        //--Inserim les respostes de la pregunta
        for (let x = 0; x < preg.respostes.length; x++) {
            const resp = preg.respostes[x];

            const sqlResposta = "INSERT INTO respostes (pregunta_id, resposta, resCorrecta) VALUES (?, ?, ?)";
            con.query(sqlResposta, [preg.id, resp.resposta, resp.correcta], function (err, result) {
                if (err) throw err;
            });
        }
    }

    //--Tanquem la connexió quan s'hagin executat totes les consultes
    con.end(function (err) {
        if (err) throw err;
        console.log("Migració acabada!");
    });
});