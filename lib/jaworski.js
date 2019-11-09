// Copyright 2017-2018 by Frank Trampe for Autolotto.
// This is hereby released under the terms of the BSD 3-clause license, the MIT/X11 license, and the Apache 2.0 license.

// This code is all for document images and is unlikely to work well on other types of images.

const logician = require("./logician.js");
const geometer = require("./geometer.js");
const rasterer = require("./rasterer.js");
const eudoxus = require("./eudoxus.js");
const cv = require("opencv");

/**
 * (BROKEN) Find an appropriate binarization threshold for an image of a printed document using the histogram bump from the paper stock.
 * @param img - A non-binary image of a printed document.
 * @returns {number} A scalar threshold.
*/
function thresholdByBigPeak(img) {
	// This is currently non-functional due to limitations in the OpenCV bindings.
	// It is otherwise fantastic. (With logic tested in Python, where the OpenCV bindings work.)
	// The idea is to find the tallest (most populated) peak in the histogram (presumably the paper level)
	// and to pick a threshold on the left (low-value) foot of that peak.
	// This accepts a monochrome image.
	const binSize = 4;
	const histogram = cv.histogram.calcHist(img, [0], [256 / binSize], [[0, 256]], true);
	//  We need to find the biggest peak in order to pick a threshold.
	var i;
	var maximumValue = 0;
	var maximumIndex = 0;
	for (i = 0; i < 64; i++)
		if (histogram[i][0] > maximumValue) {
			maximumValue = histogram[i][0];
			maximumIndex = i;
		}
	const bigPeakIndex = Math.floor((maximumIndex + 0.5) * binSize); // Get the level that corresponds to the middle of the bin.
	console.log("Big peak: " + bigPeakIndex + ".");
	// Now we step back to find the bottom of that peak.
	for (i = maximumIndex;
			i > 0 && (histogram[i - 1][0] < histogram[i][0] || (i != 1 && histogram[i - 2][0] < histogram[i][0]));
			i--) {}
	const bigPeakStart = Math.floor((i + 0.5) * binSize); // Get the level that corresponds to the middle of the bin.
	return bigPeakStart;
}

/**
 * Guess the paper and ink colors of a printed document by dilating or eroding away the opposite area in each case and averaging.
 * @param img - A non-binary image of a printed document.
 * @returns {object} An object containing paper and ink colors.
*/
function paperAndInkColorsGuess(img) {
	// The function name is self-explanatory.
	const nw = img.width();
	const nh = img.height();
	if (nw <= 0 || nh <= 0) return null;
	// We need a postprocessor for outputs from the mean function.
	const meanWrap = rasterer.meanWrapFromPixel(img.pixel(0, 0));
	// Get the middle quarter.
	const imgCenter = img.crop(Math.floor(nw / 4), Math.floor(nh / 4), Math.floor(nw / 2), Math.floor(nh / 2));
	const tKernel = cv.imgproc.getStructuringElement(2, [5, 5]);
	// We find the paper color by dilating away the print.
	// And we find the ink color by eroding away the paper.
	var paperSample = imgCenter.copy();
	var inkSample = imgCenter.copy();
	inkSample.erode(24, tKernel);
	paperSample.dilate(24, tKernel);
	// We get image-wide means for both results and return them.
	return {"paper": meanWrap(paperSample.mean()), "ink": meanWrap(inkSample.mean())};
}

/**
 * Find an appropriate binarization threshold for an image of a printed document from detected paper and ink colors.
 * @param img - A non-binary image of a printed document.
 * @returns {number} A threshold between the paper and ink levels.
*/
function thresholdByPaper(img) {
	// This expects a monochrome image with document-like characteristics (dark print on a light substrate).
	const mediaLevels = paperAndInkColorsGuess(img);
	if (mediaLevels.paper instanceof Array)
		return (mediaLevels.paper[0] + mediaLevels.ink[0]) / 2;
	return (mediaLevels.paper + mediaLevels.ink) / 2;
}

/**
 * Find the approximate bounds of a document in an image using a known paper color and a tolerance.
 * @param img - A non-binary image of a printed document.
 * @param {(number|number[])} paperColor - The approximate color of the paper stock, in a form that matches a sample from the image.
 * @param {(number|number[])} colorTolerance - The absolute tolerance allowed from a target color, in the same format as the color.
 * @returns {number[4]} The bounds of the document in [x0, y0, x1, y1] format.
*/
function boundsGuess(img, paperColor, colorTolerance) {
	// This tries to find the bounds of a rectangular target, like a piece of paper, in a larger image.
	// It does this by finding outside rows and columns whose colors deviate excessively from a known paper color.
	const nw = img.width();
	const nh = img.height();
	// Make one crop of the center horizontal half and reduce to one pixel per row by average.
	const hCut = img.crop(Math.floor(nw / 4), 0, Math.floor(nw / 2), nh);
	const vStripe = rasterer.imageReduceToArray(hCut, 1, 1);
	if (vStripe != null && vStripe.length > 0) {
		// console.log("vStripe.length: " + vStripe.length + "");
		if (vStripe[0] instanceof Array) {
			// console.log("vStripe[0].length: " + vStripe[0].length + "");
		}
	}
	// Make one crop of the center vertical half and reduce to one pixel per row by average.
	const vCut = img.crop(0, Math.floor(nh / 4), nw, Math.floor(nh / 2));
	const hStripe = rasterer.imageReduceToArray(vCut, 0, 1);
	if (hStripe != null && hStripe.length > 0) {
		// console.log("hStripe.length: " + hStripe.length + "");
		if (hStripe[0] instanceof Array) {
			// console.log("hStripe[0].length: " + hStripe[0].length + "");
		}
	}
	// Increment inwards from the outside in each direction until a row/column matches by average color.
	var crT = null;
	var crB = null;
	var crL = null;
	var crR = null;
	var tprc;
	// From the top.
	// console.log("cr_t");
	for (tprc = 0; tprc < nh; tprc++) {
		if (logician.vectorScalarWithinTolerance(paperColor, vStripe[tprc], colorTolerance)) {
			crT = tprc;
			// console.log("tprc: " + tprc + "");
			break;
		} else if (tprc == 0) {
		}
	}
	// From the bottom.
	// console.log("cr_b");
	for (tprc = nh - 1; tprc > crT; tprc--) {
		if (logician.vectorScalarWithinTolerance(paperColor, vStripe[tprc], colorTolerance)) {
			crB = tprc;
			// console.log("tprc: " + tprc + "");
			break;
		}
	}
	// From the left.
	// console.log("cr_l");
	for (tprc = 0; tprc < nw; tprc++) {
		if (logician.vectorScalarWithinTolerance(paperColor, hStripe[tprc], colorTolerance)) {
			crL = tprc;
			// console.log("tprc: " + tprc + "");
			break;
		}
	}
	// From the right.
	// console.log("cr_r");
	for (tprc = nw - 1; tprc > crL; tprc--) {
		if (logician.vectorScalarWithinTolerance(paperColor, hStripe[tprc], colorTolerance)) {
			crR = tprc;
			// console.log("tprc: " + tprc + "");
			break;
		}
	}
	return [crL, crT, crR, crB]; // In flatline format.
}

/**
 * Find the approximate bounds of a document in an image using a downscaled proxy as appropriate.
 * @param img - A non-binary image of a printed document.
 * @param {(number|number[])} paperColor - The approximate color of the paper stock, in a form that matches a sample from the image.
 * @param {(number|number[])} colorTolerance - The absolute tolerance allowed from a target color, in the same format as the color.
 * @returns {?number[4]} The bounds of the document in [x0, y0, x1, y1] format.
*/
function boundsGuessFast(img, paperColor, colorTolerance) {
	// We resize down if the width is greater than 512 pixels.
	const nw = Math.floor(Math.min(img.width(), 512));
	const scaleFactor = nw / img.width();
	const scaleFactorInverse = img.width() / nw;
	const nh = Math.floor(img.height() * scaleFactor);
	// console.log("New size: " + nw + " x " + nh + "");
	// console.log("paperColor: " + paperColor + "");
	// Resize to nw x nh.
	var imgSmall = img.copy();
	imgSmall.resize(nw, nh);
	// console.log("New actual size: " + imgSmall.width() + " x " + imgSmall.height() + "");
	// Compute the bounds.
	const imgSmallBounds = boundsGuess(imgSmall, paperColor, colorTolerance);
	// If valid, scale them back up and return them.
	if (imgSmallBounds[0] != null && imgSmallBounds[1] != null && imgSmallBounds[2] != null && imgSmallBounds[3] != null)
		return logician.vectorBinaryOp("*", imgSmallBounds,
			[scaleFactorInverse, scaleFactorInverse, scaleFactorInverse, scaleFactorInverse])
			.map(Math.round);
	return null;
}

/**
 * Find the approximate bounds of a document ([x0, y0, x1, y1]) in an image using a detected paper color, with adjustment and a tolerance.
 * @param img - A non-binary image of a printed document.
 * @param {(number|number[])} adjustment - An adjustment to detected paper color, in a form that matches a sample from the image.
 * @param {(number|number[])} colorTolerance - The absolute tolerance allowed from a target color, in the same format as the color.
 * @returns {?number[4]} The bounds of the document in [x0, y0, x1, y1] format.
*/
function boundsGuessAutomaticWithAdjustment(img, adjustment, tolerance) {
	// Detect paper and ink colors and then adjust those.
	if (img.width() <= 0 || img.height() <= 0) return null;
	// We accept arrays or numbers for the adjustment and tolerance values.
	// We conform them to arrays here and back to numbers later if necessitated by the mediaLevels formats.
	var adjustmentV = (adjustment instanceof Array ? adjustment : [adjustment, 0, 0]);
	var toleranceV = (tolerance instanceof Array ? tolerance : [tolerance, 0, 0]);
	// Get the paper and ink colors.
	const mediaLevels = paperAndInkColorsGuess(img);
	// Adjust the paper level as commanded.
	const paperLevelAdjusted = (mediaLevels.paper instanceof Array ?
		logician.vectorBinaryOp("+", adjustmentV, mediaLevels.paper) :
		mediaLevels.paper + adjustmentV[0]);
	// Use the adjusted paper level and the tolerance to find the bounds.
	return boundsGuessFast(img, paperLevelAdjusted,
		(mediaLevels.paper instanceof Array ? toleranceV : toleranceV[0]));
}

/**
 * Find the approximate bounds of a document in an image using a detected paper color, with adjustment and a tolerance.
 * @param img - A non-binary image of a printed document.
 * @param {(number|number[])} adjustment - An adjustment to detected paper color.
 * @param {(number|number[])} colorTolerance - The absolute tolerance allowed from a target color.
 * @returns {?number[4]} The bounds of the document in [x0, y0, x1, y1] format.
*/
function boundsGuessAutomaticWithMinimalAdjustment(img, adjustment, tolerance) {
	// General document detection.
	if (img.width() <= 0 || img.height() <= 0) return null;
	// We assume here that the image, if reduced to single-channel mode, has been so reduced optimally.
	// So we use the minimum adjustment and tolerance values.
	// Step adjustment and tolerance up to arrays if not in that form already.
	var adjustmentV = (adjustment instanceof Array ? adjustment : [adjustment, 0, 0]);
	var toleranceV = (tolerance instanceof Array ? tolerance : [tolerance, 0, 0]);
	// Then step them down to numbers using the minimum value if the image has scalar samples.
	if (typeof(img.pixel(0, 0)) == "number") {
		adjustmentV = (adjustment instanceof Array ? [logician.arrayMinAbs(adjustment), 0, 0] : [adjustment, 0, 0]);
		toleranceV = (tolerance instanceof Array ? [logician.arrayMinAbs(tolerance), 0, 0] : [tolerance, 0, 0]);
	}
	return boundsGuessAutomaticWithAdjustment(img, adjustment, tolerance);
}

/**
 * Find vertical blocks of dark pixels meeting a per-row width threshold and return in [ystart, ystop] format.
 * @param img - A non-binary image of a printed document.
 * @param {object} rules - An object containing detection thresholds and rules.
 * @param {?number[4]=} roi - The region of interest.
 * @returns {Array.<number[2]>} The detected, valid vertical blocks in [ystart, ystop] format.
*/
function darkVerticalBlocksFind(img, rules, roi) {
	// This looks for vertical blocks of dark pixels meeting a per-row width threshold.
	if (roi != null && (roi[0] < 0 || roi[1] < 0 || roi[2] <= 0 || roi[3] <= 0 || roi[0] + roi[2] > img.width() || roi[1] + roi[3] > img.height()))
		return null;
	console.log("Cropping.");
	const imgCropped = (roi != null ? rasterer.imageCrop(img, roi) : img.copy());
	console.log("Scanning image rows.");
	const baseParameters = {"width": img.width()};
	var opts = {};
	opts.minValue = logician.valueFromRuleInRules(rules, "widthThresholdLow", baseParameters, 1);
	opts.maxGap = logician.valueFromRuleInRules(rules, "gapThresholdHigh", baseParameters, 0);
	opts.minHeight = logician.valueFromRuleInRules(rules, "heightThresholdLow", baseParameters, 0);
	opts.leftOffsetMin = logician.valueFromRuleInRules(rules, "leftOffsetMin", baseParameters, null);
	opts.leftOffsetMax = logician.valueFromRuleInRules(rules, "leftOffsetMax", baseParameters, null);
	// Find the leftmost and rightmost black pixel in each row.
	const rowBlackBounds = rasterer.imageRowsFindBlackBounds(imgCropped);
	// Invalidate any row with too low a starting (left) offset.
	if ("leftOffsetMin" in opts && typeof(opts.leftOffsetMin) == "number")
		rowBlackBounds.forEach(function (bounds, row) {
			if (bounds[0] != null && bounds[0] < opts.leftOffsetMin) rowBlackBounds[row] = [null, null];
		});
	// Invalidate any row with too high a starting (left) offset.
	if ("leftOffsetMax" in opts && typeof(opts.leftOffsetMax) == "number")
		rowBlackBounds.forEach(function (bounds, row) {
			if (bounds[0] != null && bounds[0] >= opts.leftOffsetMax) rowBlackBounds[row] = [null, null];
		});
	// Compute the width of each row.
	const rowBlackWidths = logician.boundsToWidths(rowBlackBounds);
	// Prepare to shift back to the uncropped geometry.
	const vShift = (roi != null ? roi[1] : 0);
	// Bin the line widths and adjust the bin positions to the uncropped geometry.
	return logician.binMinimumValueRuns(rowBlackWidths, opts)
		.map(function (bounds) { return bounds.map(function (vv) { return vv + vShift; }); });
}

var barcodeRegionAndLineFindProfile = {
	"preerode": {"count": 1},
	"blackThreshold": {"value": "auto"},
	"canny": {
		"thresholdLow": 720 / 4,
		"thresholdHigh": 720 / 2
	},
	"dilate": {"count": 6},
	"erode": {"count": 33},
	"boxdilatebig": {"count": 12},
	"lineerode": {"count": 8},
	"boxdetection": {"value": "monobox"}
};

/**
 * Find an area likely to contain a barcode and a likely scanline of that barcode, based on edge concentrations, and return in an object.
 * @param img - A non-binary image of a printed document.
 * @param rules {object} - An object containing reprocessing and detection rules.
 * @param roi {?number[4]=} - The region of interest.
 * @returns {object} An object containing box (in rectangle format) and line (the scanline in flat line format) if detected.
*/
function barcodeRegionAndLineFind(img, rules, roi) {
	// This attempts to find the barcode in the image.
	// After some preprocessing, it runs edge detection and then tries to find a high concentration of edges.
	// Some postprocessing can reduce that to a uniform blob and eliminate all other white pixels.
	// We then find the bounds of that region.
	const baseParameters = {width: img.width()};
	const autoBlackThreshold = thresholdByPaper(img);
	var imgT = img.copy();
	if ("preerode" in rules && "count" in rules.preerode) {
		const kern0 = cv.imgproc.getStructuringElement(1, [3, 3]);
		imgT.erode(rules.preerode.count, kern0);
	}
	if ("blackThreshold" in rules && "value" in rules.blackThreshold) {
		if (typeof(rules.blackThreshold.value) == "string" && rules.blackThreshold.value == "auto")
			imgT = imgT.threshold(Math.round(0.875 * autoBlackThreshold), 255, "Binary", "Simple");
		else if (typeof(rules.blackThreshold.value) == "number")
			imgT = imgT.threshold(rules.blackThreshold.value, 255, "Binary", "Simple");
	} else {
		imgT = imgT.threshold(128, 255, "Binary", "Simple");
	}
	if ("canny" in rules && "thresholdHigh" in rules.canny && "thresholdLow" in rules.canny) {
		imgT.canny(rules.canny.thresholdLow, rules.canny.thresholdHigh);
	}
	if ("dilate" in rules && "count" in rules.dilate) {
		const kern0 = cv.imgproc.getStructuringElement(1, [3, 3]);
		imgT.dilate(rules.dilate.count, kern0);
	}
	if ("erode" in rules && "count" in rules.erode) {
		const kern0 = cv.imgproc.getStructuringElement(1, [3, 3]);
		imgT.erode(rules.erode.count, kern0);
	}
	if ("boxdilatebig" in rules && "count" in rules.boxdilatebig) {
        var ksize = Math.floor(Math.max((roi != null ? roi[2] : img.width()), 512) / 64);
		const kern1 = cv.imgproc.getStructuringElement(1, [ksize, ksize]);
		imgT.dilate(rules.boxdilatebig.count, kern1);
	}
	if ("lineerode" in rules && "count" in rules.lineerode) {
		// console.log("lineerode");
		const kern0 = cv.imgproc.getStructuringElement(1, [3, 3]);
		imgT.erode(rules.lineerode.count, kern0);
	}
	if ("boximagedump" in rules && "path" in rules.boximagedump &&
			typeof(rules.boximagedump.path) == "string")
		imgT.save(rules.boximagedump.path);
	// The monobox method just finds the bounds of the white pixels.
	// It is crude and relies on the preprocessing eliminating all spurious white.
	var barcodeMonobox = rasterer.imageFindMonobox(imgT, 0);
	// The contours method is more sophisticated, but it depends on contour detection, which is broken.
	var barcodeContours = imgT.findContours();
	// Generate a box as requested.
	var barcodeBox = null;
	if ("boxdetection" in rules && "value" in rules.boxdetection &&
			rules.boxdetection.value == "monobox") {
		barcodeBox = barcodeMonobox;
	} else if (barcodeContours.length > 0) {
		barcodeBox = barcodeContours[0];
	}
	// Now we try to detect the center line of the barcode.
	// This will fail when the barcode is not long relative to its short dimension.
	var accumulatorSize = logician.valueFromRule(rules.accumulatorSize, baseParameters);
	var edgeKernelSize = Math.floor(Math.max(img.width(), 512) / 256);
	var lineLength = Math.floor(Math.max(img.width(), 512) / 4);
	var imgConverted = new cv.Matrix(1, 1);
	imgT.convertTo(imgConverted, cv.Constants.CV_8UC1);
	// We detect the lines.
	var rawLines = imgConverted.houghLinesP(imgConverted.width() / 384, Math.acos(-1) / 180, 3 * lineLength, lineLength, Math.ceil(lineLength / 192));
	var niceLines = eudoxus.consolidateLines(rawLines, Math.acos(-1) / 32, imgConverted.width() / 128, 0.1) ;
	// Return both the box and the line.
	return {box: barcodeBox, line: (niceLines.length > 0 ? niceLines[0] : null)};
}

/**
 * Use options to convert barcode search results into a flat crop box.
 * @param img - A non-binary image of a printed document.
 * @param findings {object} - An object containing detected box and line if present.
 * @param opts {object} - An object containing adjustments to the box and the line (which also determine whether they are considered).
 * @returns {?number[4]} A flat crop box ([x, y, w, h]) or null if there are no applicable data.
*/
function barcodeCropFromBoxAndLine(img, findings, opts) {
	// This parses the results from findBarcodeRegionAndLineInImage into a single region of interest.
	// The aforementioned function may return a box and a line.
	// The calling function may use the box, the line, or both (with the line receiving precedence).
	// It determines which to consider by providing an adjustment for that entity.
	// The adjustment may be zero in all coordinates.
	var opr = null;
	if ("box" in findings && findings.box instanceof Array &&
			"box" in opts && "adjustment" in opts.box && opts.box.adjustment instanceof Array)
		opr = rasterer.rectangleConstrainInImage(img, findings.box.map(function (val, ind) { return val + opts.box.adjustment[ind]; }));
	if ("line" in findings && findings.line !== null &&
			"line" in opts && "adjustment" in opts.line && opts.line.adjustment instanceof Array) {
		var lineBox = geometer.flatlineToRectangleFixed(findings.line);
		opr = rasterer.rectangleConstrainInImage(img, lineBox.map(function (val, ind) { return val + opts.line.adjustment[ind]; }));
	}
	return opr;
}

/**
 * Crop by color in stages, each with its own color deviation and adjustment and geometric rules.
 * @param img - A non-binary image of a printed document.
 * @param stages {Array.<object>} - An object containing detected box and line if present.
 * @returns {object} An object containing offset (an [x, y] pair) and image (the cropped image).
*/
function colorCropStaged(img, stages) {
	// Each stage will have a color adjustment, a color deviation, and geometric rules.
	const stagesTemplate = [{color_deviation: [], color_adjustment: [], crop_adjustment: [], crop_overlay: []}];
	var cropBase = [0, 0];
	var imgCrop = img;
	stages.forEach(function (stage) {
		var boundLine = null;
		// Use the color adjustment and deviation for this stage to compute an initial box.
		if ("color_deviation" in stage && "color_adjustment" in stage &&
				stage.color_deviation instanceof Array && stage.color_adjustment instanceof Array)
			boundLine = boundsGuessAutomaticWithMinimalAdjustment(imgCrop, stage.color_adjustment, stage.color_deviation);
		// Fall back to the whole image on failure.
		if (boundLine == null) boundLine = [0, 0, imgCrop.width(), imgCrop.height()];
		// Convert from corner-corner form to corner-size form.
		var bounds = geometer.flatlineToRectangle(boundLine);
		// Adjust the boundaries according to the rules for this stage.
		if ("crop_adjustment" in stage && stage.crop_adjustment instanceof Array)
			bounds = logician.vectorBinaryOp("+", bounds, stage.crop_adjustment);
		if ("crop_overlay" in stage && stage.crop_overlay instanceof Array)
			stage.crop_overlay.forEach(function (cov, coi) { if (typeof(cov) == "number") bounds[coi] = cov; });
		// Adjust the boundaries to fit in the image, and make sure that they contain pixels.
		bounds = rasterer.rectangleConstrainValidateInImage(imgCrop, bounds);
		// If appropriate, crop.
		if (bounds != null) {
			cropBase[0] += bounds[0]; cropBase[1] += bounds[1];
			imgCrop = rasterer.imageCrop(imgCrop, bounds);
		}
	});
	return {offset: cropBase, image: imgCrop};
}

module.exports = exports = {thresholdByBigPeak, paperAndInkColorsGuess, thresholdByPaper, boundsGuess, boundsGuessFast, boundsGuessAutomaticWithAdjustment, boundsGuessAutomaticWithMinimalAdjustment, darkVerticalBlocksFind, barcodeRegionAndLineFindProfile, barcodeRegionAndLineFind, barcodeCropFromBoxAndLine, colorCropStaged};

