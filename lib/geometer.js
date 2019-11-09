// Copyright 2017-2018 by Frank Trampe independently and for Autolotto.
// This is hereby released under the terms of the BSD 3-clause license, the MIT/X11 license, and the Apache 2.0 license.

// This file contains functions for handling, transforming, and analysing OpenCV images.

const logician = require("./logician.js");

const vectorBinaryOp = logician.vectorBinaryOp; // It is used enough here to justify shorthand.

/**
 * Find the distance between two two-dimensional points.
 * @param {number[2]} p0 - A point (an array containing two numerical values).
 * @param {number[2]} p1 - A point (an array containing two numerical values).
 * @returns {number} The distance between the two points.
*/
function pointToPointDistance(p0, p1) {
	return Math.sqrt((p1[0]-p0[0])*(p1[0]-p0[0])+(p1[1]-p0[1])*(p1[1]-p0[1]));
}

/**
 * Find the distance between a point and the closest point on a line.
 * @param {number[2]} m - The slope of the line.
 * @param {number[2]} b - The x-intercept for the line usually, the y-intercept if m is not a number.
 * @param {number[2]} p0 - A point (an array containing two numerical values).
 * @returns {number} The distance between the point and the closest point on the line.
*/
function pointToLineDistance(m, b, p0) {
	// If the line is vertical, use b for x offset instead of y.
	// The main line is y = m * x + b.
	// The intercept line is y - y0 = (-1/m) * (x - x0).
	// -y0 = -x/m + x0/m - m*x - b
	// x*(m + 1/m) = x0/m - b + y0
	// x = (x0/m - b + y0)/(m + 1/m)
	if (m == 0) {
		return Math.abs(b - p0[1]);
	} else if (isNaN(m)) {
		return Math.abs(b - p0[0]);
	} else {
		var xi = (p0[0] / m - b + p0[1])/(m + 1 / m);
		var yi = m * xi + b;
		return pointToPointDistance(p0, [xi, yi]);
	}
	return 0;
}

/**
 * Convert a flat line to an equivalent rectangle.
 * @param {number[4]} line - A flat line ([x0, y0, x1, y1]).
 * @returns {number[4]} A rectangle ([x, y, w, h]) corresponding to the line.
*/
function flatlineToRectangle(line) {
	// Lines are in x0, y0, x1, x1 format.
	// Rectangles are in x0, y0, w, h format.
	return [line[0], line[1], line[2] - line[0], line[3] - line[1]];
}

/**
 * Convert a flat line to an equivalent rectangle with correct orientation.
 * @param {number[4]} line - A flat line ([x0, y0, x1, y1]).
 * @returns {number[4]} A rectangle ([x, y, w, h]) corresponding to the line.
*/
function flatlineToRectangleFixed(line) {
	// This can handle a line that has a negative offset.
	var minX = Math.min(line[0], line[2]);
	var maxX = Math.max(line[0], line[2]);
	var minY = Math.min(line[1], line[3]);
	var maxY = Math.max(line[1], line[3]);
	return [minX, minY, maxX - minX, maxY - minY];
}

/**
 * Convert a rectangle to a flat line.
 * @param {number[4]} rect - A rectangle ([x, y, w, h]) corresponding to the line.
 * @returns {number[4]} A flat line ([x0, y0, x1, y1]) corresponding to the rectangle.
*/
function rectangleToFlatline(rect) {
	return [rect[0], rect[1], rect[2] + rect[0], rect[3] - rect[1]];
}

/**
 * Scale a rectangle (or even a higher-order solid) by per-dimension factors.
 * @param {number[]} factors - A sequence (in an array) of scaling factors by dimension order.
 * @param {number[]} rectangle - A rectangle.
 * @returns {number[]} A scaled rectangle.
*/
function rectangleScale(factors, rectangle) {
	if (factors instanceof Array && factors.length > 0 && rectangle instanceof Array)
		return rectangle.map(function (componentV, componentI) { return componentV * factors[componentI % factors.length]; });
	return null;
}

/**
 * Compute the magnitude of a vector.
 * @param {number[]} v0 - A vector (an array of numbers).
 * @returns {number} The magnitude of the vector.
*/
function vectorMagnitude(v0) {
	if (v0 == undefined || v0 == null) return null;
	var magnitudeTotal = 0;
	v0.forEach(function (componentV) {
		magnitudeTotal += componentV * componentV;
	});
	return Math.sqrt(magnitudeTotal);
}

/**
 * Compute the angle of a vector.
 * @param {number[]} v0 - A vector (an array of numbers).
 * @returns {number} The angle (in degrees) of the vector.
*/
function vectorAngle(v0) {
	// This works only in two dimensions.
	// Reject if the inputs are invalid or the angle is indeterminate.
	if (v0 == undefined || v0 == null || v0.length != 2) return null;
	if (isNaN(v0[0]) && isNaN(v0[1])) return null;
	if (v0[0] == 0 && v0[1] == 0) return null;
	// Handle special cases.
	if (v0[0] == Infinity && !isNaN(v0[1])) return 90;
	if (v0[0] == -Infinity && !isNaN(v0[1])) return 270;
	if (v0[1] == Infinity && !isNaN(v0[0])) return 0;
	if (v0[1] == -Infinity && !isNaN(v0[0])) return 180;
	if (v0[0] == 0 && !isNaN(v0[1]) && v0[1] > 0) return 90;
	if (v0[0] == 0 && !isNaN(v0[1]) && v0[1] < 0) return 270;
	if (v0[1] == 0 && !isNaN(v0[0]) && v0[0] > 0) return 0;
	if (v0[1] == 0 && !isNaN(v0[0]) && v0[0] < 0) return 180;
	if (isNaN(v0[0]) || isNaN(v0[1]) || v0[0] == 0) {
		console.log("vectorAngle missed a case.");
		return null;
	}
	// Compute an angle (in radians).
	var angleRadian = Math.atan(v0[1]/v0[0]);
	if (isNaN(angleRadian)) return null;
	// Convert to degrees.
	var angleDegree = angleRadian * 45 / Math.atan(1);
	// Normalize.
	if (angleDegree < 0) angleDegree += 360;
	return angleDegree;
}

/**
 * Normalize an angle in degrees to be between 0 and 360.
 * @param {number[]} a0 - An angle in degrees.
 * @returns {number} The equivalent angle between 0 and 360 degrees.
*/
function angleNormalize(a0) {
	// This takes an angle and fixes it between 0 and 360 degrees.
	var a0Norm = a0;
	while (a0Norm < 0) a0Norm += 360; // The modulus does not work in negative territory.
	return a0Norm % 360;
}

/**
 * Convert from polar coordinates to rectangular coordinates.
 * @param {number[2]} v0 - A polar vector with radius and angle (in degrees).
 * @returns {number[2]} The equivalent rectangular vector.
*/
function polarToRectangular(v0) {
	// This takes a radius and an angle (with the angle in degrees) and returns rectangular coordinates.
	if (v0 == undefined || v0 == null || v0.length != 2) return null;
	if (isNaN(v0[0]) || isNaN(v0[1])) return null;
	var angleDegree = Math.atan(1) * v0[1] / 45;
	return [v0[0] * Math.cos(angleDegree), v0[0] * Math.sin(angleDegree)];
}

/**
 * Convert from rectangular coordinates to polar coordinates.
 * @param {number[2]} v0 - A rectangular vector.
 * @returns {number[2]} The equivalent polar vector with radius and angle (in degrees).
*/
function rectangularToPolar(v0) {
	// This takes rectangular coordinates and returns a radius and an angle (in degrees).
	if (v0 == undefined || v0 == null || v0.length != 2) return null;
	if (isNaN(v0[0]) || isNaN(v0[1])) return null;
	var vectorPolar = [vectorMagnitude(v0), vectorAngle(v0)];
	if (vectorPolar[0] == null || vectorPolar[1] == null) return null;
	return vectorPolar;
}

/**
 * Find the difference between two points.
 * @param {number[]} v0 - A vector.
 * @param {number[]} v1 - A vector.
 * @returns {number[]} The offset between the vector ends.
*/
function vectorDifference(v0, v1) {
	return vectorBinaryOp("-", v0, v1);
}

/**
 * Find the sum of two vectors.
 * @param {number[]} v0 - A vector.
 * @param {number[]} v1 - A vector.
 * @returns {number[]} The combination of the two vectors.
*/
function vectorSum(v0, v1) {
	return vectorBinaryOp("+", v0, v1);
}

/**
 * Find the distance between two points.
 * @param {number[]} v0 - A vector.
 * @param {number[]} v1 - A vector.
 * @returns {number} The distance between the vector ends.
*/
function vectorDistance(v0, v1) {
	return vectorMagnitude(vectorDifference(v0, v1));
}

/**
 * Project one vector onto another in two dimensions.
 * @param {number[2]} v0 - A two-dimensional vector.
 * @param {number[2]} v1 - A two-dimensional vector.
 * @returns {number[2]} The projection of v1 onto v0.
*/
function vector2dProject(v0, v1) {
	// This is a collapsed implementation of a projection of v1 onto v0.
	// Start with v0 unit vector times the dot product of v0 the v0 unit vector and v1.
	// Break into components.
	// Factor out the magnitude divisors in the unit vectors.
	return [(v0[0]*(v0[0]*v1[0]+v0[1]*v1[1]))/(v0[1]*v0[1]+v0[0]*v0[0]),(v0[1]*(v0[0]*v1[0]+v0[1]*v1[1]))/(v0[1]*v0[1]+v0[0]*v0[0])];
}

/**
 * Project a point onto a line in two dimensions.
 * @param {number[4]} baseLine - A line in flat line form ([x0, y0, x1, y1]).
 * @param {number[2]} projectionPoint - The point to be projected.
 * @returns {number[2]} The projection of the point onto the line (not necessarily on the defined segment).
*/
function line2dProjectPoint(baseLine, projectionPoint) {
	// We make a vector from the input line and a vector from the base point of the input vector to the point.
	// We base those at the base point of the input vector and project one vector onto the other.
	var relativeProjection = vector2dProject([baseLine[2] - baseLine[0], baseLine[3] - baseLine[1]], [projectionPoint[0] - baseLine[0], projectionPoint[1] - baseLine[1]]);
	// Then we rebase and return.
	return [relativeProjection[0] + baseLine[0], relativeProjection[1] + baseLine[1]];
}

/**
 * Check whether a point lies in a space in one dimension.
 * @param {number[2]} line - A one-dimensional space in flat line form ([x0, x1]).
 * @param {number[1]} point - The point to be checked ([x]).
 * @returns {boolean} Whether the point is in the space.
*/
function space1dHasPoint(line, point) {
	if (point[0] >= line[0] && point[0] <= line[1])
		return true;
	if (point[0] <= line[0] && point[0] >= line[1])
		return true;
	return false;
}

/**
 * Check whether a point lies in a space in two dimensions.
 * @param {number[4]} line - A two-dimensional space in flat line form ([x0, y0, x1, y1]).
 * @param {number[2]} point - The point to be checked ([x, y]).
 * @returns {boolean} Whether the point is in the space.
*/
function space2dHasPoint(line, point) {
	if (space1dHasPoint([line[0], line[2]], [point[0]]) && space1dHasPoint([line[1], line[3]], [point[1]]))
		return true;
	return false;
}

/**
 * Convert a flat line to a point line.
 * @param {number[4]} line - A two-dimensional flat line ([x0, y0, x1, y1]).
 * @returns {Array.<number[2]>} A two-dimensional point line ([[x0, y0], [x1, y1]]).
*/
function flatline2dToPointline(line) {
	return [[line[0], line[1]], [line[2], line[3]]];
}

/**
 * Convert a point line to a flat line.
 * @param {number[4]} line - A two-dimensional point line ([[x0, y0], [x1, y1]]).
 * @returns {Array.<number[2]>} A two-dimensional flat line ([x0, y0, x1, y1]).
*/
function pointline2dToFlatline(line) {
	return [line[0][0], line[0][1], line[1][0], line[1][1]];
}

/**
 * Check whether a point lies within an allowed orthagonal distance from a given line segment.
 * @param {number[4]} line - A two-dimensional line in flat line form ([x0, y0, x1, y1]).
 * @param {number[2]} point - The point to be checked ([x, y]).
 * @param {number} tol - The allowed gap from the line.
 * @returns {boolean} Whether the point is within the allowed orthagonal distance of the line.
*/
function line2dProjectedPointWithinTolerance(line, point, tol) {
	// This finds whether the input point is within a stripe of weight gap along the input line.
	// Project the point onto the line.
	var pointProjected = line2dProjectPoint(line, point);
	// Check whether it is on the input segment.
	if (space2dHasPoint(line, pointProjected)) {
		// If it is, check whether the distance from the original point to the projected point is within the allowed gap.
		if (vectorDistance(point, pointProjected) <= tol)
			return true;
	}
	return false;
}

/**
 * Examine a set of schemed lines, construct a bounding box, and convert the bounding box into a line.
 * @param {Array.<object>} lines - Schemed lines.
 * @param {boolean} signed - Whether to heed the prevailing orientation of the input lines in constructing the output line.
 * @returns {number[4]} A line approximating the combination of the input lines.
*/
function linesSchemedToFlatlineByBounds(lines, signed) {
	// This examines a set of schemed lines, constructs a bounding box, and converts the bounding box into a line.
	// The orientation of the line is based upon the majority orientation of the input lines if signed is set.
	var minX = null;
	var maxX = null;
	var minY = null;
	var maxY = null;
	var signednessNet = 0
	lines.forEach(function (line) {
		var minXT = Math.min(line["coordinates"][0], line["coordinates"][2])
		var minYT = Math.min(line["coordinates"][1], line["coordinates"][3])
		var maxXT = Math.max(line["coordinates"][0], line["coordinates"][2])
		var maxYT = Math.max(line["coordinates"][1], line["coordinates"][3])
		if (((line["coordinates"][2]-line["coordinates"][0]) < 0 && (line["coordinates"][3]-line["coordinates"][1]) > 0) || ((line["coordinates"][2]-line["coordinates"][0]) > 0 && (line["coordinates"][3]-line["coordinates"][1]) < 0))
			signednessNet--;
		else
			signednessNet++;
		if (minX == null || minX < minX)
			minX = minXT;
		if (minY == null || minY < minY)
			minY = minYT;
		if (maxX == null || maxX > maxX)
			maxX = maxXT;
		if (maxY == null || maxY > maxY)
			maxY = maxYT;
	});
	if (signed && signednessNet < 0)
		return [minX, maxY, maxX, minY];
	return [minX, minY, maxX, maxY];
}

/**
 * Determine whether one line is within an allowed gap of a line approximating a reference group of lines.
 * @param {Array.<object>} baseGroup - A reference group of schemed lines.
 * @param {object} testLineFull - A schemed test line.
 * @param {number} gap - The allowed gap between the test line and the reference group.
 * @returns {boolean} Whether the test line is within the allowed gap of the reference group.
*/
function lineGroupAndSegmentAdjacent(baseGroup, testLineFull, gap) {
	// testLineFull is schemed.
	// This determines whether an endpoint of the input line is within gap of any point of an approximate line made from baseGroup.
	// This assumes colinearity.
	baseGroupBounds = linesSchemedToFlatlineByBounds(baseGroup, 1);
	var testLine = testLineFull["coordinates"];
	// Check for orthagonal proximity to the line.
	if (line2dProjectedPointWithinTolerance(baseGroupBounds, [testLine[0], testLine[1]], gap))
		return true;
	if (line2dProjectedPointWithinTolerance(baseGroupBounds, [testLine[2], testLine[3]], gap))
		return true;
	// Check for proximity to endpoints.
	if (vectorDistance(baseGroupBounds.slice(0, 2), testLine.slice(0, 2)) <= gap)
		return true;
	if (vectorDistance(baseGroupBounds.slice(2, 2), testLine.slice(0, 2)) <= gap)
		return true;
	if (vectorDistance(baseGroupBounds.slice(0, 2), testLine.slice(2, 4)) <= gap)
		return true;
	if (vectorDistance(baseGroupBounds.slice(2, 2), testLine.slice(2, 4)) <= gap)
		return true;
	return false;
}

/**
 * Transform a point according to a set of canvas dimensions and canvas transformation parameters.
 * @param {number[2]} point - The starting point.
 * @param {number[2]} dims - The dimensions of the canvas.
 * @param {object} params - A dictionary of transformation rules, including rotation (named rotate) in degrees and crop (a pair).
 * @returns {number[2]} The transformed point.
*/
function pointCanvasTransformForward(point, dims, params) {
	// point is the point to be transformed.
	// dims is an array of image/canvas dimensions.
	// params contains the transformation rule, with rotate and crop.
	// First we rotate around the center.
	// This requires finding the center and the relative position of the point.
	var vectorFromCenter = vectorBinaryOp("-", [dims[0] / 2, dims[1] / 2], point);
	var vectorFromCenterPolar = rectangularToPolar(vectorFromCenter);
	vectorFromCenterPolar[1] += params.rotate;
	var vectorRotated = polarToRectangular(vectorFromCenterPolar);
	// We shift back.
	var vectorRecentered = vectorBinaryOp("+", [dims[0] / 2, dims[1] / 2], point);
	// Then we offset according to the crop.
	return vectorBinaryOp("-", params.crop.slice(0, 2), vectorRotated);
}

/**
 * Reverse-transform a point according to a set of canvas dimensions and canvas transformation parameters.
 * @param {number[2]} point - The starting (forward-transformed) point.
 * @param {number[2]} dims - The dimensions of the transformed canvas.
 * @param {object} params - A dictionary of transformation rules, including rotation (named rotate) in degrees and crop (a pair).
 * @returns {number[2]} The reverse-transformed point.
*/
function pointCanvasTransformBackward(point, dims, params) {
	// point is the point to be transformed.
	// dims is an array of image/canvas dimensions.
	// params contains the transformation rule, with rotate and crop.
	// First we offset according to the crop.
	var vectorOffset = vectorBinaryOp("+", params.crop.slice(0, 2), point);
	// Then we rotate around the center.
	var vectorOffsetFromCenter = vectorBinaryOp("-", [dims[0] / 2, dims[1] / 2], point);
	var vectorOffsetFromCenterPolar = rectangularToPolar(vectorOffsetFromCenter);
	vectorOffsetFromCenterPolar[1] -= params.rotate;
	// We shift back.
	var vectorOffsetRecentered = vectorBinaryOp("+", [dims[0] / 2, dims[1] / 2], point);
	return vectorOffsetRecentered;
}

/**
 * Shrink a rectangle as necessary to fit (inclusively) within another.
 * @param {number[4]} bounds - The bounding rectangle.
 * @param {number[4]} rectI - The starting rectangle.
 * @returns {number[4]} A rectangle that fits within both input rectangles.
*/
function rectangleConstrainInRectangle(bounds, rectI) {
	var rect = rectI.slice();
	if (rect[0] < bounds[0]) rect[0] = bounds[0];
	if (rect[1] < bounds[1]) rect[1] = bounds[1];
	if (rect[2] < 0) rect[2] = 0;
	if (rect[3] < 0) rect[3] = 0;
	if (rect[0] + rect[2] > bounds[0] + bounds[2]) rect[2] = bounds[0] + bounds[2] - rect[0];
	if (rect[1] + rect[3] > bounds[1] + bounds[3]) rect[3] = bounds[1] + bounds[3] - rect[1];
	return rect;
}

/**
 * Check the validity of a rectangle.
 * @param {number[4]} rect - The rectangle to be tested.
 * @returns {boolean} The validity of the rectangle.
*/
function rectangleValidate(rect) {
	// This makes sure that the rectangle is generally valid.
	if (!(rect instanceof Array)) return false;
	if (rect.length != 4) return false;
	if (isNaN(rect[0]) || isNaN(rect[1]) || isNaN(rect[2]) || isNaN(rect[3])) return false;
	if (rect[0] < 0 || rect[1] < 0 || rect[2] <= 0 || rect[3] <= 0) return false;
	return true;
}

/**
 * Check the validity of a rectangle and whether it is of non-zero area.
 * @param {number[4]} rect - The rectangle to be tested.
 * @returns {boolean} The validity and positivity of the rectangle.
*/
function rectangleValidatePositive(rect) {
	// This makes sure that the rectangle is generally valid and non-empty.
	if (rectangleValidate(rect) && rect[2] > 0 && rect[3] > 0) return true;
	return false;
}

module.exports = exports = {pointToPointDistance, pointToLineDistance, flatlineToRectangle, flatlineToRectangleFixed, rectangleToFlatline, rectangleScale, vectorMagnitude, vectorAngle, angleNormalize, polarToRectangular, rectangularToPolar, vectorDifference, vectorSum, vectorDistance, vector2dProject, line2dProjectPoint, space1dHasPoint, space2dHasPoint, flatline2dToPointline, pointline2dToFlatline, line2dProjectedPointWithinTolerance, linesSchemedToFlatlineByBounds, lineGroupAndSegmentAdjacent, pointCanvasTransformForward, pointCanvasTransformBackward, rectangleConstrainInRectangle, rectangleValidate, rectangleValidatePositive};
