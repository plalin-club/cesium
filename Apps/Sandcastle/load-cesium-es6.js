// This file loads the unbuilt ES6 version of Cesium
// into the global scope during local development
window.CESIUM_BASE_URL = "../../../Build/CesiumUnminified/";
import * as Cesium from "../../Build/CesiumUnminified/index.js";
window.Cesium = Cesium;

// MY ACCESS TOKEN
Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmOTlkMmMwYy0yNTRmLTQ1ZWMtODg3MS1lMjMwNDg5MWY5ODQiLCJpZCI6NDE0NzcsImlhdCI6MTcyODk1MDE2NH0.Ftb3rNvP63rBYmWIj7QwWICSxHltGKAgK8uC3Gl7yjA";

// Since ES6 modules have no guaranteed load order,
// only call startup if it's already defined but hasn't been called yet
if (!window.startupCalled && typeof window.startup === "function") {
  window.startup(Cesium).catch((error) => {
    console.error(error);
  });
  Sandcastle.finishedLoading();
}
