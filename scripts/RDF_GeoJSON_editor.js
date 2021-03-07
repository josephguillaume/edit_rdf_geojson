class RDF_GeoJSON_editor {
  constructor(map, doc) {
    this.map = map;
    this.doc = doc;
    this.layer = undefined;

    this.rdf_geojson = new RDFlib_GeoJSON(doc);

    var thisEditor = this;
    this.rdf_geojson
      .read()
      .then(geojson =>
        L.geoJSON(geojson, {
          onEachFeature: function (feature, layer) {
            layer.on("click", e => {
              // TODO: seems like there should be a better way of dealing with this
              if (
                thisEditor.map.pm.globalEditEnabled() ||
                thisEditor.map.pm.globalRemovalEnabled()
              )
                return false;
              thisEditor.show_property_editor(e.target.feature);
            });
          }
        })
      )
      .then(layer => {
        this.layer = layer;
        this.layer.on("pm:update", async function (e) {
          e.layer.setStyle({ color: "red" });
          let new_feature = await thisEditor.rdf_geojson.update(
            e.layer.toGeoJSON()
          );
          e.layer.remove();
          thisEditor.layer.addData(new_feature);
        });
        this.layer.addTo(this.map);
        let bounds = this.layer.getBounds();
        if (Object.keys(bounds).length) this.map.fitBounds(bounds);
      });

    this.map.on("pm:create", e => {
      e.layer.setStyle({ color: "red" });
      this.rdf_geojson.create(e.layer.toGeoJSON()).then(newFeature => {
        e.layer.remove();
        this.layer.addData(newFeature);
        thisEditor.show_property_editor(newFeature);
      });
    });

    this.map.on("pm:remove", e => {
      // workaround because pm:remove is only fired after layer is already removed
      // https://github.com/geoman-io/leaflet-geoman/blob/master/src/js/Mixins/Modes/Mode.Removal.js#L69
      e.layer.addTo(this.map);
      if (confirm("Delete feature?")) {
        e.layer.setStyle({ color: "red" });
        this.rdf_geojson
          .delete(e.layer.toGeoJSON())
          .then(() => e.layer.remove());
      }
    });
  }

  async delete_doc() {
    if (confirm("Delete WHOLE document?")) {
      let success = await this.rdf_geojson.delete_doc();
      if (success) {
        alert("Document deleted. Restarting...");
        // FIXME: seems cached geodata file might still be loaded
        window.location.reload(true);
      }
    }
  }

  show_property_editor(feature) {
    var property_editor = document.getElementById("property_editor");
    if (!property_editor) {
      var style = document.createElement("style");
      style.textContent = `
      #property_editor {
        position: fixed;
        width: 75%;
        height: 50%;
        background: white;
        z-index: 1000; /* Sit on top */
        top: 10%;
        text-align: center;
        align-self: center;
      }
      .hidden {
        display:none;
      }`;
      document.querySelector("head").appendChild(style);
      property_editor = document.createElement("div");
      property_editor.id = "property_editor";
      property_editor.innerHTML = `<table><thead><td>Property</td><td>Value</td></thead><tbody></tbody></table>
        <a onClick='document.getElementById("property_editor").classList.add("hidden")'>Close</a>`;
      document.querySelector("body").appendChild(property_editor);
    }
    property_editor.classList.remove("hidden");
    document.querySelector("#property_editor tbody").textContent = "";

    let row = document.createElement("tr");
    let feature_uri =
      feature.properties._item.termType == "BlankNode"
        ? ""
        : feature.properties._item.value.replace(this.doc, "");
    row.innerHTML = `
    <td class=key><i>[URI]</i></td>
    <td class=value contenteditable>${feature_uri}</td>`;
    property_editor.querySelector("tbody").appendChild(row);

    document
      .querySelector("#property_editor tbody")
      .setAttribute("data-rdfref", feature.properties._item.value);
    let feature_keys = Object.keys(feature.properties);
    // TODO: specify schema instead of autocompleting property keys?
    let all_keys = [
      ...new Set(
        this.toGeoJSON().features.flatMap(x => Object.keys(x.properties))
      )
    ];
    feature_keys.forEach(key => {
      if (key == "_item" || key == "_geom") return null;
      let value = feature.properties[key];
      let row = document.createElement("tr");
      row.innerHTML = `
      <td class="key" data-orig="${key}">${key}</td>
      <td class="value" contenteditable data-orig="${key}">${value}</td>
      `;
      property_editor.querySelector("tbody").appendChild(row);
    });
    all_keys
      .filter(x => !feature_keys.includes(x))
      .forEach(key => {
        if (key == "_item" || key == "_geom") return null;
        let row = document.createElement("tr");
        row.innerHTML = `
      <td class="key placeholder" data-orig="${key}">${key}</td>
      <td class="value" contenteditable data-orig="${key}"></td>
      `;
        property_editor.querySelector("tbody").appendChild(row);
      });

    row = document.createElement("tr");
    row.innerHTML = `
    <td class=key contenteditable></td>
    <td class=value contenteditable></td>`;
    property_editor.querySelector("tbody").appendChild(row);

    var thisEditor = this;
    Array.from(property_editor.querySelectorAll("tbody td")).forEach(td =>
      td.addEventListener("blur", e => thisEditor.save(e, feature))
    );
  }

  async save(e, feature) {
    let feature_ref = e.target.closest("tbody").getAttribute("data-rdfref");
    let key = e.target.closest("tr").querySelector(".key").innerText;
    let key_orig = e.target
      .closest("tr")
      .querySelector(".key")
      .getAttribute("data-orig");
    let value = e.target.closest("tr").querySelector(".value").innerText;
    let value_orig = e.target
      .closest("tr")
      .querySelector(".value")
      .getAttribute("data-orig");
    value_orig = value_orig ? value_orig : "";
    if ((key == "") | (value == value_orig)) return null;

    e.target.closest("tr").querySelector(".value").innerHTML +=
      "<span style='color:red'>&nbsp;saving</span>";
    let updated = await this.rdf_geojson.update({
      type: "PropertyUpdate",
      _item: feature_ref,
      properties: {
        [key]: value
      }
    });

    //TODO: more robust handling?
    key == "[URI]"
      ? (feature.properties._item = updated._item)
      : (feature.properties[key] = updated[key]);
    this.show_property_editor(feature);
  }

  toGeoJSON(clean = true) {
    let geojson = this.layer.toGeoJSON();
    geojson = JSON.parse(JSON.stringify(geojson));
    if (clean)
      geojson.features.forEach(x => {
        delete x.properties._geom;
        delete x.properties._item;
      });
    return geojson;
  }
}
