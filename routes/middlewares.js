function requiereSesion(sesion, res) {
  if (!sesion) {
    res.writeHead(302, { Location: "/" });
    res.end();
    return false;
  }

  return true;
}

function requiereSupervisor(sesion, res) {
  if (!sesion || sesion.rol !== "supervisor") {
    res.writeHead(302, { Location: "/" });
    res.end();
    return false;
  }

  return true;
}

function requiereGestor(sesion, res) {
  if (!sesion || sesion.rol !== "gestor") {
    res.writeHead(302, { Location: "/" });
    res.end();
    return false;
  }

  return true;
}

module.exports = {
  requiereSesion,
  requiereSupervisor,
  requiereGestor
};

