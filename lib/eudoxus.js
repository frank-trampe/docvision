// Copyright 2017-2018 by Frank Trampe for Autolotto.
// This is hereby released under the terms of the BSD 3-clause license, the MIT/X11 license, and the Apache 2.0 license.

// These functions are for finding order in lines. Eudoxus did this with the stars.

const logician = require("./logician.js");
const geometer = require("./geometer.js");

/**
 * Generate annotated lines from flat lines, with each output item containing angle, length, coordinates (the flat line), xint or yint, and rank (its position in the input).
 * @param {Array.<number[4]>} lines - Flat lines ([x0, y0, x1, y1]) to be analysed.
 * @returns {Array.<Object>} An array of schemed lines.
*/
function analyseLines(lines) {
	// This ingests point-point lines and returns schemed lines, with lengths, angles, and intercepts.
	// Each output line has angle, length, coordinates (the original flat line), xint or yint, and rank.
	// rank is invalid upon adding lines to the set.
	var schemedLines = [];
	const mathPi = Math.acos(-1);
	lines.forEach(function (lineTemp, lineIndex) {
		var angle0 = null;
		// Calculate the length of the line.
		var dist0 = Math.sqrt(Math.pow((lineTemp[2] - lineTemp[0]), 2) + Math.pow((lineTemp[3] - lineTemp[1]), 2));
		// Calculate the angle using the larger dimension.
		if (Math.abs(lineTemp[2] - lineTemp[0]) > Math.abs(lineTemp[3] - lineTemp[1]))
			angle0 = Math.asin((lineTemp[3] - lineTemp[1])/dist0);
		else
			angle0 = Math.acos((lineTemp[2] - lineTemp[0])/dist0);
		var schemedLine = {"angle": angle0, "length": dist0, "coordinates": lineTemp};
		if (angle0 > mathPi / 8 && angle0 < mathPi * 7 / 8) {
			// Compute an x-intercept.
			schemedLine["xint"] = lineTemp[0] - lineTemp[1] * ((lineTemp[2] - lineTemp[0]) / (lineTemp[3] - lineTemp[1]));
		}
		if ((angle0 < mathPi * 3 / 8 && angle0 > mathPi * (-3) / 8) || (angle0 > mathPi * 5 / 8 && angle0 < mathPi * 11 / 8)) {
			// Compute a y-intercept.
			schemedLine["yint"] = lineTemp[1] - lineTemp[0] * ((lineTemp[3] - lineTemp[1]) / (lineTemp[2] - lineTemp[0]))
		}
		schemedLine["rank"] = lineIndex;
		schemedLines.push(schemedLine);
	});
	return schemedLines;
}

/**
 * Consolidate nearby nearly coincident line segments into larger segments according to tolerances.
 * @param {Array.<Object>} schemedLines - Schemed lines (as output by analyseLines) to be processed.
 * @param {number} rtol - A rotational tolerance, absolute, in degrees.
 * @param {number} dtol - A distance tolerance, absolute.
 * @param {number} dtolp - A distance tolerance, proportional.
 * @returns {Array.<Object>} An array of consolidated schemed lines.
*/
function consolidateLinesSchemed(schemedLines, rtol, dtol, dtolp) {
	// This is for consolidating small segments into larger lines.
	// lines is an array of schemed lines.
	// rtol is the angular tolerance (absolute).
	// dtol is the absolute distance tolerance.
	// dtolp is the proportional distance tolerance.
	// The general workflow is as follows.
	//   Bin segments by colinearity (similar slope and intercept).
	//   Bin colinear segments by adjacency.
	//   Merge adjacent colinear segments into large segments.
	// First we assemble information about each segment.
	var schemedLineCount = schemedLines.length;
	const mathPi = Math.acos(-1);
	// Now we group the line segments by similar characteristics.
	var lineGroups = [];
	schemedLines.forEach(function (schemedLine) {
		var groupDest = null;
		lineGroups.forEach(function (prospectiveGroup) {
			// For each line, look at the existing line groups for a possible match.
			if (groupDest === null) {
				prospectiveGroup.forEach(function (prospectiveLineMatch) {
					// console.log("Current segment.");
					// console.log(schemedLine);
					// console.log("Prospective match.");
					// console.log(prospectivelinematch);
					// Pass if there is already a match.
					if (groupDest === null) {
						// Check angle and the appropriate axis intercept (within tolerances).
						if (Math.abs(schemedLine["angle"] - prospectiveLineMatch["angle"]) < rtol) {
						// console.log("Angle match.");
							if ((typeof(schemedLine.yint) == "number" && typeof(prospectiveLineMatch.yint) == "number" && Math.abs(schemedLine["yint"] - prospectiveLineMatch["yint"]) <= dtol) || (typeof(schemedLine.xint) == "number" && typeof(prospectiveLineMatch.xint) == "number" && Math.abs(schemedLine["xint"] - prospectiveLineMatch["xint"]) <= dtol)) {
								groupDest = prospectiveGroup;
								// console.log("Full match.");
							}
						}
					}
				});
			}
		});
		if (groupDest != null)
			groupDest.push(schemedLine);
		else
			lineGroups.push([schemedLine]);
	});
	// Now we sort through those collinearity groups by adjacency.
	var adjacencyGroups = []
	lineGroups.forEach(function (lineGroup) {
		var adjacencyGroupsTemp = [];
		var adjacencyMerges = [];
		var adjacencyAssignments = new Array(lineGroup);
		// We go through the line segments and assign them to groups based on adjacency.
		lineGroup.forEach(function (schemedLine, schemedLineIndex) {
			var adjacencyAssignment = null;
			adjacencyGroupsTemp.forEach(function (adjacencyGroup, adjacencyGroupIndex) {
				if (geometer.lineGroupAndSegmentAdjacent(adjacencyGroup, schemedLine, dtol)) {
					if (adjacencyAssignment == null) {
						// A match. Add to group.
						// console.log("Match.");
						adjacencyAssignment = adjacencyGroupIndex;
						adjacencyGroup.push(schemedLine);
					} else {
						// Another match. Flag the groups for merging.
						// console.log("Merge.");
						adjacencyMerges.push([adjacencyAssignment, adjacencyGroupIndex]);
					}
				}
			});
			if (adjacencyAssignment == null) {
				// No match. Make a new group.
				adjacencyAssignments[schemedLineIndex] = adjacencyGroupsTemp.length;
				adjacencyGroupsTemp.push([schemedLine]);
			} else {
				// Store the match.
				adjacencyAssignments[schemedLineIndex] = adjacencyAssignment;
			}
		});
		// Flatten the merge list.
		// console.log("Merge list.");
		// console.log(adjacencyMerges);
		// Populate an identity map.
		var adjacencyGroupsDestinations = adjacencyGroupsTemp.map(function (val, pos) { return pos; });
		// Now look through the merge list.
		adjacencyMerges.forEach(function (adjacencyMerge, adjacencyMergeI) {
			adjacencyGroupsTemp.forEach(function (adjacencyGroupTemp, adjacencyGroupTempI) {
				// If the source of the current merge matches a given group, map it to the given destination.
				if (adjacencyGroupsDestinations[adjacencyGroupTempI] == adjacencyMerge[1])
					adjacencyGroupsDestinations[adjacencyGroupTempI] = adjacencyMerge[0];
			});
		});
		// Now we go through the old groups and assign their members according to the destination list.
		// The result is not presently used.
		var mergedGroups = new Array(adjacencyGroupsTemp.length);
		adjacencyGroupsTemp.forEach(function (adjacencyGroupTemp, adjacencyGroupTempI) {
			mergedGroups[adjacencyGroupsDestinations[adjacencyGroupTempI]] += adjacencyGroupTemp;
		});
		// Now we dump those groups back to the main list if non-empty.
		adjacencyGroupsTemp.forEach(function (adjacencyGroupTemp, adjacencyGroupTempI) {
			if (adjacencyGroupTemp.length)
				adjacencyGroups.push(adjacencyGroupTemp);
		});
	});
	// Now we join the segments together.
	var bigLines = [];
	adjacencyGroups.forEach(function (lineGroup) {
		var xMin = null;
		var xMax = null;
		var yMin = null;
		var yMax = null;
		var lastAngle = null;
		var rank = 0;
		// We use the bounding box of the line group to make the final line.
		// And we use the angle of the last mini-segment to determine which pair of corners of that box to use.
		// We also compute an aggregate rank for the final line based upon the ranks of the constituent segments.
		lineGroup.forEach(function (schemedLine) {
			txMin = Math.min(schemedLine["coordinates"][0], schemedLine["coordinates"][2]);
			tyMin = Math.min(schemedLine["coordinates"][1], schemedLine["coordinates"][3]);
			txMax = Math.max(schemedLine["coordinates"][0], schemedLine["coordinates"][2]);
			tyMax = Math.max(schemedLine["coordinates"][1], schemedLine["coordinates"][3]);
			if (xMin == null || txMin < xMin)
				xMin = txMin;
			if (yMin == null || tyMin < yMin)
				yMin = tyMin;
			if (xMax == null || txMax > xMax)
				xMax = txMax;
			if (yMax == null || tyMax > yMax)
				yMax = tyMax;
			lastAngle = schemedLine["angle"];
			rank += schemedLineCount - schemedLine["rank"];
		});
		if (lastAngle != null && xMin != null && yMin != null && xMax != null && yMax != null && (xMin < xMax || yMin < yMax)) {
			if ((lastAngle > 0 && lastAngle < mathPi / 2) || (lastAngle > mathPi && lastAngle < mathPi * 3 / 2) || (lastAngle > -mathPi && lastAngle < - mathPi / 2))
				bigLines.push({"rank": rank, "line": [xMin, yMin, xMax, yMax]});
			else
				bigLines.push({"rank": rank, "line": [xMin, yMax, xMax, yMin]});
		}
	});
	// Now we want to sort by rank.
	const bigLinesOrdered = bigLines.slice().sort(function (a, b) { return a["rank"] < b["rank"]; });
	// And we want to return just the actual lines rather than the rank/line pairs.
	const bigLinesLined = bigLinesOrdered.map(function (a) { return a["line"]; });
	return bigLinesLined;
}

/**
 * Consolidate nearby nearly coincident line segments into larger segments according to tolerances.
 * @param {Array.<number[4]>} lines - Flat lines ([x0, y0, x1, y1]) to be processed.
 * @param {number} rtol - A rotational tolerance, absolute, in degrees.
 * @param {number} dtol - A distance tolerance, absolute.
 * @param {number} dtolp - A distance tolerance, proportional.
 * @returns {Array.<Object>} An array of consolidated schemed lines.
*/
function consolidateLines(lines, rtol, dtol, dtolp) {
	var schemedLines = analyseLines(lines);
	return consolidateLinesSchemed(schemedLines, rtol, dtol, dtolp);
}

/**
 * Consolidate line segments into groups based on similar direction and length.
 * @param {Array.<object>} schemedLines - Schemed lines (as output by analyseLines) to be processed.
 * @param {number} rtol - A rotational tolerance, absolute, in degrees.
 * @param {number} dtol - A distance tolerance, absolute.
 * @param {number} dtolp - A distance tolerance, proportional.
 * @returns {Array.<Array.<Object>>} An array of arrays (angle/length groups) of schemed lines.
*/
function consolidateLinesSchemedBySlope(schemedLines, rtol, dtol, dtolp) {
	// This is for finding and grouping lines that have similar slopes and lengths.
	// Group by length and by slope.
	var lineGroups = [];
	schemedLines.forEach(function (schemedLine) {
		var groupDest = null;
		lineGroups.forEach(function (prospectiveGroup) {
			// If the current segment is not assigned to a group, look at this one.
			// Look at each segment already assigned to it.
			if (groupDest === null) prospectiveGroup.forEach(function (prospectiveLineMatch) {
				if (groupDest === null && Math.abs(schemedLine["angle"] - prospectiveLineMatch["angle"]) < rtol)
					if ("length" in schemedLine && "length" in prospectiveLineMatch && logician.scalarWithinTolerance(schemedLine["length"], prospectiveLineMatch["length"], dtolp)) {
						groupDest = prospectiveGroup; // Angle and length match; assign here.
					}
			});
		});
		if (groupDest !== null)
			groupDest.push(schemedLine);
		else
			lineGroups.push([schemedLine]);
	});
	return lineGroups;
}

/**
 * Consolidate line segments into groups based on similar direction and length.
 * @param {Array.<number[4]>} lines - Flat lines ([x0, y0, x1, y1]) to be processed.
 * @param {number} rtol - A rotational tolerance, absolute, in degrees.
 * @param {number} dtol - A distance tolerance, absolute.
 * @param {number} dtolp - A distance tolerance, proportional.
 * @returns {Array.<Array.<Object>>} An array of arrays (angle/length groups) of schemed lines.
*/
function consolidateLinesBySlope(lines, rtol, dtol, dtolp) {
	// This is for finding and grouping lines that have similar slopes and lengths.
	// First we assemble information about each segment.
	const schemedLines = analyseLines(lines);
	return consolidateLinesSchemedBySlope(schemedLines, rtol, dtol, dtolp);
}

module.exports = exports = {analyseLines, consolidateLinesSchemed, consolidateLines, consolidateLinesSchemedBySlope, consolidateLinesBySlope};

