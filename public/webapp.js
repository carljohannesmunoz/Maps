var map = L.map('map').fitWorld().locate({ setView: true, maxZoom: 20 });

var trail = {
    type: 'Feature',
    properties: {
        id: 1
    },
    geometry: {
        type: 'LineString',
        coordinates: []
    }
};

var geoJsonLayer = L.geoJSON([trail], {
    style: function (feature) {
        return { color: 'blue' }; // You can customize the style as needed
    },
    onEachFeature: function (feature, layer) {
        if (feature.properties && feature.properties.popupContent) {
            layer.bindPopup(feature.properties.popupContent);
        }
    }
});

var realtime = L.realtime(function (success, error) {
    fetch('https://wanderdrone.appspot.com/')
        .then(function (response) { return response.json(); })
        .then(function (data) {
            var trailCoords = trail.geometry.coordinates;
            trailCoords.push(data.geometry.coordinates);
            trailCoords.splice(0, Math.max(0, trailCoords.length - 5));

            geoJsonLayer.clearLayers();
            geoJsonLayer.addData([data, trail]);

            success([data, trail]);
        })
        .catch(error);
}, {
    interval: 250,
    removeMissing: true
});

realtime.addTo(map);

var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var drawControl = new L.Control.Draw({
    position: "topright",
    edit: {
        featureGroup: drawnItems,
        remove: false
    },
    draw: {
        polygon: {
            shapeOptions: {
                color: 'purple'
            },
            allowIntersection: false,
            drawError: {
                color: 'orange',
                timeout: 1000
            },
            showArea: true,
            metric: false,
            repeatMode: true
        },
        polyline: {
            shapeOptions: {
                color: 'red'
            },
        },
        rect: {
            shapeOptions: {
                color: 'green'
            },
        },
        circle: {
            shapeOptions: {
                color: 'steelblue'
            },
        },
    },
    edit: {
        featureGroup: drawnItems
    }
});
map.addControl(drawControl);

map.on("draw:created", function (e) {
    var type = e.layerType,
        layer = e.layer;

    // Get the user-defined name for the polygon (you can replace 'YourPolygonName' with an actual name)
    var polygonName = prompt("Enter polygon name:", "YourPolygonName");

    // Access the GeoJSON representation of the drawn shape
    var geoJSON = layer.toGeoJSON();

    // Add the name property to the GeoJSON feature
    geoJSON.properties.name = polygonName;

    // Log the GeoJSON to the console (you can remove this line in production)
    console.log(geoJSON);

    // Bind a popup with GeoJSON details to the drawn layer
    layer.bindPopup(`<p>${JSON.stringify(geoJSON)}</p>`);

    // Add the layer to the drawnItems feature group
    drawnItems.addLayer(layer);
});


map.on("draw:edited", function (e) {
    var layers = e.layers;
    var type = e.layerType;

    layers.eachLayer(function (layer) {
        console.log(layer);
    });
});

realtime.on('update', function () {
    map.fitBounds(realtime.getBounds(), { maxZoom: 3 });
});

function onLocationFound(e) {
    var radius = e.accuracy;

    var userMarker = L.marker(e.latlng).addTo(map)
        .bindPopup(`Latitude: ${e.latlng.lat.toFixed(6)}<br>Longitude: ${e.latlng.lng.toFixed(6)}`).openPopup();

    userMarker.on('click', function () {
        // When the user's marker is clicked, get the latitude and longitude in GeoJSON format
        var userGeoJSON = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Point',
                coordinates: [e.latlng.lng, e.latlng.lat]
            }
        };

        console.log(userGeoJSON);
    });

    L.circle(e.latlng, radius).addTo(map);
}

map.on('locationfound', onLocationFound);

function onLocationError(e) {
    alert(e.message);
}

map.on('locationerror', onLocationError);

// OSM layer
var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});
osm.addTo(map);
