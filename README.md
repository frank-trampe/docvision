# docvision

## Overview

This library provides various routines helpful for identifying boundaries and regions of scanned documents. It is descended from a product called lottovision previously released by Lottery.com but now off-line.

## Functional Areas

### Line Aggregation

Using a standard line detection method on a faint or dashed line (sometimes necessary when erosion would cause false positives) can give large numbers of disjoint line segments. `eudoxus.js` contains functions for analysing lines and consolidating them according to certain rules. See function `barcodeRegionAndLineFind` in `jaworski.js` for an example of `consolidateLines` improving output from `houghLinesP`.

A common occurrence when processing documents is to have a section of text bounded by parallel lines of similar length. `consolidateLinesBySlope` in `eudoxus.js` deals with such cases (usually after line consolidation).

### Document Detection

Identifying a document type or slicing it into subregions for processing often depends on the image size matching the document size. Unfortunately, photographs or even scans of a document may include significant excess area of indeterminate color and texture. Function `boundsGuessAutomaticWithMinimalAdjustment` in `jaworski.js` identifies the substrate color based on the central region of the image and uses that to crop automatically. Extra parameters allow handling watermarks and other expected substrate variations, even when the exposure and color balance of the input images vary considerably. The code for detecting substrate color and ink color is also exposed in `paperAndInkColorsGuess`. Sometimes, one can obtain better results for color-based cropping by defining a succession of color-based cropping rules. `colorCropStaged` implements a mechanism for doing that.

### Text Block Detection

Sometimes, a special block of text is detected more readily by its visual characteristics than by its textual characteristics. `darkVerticalBlocksFind` in `jaworski.js` allows finding a block of text meeting per-line and overall geometric thresholds. `imageSlicesFindBlackBounds` in `rasterer.js` returns a simple set of start/stop pairs for the black pixels in each row to allow a simple search for lines by width.

### Raster Code Detection

Raster code readers are often unable efficiently to locate codes in a large image. `barcodeRegionAndLineFind` in `jaworski.js` uses relatively cheap operations to locate areas of high edge density, which often correspond to barcodes and PDF417 codes.

### Raster Code Reading

It is handy to be able to read raster codes in native JavaScript, but such products are rare and seldom work in node.js. `qrcf.js` includes a node.js port of jsqr, a QR code reader, with some additional improvements to the reading of large QR codes. `qrlib.js` includes an example of how to use `qrcf.js`. `zxing-pdf417-node.js` includes a node.js port of a partial JavaScript port of the part of zxing that reads PDF417 codes.

## Use

There is no npm wrapper at this time. The suggested use pattern is to add this as a submodule and then to require the desired files by path. Dependencies are light. Some components require OpenCV JavaScript bindings (npm package `opencv`). The zxing port requires `big-integer` and `pngjs`.

## Support

Lottery.com does not warrant the performance of this code in any way and does not support it either. Use at your own risk and expense. If you really, really need help with something, contact Frank Trampe (dev@franktrampe.com).
