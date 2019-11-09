// Copyright 2017-2018 by Frank Trampe independently and for Autolotto.
// This is hereby released under the terms of the BSD 3-clause license, the MIT/X11 license, and the Apache 2.0 license.

// Your image will be assimilated.

const logician = require("./logician.js");
const geometer = require("./geometer.js");

/**
 * Transform an image with a detected orientation line to match a target orientation line and canvas size.
 * @param {object} baseSchema - The ideal dimensions and orientation line (the target of the transformation).
 * @param {object} inputSchema - The dimensions (optional) and orientation line of the input image
 * @param inputImage - The image to be correctively transformed to match baseSchema.
 * @returns The transformed image.
*/
function normalizeImageOrientation(baseSchema, inputSchema, inputImage) {
	// inputImage is an OpenCV image.
	// The schema include a dictionary of dimensions w and h, each a integer.
	// The schema include rotation, an integer.
	// The schema include an orientation line orientationLine, with a base point basePoint containing integers x and y, rotation (clockwise degrees from rightward horizontal) as an integer, and size as an integer.
	// It is not necessary to include the dimensions in inputSchema, as they will be inferred from inputImage.
	// { orientationLine: { basePoint: [355, 673], rotation: 0, size: 1165 }, dimensions: [1935, 4600] }

	// We map out the transformations and requisite data before working with pixels.
	var normalImageSize = baseSchema.dimensions;
	console.log("normalImageSize");
	console.log(normalImageSize);
	var inputImageSize = [inputImage.width(), inputImage.height()]; // We could use inputSchema.dimensions.
	console.log("inputImageSize");
	console.log(inputImageSize);
	var correctiveRotation = baseSchema.orientationLine.rotation - inputSchema.orientationLine.rotation; // The rotation from the input image to the base image.
	console.log("correctiveRotation");
	console.log(correctiveRotation);
	var correctiveScale = baseSchema.orientationLine.size / inputSchema.orientationLine.size; // The scaling factor from the input image to the base image.
	console.log("correctiveScale");
	console.log(correctiveScale);
	var regressiveScale = inputSchema.orientationLine.size / baseSchema.orientationLine.size; // We need the reverse to project the desired center.
	console.log("regressiveScale");
	console.log(regressiveScale);
	var inputBasePoint = inputSchema.orientationLine.basePoint;
	console.log("inputBasePoint");
	console.log(inputBasePoint);
	var normalBasePoint = baseSchema.orientationLine.basePoint;
	console.log("normalBasePoint");
	console.log(normalBasePoint);
	// Projecting the base center onto the input image involves transforming its offset from the base point into polar coordinates.
	var normalImageCenter = [normalImageSize[0] / 2, normalImageSize[1] / 2];
	console.log("normalImageCenter");
	console.log(normalImageCenter);
	var normalImageCenterOffset = geometer.vectorDifference(normalBasePoint, normalImageCenter);
	console.log("normalImageCenterOffset");
	console.log(normalImageCenterOffset);
	var normalImageCenterOffsetPolar = geometer.rectangularToPolar(normalImageCenterOffset);
	console.log("normalImageCenterOffsetPolar");
	console.log(normalImageCenterOffsetPolar);
	// We transform the polar representation into the space of the input image, convert to rectangular, and get absolute coordinates.
	var inputImageCorrectiveCenterOffsetPolar = [normalImageCenterOffsetPolar[0] * regressiveScale, normalImageCenterOffsetPolar[1] + correctiveRotation];
	console.log("inputImageCorrectiveCenterOffsetPolar");
	console.log(inputImageCorrectiveCenterOffsetPolar);
	var inputImageCorrectiveCenterOffset = geometer.polarToRectangular(inputImageCorrectiveCenterOffsetPolar);
	console.log("inputImageCorrectiveCenterOffset");
	console.log(inputImageCorrectiveCenterOffset);
	var inputImageCorrectiveCenter = geometer.vectorSum(inputBasePoint, inputImageCorrectiveCenterOffset);
	console.log("inputImageCorrectiveCenter");
	console.log(inputImageCorrectiveCenter);
	// We need a radius from the projected center to one of the corners in order to size the canvas for lossless rotation of the region of interest.
	var normalImageRadius = geometer.vectorMagnitude(normalImageCenter);
	console.log("normalImageRadius");
	console.log(normalImageRadius);
	var inputImageTargetRadius = regressiveScale * normalImageRadius;
	console.log("inputImageTargetRadius");
	console.log(inputImageTargetRadius);
	// We use the radius to compute padding. The vector contains left, top, right, and bottom values in that order.
	var prerotationDimensionAdjustmentVector = [inputImageTargetRadius - inputImageCorrectiveCenter[0], inputImageTargetRadius - inputImageCorrectiveCenter[1], inputImageTargetRadius - (inputImageSize[0] - inputImageCorrectiveCenter[0]), inputImageTargetRadius - (inputImageSize[1] - inputImageCorrectiveCenter[1])];
	console.log("prerotationDimensionAdjustmentVector");
	console.log(prerotationDimensionAdjustmentVector);
	// We will not pad negatively, so we drop negative values.
	var prerotationPadVector = logician.vectorBinaryOp("max", prerotationDimensionAdjustmentVector, [0, 0, 0, 0]);
	console.log("prerotationPadVector");
	console.log(prerotationPadVector);
	// We offset the desired center to reflect the padding.
	var prerotationCenter = geometer.vectorSum(inputImageCorrectiveCenter, prerotationPadVector.slice(0, 2));
	console.log("prerotationCenter");
	console.log(prerotationCenter);
	// We compute the size of the padded image prior to rotation.
	var prerotationSize = geometer.vectorSum(inputImageSize, geometer.vectorSum(prerotationPadVector.slice(0, 2), prerotationPadVector.slice(2, 4)));
	console.log("prerotationSize");
	console.log(prerotationSize);
	// The rotation obviously does not move its own center.
	// The scaling may move the center, so we scale its position accordingly.
	var postScaleCenter = logician.vectorBinaryOp("*", prerotationCenter, [correctiveScale, correctiveScale]);
	console.log("postScaleCenter");
	console.log(postScaleCenter);
	// The input and base images have the same scale and rotation, so we use the offset between centers to fix position and to crop.
	var postScaleCropCorner = geometer.vectorDifference(normalImageCenter, postScaleCenter);
	console.log("postScaleCropCorner");
	console.log(postScaleCropCorner);
	var postScaleCropCornerSafe = logician.vectorBinaryOp("max", postScaleCropCorner, [0, 0]);
	console.log("postScaleCropCornerSafe");
	console.log(postScaleCropCornerSafe);
	// Pad prior to rotation to avoid clipping of the region of interest.
	console.log("Creating the new padded base image.");
	var paddedImageBasic = new cv.Matrix(Math.ceil(prerotationSize[1]), Math.ceil(prerotationSize[0]), 1);
	var paddedImage = new cv.Matrix(1,1);
	paddedImageBasic.convertTo(paddedImage, 0);
	console.log("Copying to the padded canvas.");
	console.log("Input: " + inputImage.width() + "x" + inputImage.height());
	console.log("Target: " + paddedImage.width() + "x" + paddedImage.height());
	console.log("Pad: " + Math.floor(prerotationPadVector[0]) + "x" + Math.floor(prerotationPadVector[1]));
	console.log("Input + Pad: " + (inputImage.width() + Math.floor(prerotationPadVector[0])) + "x" + (inputImage.height() + Math.floor(prerotationPadVector[1])));
	inputImage.copyTo(paddedImage, Math.floor(prerotationPadVector[0]), Math.floor(prerotationPadVector[1]));
	// Rotate correctiveRotation about inputImageCorrectiveCenter.
	console.log("Rotating.");
	paddedImage.rotate(correctiveRotation, Math.floor(prerotationPadVector[0] + inputImageCorrectiveCenter[0]), Math.floor(prerotationPadVector[1] + inputImageCorrectiveCenter[1]));
	// Scale by correctiveScale.
	console.log("Scaling.");
	paddedImage.resize(Math.round(correctiveScale * prerotationSize[0]), Math.round(correctiveScale * prerotationSize[1]));
	// Crop.
	console.log("Cropping.");
	var croppedImage = paddedImage.crop(Math.floor(postScaleCropCornerSafe[0]), Math.floor(postScaleCropCornerSafe[1]), normalImageSize[0], normalImageSize[1]);
	return croppedImage;
}

module.exports = exports = {normalizeImageOrientation};

