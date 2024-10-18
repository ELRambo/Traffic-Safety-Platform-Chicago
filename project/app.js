const express = require('express');
const app = express();
const bodyParser = require('body-parser');

app.use(bodyParser.json()); // for parsing post data that has json format//
app.use(express.static('js'))
app.use(express.static('css'))
app.use(express.static('img'))

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT, DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type') ; next();
});

const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'SDB', schema: 'project', password: '', port: 5432});
pool.connect((err, client, release) => {
    if (err) {
      console.error('Error acquiring client', err.stack);
    } else {
      console.log('Connected to the database');
    }
    release();
});
  
app.get('/api/get_streets_geojson', (req, res) => {
    const query = `
      SELECT row_to_json(fc) 
      FROM (
        SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features 
        FROM (
          SELECT 'Feature' As type, 
                 ST_AsGeoJSON(lg.geometry)::json As geometry, 
                 row_to_json((SELECT l FROM (SELECT id, name, length, type) As l)) As properties 
          FROM streets As lg
        ) As f
      ) As fc;
    `;
    pool.query(query, (err, dbResponse) => {
      if (err) console.log(err); 
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(dbResponse.rows);
    });
});

app.get('/api/get_cameras_geojson', (req, res) => {
  const query = `
    SELECT row_to_json(fc) 
    FROM (
      SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features 
      FROM (
        SELECT 'Feature' As type, 
               ST_AsGeoJSON(lg.geometry)::json As geometry, 
               row_to_json((SELECT l FROM (SELECT id, lat, lnt) As l)) As properties 
        FROM cameras As lg
      ) As f
    ) As fc;
  `;
  pool.query(query, (err, dbResponse) => {
    if (err) console.log(err); 
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(dbResponse.rows);
  });
});

app.get('/api/get_speeds_geojson', (req, res) => {
  const query = `
    SELECT row_to_json(fc) 
    FROM (
      SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features 
      FROM (
        SELECT 'Feature' As type, 
               ST_AsGeoJSON(lg.geometry)::json As geometry, 
               row_to_json((SELECT l FROM (SELECT id, speed) As l)) As properties 
        FROM region_speeds As lg
      ) As f
    ) As fc;
  `;
  pool.query(query, (err, dbResponse) => {
    if (err) console.log(err); 
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(dbResponse.rows);
  });
});

app.get('/api/get_neighbourhoods_geojson', (req, res) => {
  const query = `
    SELECT row_to_json(fc) 
    FROM (
      SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features 
      FROM (
        SELECT 'Feature' As type, 
               ST_AsGeoJSON(lg.geometry)::json As geometry, 
               row_to_json((SELECT l FROM (SELECT pri_neigh) As l)) As properties 
        FROM project.neighbourhoods As lg
      ) As f
    ) As fc;
  `;
  pool.query(query, (err, dbResponse) => {
    if (err) console.log(err); 
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(dbResponse.rows);
  });
});

app.get('/api/get_crashes_byNeighbourhood_geojson', (req, res) => {
  const { start_date, end_date, neigh } = req.query;

  const query = `
    SELECT row_to_json(fc) 
    FROM (
      SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features 
      FROM (
        SELECT 'Feature' As type, 
              ST_AsGeoJSON(c.geometry)::json As geometry, 
              row_to_json((SELECT l FROM (SELECT c.id, c.date, c.inj_total, c.lnt, c.lat) As l)) As properties 
        FROM crashes c
        JOIN neighbourhoods n ON ST_Contains(n.geometry, c.geometry)
        WHERE n.pri_neigh = $3
          AND CAST(TO_TIMESTAMP(c.date, 'MM/DD/YYYY HH:MI:SS AM') AS DATE)
            BETWEEN TO_DATE($1, 'MM/DD/YYYY') 
            AND TO_DATE($2, 'MM/DD/YYYY')
      ) As f
    ) As fc;  
  `;

  pool.query(query, [start_date, end_date, neigh], (err, dbResponse) => {
    if (err) console.log(err); 
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (dbResponse.rows.length === 0) {
      return res.status(404).json({ error: 'No data found for the specified neighbourhood.' });
    }
    res.send(dbResponse.rows);
  });
});

app.get('/api/get_crashes_byCustom_geojson', (req, res) => {
  const { start_date, end_date, polygon } = req.query;

  const query = `
    SELECT row_to_json(fc) 
    FROM (
      SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features 
      FROM (
        SELECT 'Feature' As type, 
              ST_AsGeoJSON(c.geometry)::json As geometry, 
              row_to_json((SELECT l FROM (SELECT c.id, c.date, c.inj_total, c.lnt, c.lat) As l)) As properties 
        FROM crashes c
        WHERE ST_Contains(ST_GeomFromGeoJSON($3), c.geometry)
        AND CAST(TO_TIMESTAMP(c.date, 'MM/DD/YYYY HH:MI:SS AM') AS DATE)
            BETWEEN TO_DATE($1, 'MM/DD/YYYY') 
            AND TO_DATE($2, 'MM/DD/YYYY')
      ) As f
    ) As fc;
`;

  pool.query(query, [start_date, end_date, polygon], (err, dbResponse) => {
    console.log(query);
    if (err) console.log(err); 
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (dbResponse.rows.length === 0) {
      return res.status(404).json({ error: 'No data found for the specified location.' });
    }
    res.send(dbResponse.rows);
  });
});


app.get('/api/get_scores_geojson', (req, res) => {
  const query = `
    SELECT row_to_json(fc) 
    FROM (
      SELECT 'FeatureCollection' AS type, array_to_json(array_agg(f)) AS features 
      FROM (
        SELECT 
          'Feature' AS type, 
          ST_AsGeoJSON(s.geometry)::json AS geometry, 
          row_to_json((SELECT l FROM (SELECT s.id, s.name, s.safety) AS l)) AS properties 
        FROM streets s
        WHERE s.safety is not null
      ) AS f
    ) AS fc;
  `;
  pool.query(query, (err, dbResponse) => {
    if (err) console.log(err); 
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(dbResponse.rows);
  });
});

app.get('/api/get_route_score_geojson', (req, res) => {
  const { lon1, lat1, lon2, lat2 } = req.query;

  const query = `
    WITH start_node AS (
        -- Find the closest street node to the starting point
        SELECT id AS node_id
        FROM streets_vertices_pgr s
        ORDER BY s.the_geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)  -- Starting point (Navy Pier)
        LIMIT 1
    ),
    end_node AS (
        -- Find the closest street node to the ending point
        SELECT id AS node_id
        FROM streets_vertices_pgr s
        ORDER BY s.the_geom <-> ST_SetSRID(ST_MakePoint($3, $4), 4326)  -- Ending point (United Center)
        LIMIT 1
    ),
    routes AS (
        -- Compute the top 3 shortest paths between the start and end nodes using pgr_ksp
        SELECT * FROM pgr_ksp(
            'SELECT id, name, source, target, length AS cost FROM streets',
            (SELECT node_id FROM start_node),
            (SELECT node_id FROM end_node),
            3,  -- Get the 3 shortest paths
            directed := false
        )
    ),
    route_safety AS (
        -- Calculate the average safety score and total cost for each of the 3 shortest paths
        SELECT 
            r.path_id,  -- The unique path identifier
            SUM(r.cost/1000) AS total_cost,  -- The total cost of the path
            AVG(s.safety) AS avg_safety_score  -- Average safety score of the streets in the path
        FROM routes r
        JOIN streets s ON s.id = r.edge  -- Join streets on the edge ID (which represents a street segment)
        WHERE s.safety IS NOT NULL
        GROUP BY r.path_id
        ORDER BY total_cost ASC  -- Order by total cost to get the least costly paths
        LIMIT 3  -- Limit to the top 3 least cost paths
    )
    -- Convert the result to GeoJSON
    SELECT row_to_json(fc)
    FROM (
        SELECT 'FeatureCollection' AS type, array_to_json(array_agg(f)) AS features
        FROM (
            SELECT 'Feature' AS type, 
                  ST_AsGeoJSON(s.geometry)::json AS geometry,  -- Convert the street geometry to GeoJSON
                  row_to_json((SELECT l FROM (SELECT r.path_id, rs.total_cost, rs.avg_safety_score, s.name, s.prim_contr_factor) AS l)) AS properties
            FROM streets s
            JOIN routes r ON s.id = r.edge  -- Join the streets with routes
            JOIN route_safety rs ON r.path_id = rs.path_id  -- Join to get the calculated safety score and cost
        ) AS f
    ) AS fc;
   `;
  pool.query(query, [lon1, lat1, lon2, lat2], (err, dbResponse) => {
    if (err) console.log(err); 
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(dbResponse.rows);
  });
});


app.post ('/report_accidents', (req , res) => {
    console.log ('Data recieved:' + JSON.stringify (req.body));

    // Get the current length (row count) of the `crashes` table
    var countQuery = "SELECT COUNT(*) AS total FROM crashes";

    pool.query(countQuery, (err, countResult) => {
        if (err) {
            console.log(err);
            res.status(500).send('Error fetching row count.');
            return;
        }

        // Get the total number of rows from the countResult
        var rowCount = parseInt(countResult.rows[0].total) + 1; // Increment by 1 for the new ID

        // Insert the new accident report with the calculated id
        var q = "INSERT INTO crashes2(gid, date, prim_contr, traffic_co, inj_total, lnt, lat, geometry) VALUES (" +
            rowCount + "," +
            "'" + req.body.date + "'," +
            "'" + req.body.prim_contr + "'," +
            "'" + req.body.traffic_co + "'," +
            req.body.inj_total + "," +
            req.body.lnt + "," +
            req.body.lat + "," + 
            "ST_GeomFromText('POINT(" + req.body.lnt + " " + req.body.lat + ")', 4326));";

        pool.query(q, (err, dbResponse) => {
            if (err) {
                console.log(err);
                res.status(500).send('Error inserting data.');
                return;
            }

            res.status(200).send('Accident report successfully added.');
        });
    });
});   

app.get('/index', (req, res) => res.sendFile(__dirname + '/html/index.html'))
app.get('/map', (req, res) => res.sendFile(__dirname + '/html/map.html'))
app.get('/statistics', (req, res) => res.sendFile(__dirname + '/html/statistics.html'))

app.listen(3000, () => console.log('Example app listening on port 3000!'));

