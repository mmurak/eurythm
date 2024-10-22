// module
import WaveSurfer from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js';
import TimelinePlugin from 'https://unpkg.com/wavesurfer.js@7.8.6/dist/plugins/timeline.js'
import { FieldEnabler } from "./FieldEnabler.js";

class TimeMarkerManager {
	constructor(clickCallback) {
		this.dataPool = [];
		this.clickCallback = clickCallback;
	}
	addData(sectionStart, sectionEnd, note) {
		this.dataPool.push([sectionStart, sectionEnd, note]);
	}
	modifyData(sectionStart, sectionEnd, node, note) {
		let idx = Number(node.id.replace("r", "")) - 1;
		this.dataPool[idx][2] = note;
	}
	deleteData(node) {
		let idx = Number(node.id.replace("r", "")) - 1;
		this.dataPool.splice(idx, 1);
	}
	buildTable(tableObj) {
		tableObj.innerHTML = "";
		let tNo = 1;
		for (let elem of this.dataPool) {
			let newRow = tableObj.insertRow(-1);
			newRow.id = "r" + tNo;

			// Play button cell
			let playCell = newRow.insertCell(0);
			let playCellA = document.createElement("input");
			playCellA.style = "vertical-align: text-top;";
			playCellA.type = "button";
			playCellA.value = "PLAY";
			playCellA.addEventListener("click", () => { this.clickCallback("ps", newRow); });
			playCell.appendChild(playCellA);

			// Start cell
			let cellZero = newRow.insertCell(1);
			cellZero.style.color = "blue";
			let startTime = document.createTextNode(convertTimeRep(elem[0]));
			cellZero.appendChild(startTime);

			// Dummy cell
			let cellDummy = newRow.insertCell(2);
			cellDummy.style.color = "blue";
			cellDummy.appendChild(document.createTextNode("〜"));

			// Stop cell
			let cellOne = newRow.insertCell(3);
			cellOne.style.color = "blue";
			let endTime = document.createTextNode(convertTimeRep(elem[1]));
			cellOne.appendChild(endTime);

			// Comment cell
			let cellTwo = newRow.insertCell(4);
			cellTwo.style = "width: 100em; padding: 0 0 0 10px;";
			let commentText = document.createElement("span");
			commentText.innerHTML = escaper(elem[2]);
			cellTwo.appendChild(commentText);

			// Edit button
			let editButton = newRow.insertCell(5);
			let editButtonAnchor = document.createElement("a");
			editButtonAnchor.addEventListener("click", () => { this.clickCallback("edit", newRow); });
			editButtonAnchor.innerHTML = "✍️";
			editButton.appendChild(editButtonAnchor);

			// Waste bin 🗑️
			let cellWaste = newRow.insertCell(6);
			let cellWasteAnchor = document.createElement("a");
			cellWasteAnchor.addEventListener("click", () => { this.clickCallback("del", newRow); });
			cellWasteAnchor.innerHTML = "🗑️";
			cellWaste.appendChild(cellWasteAnchor);

			tNo++;
		}
	}
	buttonDisabler(tableObj, flag) {
		for (let row of tableObj.rows) {
			row.cells[0].children[0].disabled = flag;
		}
	}
	eraseAllData(tableObj) {
		tableObj.innerHTML = "";
		this.dataPool = [];
	}
}

class GlobalManager {
	constructor() {
		this.inputFile = document.getElementById("InputFile");
		this.timerField = document.getElementById("TimerField");
		this.totalDuration = document.getElementById("TotalDuration");
		this.zoomIn = document.getElementById("ZoomIn");
		this.zoomOut = document.getElementById("ZoomOut");
		this.playPause = document.getElementById("PlayPause");
		this.speedHeader = document.getElementById("SpeedHeader");
		this.speedDigits = document.getElementById("SpeedDigits");
		this.speedVal = document.getElementById("SpeedVal");
		this.defaultSpeed = document.getElementById("DefaultSpeed");
		this.jumpSelector = document.getElementById("JumpSelector");
		this.leftArrowButton = document.getElementById("LeftArrowButton");
		this.rightArrowButton = document.getElementById("RightArrowButton");
		this.loopFlag = document.getElementById("LoopFlag");
		this.markA = document.getElementById("MarkA");
		this.markB = document.getElementById("MarkB");
		this.abTable = document.getElementById("ABtable");

		this.descOkButton = document.getElementById("DescOkButton");
		this.descDialog = document.getElementById("DescDialog");
		this.descArea = document.getElementById("DescArea");

		this.wavePlayer = null;

		this.currentZoomFactor = 10;
		this.minimumZoomFactor = 10;
		this.zoomDelta = 10;
		this.storedZoomFactor = 10;
		this.timer;
		this.timerObj = null;

		this.speedStorage = 1;
		this.defaultSpeedLabel = "1x Speed";

		this.sectionStart = 0;
		this.sectionEnd = 0;
		this.playStartMark = 0;
		this.playEndMark = -1;

		this.fontSize = document.getElementById("FontSize");

		this.timeMarkerManager = new TimeMarkerManager(abControl);
		this.editMode = false;
		this.edittingNode = null;

		this.fieldEnabler = new FieldEnabler([
			"InputFile",
			"PlayPause",
			"SpeedHeader",
			"SpeedVal",
			"DefaultSpeed",
			"RightArrowButton",
			"LeftArrowButton",
			"MarkA",
			"MarkB",
		]);

		this.fieldEnabler.setEnable(["InputFile"]);

	}
}
const G = new GlobalManager();

G.abTable.style = "font-size:" + G.fontSize.value + "px";

/*
 * waveSurfer section
 */

// File input
G.inputFile.addEventListener("change", (e) => {
	let file = G.inputFile.files[0];
	if (file) {
		if (G.wavePlayer != null) {
			G.wavePlayer.destroy();
		}
		G.wavePlayer = WaveSurfer.create({
			container: '#waveform',
			waveColor: '#00BFFF',
			progressColor: '#87CEBB',
			height: 250,
		});
		G.wavePlayer.registerPlugin(TimelinePlugin.create({
			secondaryLabelOpacity: 1,
		}));
		G.wavePlayer.on("ready", () => {
			readyCB();
		});
		G.wavePlayer.on("play", () => {
			playCB();
		});
		G.wavePlayer.on("pause", () => {
			pauseCB();
		});
		G.wavePlayer.on("timeupdate", (time) => {
			if (G.playEndMark != -1) {
				if (time >= G.playEndMark) {
					G.wavePlayer.pause();
					if (G.loopFlag.checked) {
						G.wavePlayer.setTime(G.playStartMark);
						G.wavePlayer.play();
					} else {
						G.playEndMark = -1;
					}
				}
			}
			updateProgressFromSec(time);
		});
		const url = URL.createObjectURL(file);
		G.wavePlayer.load(url);
		G.fieldEnabler.setEnable([
			"InputFile",
		]);
	}
});

G.inputFile.addEventListener("focus", () => {G.inputFile.blur()});	// this is to prevent activation by key-input.

// Play/Pause control
G.playPause.addEventListener("click", playPauseControl);
G.playPause.addEventListener("focus", () => {G.playPause.blur(); });

// Reset play speed
G.defaultSpeed.addEventListener("click", resetPlaySpeed);

// Change play speed
G.speedVal.addEventListener("input", _changePlaySpeed);
function _changePlaySpeed() {
	const sp = Number(G.speedVal.value).toFixed(2);
	G.speedDigits.innerHTML = sp;
	if (sp != 1) {
		G.speedStorage = sp;
		G.defaultSpeed.value = G.defaultSpeedLabel;
	}
	G.wavePlayer.setPlaybackRate(G.speedVal.value, true);
}
G.speedVal.addEventListener("focus", () => { G.speedVal.blur(); });

G.jumpSelector.addEventListener("change", (evt) => {
	evt.preventDefault();
});

G.leftArrowButton.addEventListener("click", leftButtonClick);
G.rightArrowButton.addEventListener("click", rightButtonClick);

G.zoomIn.addEventListener("click", (evt) => { processZoomIn(evt); });
function processZoomIn(evt) {
	G.zoomOut.disabled = false;
	if (evt.ctrlKey) {
		G.currentZoomFactor = G.storedZoomFactor;
	} else {
		G.currentZoomFactor += G.zoomDelta;
		G.storedZoomFactor = G.currentZoomFactor;
	}
	G.wavePlayer.zoom(G.currentZoomFactor);
	evt.preventDefault();
}

G.zoomOut.addEventListener("click", (evt) => { processZoomOut(evt); });
function processZoomOut(evt) {
	if (G.currentZoomFactor > G.minimumZoomFactor) {
		if (evt.ctrlKey) {
			G.storedZoomFactor = G.currentZoomFactor;
			G.currentZoomFactor = G.minimumZoomFactor;
		} else {
			G.currentZoomFactor -= G.zoomDelta;
		}
		G.wavePlayer.zoom(G.currentZoomFactor);
		if (G.currentZoomFactor == G.minimumZoomFactor) {
			G.zoomOut.disabled = true;
		}
	}
	evt.preventDefault();
}

G.markA.addEventListener("click", markSectionStart);

G.markB.addEventListener("click", (evt) => {
	if (evt.shiftKey) {
		markSectionEndWithText();
	} else {
		markSectionEndWithoutText();
	}
});

G.descOkButton.addEventListener("click", () => { processDescOk(); });

document.addEventListener("keydown", (evt) => {
	if ((G.playPause.disabled) || (G.descDialog.style.display == "block"))  return;
	if (evt.key == " ") {
		playPauseControl();
	} else if (evt.key == "ArrowLeft") {
		leftButtonClick();
	} else if (evt.key == "ArrowRight") {
		rightButtonClick();
	} else if ((evt.key >= "1") && (evt.key <= 9)) {
		let delta = (evt.ctrlKey) ? Number(evt.key) : -Number(evt.key);
		G.wavePlayer.setTime(G.wavePlayer.getCurrentTime() + delta);
	} else if (evt.key == "ArrowUp") {
		G.speedVal.value = Number(G.speedVal.value) + 0.05;
		_changePlaySpeed();
	} else if (evt.key == "ArrowDown") {
		G.speedVal.value = Number(G.speedVal.value) - 0.05;
		_changePlaySpeed();
	} else if ((evt.key == "a") || (evt.key == "A")) {
		markSectionStart();
	} else if (evt.key == "b") {
		markSectionEndWithoutText();
	} else if (evt.key == "B") {
		markSectionEndWithText();
	} else if ((evt.key == "d") || (evt.key == "D")) {
		resetPlaySpeed();
	} else if ((evt.key == "i") || (evt.key == "I")) {
		processZoomIn(evt);
	} else if ((evt.key == "o") || (evt.key == "O")) {
		processZoomOut(evt);
	}
//	evt.stopPropagation();
	evt.preventDefault();
	return false;
});

// Double-click disabler
document.addEventListener("dblclick", (e) => {
	e.preventDefault();
});

G.fontSize.addEventListener("focus", (evt) => {
	G.fontSize.value = "";
});

G.fontSize.addEventListener("change", (evt) => {
	G.abTable.style = "font-size:" + G.fontSize.value + "px";
	G.fontSize.blur();
});



// Callback functions (for fieldEnabler)
function readyCB() {
	G.fieldEnabler.setEnable([
		"InputFile",
		"PlayPause",
		"SpeedHeader",
		"SpeedVal",
		"DefaultSpeed",
		"LeftArrowButton",
		"RightArrowButton",
		"MarkA",
		"MarkB",
	]);
	G.zoomIn.disabled = false;
	G.zoomOut.disabled = true;

	G.currentZoomFactor = Math.trunc(window.innerWidth / G.wavePlayer.getDuration());
	if (G.currentZoomFactor < 1)
		G.currentZoomFactor = 1;
	G.minimumZoomFactor = G.currentZoomFactor;
	G.zoomDelta = G.currentZoomFactor;
	G.storedZoomFactor = G.currentZoomFactor;
	G.wavePlayer.zoom(G.currentZoomFactor);

	G.speedVal.value = 1.0;
	G.defaultSpeed.value = G.defaultSpeedLabel;
	G.speedDigits.innerHTML = Number(G.speedVal.value).toFixed(2);
	G.totalDuration.innerHTML = convertTimeRep(G.wavePlayer.getDuration());
	G.speedStorage = 1;

	G.timeMarkerManager.eraseAllData(G.abTable);
	G.timeMarkerManager.addData(0.0, G.wavePlayer.getDuration(), "");
	G.timeMarkerManager.buildTable(G.abTable);
}
function playCB() {
	G.fieldEnabler.setEnable([
		"PlayPause",
		"SpeedHeader",
		"SpeedVal",
		"DefaultSpeed",
		"LeftArrowButton",
		"RightArrowButton",
		"MarkA",
		"MarkB",
	]);
	G.playPause.value = "Pause";
	G.timeMarkerManager.buttonDisabler(G.abTable, true);
}
function pauseCB() {
	G.fieldEnabler.setEnable([
		"InputFile",
		"PlayPause",
		"SpeedHeader",
		"SpeedVal",
		"DefaultSpeed",
		"LeftArrowButton",
		"RightArrowButton",
		"MarkA",
		"MarkB",
	]);
	G.playPause.value = "Play";
	G.timeMarkerManager.buttonDisabler(G.abTable, false);
}

function playPauseControl() {
	G.playStartMark = 0;
	G.playEndMark = -1;
	if (G.wavePlayer.isPlaying()) {
		G.wavePlayer.pause();
	} else {
		G.wavePlayer.play();
	}
}

function resetPlaySpeed() {
	if (G.speedVal.value == 1.0) {
		G.speedVal.value = G.speedStorage;
		G.defaultSpeed.value = G.defaultSpeedLabel;
	} else {
		G.speedVal.value = 1.0;
		G.defaultSpeed.value = G.speedStorage + "x Speed";
	}
	G.speedVal.dispatchEvent(new Event("input"));
}

function leftButtonClick() {
	G.wavePlayer.setTime(G.wavePlayer.getCurrentTime() - Number(G.jumpSelector.value));
}

function rightButtonClick() {
	G.wavePlayer.setTime(G.wavePlayer.getCurrentTime() + Number(G.jumpSelector.value));
}

function markSectionStart() {
	G.sectionStart = G.wavePlayer.getCurrentTime();
	G.markA.value = convertTimeRep(G.sectionStart) + " →";
}

function markSectionEndWithoutText() {
	const currentTime = G.wavePlayer.getCurrentTime();
	if (currentTime <= G.sectionStart)  return;
	G.markA.value = "A";
	G.sectionEnd = currentTime;
	G.timeMarkerManager.addData(G.sectionStart, G.sectionEnd, "");
	G.timeMarkerManager.buildTable(G.abTable);
	if (G.wavePlayer.isPlaying()) {
		G.timeMarkerManager.buttonDisabler(G.abTable, true);
	}
}

function markSectionEndWithText() {
	const currentTime = G.wavePlayer.getCurrentTime();
	if (currentTime <= G.sectionStart)  return;
	G.markA.value = "A";
	G.sectionEnd = currentTime;
	G.descArea.value = "";
	G.editMode = false;
	G.descDialog.style = "display: block;";
	G.descArea.focus();
}

function processDescOk() {
	if (G.editMode) {
		G.timeMarkerManager.modifyData(G.sectionStart, G.sectionEnd, G.edittingNode, G.descArea.value);
	} else {
		G.timeMarkerManager.addData(G.sectionStart, G.sectionEnd, G.descArea.value);
	}
	G.timeMarkerManager.buildTable(G.abTable);
	if (G.wavePlayer.isPlaying()) {
		G.timeMarkerManager.buttonDisabler(G.abTable, true);
	}
	G.descDialog.style = "display: none;";
	G.markA.value = "A";
}

function convertTimeRep(time) {
	let formattedTime = [
		Math.floor(time / 60), // minutes
		Math.floor(time % 60), // seconds
	].map((v) => (v < 10 ? '0' + v : v)).join(':');
	formattedTime += "." + ("" + Math.trunc(time * 100) % 100).padStart(2, "0");
	return formattedTime;
}

function updateProgressFromSec(time) {
	G.timerField.innerHTML = convertTimeRep(time);
}

function timeRepToSec(str) {
	const seg = str.split(":");
	return Number(seg[0]) * 60 + Number(seg[1]);
}

function abControl(command, node) {
	if (G.wavePlayer.isPlaying())  return;
	if (command == "del") {
		G.timeMarkerManager.deleteData(node);
		G.timeMarkerManager.buildTable(G.abTable);
	} else if (command == "edit") {
		G.sectionStart = node.cells[1];
		G.sectionEnd = node.cells[3];
		let text = recoverer(node.cells[4].firstChild.innerHTML);
		G.descArea.value = text;
		G.editMode = true;
		G.edittingNode = node;
		G.descDialog.style = "display: block;";
		G.descArea.focus();

	} else {
		G.playStartMark = Number(timeRepToSec(node.cells[1].innerHTML));
		G.wavePlayer.setTime(G.playStartMark);
		G.playEndMark =  Number(timeRepToSec(node.cells[3].innerHTML));
		G.wavePlayer.play();
	}
}

function escaper(str) {
	return str.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br>");
}

function recoverer(str) {
	return str.replaceAll("<br>", "\n").replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&amp;", "&");
}
