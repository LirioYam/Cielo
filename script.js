// Elementos de la página que utilizaremos para consultar y mostrar el clima.
const formulario = document.getElementById("formulario-clima");
const entradaCiudad = document.getElementById("ciudad");
const botonConsultar = document.getElementById("boton-consultar");
const mensaje = document.getElementById("mensaje");
const datosClima = document.getElementById("datos-clima");
const bienvenida = document.getElementById("bienvenida");
const indicadorCarga = document.getElementById("indicador-carga");
const textoBoton = document.getElementById("texto-boton");

const TIEMPO_LIMITE = 10000; // Diez segundos para cada petición, incluido el JSON.
const MENSAJES_ERROR = {
  conexion: "No pudimos conectarnos. Revisa tu conexión a Internet e intenta nuevamente.",
  tiempo: "La consulta tardó demasiado. Intenta de nuevo en unos momentos.",
  limite: "Se alcanzó el límite de consultas. Espera un momento antes de volver a intentarlo.",
  servidor: "El servicio del clima no está disponible por ahora. Intenta más tarde.",
  solicitud: "El servicio no pudo procesar la consulta. Intenta nuevamente más tarde.",
  sinDatos: "El servicio no devolvió datos completos para esta ciudad. Intenta nuevamente más tarde.",
  respuesta: "El servicio devolvió una respuesta que no pudimos interpretar. Intenta más tarde.",
  general: "No se pudo consultar el clima. Intenta nuevamente."
};

formulario.addEventListener("submit", consultarClima);

async function consultarClima(evento) {
  // Evita que el formulario recargue la página.
  evento.preventDefault();

  // Esperamos a que termine una consulta antes de empezar otra.
  if (botonConsultar.disabled) {
    return;
  }

  const nombre = entradaCiudad.value.trim();
  datosClima.hidden = true;
  bienvenida.hidden = false;
  entradaCiudad.removeAttribute("aria-invalid");

  if (nombre === "") {
    mostrarMensaje("Escribe el nombre de una ciudad para consultar su clima.", true);
    entradaCiudad.setAttribute("aria-invalid", "true");
    entradaCiudad.focus();
    return;
  }

  cambiarCarga(true);
  mostrarMensaje("Consultando el clima…");

  try {
    const ciudad = await buscarCiudad(nombre);

    if (!ciudad) {
      mostrarMensaje("No encontramos esa ciudad. Revisa el nombre o prueba con otra ciudad.", true);
      entradaCiudad.setAttribute("aria-invalid", "true");
      return;
    }

    const clima = await obtenerClima(ciudad);

    if (!clima) {
      throw new Error("sinDatos");
    }

    mostrarClima(ciudad, clima);
    mostrarMensaje("Consulta completada.");
  } catch (error) {
    // Mostramos nuestros mensajes, sin exponer detalles técnicos de la API.
    const tipoError = error && error.message;
    const texto = Object.hasOwn(MENSAJES_ERROR, tipoError)
      ? MENSAJES_ERROR[tipoError]
      : MENSAJES_ERROR.general;
    mostrarMensaje(texto, true);
  } finally {
    // Siempre permite una nueva búsqueda, incluso si hubo un error.
    cambiarCarga(false);
  }
}

function mostrarMensaje(texto, esError = false) {
  mensaje.textContent = texto;
  mensaje.classList.toggle("es-error", esError);
}

function cambiarCarga(activa) {
  indicadorCarga.hidden = !activa;
  botonConsultar.disabled = activa;
  entradaCiudad.disabled = activa;
  textoBoton.textContent = activa ? "Consultando…" : "Consultar clima";
  // El mensaje queda fuera del área ocupada para que se anuncie durante la carga.
  datosClima.setAttribute("aria-busy", String(activa));
}

// Ambas APIs comparten el tiempo límite y las comprobaciones de la respuesta.
async function solicitarDatos(url) {
  if (navigator.onLine === false) {
    throw new Error("conexion");
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_LIMITE);

  try {
    const respuesta = await fetch(url, { signal: controlador.signal });

    if (respuesta.status === 429) throw new Error("limite");
    if (respuesta.status === 408 || respuesta.status === 504) throw new Error("tiempo");
    if (respuesta.status >= 500) throw new Error("servidor");
    if (!respuesta.ok) throw new Error("solicitud");
    if (respuesta.status === 204) throw new Error("sinDatos");

    const datos = await respuesta.json();

    if (!datos || (typeof datos === "object" && Object.keys(datos).length === 0)) {
      throw new Error("sinDatos");
    }
    if (typeof datos !== "object" || Array.isArray(datos)) {
      throw new Error("respuesta");
    }
    if (datos.error) throw new Error("solicitud");

    return datos;
  } catch (error) {
    if (controlador.signal.aborted) throw new Error("tiempo");
    if (error && error.name === "TypeError") throw new Error("conexion");
    if (error && error.name === "SyntaxError") throw new Error("respuesta");
    throw error;
  } finally {
    // También se limpia el temporizador si el servidor o el JSON fallan.
    clearTimeout(temporizador);
  }
}

// Primera petición: convierte el nombre de la ciudad en coordenadas.
async function buscarCiudad(nombre) {
  const parametros = new URLSearchParams({
    name: nombre,
    count: "1",
    language: "es",
    format: "json"
  });

  const datos = await solicitarDatos(`https://geocoding-api.open-meteo.com/v1/search?${parametros}`);

  // Open-Meteo puede omitir results cuando no encuentra coincidencias.
  if (datos.results === undefined) {
    if (Number.isFinite(datos.generationtime_ms)) return null;
    throw new Error("sinDatos");
  }
  if (!Array.isArray(datos.results)) throw new Error("respuesta");
  if (datos.results.length === 0) return null;

  // Usamos la primera coincidencia de la API.
  const ciudad = datos.results[0];
  if (!ciudad || typeof ciudad.name !== "string" || ciudad.name.trim() === "") {
    throw new Error("sinDatos");
  }
  return ciudad;
}

// Segunda petición: utiliza las coordenadas para obtener el clima actual.
async function obtenerClima(ciudad) {
  if (!Number.isFinite(ciudad.latitude) || !Number.isFinite(ciudad.longitude)
      || Math.abs(ciudad.latitude) > 90 || Math.abs(ciudad.longitude) > 180) {
    return null;
  }

  const parametros = new URLSearchParams({
    latitude: ciudad.latitude,
    longitude: ciudad.longitude,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh"
  });

  const datos = await solicitarDatos(`https://api.open-meteo.com/v1/forecast?${parametros}`);
  const clima = datos.current;

  if (!clima) {
    return null;
  }

  // Evita mostrar valores vacíos o nulos como si fueran datos reales.
  const valores = [
    clima.temperature_2m,
    clima.apparent_temperature,
    clima.relative_humidity_2m,
    clima.wind_speed_10m,
    clima.weather_code
  ];

  if (!valores.every(Number.isFinite)) {
    return null;
  }

  return clima;
}

function mostrarClima(ciudad, clima) {
  document.getElementById("ciudad-resultado").textContent = ciudad.name;
  document.getElementById("pais-resultado").textContent = ciudad.country || "País no disponible";
  document.getElementById("temperatura").textContent = clima.temperature_2m;
  document.getElementById("sensacion").textContent = `${clima.apparent_temperature} °C`;
  document.getElementById("humedad").textContent = `${clima.relative_humidity_2m} %`;
  document.getElementById("viento").textContent = `${clima.wind_speed_10m} km/h`;
  document.getElementById("descripcion").textContent = describirClima(clima.weather_code);
  document.getElementById("icono-clima").setAttribute("href", `#${obtenerIconoClima(clima.weather_code)}`);
  bienvenida.hidden = true;
  datosClima.hidden = false;
}

// El icono acompaña al texto del clima; no necesita nuevas peticiones a la API.
function obtenerIconoClima(codigo) {
  if (codigo === 0 || codigo === 1) return "clima-sol";
  if (codigo === 3) return "clima-nube";
  if (codigo === 45 || codigo === 48) return "clima-niebla";
  if ([71, 73, 75, 77, 85, 86].includes(codigo)) return "clima-nieve";
  if ([95, 96, 97, 99].includes(codigo)) return "clima-tormenta";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(codigo)) return "clima-lluvia";
  return "clima-parcial";
}

// Open-Meteo devuelve un código numérico; lo traducimos a texto en español.
function describirClima(codigo) {
  const descripciones = {
    0: "Cielo despejado",
    1: "Mayormente despejado",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Niebla",
    48: "Niebla con escarcha",
    51: "Llovizna ligera",
    53: "Llovizna moderada",
    55: "Llovizna intensa",
    56: "Llovizna helada ligera",
    57: "Llovizna helada intensa",
    61: "Lluvia ligera",
    63: "Lluvia moderada",
    65: "Lluvia intensa",
    66: "Lluvia helada ligera",
    67: "Lluvia helada intensa",
    71: "Nevada ligera",
    73: "Nevada moderada",
    75: "Nevada intensa",
    77: "Granos de nieve",
    80: "Chubascos ligeros",
    81: "Chubascos moderados",
    82: "Chubascos intensos",
    85: "Chubascos de nieve ligeros",
    86: "Chubascos de nieve intensos",
    95: "Tormenta eléctrica",
    96: "Tormenta eléctrica con granizo ligero",
    97: "Tormenta eléctrica intensa",
    99: "Tormenta eléctrica con granizo intenso"
  };

  return descripciones[codigo] || "Estado del clima no disponible";
}
