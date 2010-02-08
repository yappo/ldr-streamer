/* 
	// mxhr.js
	// BSD license

	var mxhr = new MXHR;
	mxhr.listen(mime, function(body){ process(body) });
	mxhr.listen('complete', function(status_code){ ... }); // 2xx response
	mxhr.listen('error', function(status_code){ ... });    // other case
	mxhr.open("GET", url, true); // or mxhr.open("POST", url, true);
	mxhr.send("");
*/

function MXHR() {
	this.req = new XMLHttpRequest;
	this.listeners = {};
	this.watcher_interval = 15;
	this.parsed = 0;
	this.boundary;
	this._watcher_id = null;
}

(function(p){
	function open(){
		var self = this;
		var res = this.req.open.apply(this.req, arguments);
		this.req.onreadystatechange = function(){
			if (self.req.readyState == 3 && self._watcher_id == null) { self.init_stream() }
			if (self.req.readyState == 4) { self.finish_stream(self.req.status) }
		};
		return res;
	}
	function send(){
		return this.req.send.apply(this.req, arguments);
	}
	function init_stream(){
		var self = this;
		var contentTypeHeader = this.req.getResponseHeader("Content-Type");
		if (contentTypeHeader.indexOf("multipart/mixed") == -1) {
			this.req.onreadystatechange = function() {
				self.req.onreadystatechange = function() {};
				self.invoke_callback('error', self.req.status);
			}
		} else {
			this.boundary = '--' + contentTypeHeader.split('"')[1];
			this.start_watcher();
		}
	}
	function finish_stream(status){
		this.stop_watcher();
		this.process_chunk();
		if (status >= 200 && status < 300) {
			this.invoke_callback('complete', status);
		} else {
			this.invoke_callback('error', status);
		}
	}
	function start_watcher() {
		var self = this;
		this._watcher_id = window.setInterval(function(){
			self.process_chunk();
		}, this.watcher_interval);
	}
	function stop_watcher() {
		window.clearInterval(this._watcher_id);
		this._watcher_id = null;
	}
	function listen(mime, callback){
		if(typeof this.listeners[mime] == 'undefined') {
			this.listeners[mime] = [];
		}
		if(typeof callback != 'undefined' && callback.constructor == Function) {
			this.listeners[mime].push(callback);
		}
	}
	function process_chunk(){
		var length = this.req.responseText.length;
		var rbuf = this.req.responseText.substring(this.parsed, length);
		// [parsed_length, header_and_body]
		var res = this.incr_parse(rbuf);
		if (res[0] > 0) {
			this.process_part(res[1]);
			this.parsed += res[0];
			if (length > this.parsed) this.process_chunk();
		}
	}
	function process_part(part) {
		var self = this;
		part = part.replace(this.boundary + "\n", '');
		var lines = part.split("\n");
		var mime = lines.shift().split('Content-Type:', 2)[1].split(";", 1)[0].replace(' ', '');
		mime = mime ? mime : null;
		var body = lines.join("\n");
		this.invoke_callback(mime, body);
	}
	function invoke_callback(mime, body) {
		var self = this;
		if(typeof this.listeners[mime] != 'undefined') {
			this.listeners[mime].forEach(function(cb) {
				cb.call(self, body);
			});
		}
	}
	function incr_parse(buf) {
		if (buf.length < 1) return [-1];
		var start = buf.indexOf(this.boundary);
		if (start == -1) return [-1];
		var end = buf.indexOf(this.boundary, start + this.boundary.length);
		// SUCCESS
		if (start > -1 && end > -1) {
			var part = buf.substring(start, end);
			// end != part.length in wrong response, ignore it
			return [end, part];
		}
		// INCOMPLETE
		return [-1];
	}
	var methods = "open,send,init_stream,finish_stream,start_watcher,stop_watcher,listen," +
	 			  "process_chunk,process_part,invoke_callback,incr_parse";
	eval(
		methods.split(",").map(function(v){
			return 'p.'+v+'='+v+';'
		}).join("")
	);
})(MXHR.prototype);

