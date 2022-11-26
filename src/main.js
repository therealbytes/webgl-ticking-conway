// See LICENSE, author: @protolambda

"use strict";


import * as AutomatonLib from "./lib.js";

const WIDTH = 100;
const HEIGHT = 100;

var dat = require("exdat");
var $ = require("jquery");

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

$(document).ready(async function () {
  var $canvas = $("#main-canvas");

  var gol = new AutomatonLib.Automaton($canvas[0], 0, 0.5, false, undefined, undefined, WIDTH, HEIGHT);

  for (var i = 0; i < 100; i++) {
    const state = new Uint8Array(gol.statesize.x * gol.statesize.y);
    state.fill(i % 2);
    gol.setState(state);
    gol.draw();
    await sleep(1000);
  }

  document.body.appendChild(gol.stats.domElement);

  var gui = new dat.GUI();


  var f0 = gui.addFolder("Cellular Automata");
  f0.add(gol, "currentAutomaton", [...(gol.automata.keys())]);



  var f1 = gui.addFolder("Position generator");
  f1.add(gol, "currentGenerator", Object.keys(gol.generators));
  f1.add(gol, "p", 0.0, 1.0);

  var uiControls = {
    toggleFPS: () => $("#stats").toggle(),
    keyInfo: () => $("#key-info").toggle()
  };

  var f2 = gui.addFolder("controls");
  f2.add(uiControls, "toggleFPS");
  f2.add(uiControls, "keyInfo");

  f1.open();

  gol.initControls();
});

/* Don't scroll on spacebar. */
$(window).on("keydown", (event) => event.keyCode !== 32);


