// Elementos de la página que utilizaremos para consultar y mostrar el clima.
const formulario = document.getElementById("formulario-clima");
const entradaCiudad = document.getElementById("ciudad");
const botonConsultar = document.getElementById("boton-consultar");
const mensaje = document.getElementById("mensaje");
const datosClima = document.getElementById("datos-clima");

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

  if (nombre === "") {
    mensaje.textContent = "Escribe el nombre de una ciudad.";
    return;
  }

  mensaje.textContent = "Consultando el clima...";
  botonConsultar.disabled = true;
  entradaCiudad.disabled = true;

  try {
    const ciudad = await buscarCiudad(nombre);

    if (!ciudad) {
      mensaje.textContent = "No se encontró la ciudad. Prueba con otro nombre.";
      return;
    }

    const clima = await obtenerClima(ciudad);

    if (!clima) {
      mensaje.textContent = "No hay datos del clima disponibles para esta ciudad.";
      return;
    }

    mostrarClima(ciudad, clima);
    mensaje.textContent = "Consulta completada.";
  } catch (error) {
    // Mensaje básico; el manejo completo de errores queda para otra etapa.
    mensaje.textContent = "No se pudo consultar el clima. Intenta nuevamente.";
  } finally {
    // Se ejecuta también cuando no encontramos una ciudad o sus datos.
    botonConsultar.disabled = false;
    entradaCiudad.disabled = false;
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

  const respuesta = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${parametros}`);

  if (!respuesta.ok) {
    throw new Error("No se pudo buscar la ciudad.");
  }

  const datos = await respuesta.json();

  if (!datos.results || datos.results.length === 0) {
    return null;
  }

  // En esta etapa usamos la primera coincidencia de la API.
  return datos.results[0];
}

// Segunda petición: utiliza las coordenadas para obtener el clima actual.
async function obtenerClima(ciudad) {
  if (!Number.isFinite(ciudad.latitude) || !Number.isFinite(ciudad.longitude)) {
    return null;
  }

  const parametros = new URLSearchParams({
    latitude: ciudad.latitude,
    longitude: ciudad.longitude,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh"
  });

  const respuesta = await fetch(`https://api.open-meteo.com/v1/forecast?${parametros}`);

  if (!respuesta.ok) {
    throw new Error("No se pudo obtener el clima.");
  }

  const datos = await respuesta.json();
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
  document.getElementById("ciudad-resultado").textContent =
    `${ciudad.name}, ${ciudad.country || "País no disponible"}`;
  document.getElementById("temperatura").textContent = `${clima.temperature_2m} °C`;
  document.getElementById("sensacion").textContent = `${clima.apparent_temperature} °C`;
  document.getElementById("humedad").textContent = `${clima.relative_humidity_2m} %`;
  document.getElementById("viento").textContent = `${clima.wind_speed_10m} km/h`;
  document.getElementById("descripcion").textContent = describirClima(clima.weather_code);
  datosClima.hidden = false;
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
