// Copyright 2016-2018 by Frank Trampe independently and for Autolotto.
// This is hereby released under the terms of the BSD 3-clause license, the MIT/X11 license, and the Apache 2.0 license.

/**
 * Compute a scalar value from a rule and a set of named input values.
 * @param {(number|object)} rule - A flat number or an object defining the number in terms of input values.
 * @param {?object} vector - A dictionary of values.
 * @returns {number} The computed number.
*/
function valueFromRule(rule, vector) {
	// This is from Frank.
	var accumulator = 0;
	if (typeof(rule) == "number") return rule;
	if (rule == null || rule == undefined) return null;
	if ("base" in rule && typeof(rule.base) == "number") accumulator = rule.base;
	var parameterName;
	if (vector != null)
		for (parameterName in vector)
			if ("multipliers" in rule && parameterName in rule.multipliers &&
					typeof(rule.multipliers[parameterName]) == "number")
				accumulator += rule.multipliers[parameterName] * vector[parameterName];
	if ("min" in rule && typeof(rule["min"]) == "number" && accumulator < rule["min"])
		accumulator = rule["min"];
	if ("max" in rule && typeof(rule["max"]) == "number" && accumulator > rule["max"])
		accumulator = rule["max"];
	if ("value" in rule) accumulator = rule.value;
	return accumulator;
}

/**
 * Compute a scalar value from a rule and a set of named input values if the named rule is in a given set or from a fallback value otherwise.
 * @param {Object.<string,number|object>} rules - A dictionary of rules.
 * @param {string} ruleName - The name of the desired rule.
 * @param {?object} vector - A dictionary of values.
 * @param {?number} vector - The value to return in the event that the rule is missing.
 * @returns {number} The computed number.
*/
function valueFromRuleInRules(rules, ruleName, vector, fallback) {
	if (rules && ruleName in rules)
		return valueFromRule(rules[ruleName], vector);
	return fallback;
}

/**
 * Determine whether one array is a subsequence of another.
 * @param {Array} a0 - The prospective supersequence array.
 * @param {Array} a1 - The prospective subsequence array.
 * @returns {number} 1 if a1 is a subsequence of a0, 0 otherwise.
*/
function arraySubset(g0, g1) {
	// From Frank.
	if (g0.length < g1.length) return null;
	var start0 = NaN;
	var end0 = NaN;
	var tmpi;
	// Look for the start of g1 in g0.
	start0 = g0.indexOf(g1[0]);
	tmpi = 0;
	while (tmpi < g1.length && tmpi + start0 < g0.length &&
			g1[tmpi] == g0[start0 + tmpi]) tmpi++;
	if (tmpi <= g1.length) end0 = tmpi;
	if (end0 == g1.length) return 1;
	return 0;
}

/**
 * Determine whether one sorted array is a subgroup of another.
 * @param {Array} a0 - The prospective supergroup array, sorted.
 * @param {Array} a1 - The prospective subgroup array, sorted.
 * @returns {number} 1 if a1 is a subgroup of a0, -1 if a0 is a subgroup of a1, 0 otherwise.
*/
function groupSubsetLight(a0, a1) {
	// From Frank.
	if (a0.length == a1.length) {
		if (arraySubset(a0, a1)) return 0;
	} else if (a0.length > a1s.length) {
		if (arraySubset(a0, a1)) return 1;
	} else if (a0.length < a1.length) {
		if (arraySubset(a1, a0)) return -1;
	}
	return NaN;
}

/**
 * Determine whether one array is a subgroup of another.
 * @param {Array} a0 - The prospective supergroup array.
 * @param {Array} a1 - The prospective subgroup array.
 * @returns {number} 1 if a1 is a subgroup of a0, -1 if a0 is a subgroup of a1, 0 otherwise.
*/
function groupSubset(a0, a1) {
	// From Frank.
	const a0s = a0.slice().sort();
	const a1s = a1.slice().sort();
	return groupSubsetLight(a0s, a1s);
}

/**
 * Find the maximum element in an array.
 * @param {Array} arr - The array to be scanned.
 * @returns {number} The maximum value in arr or NaN if there is no valid value.
*/
function arrayMax(arr) {
	var opv = NaN;
	arr.forEach(function (iv) { if (isNaN(opv) || iv > opv) opv = iv; });
	return opv;
}

/**
 * Find the minimum element in an array.
 * @param {Array} arr - The array to be scanned.
 * @returns {number} The minimum value in arr or NaN if there is no valid value.
*/
function arrayMin(arr) {
	var opv = NaN;
	arr.forEach(function (iv) { if (isNaN(opv) || iv < opv) opv = iv; });
	return opv;
}

/**
 * Find the element in an array with the lowest absolute value.
 * @param {Array} arr - The array to be scanned.
 * @returns {number} The value in arr (with original sign) with the lowest absolute value or NaN if there is no valid value.
*/
function arrayMinAbs(arr) {
	var opv = NaN;
	arr.forEach(function (iv) { if (isNaN(opv) || Math.abs(iv) < Math.abs(opv)) opv = iv; });
	return opv;
}

/**
 * Find the start and end of the smallest run in the input array containing all matches of the target value.
 * @param {Array} arr - The array to be scanned.
 * @param target - The target value.
 * @returns {(number[2]|Array.<null>)} An array containing the start and end of the match region or two null values if there is not one.
*/
function arrayGetMatchingBounds(arr, target) {
	// Input is an array with one dimension one.
	// This returns the bounds of the positions (thus row or column, whichever is significant) matching the target.
	// The start is inclusive; the end is exclusive.
	var matchStart = null;
	var matchEnd = null;
	var pos;
	for (pos = 0; pos < arr.length; pos++) {
		if (arr[pos] == target) {
			if (matchStart == null)
				matchStart = pos;
			matchEnd = pos + 1;
		}
	}
	return [matchStart, matchEnd];
}

/**
 * Find the start and end of the smallest run in the input array containing all zero values.
 * @param {Array} arr - The array to be scanned.
 * @returns {(number[2]|Array.<null>)} An array containing the start and end of the match region or two null values if there is not one.
*/
function arrayGetZeroBounds(arr) {
	return arrayGetMatchingBounds(arr, 0);
}

/**
 * Find the offset of each run defined in an array of start/stop pairs.
 * @param {Array} boundsList - The array to be scanned.
 * @returns {Array.<number>} An array containing the sizes.
*/
function boundsToWidths(boundsList) {
	return boundsList.map(function (bounds) { if (bounds[0] != null) return bounds[1] - bounds[0]; else return 0; });
}

/**
 * Find runs (with an allowed gap length) in an array and output a list of stop/stop pairs.
 * @param {Array} rawSeq - The array to be scanned.
 * @param {number} maxGapI - The maximum allowed gap between positive values in a single run.
 * @returns {Array.<number>} An array containing the start/stop pairs (in arrays).
*/
function binRuns(rawSeq, maxGapI) {
	var runs = [];
	var runStart = null;
	var lastHit = null;
	var maxGap = 0;
	if (typeof(maxGapI) == "number" && !isNaN(maxGapI)) maxGap = maxGapI; // Allow null/undefined.
	// Iterate through each value in the sequence.
	rawSeq.forEach(function (val, pos) {
		if (val) {
			// If there is not an active run, flag one.
			if (runStart == null) runStart = pos;
			// And set the last hit.
			lastHit = pos;
		} else {
			if (lastHit !== null && pos > lastHit + maxGap) {
				// If we exceed the allowed gap, close out any run and invalidate the last hit.
				if (runStart !== null)
					runs.push([runStart, lastHit+ 1]);
				runStart = null;
				lastHit = null;
			}
		}
	});
	// Close out any open run using the last hit.
	if (runStart !== null && lastHit !== null)
		runs.push([runStart, lastHit + 1]);
	return runs;
}

/**
 * Find runs (with an allowed gap length) in an array, filter by a minimum length, and output a list of stop/stop pairs.
 * @param {Array} rawSeq - The array to be scanned.
 * @param {number} maxGapI - The maximum allowed gap between positive values in a single run.
 * @param {number} minLengthI - The minimum length of a sequence.
 * @returns {Array.<number>} An array containing the start/stop pairs (in arrays).
*/
function binRunsSignificant(rawSeq, maxGapI, minLengthI) {
	var minLength = 0;
	if (typeof(minLengthI) == "number" && !isNaN(minLengthI)) minLength = minLengthI; // Allow null/undefined.
	return binRuns(rawSeq, maxGapI).filter(function (tv) { return tv[1] - tv[0] >= minLength; });
}

/**
 * Find runs (with an allowed gap length) of values over a threshold in an array, filter by a minimum length, and output a list of stop/stop pairs.
 * @param {Array} values - An array of widths.
 * @param {object} opts - A set of options including minWidth, maxGap, and minHeight (all mandatory).
 * @returns {Array.<number>} An array containing the start/stop pairs (in arrays).
*/
function binMinimumValueRuns(values, opts) {
	// This takes an array of line widths.
	// It subjects them to a magnitude threshold and bins them according to a run-size threshold.
	// opts must be an object containing numerical minWidth, maxGap, and minHeight.
	// Make a vector that indicates whether the black values in a row exceed the threshold.
	const valuesSignificant = values.map(function (lw) { if (lw > opts.minValue) return 1; return 0; });
	// Then find the vertical (cross-row) runs in that.
	const valueBins = binRunsSignificant(valuesSignificant, opts.maxGap, opts.minHeight);
	return valueBins;
}

/**
 * Find the lowest left value and the highest right value for an array of pairs and return a corresponding pair.
 * @param {Array} boundList - An array of value pairs.
 * @returns {(number[2]|Array.<null>)} A pair (array) with the lowest left value and the highest right value (or both null).
*/
function boundsPairsFindExtremaPair(boundList) {
	// This takes the per-row output from getRowBlackBounds and gives an image-wide start/stop pair.
	var leftMin = null;
	var rightMax = null;
	boundList.forEach(function (bounds) {
		if (bounds[0] !== null && (leftMin == null || bounds[0] < leftMin)) leftMin = bounds[0];
		if (bounds[1] !== null && (rightMax == null || bounds[1] > rightMax)) rightMax = bounds[1];
	});
	return [leftMin, rightMax];
}

/**
 * Check whether an input number is positive or whether the lowest value in an input array is positive.
 * @param {(boolean|number|Array.<(boolean|number)>|null)} iv - An array of numbers or a number to be evaluated.
 * @returns {boolean} Whether the input is strictly non-negative.
*/
function vectorScalarPositiveOrZero(iv) {
	if ((iv instanceof Array && arrayMin(iv) >= 0) ||
			(typeof(iv) == "number" && iv >= 0))
		return true;
	return false;
}

/**
 * Perform an aligned binary operation on two vectors.
 * @param {string} op - The operation ("+", "-", "*", "max", "min") to be applied to each same-index pair from the two vectors.
 * @param {Array} v0 - The first input vector.
 * @param {Array} v1 - The second input vector (but the left operand) of the same length as the first.
 * @returns {Array} An array of the same size as the inputs with the results of the operation.
*/
function vectorBinaryOp(op, v0, v1) {
	// This function is hereby released under the terms of the BSD 3-clause license.
	if (v0 == undefined || v1 == undefined || v0 == null || v1 == null || v0.length != v1.length) return null;
	var rv = [];
	v0.forEach(function (v0_v, v0_i) {
		switch (op) {
			case "+":
				rv.push(v1[v0_i] + v0[v0_i]);
				break;
			case "-":
				rv.push(v1[v0_i] - v0[v0_i]);
				break;
			case "*":
				rv.push(v1[v0_i] * v0[v0_i]);
				break;
			case "max":
				rv.push(Math.max(v1[v0_i], v0[v0_i]));
				break;
			case "min":
				rv.push(Math.min(v1[v0_i], v0[v0_i]));
				break;
			default:
				rv.push(null);
				break;
		}
	});
	return rv;
}

/**
 * Check whether an input vector or scalar is within some absolute tolerance of another.
 * @param {(number|Array.<number>)} refColor - A vector or scalar reference value.
 * @param {(number|Array.<number>)} checkColor - A vector or scalar value (of the same format as the reference) to be evaluated.
 * @param {(number|Array.<number>)} tol - A vector or scalar absolute tolerance (of the same format as the reference).
 * @returns {?boolean} Whether the target value is within the tolerance of the reference value (or null on invalid input).
*/
function vectorScalarWithinTolerance(refColor, checkColor, tol) {
	// This checks whether one vector or scalar (generally a color) is within an allowed absolute tolerance of another.
	// The vector/scalar indifference allows dropping logic from functions that deal with color or grayscale images.
	if (refColor instanceof Array) {
		// Get the difference between the paper color and the input sample.
		const absDiff = vectorBinaryOp("-", checkColor, refColor).map(Math.abs);
		// Find out how far that is from the allowed difference.
		const exDiff = vectorBinaryOp("-", absDiff, tol);
		// Take the lowest (thus least conformant value) and return true only if it (and thus others) are in bounds.
		return arrayMin(exDiff) >= 0;
	} else if (typeof(refColor) == "number") {
		// Get the difference between the paper color and the present row/column.
		const absDiff = Math.abs(refColor - checkColor);
		// Find out how far that is from the allowed difference.
		const exDiff = tol - absDiff; // Positive if within bounds.
		return exDiff >= 0;
	}
	return null;
}

/**
 * Check whether an input scalar is within some absolute tolerance of another.
 * @param {number} a - A scalar reference value.
 * @param {number} b - A scalar value to be evaluated.
 * @param {number} t - A scalar absolute tolerance.
 * @returns {boolean} Whether the target value is within the tolerance of the reference value.
*/
function scalarWithinTolerance(a, b, t) {
	const vDiff = Math.abs(b - a);
	const vMax = Math.max(Math.abs(a), Math.abs(b));
	return ((vDiff < vMax * t) ? true : false);
}

module.exports = exports = {valueFromRule, valueFromRuleInRules, arraySubset, groupSubsetLight, groupSubset, arrayMax, arrayMin, arrayMinAbs, arrayGetMatchingBounds, arrayGetZeroBounds, boundsToWidths, binRuns, binRunsSignificant, binMinimumValueRuns, boundsPairsFindExtremaPair, vectorScalarPositiveOrZero, vectorBinaryOp, vectorScalarWithinTolerance, scalarWithinTolerance};

