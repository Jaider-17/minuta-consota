function obtenerRangoQuincenaActual() {
  const ahoraColombia = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Bogota" })
  );

  const año = ahoraColombia.getFullYear();
  const mes = ahoraColombia.getMonth();
  const dia = ahoraColombia.getDate();

  let inicio;
  let fin;

  if (dia <= 15) {
    inicio = new Date(año, mes, 1, 0, 0, 0);
    fin = new Date(año, mes, 15, 23, 59, 59);
  } else {
    inicio = new Date(año, mes, 16, 0, 0, 0);
    fin = new Date(año, mes + 1, 0, 23, 59, 59);
  }

  return { inicio, fin };
}

function formatearFecha(fecha) {
  return fecha.toLocaleDateString("en-CA", {
    timeZone: "America/Bogota"
  });
}

async function calcularControlHoras(db, usuarios) {
  const { inicio, fin } = obtenerRangoQuincenaActual();

  const fechaInicio = formatearFecha(inicio);
  const fechaFin = formatearFecha(fin);

  const gestores = Object.entries(usuarios)
    .filter(([usuario, datos]) => datos.rol === "gestor");

  const resultado = [];

  for (const [usuario, datos] of gestores) {
    const turnos = await db.collection("turnos").find({
      usuario,
      estado: "Cerrado",
      cerradoEn: {
        $gte: inicio,
        $lte: fin
      }
    }).toArray();

    const horasTrabajadas = turnos.reduce((total, t) => {
      return total + Number(t.horasTrabajadas || 0);
    }, 0);

    const horasObjetivo = 42;
    const diferencia = Number((horasTrabajadas - horasObjetivo).toFixed(2));

    let estado = "Al día ✅";
    let clase = "estado-revisada";

    if (diferencia > 0) {
      estado = `Horas extra: +${diferencia} h`;
      clase = "estado-activo";
    }

    if (diferencia < 0) {
      estado = `Horas faltantes: ${Math.abs(diferencia)} h`;
      clase = "estado-pendiente";
    }

    resultado.push({
      usuario,
      gestor: datos.nombre,
      fechaInicio,
      fechaFin,
      horasObjetivo,
      horasTrabajadas: Number(horasTrabajadas.toFixed(2)),
      diferencia,
      estado,
      clase,
      totalTurnos: turnos.length
    });
  }

  return resultado;
}

function htmlControlHoras(controlHoras = []) {
  return `
    <div class="panel">
      <h2>🕒 Control de horas por quincena</h2>
      <p>
        Aquí puedes revisar las horas trabajadas, horas objetivo, extras o faltantes de cada gestor.
      </p>

      ${
        controlHoras.length === 0
          ? "<p>No hay gestores registrados.</p>"
          : controlHoras.map(h => `
            <details class="card">
              <summary style="cursor:pointer; font-size:18px; font-weight:bold; color:#005baa;">
                👤 ${h.gestor} ⬇
              </summary>

              <div style="margin-top:15px;">
                <p><b>Periodo:</b> ${h.fechaInicio} a ${h.fechaFin}</p>
                <p><b>Horas objetivo:</b> ${h.horasObjetivo} h</p>
                <p><b>Horas trabajadas:</b> ${h.horasTrabajadas} h</p>
                <p><b>Diferencia:</b> ${h.diferencia} h</p>
                <p><b>Turnos cerrados:</b> ${h.totalTurnos}</p>
                <p><b>Estado:</b> <span class="${h.clase}">${h.estado}</span></p>

                <div class="botones no-print" style="margin-top:10px;">
                  <button type="button" class="btn btn-warning">
                    📄 Ver detalle
                  </button>

                  <form method="POST" style="display:inline; box-shadow:none; padding:0; margin:0;">
                    <input type="hidden" name="accion" value="cerrar_quincena">
                    <input type="hidden" name="usuario" value="${h.usuario}">
                    <input type="hidden" name="fechaInicio" value="${h.fechaInicio}">
                    <input type="hidden" name="fechaFin" value="${h.fechaFin}">
                    <input type="hidden" name="horasObjetivo" value="${h.horasObjetivo}">
                    <input type="hidden" name="horasTrabajadas" value="${h.horasTrabajadas}">
                    <input type="hidden" name="diferencia" value="${h.diferencia}">
                    <button class="btn-danger" type="submit" onclick="return confirm('¿Cerrar quincena de ${h.gestor}?');">
                      🔒 Cerrar quincena
                    </button>
                  </form>
                </div>
              </div>
            </details>
          `).join("")
      }
    </div>
  `;
}

module.exports = {
  calcularControlHoras,
  htmlControlHoras
};
