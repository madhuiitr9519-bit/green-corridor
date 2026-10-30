
const pages = document.querySelectorAll(".page");

// Page navigation with animated transitions
function goToPage(number) {
  pages.forEach(page => page.classList.remove("active"));

  const target = document.getElementById("page" + number);
  target.classList.add("active");

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (number === 3) {
    setTimeout(() => map.invalidateSize(), 250);
  }
}

// Initialize map near IIT Roorkee.
// Adjust this view to match your actual study boundary.
const map = L.map("map").setView([29.864, 77.896], 14);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// Independent layer groups allow separate uploads and removal
const layers = {
  road: L.layerGroup().addTo(map),
  lst: L.layerGroup().addTo(map),
  corridor: L.layerGroup().addTo(map)
};

const fileInputs = {
  road: document.getElementById("roadFile"),
  lst: document.getElementById("lstFile"),
  corridor: document.getElementById("corridorFile")
};

const status = document.getElementById("uploadStatus");

const styles = {
  road: {
    color: "#3478d4",
    weight: 3,
    fillColor: "#74a5e8",
    fillOpacity: 0.25
  },
  lst: {
    color: "#e36a45",
    weight: 2,
    fillColor: "#ed7557",
    fillOpacity: 0.55
  },
  corridor: {
    color: "#16a653",
    weight: 5,
    fillColor: "#36c46b",
    fillOpacity: 0.5
  }
};

// Escape property values before adding them to map popups
function safeText(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// Read uploaded GeoJSON layers
Object.entries(fileInputs).forEach(([type, input]) => {
  input.addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;

    status.textContent = `Loading ${file.name}...`;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const geojson = JSON.parse(reader.result);

        if (
          !["FeatureCollection", "Feature"].includes(geojson.type)
        ) {
          throw new Error("Expected a GeoJSON Feature or FeatureCollection.");
        }

        // Replace only the selected layer
        layers[type].clearLayers();

        const geoLayer = L.geoJSON(geojson, {
          style: feature => {
            const geometryType = feature.geometry?.type;

            // Green corridor lines should remain visually prominent
            if (
              type === "corridor" ||
              ["LineString", "MultiLineString"].includes(geometryType)
            ) {
              return {
                ...styles[type],
                color: type === "corridor"
                  ? "#16a653"
                  : styles.road.color
              };
            }

            // Color LST polygons by their temperature attribute
            if (type === "lst") {
              const props = feature.properties || {};

              const raw =
                props.lst ?? props.LST ?? props.lst_c ??
                props.LST_C ?? props.mean_lst;

              const value = Number(raw);

              let fillColor = "#89958b";

              if (raw !== undefined && raw !== null &&
                  raw !== "" && Number.isFinite(value)) {
                fillColor =
                  value < 30 ? "#3b82c4" :
                  value < 35 ? "#e7bd42" :
                  "#dc5147";
              }

              return {
                ...styles.lst,
                fillColor
              };
            }

            return styles[type];
          },

          pointToLayer: (feature, latlng) => {
            return L.circleMarker(latlng, {
              radius: 6,
              color: styles[type].color,
              fillColor: styles[type].fillColor,
              fillOpacity: 0.85,
              weight: 2
            });
          },

          onEachFeature: (feature, layer) => {
            const props = feature.properties || {};

            const details = Object.entries(props)
              .map(([key, value]) =>
                `<b>${safeText(key)}:</b> ${safeText(value)}`
              )
              .join("<br>");

            if (details) layer.bindPopup(details);
          }
        });

        geoLayer.addTo(layers[type]);

        const bounds = geoLayer.getBounds();

        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            padding: [25, 25],
            maxZoom: 17
          });
        }

        status.textContent =
          `${file.name} loaded successfully.`;

      } catch (error) {
        status.textContent =
          `Unable to load file: ${error.message}`;
      }
    };

    reader.onerror = () => {
      status.textContent = "The selected file could not be read.";
    };

    reader.readAsText(file);
  });
});

// Remove uploaded map layers
function resetMap() {
  Object.values(layers).forEach(layer => layer.clearLayers());

  Object.values(fileInputs).forEach(input => {
    input.value = "";
  });

  map.setView([29.864, 77.896], 14);

  status.textContent = "All uploaded layers have been cleared.";
}
