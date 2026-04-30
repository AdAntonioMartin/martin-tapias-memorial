import { NODE_W, NODE_H, GENDER_COLOR, GENDER_EMOJI } from "./config.js";
import { svgEl } from "./utils.js";

function clearEl(id) {
  var element = document.getElementById(id);
  if (element) {
    element.innerHTML = "";
  }
  return element;
}

export function renderConnectors(graph, layout) {
  var group = clearEl("tree-connectors");
  if (!group) {
    return;
  }

  Object.keys(graph.unionMap).forEach(function (unionId) {
    var union = graph.unionMap[unionId];
    if (!union || !union.partners || !union.partners.length) {
      return;
    }

    var a = layout.pos[union.partners[0]];
    var b = union.partners[1] ? layout.pos[union.partners[1]] : null;
    var mid = layout.unionPos[unionId];
    if (!a || !mid) {
      return;
    }

    var type = union.type || "married";
    var x1 = a.x + NODE_W / 2;
    var y1 = a.y + NODE_H / 2;
    var cx = mid.x + NODE_W / 2;
    var cy = mid.y + NODE_H / 2;
    var size = 5;

    if (b) {
      var x2 = b.x + NODE_W / 2;
      var y2 = b.y + NODE_H / 2;
      group.appendChild(svgEl("line", {
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        "class": "tree-conn-partner tree-conn-partner--" + type
      }));

      group.appendChild(svgEl("polygon", {
        points:
          cx + "," + (cy - size) + " " +
          (cx + size) + "," + cy + " " +
          cx + "," + (cy + size) + " " +
          (cx - size) + "," + cy,
        "class": "tree-union-diamond tree-union-diamond--" + type
      }));
    }

    var childAnchors = (union.children || []).map(function (childId) {
      var child = layout.pos[childId];
      if (!child) {
        return null;
      }
      return {
        x: child.x + NODE_W / 2,
        y: child.y - 8
      };
    }).filter(Boolean);

    if (!childAnchors.length) {
      return;
    }

    var startY = cy + size;
    var minChildY = Math.min.apply(null, childAnchors.map(function (p) { return p.y; }));
    var busY = Math.min(minChildY - 18, startY + 94);
    if (busY < startY + 14) {
      busY = startY + 14;
    }

    group.appendChild(svgEl("line", {
      x1: cx,
      y1: startY,
      x2: cx,
      y2: busY,
      "class": "tree-conn-child"
    }));

    var childXs = childAnchors.map(function (p) { return p.x; });
    var minX = Math.min.apply(null, childXs);
    var maxX = Math.max.apply(null, childXs);
    var xStart = Math.min(cx, minX);
    var xEnd = Math.max(cx, maxX);

    // Si sólo hay un hijo y coincide con el centro, forzar tramo visible.
    if (xStart === xEnd) {
      xStart -= 10;
      xEnd += 10;
    }

    group.appendChild(svgEl("line", {
      x1: xStart,
      y1: busY,
      x2: xEnd,
      y2: busY,
      "class": "tree-conn-child"
    }));

    childAnchors.forEach(function (point) {
      group.appendChild(svgEl("line", {
        x1: point.x,
        y1: busY,
        x2: point.x,
        y2: point.y + 50,
        "class": "tree-conn-child"
      }));
    });
  });
}

export function renderNodes(graph, layout, onOpen) {
  var group = clearEl("tree-nodes");
  if (!group) {
    return;
  }

  Object.keys(graph.nodes).forEach(function (id) {
    var node = graph.nodes[id];
    var point = layout.pos[id];
    if (!node || !point) {
      return;
    }

    var accent = GENDER_COLOR[node.gender] || GENDER_COLOR.unknown;
    var foreign = svgEl("foreignObject", {
      x: point.x,
      y: point.y,
      width: NODE_W,
      height: NODE_H,
      overflow: "visible"
    });
    foreign.dataset.pid = id;

    var card = document.createElement("div");
    card.className = "tree-node-card";
    card.style.setProperty("--node-accent", accent);
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "Ver ficha de " + node.name);

    var avatar = document.createElement("div");
    avatar.className = "tree-node-avatar";
    avatar.style.borderColor = accent + "55";

    if (node.photo) {
      var img = document.createElement("img");
      img.src = node.photo;
      img.alt = node.name;
      avatar.appendChild(img);
    } else {
      avatar.textContent = GENDER_EMOJI[node.gender] || GENDER_EMOJI.unknown;
    }

    var name = document.createElement("div");
    name.className = "tree-node-name";
    name.textContent = node.name;

    var years = document.createElement("div");
    years.className = "tree-node-years";
    years.textContent = node.years;

    card.appendChild(avatar);
    card.appendChild(name);
    card.appendChild(years);

    card.addEventListener("click", function (event) {
      event.stopPropagation();
      onOpen(id);
    });
    card.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen(id);
      }
    });

    foreign.appendChild(card);
    group.appendChild(foreign);
  });
}
