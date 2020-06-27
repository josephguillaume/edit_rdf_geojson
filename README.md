# Edit GeoJSON in RDF format on a Solid server

Available at https://josephguillaume.github.io/edit_rdf_geojson/

- GeoJSON is converted to/from RDF in [rdf_geojson.js](scripts/rdf_geojson.js), as a set of blank nodes with properties mapped to triples, and geometry specified using `OGC:hasGeometry` and `OGC:asWKT` (converted using [wicket](https://github.com/arthur-e/Wicket))
- GeoJSON is loaded/saved in [RDFlib_GeoJSON.js](scripts/RDFlib_GeoJSON.js) using [rdflib.js](https://github.com/linkeddata/rdflib.js/) and [solid-auth-client](https://github.com/solid/solid-auth-client). References to blank nodes are stored in GeoJSON with the pseudo-properties `_item` and `_geom`. A CRUD interface is provided + a function to update only feature properties (`update_prop`)
- UI for editing GeoJSON is provided by [leaflet-geoman](https://github.com/geoman-io/leaflet-geoman), with operations handled by [RDF_GeoJSON_editor.js](scripts/RDF_GeoJSON_editor.js) including a simple property editor

On load, the page shows only a map and login button. After login, the user's `pim` workspace is found from their webid card, and a simple file browser allows creating or selecting a new RDF-GeoJSON file ([solid_browser.js](scripts/solid_browser.js)). The last opened file is saved as a cookie and suggested next time the app is opened. While saving to the solid server features are shown in red.

The setup of `leaflet-geoman` in [index.html](index.html) only allows polygons to be created and edited. Only limited testing has been performed.

License: MIT. Also see: [rdflib.js](https://github.com/linkeddata/rdflib.js/), [solid-auth-client](https://github.com/solid/solid-auth-client), [leaflet-geoman](https://github.com/geoman-io/leaflet-geoman); [leafletjs](https://leafletjs.com/); [wicket](https://github.com/arthur-e/Wicket)
