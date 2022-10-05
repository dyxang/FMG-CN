"use strict";

function editHeightmap(options) {
  const {mode, tool} = options || {};
  restartHistory();
  viewbox.insert("g", "#terrs").attr("id", "heights");

  if (!mode) showModeDialog();
  else enterHeightmapEditMode(mode);

  if (modules.editHeightmap) return;
  modules.editHeightmap = true;

  // add listeners
  byId("paintBrushes").on("click", openBrushesPanel);
  byId("applyTemplate").on("click", openTemplateEditor);
  byId("convertImage").on("click", openImageConverter);
  byId("heightmapPreview").on("click", toggleHeightmapPreview);
  byId("heightmap3DView").on("click", changeViewMode);
  byId("finalizeHeightmap").on("click", finalizeHeightmap);
  byId("renderOcean").on("click", mockHeightmap);
  byId("templateUndo").on("click", () => restoreHistory(edits.n - 1));
  byId("templateRedo").on("click", () => restoreHistory(edits.n + 1));

  function showModeDialog() {
    alertMessage.innerHTML = /* html */ `Heightmap 是所有其他数据(河流、城市、州等)所基于的核心元素。因此，最好的编辑方法是删除辅助数据，并让系统在编辑完成时自动重新生成它。
    <p><i>擦除</i>模式还允许您将图像转换为高度图或使用模板编辑器。</p>
    <p>你可以<i>保留</i>数据, 但你无法改变海岸线.</p>
    <p>尝试 <i>风险</i> 模式，以改变海岸线和保存数据. 将尽可能多地还原数据，但它可能导致不可预测的错误.</p>
    <p>请在编辑高度图之前<span class="pseudoLink" onclick="dowloadMap();">保存地图</span>!</p>
    <p style="margin-bottom: 0">看看这个 ${link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Heightmap-customization", "wiki")} 寻求指引.</p>`;

    $("#alert").dialog({
      resizable: false,
      title: "编辑高度图",
      width: "28em",
      buttons: {
        Erase: () => enterHeightmapEditMode("erase"),
        Keep: () => enterHeightmapEditMode("keep"),
        Risk: () => enterHeightmapEditMode("risk"),
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function enterHeightmapEditMode(mode) {
    editHeightmap.layers = Array.from(mapLayers.querySelectorAll("li:not(.buttonoff)")).map(node => node.id); // store layers preset
    editHeightmap.layers.forEach(l => byId(l).click()); // turn off all layers

    customization = 1;
    closeDialogs();
    tip('高度图编辑模式处于活动状态。单击“退出自定义”以完成高度图', true);

    byId("options")
      .querySelectorAll(".tabcontent")
      .forEach(tabcontent => {
        tabcontent.style.display = "none";
      });
    byId("options").querySelector(".tab > .active").classList.remove("active");
    byId("customizationMenu").style.display = "block";
    byId("toolsTab").classList.add("active");
    heightmapEditMode.innerHTML = mode;

    if (mode === "erase") {
      undraw();
      changeOnlyLand.checked = false;
    } else if (mode === "keep") {
      viewbox.selectAll("#landmass, #lakes").style("display", "none");
      changeOnlyLand.checked = true;
    } else if (mode === "risk") {
      defs.selectAll("#land, #water").selectAll("path").remove();
      viewbox.selectAll("#coastline path, #lakes path, #oceanLayers path").remove();
      changeOnlyLand.checked = false;
    }

    // show convert and template buttons for Erase mode only
    applyTemplate.style.display = mode === "erase" ? "inline-block" : "none";
    convertImage.style.display = mode === "erase" ? "inline-block" : "none";

    // hide erosion checkbox if mode is Keep
    allowErosionBox.style.display = mode === "keep" ? "none" : "inline-block";

    // show finalize button
    if (!sessionStorage.getItem("noExitButtonAnimation")) {
      sessionStorage.setItem("noExitButtonAnimation", true);
      exitCustomization.style.opacity = 0;
      const width = 12 * uiSizeOutput.value * 11;
      exitCustomization.style.right = (svgWidth - width) / 2 + "px";
      exitCustomization.style.bottom = svgHeight / 2 + "px";
      exitCustomization.style.transform = "scale(2)";
      exitCustomization.style.display = "block";
      d3.select("#exitCustomization")
        .transition()
        .duration(1000)
        .style("opacity", 1)
        .transition()
        .duration(2000)
        .ease(d3.easeSinInOut)
        .style("right", "10px")
        .style("bottom", "10px")
        .style("transform", "scale(1)");
    } else exitCustomization.style.display = "block";

    turnButtonOn("toggleHeight");
    layersPreset.value = "heightmap";
    layersPreset.disabled = true;
    mockHeightmap();
    viewbox.on("touchmove mousemove", moveCursor);

    if (tool === "templateEditor") openTemplateEditor();
    else if (tool === "imageConverter") openImageConverter();
    else openBrushesPanel();
  }

  function moveCursor() {
    const [x, y] = d3.mouse(this);
    const cell = findGridCell(x, y, grid);
    heightmapInfoX.innerHTML = rn(x);
    heightmapInfoY.innerHTML = rn(y);
    heightmapInfoCell.innerHTML = cell;
    heightmapInfoHeight.innerHTML = `${grid.cells.h[cell]} (${getHeight(grid.cells.h[cell])})`;
    if (tooltip.dataset.main) showMainTip();

    // move radius circle if drag mode is active
    const pressed = byId("brushesButtons").querySelector("button.pressed");
    if (!pressed) return;
    moveCircle(x, y, brushRadius.valueAsNumber, "#333");
  }

  // get user-friendly (real-world) height value from map data
  function getHeight(h) {
    const unit = heightUnit.value;
    let unitRatio = 3.281; // default calculations are in feet
    if (unit === "m") unitRatio = 1;
    // if meter
    else if (unit === "f") unitRatio = 0.5468; // if fathom

    let height = -990;
    if (h >= 20) height = Math.pow(h - 18, +heightExponentInput.value);
    else if (h < 20 && h > 0) height = ((h - 20) / h) * 50;

    return rn(height * unitRatio) + " " + unit;
  }

  // Exit customization mode
  function finalizeHeightmap() {
    if (viewbox.select("#heights").selectAll("*").size() < 200)
      return tip("土地面积不足! 应该至少有200个土地单元来最终确定高度图", null, "error");
    if (byId("imageConverter").offsetParent) return tip("请先退出图像转换模式", null, "error");

    delete window.edits; // remove global variable
    redo.disabled = templateRedo.disabled = true;
    undo.disabled = templateUndo.disabled = true;

    customization = 0;
    customizationMenu.style.display = "none";
    if (byId("options").querySelector(".tab > button.active").id === "toolsTab") toolsContent.style.display = "block";
    layersPreset.disabled = false;
    exitCustomization.style.display = "none"; // hide finalize button
    restoreDefaultEvents();
    clearMainTip();
    closeDialogs();
    resetZoom();

    if (byId("preview")) byId("preview").remove();
    if (byId("canvas3d")) enterStandardView();

    const mode = heightmapEditMode.innerHTML;
    if (mode === "erase") regenerateErasedData();
    else if (mode === "keep") restoreKeptData();
    else if (mode === "risk") restoreRiskedData();

    // restore initial layers
    //viewbox.select("#heights").remove();
    byId("heights").remove();
    turnButtonOff("toggleHeight");
    document
      .getElementById("mapLayers")
      .querySelectorAll("li")
      .forEach(function (e) {
        if (editHeightmap.layers.includes(e.id) && !layerIsOn(e.id)) e.click();
        // turn on
        else if (!editHeightmap.layers.includes(e.id) && layerIsOn(e.id)) e.click(); // turn off
      });
    getCurrentPreset();
  }

  function regenerateErasedData() {
    INFO && console.group("Edit Heightmap");
    TIME && console.time("regenerateErasedData");

    const erosionAllowed = allowErosion.checked;
    markFeatures();
    markupGridOcean();
    if (erosionAllowed) {
      addLakesInDeepDepressions();
      openNearSeaLakes();
    }
    OceanLayers();
    calculateTemperatures();
    generatePrecipitation();
    reGraph();
    drawCoastline();

    Rivers.generate(erosionAllowed);

    if (!erosionAllowed) {
      for (const i of pack.cells.i) {
        const g = pack.cells.g[i];
        if (pack.cells.h[i] !== grid.cells.h[g] && pack.cells.h[i] >= 20 === grid.cells.h[g] >= 20) pack.cells.h[i] = grid.cells.h[g];
      }
    }

    drawRivers();
    Lakes.defineGroup();
    defineBiomes();
    rankCells();
    Cultures.generate();
    Cultures.expand();
    BurgsAndStates.generate();
    Religions.generate();
    BurgsAndStates.defineStateForms();
    BurgsAndStates.generateProvinces();
    BurgsAndStates.defineBurgFeatures();

    drawStates();
    drawBorders();
    BurgsAndStates.drawStateLabels();

    Rivers.specify();
    Lakes.generateName();

    Military.generate();
    Markers.generate();
    addZones();
    TIME && console.timeEnd("regenerateErasedData");
    INFO && console.groupEnd("Edit Heightmap");
  }

  function restoreKeptData() {
    viewbox.selectAll("#landmass, #lakes").style("display", null);
    for (const i of pack.cells.i) {
      pack.cells.h[i] = grid.cells.h[pack.cells.g[i]];
    }
  }

  function restoreRiskedData() {
    INFO && console.group("Edit Heightmap");
    TIME && console.time("restoreRiskedData");
    const erosionAllowed = allowErosion.checked;

    // assign pack data to grid cells
    const l = grid.cells.i.length;
    const biome = new Uint8Array(l);
    const pop = new Uint16Array(l);
    const road = new Uint16Array(l);
    const crossroad = new Uint16Array(l);
    const s = new Uint16Array(l);
    const burg = new Uint16Array(l);
    const state = new Uint16Array(l);
    const province = new Uint16Array(l);
    const culture = new Uint16Array(l);
    const religion = new Uint16Array(l);

    // rivers data, stored only if allowErosion is unchecked
    const fl = new Uint16Array(l);
    const r = new Uint16Array(l);
    const conf = new Uint8Array(l);

    for (const i of pack.cells.i) {
      const g = pack.cells.g[i];
      biome[g] = pack.cells.biome[i];
      culture[g] = pack.cells.culture[i];
      pop[g] = pack.cells.pop[i];
      road[g] = pack.cells.road[i];
      crossroad[g] = pack.cells.crossroad[i];
      s[g] = pack.cells.s[i];
      state[g] = pack.cells.state[i];
      province[g] = pack.cells.province[i];
      burg[g] = pack.cells.burg[i];
      religion[g] = pack.cells.religion[i];

      if (!erosionAllowed) {
        fl[g] = pack.cells.fl[i];
        r[g] = pack.cells.r[i];
        conf[g] = pack.cells.conf[i];
      }
    }

    // do not allow to remove land with burgs
    for (const i of grid.cells.i) {
      if (!burg[i]) continue;
      if (grid.cells.h[i] < 20) grid.cells.h[i] = 20;
    }

    // save culture centers x and y to restore center cell id after re-graph
    for (const c of pack.cultures) {
      if (!c.i || c.removed) continue;
      const p = pack.cells.p[c.center];
      c.x = p[0];
      c.y = p[1];
    }

    // recalculate zones to grid
    zones.selectAll("g").each(function () {
      const zone = d3.select(this);
      const dataCells = zone.attr("data-cells");
      const cells = dataCells ? dataCells.split(",").map(i => +i) : [];
      const g = cells.map(i => pack.cells.g[i]);
      zone.attr("data-cells", g);
      zone.selectAll("*").remove();
    });

    markFeatures();
    markupGridOcean();
    if (erosionAllowed) addLakesInDeepDepressions();
    OceanLayers();
    calculateTemperatures();
    generatePrecipitation();
    reGraph();
    drawCoastline();

    if (erosionAllowed) Rivers.generate(true);

    // assign saved pack data from grid back to pack
    const n = pack.cells.i.length;
    pack.cells.pop = new Float32Array(n);
    pack.cells.road = new Uint16Array(n);
    pack.cells.crossroad = new Uint16Array(n);
    pack.cells.s = new Uint16Array(n);
    pack.cells.burg = new Uint16Array(n);
    pack.cells.state = new Uint16Array(n);
    pack.cells.province = new Uint16Array(n);
    pack.cells.culture = new Uint16Array(n);
    pack.cells.religion = new Uint16Array(n);
    pack.cells.biome = new Uint8Array(n);

    if (!erosionAllowed) {
      pack.cells.r = new Uint16Array(n);
      pack.cells.conf = new Uint8Array(n);
      pack.cells.fl = new Uint16Array(n);
    }

    for (const i of pack.cells.i) {
      const g = pack.cells.g[i];
      const isLand = pack.cells.h[i] >= 20;

      // check biome
      pack.cells.biome[i] = isLand && biome[g] ? biome[g] : getBiomeId(grid.cells.prec[g], grid.cells.temp[g], pack.cells.h[i]);

      // rivers data
      if (!erosionAllowed) {
        pack.cells.r[i] = r[g];
        pack.cells.conf[i] = conf[g];
        pack.cells.fl[i] = fl[g];
      }

      if (!isLand) continue;
      pack.cells.culture[i] = culture[g];
      pack.cells.pop[i] = pop[g];
      pack.cells.road[i] = road[g];
      pack.cells.crossroad[i] = crossroad[g];
      pack.cells.s[i] = s[g];
      pack.cells.state[i] = state[g];
      pack.cells.province[i] = province[g];
      pack.cells.religion[i] = religion[g];
    }

    // find closest land cell to burg
    const findBurgCell = function (x, y) {
      let i = findCell(x, y);
      if (pack.cells.h[i] >= 20) return i;
      const dist = pack.cells.c[i].map(c => (pack.cells.h[c] < 20 ? Infinity : (pack.cells.p[c][0] - x) ** 2 + (pack.cells.p[c][1] - y) ** 2));
      return pack.cells.c[i][d3.scan(dist)];
    };

    // find best cell for burgs
    for (const b of pack.burgs) {
      if (!b.i || b.removed) continue;
      b.cell = findBurgCell(b.x, b.y);
      b.feature = pack.cells.f[b.cell];

      pack.cells.burg[b.cell] = b.i;
      if (!b.capital && pack.cells.h[b.cell] < 20) removeBurg(b.i);
      if (b.capital) pack.states[b.state].center = b.cell;
    }

    for (const p of pack.provinces) {
      if (!p.i || p.removed) continue;
      const provCells = pack.cells.i.filter(i => pack.cells.province[i] === p.i);
      if (!provCells.length) {
        const state = p.state;
        const stateProvs = pack.states[state].provinces;
        if (stateProvs.includes(p.i)) pack.states[state].provinces.splice(stateProvs.indexOf(p), 1);

        p.removed = true;
        continue;
      }

      if (p.burg && !pack.burgs[p.burg].removed) p.center = pack.burgs[p.burg].cell;
      else {
        p.center = provCells[0];
        p.burg = pack.cells.burg[p.center];
      }
    }

    for (const c of pack.cultures) {
      if (!c.i || c.removed) continue;
      c.center = findCell(c.x, c.y);
    }

    BurgsAndStates.drawStateLabels();
    drawStates();
    drawBorders();

    if (erosionAllowed) {
      Rivers.specify();
      Lakes.generateName();
    }

    // restore zones from grid
    zones.selectAll("g").each(function () {
      const zone = d3.select(this);
      const g = zone.attr("data-cells");
      const gCells = g ? g.split(",").map(i => +i) : [];
      const cells = pack.cells.i.filter(i => gCells.includes(pack.cells.g[i]));

      zone.attr("data-cells", cells);
      zone.selectAll("*").remove();
      const base = zone.attr("id") + "_"; // id generic part
      zone
        .selectAll("*")
        .data(cells)
        .enter()
        .append("polygon")
        .attr("points", d => getPackPolygon(d))
        .attr("id", d => base + d);
    });

    TIME && console.timeEnd("restoreRiskedData");
    INFO && console.groupEnd("Edit Heightmap");
  }

  // trigger heightmap redraw and history update if at least 1 cell is changed
  function updateHeightmap() {
    const prev = last(edits);
    const changed = grid.cells.h.reduce((s, h, i) => (h !== prev[i] ? s + 1 : s), 0);
    tip("单元格发生了变化: " + changed);
    if (!changed) return;

    // check ocean cells are not checged if olny land edit is allowed
    if (changeOnlyLand.checked) {
      for (const i of grid.cells.i) {
        if (prev[i] < 20 || grid.cells.h[i] < 20) grid.cells.h[i] = prev[i];
      }
    }

    mockHeightmap();
    updateHistory();
  }

  // draw or update heightmap
  function mockHeightmap() {
    const data = renderOcean.checked ? grid.cells.i : grid.cells.i.filter(i => grid.cells.h[i] >= 20);
    const scheme = getColorScheme();
    viewbox
      .select("#heights")
      .selectAll("polygon")
      .data(data)
      .join("polygon")
      .attr("points", d => getGridPolygon(d))
      .attr("id", d => "cell" + d)
      .attr("fill", d => getColor(grid.cells.h[d], scheme));
  }

  // draw or update heightmap for a selection of cells
  function mockHeightmapSelection(selection) {
    const ocean = renderOcean.checked;
    const scheme = getColorScheme();

    selection.forEach(function (i) {
      let cell = viewbox.select("#heights").select("#cell" + i);
      if (!ocean && grid.cells.h[i] < 20) {
        cell.remove();
        return;
      }
      if (!cell.size())
        cell = viewbox
          .select("#heights")
          .append("polygon")
          .attr("points", getGridPolygon(i))
          .attr("id", "cell" + i);
      cell.attr("fill", getColor(grid.cells.h[i], scheme));
    });
  }

  function updateStatistics() {
    const landCells = grid.cells.h.reduce((s, h) => (h >= 20 ? s + 1 : s));
    byId("landmassCounter").innerText = `${landCells} (${rn((landCells / grid.cells.i.length) * 100)}%)`;
    byId("landmassAverage").innerText = rn(d3.mean(grid.cells.h));
  }

  function updateHistory(noStat) {
    const step = edits.n;
    edits = edits.slice(0, step);
    edits[step] = grid.cells.h.slice();
    edits.n = step + 1;

    undo.disabled = templateUndo.disabled = edits.n <= 1;
    redo.disabled = templateRedo.disabled = true;
    if (!noStat) {
      updateStatistics();
      if (byId("preview")) drawHeightmapPreview(); // update heightmap preview if opened
      if (byId("canvas3d")) ThreeD.redraw(); // update 3d heightmap preview if opened
    }
  }

  // restoreHistory
  function restoreHistory(step) {
    edits.n = step;
    redo.disabled = templateRedo.disabled = edits.n >= edits.length;
    undo.disabled = templateUndo.disabled = edits.n <= 1;
    if (edits[edits.n - 1] === undefined) return;
    grid.cells.h = edits[edits.n - 1].slice();
    mockHeightmap();
    updateStatistics();

    if (byId("preview")) drawHeightmapPreview(); // update heightmap preview if opened
    if (byId("canvas3d")) ThreeD.redraw(); // update 3d heightmap preview if opened
  }

  // restart edits from 1st step
  function restartHistory() {
    window.edits = []; // declare temp global variable
    window.edits.n = 0;
    redo.disabled = templateRedo.disabled = true;
    undo.disabled = templateUndo.disabled = true;
    updateHistory();
  }

  function openBrushesPanel() {
    if ($("#brushesPanel").is(":visible")) return;
    $("#brushesPanel")
      .dialog({
        title: "笔刷",
        resizable: false,
        position: {my: "right top", at: "right-10 top+10", of: "svg"}
      })
      .on("dialogclose", exitBrushMode);

    if (modules.openBrushesPanel) return;
    modules.openBrushesPanel = true;

    // add listeners
    byId("brushesButtons").on("click", e => toggleBrushMode(e));
    byId("changeOnlyLand").on("click", e => changeOnlyLandClick(e));
    byId("undo").on("click", () => restoreHistory(edits.n - 1));
    byId("redo").on("click", () => restoreHistory(edits.n + 1));
    byId("rescaleShow").on("click", () => {
      byId("modifyButtons").style.display = "none";
      byId("rescaleSection").style.display = "block";
    });
    byId("rescaleHide").on("click", () => {
      byId("modifyButtons").style.display = "block";
      byId("rescaleSection").style.display = "none";
    });
    byId("rescaler").on("change", e => rescale(e.target.valueAsNumber));
    byId("rescaleCondShow").on("click", () => {
      byId("modifyButtons").style.display = "none";
      byId("rescaleCondSection").style.display = "block";
    });
    byId("rescaleCondHide").on("click", () => {
      byId("modifyButtons").style.display = "block";
      byId("rescaleCondSection").style.display = "none";
    });
    byId("rescaleExecute").on("click", rescaleWithCondition);
    byId("smoothHeights").on("click", smoothAllHeights);
    byId("disruptHeights").on("click", disruptAllHeights);
    byId("brushClear").on("click", startFromScratch);

    function exitBrushMode() {
      const pressed = document.querySelector("#brushesButtons > button.pressed");
      if (!pressed) return;
      pressed.classList.remove("pressed");

      viewbox.style("cursor", "default").on(".drag", null);
      removeCircle();
      byId("brushesSliders").style.display = "none";
    }

    const dragBrushThrottled = throttle(dragBrush, 100);
    function toggleBrushMode(e) {
      if (e.target.classList.contains("pressed")) {
        exitBrushMode();
        return;
      }
      exitBrushMode();
      byId("brushesSliders").style.display = "block";
      e.target.classList.add("pressed");
      viewbox.style("cursor", "crosshair").call(d3.drag().on("start", dragBrushThrottled));
    }

    function dragBrush() {
      const r = brushRadius.valueAsNumber;
      const [x, y] = d3.mouse(this);
      const start = findGridCell(x, y, grid);

      d3.event.on("drag", () => {
        const p = d3.mouse(this);
        moveCircle(p[0], p[1], r, "#333");
        if (~~d3.event.sourceEvent.timeStamp % 5 != 0) return; // slow down the edit

        const inRadius = findGridAll(p[0], p[1], r);
        const selection = changeOnlyLand.checked ? inRadius.filter(i => grid.cells.h[i] >= 20) : inRadius;
        if (selection && selection.length) changeHeightForSelection(selection, start);
      });

      d3.event.on("end", updateHeightmap);
    }

    function changeHeightForSelection(s, start) {
      const power = brushPower.valueAsNumber;
      const interpolate = d3.interpolateRound(power, 1);
      const land = changeOnlyLand.checked;
      const lim = v => minmax(v, land ? 20 : 0, 100);
      const h = grid.cells.h;

      const brush = document.querySelector("#brushesButtons > button.pressed").id;
      if (brush === "brushRaise") s.forEach(i => (h[i] = h[i] < 20 ? 20 : lim(h[i] + power)));
      else if (brush === "brushElevate") s.forEach((i, d) => (h[i] = lim(h[i] + interpolate(d / Math.max(s.length - 1, 1)))));
      else if (brush === "brushLower") s.forEach(i => (h[i] = lim(h[i] - power)));
      else if (brush === "brushDepress") s.forEach((i, d) => (h[i] = lim(h[i] - interpolate(d / Math.max(s.length - 1, 1)))));
      else if (brush === "brushAlign") s.forEach(i => (h[i] = lim(h[start])));
      else if (brush === "brushSmooth")
        s.forEach(
          i => (h[i] = rn((d3.mean(grid.cells.c[i].filter(i => (land ? h[i] >= 20 : 1)).map(c => h[c])) + h[i] * (10 - power) + 0.6) / (11 - power), 1))
        );
      else if (brush === "brushDisrupt") s.forEach(i => (h[i] = h[i] < 15 ? h[i] : lim(h[i] + power / 1.6 - Math.random() * power)));

      mockHeightmapSelection(s);
      // updateHistory(); uncomment to update history every step
    }

    function changeOnlyLandClick(e) {
      if (heightmapEditMode.innerHTML !== "keep") return;
      e.preventDefault();
      tip("您不能在“保持”编辑模式下更改海岸线", false, "error");
    }

    function rescale(v) {
      const land = changeOnlyLand.checked;
      grid.cells.h = grid.cells.h.map(h => (land && (h < 20 || h + v < 20) ? h : lim(h + v)));
      updateHeightmap();
      byId("rescaler").value = 0;
    }

    function rescaleWithCondition() {
      const range = rescaleLower.value + "-" + rescaleHigher.value;
      const operator = conditionSign.value;
      const operand = rescaleModifier.valueAsNumber;
      if (Number.isNaN(operand)) return tip("操作数应该是一个数字", false, "error");
      if ((operator === "add" || operator === "subtract") && !Number.isInteger(operand)) return tip("Operand should be an integer", false, "error");

      HeightmapGenerator.setGraph(grid);

      if (operator === "multiply") HeightmapGenerator.modify(range, 0, operand, 0);
      else if (operator === "divide") HeightmapGenerator.modify(range, 0, 1 / operand, 0);
      else if (operator === "add") HeightmapGenerator.modify(range, operand, 1, 0);
      else if (operator === "subtract") HeightmapGenerator.modify(range, -1 * operand, 1, 0);
      else if (operator === "exponent") HeightmapGenerator.modify(range, 0, 1, operand);

      grid.cells.h = HeightmapGenerator.getHeights();
      updateHeightmap();
    }

    function smoothAllHeights() {
      HeightmapGenerator.setGraph(grid);
      HeightmapGenerator.smooth(4, 1.5);
      grid.cells.h = HeightmapGenerator.getHeights();
      updateHeightmap();
    }

    function disruptAllHeights() {
      grid.cells.h = grid.cells.h.map(h => (h < 15 ? h : lim(h + 2.5 - Math.random() * 4)));
      updateHeightmap();
    }

    function startFromScratch() {
      if (changeOnlyLand.checked) return tip("当“仅更改土地单元格”模式设置时不允许", false, "error");
      const someHeights = grid.cells.h.some(h => h);
      if (!someHeights) return tip("高度图已清除，如非必要，请勿按两次", false, "error");

      grid.cells.h = new Uint8Array(grid.cells.i.length);
      viewbox.select("#heights").selectAll("*").remove();
      updateHistory();
    }
  }

  function openTemplateEditor() {
    if ($("#templateEditor").is(":visible")) return;
    const $body = byId("templateBody");

    $("#templateEditor").dialog({
      title: "模板编辑器",
      minHeight: "auto",
      width: "fit-content",
      resizable: false,
      position: {my: "right top", at: "right-10 top+10", of: "svg"}
    });

    if (modules.openTemplateEditor) return;
    modules.openTemplateEditor = true;

    $("#templateBody").sortable({items: "> div", handle: ".icon-resize-vertical", containment: "#templateBody", axis: "y"});

    // add listeners
    $body.on("click", function (ev) {
      const el = ev.target;
      if (el.classList.contains("icon-check")) {
        el.classList.remove("icon-check");
        el.classList.add("icon-check-empty");
        el.parentElement.style.opacity = 0.5;
        $body.dataset.changed = 1;
        return;
      }
      if (el.classList.contains("icon-check-empty")) {
        el.classList.add("icon-check");
        el.classList.remove("icon-check-empty");
        el.parentElement.style.opacity = 1;
        return;
      }
      if (el.classList.contains("icon-trash-empty")) {
        el.parentElement.remove();
        return;
      }
    });

    byId("templateEditor").on("keypress", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        executeTemplate();
      }
    });

    byId("templateTools").on("click", addStepOnClick);
    byId("templateSelect").on("change", selectTemplate);
    byId("templateRun").on("click", executeTemplate);
    byId("templateSave").on("click", downloadTemplate);
    byId("templateLoad").on("click", () => templateToLoad.click());
    byId("templateToLoad").on("change", function () {
      uploadFile(this, uploadTemplate);
    });

    function addStepOnClick(e) {
      if (e.target.tagName !== "BUTTON") return;
      const type = e.target.dataset.type;
      byId("templateBody").dataset.changed = 1;
      addStep(type);
    }

    function addStep(type, count, dist, arg4, arg5) {
      const $body = byId("templateBody");
      $body.insertAdjacentHTML("beforeend", getStepHTML(type, count, dist, arg4, arg5));

      const $elDist = $body.querySelector("div:last-child > span > .templateDist");
      if ($elDist) $elDist.on("change", setRange);

      if (dist && $elDist && $elDist.tagName === "SELECT") {
        for (const option of $elDist.options) {
          if (option.value === dist) $elDist.value = dist;
        }
        if ($elDist.value !== dist) {
          const opt = document.createElement("option");
          opt.value = opt.innerHTML = dist;
          $elDist.add(opt);
          $elDist.value = dist;
        }
      }
    }

    function getStepHTML(type, count, arg3, arg4, arg5) {
      const Trash = /* html */ `<i class="icon-trash-empty pointer" data-tip="单击以删除该步骤"></i>`;
      const Hide = /* html */ `<div class="icon-check" data-tip="单击此处可跳过该步骤"></div>`;
      const Reorder = /* html */ `<i class="icon-resize-vertical" data-tip="拖动到重新排序"></i>`;
      const common = /* html */ `<div data-type="${type}">${Hide}<div style="width:4em">${type}</div>${Trash}${Reorder}`;

      const TempY = /* html */ `<span>y:
          <input class="templateY" data-tip="沿 Y 轴的放置范围百分比(minY-maxY)" value=${arg5 || "20-80"} />
        </span>`;

      const TempX = /* html */ `<span>x:
          <input class="templateX" data-tip="沿 X 轴的放置范围百分比(minX-maxX)" value=${arg4 || "15-85"} />
        </span>`;

      const Height = /* html */ `<span>h:
          <input class="templateHeight" data-tip="团块最大高度，使用连字符获取范围内的随机数" value=${arg3 || "40-50"} />
        </span>`;

      const Count = /* html */ `<span>n:
          <input class="templateCount" data-tip="要添加的团块，请使用连字符获取范围内的随机数" value=${count || "1-2"} />
        </span>`;

      if (type === "Hill" || type === "Pit" || type === "Range" || type === "Trough") return /* html */ `${common}${TempY}${TempX}${Height}${Count}</div>`;

      if (type === "Strait")
        return /* html */ `${common}
          <span>d:
            <select class="templateDist" data-tip="海峡方向">
              <option value="vertical" selected>垂直</option>
              <option value="horizontal">水平</option>
            </select>
          </span>
          <span>w:
            <input class="templateCount" data-tip="海峡宽度，使用连字符得到一个范围内的随机数" value=${count || "2-7"} />
          </span>
        </div>`;

      if (type === "Invert")
        return /* html */ `${common}
          <span>by:
            <select class="templateDist" data-tip="沿轴线的镜像高度图" style="width: 7.8em">
              <option value="x" selected>x</option>
              <option value="y">y</option>
              <option value="xy">both</option>
            </select>
          </span>
          <span>n:
            <input class="templateCount" data-tip="倒置概率0-1" value=${count || "0.5"} />
          </span>
        </div>`;

      if (type === "Mask")
        return /* html */ `${common}
          <span>f:
            <input class="templateCount"
              data-tip="设置掩蔽分数。1 - 全绝缘(防止地图边缘的土地) ，2 - 半绝缘，等等。负数来反转效果"
              type="number" min=-10 max=10 value=${count || 1} />
          </span>
        </div>`;

      if (type === "Add")
        return /* html */ `${common}
          <span>to:
            <select class="templateDist" data-tip="只更改土地或所有单元格">
              <option value="all" selected>所有单元格</option>
              <option value="land">仅限陆地</option>
              <option value="interval">间隔</option>
            </select>
          </span>
          <span>v:
            <input class="templateCount" data-tip="将值添加到所有单元格的高度(允许负值)"
            type="number" value=${count || -10} min=-100 max=100 step=1 />
          </span>
        </div>`;

      if (type === "Multiply")
        return /* html */ `${common}
          <span>to:
            <select class="templateDist" data-tip="只更改土地或所有单元格">
              <option value="all" selected>所有单元格</option>
              <option value="land">仅限陆地</option>
              <option value="interval">间隔</option>
            </select>
          </span>
          <span>v:
            <input class="templateCount" data-tip="将所有单元格的高度乘以值" type="number" 
              value=${count || 1.1} min=0 max=10 step=.1 />
          </span>
        </div>`;

      if (type === "Smooth")
        return /* html */ `${common}
          <span>f:
            <input class="templateCount" data-tip="设置光滑分数。1-全光滑，2-半光滑等。" 
              type="number" min=1 max=10 step=1 value=${count || 2} />
          </span>
        </div>`;
    }

    function setRange(event) {
      if (event.target.value !== "interval") return;

      prompt("设置高度间隔。避免使用空格，使用连字符作为分隔符", {default: "17-20"}, v => {
        const opt = document.createElement("option");
        opt.value = opt.innerHTML = v;
        event.target.add(opt);
        event.target.value = v;
      });
    }

    function selectTemplate(e) {
      const body = byId("templateBody");
      const steps = body.querySelectorAll("div").length;
      const changed = +body.getAttribute("data-changed");
      const template = e.target.value;
      if (!steps || !changed) return changeTemplate(template);

      alertMessage.innerHTML = "确实要选择其他模板吗? 所有更改都将丢失。";
      $("#alert").dialog({
        resizable: false,
        title: "更改模板",
        buttons: {
          Change: function () {
            changeTemplate(template);
            $(this).dialog("close");
          },
          Cancel: function () {
            $(this).dialog("close");
          }
        }
      });
    }

    function changeTemplate(template) {
      const body = byId("templateBody");
      body.setAttribute("data-changed", 0);
      body.innerHTML = "";

      const templateString = heightmapTemplates[template]?.template;
      if (!templateString) return;

      const steps = templateString.split("\n");
      if (!steps.length) return tip(`高度图模板: 没有定义步骤`, false, "error");

      for (const step of steps) {
        const elements = step.trim().split(" ");
        addStep(...elements);
      }
    }

    function executeTemplate() {
      const steps = byId("templateBody").querySelectorAll("#templateBody > div");
      if (!steps.length) return;

      const seed = byId("templateSeed").value;
      if (seed) Math.random = aleaPRNG(seed);

      grid.cells.h = createTypedArray({maxValue: 100, length: grid.points.length});
      HeightmapGenerator.setGraph(grid);
      restartHistory();

      for (const step of steps) {
        if (step.style.opacity === "0.5") continue;

        const count = step.querySelector(".templateCount")?.value || "";
        const height = step.querySelector(".templateHeight")?.value || "";
        const dist = step.querySelector(".templateDist")?.value || null;
        const x = step.querySelector(".templateX")?.value || null;
        const y = step.querySelector(".templateY")?.value || null;
        const type = step.dataset.type;

        if (type === "Hill") HeightmapGenerator.addHill(count, height, x, y);
        else if (type === "Pit") HeightmapGenerator.addPit(count, height, x, y);
        else if (type === "Range") HeightmapGenerator.addRange(count, height, x, y);
        else if (type === "Trough") HeightmapGenerator.addTrough(count, height, x, y);
        else if (type === "Strait") HeightmapGenerator.addStrait(count, dist);
        else if (type === "Mask") HeightmapGenerator.mask(+count);
        else if (type === "Invert") HeightmapGenerator.invert(+count, dist);
        else if (type === "Add") HeightmapGenerator.modify(dist, +count, 1);
        else if (type === "Multiply") HeightmapGenerator.modify(dist, 0, +count);
        else if (type === "Smooth") HeightmapGenerator.smooth(+count);

        grid.cells.h = HeightmapGenerator.getHeights();
        updateHistory("noStat"); // update history on every step
      }

      grid.cells.h = HeightmapGenerator.getHeights();
      updateStatistics();
      mockHeightmap();
      if (byId("preview")) drawHeightmapPreview(); // update heightmap preview if opened
      if (byId("canvas3d")) ThreeD.redraw(); // update 3d heightmap preview if opened
    }

    function downloadTemplate() {
      const body = byId("templateBody");
      body.dataset.changed = 0;
      const steps = body.querySelectorAll("#templateBody > div");
      if (!steps.length) return;

      let data = "";
      for (const s of steps) {
        if (s.style.opacity === "0.5") continue;

        const type = s.getAttribute("data-type");
        const count = s.querySelector(".templateCount")?.value || "0";
        const arg3 = s.querySelector(".templateHeight")?.value || s.querySelector(".templateDist")?.value || "0";
        const x = s.querySelector(".templateX")?.value || "0";
        const y = s.querySelector(".templateY")?.value || "0";
        data += `${type} ${count} ${arg3} ${x} ${y}\r\n`;
      }

      const name = "template_" + Date.now() + ".txt";
      downloadFile(data, name);
    }

    function uploadTemplate(dataLoaded) {
      const steps = dataLoaded.split("\r\n");
      if (!steps.length) return tip("无法解析模板，请检查文件", false, "error");
      templateBody.innerHTML = "";

      for (const s of steps) {
        const step = s.split(" ");
        if (step.length !== 5) {
          ERROR && console.error("无法解析步骤，错误参数计数", s);
          continue;
        }
        addStep(step[0], step[1], step[2], step[3], step[4]);
      }
    }
  }

  function openImageConverter() {
    if ($("#imageConverter").is(":visible")) return;
    imageToLoad.click();
    closeDialogs("#imageConverter");

    $("#imageConverter").dialog({
      title: "Image Converter",
      maxHeight: svgHeight * 0.8,
      minHeight: "auto",
      width: "20em",
      position: {my: "right top", at: "right-10 top+10", of: "svg"},
      beforeClose: closeImageConverter
    });

    // create canvas for image
    const canvas = document.createElement("canvas");
    canvas.id = "canvas";
    canvas.width = graphWidth;
    canvas.height = graphHeight;
    document.body.insertBefore(canvas, optionsContainer);

    setOverlayOpacity(0);
    clearMainTip();
    tip("打开图像转换器。上传图像并为每种颜色分配高度值", false, "warn"); // main tip

    // remove all heights
    grid.cells.h = new Uint8Array(grid.cells.i.length);
    viewbox.select("#heights").selectAll("*").remove();
    updateHistory();

    if (modules.openImageConverter) return;
    modules.openImageConverter = true;

    // add color pallete
    void (function createColorPallete() {
      d3.select("#imageConverterPalette")
        .selectAll("div")
        .data(d3.range(101))
        .enter()
        .append("div")
        .attr("data-color", i => i)
        .style("background-color", i => color(1 - (i < 20 ? i - 5 : i) / 100))
        .style("width", i => (i < 40 || i > 68 ? ".2em" : ".1em"))
        .on("touchmove mousemove", showPalleteHeight)
        .on("click", assignHeight);
    })();

    // add listeners
    byId("convertImageLoad").on("click", () => imageToLoad.click());
    byId("imageToLoad").on("change", loadImage);
    byId("convertAutoLum").on("click", () => autoAssing("lum"));
    byId("convertAutoHue").on("click", () => autoAssing("hue"));
    byId("convertAutoFMG").on("click", () => autoAssing("scheme"));
    byId("convertColorsButton").on("click", setConvertColorsNumber);
    byId("convertComplete").on("click", applyConversion);
    byId("convertCancel").on("click", cancelConversion);
    byId("convertOverlay").on("input", function () {
      setOverlayOpacity(this.value);
    });
    byId("convertOverlayNumber").on("input", function () {
      setOverlayOpacity(this.value);
    });

    function showPalleteHeight() {
      const height = +this.getAttribute("data-color");
      colorsSelectValue.innerHTML = height;
      colorsSelectFriendly.innerHTML = getHeight(height);
      const former = imageConverterPalette.querySelector(".hoveredColor");
      if (former) former.className = "";
      this.className = "hoveredColor";
    }

    function loadImage() {
      const file = this.files[0];
      this.value = ""; // reset input value to get triggered if the file is re-uploaded
      const reader = new FileReader();

      const img = new Image();
      img.id = "imageToConvert";
      img.style.display = "none";
      document.body.appendChild(img);

      img.onload = function () {
        const ctx = byId("canvas").getContext("2d");
        ctx.drawImage(img, 0, 0, graphWidth, graphHeight);
        heightsFromImage(+convertColors.value);
        resetZoom();
      };

      reader.onloadend = () => (img.src = reader.result);
      reader.readAsDataURL(file);
    }

    function heightsFromImage(count) {
      const sourceImage = byId("canvas");
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = grid.cellsX;
      sampleCanvas.height = grid.cellsY;
      sampleCanvas.getContext("2d").drawImage(sourceImage, 0, 0, grid.cellsX, grid.cellsY);

      const q = new RgbQuant({colors: count});
      q.sample(sampleCanvas);
      const data = q.reduce(sampleCanvas);
      const pallete = q.palette(true);

      viewbox.select("#heights").selectAll("*").remove();
      d3.select("#imageConverter").selectAll("div.color-div").remove();
      colorsSelect.style.display = "block";
      colorsUnassigned.style.display = "block";
      colorsAssigned.style.display = "none";
      sampleCanvas.remove(); // no need to keep

      viewbox
        .select("#heights")
        .selectAll("polygon")
        .data(grid.cells.i)
        .join("polygon")
        .attr("points", d => getGridPolygon(d))
        .attr("id", d => "cell" + d)
        .attr("fill", d => `rgb(${data[d * 4]}, ${data[d * 4 + 1]}, ${data[d * 4 + 2]})`)
        .on("click", mapClicked);

      const colors = pallete.map(p => `rgb(${p[0]}, ${p[1]}, ${p[2]})`);
      d3.select("#colorsUnassigned")
        .selectAll("div")
        .data(colors)
        .enter()
        .append("div")
        .attr("data-color", i => i)
        .style("background-color", i => i)
        .attr("class", "color-div")
        .on("click", colorClicked);

      byId("colorsUnassignedNumber").innerHTML = colors.length;
    }

    function mapClicked() {
      const fill = this.getAttribute("fill");
      const palleteColor = imageConverter.querySelector(`div[data-color="${fill}"]`);
      palleteColor.click();
    }

    function colorClicked() {
      viewbox.select("#heights").selectAll(".selectedCell").attr("class", null);
      const unselect = this.classList.contains("selectedColor");

      const selectedColor = imageConverter.querySelector("div.selectedColor");
      if (selectedColor) selectedColor.classList.remove("selectedColor");
      const hoveredColor = imageConverterPalette.querySelector("div.hoveredColor");
      if (hoveredColor) hoveredColor.classList.remove("hoveredColor");
      colorsSelectValue.innerHTML = colorsSelectFriendly.innerHTML = 0;

      if (unselect) return;
      this.classList.add("selectedColor");

      if (this.dataset.height) {
        const height = +this.dataset.height;
        imageConverterPalette.querySelector(`div[data-color="${height}"]`).classList.add("hoveredColor");
        colorsSelectValue.innerHTML = height;
        colorsSelectFriendly.innerHTML = getHeight(height);
      }

      const color = this.getAttribute("data-color");
      viewbox.select("#heights").selectAll("polygon.selectedCell").classed("selectedCell", 0);
      viewbox
        .select("#heights")
        .selectAll("polygon[fill='" + color + "']")
        .classed("selectedCell", 1);
    }

    function assignHeight() {
      const height = +this.dataset.color;
      const rgb = color(1 - (height < 20 ? height - 5 : height) / 100);
      const selectedColor = imageConverter.querySelector("div.selectedColor");
      selectedColor.style.backgroundColor = rgb;
      selectedColor.setAttribute("data-color", rgb);
      selectedColor.setAttribute("data-height", height);

      viewbox
        .select("#heights")
        .selectAll(".selectedCell")
        .each(function () {
          this.setAttribute("fill", rgb);
          this.setAttribute("data-height", height);
        });

      if (selectedColor.parentNode.id === "colorsUnassigned") {
        colorsAssigned.appendChild(selectedColor);
        colorsAssigned.style.display = "block";

        byId("colorsUnassignedNumber").innerHTML = colorsUnassigned.childElementCount - 2;
        byId("colorsAssignedNumber").innerHTML = colorsAssigned.childElementCount - 2;
      }
    }

    // auto assign color based on luminosity or hue
    function autoAssing(type) {
      let unassigned = colorsUnassigned.querySelectorAll("div");
      if (!unassigned.length) {
        heightsFromImage(+convertColors.value);
        unassigned = colorsUnassigned.querySelectorAll("div");
        if (!unassigned.length) {
          tip("没有未分配的颜色。请加载图像并再次单击按钮", false, "error");
          return;
        }
      }

      const getHeightByHue = function (color) {
        let hue = d3.hsl(color).h;
        if (hue > 300) hue -= 360;
        if (hue > 170) return (Math.abs(hue - 250) / 3) | 0; // water
        return (Math.abs(hue - 250 + 20) / 3) | 0; // land
      };

      const getHeightByLum = function (color) {
        let lum = d3.lab(color).l;
        if (lum < 13) return ((lum / 13) * 20) | 0; // water
        return lum | 0; // land
      };

      const scheme = d3.range(101).map(i => getColor(i, color()));
      const hues = scheme.map(rgb => d3.hsl(rgb).h | 0);
      const getHeightByScheme = function (color) {
        let height = scheme.indexOf(color);
        if (height !== -1) return height; // exact match
        const hue = d3.hsl(color).h;
        const closest = hues.reduce((prev, curr) => (Math.abs(curr - hue) < Math.abs(prev - hue) ? curr : prev));
        return hues.indexOf(closest);
      };

      const assinged = []; // store assigned heights
      unassigned.forEach(el => {
        const clr = el.dataset.color;
        const height = type === "hue" ? getHeightByHue(clr) : type === "lum" ? getHeightByLum(clr) : getHeightByScheme(clr);
        const colorTo = color(1 - (height < 20 ? (height - 5) / 100 : height / 100));
        viewbox
          .select("#heights")
          .selectAll("polygon[fill='" + clr + "']")
          .attr("fill", colorTo)
          .attr("data-height", height);

        if (assinged[height]) {
          el.remove();
          return;
        } // if color is already added, remove it
        el.style.backgroundColor = el.dataset.color = colorTo;
        el.dataset.height = height;
        colorsAssigned.appendChild(el);
        assinged[height] = true;
      });

      // sort assigned colors by height
      Array.from(colorsAssigned.children)
        .sort((a, b) => +a.dataset.height - +b.dataset.height)
        .forEach(line => colorsAssigned.appendChild(line));

      colorsAssigned.style.display = "block";
      colorsUnassigned.style.display = "none";
      byId("colorsAssignedNumber").innerHTML = colorsAssigned.childElementCount - 2;
    }

    function setConvertColorsNumber() {
      prompt(
        `请设置颜色的最大数量。实际数量通常较低，取决于配色方案`,
        {default: +convertColors.value, step: 1, min: 3, max: 255},
        number => {
          convertColors.value = number;
          heightsFromImage(number);
        }
      );
    }

    function setOverlayOpacity(v) {
      convertOverlay.value = convertOverlayNumber.value = v;
      byId("canvas").style.opacity = v;
    }

    function applyConversion() {
      if (colorsAssigned.childElementCount < 3) return tip("请先分配", false, "error");

      viewbox
        .select("#heights")
        .selectAll("polygon")
        .each(function () {
          const height = +this.dataset.height || 0;
          const i = +this.id.slice(4);
          grid.cells.h[i] = height;
        });

      viewbox.select("#heights").selectAll("polygon").remove();
      updateHeightmap();
      restoreImageConverterState();
    }

    function cancelConversion() {
      restoreImageConverterState();
      viewbox.select("#heights").selectAll("polygon").remove();
      restoreHistory(edits.n - 1);
    }

    function restoreImageConverterState() {
      const canvas = byId("canvas");
      if (canvas) canvas.remove();

      const image = byId("imageToConvert");
      if (image) image.remove();

      d3.select("#imageConverter").selectAll("div.color-div").remove();
      colorsAssigned.style.display = "none";
      colorsUnassigned.style.display = "none";
      colorsSelectValue.innerHTML = colorsSelectFriendly.innerHTML = 0;
      viewbox.style("cursor", "default").on(".drag", null);
      tip('高度图编辑模式处于活动状态。单击“退出自定义”以完成高度图', true);
      $("#imageConverter").dialog("destroy");
      openBrushesPanel();
    }

    function closeImageConverter(event) {
      event.preventDefault();
      event.stopPropagation();
      alertMessage.innerHTML = /* html */ ` 确实要关闭图像转换器吗？单击“取消”返回到转换。单击“完成”应用转换。单击“关闭”退出转换模式并恢复以前的高度图`;

      $("#alert").dialog({
        resizable: false,
        title: "关闭图像转换器",
        buttons: {
          Cancel: function () {
            $(this).dialog("close");
          },
          Complete: function () {
            $(this).dialog("close");
            applyConversion();
          },
          Close: function () {
            $(this).dialog("close");
            restoreImageConverterState();
            viewbox.select("#heights").selectAll("polygon").remove();
            restoreHistory(edits.n - 1);
          }
        }
      });
    }
  }

  function toggleHeightmapPreview() {
    if (byId("preview")) {
      byId("preview").remove();
      return;
    }
    const preview = document.createElement("canvas");
    preview.id = "preview";
    preview.width = grid.cellsX;
    preview.height = grid.cellsY;
    document.body.insertBefore(preview, optionsContainer);
    preview.on("mouseover", () => tip("高度图预览。单击可下载屏幕大小的图像"));
    preview.on("click", downloadPreview);
    drawHeightmapPreview();
  }

  function drawHeightmapPreview() {
    const ctx = byId("preview").getContext("2d");
    const imageData = ctx.createImageData(grid.cellsX, grid.cellsY);

    grid.cells.h.forEach((height, i) => {
      const h = height < 20 ? Math.max(height / 1.5, 0) : height;
      const v = (h / 100) * 255;

      const n = i * 4;
      imageData.data[n] = v;
      imageData.data[n + 1] = v;
      imageData.data[n + 2] = v;
      imageData.data[n + 3] = 255;
    });

    ctx.putImageData(imageData, 0, 0);
  }

  function downloadPreview() {
    const preview = byId("preview");
    const dataURL = preview.toDataURL("image/png");

    const img = new Image();
    img.src = dataURL;

    img.onload = function () {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = graphWidth;
      canvas.height = graphHeight;
      document.body.insertBefore(canvas, optionsContainer);
      ctx.drawImage(img, 0, 0, graphWidth, graphHeight);
      const imgBig = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = getFileName("Heightmap") + ".png";
      link.href = imgBig;
      link.click();
      canvas.remove();
    };
  }
}
