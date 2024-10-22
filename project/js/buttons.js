$(document).ready(function() {

    // ---------------------------- Query crashes ----------------------------//
    let startDate = null;
    let endDate = null;
    let neighbourhoodName = null;
    
    // select dates
    flatpickr("#dateRangePicker", {
        mode: "range",          // Enables date range selection
        dateFormat: "m/d/Y",    // Format for the selected dates
        onChange: function(selectedDates) {
          // If two dates are selected
          if (selectedDates.length === 2) {
            startDate = selectedDates[0].toLocaleDateString('en-US');
            endDate = selectedDates[1].toLocaleDateString('en-US');

            console.log("Start Date:", startDate);
            console.log("End Date:", endDate);
          }
        }
    });
    $('#searchByDateBtn').on('click', function() {
        var dateRangePicker = document.getElementById("dateRangePicker");
        dateRangePicker._flatpickr.open();   // Automatically focus to open the calendar
    });

    // select location - neighbourhooods
    let isQuerying = false; // Flag to check if a query is in progress
    $('#neighBtn').on('click', function() {
        // Show neighbourhoods layer for selection
        let neighbourhoodsLayer = overlaysTree.children.find(child => child.label === 'Neighbourhoods').layer;
        
        if (!map.hasLayer(neighbourhoodsLayer)) {
            map.addLayer(neighbourhoodsLayer);
        } else {
            console.log("Neighbourhoods layer is already added to the map.");
        }
    
        alert("Click on the neighbourhood you want to search.");
    
        // Unbind previous click event to avoid multiple bindings
        neighbourhoods.off('click'); 
    
        // Bind click event
        neighbourhoods.on('click', function(e) {
            // Check if startDate and endDate are null
            if (!startDate || !endDate) {
                alert("Please select a date range first.");
                return; // Exit the click handler if dates are not set
            }
    
            var clickedLayer = e.layer;  // Get the layer that was clicked
            neighbourhoodName = clickedLayer.feature.properties.pri_neigh;
    
            // Set flag to true to indicate a query is in progress
            isQuerying = true; 
    
            executeCrashbyNeighbourhoodQuery().then(function() {
                isQuerying = false; 
                neighbourhoods.off('click'); // Unbind click event
                return;
            }).catch(function(error) {
                isQuerying = false;
                console.error("Error executing query:", error);
                neighbourhoods.off('click'); 
            });
        });
    });
    
    function clearSelections() {
        // Clear date and neighbourhood selections
        startDate = null;
        endDate = null;
        neighbourhoodName = null;
        
        var dateRangePicker = document.getElementById("dateRangePicker");
        if (dateRangePicker._flatpickr) {
            dateRangePicker._flatpickr.clear(); // Clear the date selection
        }
    }

    function executeCrashbyNeighbourhoodQuery() {

        return new Promise((resolve, reject) => {
            clearMessageBox();
            updateMessageBox("Querying accidents from " + startDate + " to " + endDate + " at " + neighbourhoodName + "...");
            
            $('#progressContainer').show(); // Show progress bar container
            let width = 0;
            let progress = setInterval(function() {
                if (width >= 100) {
                    clearInterval(progress); // Stop progress bar when complete
    
                    queryCrashPointsbyNeighbourhood(startDate, endDate, neighbourhoodName)
                        .then(function() {
                            $('#progressContainer').hide(); // Hide progress bar after query
                            clearSelections();                  
                        })
                        .catch(function(error) {
                            $('#progressContainer').hide(); // Hide progress bar on error
                            console.error('Error querying crash points:', error);
                            reject(error);
                        });
                } else {
                    width++;
                    $('#progressBar').css('width', width + '%');
                }
            }, 50); // Progress bar update interval
            
            resolve();
        })
    }

    // select location - custom
    // Event handler for when a polygon is created
    $('#customBtn').on('click', function() {
        if (!startDate || !endDate) {
            alert("Please select date range first.");
            return; // Exit the click handler if dates are not set
        }
    
        alert("Draw a polygon on your desired location on the map.");
    
        // Show draw control and drawn layer
        drawControl.addTo(map);
        $('#progressContainer').show();

        map.off(L.Draw.Event.CREATED); // Remove any existing handlers
        map.on(L.Draw.Event.CREATED, function(e) {
            var layer = e.layer;
            map.addLayer(layer);
            polygonJson = JSON.stringify(layer.toGeoJSON().geometry);
            console.log(polygonJson);

            $('#progressContainer').show();
            let width = 0;
            let progress = setInterval(function() {
                if (width >= 100) {
                    clearInterval(progress);
                    // Execute the query after polygon creation
                    queryCrashPointsCustom(startDate, endDate, polygonJson)
                    .then(function() {
                        map.removeControl(drawControl);
                        map.removeLayer(layer);
                        clearSelections();
                        $('#progressContainer').hide();
                    })
                    .catch(function(error) {
                        isQuerying = false;
                        console.error("Error executing query:", error);
                        $('#progressContainer').hide();
                    });
                } else {
                    width++;
                    $('#progressBar').css('width', width + '%');
                }
            }, 50);
            
        });
    });
    

    // ---------------------------- Safety Score ----------------------------//
    // all streets
    $('#scoreBtn').on('click', function() {
        clearMessageBox();
        updateMessageBox("Calculating street safety scores...");
        $('#progressContainer').show();
        let width = 0;
        let progress = setInterval(function() {
            if (width >= 100) {
                clearInterval(progress);
                calculateSafetyScore().then(function() {
                    $('#progressContainer').hide();
                }).catch(function(error) {
                    // In case of an error, hide the progress bar and log the error
                    $('#progressContainer').hide();
                    console.error('Error calculating safety score:', error);
                });
            } else {
                width++;
                $('#progressBar').css('width', width + '%');
            }
        }, 50);
    });

    // custom routes
    $('#originBtn').on('click', function(e){
        // Prevent the click event from propagating to the map
        e.stopPropagation();

        alert("Click on the map to enter the location for your origin.");

        map.on('click', function(e) {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;

            $('#lat1').val(lat);
            $('#lnt1').val(lng);
            
            map.off('click'); // Disable and unbind map click event listener after selecting the location
        });
    })
    $('#destinationBtn').on('click', function(e){
        // Prevent the click event from propagating to the map
        e.stopPropagation();

        alert("Click on the map to enter the location for your destination.");

        map.on('click', function(e) {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;

            $('#lat2').val(lat);
            $('#lnt2').val(lng);
            
            map.off('click'); // Disable and unbind map click event listener after selecting the location
        });
    })
    $('#routeForm').on('submit', function(e){
        clearMessageBox();
        e.preventDefault();

        const lat1 = $('#lat1').val();
        const lnt1 = $('#lnt1').val();
        const lat2 = $('#lat2').val();
        const lnt2 = $('#lnt2').val();

        updateMessageBox("Calculating routes and scores...");
        $('#progressContainer').show();
        let width = 0;
        let progress = setInterval(function() {
            if (width >= 100) {
                clearInterval(progress);
                calculateRouteScore(lat1, lnt1, lat2, lnt2).then(function() {
                    $('#progressContainer').hide();
                }).catch(function(error) {
                    // In case of an error, hide the progress bar and log the error
                    $('#progressContainer').hide();
                    console.error('Error calculating safety score:', error);
                });
            } else {
                width++;
                $('#progressBar').css('width', width + '%');
            }
        }, 50);
        
        // Reset the form 
        this.reset();

    })

    // ---------------------------- Report Accidents ----------------------------//
    $('#chooseLocationBtn').on('click', function(e) {
         // Prevent the click event from propagating to the map
        e.stopPropagation();

        alert("Click on the map to enter the location for the accident.");

        map.on('click', function(e) {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;

            $('#latitude').val(lat);
            $('#longitude').val(lng);
            
            map.off('click'); // Disable and unbind map click event listener after selecting the location
        });
    });
    $('#accidentForm').on('submit', function(e) {
        e.preventDefault(); // Prevent the default form submission

        const date = $('#date').val();
        const inj = $('#inj_total').val();
        const lat = $('#latitude').val();
        const lnt = $('#longitude').val();
        const prim_contr = $('#prim_contr').val();
        const traffic_co = $('#traffic_co').val();

        // Validate date (assuming isValidDate is a function you've defined)
        if (!isValidDate(date)) {
            alert("Please enter a valid date.");
            return; // Stop if date is invalid
        }

        // Check if inj_total is a valid integer
        if (!Number.isInteger(parseInt(inj, 10))) {
            alert("Injury total must be a valid integer.");
            return; // Stop if inj_total is not a valid integer
        }

        var data = {
            id: '',
            date: date,
            inj_total: inj,
            lat: lat,
            lnt: lnt,
            prim_contr: prim_contr,
            traffic_co: traffic_co
        }
        $.ajax (
        {
            type : "POST",
            contentType :"application/json",
            url : "/report_accidents",
            data : JSON.stringify(data),   // need to stringify before adding to sql queries
            success: function (){
                clearMessageBox();
                alert("Report successful.");
                updateMessageBox("Report accidents successful.");
            },
            error : function (e) {
                alert ("Report failed. See action box for details.");
                updateMessageBox("Error reporting data: " + error.responseText);
                console.log ("ERROR:",e);
            }
        });

        // Reset the form 
        this.reset();

    });

});


function updateMessageBox(message) {
    let messageBox = document.getElementById("messageBox");
    messageBox.value += message + "\n";
}
function clearMessageBox() {
    let messageBox = document.getElementById("messageBox");
    messageBox.value = ''; // Clear the message box
}


//---------------------------- Crash Functions ----------------------------//
// Function to validate date format
function isValidDate(dateString) {
    // Regular expression for validating MM/DD/YYYY HH:MM:SS AM/PM format
    const regex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/(20[0-2][0-9])\s(0[1-9]|1[0-2]):([0-5][0-9]):([0-5][0-9])\s?(AM|PM)$/i;
    if (!regex.test(dateString)) return false;

    // Parse the date string into a Date object
    const date = new Date(dateString);
    // Check if the date is valid
    return !isNaN(date.getTime());
}

// load crashes
var crashes;

function onEachCrash ( feature , layer ){
    var popupContent = "Time: " + feature.properties.date + 
                        "<br>lat: " + parseFloat(feature.properties.lat).toFixed(2) + 
                        " lnt: " + parseFloat(feature.properties.lnt).toFixed(2) + 
                        "<br>Total injuries: " + feature.properties.inj_total;

    layer.bindPopup(popupContent);
}

function queryCrashPointsbyNeighbourhood(startDate, endDate, neighbourhoodName){
    return new Promise((resolve, reject) => {
        console.log("Querying accidents in " + neighbourhoodName + '...');

        // remove old layer
        if (crashes) {
            map.removeLayer(crashes);
            crashes = null;

            var layerIndex = resultsTree.children.findIndex(layer => layer.label === 'Accidents');
            // If the layer exists, remove it
            if (layerIndex > -1) {
                resultsTree.children.splice(layerIndex, 1);
                combinedOverlaysTree = {
                    label: 'Data',
                    children: [
                        overlaysTree,
                        resultsTree
                    ]
                };
                // Reinitialize the tree control to update it
                treeControl.remove();
                treeControl = L.control.layers.tree(baseMapsTree, combinedOverlaysTree, { collapsed: false }).addTo(map);
            }
        }
        
        $.ajax ({
            url: '/api/get_crashes_byNeighbourhood_geojson',
            method: 'GET',
            data: { start_date: startDate, end_date: endDate, neigh: neighbourhoodName },
    
            success: function(data) {

                if (data[0].row_to_json.features === null) {
                    alert("No accidents are found.");
                    
                } else {
                    crashes = L.geoJSON(data[0].row_to_json, {
                        onEachFeature: onEachCrash
                    });
        
                    crashes.addTo(map);
        
                    // update layer control and messages
                    resultsTree.children.push({
                        label: 'Accidents',
                        layer: crashes
                    });
                    combinedOverlaysTree = {
                        label: 'Data',
                        children: [
                            overlaysTree,
                            resultsTree
                        ]
                    };
                    treeControl.remove();
                    treeControl = L.control.layers.tree(baseMapsTree, combinedOverlaysTree, { collapsed: false }).addTo(map); 
                    updateMessageBox("Accidents loaded successfully.");
        
                    console.log('Accidents loaded.');
        
                    map.on('overlayadd', function(e) {
                        if (speeds) {
                            speeds.bringToBack(); 
                        }
                        if (neighbourhoods){
                            neighbourhoods.bringToBack();
                        }
                    });            
                    map.on('overlayremove', function(e) {
                        if (speeds) {
                            speeds.bringToBack(); // Ensure polygon stays at the back if re-added
                        }
                        if (neighbourhoods){
                            neighbourhoods.bringToBack();
                        }
                    });     
                }
                resolve();
            },
            error: function(error) {
    
                console.error('Error:', error);
                alert("Error loading accidents. See action box for details.")
                updateMessageBox("Error loading crash data: " + error.responseText);
                reject(error);

            }
        });    
    });
}

function queryCrashPointsCustom(startDate, endDate, layer){
    return new Promise((resolve, reject) => {
        clearMessageBox();

        // remove old layer
        if (crashes) {
            map.removeLayer(crashes);
            crashes = null;

            var layerIndex = resultsTree.children.findIndex(layer => layer.label === 'Accidents');
            // If the layer exists, remove it
            if (layerIndex > -1) {
                resultsTree.children.splice(layerIndex, 1);
                combinedOverlaysTree = {
                    label: 'Data',
                    children: [
                        overlaysTree,
                        resultsTree
                    ]
                };
                // Reinitialize the tree control to update it
                treeControl.remove();
                treeControl = L.control.layers.tree(baseMapsTree, combinedOverlaysTree, { collapsed: false }).addTo(map);
            }
        }
        
        updateMessageBox("Querying accidents in selected locations...")
        
        $.ajax ({
            url: '/api/get_crashes_byCustom_geojson',
            method: 'GET',
            data: { start_date: startDate, end_date: endDate, polygon: layer },
    
            success: function(data) {

                if (data[0].row_to_json.features === null) {
                    alert("No accidents are found.");
                    
                } else {
                    crashes = L.geoJSON(data[0].row_to_json, {
                        onEachFeature: onEachCrash
                    });
        
                    crashes.addTo(map);
        
                    // update layer control and messages
                    resultsTree.children.push({
                        label: 'Accidents',
                        layer: crashes
                    });
                    combinedOverlaysTree = {
                        label: 'Data',
                        children: [
                            overlaysTree,
                            resultsTree
                        ]
                    };
                    treeControl.remove();
                    treeControl = L.control.layers.tree(baseMapsTree, combinedOverlaysTree, { collapsed: false }).addTo(map); 
                    updateMessageBox("Accidents loaded successfully.");
        
                    console.log('Accidents loaded.');
        
                    map.on('overlayadd', function(e) {
                        if (speeds) {
                            speeds.bringToBack(); 
                        }
                        if (neighbourhoods){
                            neighbourhoods.bringToBack();
                        }
                    });            
                    map.on('overlayremove', function(e) {
                        if (speeds) {
                            speeds.bringToBack(); // Ensure polygon stays at the back if re-added
                        }
                        if (neighbourhoods){
                            neighbourhoods.bringToBack();
                        }
                    });     
                }
                resolve();
            },
            error: function(error) {
    
                console.error('Error:', error);
                alert("Error loading accidents. See action box for details.")
                updateMessageBox("Error loading crash data: " + error.responseText);
                reject(error);

            }
        });    
    });
}


//---------------------------- Score Functions ----------------------------//
// load scores
var scores;

var colorScale = chroma.scale(['red', 'yellow', 'green']).mode('lab');
// Function to normalize safety score and map it to a color
function getColor(safety, minSafety, maxSafety) {
    if (minSafety === maxSafety) {
        return colorScale(0.5).hex();  // Use a middle value if all scores are the same
    }
    
    let normalizedSafety = (safety - minSafety) / (maxSafety - minSafety);
    return colorScale(normalizedSafety).hex();
}
// Function to style the feature
function styleScore(feature, minSafety, maxSafety) {
    return {
        color: getColor(feature.properties.safety, minSafety, maxSafety), // Use the color based on normalized safety
        weight: 5,
        opacity: 1,
        fillOpacity: 0.7
    };
}
function onEachScore(feature, layer) {
    var popupContent = "Street name: " + feature.properties.name + 
                        "<br>Safety Score: " + parseFloat(feature.properties.safety).toFixed(2) ;
    layer.bindPopup(popupContent);
}
function addLegend(feature, layer){
    var legend = L.control({position: 'bottomright'});

    legend.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'info legend'),
            grades = [0, 0.2, 0.4, 0.6, 0.8, 1];  // The normalized safety score range

        // Loop through intervals to create a label with a color square for each interval
        div.innerHTML += '<h5>Street Safety Score</h5>';
        for (var i = 0; i < grades.length-1; i++) {
            let color = colorScale(grades[i]).hex(); // Get color for each grade
            div.innerHTML +=
                '<i style="background:' + color 
                + '; width: 18px; height: 18px; display: inline-block; margin-right: 8px; font-size: 18px;"></i> '
                + '<span style="font-size: 18px;">' 
                + (i === 0 ? '<' + Math.round(grades[i+1] * 100) + '<br>'
                : Math.round(grades[i] * 100) + '&ndash;' + Math.round(grades[i + 1] * 100) + '<br>') 
                + '</span>'
        }

        return div;
    };

    legend.addTo(map);
    return legend;
}
function calculateSafetyScore() {
    return new Promise((resolve, reject) => {

        // Remove old layer if exists
        if (scores) {
            map.removeLayer(scores);
            scores = null;

            var layerIndex = resultsTree.children.findIndex(layer => layer.label === 'Street Safety Scores');
            // If the layer exists, remove it
            if (layerIndex > -1) {
                resultsTree.children.splice(layerIndex, 1);
                combinedOverlaysTree = {
                    label: 'Data',
                    children: [
                        overlaysTree,
                        resultsTree
                    ]
                };
                // Reinitialize the tree control to update it
                treeControl.remove();
                treeControl = L.control.layers.tree(baseMapsTree, combinedOverlaysTree, { collapsed: false }).addTo(map);
            }
        }

        updateMessageBox("Loading score layer...");

        // AJAX request
        $.ajax({
            url: '/api/get_scores_geojson',
            method: 'GET',
            success: function(data) {

                var features = data[0].row_to_json.features;

                var minSafety = Math.min(...features.map(f => f.properties.safety));
                var maxSafety = Math.max(...features.map(f => f.properties.safety));

                scores = L.geoJSON(features, {
                    style: function(feature) {
                        return styleScore(feature, minSafety, maxSafety);
                    },
                    onEachFeature: onEachScore
                }).addTo(map);


                // Legend and control logic
                legend = addLegend();

                resultsTree.children.push({
                    label: 'Street Safety Scores',
                    layer: scores
                });
                combinedOverlaysTree = {
                    label: 'Data',
                    children: [
                        overlaysTree,
                        resultsTree
                    ]
                };
                treeControl.remove();
                treeControl = L.control.layers.tree(baseMapsTree, combinedOverlaysTree, { collapsed: false }).addTo(map);

                updateMessageBox("Street safety score loaded.");
                console.log('Street safety score loaded.');

                map.on('overlayadd', function(e) {
                    if (speeds) {
                        speeds.bringToBack();
                    }
                    if (neighbourhoods){
                        neighbourhoods.bringToBack();
                    }
                });
                map.on('overlayremove', function(e) {
                    if (speeds) {
                        speeds.bringToBack();
                    }
                    if (neighbourhoods){
                        neighbourhoods.bringToBack();
                    }
                });

                // Check if legend should be displayed
                function checkDisplayLineInfo() {
                    if (map.hasLayer(scores)) {
                        legend.getContainer().style.display = 'block';
                    } else {
                        legend.getContainer().style.display = 'none';
                    }
                }

                map.on('overlayadd', function(e) {
                    if (e.layer == scores) {
                        checkDisplayLineInfo();
                    }
                });
                map.on('overlayremove', function(e) {
                    if (e.layer == scores) {
                        checkDisplayLineInfo();
                    }
                });

                // Resolve the Promise after the success logic completes
                resolve();
            },
            error: function(error) {
                console.error('Error:', error);
                updateMessageBox("Error loading street safety score: " + error.responseText);
                // Reject the Promise in case of an error
                reject(error);
            }
        });
    });
}

var routes
// safety alert info
var info = L.control({ position:'bottomright'}); // create a control
info.onAdd = function (map) {   
    this._div = L.DomUtil.create('div','info'); // create a div, its type is info
    
    this._div.style.width = '250px'; // Set the width
    this._div.style.height = 'auto';  // Set the height, or a fixed height like '200px'
    this._div.style.padding = '10px';  // Add some padding
    this._div.style.backgroundColor = 'white'; // Background color
    this._div.style.border = '1px solid #ccc'; // Border
    this._div.style.borderRadius = '5px'; // Rounded corners

    this.update();
    return this._div;
};
info.update = function (props) {
    if (props && props.street_details && props.street_details.length > 0) {
        let segment = props.street_details[0];  // Access the first segment of the street_details array

        this._div.innerHTML = '<h3>Safety Information</h3>' +
            '<span style="font-size: 17px;">' +
            '<b>Street Name: ' + segment.name + '</b><br />' +
            '</span>' +
            '<span style="font-size: 17px;">' +
            'Safety Alert: ' + 
            (segment.prim_contr_factor ? 
                '<p style="font-size: 17px; color:red;">Accident-prone segment. <br>Primary contributor: ' +
                '<span style="font-size: 15px; color:red;">' + segment.prim_contr_factor + '</span></p>' :
                'None') +
            '</span>';
    } else {
        // Default message when no segment is selected or available
        this._div.innerHTML = '<h3>Safety Information</h3>' +
            '<span style="font-size: 17px; color: blue;">Blue line: shortest route</span>' +
            '<br><span style="font-size: 17px; color: green;">Green line: safest route</span>' + 
            '<br><span style="font-size: 17px;">Hover over a red segment to see safety alert</span>';
    }
};

function highlightFeature (e) {
	var layer = e.target;

	layer.setStyle({
		weight: 8,
	});

	layer.bringToFront();

	info.update(layer.feature.properties);
}
function resetHighlight (e) {
	routes.resetStyle(e.target);
	info.update();
}
function onEachRoute(feature, layer){
    var popupContent = feature.properties.route_type + " " + "route" +
                        "<br>Length: " + parseFloat(feature.properties.total_cost).toFixed(2) + 'km' +  
                        "<br>Safety Score: " + parseFloat(feature.properties.avg_safety_score).toFixed(2) ;

    layer.bindPopup(popupContent, { autoClose: false });

    // event listener
    layer.on({
		mouseover: highlightFeature,
		mouseout: resetHighlight,
	});
}
function getRouteColorByType(primContrFactor, routeType) {
    // If prim_contr_factor is not null, assign red color
    if (primContrFactor !== null) {
        return '#d62728';  // Red for streets with a contributing factor
    }
    switch (routeType) {
        case 'shortest':
            return '#1f77b4';  // Blue for shortest
        case 'safest':
            return '#2ca02c';  // Green for safest
    }
}
function styleEachRoute(feature) {
    let primContrFactor = feature.properties.street_details[0]?.prim_contr_factor;
    let routeType = feature.properties.route_type;

    // Define the style based on safety score and prim_contr_factor
    return {
        color: getRouteColorByType(primContrFactor, routeType),  // Line color
        weight: 5,  // Line thickness
        opacity: 0.8  // Line opacity
    };
}
function calculateRouteScore(lat1, lnt1, lat2, lnt2){
    return new Promise((resolve, reject) => {

        // Remove old layer if exists
        if (routes) {
            map.removeLayer(routes);
            routes = null;

            var layerIndex = resultsTree.children.findIndex(layer => layer.label === 'Route Safety Scores');
            // If the layer exists, remove it
            if (layerIndex > -1) {
                resultsTree.children.splice(layerIndex, 1);
                combinedOverlaysTree = {
                    label: 'Data',
                    children: [
                        overlaysTree,
                        resultsTree
                    ]
                };
                // Reinitialize the tree control to update it
                treeControl.remove();
                treeControl = L.control.layers.tree(baseMapsTree, combinedOverlaysTree, { collapsed: false }).addTo(map);
            }
        }

        var data = {
            lon1: lnt1,
            lat1: lat1,
            lon2: lnt2,
            lat2: lat2,
        }

        updateMessageBox("Loading score layer...");

        // AJAX request
        $.ajax({
            url: '/api/get_route_score_geojson',
            method: 'GET',
            data : data,
            success: function(data) {

                if (data[0].row_to_json.features === null) {
                    alert("No routes are found.");
                    
                } else{
                    var features = data[0].row_to_json.features;
                    routes = L.geoJSON(features, {
                        style: styleEachRoute,
                        onEachFeature: onEachRoute
                    }).addTo(map);
                    resultsTree.children.push({
                        label: 'Route Safety Scores',
                        layer: routes
                    });
                    combinedOverlaysTree = {
                        label: 'Data',
                        children: [
                            overlaysTree,
                            resultsTree
                        ]
                    };
                    treeControl.remove();
                    treeControl = L.control.layers.tree(baseMapsTree, combinedOverlaysTree, { collapsed: false }).addTo(map);
    
                    updateMessageBox("Route safety score loaded.");
                    console.log('Route safety score loaded.');

                    info.addTo(map);
    
                    map.on('overlayadd', function(e) {
                        if (speeds) {
                            speeds.bringToBack();
                        }
                        if (neighbourhoods){
                            neighbourhoods.bringToBack();
                        }
                    });
                    map.on('overlayremove', function(e) {
                        if (speeds) {
                            speeds.bringToBack();
                        }
                        if (neighbourhoods){
                            neighbourhoods.bringToBack();
                        }
                    });
    
                }

                // Check if legend should be displayed
                function checkDisplayLineInfo() {
                    if (map.hasLayer(routes)) {
                        info.getContainer().style.display = 'block';
                    } else {
                        info.getContainer().style.display = 'none';
                    }
                }

                map.on('overlayadd', function(e) {
                    if (e.layer == routes) {
                        checkDisplayLineInfo();
                    }
                });
                map.on('overlayremove', function(e) {
                    if (e.layer == routes) {
                        checkDisplayLineInfo();
                    }
                });

                // Resolve the Promise after the success logic completes
                resolve();
            },
            error: function(error) {
                console.error('Error:', error);
                updateMessageBox("Error loading route safety score: " + error.responseText);
                // Reject the Promise in case of an error
                reject(error);
            }
        });
    });
}