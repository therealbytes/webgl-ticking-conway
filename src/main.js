// See LICENSE, author: @protolambda

"use strict";


import * as AutomatonLib from "./lib.js";

var dat = require("exdat");
var $ = require("jquery");
var ethers = require('ethers');

var defaultConfig = {
  wsRpc: "ws://localhost:8546",
  worldAddress: "0x0000000000000000000000000000000000000000",
  entityId: ethers.BigNumber.from("0x060d"),
  componentId: keccak256("conway.component.conwayState"),
  delta: 1000,
}

function keccak256(data) {
  return ethers.BigNumber.from(
    ethers.utils.keccak256(ethers.utils.toUtf8Bytes(data))
  ).toHexString();
}

function getConfig() {
  var paramString = window.location.href.split('?')[1];
  var queryString = new URLSearchParams(paramString);
  return {
    worldAddress: queryString.get("worldAddress") || defaultConfig.worldAddress,
    entityId: queryString.get("entityId") || defaultConfig.entityId,
    componentId: queryString.get("componentId") || defaultConfig.componentId,
    wsRpc: queryString.get("wsRpc") || defaultConfig.wsRpc,
    delta: queryString.get("delta") || defaultConfig.delta,
  }
}

async function getGridConfig(provider, config) {
  var componentId = keccak256("conway.component.gridConfig");
  var worldContract = new ethers.Contract(
    config.worldAddress,
    ["function getComponent(uint256) view returns (address)"],
    provider
  );
  var componentAddr = await worldContract.getComponent(componentId);
  var componentContract = new ethers.Contract(
    componentAddr,
    ["function getValue(uint256) view returns (uint8, uint8, bool, bool, bool, int32, int32, int32, int32)"],
    provider
  );
  var [stepsPerTick,
    cellBitSize,
    drawable,
    pausable,
    devMode,
    dimX,
    dimY,
    posX,
    posy] = await componentContract.getValue(config.entityId);
  return {
    width: dimX,
    height: dimY,
    cellBitSize: cellBitSize,
    period: 1000 / stepsPerTick,
  }
}

function createProvider(config) {
  return new ethers.providers.WebSocketProvider(config.wsRpc);
}

function createFilter(config) {
  return {
    address: config.worldAddress,
    topics: [
      keccak256("ComponentValueSet(uint256,address,uint256,bytes)")
    ]
  }
}

function unpackByte(b, n) {
  if (n < 0 || n > 8 || 8 % n !== 0) {
    throw new Error("invalid pack size");
  }
  var out = new Array(8 / n);
  for (let ii = 0; ii < out.length; ii++) {
    out[ii] = (b >> (8 - n * (ii + 1))) & ((1 << n) - 1);
  }
  return out;
}

$(document).ready(async function () {
  var $canvas = $("#main-canvas");

  var config = getConfig();
  var provider = createProvider(config);
  var filter = createFilter(config);
  var gridConfig = await getGridConfig(provider, config);

  console.log("Config", config);
  console.log("Grid config", gridConfig);
  console.log("Filter", filter);

  var canvasSize = Math.min(window.innerWidth, window.innerHeight);
  $canvas.width(canvasSize);
  $canvas.height(canvasSize);

  if (canvasSize / gridConfig.width > 4) {
    $canvas.css("image-rendering", "pixelated");
  }

  var nextUpdate = 0;

  var gol = new AutomatonLib.Automaton($canvas[0], 0, 0.5, false, undefined, undefined, gridConfig.width, gridConfig.height);

  provider.on(filter, (event) => {

    var componentId = ethers.BigNumber.from(event.topics[1]);
    var entityId = ethers.BigNumber.from(event.topics[3]);
    var data = event.data;

    if (!componentId.eq(config.componentId) || !entityId.eq(config.entityId)) return;

    var [data] = ethers.utils.defaultAbiCoder.decode(["bytes"], data);
    var [data] = ethers.utils.defaultAbiCoder.decode(["bytes"], data);
    var packedState = ethers.utils.arrayify(data);
    var unpackedState = new Array(packedState.length);
    for (let ii = 0; ii < packedState.length; ii++) {
      unpackedState[ii] = unpackByte(packedState[ii], gridConfig.cellBitSize);
    }
    var state = unpackedState.flat();

    var datenow = Date.now();
    var newNextUpdate = Math.max(datenow, nextUpdate + gridConfig.period);
    var timeout = newNextUpdate - datenow + config.delta;
    nextUpdate = newNextUpdate;

    setTimeout(() => {
      gol.setState(state);
      gol.draw();
    }, timeout);
  });

  return;

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


