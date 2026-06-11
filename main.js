"use strict";

const PLAYER_COLORS = {
  even: "#ED1A3D",
  odd: "#31A9EE",
  empty: "#ffffff",
  ink: "#000000",
  highlight: "yellow",
};

function updateBoardScale() {
  if (!window.matchMedia("(max-width: 760px)").matches) {
    document.documentElement.style.removeProperty("--board-scale");
    return;
  }

  // 盤の左右に並ぶ持ち駒2列分(約100px)を差し引いて盤のスケールを決める
  const availableWidth = window.innerWidth - 56 - 100;
  const availableHeight = window.innerHeight - 240;
  const scale = Math.max(
    0.42,
    Math.min(availableWidth / 470, availableHeight / 470, 0.72)
  );

  document.documentElement.style.setProperty("--board-scale", scale);
}

updateBoardScale();
window.addEventListener("resize", updateBoardScale);
window.addEventListener("orientationchange", updateBoardScale);

/* ルールモーダル */
const ruleModal = document.getElementById("ruleModal");
const openModalBtn = document.getElementById("openModal");
const closeModalBtn = document.getElementById("closeModal");

openModalBtn.addEventListener("click", () => {
  ruleModal.classList.add("is-open");
});

closeModalBtn.addEventListener("click", () => {
  ruleModal.classList.remove("is-open");
});

window.addEventListener("click", (event) => {
  if (event.target === ruleModal) {
    ruleModal.classList.remove("is-open");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    ruleModal.classList.remove("is-open");
  }
});

// 13,15は除外
const GRAPH = [
  [1, 2, 8, 11, 7, 12],
  [0, 12, 2],
  [0, 1, 3, 9, 8],
  [2, 14, 4, 9],
  [3, 14, 5, 6, 10, 9],
  [4, 14, 6],
  [4, 5, 7, 11, 10],
  [0, 11, 6, 12],
  [0, 2, 9, 10, 11],
  [2, 3, 4, 10, 8],
  [4, 6, 11, 8, 9],
  [0, 8, 10, 6, 7],
];

class State {
  constructor(pieces = null, enemyPieces = null, vertices = null) {
    this.pieces = vertices ? pieces : [2, 4, 6, 8, 10, 12];
    this.enemy_pieces = vertices ? enemyPieces : [1, 3, 5, 7, 9, 11];
    this.vertices = vertices
      ? vertices
      : [null, null, null, null, null, null, null, null, null, null, null, null];
  }

  legal_actions() {
    const actions = [];

    this.pieces.forEach((piece) => {
      this.vertices.forEach((vertex, index) => {
        if (vertex == null) {
          actions.push([piece, index]);
        }
      });
    });

    return actions;
  }

  next(action) {
    const pieces = this.pieces.concat();
    const vertices = this.vertices.concat();
    const index = pieces.indexOf(action[0]);

    pieces.splice(index, 1);
    vertices[action[1]] = action[0];

    return new State(this.enemy_pieces, pieces, vertices);
  }

  is_done() {
    return this.pieces.length == 0;
  }

  minmax() {
    const marks = [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      12,
      13,
      14,
      15,
    ];

    for (let i = 1; i < 13; i++) {
      const vertex = this.vertices.indexOf(i);
      marks[vertex] = 0;

      for (let j = 0; j < GRAPH[vertex].length; j++) {
        const nextVertex = GRAPH[vertex][j];
        const connectsStartAndGoal =
          (marks[nextVertex] == 12 && marks[vertex] == 14) ||
          (marks[nextVertex] == 14 && marks[vertex] == 12);

        if (connectsStartAndGoal) {
          return i;
        }

        if (marks[nextVertex] == 12 || marks[nextVertex] == 14) {
          const mark = marks[nextVertex];
          marks[vertex] = mark;

          const stack = [vertex];
          while (stack.length > 0) {
            const currentVertex = stack.pop();

            GRAPH[currentVertex].forEach((connectedVertex) => {
              if (marks[connectedVertex] == 0) {
                marks[connectedVertex] = mark;
                stack.push(connectedVertex);
              }
            });
          }
        }
      }
    }
  }

  even_win() {
    return this.minmax() % 2 == 0;
  }
}

function random_action(state) {
  const actions = state.legal_actions();
  const rand = Math.floor(Math.random() * actions.length);
  return actions[rand];
}

function playout(state) {
  while (true) {
    if (state.is_done()) {
      return state.even_win() ? 1 : 0;
    }

    const action = random_action(state);
    state = state.next(action);
  }
}

function argmax(list) {
  let index = 0;
  let value = -Infinity;

  for (let i = 0; i < list.length; i++) {
    if (value < list[i]) {
      value = list[i];
      index = i;
    }
  }

  return index;
}

function argmin(list) {
  let index = 0;
  let value = Infinity;

  for (let i = 0; i < list.length; i++) {
    if (value > list[i]) {
      value = list[i];
      index = i;
    }
  }

  return index;
}

function mcts_action(state) {
  class Node {
    constructor(state) {
      this.state = state;
      this.w = 0;
      this.n = 0;
      this.child_nodes = [];
    }

    evaluate() {
      if (this.state.is_done()) {
        const value = this.state.even_win() ? 1 : 0;
        this.w += value;
        this.n += 1;
        return value;
      }

      if (this.child_nodes.length == 0) {
        const value = playout(this.state);
        this.w += value;
        this.n += 1;

        this.state.legal_actions().forEach((action) => {
          const childNode = new Node(this.state.next(action));
          this.child_nodes.push(childNode);
        });

        return value;
      }

      const value = this.next_child_node().evaluate();
      this.w += value;
      this.n += 1;
      return value;
    }

    next_child_node() {
      const ucbValues = [];
      let totalVisits = 1;

      this.child_nodes.forEach((childNode) => {
        totalVisits += childNode.n;
      });

      const even = this.state.pieces[0] % 2 == 0 ? 1 : -1;

      this.child_nodes.forEach((childNode) => {
        let value;

        if (childNode.n > 0) {
          value =
            childNode.w / childNode.n +
            even * Math.sqrt((2 * Math.log(totalVisits)) / childNode.n);
        } else {
          value = even * 100;
        }

        ucbValues.push(value);
      });

      if (even == 1) {
        return this.child_nodes[argmax(ucbValues)];
      }

      return this.child_nodes[argmin(ucbValues)];
    }
  }

  const rootNode = new Node(state);

  for (let i = 0; i < evaluateCount; i++) {
    rootNode.evaluate();
  }

  let max = -Infinity;
  let index = null;

  rootNode.child_nodes.forEach((childNode, i) => {
    if (childNode.n > max) {
      max = childNode.n;
      index = i;
    }
  });

  return state.legal_actions()[index];
}

function getPieceColor(piece) {
  return piece % 2 == 0 ? PLAYER_COLORS.even : PLAYER_COLORS.odd;
}

function place_piece(action) {
  const num = document.getElementById(`n${action[0]}`);
  num.style.color = PLAYER_COLORS.ink;
  num.style.background = PLAYER_COLORS.empty;

  const vertex = document.getElementById(`v${action[1]}`);
  vertex.textContent = `${action[0]}`;
  vertex.style.background = getPieceColor(action[0]);
  vertex.style.cursor = "auto";
}

function resetGame() {
  document.getElementById("fin").style.display = "none";

  const minmaxVertex = document.getElementById(`v${minmax}`);
  minmaxVertex.style.borderColor = PLAYER_COLORS.ink;
  minmaxVertex.style.borderInlineWidth = "2px";

  if (a0 != null) {
    document.getElementById(`n${a0}`).classList.remove("scale");
  }

  for (let i = 0; i < 12; i++) {
    const vertex = document.getElementById(`v${i}`);
    vertex.textContent = "";
    vertex.style.background = PLAYER_COLORS.empty;
  }

  for (let i = 1; i < 13; i++) {
    const num = document.getElementById(`n${i}`);
    num.style.color = PLAYER_COLORS.empty;
    num.style.background = getPieceColor(i);
  }

  state = new State();
  playerFlag = false;
  resetFlag = true;
  a0 = null;
}

function getCheckedValue(formControls) {
  for (let i = 0; i < formControls.length; i++) {
    if (formControls[i].checked) {
      return formControls[i].value;
    }
  }
}

function setEvaluateCount() {
  if (level == 1) {
    evaluateCount = 80;
  } else if (level == 2) {
    evaluateCount = 1000;
  } else {
    evaluateCount = 30000;
  }
}

function startGame() {
  if (!resetFlag) {
    return;
  }

  resetFlag = false;
  teban = getCheckedValue(document.Teban.teban);
  level = getCheckedValue(document.Level.level);
  setEvaluateCount();

  for (let i = 0; i < 12; i++) {
    document.getElementById(`v${i}`).style.cursor = "pointer";
  }

  if (teban == 0) {
    state.pieces.forEach((piece) => {
      document.getElementById(`n${piece}`).style.cursor = "pointer";
    });

    playerFlag = true;
  } else {
    state.enemy_pieces.forEach((piece) => {
      document.getElementById(`n${piece}`).style.cursor = "pointer";
    });

    cpu();
  }
}

function selectPiece(num, piece) {
  if (!playerFlag || !state.pieces.includes(piece)) {
    return;
  }

  num.classList.add("scale");

  if (a0 != null && a0 != piece) {
    document.getElementById(`n${a0}`).classList.remove("scale");
  }

  a0 = piece;
}

function selectVertex(vertexIndex) {
  if (!playerFlag || a0 == null || state.vertices[vertexIndex] != null) {
    return;
  }

  const action = [a0, vertexIndex];
  place_piece(action);

  document.getElementById(`n${action[0]}`).style.cursor = "auto";
  document.getElementById(`n${action[0]}`).classList.remove("scale");

  state = state.next(action);
  a0 = null;
  playerFlag = false;

  state.is_done() ? fin() : cpu();
}

function addClickEvent() {
  document.getElementById("reset").addEventListener("click", resetGame);
  document.getElementById("play").addEventListener("click", startGame);

  for (let i = 1; i < 13; i++) {
    const num = document.getElementById(`n${i}`);
    num.addEventListener("click", () => {
      selectPiece(num, i);
    });
  }

  for (let i = 0; i < 12; i++) {
    document.getElementById(`v${i}`).addEventListener("click", () => {
      selectVertex(i);
    });
  }

  document.getElementById("close_btn").addEventListener("click", () => {
    document.getElementById("fin").style.display = "none";
  });
}

function cpu() {
  let action;

  if (level == 1 && state.pieces.length == 6) {
    action = random_action(state);
    console.log("rand");
  } else {
    action = mcts_action(state);
  }

  place_piece(action);
  state = state.next(action);
  state.is_done() ? fin() : (playerFlag = true);
}

function fin() {
  document.getElementById("fin").style.display = "block";
  document.getElementById("winner").textContent =
    state.minmax() % 2 == teban ? "YOU WIN!" : "CPU WIN";

  minmax = state.vertices.indexOf(state.minmax());

  const vertex = document.getElementById(`v${minmax}`);
  vertex.style.borderColor = PLAYER_COLORS.highlight;
  vertex.style.borderInlineWidth = "6px";
}

let teban;
let level;
let state = new State();
let playerFlag = false;
let resetFlag = true;
let a0 = null;
let minmax = 0;
let evaluateCount = 1000;

addClickEvent();

const startTime = Date.now(); // 開始時間
const endTime = Date.now(); // 終了時間
console.log("time =", endTime - startTime);
