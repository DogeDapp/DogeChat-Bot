// DogeChat Bot Module 0.1.9 by cainy393
// MIT licence

var io = require('socket.io-client')
  , socket
  , logLevel = 1
  , logs = ""
  , botUsername = ""
  , loggedIn = false
  , gotColors = false
  , outputBuffer = []
  , botBalance = 0
  , botColor = "000"
  , botBadge = "none"
  , commands = {};

exports.connect = function(user, pass, callback) {
	botUsername = user;
	socket = io.connect("https://dogechat.net", {secure: true});
	socket.on('connect', function(){
		log("info", "Connected to DogeChat - logging in...");
		socket.emit('accounts', {action: 'login', username: user, password: pass});
	});
	socket.on('disconnect', function() {
		log("info", "Disconnected from DogeChat - reconnecting...");
		socket = io.connect("https://dogechat.net", {secure: true});
	});
	socket.on('loggedin', function(data){
		loggedIn = true;
		log("info", "Successfully logged in as " + data.username + ".");
		setTimeout(function() {
			if (typeof callback == 'function') callback();
		}, 1000);
		setInterval(function() {
			if (outputBuffer.length > 0) {
				log("dbug", "Outputting message from Output Buffer");
				var out = outputBuffer.splice(0, 1)[0];
				if (out.action == "chat") {
					socket.emit("chat", {
						room: out.room,
						message: out.message,
						color: botColor,
						badge: botBadge
					});
				} else if (out.action == "tip") {
					socket.emit("tip", {
						user: out.user,
						room: out.room,
						message: out.message,
						tip: out.tip
					});
				}
			}
		}, 600);
	});
	setTimeout(function(){
		if (loggedIn == false) {
			log("warn", "Login timed out - no response after 10 seconds.");
		}
	}, 10000);
	socket.on('chat', function(data) {
		var chatTime = new Date(data.timestamp).getTime() / 1000;
		var currentTime = new Date().getTime() / 1000;
		var difference = currentTime - chatTime;
		if (data.user != "!Topic" && data.user != "*System" && loggedIn && difference < 5) {
			if (contains(data.message, ["<span style=\"color: #"])) {
				data.message = data.message.split("\">")[1];
				data.message = data.message.replace("</span>", "");
			}
			msg = data.message.trim().replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#039;/g, "'");
			log("chat", "<" + data.user + "> " + msg);
			msgArray = msg.split(" ");
			command = msgArray.shift().toLowerCase();
			commandMsg = msgArray.join(" ");
			chatData = {
				"user": data.user,
				"room": data.room,
				"messageArray": msgArray,
				"timestamp": data.timestamp
			}
			if (typeof onChat === 'function') {
				chatData.message = msg;
				onChat(chatData);
			}
			if (typeof commands[command] == 'function') {
				chatData.command = command;
				chatData.message = commandMsg;
				commands[command](chatData);
			} else if (contains(data.message, ["<span class='label label-success'>has tipped " + botUsername + " "]) && typeof onTip == 'function') {
				amt = Number(data.message.split("<span class='label label-success'>has tipped ")[1].split(" ")[1]);
				message = data.message.split("(");
				message.shift();
				message = message.join("").split(")");
				message.pop();
				message = message.join("");
				log("chat", "Received " + amt + " doge from " + data.user + (message ? " (" + message + ")" : ""));
				onTip({
					"user": data.user,
					"amount": amt,
					"message": message,
					"room": data.room,
					"timestamp": data.timestamp
				});
			}
		}
	});
	socket.on('balance', function(data){
		if (typeof data.credits !== 'undefined') {
			botBalance = data.credits;
			log("info", "Bot balance is " + botBalance + " doge");
		} else if (typeof data.change !== 'undefined') {
			botBalance += data.change;
			log("dbug", "Bot balance is " + botBalance + " doge (" + (data.change > 0 ? "+" : "") + data.change + ")");
		}
	});
}

exports.chat = function(message, room) {
	outputBuffer.push({action: "chat", room: room, message: message});
	log("dbug", "Adding message to output buffer: [" + room + "] " + message);
}

exports.PM = function(user, message) {
	var room = [botUsername, user].sort().join(":")
	outputBuffer.push({action: "chat", room: room, message: message});
	log("dbug", "Adding message to output buffer: [" + room + "] " + message);
}

exports.tip = function(user, amount, room, message) {
	message = message ? message : "";
	if (amount == Math.round(amount)) {
		if (amount >= 5) {
			outputBuffer.push({action: "tip", user: user, room: room, message: message, tip: amount});
			log("dbug", "Tipping " + user + " " + amount + " doge " + " in #" + room + " (" + message + ")");
		} else {
			log("warn", "Cannot tip an amount lower than 5 doge.");
		}
	} else {
		log("warn", "Cannot tip a non-integer amount.")
	}
}

exports.onChat = function(chatFunc) {
	onChat = chatFunc;
	log("dbug", "Attached function to chat event.");
}

exports.onTip = function(tipFunc) {
	onTip = tipFunc;
	log("dbug", "Attached function to tip event.");
}

exports.addCommand = function(command, func) {
	commands[command] = func;
	log("dbug", "Added command to registry: " + command);
}

exports.joinRoom = function(room) {
	socket.emit('joinroom', {room: room});
	log("dbug", "Joining room: " + room);
}

exports.quitRoom = function(room) {
	socket.emit('quitroom', {room: room});
	log("dbug", "Quitting room: " + room);
}

exports.getBalance = function() {
	return botBalance;
}

exports.setColor = function(color) {
	botColor = color;
	log("dbug", "Set bot color to: " + color);
}

exports.setBadge = function(badge) {
	botBadge = badge;
	log("dbug", "Set bot badge to: " + badge);
}

exports.setLogLevel = function(level) {
	logLevel = level;
	log("info", "Set log level to " + level);
}

exports.logger = function(fn) {
	customLogger = fn;
}

function log(prefix, msg) {
	var time = new Date()
	  , timeStr = time.toISOString().replace("T", " ").slice(0, 16);
	prefix = prefix.toUpperCase();
	if (logLevel == 3 || (prefix == "DBUG" && logLevel >= 2) || ((prefix == "INFO" || prefix == "WARN") && logLevel >= 1)) {
		console.log(timeStr + " [" + prefix + "] " + msg);
	if (typeof customLogger === 'function') customLogger(prefix, msg, time);
	}
	if (prefix != "chat") {
		logs += timeStr + " [" + prefix + "] " + msg;
	}
}

function contains(string, terms) {
	for (var i = 0; i < terms.length; i++) {
		if (string.toLowerCase().indexOf(terms[i].toLowerCase()) == -1) {
			return false;
		}
	}
	return true;
}
