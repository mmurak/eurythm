export class FieldEnabler {
	constructor(fieldNameArray) {
		this.fieldNameArray = fieldNameArray;
	}
	setEnable(fields) {
		this.fieldNameArray.forEach((fName) => {
			document.getElementById(fName).disabled = !fields.includes(fName);
		});
	}
}

// export default { FieldEnabler };
