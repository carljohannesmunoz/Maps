var map = L.map('map').fitWorld().locate({ setView: true, maxZoom: 20 });

var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Socket.io connection
const socket = io.connect('http://localhost:3000', {
    extraHeaders: {
        'x-api-key': 'hEwHKab6KNtDdSZhytyoVwWtIgfVbBLKzsYomIypM5Wv1CvhUInlTvQQQewct7HxgXXmpoYLRKF9B3Wo4J9ihIvi1vG0vB4j14HIjLmWn8q8qvucwzhKShd3eEYtj7WW'
    }
});

socket.on('connect', function () {
    console.log('Socket.io connected');
});

socket.on('message', function (message) {
    try {
        const data = JSON.parse(message);
        updateMapWithRealtimeData(data);
    } catch (error) {
        console.error('Error parsing Socket.io message:', error);
    }
});

function updateMapWithRealtimeData(data) {
    if (data && data.success && data.data) {
        const drawnShapes = data.data;

        drawnShapes.forEach(shape => {
            if (shape.coordinates !== null) {
                const coordinates = parseCoordinates(shape.coordinates);
                console.log('Parsed coordinates:', coordinates);
                
                const geoJSON = {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: coordinates
                    }
                };
                
                const layer = L.geoJSON(geoJSON, {
                    style: function (feature) {
                        return { color: 'purple' };
                    }
                });
                
                drawnItems.addLayer(layer);


                drawnItems.addLayer(layer);
            } else {
                console.warn('Shape with missing or null coordinates:', shape);
            }
        });

        logDrawnItems();
    } else {
        console.error('Invalid data received from the server:', data);
    }
}

// Function to parse coordinates
function parseCoordinates(coordinatesString) {
    try {
        if (!coordinatesString) {
            return [];
        }

        return coordinatesString
            .replace('LINESTRING(', '')
            .replace(')', '')
            .split(',')
            .map(coord => {
                const [lng, lat] = coord.trim().split(' ');
                return [parseFloat(lng), parseFloat(lat)];
            });
    } catch (error) {
        console.error('Error parsing coordinates:', error);
        return [];
    }
}

// Function to fetch and display drawn shapes from the server
function fetchAndDisplayDrawnShapes() {
    fetch('/drawnShapes', {
        headers: {
            'x-api-key': 'hEwHKab6KNtDdSZhytyoVwWtIgfVbBLKzsYomIypM5Wv1CvhUInlTvQQQewct7HxgXXmpoYLRKF9B3Wo4J9ihIvi1vG0vB4j14HIjLmWn8q8qvucwzhKShd3eEYtj7WW', // Replace with the correct API key
        },
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                drawnItems.clearLayers();

                const drawnShapes = data.data;

                drawnShapes.forEach(shape => {
                    if (shape.coordinates) {
                        const geoJSON = {
                            type: 'Feature',
                            properties: {},
                            geometry: {
                                type: 'LineString',
                                coordinates: parseCoordinates(shape.coordinates)
                            }
                        };

                        const layer = L.geoJSON(geoJSON, {
                            style: function (feature) {
                                return { color: 'purple' };
                            }
                        });

                        drawnItems.addLayer(layer);
                    } else {
                        console.warn('Shape with missing or null coordinates:', shape);
                    }
                });

                logDrawnItems();
            } else {
                console.error('Failed to fetch drawn shapes from the server:', data.error);
            }
        })
        .catch(error => console.error('Error fetching drawn shapes:', error));
}

// WebSocket connection
document.addEventListener('DOMContentLoaded', function () {
    // Call the function to fetch and display drawn shapes when the page loads
    fetchAndDisplayDrawnShapes();
});

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
        marker: {
            icon: new L.Icon.Default(),
        },
        circlemarker: {
            shapeOptions: {
                color: 'orange'
            },
        },
    },
    edit: {
        featureGroup: drawnItems
    }
});

// Add the 'draw:created' event listener
map.addControl(drawControl);
map.on("draw:created", function (e) {
    var layer = e.layer;

    if (isSupportedLayer(layer)) {
        var shapeName = prompt("Enter shape name:", "ShapeName");

        var geoJSON = layer.toGeoJSON();
        geoJSON.properties.name = shapeName;

        var coordinates;
        if (geoJSON.geometry.type === 'LineString' || geoJSON.geometry.type === 'MultiLineString') {
            coordinates = geoJSON.geometry.coordinates.map(point => [point[1], point[0]]);
        } else if (geoJSON.geometry.type === 'Polygon' || geoJSON.geometry.type === 'MultiPolygon') {
            coordinates = geoJSON.geometry.coordinates[0].map(point => [point[0], point[1]]);
        }        

        // Attach a popup to the drawn layer with GeoJSON information
        layer.bindPopup(`<pre>${JSON.stringify(geoJSON, null, 2)}</pre>`).openPopup();

        // Send data to the server
        sendDataToServer(shapeName, coordinates);

        drawnItems.addLayer(layer);
        logDrawnItems();
    } else {
        console.warn('Unsupported layer type:', layer);
    }
});

function isSupportedLayer(layer) {
    return (
        layer instanceof L.Polygon ||
        layer instanceof L.Polyline ||
        layer instanceof L.Rectangle ||
        layer instanceof L.Circle ||
        layer instanceof L.Marker ||
        layer instanceof L.CircleMarker
    );
}

function sendDataToServer(type, coordinates) {
    console.log('Sending drawn shape data:', { type, coordinates });

    // Check if coordinates are undefined or empty
    if (!coordinates || coordinates.length === 0 || coordinates.some(coord => coord.some(isNaN))) {
        console.error('Invalid coordinates:', coordinates);
        return;
    }

    // Format the coordinates to be compatible with LINESTRING in WKT
    const wktCoordinates = coordinates.map(coord => `${coord[1]} ${coord[0]}`).join(',');

    const data = {
        name: type,
        coordinates: `LINESTRING(${wktCoordinates})`,
    };

    // Log the GeoJSON data before sending
    console.log('GeoJSON Data:', JSON.stringify(data));

    fetch('/drawnShapes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'hEwHKab6KNtDdSZhytyoVwWtIgfVbBLKzsYomIypM5Wv1CvhUInlTvQQQewct7HxgXXmpoYLRKF9B3Wo4J9ihIvi1vG0vB4j14HIjLmWn8q8qvucwzhKShd3eEYtj7WW', // Replace with the correct API key
        },
        body: JSON.stringify(data),
    })
    .then(response => response.json())
    .then(responseData => {
        if (responseData.success) {
            console.log('Drawn shape data sent to the server successfully:', responseData.data);

            // Add the drawn shape to the map with popup
            addShapeToMap(data);
        } else {
            console.error('Failed to send drawn shape data to the server:', responseData.error);
        }
    })
    .catch(error => console.error('Error sending drawn shape data to the server:', error));
}

function addShapeToMap(data) {
    try {
        // Parse the coordinates from the data
        const coordinates = parseCoordinates(data.coordinates);

        // Create a GeoJSON feature
        const geoJSON = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            }
        };

        // Log GeoJSON to the console for debugging
        console.log('GeoJSON:', geoJSON);

        // Create a GeoJSON layer with style and bind popup
        const layer = L.geoJSON(geoJSON, {
            style: function (feature) {
                return { color: 'purple' };
            }
        }).bindPopup(`<pre>${JSON.stringify(geoJSON, null, 2)}</pre>`);

        // Add the layer to the drawnItems feature group
        drawnItems.addLayer(layer);

        // Open the popup
        layer.openPopup();

        // Log drawn items
        logDrawnItems();
    } catch (error) {
        console.error('Error adding shape to map:', error);
    }
}

function logDrawnItems() {
    var data = [];
    drawnItems.eachLayer(function (layer) {
        data.push(layer.toGeoJSON());
    });
    console.log("Drawn items data:", data);
}

function flattenCoordinates(coordinates) {
    return coordinates.map(coord => [coord[1], coord[0]]);
}
logDrawnItems();

var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});
osm.addTo(map);
