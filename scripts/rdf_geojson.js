const OGC = new $rdf.Namespace("http://www.opengis.net/ont/geosparql#");
function rdfToGeoJSON(
  store,
  source = null,
  getProps = true,
  getRDFItems = false,
  match = {}
) {
  if (Array.isArray(store)) {
    ins = store;
    store = $rdf.graph();
    store.add(ins);
  }
  if (typeof source === "string") {
    source = $rdf.sym(source);
  }
  geoms = store.match(match.geom, OGC("asWKT"), null, source);
  geojson = {
    type: "FeatureCollection",
    features: geoms.map(st => {
      wkt = new Wkt.Wkt();
      wkt.read(st.object.value);
      geom = wkt.toJson();
      // Assumes there is only a single feature with given geometry and wkt
      item = match.feature
        ? match.feature
        : store.any(null, OGC("hasGeometry"), st.subject);
      var props = {};
      if (getProps) {
        props_st = store.match(item, null, null);
        props_st.forEach(prop_st => {
          // TODO: assumes encoding with uri#field
          field = prop_st.predicate.value.split("#")[1];
          if (field == "hasGeometry") return false;
          value = $rdf.Literal.toJS(prop_st.object);
          props[field] = value;
        });
      }
      if (getRDFItems) {
        props._geom = st.subject;
        props._item = item;
      }
      return {
        type: "Feature",
        properties: props,
        geometry: geom
      };
    })
  };
  return geojson;
}

function GeoJSONtoRDF(geojson, doc) {
  if (geojson.type == "Feature")
    geojson = { type: "FeatureCollection", features: [geojson] };
  if (geojson.type !== "FeatureCollection")
    throw new Error("Expected FeatureCollection");
  // TODO: crs, name
  var ins = [];
  geojson.features.forEach(feature => {
    wkt = new Wkt.Wkt();
    txt = wkt.fromJson(feature);
    let geom =
      feature.properties && feature.properties._geom
        ? feature.properties._geom
        : $rdf.blankNode();
    let rdf_feature =
      feature.properties && feature.properties._item
        ? feature.properties._item
        : $rdf.blankNode();
    ins.push(
      $rdf.st(
        geom,
        OGC("asWKT"),
        $rdf.lit(txt, OGC("wktLiteral")),
        $rdf.namedNode(doc)
      )
    );
    ins.push(
      $rdf.st(rdf_feature, OGC("hasGeometry"), geom, $rdf.namedNode(doc))
    );
    Object.keys(feature.properties).forEach(prop => {
      if (prop == "_item" || prop == "_geom") return null;
      ins.push(
        $rdf.st(
          rdf_feature,
          $rdf.sym(doc + "#" + prop),
          feature.properties[prop],
          $rdf.namedNode(doc)
        )
      );
    });
  });
  return ins;
}
