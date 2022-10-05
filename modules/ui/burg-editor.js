"use strict";
function editBurg(id) {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleIcons")) toggleIcons();
  if (!layerIsOn("toggleLabels")) toggleLabels();

  const burg = id || d3.event.target.dataset.id;
  elSelected = burgLabels.select("[data-id='" + burg + "']");
  burgLabels.selectAll("text").call(d3.drag().on("start", dragBurgLabel)).classed("draggable", true);
  updateBurgValues();

  $("#burgEditor").dialog({
    title: "编辑城镇",
    resizable: false,
    close: closeBurgEditor,
    position: {my: "left top", at: "left+10 top+10", of: "svg", collision: "fit"}
  });

  if (modules.editBurg) return;
  modules.editBurg = true;

  // add listeners
  document.getElementById("burgGroupShow").addEventListener("click", showGroupSection);
  document.getElementById("burgGroupHide").addEventListener("click", hideGroupSection);
  document.getElementById("burgSelectGroup").addEventListener("change", changeGroup);
  document.getElementById("burgInputGroup").addEventListener("change", createNewGroup);
  document.getElementById("burgAddGroup").addEventListener("click", toggleNewGroupInput);
  document.getElementById("burgRemoveGroup").addEventListener("click", removeBurgsGroup);

  document.getElementById("burgName").addEventListener("input", changeName);
  document.getElementById("burgNameReRandom").addEventListener("click", generateNameRandom);
  document.getElementById("burgType").addEventListener("input", changeType);
  document.getElementById("burgCulture").addEventListener("input", changeCulture);
  document.getElementById("burgNameReCulture").addEventListener("click", generateNameCulture);
  document.getElementById("burgPopulation").addEventListener("change", changePopulation);
  burgBody.querySelectorAll(".burgFeature").forEach(el => el.addEventListener("click", toggleFeature));
  document.getElementById("mfcgBurgSeed").addEventListener("change", changeSeed);
  document.getElementById("regenerateMFCGBurgSeed").addEventListener("click", randomizeSeed);
  document.getElementById("addCustomMFCGBurgLink").addEventListener("click", addCustomMfcgLink);

  document.getElementById("burgStyleShow").addEventListener("click", showStyleSection);
  document.getElementById("burgStyleHide").addEventListener("click", hideStyleSection);
  document.getElementById("burgEditLabelStyle").addEventListener("click", editGroupLabelStyle);
  document.getElementById("burgEditIconStyle").addEventListener("click", editGroupIconStyle);
  document.getElementById("burgEditAnchorStyle").addEventListener("click", editGroupAnchorStyle);

  document.getElementById("burgEmblem").addEventListener("click", openEmblemEdit);
  document.getElementById("burgToggleMFCGMap").addEventListener("click", toggleMFCGMap);
  document.getElementById("burgEditEmblem").addEventListener("click", openEmblemEdit);
  document.getElementById("burgRelocate").addEventListener("click", toggleRelocateBurg);
  document.getElementById("burglLegend").addEventListener("click", editBurgLegend);
  document.getElementById("burgLock").addEventListener("click", toggleBurgLockButton);
  document.getElementById("burgRemove").addEventListener("click", removeSelectedBurg);
  document.getElementById("burgTemperatureGraph").addEventListener("click", showTemperatureGraph);

  function updateBurgValues() {
    const id = +elSelected.attr("data-id");
    const b = pack.burgs[id];
    const province = pack.cells.province[b.cell];
    const provinceName = province ? pack.provinces[province].fullName + ", " : "";
    const stateName = pack.states[b.state].fullName || pack.states[b.state].name;
    document.getElementById("burgProvinceAndState").innerHTML = provinceName + stateName;

    document.getElementById("burgName").value = b.name;
    document.getElementById("burgType").value = b.type || "Generic";
    document.getElementById("burgPopulation").value = rn(b.population * populationRate * urbanization);
    document.getElementById("burgEditAnchorStyle").style.display = +b.port ? "inline-block" : "none";

    // update list and select culture
    const cultureSelect = document.getElementById("burgCulture");
    cultureSelect.options.length = 0;
    const cultures = pack.cultures.filter(c => !c.removed);
    cultures.forEach(c => cultureSelect.options.add(new Option(c.name, c.i, false, c.i === b.culture)));

    const temperature = grid.cells.temp[pack.cells.g[b.cell]];
    document.getElementById("burgTemperature").innerHTML = convertTemperature(temperature);
    document.getElementById("burgTemperatureLikeIn").innerHTML = getTemperatureLikeness(temperature);
    document.getElementById("burgElevation").innerHTML = getHeight(pack.cells.h[b.cell]);

    // toggle features
    if (b.capital) document.getElementById("burgCapital").classList.remove("inactive");
    else document.getElementById("burgCapital").classList.add("inactive");
    if (b.port) document.getElementById("burgPort").classList.remove("inactive");
    else document.getElementById("burgPort").classList.add("inactive");
    if (b.citadel) document.getElementById("burgCitadel").classList.remove("inactive");
    else document.getElementById("burgCitadel").classList.add("inactive");
    if (b.walls) document.getElementById("burgWalls").classList.remove("inactive");
    else document.getElementById("burgWalls").classList.add("inactive");
    if (b.plaza) document.getElementById("burgPlaza").classList.remove("inactive");
    else document.getElementById("burgPlaza").classList.add("inactive");
    if (b.temple) document.getElementById("burgTemple").classList.remove("inactive");
    else document.getElementById("burgTemple").classList.add("inactive");
    if (b.shanty) document.getElementById("burgShanty").classList.remove("inactive");
    else document.getElementById("burgShanty").classList.add("inactive");

    //toggle lock
    updateBurgLockIcon();

    // select group
    const group = elSelected.node().parentNode.id;
    const select = document.getElementById("burgSelectGroup");
    select.options.length = 0; // remove all options

    burgLabels.selectAll("g").each(function () {
      select.options.add(new Option(this.id, this.id, false, this.id === group));
    });

    // set emlem image
    const coaID = "burgCOA" + id;
    COArenderer.trigger(coaID, b.coa);
    document.getElementById("burgEmblem").setAttribute("href", "#" + coaID);

    if (options.showMFCGMap) {
      document.getElementById("mfcgPreviewSection").style.display = "block";
      updateMFCGFrame(b);

      if (b.link) {
        document.getElementById("mfcgBurgSeedSection").style.display = "none";
      } else {
        document.getElementById("mfcgBurgSeedSection").style.display = "inline-block";
        document.getElementById("mfcgBurgSeed").value = getBurgSeed(b);
      }
    } else {
      document.getElementById("mfcgPreviewSection").style.display = "none";
    }
  }

  // in °C, array from -1 °C; source: https://en.wikipedia.org/wiki/List_of_cities_by_average_temperature
  function getTemperatureLikeness(temperature) {
    if (temperature < -5) return "Yakutsk";
    const cities = [
      "Snag (Yukon)",
      "Yellowknife (Canada)",
      "Okhotsk (Russia)",
      "Fairbanks (Alaska)",
      "Nuuk (Greenland)",
      "Murmansk", // -5 - 0
      "Arkhangelsk",
      "Anchorage",
      "Tromsø",
      "Reykjavik",
      "Riga",
      "Stockholm",
      "Halifax",
      "Prague",
      "Copenhagen",
      "London", // 1 - 10
      "Antwerp",
      "Paris",
      "Milan",
      "Batumi",
      "Rome",
      "Dubrovnik",
      "Lisbon",
      "Barcelona",
      "Marrakesh",
      "Alexandria", // 11 - 20
      "Tegucigalpa",
      "Guangzhou",
      "Rio de Janeiro",
      "Dakar",
      "Miami",
      "Jakarta",
      "Mogadishu",
      "Bangkok",
      "Aden",
      "Khartoum"
    ]; // 21 - 30
    if (temperature > 30) return "Mecca";
    return cities[temperature + 5] || null;
  }

  function dragBurgLabel() {
    const tr = parseTransform(this.getAttribute("transform"));
    const dx = +tr[0] - d3.event.x,
      dy = +tr[1] - d3.event.y;

    d3.event.on("drag", function () {
      const x = d3.event.x,
        y = d3.event.y;
      this.setAttribute("transform", `translate(${dx + x},${dy + y})`);
      tip('只使用拖动进行微调，实际移动时使用“重新定位”按钮', false, "warning");
    });
  }

  function showGroupSection() {
    document.querySelectorAll("#burgBottom > button").forEach(el => (el.style.display = "none"));
    document.getElementById("burgGroupSection").style.display = "inline-block";
  }

  function hideGroupSection() {
    document.querySelectorAll("#burgBottom > button").forEach(el => (el.style.display = "inline-block"));
    document.getElementById("burgGroupSection").style.display = "none";
    document.getElementById("burgInputGroup").style.display = "none";
    document.getElementById("burgInputGroup").value = "";
    document.getElementById("burgSelectGroup").style.display = "inline-block";
  }

  function changeGroup() {
    const id = +elSelected.attr("data-id");
    moveBurgToGroup(id, this.value);
  }

  function toggleNewGroupInput() {
    if (burgInputGroup.style.display === "none") {
      burgInputGroup.style.display = "inline-block";
      burgInputGroup.focus();
      burgSelectGroup.style.display = "none";
    } else {
      burgInputGroup.style.display = "none";
      burgSelectGroup.style.display = "inline-block";
    }
  }

  function createNewGroup() {
    if (!this.value) {
      tip("请提供一个有效的组名", false, "error");
      return;
    }
    const group = this.value
      .toLowerCase()
      .replace(/ /g, "_")
      .replace(/[^\w\s]/gi, "");

    if (document.getElementById(group)) {
      tip("具有此 ID 的元素已经存在。请提供唯一的名称", false, "error");
      return;
    }

    if (Number.isFinite(+group.charAt(0))) {
      tip("组名应以字母开头", false, "error");
      return;
    }

    const id = +elSelected.attr("data-id");
    const oldGroup = elSelected.node().parentNode.id;

    const label = document.querySelector("#burgLabels [data-id='" + id + "']");
    const icon = document.querySelector("#burgIcons [data-id='" + id + "']");
    const anchor = document.querySelector("#anchors [data-id='" + id + "']");
    if (!label || !icon) {
      ERROR && console.error("Cannot find label or icon elements");
      return;
    }

    const labelG = document.querySelector("#burgLabels > #" + oldGroup);
    const iconG = document.querySelector("#burgIcons > #" + oldGroup);
    const anchorG = document.querySelector("#anchors > #" + oldGroup);

    // just rename if only 1 element left
    const count = elSelected.node().parentNode.childElementCount;
    if (oldGroup !== "cities" && oldGroup !== "towns" && count === 1) {
      document.getElementById("burgSelectGroup").selectedOptions[0].remove();
      document.getElementById("burgSelectGroup").options.add(new Option(group, group, false, true));
      toggleNewGroupInput();
      document.getElementById("burgInputGroup").value = "";
      labelG.id = group;
      iconG.id = group;
      if (anchor) anchorG.id = group;
      return;
    }

    // create new groups
    document.getElementById("burgSelectGroup").options.add(new Option(group, group, false, true));
    toggleNewGroupInput();
    document.getElementById("burgInputGroup").value = "";

    addBurgsGroup(group);
    moveBurgToGroup(id, group);
  }

  function removeBurgsGroup() {
    const group = elSelected.node().parentNode;
    const basic = group.id === "cities" || group.id === "towns";

    const burgsInGroup = [];
    for (let i = 0; i < group.children.length; i++) {
      burgsInGroup.push(+group.children[i].dataset.id);
    }
    const burgsToRemove = burgsInGroup.filter(b => !(pack.burgs[b].capital || pack.burgs[b].lock));
    const capital = burgsToRemove.length < burgsInGroup.length;

    alertMessage.innerHTML = /* html */ `您确定要删除 ${
      basic || capital ? "所有未解锁的城镇组元素" : "整个城镇组"
    }?
      <br />请注意，不会删除大写或锁定的城镇. <br /><br />需要移除的城镇: ${burgsToRemove.length}`;
    $("#alert").dialog({
      resizable: false,
      title: "移除城镇组",
      buttons: {
        Remove: function () {
          $(this).dialog("close");
          $("#burgEditor").dialog("close");
          hideGroupSection();
          burgsToRemove.forEach(b => removeBurg(b));

          if (!basic && !capital) {
            // entirely remove group
            const labelG = document.querySelector("#burgLabels > #" + group.id);
            const iconG = document.querySelector("#burgIcons > #" + group.id);
            const anchorG = document.querySelector("#anchors > #" + group.id);
            if (labelG) labelG.remove();
            if (iconG) iconG.remove();
            if (anchorG) anchorG.remove();
          }
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function changeName() {
    const id = +elSelected.attr("data-id");
    pack.burgs[id].name = burgName.value;
    elSelected.text(burgName.value);
  }

  function generateNameRandom() {
    const base = rand(nameBases.length - 1);
    burgName.value = Names.getBase(base);
    changeName();
  }

  function changeType() {
    const id = +elSelected.attr("data-id");
    pack.burgs[id].type = this.value;
  }

  function changeCulture() {
    const id = +elSelected.attr("data-id");
    pack.burgs[id].culture = +this.value;
  }

  function generateNameCulture() {
    const id = +elSelected.attr("data-id");
    const culture = pack.burgs[id].culture;
    burgName.value = Names.getCulture(culture);
    changeName();
  }

  function changePopulation() {
    const id = +elSelected.attr("data-id");
    pack.burgs[id].population = rn(burgPopulation.value / populationRate / urbanization, 4);
  }

  function toggleFeature() {
    const id = +elSelected.attr("data-id");
    const burg = pack.burgs[id];
    const feature = this.dataset.feature;
    const turnOn = this.classList.contains("inactive");
    if (feature === "port") togglePort(id);
    else if (feature === "capital") toggleCapital(id);
    else burg[feature] = +turnOn;
    if (burg[feature]) this.classList.remove("inactive");
    else if (!burg[feature]) this.classList.add("inactive");

    if (burg.port) document.getElementById("burgEditAnchorStyle").style.display = "inline-block";
    else document.getElementById("burgEditAnchorStyle").style.display = "none";
    updateMFCGFrame(burg);
  }

  function toggleBurgLockButton() {
    const id = +elSelected.attr("data-id");
    const burg = pack.burgs[id];
    burg.lock = !burg.lock;

    updateBurgLockIcon();
  }

  function updateBurgLockIcon() {
    const id = +elSelected.attr("data-id");
    const b = pack.burgs[id];
    if (b.lock) {
      document.getElementById("burgLock").classList.remove("icon-lock-open");
      document.getElementById("burgLock").classList.add("icon-lock");
    } else {
      document.getElementById("burgLock").classList.remove("icon-lock");
      document.getElementById("burgLock").classList.add("icon-lock-open");
    }
  }

  function showStyleSection() {
    document.querySelectorAll("#burgBottom > button").forEach(el => (el.style.display = "none"));
    document.getElementById("burgStyleSection").style.display = "inline-block";
  }

  function hideStyleSection() {
    document.querySelectorAll("#burgBottom > button").forEach(el => (el.style.display = "inline-block"));
    document.getElementById("burgStyleSection").style.display = "none";
  }

  function editGroupLabelStyle() {
    const g = elSelected.node().parentNode.id;
    editStyle("labels", g);
  }

  function editGroupIconStyle() {
    const g = elSelected.node().parentNode.id;
    editStyle("burgIcons", g);
  }

  function editGroupAnchorStyle() {
    const g = elSelected.node().parentNode.id;
    editStyle("anchors", g);
  }

  function updateMFCGFrame(burg) {
    const mfcgURL = getMFCGlink(burg);
    document.getElementById("mfcgPreview").setAttribute("src", mfcgURL + "&preview=1");
    document.getElementById("mfcgLink").setAttribute("href", mfcgURL);
  }

  function changeSeed() {
    const id = +elSelected.attr("data-id");
    const burg = pack.burgs[id];
    const burgSeed = +this.value;
    burg.MFCG = burgSeed;
    updateMFCGFrame(burg);
  }

  function randomizeSeed() {
    const id = +elSelected.attr("data-id");
    const burg = pack.burgs[id];
    const burgSeed = rand(1e9 - 1);
    burg.MFCG = burgSeed;
    updateMFCGFrame(burg);
    document.getElementById("mfcgBurgSeed").value = burgSeed;
  }

  function addCustomMfcgLink() {
    const id = +elSelected.attr("data-id");
    const burg = pack.burgs[id];
    const message = "输入指向城镇地图的自定义链接。它可以是一个链接到中世纪幻想城市生成器或其他工具。保持空白以使用 MFCG 种子";
    prompt(message, {default: burg.link || "", required: false}, link => {
      if (link) burg.link = link;
      else delete burg.link;
      updateMFCGFrame(burg);
    });
  }

  function openEmblemEdit() {
    const id = +elSelected.attr("data-id"),
      burg = pack.burgs[id];
    editEmblem("burg", "burgCOA" + id, burg);
  }

  function toggleMFCGMap() {
    options.showMFCGMap = !options.showMFCGMap;
    document.getElementById("mfcgPreviewSection").style.display = options.showMFCGMap ? "block" : "none";
    document.getElementById("burgToggleMFCGMap").className = options.showMFCGMap ? "icon-map" : "icon-map-o";
  }

  function toggleRelocateBurg() {
    const toggler = document.getElementById("toggleCells");
    document.getElementById("burgRelocate").classList.toggle("pressed");
    if (document.getElementById("burgRelocate").classList.contains("pressed")) {
      viewbox.style("cursor", "crosshair").on("click", relocateBurgOnClick);
      tip("点击地图重新定位城镇。按住 Shift 连续移动", true);
      if (!layerIsOn("toggleCells")) {
        toggleCells();
        toggler.dataset.forced = true;
      }
    } else {
      clearMainTip();
      viewbox.on("click", clicked).style("cursor", "default");
      if (layerIsOn("toggleCells") && toggler.dataset.forced) {
        toggleCells();
        toggler.dataset.forced = false;
      }
    }
  }

  function relocateBurgOnClick() {
    const cells = pack.cells;
    const point = d3.mouse(this);
    const cell = findCell(point[0], point[1]);
    const id = +elSelected.attr("data-id");
    const burg = pack.burgs[id];

    if (cells.h[cell] < 20) {
      tip("无法将城镇放入水中! 请选择一个陆地单元格", false, "error");
      return;
    }

    if (cells.burg[cell] && cells.burg[cell] !== id) {
      tip("这个单元格中已经有一个城镇。请选择一个空闲单元格", false, "error");
      return;
    }

    const newState = cells.state[cell];
    const oldState = burg.state;

    if (newState !== oldState && burg.capital) {
      tip("首都不能迁移到另一个国家！", false, "error");
      return;
    }

    // change UI
    const x = rn(point[0], 2),
      y = rn(point[1], 2);
    burgIcons
      .select("[data-id='" + id + "']")
      .attr("transform", null)
      .attr("cx", x)
      .attr("cy", y);
    burgLabels
      .select("text[data-id='" + id + "']")
      .attr("transform", null)
      .attr("x", x)
      .attr("y", y);
    const anchor = anchors.select("use[data-id='" + id + "']");
    if (anchor.size()) {
      const size = anchor.attr("width");
      const xa = rn(x - size * 0.47, 2);
      const ya = rn(y - size * 0.47, 2);
      anchor.attr("transform", null).attr("x", xa).attr("y", ya);
    }

    // change data
    cells.burg[burg.cell] = 0;
    cells.burg[cell] = id;
    burg.cell = cell;
    burg.state = newState;
    burg.x = x;
    burg.y = y;
    if (burg.capital) pack.states[newState].center = burg.cell;

    if (d3.event.shiftKey === false) toggleRelocateBurg();
  }

  function editBurgLegend() {
    const id = elSelected.attr("data-id");
    const name = elSelected.text();
    editNotes("burg" + id, name);
  }

  function showTemperatureGraph() {
    const id = elSelected.attr("data-id");
    showBurgTemperatureGraph(id);
  }

  function removeSelectedBurg() {
    const id = +elSelected.attr("data-id");
    if (pack.burgs[id].capital) {
      alertMessage.innerHTML = /* html */ `你不能移除城镇，因为它是一个国家的首府.<br /><br />
      您可以使用城镇编辑器更改首府 (shift + T)`;
      $("#alert").dialog({
        resizable: false,
        title: "移除城镇",
        buttons: {
          Ok: function () {
            $(this).dialog("close");
          }
        }
      });
    } else {
      alertMessage.innerHTML = "你确定要移除这个城镇吗?";
      $("#alert").dialog({
        resizable: false,
        title: "移除城镇",
        buttons: {
          Remove: function () {
            $(this).dialog("close");
            removeBurg(id); // see Editors module
            $("#burgEditor").dialog("close");
          },
          Cancel: function () {
            $(this).dialog("close");
          }
        }
      });
    }
  }

  function closeBurgEditor() {
    document.getElementById("burgRelocate").classList.remove("pressed");
    burgLabels.selectAll("text").call(d3.drag().on("drag", null)).classed("draggable", false);
    unselect();
  }
}