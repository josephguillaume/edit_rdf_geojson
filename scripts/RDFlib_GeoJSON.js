class RDFlib_GeoJSON {
  constructor(doc) {
    this.store = $rdf.graph();
    this.fetcher = new $rdf.Fetcher(this.store);
    this.updater = new $rdf.UpdateManager(this.store);
    this.doc = doc;
  }

  async create(feature) {
    const ins = GeoJSONtoRDF(feature, this.doc);
    var store = this.store;
    await this.updater.update([], ins);
    // TODO: avoid hardcoding order?
    feature.properties._item = ins[1].subject;
    feature.properties._geom = ins[0].subject;
    return feature;
  }

  async read() {
    await this.fetcher.load(this.doc);
    return rdfToGeoJSON(this.store, this.doc, true, true);
  }

  async update(feature) {
    if (feature.type == "PropertyUpdate") return this.update_prop(feature);

    const ins = GeoJSONtoRDF(feature, this.doc);
    if (typeof feature.properties._item === "undefined")
      throw new Error(
        "feature did not come from rdf store (properties._item missing)"
      );
    const rdf_feature = feature.properties._item;
    const geom = this.store.any(rdf_feature, OGC("hasGeometry"), null);
    if (geom === null) throw new Error("feature hasGeometry does not exist");
    if (geom.value != feature.properties._geom.value)
      throw new Error("feature _geom does not match value in rdf store");
    const del = [].concat(
      this.store.match(rdf_feature),
      this.store.match(geom)
    );
    try {
      await this.updater.update(del, ins);
    } catch (err) {
      alert(err);
    }
    return rdfToGeoJSON(this.store, this.doc, true, true, {
      // TODO: avoid relying on order?
      feature: ins[1].subject,
      geom: ins[0].subject
    });
  }

  async update_prop(feature) {
    if (feature.type !== "PropertyUpdate")
      throw new Error("Not a PropertyUpdate");
    // TODO: handle non-blank node
    const rdf_feature = $rdf.blankNode(feature._item);
    const DOC = $rdf.Namespace(this.doc + "#");
    var ins = Object.keys(feature.properties).map(key => {
      let value = feature.properties[key];
      if (value == "") return undefined;
      return $rdf.st(rdf_feature, DOC(key), value, $rdf.sym(this.doc));
    });
    var del = Object.keys(feature.properties).flatMap(key => {
      return this.store.match(rdf_feature, DOC(key), null);
    });
    await this.updater.update(del, ins);
    return feature.properties;
  }

  delete(feature) {
    if (typeof feature.properties._item === "undefined")
      throw new Error(
        "feature did not come from rdf store (properties._item missing)"
      );
    const rdf_feature = feature.properties._item;
    const geom = this.store.any(rdf_feature, OGC("hasGeometry"), null);
    if (geom === null) throw new Error("feature hasGeometry does not exist");
    if (geom.value != feature.properties._geom.value)
      throw new Error("feature _geom does not match value in rdf store");
    const del = [].concat(
      this.store.match(rdf_feature),
      this.store.match(geom)
    );
    this.updater.update(del, [], (uri, ok, message) => {
      if (ok) {
        console.log("deleted");
      } else throw new Error(message);
    });
  }
}
