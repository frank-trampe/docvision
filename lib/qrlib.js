var gm = require('gm').subClass({imageMagick : true });
var qrc = require('./qrcf.js');
var fs = require('fs');
var pngjs = require('pngjs');
// var ipb5 = fs.readFileSync('qr_sample_5.png');
// var ipb6 = fs.readFileSync('qr_sample_6.png');
function qr_sharpen_and_read(ipb, eso, cb) {
	gm(ipb).sharpen(5 * eso, 2.5 * eso).type("TrueColor").toBuffer('png32', function (err, simg) {
		if (err) return cb(err, null);
		var pngr = pngjs.PNG.sync.read(simg);
		var fakeCanvas = {width: pngr.width, height: pngr.height};
		var imgd = Uint8ClampedArray.from(pngr.data);
		var fakeContext = {getImageData: function () { return {data: imgd}; }, putImageData: function () { return; }};
		var qrcode = new qrc();
		qrcode.canvas_qr2 = fakeCanvas;
		qrcode.qrcontext2 = fakeContext;
		var res = null;
		var qre = null;
		try {
			res = qrcode.decode();
		} catch (qret) {
			qre = qret;
		}
		return cb(qre, res);
	});
}
function qr_sharpen_and_read_robust(ipb, cb) {
	// This takes a buffer of a valid image file as input and a callback.
	var cb0 = function(err, res) {
		if (err || res == null) qr_sharpen_and_read(ipb, 1, cb);
		else cb(err, res);
	};
	var cb1 = function(err, res) {
		if (err || res == null) qr_sharpen_and_read(ipb, 2, cb0);
		else cb(err, res);
	};
	qr_sharpen_and_read(ipb, 0, cb1);
}
// qr_sharpen_and_read_robust(ipb5, function (err, res) { if (err) console.log(err); else console.log(res); });
// qr_sharpen_and_read_robust(ipb6, function (err, res) { if (err) console.log(err); else console.log(res); });

module.exports = exports = {qr_sharpen_and_read, qr_sharpen_and_read_robust};

