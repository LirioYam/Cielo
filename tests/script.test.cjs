// Pruebas sin librerías externas: ejecutar con node --test tests/script.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const carpeta = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(carpeta, "index.html"), "utf8");
const codigo = fs.readFileSync(path.join(carpeta, "script.js"), "utf8");
const ciudad = { name: "Mérida", country: "México", latitude: 20.967, longitude: -89.62318 };
const clima = {
  temperature_2m: 0,
  apparent_temperature: 0,
  relative_humidity_2m: 0,
  wind_speed_10m: 0,
  weather_code: 0
};

function respuesta(datos, status = 200) {
  return { status, ok: status >= 200 && status < 300, json: async () => datos };
}

function geocodificacion() {
  return respuesta({ results: [ciudad] });
}

function meteorologia() {
  return respuesta({ current: clima });
}

// Simula solamente el DOM, fetch y el reloj. Ejecuta el script real de Cielo.
function crearAplicacion(respuestas = [], enLinea = true) {
  const elementos = {};
  for (const etiqueta of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const clases = new Set();
    let texto = "";
    elementos[etiqueta[1]] = {
      hidden: /\shidden(?:\s|>)/.test(etiqueta[0]),
      disabled: false,
      value: "",
      atributos: {},
      get textContent() { return texto; },
      set textContent(valor) { texto = String(valor); },
      classList: {
        toggle(nombre, activa) { activa ? clases.add(nombre) : clases.delete(nombre); },
        contains(nombre) { return clases.has(nombre); }
      },
      setAttribute(nombre, valor) { this.atributos[nombre] = String(valor); },
      removeAttribute(nombre) { delete this.atributos[nombre]; },
      focus() { this.enfocado = true; },
      addEventListener(tipo, funcion) { this.enviar = funcion; }
    };
  }

  const peticiones = [];
  const temporizadores = new Map();
  let numeroTemporizador = 0;
  const contexto = vm.createContext({
    document: { getElementById(id) { assert.ok(elementos[id], `Falta el elemento ${id}`); return elementos[id]; } },
    navigator: { onLine: enLinea },
    URLSearchParams,
    AbortController,
    setTimeout(funcion, milisegundos) {
      temporizadores.set(++numeroTemporizador, { funcion, milisegundos });
      return numeroTemporizador;
    },
    clearTimeout(id) { temporizadores.delete(id); },
    async fetch(url, opciones) {
      peticiones.push({ url, opciones });
      const siguiente = respuestas.shift();
      if (siguiente instanceof Error) throw siguiente;
      assert.ok(siguiente, "No se esperaba otra petición");
      return typeof siguiente === "function" ? siguiente(url, opciones) : siguiente;
    }
  });
  vm.runInContext(codigo, contexto);

  return {
    elementos, peticiones, temporizadores,
    enviar() {
      let evitada = false;
      const proceso = elementos["formulario-clima"].enviar({ preventDefault() { evitada = true; } });
      assert.ok(evitada, "El formulario no debe recargar la página");
      return proceso;
    },
    buscar(nombre = "Mérida") {
      elementos.ciudad.value = nombre;
      return this.enviar();
    },
    vencerTiempo() {
      assert.equal(temporizadores.size, 1);
      const temporizador = [...temporizadores.values()][0];
      assert.equal(temporizador.milisegundos, 10000);
      temporizador.funcion();
    }
  };
}

function comprobarReposo(app) {
  assert.equal(app.elementos["boton-consultar"].disabled, false);
  assert.equal(app.elementos.ciudad.disabled, false);
  assert.equal(app.elementos["indicador-carga"].hidden, true);
  assert.notEqual(app.elementos["datos-clima"].atributos["aria-busy"], "true");
  assert.equal(app.temporizadores.size, 0, "No deben quedar temporizadores pendientes");
}

function comprobarError(app, esperado) {
  assert.match(app.elementos.mensaje.textContent, esperado);
  assert.equal(app.elementos.mensaje.classList.contains("es-error"), true);
  assert.equal(app.elementos["datos-clima"].hidden, true);
  comprobarReposo(app);
}

test("Un campo vacío o con espacios no hace peticiones y recibe el foco", async () => {
  for (const nombre of ["", "   "]) {
    const app = crearAplicacion();
    await app.buscar(nombre);
    comprobarError(app, /Escribe el nombre/);
    assert.equal(app.peticiones.length, 0);
    assert.equal(app.elementos.ciudad.enfocado, true);
    assert.equal(app.elementos.ciudad.atributos["aria-invalid"], "true");
  }
});

test("Una ciudad inexistente no consulta la API meteorológica", async () => {
  for (const datos of [{ results: [] }, { generationtime_ms: 0.1 }]) {
    const app = crearAplicacion([respuesta(datos)]);
    await app.buscar("ciudadinexistente");
    comprobarError(app, /No encontramos esa ciudad/);
    assert.equal(app.peticiones.length, 1);
  }
});

test("Sin conexión detectada por el navegador no se inicia fetch", async () => {
  const app = crearAplicacion([], false);
  await app.buscar();
  comprobarError(app, /conexión a Internet/);
  assert.equal(app.peticiones.length, 0);
});

const casos = [
  ["HTTP 429", () => respuesta({}, 429), /límite de consultas/],
  ["HTTP 400", () => respuesta({}, 400), /no pudo procesar/],
  ["HTTP 408", () => respuesta({}, 408), /tardó demasiado/],
  ["HTTP 500", () => respuesta({}, 500), /no está disponible/],
  ["HTTP 503", () => respuesta({}, 503), /no está disponible/],
  ["HTTP 504", () => respuesta({}, 504), /tardó demasiado/],
  ["HTTP 204 sin contenido", () => respuesta(null, 204), /datos completos/],
  ["Objeto vacío", () => respuesta({}), /datos completos/],
  ["Respuesta nula", () => respuesta(null), /datos completos/],
  ["JSON con formato incorrecto", () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("Invalid JSON"); } }), /no pudimos interpretar/],
  ["Respuesta con tipo incorrecto", () => respuesta("texto inesperado"), /no pudimos interpretar/],
  ["Error declarado por la API", () => respuesta({ error: true, reason: "detalle técnico privado" }), /no pudo procesar/],
  ["Conexión interrumpida", () => new TypeError("Failed to fetch"), /conexión a Internet/]
];

// Cada fallo se prueba tanto en geocodificación como en meteorología.
for (const [nombre, crearRespuesta, esperado] of casos) {
  for (const etapa of ["geocodificación", "meteorología"]) {
    test(`${nombre} en ${etapa}: mensaje claro y formulario recuperado`, async () => {
      const respuestas = etapa === "meteorología" ? [geocodificacion()] : [];
      respuestas.push(crearRespuesta());
      const app = crearAplicacion(respuestas);
      await app.buscar();
      comprobarError(app, esperado);
      assert.doesNotMatch(app.elementos.mensaje.textContent, /detalle técnico privado|Failed to fetch|Invalid JSON/);
    });
  }
}

test("Una ciudad sin coordenadas no provoca una consulta inválida", async () => {
  const app = crearAplicacion([respuesta({ results: [{ name: "Mérida" }] })]);
  await app.buscar();
  comprobarError(app, /datos completos/);
  assert.equal(app.peticiones.length, 1);
});

test("Un results incorrecto no se confunde con ciudad inexistente", async () => {
  const app = crearAplicacion([respuesta({ results: "incorrecto" })]);
  await app.buscar();
  comprobarError(app, /no pudimos interpretar/);
});

test("El clima ausente, incompleto o con valores nulos no se muestra", async () => {
  for (const datos of [{ latitude: 20 }, { current: null }, { current: { ...clima, temperature_2m: null } }]) {
    const app = crearAplicacion([geocodificacion(), respuesta(datos)]);
    await app.buscar();
    comprobarError(app, /datos completos/);
  }
});

test("La carga se mantiene entre las dos APIs y bloquea envíos repetidos", async () => {
  let liberarCiudad;
  let liberarClima;
  const primera = new Promise(resolve => { liberarCiudad = resolve; });
  const segunda = new Promise(resolve => { liberarClima = resolve; });
  const app = crearAplicacion([() => primera, () => segunda]);
  const proceso = app.buscar();
  assert.equal(app.elementos["indicador-carga"].hidden, false);
  assert.equal(app.elementos["boton-consultar"].disabled, true);
  assert.equal(app.elementos.ciudad.disabled, true);
  assert.equal(app.elementos["texto-boton"].textContent, "Consultando…");
  await app.enviar();
  await app.enviar();
  assert.equal(app.peticiones.length, 1);
  liberarCiudad(geocodificacion());
  await avanzarHasta(() => app.peticiones.length === 2);
  assert.equal(app.elementos["indicador-carga"].hidden, false);
  await app.enviar();
  assert.equal(app.peticiones.length, 2);
  liberarClima(meteorologia());
  await proceso;
  assert.equal(app.elementos["datos-clima"].hidden, false);
  assert.equal(app.elementos.temperatura.textContent, "0", "Cero es una temperatura válida");
  assert.equal(app.elementos["texto-boton"].textContent, "Consultar clima");
  comprobarReposo(app);
});

// Avanza las promesas sin esperar segundos reales ni usar la red.
async function avanzarHasta(condicion) {
  for (let paso = 0; paso < 30; paso++) {
    if (condicion()) return;
    await Promise.resolve();
  }
  assert.fail("La petición no llegó al estado esperado");
}

function esperarCancelacion(signal) {
  return new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Cancelado", "AbortError")), { once: true });
  });
}

for (const etapa of ["geocodificación", "meteorología"]) {
  for (const fase of ["cabeceras", "JSON"]) {
    test(`Tiempo límite durante ${fase} de ${etapa}: cancela y permite reintentar`, async () => {
      let leyendoJson = false;
      const pendiente = (url, { signal }) => fase === "cabeceras"
        ? esperarCancelacion(signal)
        : { ok: true, status: 200, json() { leyendoJson = true; return esperarCancelacion(signal); } };
      const respuestas = etapa === "meteorología" ? [geocodificacion()] : [];
      respuestas.push(pendiente, geocodificacion(), meteorologia());
      const app = crearAplicacion(respuestas);
      const proceso = app.buscar();
      const cantidad = etapa === "meteorología" ? 2 : 1;
      await avanzarHasta(() => app.peticiones.length === cantidad && (fase !== "JSON" || leyendoJson));
      app.vencerTiempo();
      await proceso;
      comprobarError(app, /tardó demasiado/);
      assert.equal(app.peticiones[cantidad - 1].opciones.signal.aborted, true);
      await app.buscar("Mérida");
      assert.equal(app.elementos.mensaje.textContent, "Consulta completada.");
      assert.equal(app.elementos.mensaje.classList.contains("es-error"), false);
      assert.equal(app.elementos["datos-clima"].hidden, false);
      comprobarReposo(app);
    });
  }
}
