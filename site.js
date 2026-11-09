"use strict";

// The address and key are public by design. The database only answers this one
// question for visitors, and only about players who turned their page on.
const SUPABASE = "https://ymicynuphdgtcqsvmdxr.supabase.co";
const KEY = "sb_publishable_Y3Xcdzw6FIcBVgMFa1Prrg_lrY2ZG8-";
const SILHOUETTE = "M12 12.5a4.75 4.75 0 1 0 0-9.5 4.75 4.75 0 0 0 0 9.5zM3.5 22c.6-5 4-7.5 8.5-7.5s7.900 2.500 8.500 7.500z";

const TIERS = [["Steel", "#b9bcc7", "#5b5e6b"], ["Bronze", "#e0a370", "#7a4a26"], ["Silver", "#e8edf5", "#8a94a6"], ["Gold", "#ffd978", "#a8741a"], ["Jade", "#7df0bf", "#17805a"], ["Sapphire", "#7fc4ff", "#1d5bb8"], ["Amethyst", "#cdaaff", "#6a35c2"], ["Crimson", "#ff8a9c", "#a81f3c"], ["Prism", "#a9f0ff", "#b16cff"], ["Radiant", "#fff4c2", "#ff7ad9"]];
const media = (bucket, path) => `${SUPABASE}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;

function followPointer() {
  const mark = document.querySelector(".mark");
  if (!mark || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  addEventListener("pointermove", (e) => {
    const box = mark.getBoundingClientRect();
    mark.style.setProperty("--x", `${((e.clientX - box.left) / box.width) * 100}%`);
    mark.style.setProperty("--y", `${((e.clientY - box.top) / box.height) * 100}%`);
  }, { passive: true });
}

async function showProfile(username) {
  document.getElementById("landing").hidden = true;
  document.getElementById("profile").hidden = false;
  document.title = `${username} on Samo Launcher`;
  const text = (id, value) => { document.getElementById(id).textContent = value; };

  let player = null;
  try {
    const response = await fetch(`${SUPABASE}/rest/v1/rpc/public_profile_view`, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_username: username }),
    });
    if (response.ok) player = await response.json();
  } catch { /* shown as not found below */ }

  if (!player) { document.getElementById("missing").hidden = false; return; }

  const avatar = document.getElementById("avatar");
  if (player.avatar_path) {
    const image = new Image();
    image.alt = "";
    image.src = media("profile-media", player.avatar_path);
    avatar.append(image);
  } else {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", SILHOUETTE);
    svg.append(path);
    avatar.append(svg);
  }

  const tier = TIERS[Math.min(TIERS.length - 1, Math.floor(player.level / 10))];
  const ring = document.getElementById("ring");
  ring.style.setProperty("--tier", tier[1]);
  ring.style.setProperty("--tier2", tier[2]);
  document.getElementById("cover").dataset.bg = (player.background ?? "").split(":")[1] ?? "";

  text("name", player.display_name);
  text("handle", `@${player.username}`);
  text("status", player.status_text);
  text("bio", player.bio);
  text("level", player.level);
  text("tier", `${tier[0]} level`);

  const hours = (seconds) => `${Math.round(seconds / 360) / 10} h`;
  const stats = document.getElementById("stats");
  for (const [label, value] of [["Play time", hours(player.play_seconds)], ["Games", player.games.length], ["Badges", player.badges.length], ["Friends", player.friend_count], ["Profile views", player.views], ["Member since", player.joined]]) {
    const wrap = document.createElement("div");
    const dt = document.createElement("dt"); dt.textContent = label;
    const dd = document.createElement("dd"); dd.textContent = value;
    wrap.append(dt, dd);
    stats.append(wrap);
  }

  if (player.favorite) {
    document.getElementById("favorite-block").hidden = false;
    text("favorite-name", player.favorite.name);
    text("favorite-sub", player.favorite.subtitle);
    const art = document.getElementById("favorite-art");
    if (player.favorite.hero_path) art.src = media("game-art", player.favorite.hero_path); else art.hidden = true;
  }
  if (player.games.length) {
    document.getElementById("games-block").hidden = false;
    const games = document.getElementById("games");
    for (const game of player.games) {
      const row = document.createElement("li");
      if (game.cover_path) { const cover = new Image(); cover.alt = ""; cover.src = media("game-art", game.cover_path); row.append(cover); }
      const name = document.createElement("b"); name.textContent = game.name;
      const time = document.createElement("span"); time.textContent = hours(game.play_seconds);
      row.append(name, time);
      games.append(row);
    }
  }
  if (player.badges.length) {
    document.getElementById("badges-block").hidden = false;
    const badges = document.getElementById("badges");
    for (const badge of player.badges) {
      const item = document.createElement("li");
      const name = document.createElement("b"); name.textContent = badge.name;
      const about = document.createElement("span"); about.textContent = badge.description;
      item.append(name, about);
      badges.append(item);
    }
  }
  document.title = `${player.display_name} on Samo Launcher`;
  document.getElementById("card").hidden = false;
}

const username = new URLSearchParams(location.search).get("u");
if (username && /^[A-Za-z0-9_]{3,20}$/.test(username)) void showProfile(username);
else followPointer();
