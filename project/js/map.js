//----------------- base map -----------------//
var map = L.map('map').setView([41.8481, -87.6298], 10);
var mapboxAccessToken = 'pk.eyJ1IjoiamluZ3lpemgiLCJhIjoiY20wbWY0Mmg0MDIwNzJsczl2bGI4OTdpYSJ9.lMmchyClJOv578fwT_63cA'
var mpb = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=' + mapboxAccessToken, {
    attribution: 'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
                'Imagery © <a href="https://www.mapbox.com">Mapbox</a>',
    id: 'mapbox/streets-v11', // Change this to another Mapbox style if needed
}).addTo(map);
var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

//----------------- load data -----------------//
function styleFeature(feature) {
    // Set default style
    var style = {
        color: 'blue', // Default color
        weight: 2,
        opacity: 1,
        fillOpacity: 0.5
    };

    // Change style based on feature properties
    if (feature.properties.speed) {
        // For example, change color based on speed
        if (feature.properties.speed < 25) {
            style.color = 'green'; // Low speed
        } else if (feature.properties.speed < 28) {
            style.color = 'orange'; // Moderate speed
        } else {
            style.color = 'red'; // High speed
        }
    }
    return style;
}

// streets
var streets;
function onEachStreet ( feature , layer ) {
    var popupContent = "Street Name: " + feature.properties.name;
    layer.bindPopup(popupContent);
}
function load_streets () {
    if( streets ) {
        map.removeLayer(streets);
    }

    $.ajax ({
        type: 'GET',
        url: '/api/get_streets_geojson',
        async:false ,
        success:function ( data ) {
            streets = L.geoJSON(data[0].row_to_json, {
                onEachFeature:onEachStreet
            });
        },
        error: function(error) {
            console.error("Error fetching streets data:", error);
        }
    });
}
load_streets();

// cameras
var cameras;
function onEachCam ( feature , layer ) {
    var popupContent = "lat: " + feature.properties.lat + ", lnt: " + feature.properties.lnt;
    layer.bindPopup(popupContent);
}
var camIcon = L.icon({
    iconUrl: 'cam.png', // URL to your custom icon image
    iconSize: [45, 45], // Size of the icon [width, height]
    iconAnchor: [12, 41], // Point of the icon which will correspond to marker's location
    popupAnchor: [1, -34], // Point from which the popup should open relative to the iconAnchor
});
function load_cameras () {
    if( cameras ) {
        map.removeLayer(cameras);
    }

    $.ajax ({
        type: 'GET',
        url: '/api/get_cameras_geojson',
        async:false ,
        success:function ( data ) {
            cameras = L.geoJSON(data[0].row_to_json, {
                pointToLayer: function (feature, latlng) {
                    return L.marker(latlng, { icon: camIcon }); // Use custom icon
                },
                onEachFeature:onEachCam
            });
        },
        error: function(error) {
            console.error("Error fetching streets data:", error);
        }
    });
}
load_cameras();

// speeds
var speeds;
function onEachSpeed ( feature , layer ) {
    var popupContent = "Speed: " + parseFloat(feature.properties.speed).toFixed(2) + " mph";
    layer.bindPopup(popupContent);
}
// create and add the legend for speeds
var speedCategories = [
    { min: 0, max: 24, color: 'green', label: 'Low Speed (0-24 mph)' },
    { min: 25, max: 27, color: 'orange', label: 'Moderate Speed (25-27 mph)' },
    { min: 28, max: 35, color: 'red', label: 'High Speed (>27 mph)' },
];
function addLegend() {
    var legend = L.control({ position: 'bottomright' });

    legend.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'info legend');
        div.innerHTML += '<h5>Speed</h5>';
        // Loop through the categories and create a colored square for each
        speedCategories.forEach(function (category) {
            div.innerHTML +=
                '<i style="background:' +
                category.color +
                '; width: 18px; height: 18px; display: inline-block; margin-right: 8px; font-size: 18px;"></i> ' +
                '<span style="font-size: 18px;">' + category.label + '</span>' +
                '<br>';
        });
        return div;
    };

    legend.addTo(map);
    // first set info div to invisible
    legend.getContainer().style.display = 'none';
    // check if the layer is visible
    function checkDisplayLineInfo() {
        if (map.hasLayer(speeds)) {
            legend.getContainer().style.display = 'block';
        } else {
            legend.getContainer().style.display = 'none';
        }
    }
    map.on('overlayadd', function(e) {
        if (e.layer == speeds) {
            checkDisplayLineInfo();
        }
    });
    map.on('overlayremove', function(e) {
        if (e.layer == speeds) {
            checkDisplayLineInfo();
        }
    });
}
function load_speeds () {
    if( speeds ) {
        map.removeLayer(speeds);
    }

    $.ajax ({
        type: 'GET',
        url: '/api/get_speeds_geojson',
        async:false ,
        success:function ( data ) {
            speeds = L.geoJSON(data[0].row_to_json, {
                style: styleFeature,
                onEachFeature:onEachSpeed
            });
            addLegend();
        },
        error: function(error) {
            console.error("Error fetching streets data:", error);
        }
    });
}
load_speeds();

// neighbourhoods
var neighbourhoods;
function onEachNeighbourhood ( feature , layer ) {
    var popupContent = "Name: " + feature.properties.pri_neigh;
    layer.bindPopup(popupContent);
}
function load_neighbourhoods () {
    if( neighbourhoods ) {
        map.removeLayer(neighbourhoods);
    }

    $.ajax ({
        type: 'GET',
        url: '/api/get_neighbourhoods_geojson',
        async:false ,
        success:function ( data ) {
            neighbourhoods = L.geoJSON(data[0].row_to_json, {
                onEachFeature:onEachNeighbourhood
            });
            neighbourhoods.addTo(map);
        },
        error: function(error) {
            console.error("Error fetching zipcodes data:", error);
        }
    });
}
load_neighbourhoods();


//----------------- add layer control -----------------//
var baseMapsTree = {
    label: 'Base Maps',
    children: [
        {label: 'mapbox', layer: mpb},
        {label: 'osm', layer: osm}
    ]
};
var overlaysTree = {
    label: 'Default',
    children: [
        {label: 'Cameras', layer: cameras},
        {label: 'Region Speeds', layer: speeds},
        {label: 'Major Streets', layer: streets},
        {label: 'Neighbourhoods', layer: neighbourhoods},
    ]
};
var resultsTree = {
    label: 'Queried',
    children: []
};
var combinedOverlaysTree = {
    label: 'Data',
    children: [
        overlaysTree,
        resultsTree
    ]
};
var treeControl = L.control.layers.tree(baseMapsTree, combinedOverlaysTree, {collapsed: false}).addTo(map);


//----------------- add draw control -----------------//
var drawControl = new L.Control.Draw({
    draw: {
        polygon: true, 
        circle: false,
        marker: false,
        circlemarker: false,
        polyline: false
    }
});