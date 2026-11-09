"use strict";

// The address and key are public by design. The database only answers this one
// question for visitors, and only about players who turned their page on.
const SUPABASE = "https://ymicynuphdgtcqsvmdxr.supabase.co";
const KEY = "sb_publishable_Y3Xcdzw6FIcBVgMFa1Prrg_lrY2ZG8-";
const SILHOUETTE = "M12 12.5a4.75 4.75 0 1 0 0-9.5 4.75 4.75 0 0 0 0 9.5zM3.5 22c.6-5 4-7.5 8.5-7.5s7.900 2.500 8.500 7.500z";

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
  document.title = `${username} on SamoLauncher`;
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
    image.src = `${SUPABASE}/storage/v1/object/public/profile-media/${player.avatar_path.split("/").map(encodeURIComponent).join("/")}`;
    avatar.append(image);
  } else {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", SILHOUETTE);
    svg.append(path);
    avatar.append(svg);
  }

  text("name", player.display_name);
  text("handle", `@${player.username}`);
  text("status", player.status_text);
  text("stats", `Level ${player.level}, ${Math.round(player.play_seconds / 3600)} hours played`);
  text("bio", player.bio);
  const badges = document.getElementById("badges");
  for (const name of player.badges) {
    const item = document.createElement("li");
    item.textContent = name;
    badges.append(item);
  }
  document.title = `${player.display_name} on SamoLauncher`;
  document.getElementById("card").hidden = false;
}

const username = new URLSearchParams(location.search).get("u");
if (username && /^[A-Za-z0-9_]{3,20}$/.test(username)) void showProfile(username);
else followPointer();
