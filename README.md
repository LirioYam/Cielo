# Cielo ☁️

**El clima, con calma.**

Cielo es una aplicación web de consulta del clima actual por nombre de ciudad. Es un proyecto universitario de Desarrollo de Software Multiplataforma, desarrollado por etapas para practicar HTML semántico, CSS, JavaScript y el consumo de una API externa.

## Tecnologías

| Tecnología | Uso en el proyecto |
| --- | --- |
| HTML5 | Estructura semántica, formulario y presentación de resultados. |
| CSS3 | Diseño adaptable, paleta azul pastel, degradados y animaciones. |
| JavaScript puro | Validación, consultas asíncronas y actualización de la página. |
| `fetch()` y `async/await` | Peticiones HTTP y lectura de respuestas JSON. |
| `AbortController` | Cancelación de peticiones que exceden el tiempo límite. |
| SVG | Iconos del clima incluidos en el HTML. |
| Node.js | Ejecución de pruebas automatizadas; no es necesario para utilizar la aplicación. |

La aplicación no utiliza frameworks, paquetes externos, backend ni un proceso de compilación.

## Funcionalidades

- Buscar una ciudad y consultar su clima actual sin recargar la página.
- Mostrar el nombre de la ciudad y el país.
- Mostrar temperatura y sensación térmica en °C, humedad relativa en % y velocidad del viento en km/h.
- Traducir el código meteorológico a una descripción en español y mostrar un icono relacionado.
- Presentar una animación de carga y bloquear búsquedas simultáneas.
- Mostrar mensajes para campos vacíos, ciudades inexistentes, problemas de conexión, errores del servicio, respuestas incompletas y límites de peticiones.
- Cancelar cada petición que exceda los 10 segundos, incluida la lectura del JSON, y permitir una nueva búsqueda.
- Adaptar la presentación a celular y computadora, permitir navegación por teclado y respetar `prefers-reduced-motion`.

## Archivos del proyecto

```text
AppCielo/
├── index.html            # Interfaz e iconos SVG
├── styles.css            # Diseño y animaciones
├── script.js             # Lógica y conexión con las APIs
├── tests/
│   └── script.test.cjs    # Pruebas sin conexión a la API real
├── .gitignore            # Exclusiones de archivos locales y posibles secretos
└── README.md             # Documentación del proyecto
```

## Cómo ejecutarlo

Se necesita un navegador moderno y conexión a Internet para las consultas reales. No hay que configurar una clave de acceso ni instalar dependencias de la aplicación.

### Con un servidor local

Si tienes Python 3 instalado, abre una terminal en la carpeta del proyecto. Por ejemplo, en PowerShell:

```powershell
cd C:\AppCielo
python -m http.server 8000 --bind 127.0.0.1
```

Adapta la ruta si guardaste el proyecto en otra carpeta. Abre [Cielo en el navegador](http://127.0.0.1:8000/). Para detener el servidor, presiona **Ctrl + C** en la terminal. Python solo sirve los archivos estáticos durante el desarrollo; no forma parte de la lógica de la aplicación.

También puedes abrir `index.html` directamente en el navegador. Si el navegador restringe las peticiones desde archivos locales, utiliza el servidor HTTP indicado arriba. Si ya tenías abierta una versión anterior, recarga con **Ctrl + F5**.

### Cómo utilizarlo

1. Escribe una ciudad, por ejemplo **Mérida**, **Izamal** o **Ciudad de México**.
2. Presiona **Consultar clima** o la tecla **Enter**.
3. Espera a que termine la animación de carga.
4. Lee los resultados y realiza otra búsqueda si lo deseas.

## APIs utilizadas

Se utilizan dos servicios de [Open-Meteo](https://open-meteo.com/). Su API gratuita permite el uso educativo no comercial con límites de peticiones y sin clave de acceso para los endpoints públicos utilizados. Consulta las [condiciones del proveedor](https://open-meteo.com/en/terms).

### 1. Geocodificación

Endpoint: [https://geocoding-api.open-meteo.com/v1/search](https://geocoding-api.open-meteo.com/v1/search).

`buscarCiudad()` envía el nombre con `name`, solicita una coincidencia con `count=1` y nombres traducidos cuando estén disponibles con `language=es`. `URLSearchParams` codifica espacios y acentos. La respuesta proporciona las coordenadas, el nombre y el país. Consulta la [documentación de geocodificación](https://open-meteo.com/en/docs/geocoding-api).

### 2. Clima actual

Endpoint: [https://api.open-meteo.com/v1/forecast](https://api.open-meteo.com/v1/forecast).

`obtenerClima()` envía `latitude` y `longitude`, establece `temperature_unit=celsius` y `wind_speed_unit=kmh`, y solicita estas variables mediante `current`:

| Parámetro | Información |
| --- | --- |
| `temperature_2m` | Temperatura actual. |
| `apparent_temperature` | Sensación térmica. |
| `relative_humidity_2m` | Humedad relativa. |
| `wind_speed_10m` | Velocidad del viento. |
| `weather_code` | Código meteorológico que se traduce a texto e icono. |

Las condiciones actuales del servicio se basan en datos de modelos meteorológicos, no necesariamente en una medición tomada en una estación dentro de la ciudad. Consulta la [documentación meteorológica](https://open-meteo.com/en/docs).

Ambas consultas pasan por `solicitarDatos()`, que comprueba la conexión, los errores HTTP y el contenido, y aplica el tiempo límite. Después, `mostrarClima()` actualiza el DOM con `textContent`. El formulario utiliza `preventDefault()` para evitar una recarga.

## Organización del JavaScript

| Función | Responsabilidad |
| --- | --- |
| `consultarClima()` | Coordinar la validación, las dos consultas y la recuperación ante errores. |
| `solicitarDatos()` | Compartir la lógica de `fetch`, cancelación y comprobación de respuestas. |
| `buscarCiudad()` | Obtener la primera coincidencia de geocodificación. |
| `obtenerClima()` | Validar las coordenadas y los datos meteorológicos. |
| `mostrarClima()` | Escribir los resultados y mostrar su tarjeta. |
| `describirClima()` y `obtenerIconoClima()` | Traducir el código meteorológico. |
| `mostrarMensaje()` y `cambiarCarga()` | Actualizar los mensajes, la animación y los controles. |

Los mensajes están reunidos en `MENSAJES_ERROR` y el tiempo límite en `TIEMPO_LIMITE`. Los controles y los temporizadores se restauran mediante `finally`, incluso si la consulta falla.

## Manejo de errores

| Situación | Comportamiento |
| --- | --- |
| Campo vacío o solo espacios | Solicita un nombre, enfoca el campo y no hace peticiones. |
| Sin coincidencias de ciudad | Invita a revisar el nombre; no consulta la segunda API. |
| Sin Internet o fallo de red | Invita a revisar la conexión. |
| HTTP 429 | Informa del límite y pide esperar antes de reintentar manualmente. |
| HTTP 408, 504 o petición de más de 10 segundos | Informa de la espera excesiva y cancela la petición local cuando corresponde. |
| Otros errores 5xx | Indica que el servicio no está disponible. |
| Respuesta vacía, incompleta o JSON inválido | Muestra un mensaje y oculta los resultados anteriores. |
| Error inesperado | Muestra un mensaje general sin detalles técnicos. |

El límite de 10 segundos se aplica **a cada petición**. Como las dos peticiones son consecutivas, la búsqueda completa puede tardar aproximadamente hasta 20 segundos. No se realizan reintentos automáticos que consuman peticiones adicionales.

## Pruebas

### Automatizadas

Para ejecutarlas, instala Node.js 22 o posterior y abre una terminal en la carpeta del proyecto:

```powershell
node --check script.js
node --test tests/script.test.cjs
```

Las pruebas se verificaron con **Node.js 24.13.0**. No requieren `npm install`, Internet ni una clave de API: simulan el DOM, las respuestas de `fetch` y el reloj, y ejecutan el JavaScript real de la aplicación.

La revisión final incluye **41 pruebas aprobadas**: validación, errores en ambas APIs, peticiones incompletas, cancelación durante la recepción o la lectura del JSON, recuperación del formulario, bloqueo de envíos simultáneos, valores cero válidos, codificación de acentos y nuevas búsquedas.

### Comprobación manual

| Prueba | Resultado esperado |
| --- | --- |
| Buscar Mérida, Izamal y Ciudad de México | Mostrar ciudad, país, las cuatro magnitudes con sus unidades y la descripción del clima. |
| Buscar otra ciudad sin recargar | Reemplazar los resultados anteriores. |
| Dejar el campo vacío o escribir espacios | Mostrar un mensaje y no iniciar la carga. |
| Buscar `zzzzciudadinexistente12345` | Mostrar que no hay coincidencias. |
| Desconectar Internet y buscar | Mostrar el mensaje de conexión y permitir reintentar. |
| Enviar varias veces mientras carga | Mantener una única búsqueda en curso. |
| Usar Tab y Enter | Recorrer los controles, ver el foco y consultar. |
| Revisar a 320, 390 y 1280 píxeles de ancho | Mantener texto y controles utilizables sin desbordamiento horizontal. |
| Activar la reducción de movimiento del dispositivo | Desactivar las animaciones. |

Los valores reales del clima cambian. Los errores de límite y servidor se prueban mediante simulaciones; no es necesario saturar la API para comprobarlos.

## Seguridad y privacidad

- El proyecto no necesita contraseñas, tokens ni archivos `.env` para funcionar.
- Las peticiones se realizan por HTTPS a los dos dominios de Open-Meteo. Se envían el nombre buscado y las coordenadas de la ciudad; no se solicita la ubicación del dispositivo.
- Los resultados se insertan con `textContent`, sin interpretar los nombres recibidos como HTML.
- La aplicación no guarda un historial de búsquedas en almacenamiento local ni utiliza una base de datos.
- `.gitignore` excluye archivos locales como `.env`, claves privadas y registros. Esta exclusión no elimina un secreto si ya se añadió previamente a Git.
- La revisión final de archivos y del historial local no detectó coincidencias con los patrones examinados de claves privadas, tokens, secretos asignados y credenciales en URLs. Es una comprobación local por patrones, no una garantía de ausencia de cualquier dato sensible.

## Alcance y limitaciones

- Se utiliza la primera coincidencia de la API. Hay ciudades con el mismo nombre; revisa siempre el país mostrado.
- Se consulta únicamente el clima actual: no se incluyen pronósticos por días, mapas, cuentas ni favoritos.
- Las consultas reales dependen de Internet, de los datos disponibles y de los límites de Open-Meteo.
- Los datos meteorológicos se atribuyen a [Open-Meteo](https://open-meteo.com/); la geocodificación utiliza datos de [GeoNames](https://www.geonames.org/), según la documentación del proveedor.

## Declaración de uso de inteligencia artificial

Para este proyecto utilicé **Codex y ChatGPT** como herramientas de apoyo. A continuación distingo la ayuda recibida de las actividades que realicé personalmente.

### Codex

Codex me ayudó a implementar la estructura HTML, los estilos CSS y las funciones JavaScript; conectar las dos APIs de Open-Meteo; mejorar el diseño; incorporar validaciones, cancelación y mensajes de error; crear y ejecutar pruebas; revisar el repositorio y preparar esta documentación. También proporcionó explicaciones de los cambios y de cómo probarlos.

### ChatGPT

Utilicé ChatGPT principalmente para entender los requisitos de mi tarea, organizar las etapas del proyecto y preparar los prompts que fui enviando a Codex. También me ayudó a definir cómo quería el diseño de Cielo, resolver dudas sobre Git y GitHub y organizar la información para mi bitácora.

### Mi trabajo personal

Elegí el tema de la aplicación, definí cómo quería que se viera y fui revisando los avances. Codex fue la herramienta que utilicé para desarrollar el código, implementar las funcionalidades y realizar las pruebas.

**Espacio para ampliar mi participación con mis propias palabras:**

- Decisiones concretas que tomé sobre el tema y el diseño: [Escribe aquí.]
- Avances que revisé y observaciones que hice: [Escribe aquí.]
- Aprendizajes y dificultades que puedo explicar: [Escribe aquí.]
- Otras actividades que realicé personalmente: [Escribe aquí, únicamente si corresponde.]

Fecha de la revisión final: **19 de octubre de 2026**.
