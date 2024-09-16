// module
import WaveSurfer from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js';
import { FieldEnabler } from "./FieldEnabler.js";

class TimeMarkerManager {
	constructor(clickCallback) {
		this.dataPool = [];
		this.clickCallback = clickCallback;
	}
	addData(sectionStart, sectionEnd, note) {
		this.dataPool.push([sectionStart, sectionEnd, note]);
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
			playCellA.type = "button";
			playCellA.value = "PLAY";
			playCellA.addEventListener("click", () => { this.clickCallback("ps", newRow); });
			playCell.appendChild(playCellA);

			// Start cell
			let cellZero = newRow.insertCell(1);
			let startTime = document.createTextNode(convertTimeRep(elem[0]));
			cellZero.appendChild(startTime);

			// Dummy cell
			let cellDummy = newRow.insertCell(2);
			cellDummy.appendChild(document.createTextNode("〜"));

			// Stop cell
			let cellOne = newRow.insertCell(3);
			let endTime = document.createTextNode(convertTimeRep(elem[1]));
			cellOne.appendChild(endTime);

			// Waste bin 🗑️
			let cellWaste = newRow.insertCell(4);
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

		this.wavePlayer = null;

		this.currentZoomFactor = 10;
		this.minimumZoomFactor = 10;
		this.zoomDelta = 10;
		this.storedZoomFactor = 10;
		this.timer;
		this.timerObj = null;

		this.sectionStart = 0;
		this.sectionEnd = 0;
		this.playStartMark = 0;
		this.playEndMark = -1;

		this.timeMarkerManager = new TimeMarkerManager(abControl);

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

// Reset play speed
G.defaultSpeed.addEventListener("click", resetPlaySpeed);

// Change play speed
G.speedVal.addEventListener("input", _changePlaySpeed);
function _changePlaySpeed() {
	G.speedDigits.innerHTML = Number(G.speedVal.value).toFixed(2);
	G.wavePlayer.setPlaybackRate(G.speedVal.value, true);
}

G.speedVal.addEventListener("focus", () => { G.speedVal.blur(); });

G.jumpSelector.addEventListener("change", (evt) => {
	evt.preventDefault();
});

G.leftArrowButton.addEventListener("click", leftButtonClick);
G.rightArrowButton.addEventListener("click", rightButtonClick);

G.zoomIn.addEventListener("click", (evt) => {
	G.zoomOut.disabled = false;
	if (evt.shiftKey) {
		G.currentZoomFactor = G.storedZoomFactor;
	} else {
		G.currentZoomFactor += G.zoomDelta;
		G.storedZoomFactor = G.currentZoomFactor;
	}
	G.wavePlayer.zoom(G.currentZoomFactor);
});

G.zoomOut.addEventListener("click", (evt) => {
	if (G.currentZoomFactor > G.minimumZoomFactor) {
		if (evt.shiftKey) {
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
});

G.markA.addEventListener("click", markSectionStart);

G.markB.addEventListener("click", markSectionEnd);

document.addEventListener("keydown", (evt) => {
	if (G.playPause.disabled)  return;
	if (evt.key == " ") {
		playPauseControl();
		evt.preventDefault();
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
	} else if ((evt.key == "b") || (evt.key == "B")) {
		markSectionEnd();
	} else if ((evt.key == "d") || (evt.key == "D")) {
		resetPlaySpeed();
	}
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

	G.currentZoomFactor = Math.trunc(window.innerWidth / G.wavePlayer.getDuration());
	G.minimumZoomFactor = G.currentZoomFactor;
	G.zoomDelta = G.currentZoomFactor;
	G.storedZoomFactor = G.currentZoomFactor;
	G.wavePlayer.zoom(G.currentZoomFactor);

	G.speedVal.value = 1.0;
	G.speedDigits.innerHTML = Number(G.speedVal.value).toFixed(2);
	G.totalDuration.innerHTML = convertTimeRep(G.wavePlayer.getDuration());

	G.timeMarkerManager.eraseAllData(G.abTable);
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
	G.speedVal.value = 1.0;
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

function markSectionEnd() {
	const currentTime = G.wavePlayer.getCurrentTime();
	if (currentTime <= G.sectionStart)  return;
	G.markA.value = "A";
	G.sectionEnd = currentTime;
	G.timeMarkerManager.addData(G.sectionStart, G.sectionEnd, "some notes");
	G.timeMarkerManager.buildTable(G.abTable);
	if (G.wavePlayer.isPlaying()) {
		G.timeMarkerManager.buttonDisabler(G.abTable, true);
	}
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
		
	} else {
		G.playStartMark = Number(timeRepToSec(node.cells[1].innerHTML));
		G.wavePlayer.setTime(G.playStartMark);
		G.playEndMark =  Number(timeRepToSec(node.cells[3].innerHTML));
		G.wavePlayer.play();
	}
}