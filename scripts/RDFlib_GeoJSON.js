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

  async rename_feature(old_rdf_feature, new_rdf_feature) {
    var del1 = this.store.statementsMatching(old_rdf_feature, null, null);
    var ins1 = del1.map(x => {
      // TODO: should be able to do this with bindings argument?
      let x2 = x.substitute();
      x2.subject = new_rdf_feature;
      return x2;
    });
    var del2 = this.store.statementsMatching(null, null, old_rdf_feature);
    var ins2 = del2.map(x => {
      // TODO: should be able to do this with bindings argument?
      let x2 = x.substitute();
      x2.object = new_rdf_feature;
      return x2;
    });
    let del = [].concat(del1, del2);
    let ins = [].concat(ins1, ins2);
    await this.updater.update(del, ins);
    return new_rdf_feature;
  }

  async update_prop(feature) {
    if (feature.type !== "PropertyUpdate")
      throw new Error("Not a PropertyUpdate");

    var rdf_feature = feature._item.startsWith("http")
      ? $rdf.namedNode(feature._item)
      : $rdf.blankNode(feature._item);
    const DOC = $rdf.Namespace(this.doc + "#");
    if (Object.keys(feature.properties).includes("[URI]")) {
      let new_uri = feature.properties["[URI]"];
      new_uri = new_uri.startsWith("http")
        ? $rdf.namedNode(new_uri)
        : new_uri.startsWith("#")
        ? DOC(new_uri.replace("#", ""))
        : DOC(new_uri);
      rdf_feature = await this.rename_feature(rdf_feature, new_uri);
      feature.properties._item = rdf_feature;
    }

    var ins = Object.keys(feature.properties).map(key => {
      if (key == "[URI]" || key == "_item") return undefined;
      let value = feature.properties[key];
      if (value == "") return undefined;
      return $rdf.st(rdf_feature, DOC(key), value, $rdf.sym(this.doc));
    });
    var del = Object.keys(feature.properties).flatMap(key => {
      if (key == "[URI]" || key == "_item") return undefined;
      return this.store.match(rdf_feature, DOC(key), null);
    });
    ins = ins.filter(x => typeof x !== "undefined");
    del = del.filter(x => typeof x !== "undefined");
    await this.updater.update(del, ins);
    return feature.properties;
  }

  async delete(feature) {
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
      await this.updater.update(del, []);
    } catch (err) {
      alert(err);
    }
  }
}
