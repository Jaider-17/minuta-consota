function manejarLogin(req, res, { usuarios, sesiones, enviarHTML, vistaErrorLogin, estilos, crypto }) {
    
    let datos = "";

    req.on("data", parte => datos += parte);

    req.on("end", () => {
        const form = new URLSearchParams(datos);
        const usuario = (form.get("usuario") || "").toLowerCase();
        const clave = form.get("clave");

        if (!usuarios[usuario] || usuarios[usuario].clave !== clave) {
            enviarHTML(res, vistaErrorLogin(estilos));
            return;
        }

        const id = crypto.randomBytes(16).toString("hex");

        sesiones[id] = {
            usuario,
            nombre: usuarios[usuario].nombre,
            rol: usuarios[usuario].rol
        };

        res.writeHead(302, {
            "Set-Cookie": `sessionId=${id}; HttpOnly; Path=/`,
            Location: "/app"
        });

        res.end();
    });
}

module.exports = {
    manejarLogin
};
