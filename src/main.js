// See LICENSE, author: @protolambda

"use strict";


import * as AutomatonLib from "./lib.js";

var dat = require("exdat");
var $ = require("jquery");
var ethers = require('ethers');

var defaultConfig = {
  wsRpc: "ws://localhost:9546",
  contractAddress: "0x0000000000000000000000000000000000000000",
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
    wsRpc: queryString.get("wsRpc") || defaultConfig.wsRpc,
    contractAddress: queryString.get("contractAddress") || defaultConfig.contractAddress,
    delta: queryString.get("delta") || defaultConfig.delta,
  }
}

async function getGridConfig(provider, config) {
  var contract = new ethers.Contract(
    config.contractAddress,
    ["function dimensions() view returns (uint32,uint32)"],
    provider
  );
  var [dimX, dimY] = await contract.dimensions();
  return {
    width: dimX,
    height: dimY,
  }
}

function createProvider(config) {
  return new ethers.providers.WebSocketProvider(config.wsRpc);
}

function createFilter(config) {
  return {
    address: config.contractAddress,
    topics: [
      keccak256("Tick(uint256,uint256,bytes32)")
    ]
  }
}

function unpackByte(b, n) {
  if (n < 0 || n > 8 || 8 % n !== 0) {
    throw new Error("invalid pack size");
  }
  var out = new Array(8 / n);
  for (var ii = 0; ii < out.length; ii++) {
    out[ii] = (b >> (8 - n * (ii + 1))) & ((1 << n) - 1);
  }
  return out;
}

function overrideChunk(config, chunkX, chunkY, state, chunk) {
  for (var y = 0; y < 16; y++) {
    for (var x = 0; x < 16; x++) {
      var [absX, absY] = [chunkX * 16 + x, chunkY * 16 + y];
      var chunkIdx = y * 16 + x;
      var stateIdx = absY * config.width + absX;
      state[stateIdx] = chunk[chunkIdx];
    }
  }
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

  if (canvasSize / gridConfig.width > 2) {
    $canvas.css("image-rendering", "pixelated");
  }

  var gol = new AutomatonLib.Automaton($canvas[0], 0, 0.5, false, undefined, undefined, gridConfig.width, gridConfig.height);
  var state = new Array(gridConfig.width * gridConfig.height);
  var updated = new Array(gridConfig.width / 16 * gridConfig.height / 16);
  for (var ii = 0; ii < updated.length; ii++) {
    updated[ii] = false;
  }

  provider.on(filter, (event) => {
    var chunkX = ethers.BigNumber.from(event.topics[1]).toNumber();
    var chunkY = ethers.BigNumber.from(event.topics[2]).toNumber();
    const packedChunk = new Uint8Array(Buffer.from(event.data.replace(/^0x/, ''), 'hex'));

    console.log("Chunk", chunkX, chunkY, event.data);

    var unpackedChunk = new Array(packedChunk.length);
    for (var ii = 0; ii < packedChunk.length; ii++) {
      unpackedChunk[ii] = unpackByte(packedChunk[ii], 1);
    }
    var chunk = unpackedChunk.flat();

    overrideChunk(gridConfig, chunkX, chunkY, state, chunk);
    updated[chunkY * gridConfig.width / 16 + chunkX] = true;

    if (updated.every((v) => v)) {
      gol.setState(state);
      gol.draw();
      for (var ii = 0; ii < updated.length; ii++) {
        updated[ii] = false;
      }
    }
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


