const estilos = `
<style>
  body {
    font-family: Arial, sans-serif;
    background: linear-gradient(135deg, #eaf3ff, #ffffff);
    margin: 0;
    color: #1f2937;
  }

  .login-body {
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background: linear-gradient(135deg, #005baa, #ffffff);
  }

  .login-card {
    background: white;
    width: 370px;
    padding: 30px;
    border-radius: 22px;
    box-shadow: 0 15px 35px rgba(0,0,0,0.18);
    text-align: center;
  }

  .logo {
    width: 95px;
    height: 95px;
    border-radius: 50%;
    margin: 0 auto 12px;
    background: radial-gradient(circle, #f5c542 0%, #d9a51e 45%, #005baa 46%, #005baa 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    font-weight: bold;
    font-size: 28px;
    border: 5px solid white;
    box-shadow: 0 4px 14px rgba(0,0,0,0.2);
  }

  .marca { color: #005baa; margin-bottom: 3px; }
  .submarca { color: #555; font-size: 14px; margin-bottom: 25px; }

  header {
    background: #005baa;
    color: white;
    padding: 22px;
    text-align: center;
    border-bottom: 6px solid #f5c542;
  }

  header h1 { margin: 0; }

  .contenedor {
    max-width: 1050px;
    margin: 30px auto;
    padding: 20px;
  }

  form, .card, .panel {
    background: white;
    padding: 22px;
    border-radius: 16px;
    margin-bottom: 18px;
    box-shadow: 0 5px 16px rgba(0,0,0,0.08);
  }

  label {
    color: #005baa;
    font-weight: bold;
  }

  input, select, textarea {
    width: 100%;
    padding: 12px;
    margin: 8px 0 16px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    font-size: 15px;
    box-sizing: border-box;
  }

  textarea { height: 105px; }

  button, .btn {
    background: #005baa;
    color: white;
    padding: 12px 14px;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    cursor: pointer;
    font-weight: bold;
    text-decoration: none;
    display: inline-block;
    text-align: center;
  }

  button:hover, .btn:hover { background: #003f7d; }

  .btn-danger { background: #dc2626; }
  .btn-danger:hover { background: #991b1b; }

  .btn-warning {
    background: #f5c542;
    color: #1f2937;
  }

  .btn-warning:hover { background: #d9a51e; }

  .btn-success {
    background: #16a34a;
  }

  .btn-success:hover {
    background: #15803d;
  }

  .card { border-left: 6px solid #005baa; }

  .fecha {
    color: #64748b;
    font-size: 13px;
  }

  h2, h3 { color: #005baa; }

  a {
    color: #005baa;
    font-weight: bold;
  }

  .cerrar {
    display: inline-block;
    margin-top: 15px;
  }

  .foto {
    width: 100%;
    max-width: 340px;
    border-radius: 12px;
    margin-top: 10px;
    border: 1px solid #ddd;
  }

  .filtros {
    border-top: 6px solid #f5c542;
  }

  .grid-filtros {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
  }

  .botones {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .botones a, .botones button, .botones form {
    flex: 1;
  }

  .contador {
    background: #005baa;
    color: white;
    padding: 12px;
    border-radius: 12px;
    margin-bottom: 15px;
    font-weight: bold;
  }

  .dashboard {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    margin-bottom: 18px;
  }

  .metric {
    background: #eaf3ff;
    border-left: 6px solid #005baa;
    padding: 15px;
    border-radius: 12px;
  }

  .metric strong {
    font-size: 24px;
    color: #005baa;
  }

  .turno-card {
    background: #f8fafc;
    border-left: 5px solid #22c55e;
    padding: 12px;
    border-radius: 12px;
    margin-bottom: 10px;
  }

  .estado-activo {
    color: #16a34a;
    font-weight: bold;
  }

  .estado-revisada {
    color: #2563eb;
    font-weight: bold;
  }

  .alerta-roja {
    border-left: 6px solid #dc2626 !important;
    background: #fee2e2;
  }

  .alerta-amarilla {
    border-left: 6px solid #f59e0b !important;
    background: #fef3c7;
  }

  .etiqueta {
    font-weight: bold;
    margin-bottom: 8px;
  }

  /* ── Estilos para el spinner de ubicación ── */
  .btn-ubicacion {
    background: #005baa;
    color: white;
    padding: 12px 14px;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    cursor: pointer;
    font-weight: bold;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .btn-ubicacion:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }

  .spinner {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 3px solid rgba(255,255,255,0.4);
    border-top-color: white;
    border-radius: 50%;
    animation: girar 0.8s linear infinite;
  }

  @keyframes girar {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 700px) {
    .grid-filtros, .dashboard {
      grid-template-columns: 1fr;
    }

    .login-card {
      width: 85%;
    }

    .botones {
      flex-direction: column;
    }
  }

  @media print {
    button, .cerrar, .no-print {
      display: none !important;
    }
  }
</style>
`;

function vistaErrorLogin(estilos) {
  return `
<html><head>${estilos}</head>
<body class="login-body">
  <div class="login-card">
    <div class="logo">CF</div>
    <h1 class="marca">Datos incorrectos ❌</h1>
    <p>Usuario o clave incorrecta.</p>
    <a href="/">Volver</a>
  </div>
</body></html>
`;
}

function vistaLogin(estilos) {
  return `
<html>
<head>
  <title>Login Minuta Consotá</title>
  ${estilos}
</head>
<body class="login-body">
  <form class="login-card" method="POST">
    <div class="logo">CF</div>
    <h1 class="marca">Minuta Consotá</h1>
    <div class="submarca">Comfamiliar Risaralda</div>
    <input type="hidden" name="accion" value="login">
    <label>Usuario</label>
    <input name="usuario" required placeholder="Ej: jaider">
    <label>Contraseña</label>
    <input name="clave" type="password" required placeholder="Ingresa tu clave">
    <button type="submit">Ingresar</button>
  </form>
</body>
</html>
`;
}

module.exports = {
  estilos,
  vistaErrorLogin,
  vistaLogin
};