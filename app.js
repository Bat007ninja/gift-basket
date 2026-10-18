import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection,
  serverTimestamp, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = document.getElementById("app");
let unsubscribers = [];

// ---------- helpers ----------

const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content; };
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const randomId = (len = 20) => {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(len)), (b) => chars[b % chars.length]).join("");
};
const domainOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };
const safeUrl = (url) => /^https?:\/\//i.test(url) ? url : "";
const baseUrl = () => location.href.split("#")[0];

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
};
// Baskets this browser created: [{ listId, editKey, title }]
const myBaskets = () => store.get("myBaskets", []);
const rememberBasket = (b) => store.set("myBaskets", [b, ...myBaskets().filter((x) => x.listId !== b.listId)]);
const isMine = (listId) => myBaskets().some((b) => b.listId === listId);

function toast(msg) {
  const el = h(`<div class="toast">${esc(msg)}</div>`).firstChild;
  document.body.append(el);
  setTimeout(() => el.remove(), 2200);
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Link copied"); }
  catch { prompt("Copy this link:", text); }
}

// ---------- setup check ----------

const configured = firebaseConfig.apiKey && firebaseConfig.projectId;
let db;
if (configured) db = getFirestore(initializeApp(firebaseConfig));

// ---------- router ----------

function route() {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  window.scrollTo(0, 0);
  if (!configured) return renderSetup();

  const [, page, a] = location.hash.split("/");
  if (page === "edit" && a) return renderOwner(a);
  if (page === "b" && a) return renderGifter(a);
  renderHome();
}
window.addEventListener("hashchange", route);
route();

// ---------- pages ----------

function renderSetup() {
  app.replaceChildren(h(`
    <section class="card">
      <h1>Almost there</h1>
      <p>This site needs a free Firebase database to store baskets.</p>
      <p>Open <code>firebase-config.js</code> and paste in your Firebase config — the
      <code>README.md</code> walks through it step by step (about 5 minutes).</p>
    </section>`));
}

function renderHome() {
  const mine = myBaskets();
  app.replaceChildren(h(`
    <section class="card">
      <h1>Make a gift basket</h1>
      <p class="muted">Add links to things you'd love. Share the link with friends and family —
      they can tick off what they've bought so nobody double-buys, and you never see what's been bought.</p>
      <form id="create" class="stack">
        <label>Your name<input name="owner" required maxlength="40" placeholder="e.g. Connor"></label>
        <label>Basket name<input name="title" required maxlength="100" placeholder="e.g. Birthday 2026"></label>
        <button class="primary">Create basket</button>
      </form>
    </section>
    ${mine.length ? `
    <section class="card">
      <h2>Your baskets</h2>
      <ul class="plain">
        ${mine.map((b) => `<li><a href="#/edit/${esc(b.editKey)}">${esc(b.title)}</a></li>`).join("")}
      </ul>
      <p class="muted small">Only on this device. Keep your edit link somewhere safe to use another device.</p>
    </section>` : ""}`));

  app.querySelector("#create").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    const listId = randomId(), editKey = randomId(24);
    const title = f.get("title").trim(), owner = f.get("owner").trim();
    try {
      await setDoc(doc(db, "lists", listId), { title, owner, items: [], created: serverTimestamp(), updated: serverTimestamp() });
      await setDoc(doc(db, "owners", editKey), { listId });
      rememberBasket({ listId, editKey, title });
      location.hash = `#/edit/${editKey}`;
    } catch (err) {
      console.error(err);
      toast("Couldn't create basket — check your Firebase setup");
      btn.disabled = false;
    }
  });
}

// The basket owner's page. Deliberately never reads the "claims" collection.
async function renderOwner(editKey) {
  const ownerSnap = await getDoc(doc(db, "owners", editKey)).catch(() => null);
  if (!ownerSnap?.exists()) return renderNotFound();
  const { listId } = ownerSnap.data();
  const listRef = doc(db, "lists", listId);
  const giftLink = `${baseUrl()}#/b/${listId}`;
  const editLink = `${baseUrl()}#/edit/${editKey}`;

  app.replaceChildren(h(`
    <section class="card">
      <p class="eyebrow">Your basket</p>
      <h1 id="title"></h1>
      <div class="share">
        <div>
          <strong>Share with gift-givers</strong>
          <p class="muted small">Send this to friends &amp; family.</p>
        </div>
        <button class="primary" id="copyGift">Copy share link</button>
      </div>
      <details class="small">
        <summary>Your private edit link</summary>
        <p class="muted">Bookmark this to edit your basket from any device. Don't share it.</p>
        <p class="linkbox">${esc(editLink)}</p>
        <button id="copyEdit">Copy edit link</button>
      </details>
    </section>
    <section class="card">
      <h2>Add a gift</h2>
      <form id="add" class="stack">
        <label>Link<input name="url" type="url" required placeholder="https://…"></label>
        <label>What is it?<input name="title" maxlength="120" placeholder="Leave blank to use the website name"></label>
        <div class="row">
          <label><span>Price <span class="muted">(optional)</span></span><input name="price" maxlength="20" placeholder="£25"></label>
          <label><span>Note <span class="muted">(optional)</span></span><input name="note" maxlength="200" placeholder="Size M, blue"></label>
        </div>
        <button class="primary">Add to basket</button>
      </form>
    </section>
    <section>
      <ul id="items" class="items"></ul>
    </section>`));

  app.querySelector("#copyGift").onclick = () => copy(giftLink);
  app.querySelector("#copyEdit").onclick = () => copy(editLink);

  let current = null;
  unsubscribers.push(onSnapshot(listRef, (snap) => {
    if (!snap.exists()) return renderNotFound();
    current = snap.data();
    rememberBasket({ listId, editKey, title: current.title });
    app.querySelector("#title").textContent = current.title;
    const list = app.querySelector("#items");
    list.replaceChildren(current.items.length ? "" : h(`<li class="empty">No gifts yet — add your first link above.</li>`));
    current.items.forEach((item) => {
      const li = itemCard(item, `<button class="danger" data-del="${esc(item.id)}">Remove</button>`);
      list.append(li);
    });
  }));

  app.querySelector("#items").addEventListener("click", async (e) => {
    const id = e.target.dataset.del;
    if (!id || !confirm("Remove this gift from your basket?")) return;
    await updateDoc(listRef, { items: current.items.filter((i) => i.id !== id), updated: serverTimestamp() });
  });

  app.querySelector("#add").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const url = f.get("url").trim();
    const item = {
      id: randomId(10),
      url,
      title: f.get("title").trim() || domainOf(url) || url,
      price: f.get("price").trim(),
      note: f.get("note").trim()
    };
    try {
      await updateDoc(listRef, { items: arrayUnion(item), updated: serverTimestamp() });
      e.target.reset();
      e.target.url.focus();
    } catch (err) {
      console.error(err);
      toast("Couldn't add that gift");
    }
  });
}

// The page gift-givers see, with live "bought" ticks.
function renderGifter(listId) {
  if (isMine(listId) && !sessionStorage.getItem(`peek:${listId}`)) {
    app.replaceChildren(h(`
      <section class="card center">
        <h1>🙈 Spoiler alert</h1>
        <p>This looks like <strong>your own</strong> basket. The page beyond shows what people have already bought for you.</p>
        <div class="row center">
          <a class="button primary" href="#/edit/${esc(myBaskets().find((b) => b.listId === listId).editKey)}">Take me to my edit page</a>
          <button id="peek">I'm not the owner, show it</button>
        </div>
      </section>`));
    app.querySelector("#peek").onclick = () => { sessionStorage.setItem(`peek:${listId}`, "1"); route(); };
    return;
  }

  app.replaceChildren(h(`
    <section class="card">
      <p class="eyebrow" id="owner"></p>
      <h1 id="title"></h1>
      <p class="muted small">Tick a gift when you buy it so nobody else buys it too. The owner of this basket can't see what's ticked.</p>
    </section>
    <section><ul id="items" class="items"></ul></section>`));

  let list = null, claims = {};
  const draw = () => {
    if (!list) return;
    app.querySelector("#owner").textContent = `${list.owner}'s basket`;
    app.querySelector("#title").textContent = list.title;
    document.title = `${list.owner}'s basket · ${list.title}`;
    const ul = app.querySelector("#items");
    ul.replaceChildren(list.items.length ? "" : h(`<li class="empty">Nothing in this basket yet.</li>`));
    // Unbought first, keeping the owner's order otherwise
    const sorted = [...list.items].sort((a, b) => !!claims[a.id] - !!claims[b.id]);
    sorted.forEach((item) => {
      const c = claims[item.id];
      const action = c
        ? `<span class="bought">✓ Bought${c.by ? ` by ${esc(c.by)}` : ""}</span>
           <button class="link" data-unclaim="${esc(item.id)}">Undo</button>`
        : `<button class="primary" data-claim="${esc(item.id)}">I bought this</button>`;
      ul.append(itemCard(item, action, !!c));
    });
  };

  unsubscribers.push(onSnapshot(doc(db, "lists", listId), (snap) => {
    if (!snap.exists()) return renderNotFound();
    list = snap.data();
    draw();
  }, () => renderNotFound()));

  unsubscribers.push(onSnapshot(collection(db, "lists", listId, "claims"), (snap) => {
    claims = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
    draw();
  }));

  app.querySelector("#items").addEventListener("click", async (e) => {
    const { claim, unclaim } = e.target.dataset;
    if (claim) {
      const name = prompt("Your name (so others know who bought it — optional):", store.get("gifterName", ""));
      if (name === null) return;
      store.set("gifterName", name.trim());
      await setDoc(doc(db, "lists", listId, "claims", claim), { by: name.trim().slice(0, 60), at: serverTimestamp() });
      toast("Ticked off — thanks!");
    }
    if (unclaim && confirm("Mark this as NOT bought?")) {
      await deleteDoc(doc(db, "lists", listId, "claims", unclaim));
    }
  });
}

function renderNotFound() {
  app.replaceChildren(h(`
    <section class="card center">
      <h1>Basket not found</h1>
      <p class="muted">Check the link is complete, or ask the person who sent it.</p>
      <a class="button" href="#/">Make your own basket</a>
    </section>`));
}

function itemCard(item, actionsHtml, done = false) {
  const url = safeUrl(item.url);
  return h(`
    <li class="item${done ? " done" : ""}">
      <div class="item-main">
        <a class="item-title" ${url ? `href="${esc(url)}" target="_blank" rel="noopener noreferrer"` : ""}>${esc(item.title)}</a>
        <div class="meta">
          ${domainOf(item.url) && domainOf(item.url) !== item.title ? `<span>${esc(domainOf(item.url))}</span>` : ""}
          ${item.price ? `<span class="price">${esc(item.price)}</span>` : ""}
        </div>
        ${item.note ? `<p class="note">${esc(item.note)}</p>` : ""}
      </div>
      <div class="item-actions">${actionsHtml}</div>
    </li>`).firstChild;
}
