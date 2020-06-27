/*
<script src="scripts/solid-auth-client.bundle.js"></script>
<script src="scripts/rdflib.min.js"></script>
CSS:
#solid-browser
.browser-folder
.browser-file
*/
const SOLID = new $rdf.Namespace("http://www.w3.org/ns/solid/terms#");
const SP = new $rdf.Namespace("http://www.w3.org/ns/pim/space#");
const LDP = new $rdf.Namespace("http://www.w3.org/ns/ldp#");
class SolidBrowser {
  constructor(solid_session, action, init, options) {
    if (typeof options === "undefined") options = {};
    if (options.store) {
      this.store = options.store;
      this.fetcher = this.store.fetcher;
    } else {
      this.store = $rdf.graph();
      this.fetcher = new $rdf.Fetcher(this.store);
    }
    // TODO: handle not logged in
    this.session = solid_session;
    this.action = action;
    this.folder_history = [];
    if (!init) init = this.browse_storage;
    if (typeof init === "string") init = this[init];
    this.options = options;
    if (typeof options.prompt === "undefined")
      this.options.prompt = "Select file";
    if (!options.wait) this.fetch_storage().then(() => init(this));
  }

  async fetch_storage() {
    await this.fetcher.load(this.session.webId);
    this.storage = this.store.match(null, SP("storage"), null)[0].object;
    this.folder_history.push(this.storage.value);
  }
  async browse(folder) {
    await this.fetcher.load(folder, {
      // TODO: workaround for https://github.com/linkeddata/rdflib.js/issues/426
      headers: { accept: "text/turtle" }
    });
    var files = this.store
      .match($rdf.namedNode(folder), LDP("contains"), null)
      .map(x => x.object.value);
    const folders = this.store
      .match(null, null, LDP("Container"))
      .map(x => x.subject.value);
    const history_index = this.folder_history.indexOf(folder);
    if (history_index >= 0)
      this.folder_history =
        history_index == 0 ? [] : this.folder_history.slice(0, history_index);

    var div = document.getElementById("solid-browser");
    if (!div) {
      div = document.createElement("div");
      div.setAttribute("id", "solid-browser");
      document.querySelector("body").appendChild(div);
    }
    div.setAttribute("style", "display:block");
    div.innerHTML = this.options.prompt + "<br/>";
    div.innerHTML += this.folder_history
      .map(o => `<a class=browser-folder data-target='${o}'>${o}</a><br/>`)
      .join("");
    if (this.folder_history[this.folder_history.length - 1] != folder)
      this.folder_history.push(folder);
    div.innerHTML += `<b>${folder}:</b><br/>`;
    div.innerHTML += files
      .map(o =>
        folders.includes(o)
          ? `<a class='browser-folder' data-target='${o}'>${o}</a><br/>`
          : `<a class='browser-file' data-target='${o}'>${o}</a><br/>`
      )
      .join("");
    div.innerHTML += `<a class='browser-new' data-target='${folder}'>New file in this folder</a>`;

    document
      .querySelectorAll("#solid-browser > .browser-folder")
      .forEach(el =>
        el.addEventListener("click", e =>
          this.browse(e.target.getAttribute("data-target"))
        )
      );
    document
      .querySelectorAll("#solid-browser > .browser-file")
      .forEach(el =>
        el.addEventListener("click", e =>
          this.select(e.target.getAttribute("data-target"))
        )
      );
    document.querySelectorAll("#solid-browser > .browser-new").forEach(el =>
      el.addEventListener("click", e => {
        var filename = prompt("Filename?");
        this.select(e.target.getAttribute("data-target") + filename);
      })
    );
  }
  select(file) {
    const ok = confirm(`${this.options.prompt}\nUse ${file}?`);
    if (ok) {
      this.action(file);
      document
        .getElementById("solid-browser")
        .setAttribute("style", "display:none");
    }
  }

  browse_storage(browser) {
    browser.browse(browser.storage.value);
  }

  async browse_cookie_default(browser) {
    var cookie_name = browser.options.cookie_name;
    var doc_default = decodeURIComponent(document.cookie)
      .split(";")
      .filter(x => x.indexOf(cookie_name + "=") > -1);
    if (doc_default.length > 0) {
      doc_default = doc_default[0]
        .replace(cookie_name + "=", "")
        .replace(/ /g, "");
      await browser.browse(
        doc_default.slice(0, doc_default.lastIndexOf("/") + 1)
      );
      // TODO: why is the timeout needed to update the dom?
      setTimeout(() => browser.select(doc_default), 100);
    } else {
      browser.browse(browser.storage.value);
    }
  }

  save_cookie_default(value) {
    var d = new Date();
    d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
    var expires = "expires=" + d.toUTCString();
    document.cookie =
      this.options.cookie_name +
      "=" +
      encodeURIComponent(value) +
      ";" +
      expires +
      ";path=/";
  }
}
