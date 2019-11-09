// Copyright 2017-2018 by Frank Trampe for Autolotto.
// This is hereby released under the terms of the BSD 3-clause license, the MIT/X11 license, and the Apache 2.0 license.

// This file contains functions for handling, transforming, and analysing OpenCV images.

const logician = require("./logician.js");
const geometer = require("./geometer.js");
const cv = require("opencv");

/**
 * Create a function that converts a sample to match the provided sample.
 * @param {(number|number[])} sample - An image sample (a number or an array of numbers).
 * @returns {function} A function that converts a sample to the sampled format.
*/
function meanWrapFromPixel(sample) {
	// The mean method in the OpenCV JavaScript bindings always returns four values.
	// We want to be able to convert it to match the image.
	// This function takes a sample from the image and returns a function that makes the conversion.
	// The conversion function must also be able to ingest scalar values safely.
	// If the sample is an array, return a function that outputs one of the same length.
	if (sample instanceof Array)
		return function (x) { if (x instanceof Array) return x.slice(0, sample.length); return x; };
	// Otherwise, return a function that outputs a single number.
	return function (x) { if (x instanceof Array) return x[0]; return x; };
}

/**
 * Reduce each row or column in an image to a single value.
 * @param img - An OpenCV image.
 * @param {number} axis - 0 to reduce columns, 1 to reduce rows.
 * @param {number} mode - The OpenCV reduction constant (1 for average, 2 for maximum, 3 for minimum).
 * @returns {Array.<(number|number[])>} An array of the reduced rows/columns.
*/
function imageReduceToArray(img, axis, mode) {
	// There is an OpenCV function for this, but the JavaScript bindings are broken.
	// This takes an image and reduces each row or column to a single value, depending upon the axis choice.
	// If axis is 0, this returns a width-length array of vertical reductions from left to right.
	// If axis is 1, this returns a height-length array of horizontal reductions from top to bottom.
	// mode uses the standard reduction constants from OpenCV.
	var opv = [];
	// Cache image dimensions.
	const w = img.width();
	const h = img.height();
	if (w <= 0 || h <= 0) return null;
	// Cache slice dimensions.
	const ws = axis ? w : 1;
	const hs = axis ? 1 : h;
	// Outputs from mean require fixing, so we generate a function for that.
	const meanWrap = meanWrapFromPixel(img.pixel(0, 0));
	var x = 0;
	var y = 0;
	while (x < w && y < h) {
		// Take a slice by cropping.
		const sample = img.crop(x, y, ws, hs);
		// Compute the appropriate value and push it to the output array.
		if (mode == 0) opv.push(meanWrap([NaN, NaN, NaN, NaN])) // CV_REDUCE_SUM, but broken
		else if (mode == 1) opv.push(meanWrap(sample.mean())); // CV_REDUCE_AVG
		else {
			minmaxr = sample.minMaxLoc();
			if (mode == 2) opv.push(minmaxr.maxVal); // CV_REDUCE_MAX
			else if (mode == 3) opv.push(minmaxr.minVal); // CV_REDUCE_MIN
			else opv.push(null);
		}
		// Increment the proper value.
		if (axis) y++;
		else x++;
	}
	return opv;
}

/**
 * Find a box containing all white or black pixels in an image.
 * @param img - An OpenCV image.
 * @param {number} mode - Color mode (0 to find white on black, 1 to find black on white).
 * @returns {?number[4]} The bounding box in rectangle format on success or null on failure.
*/
function imageFindMonobox(img, mode) {
	// This finds a box containing all white or black pixels in an image.
	// mode is 0 for white (on black) and 1 for (black on white).
	var hStripe = imageReduceToArray(img, 0, mode + 2);
	var vStripe = imageReduceToArray(img, 1, mode + 2);
	var hBounds = logician.arrayGetMatchingBounds(hStripe, 255 * (!mode));
	var vBounds = logician.arrayGetMatchingBounds(vStripe, 255 * (!mode));
	if (hBounds[0] != null && hBounds[1] != null && vBounds[0] != null && vBounds[1] != null)
		return [hBounds[0], vBounds[0], hBounds[1] - hBounds[0], vBounds[1] - vBounds[0]];
	return null;
}

/**
 * Find the binary deviation between two images after blurring and thresholding.
 * @param img0 - An OpenCV image.
 * @param img1 - An OpenCV image.
 * @param {object} rules - An object defining gaussianX, gaussianY, and thresholdV.
 * @returns {number} The deviation value.
*/
function imageDeviationBinary(img0, img1, rules) {
	// Compute the parameters.
	const gaussianX = Math.round(logician.valueFromRuleInRules(rules, "gaussianX", {}, 5));
	const gaussianY = Math.round(logician.valueFromRuleInRules(rules, "gaussianY", {}, 5));
	const thresholdV = Math.round(logician.valueFromRuleInRules(rules, "thresholdV", {}, 5));
	// Crop the input images to the same size, blur them, and threshold them.
	const minW = Math.min(img0.width(), img1.width());
	const minH = Math.min(img0.height(), img1.height());
	var img0pp = img0.crop(0, 0, minW, minH);
	img0pp.gaussianBlur([gaussianX, gaussianY]);
	img0pp = img0pp.threshold(thresholdV, 255, "Binary", "Simple");
	var img1pp = img1.crop(0, 0, minW, minH);
	img1pp.gaussianBlur([gaussianX, gaussianY]);
	img1pp = img1pp.threshold(thresholdV, 255, "Binary", "Simple");
	// xor the two images.
	var imgDiff = new cv.Matrix();
	imgDiff.bitwiseXor(img0pp, img1pp);
	// Return the average.
	return imgDiff.mean();
}

/**
 * Find the lowest binary deviation between a target image and an image from a reference dictionary and return the key name of the match.
 * @param references {object} - A dictionary of reference images.
 * @param target - An OpenCV image.
 * @param {object} opts - An object containing threshold (a maximum allowed deviation threshold for a match).
 * @returns The name of the matching reference image or null if there is not a strong enough match.
*/
function imageDeviationBinaryMinimizeAgainstReferences(references, target, opts) {
	// Document detection.
	// Input a dictionary of reference images and a target image, and this will identify the closest match by dictionary name.
	// Inputs must be bilevel, scale-normalized, position-normalized, and rotation-normalized.
	// Set opts.threshold = 80 in order to throw out likely non-matches.
	var imgName = null;
	if (references !== null && target !== null && target.width() > 0 && target.height() > 0) {
		var tname;
		var lowestDeviationValue = null;
		var lowestDeviationName = null;
		for (tname in references) {
			// Compute the deviation.
			var deviation = imageDeviationBinary(references[tname], target, {});
			// Set the best match if it is unset or if this one is better.
			if (deviation !== null && deviation[0] !== null &&
					(lowestDeviationValue === null || deviation[0] < lowestDeviationValue)) {
				lowestDeviationValue = deviation[0];
				lowestDeviationName = tname;
			}
		}
		// Apply the threshold and set the output if applicable.
		if (lowestDeviationValue !== null &&
				(!opts || !("threshold" in opts) || opts.threshold == null || lowestDeviationValue < opts.threshold))
			imgName = lowestDeviationName;
	}
	return imgName;
}

/**
 * Find the first and last black pixel in each row or column of an image.
 * @param img - An OpenCV image.
 * @param {number} axis - The axis on which to slice (0 for column heights, 1 for row widths).
 * @returns {Array.<(number[2]|object[2])>} An array of start/stop positions or null pairs for empty slices.
*/
function imageSlicesFindBlackBounds(img, axis) {
	// This takes an OpenCV image as input.
	// It returns an array of start/stop pairs (arrays).
	var sliceBlackBounds = [];
	var pos;
	for (pos = 0; pos < img.height(); pos++) {
		var sliceTemp = (axis ? img.pixelRow(pos) : img.pixelColumn(pos));
		// The current release of the OpenCV binding as of 2018.5.9 makes the array too long.
		// We must detect and correct.
		if (sliceTemp.length > img.width()) {
			sliceTemp = sliceTemp.slice(0, (axis ? img.width() : img.height()));
		}
		var bounds = logician.arrayGetZeroBounds(sliceTemp);
		sliceBlackBounds.push(bounds);
	}
	return sliceBlackBounds;
}

/**
 * Find the first and last black pixel in each row of an image.
 * @param img - An OpenCV image.
 * @returns {Array.<(number[2]|object[2])>} An array of start/stop positions or null pairs for empty rows.
*/
function imageRowsFindBlackBounds(img) {
	return imageSlicesFindBlackBounds(img, 1);
}

/**
 * Find the leftmost and rightmost black pixel in an image.
 * @param img - An OpenCV image.
 * @returns {(number[2]|object[2])} An array containing the left and right extrema or null in each place if the image is empty.
*/
function imageFindBlackBoundsHorizontal(img) {
	return logician.boundsPairsFindExtremaPair(imageRowsFindBlackBounds(img));
}

/**
 * Draw shapes in place on an image.
 * @param img - An OpenCV image.
 * @param {object} shapes - An object defining the shapes.
 * @returns The input image with drawing complete.
*/
function imageDrawShapes(img, shapes) {
	// This takes a set of shape descriptions and draws them in place on the image.
	// It presently supports rectangles.
	// Each shape has a shape, a color, and a thickness.
	// If the shape is rectangle, it has an roi also.
	var baseParameters = {width: img.width(), height: img.height()};
	shapes.forEach(function (shapeT) {
		// Make sure that we have the requisite general parameters.
		if ("shape" in shapeT && typeof(shapeT.shape) == "string" && "color" in shapeT && shapeT.color instanceof Array &&
				"thickness" in shapeT && typeof(shapeT.thickness) == "number") {
			// If the shape is a rectangle, check that the geometry is present.
			if (shapeT.shape == "rectangle") {
				if ("roi" in shapeT && shapeT.roi instanceof Array && shapeT.roi.length == 4) {
					// Compute each coordinate using the base parameters.
					var roif = shapeT.roi.map(function (ctt) { return logician.valueFromRule(ctt, baseParameters); }).map(function (ctt) { return Math.round(ctt); });
					console.log("Drawing rectangle " + roif + ".");
					// Draw it.
					img.rectangle(roif.slice(0, 2), roif.slice(2, 4).map(function (tv) { return tv - 1; }), shapeT.color, shapeT.thickness);
				}
			}
		}
	});
	return img;
}

/**
 * Return a rectangle as close to that supplied as possible that fits in the image.
 * @param img - An OpenCV image.
 * @param {number[4]} rect - A rectangle in array form ([x, y, w, h]).
 * @returns {number[4]} The adjusted rectangle.
*/
function rectangleConstrainInImage(img, rect) {
	return geometer.rectangleConstrainInRectangle([0, 0, img.width(), img.height()], rect);
}

/**
 * Return a rectangle as close to that supplied as possible that fits in the image only if valid.
 * @param img - An OpenCV image.
 * @param {number[4]} rect - A rectangle in array form ([x, y, w, h]).
 * @returns {?number[4]} The adjusted rectangle if valid or null otherwise.
*/
function rectangleConstrainValidateInImage(img, rect) {
	// This cuts the rectangle to fit in the image and returns null if a dimension is zero.
	if (img == null || rect == null) return null;
	var rectangleConstrained = rectangleConstrainInImage(img, rect.map(Math.round));
	if (geometer.rectangleValidatePositive(rectangleConstrained)) return rectangleConstrained;
	return null;
}

/**
 * Return a crop of the image to the supplied rectangle only if the rectangle fits in the image and contains pixels.
 * @param img - An OpenCV image.
 * @param {number[4]} rect - A rectangle in array form ([x, y, w, h]).
 * @returns A crop of the image if valid or null otherwise.
*/
function imageCrop(img, rect) {
	var bounds = rectangleConstrainValidateInImage(img, rect);
	if (bounds == null) return null;
	return img.crop(bounds[0], bounds[1], bounds[2], bounds[3]);
}

/**
 * Extract the specified channel from the image, falling back to the base image on failure.
 * @param img - An OpenCV image.
 * @param {number} chan - The index of the desired channel.
 * @returns The selected channel if present, the image otherwise.
*/
function imageToGrayByChannel(img, chan) {
	var output = null;
	try {
		const channels = img.split();
		if (channels.length > chan) {
			output = channels[chan]; // Take the desired channel.
		} else if (channels.length > 0) {
			output = channels[0]; // Fall back to the first channel.
		} else {
			console.log("Missing channel.");
		}
	} catch (err) {
		output = img;
	}
	return output;
}

/**
 * Shift the image down and to the right by the specified amounts and fill the space with a color.
 * @param img - An OpenCV image.
 * @param {number[]} margins - An array with the rightward shift and the downward shift.
 * @param {(number|number[])} color - The color to be put in the shift space (in the same format as a pixel in the image).
 * @returns The original image, with the shift applied.
*/
function imageShiftInPlace(img, margins, color) {
	if (img == null || margins == null || margins.length < 2 || color == null) return null;
	img.shift(margins[0], margins[1]);
	img.rectangle([0, 0], [img.width(), margins[1]], color, -1);
	img.rectangle([0, 0], [margins[0], img.height()], color, -1);
	return img;
}

/**
 * Load a set of files as OpenCV images.
 * @param {string[]} imgList - A list of file names.
 * @param {function} cb - A function to be called upon loading of the image, to be called with the error as the first argument and the loaded OpenCV images in an array as the second.
 * @param {?number=} offsetI - An optional offset in the image list.
 * @returns Nothing of significance.
*/
function imagesLoad(imgList, cb, offsetI) {
	var offset = 0;
	if (typeof(offsetI) == "number") offset = offsetI;
	if (offset < imgList.length && typeof(imgList[offset]) == "string") {
		// Read the current image.
		return cv.readImage(imgList[offset], function (err, img) {
			// Chain the next image load.
			return imagesLoad(imgList, function (erv, rv) {
				// Upon return from that one return this result and that result.
				return cb(null, [err ? null : img].concat(rv));
			}, offset + 1);
		});
	}
	return cb(null, []);
}

/**
 * Save a set of OpenCV images in a lookup to file names in a parallel lookup.
 * @param {object} pathLookup - A string-indexed dictionary of file names.
 * @param {object} imgLookup - A string-indexed dictionary of OpenCV images.
 * @returns Nothing of significance.
*/
function imageLookupWriteToPathsInLookup(pathLookup, imgLookup) {
	var tname;
	for (tname in imgLookup) {
		// For each image provided by name, see whether a path is provided for the same name.
		if (tname in pathLookup && typeof(pathLookup[tname]) == "string" && imgLookup[tname] !== null) {
			// If so, write the image to the path.
			imgLookup[tname].save(pathLookup[tname]);
		}
	}
	return null;
}

module.exports = exports = {meanWrapFromPixel, imageReduceToArray, imageFindMonobox, imageDeviationBinary, imageDeviationBinaryMinimizeAgainstReferences, imageSlicesFindBlackBounds, imageRowsFindBlackBounds, imageFindBlackBoundsHorizontal, imageDrawShapes, rectangleConstrainInImage, rectangleConstrainValidateInImage, imageCrop, imageToGrayByChannel, imageShiftInPlace, imagesLoad, imageLookupWriteToPathsInLookup};

